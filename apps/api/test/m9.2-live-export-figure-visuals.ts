/**
 * Read-only visual evidence exporter for one persisted summary generation.
 * Downloads the exact reference assets sent to Stage 2 and the untouched
 * delivery SVG produced by the successful initial revision.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { FigureReferenceSnapshot } from "#api/modules/stem-figures/services/figure-reference-resolver.service";

async function main() {
  const generationId = requiredEnv("M9_2_LIVE_GENERATION_ID");
  const outputDirectory = resolve(
    process.cwd(),
    requiredEnv("M9_2_LIVE_OUTPUT_DIRECTORY"),
  );
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const prisma = app.get(PrismaService);
  const storage = app.get(ObjectStorageService);

  try {
    const figures = await prisma.stemFigure.findMany({
      where: { aiGenerationId: generationId, deletedAt: null },
      orderBy: [{ blockPath: "asc" }, { figureIndex: "asc" }],
      select: {
        id: true,
        blockPath: true,
        figureIndex: true,
        localPlanId: true,
        planJson: true,
        status: true,
        currentRevision: {
          select: {
            id: true,
            status: true,
            repairCount: true,
            latexSource: true,
            referenceSnapshotJson: true,
            providerRequestSnapshotsJson: true,
            deliveryFile: { select: { objectKey: true } },
            attempts: {
              orderBy: { attemptNumber: "asc" },
              select: { attemptNumber: true, kind: true, status: true },
            },
          },
        },
      },
    });

    await mkdir(outputDirectory, { recursive: true });
    const manifest = [];
    for (const [index, figure] of figures.entries()) {
      const directoryName = `${String(index + 1).padStart(2, "0")}-${figure.localPlanId.toLowerCase()}`;
      const figureDirectory = resolve(outputDirectory, directoryName);
      await mkdir(figureDirectory, { recursive: true });
      const revision = figure.currentRevision;
      if (!revision?.deliveryFile?.objectKey) {
        throw new Error(`Figure ${figure.id} has no current delivery SVG.`);
      }
      const svg = await storage.downloadObject(revision.deliveryFile.objectKey);
      await writeFile(resolve(figureDirectory, "first-pass.svg"), svg);
      if (revision.latexSource) {
        await writeFile(
          resolve(figureDirectory, "provider-output.tex"),
          revision.latexSource,
          "utf8",
        );
      }

      const snapshot = revision.referenceSnapshotJson as FigureReferenceSnapshot | null;
      const references = [];
      for (const [assetIndex, asset] of (snapshot?.assets ?? []).entries()) {
        const bytes = await storage.downloadObject(asset.objectKey);
        const extension = mimeExtension(asset.mimeType);
        const filename = `source-${assetIndex + 1}.${extension}`;
        await writeFile(resolve(figureDirectory, filename), bytes);
        references.push({ ...asset, filename });
      }
      const item = {
        directoryName,
        figureId: figure.id,
        blockPath: figure.blockPath,
        figureIndex: figure.figureIndex,
        localPlanId: figure.localPlanId,
        status: figure.status,
        plan: figure.planJson,
        revision: revision
          ? {
              id: revision.id,
              status: revision.status,
              repairCount: revision.repairCount,
              attempts: revision.attempts,
              providerRequestSnapshots: revision.providerRequestSnapshotsJson,
              deliveryObjectKey: revision.deliveryFile.objectKey,
            }
          : null,
        referenceStatus: snapshot?.status ?? "missing",
        references,
      };
      await writeFile(
        resolve(figureDirectory, "metadata.json"),
        `${JSON.stringify(item, null, 2)}\n`,
        "utf8",
      );
      manifest.push(item);
    }
    await writeFile(
      resolve(outputDirectory, "manifest.json"),
      `${JSON.stringify({ generationId, figures: manifest }, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(
      `${JSON.stringify({ generationId, figureCount: figures.length, outputDirectory })}\n`,
    );
  } finally {
    await app.close();
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function mimeExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

void main();
