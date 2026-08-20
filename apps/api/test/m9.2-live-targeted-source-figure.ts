/**
 * Paid, read-only Stage 2 regression for one historical source-backed figure.
 *
 * The script rebuilds the figure's reference snapshot with the current resolver,
 * calls the configured model through the accounting gateway exactly once, and
 * compiles the untouched provider output exactly once. It never mutates lesson
 * or figure rows.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AiGenerationType, DocumentStatus } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";
import { stemFigureRenderPlanSchema } from "#api/modules/ai/types/lesson-summary.types";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { FigureReferenceResolverService } from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import { TexRendererClientService } from "#api/modules/stem-figures/services/tex-renderer-client.service";
import {
  stemFigureGenerationBriefSchema,
  type StemFigureGenerationBrief,
} from "#api/modules/stem-figures/types/stem-figure-generation.types";
import type { StemFigureProviderRequestSnapshotCollection } from "#api/modules/stem-figures/types/stem-figure-provider-request.types";

async function main() {
  if (process.env.RUN_M9_2_LIVE_TARGETED_FIGURE !== "1") {
    throw new Error("Set RUN_M9_2_LIVE_TARGETED_FIGURE=1 to authorize one paid call.");
  }
  const figureId = requiredEnv("M9_2_LIVE_SOURCE_FIGURE_ID");
  const fallbackLessonId = process.env.M9_2_LIVE_LESSON_ID?.trim() || null;
  const backgroundJobId = requiredEnv("M9_2_LIVE_BACKGROUND_JOB_ID");
  const model = process.env.M9_2_LIVE_MODEL?.trim() || "gpt-5.6-terra";
  const liveCase = parseLiveCase(process.env.M9_2_LIVE_CASE);
  const inspectOnly = process.env.M9_2_LIVE_INSPECT_ONLY === "1";
  const outputDirectory = resolve(
    process.cwd(),
    process.env.M9_2_LIVE_OUTPUT_DIRECTORY ??
      "../../.codex/artifacts/m9-2-terra-live-b15/targeted-5.32",
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const packets = app.get(LessonSourcePacketService);
  const resolver = app.get(FigureReferenceResolverService);
  const storage = app.get(ObjectStorageService);
  const routing = app.get(AiModelRoutingService);
  const generator = app.get(StemFigureRepairService);
  const renderer = app.get(TexRendererClientService);
  let packetObjectKey: string | null = null;

  try {
    const figure = await prisma.stemFigure.findUnique({
      where: { id: figureId },
      select: {
        lessonId: true,
        planJson: true,
        subjectKey: true,
        subjectName: true,
        subjectSlug: true,
        revisions: {
          orderBy: { sourceVersion: "desc" },
          select: { providerRequestSnapshotsJson: true },
        },
      },
    });
    const fixture = figure ? null : buildRegressionFixture(fallbackLessonId, liveCase);
    const lessonId = figure?.lessonId ?? fixture!.lessonId;
    const plan = figure
      ? stemFigureRenderPlanSchema.parse(figure.planJson)
      : fixture!.plan;
    const historicalBrief = figure
      ? readLatestGenerationBrief(
          figure.revisions.map((revision) => revision.providerRequestSnapshotsJson),
        )
      : fixture!.brief;
    const subject = figure
      ? {
          key: figure.subjectKey as "MATH",
          name: figure.subjectName,
          slug: figure.subjectSlug,
        }
      : { key: "MATH" as const, name: "Toán", slug: "toan" };
    const documents = await prisma.lessonDocument.findMany({
      where: {
        lessonId,
        status: DocumentStatus.READY,
        replacedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const packet = await packets.build(
      lessonId,
      documents.map((document) => document.id),
    );
    packetObjectKey = packet.objectKey;
    const referenceSnapshot = await resolver.resolve({
      manifest: packet.manifest,
      plan,
    });
    const brief: StemFigureGenerationBrief = {
      ...historicalBrief,
      referenceAssets: referenceSnapshot.assets,
      referenceImageMode:
        referenceSnapshot.assets.length === 0 ? "NONE" : "SOURCE_CROP_ONLY",
    };
    const referencePayloads = await Promise.all(
      referenceSnapshot.assets.map(async (asset) => {
        const bytes = await storage.downloadObject(asset.objectKey);
        return {
          bytes,
          input: {
            imageUrl: `data:${asset.mimeType};base64,${bytes.toString("base64")}`,
            detail: "high" as const,
          },
        };
      }),
    );
    const referenceImages = referencePayloads.map((payload) => payload.input);
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all(
      referencePayloads.map((payload, index) =>
        writeFile(
          resolve(
            outputDirectory,
            `reference-${index + 1}.${extensionForMimeType(referenceSnapshot.assets[index]?.mimeType)}`,
          ),
          payload.bytes,
        ),
      ),
    );
    await writeFile(
      resolve(outputDirectory, "reference-snapshot.json"),
      `${JSON.stringify(referenceSnapshot, null, 2)}\n`,
      "utf8",
    );
    if (inspectOnly) {
      process.stdout.write(
        `${JSON.stringify({ inspectOnly: true, outputDirectory, referenceSnapshot })}\n`,
      );
      return;
    }
    const candidate = await routing.resolveCandidateByModel(model);
    if (!candidate?.available) {
      throw new Error(`Model ${model} is not available with an active credential.`);
    }
    const latexSource = await generator.createNew({
      figureId: randomUUID(),
      revisionId: randomUUID(),
      aiGenerationId: null,
      backgroundJobId,
      jobAttempt: 1,
      subject,
      brief,
      referenceImages,
      routeSnapshot: {
        feature: AiGenerationType.SUMMARY,
        version: 1,
        model,
        temperature: 0.1,
        reasoningEffort: "medium",
        maxOutputTokens: 12_000,
        candidates: [candidate],
        hasConfiguration: true,
      },
    });
    const rendered = await renderer.render(latexSource, "MATH");
    await writeFile(resolve(outputDirectory, "provider-output.tex"), latexSource, "utf8");
    if (rendered.ok) {
      await writeFile(resolve(outputDirectory, "first-pass.svg"), rendered.svg, "utf8");
    }
    await writeFile(
      resolve(outputDirectory, "result.json"),
      `${JSON.stringify(
        {
          sourceFigureId: figureId,
          liveCase,
          model,
          referenceSnapshot,
          firstCompilePassed: rendered.ok,
          rendererCode: rendered.ok ? null : rendered.code,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.stdout.write(
      `${JSON.stringify({ firstCompilePassed: rendered.ok, outputDirectory })}\n`,
    );
    if (!rendered.ok) process.exitCode = 1;
  } finally {
    if (packetObjectKey) {
      await packets.cleanup(packetObjectKey).catch(() => undefined);
    }
    await app.close();
  }
}

function extensionForMimeType(mimeType: string | undefined) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

type LiveCase = "SOURCE_EXACT" | "PAGE_FALLBACK" | "NO_REFERENCE";

function buildRegressionFixture(lessonId: string | null, liveCase: LiveCase) {
  if (!lessonId) {
    throw new Error(
      "Historical figure was removed; M9_2_LIVE_LESSON_ID is required for the regression fixture.",
    );
  }
  if (liveCase === "NO_REFERENCE") {
    const plan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      localId: "F099",
      figureOrigin: "GENERATED_FROM_BRIEF",
      sourceReferences: [],
    });
    const brief = stemFigureGenerationBriefSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "GENERATED_FROM_BRIEF",
      targetGrade: 12,
      blockPath: "sections.0.blocks.0",
      blockContent: {
        type: "knowledge",
        title: "Vectơ chỉ phương của đường thẳng",
        content:
          "Vectơ u khác vectơ không được gọi là vectơ chỉ phương của đường thẳng Delta nếu giá của u song song hoặc trùng với Delta.",
      },
      sourceReferences: [],
      referenceAssets: [],
      referenceImageMode: "NONE",
      adminInstructions: null,
    });
    return { lessonId, plan, brief };
  }

  const plan = stemFigureRenderPlanSchema.parse({
    figurePlanContractVersion: 3,
    localId: "F006",
    figureOrigin: "TEXTBOOK_SOURCE",
    sourceReferences: [
      {
        packetPageNumber: 9,
        printedPageLabel: "49",
        figureLabel: liveCase === "PAGE_FALLBACK" ? null : "Hình 5.32",
        sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
      },
    ],
  });
  const brief = stemFigureGenerationBriefSchema.parse({
    figurePlanContractVersion: 3,
    figureOrigin: "TEXTBOOK_SOURCE",
    targetGrade: 12,
    blockPath: "sections.3.blocks.1",
    blockContent: {
      type: "example",
      origin: "SOURCE_ADAPTED",
      isGeometry: false,
      problem:
        "Trên mặt đất phẳng, một cây cột thẳng cao $6$ m, có chân cột tại $O$. Bóng của đỉnh cột trên mặt đất cách $O$ $3$ m về hướng $S60^\\circ E$. Chọn hệ trục $Oxyz$ có tia $Ox$ chỉ hướng nam, tia $Oy$ chỉ hướng đông, tia $Oz$ chứa cây cột. Hãy viết phương trình đường thẳng chứa tia nắng mặt trời đi qua đỉnh cột.",
    },
    sourceReferences: plan.sourceReferences,
    referenceAssets: [],
    referenceImageMode: "SOURCE_CROP_ONLY",
    adminInstructions: null,
  });
  return { lessonId, plan, brief };
}

function readLatestGenerationBrief(values: unknown[]) {
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const collection = value as StemFigureProviderRequestSnapshotCollection;
    for (const call of [...(collection.calls ?? [])].reverse()) {
      const parsed = stemFigureGenerationBriefSchema.safeParse(call.generationBrief);
      if (parsed.success) return parsed.data;
    }
  }
  throw new Error("Historical figure has no reusable generation brief.");
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseLiveCase(value: string | undefined): LiveCase {
  if (!value?.trim()) return "SOURCE_EXACT";
  if (value === "SOURCE_EXACT" || value === "PAGE_FALLBACK" || value === "NO_REFERENCE") {
    return value;
  }
  throw new Error("M9_2_LIVE_CASE must be SOURCE_EXACT, PAGE_FALLBACK, or NO_REFERENCE.");
}

void main();
