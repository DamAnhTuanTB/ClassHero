/**
 * Read-only inventory of exact-label OCR crops used to choose live regression
 * cases. This script never calls an AI provider and never mutates lesson data.
 */
import { NestFactory } from "@nestjs/core";
import { DocumentStatus } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";

const lessonIds = [
  "b700e523-0e2e-4168-8b6a-9a32a91123ac",
  "960cfa6b-cdd4-4b4e-b751-954d24b593cb",
  "23cfdbcc-2ef8-4486-b673-ed23603ad208",
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const storage = app.get(ObjectStorageService);

  try {
    for (const lessonId of lessonIds) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { title: true },
      });
      const documents = await prisma.lessonDocument.findMany({
        where: { lessonId, status: DocumentStatus.READY, replacedAt: null },
        select: {
          activeOcrArtifact: { select: { imageManifestObjectKey: true } },
          sourceDocument: {
            select: {
              activeOcrArtifact: { select: { imageManifestObjectKey: true } },
            },
          },
        },
      });
      const groups = new Map<
        string,
        Array<{
          caption: string;
          pageNumber: number;
          imageId: string;
          usable: boolean;
        }>
      >();

      for (const document of documents) {
        const objectKey =
          document.activeOcrArtifact?.imageManifestObjectKey ??
          document.sourceDocument?.activeOcrArtifact?.imageManifestObjectKey;
        if (!objectKey) continue;
        const manifest = JSON.parse(
          (await storage.downloadObject(objectKey)).toString("utf8"),
        ) as {
          images?: Array<{
            captionCandidate?: unknown;
            pageNumber?: unknown;
            imageId?: unknown;
            isUsableForAi?: unknown;
          }>;
        };
        for (const image of manifest.images ?? []) {
          if (
            typeof image.captionCandidate !== "string" ||
            typeof image.pageNumber !== "number" ||
            typeof image.imageId !== "string"
          ) {
            continue;
          }
          const labels =
            image.captionCandidate.match(/Hình\s*\d+(?:\.\d+)+/giu) ?? [];
          for (const label of labels) {
            const identity = label.toLocaleLowerCase("vi").replace(/\s+/gu, "");
            const entries = groups.get(identity) ?? [];
            entries.push({
              caption: image.captionCandidate,
              pageNumber: image.pageNumber,
              imageId: image.imageId,
              usable: image.isUsableForAi === true,
            });
            groups.set(identity, entries);
          }
        }
      }

      const duplicateLabels = Object.fromEntries(
        [...groups.entries()].filter(([, entries]) => entries.length > 1),
      );
      process.stdout.write(
        `${JSON.stringify({ lessonId, title: lesson?.title, duplicateLabels })}\n`,
      );
    }
  } finally {
    await app.close();
  }
}

void main();
