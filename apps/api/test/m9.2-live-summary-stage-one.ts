import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AiGenerationType, DocumentStatus } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";
import {
  LESSON_SUMMARY_PROMPT_VERSIONS,
  LESSON_SUMMARY_SCHEMA_VERSION,
  getLessonSummaryProviderTransportOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";

async function main() {
  if (process.env.RUN_M9_2_LIVE_SUMMARY !== "1") {
    throw new Error("Set RUN_M9_2_LIVE_SUMMARY=1 to authorize the paid live call.");
  }

  const lessonId = requiredEnv("M9_2_LIVE_LESSON_ID");
  const model = process.env.M9_2_LIVE_MODEL?.trim() || "gpt-5.6-terra";
  const outputPath = resolve(
    process.cwd(),
    process.env.M9_2_LIVE_OUTPUT ??
      `../../.codex/artifacts/m9.2-five-block-live-b15/b15-${LESSON_SUMMARY_PROMPT_VERSIONS.MATH}-${model}.json`,
  );
  if (process.env.M9_2_LIVE_FORCE !== "1") {
    const cached = await readFile(outputPath, "utf8").catch(() => null);
    if (cached) {
      process.stdout.write(`CACHE_HIT ${outputPath}\n`);
      return;
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const packets = app.get(LessonSourcePacketService);
  const routing = app.get(AiModelRoutingService);
  const providerCalls = app.get(AiProviderCallService);
  let packetObjectKey: string | null = null;

  try {
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { id: lessonId, deletedAt: null },
      select: { title: true },
    });
    const documents = await prisma.lessonDocument.findMany({
      where: {
        lessonId,
        status: DocumentStatus.READY,
        replacedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const documentIds = documents.map((document) => document.id);
    const packet = await packets.build(lessonId, documentIds);
    packetObjectKey = packet.objectKey;

    const candidate = await routing.resolveCandidateByModel(model);
    if (!candidate?.available) {
      throw new Error(`Model ${model} is not available with an active credential.`);
    }
    const subject = { key: "MATH" as const, name: "Toán", slug: "toan" };
    const structuredInput = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: lesson.title,
      targetGrade: 12,
      subject,
      documentIds,
      sourceHash: packet.sourceHash,
      packet: {
        filename: packet.filename,
        bytes: packet.bytes,
        modelManifest: packet.modelManifest,
      },
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "detailed",
        targetWordCount: null,
        extraInstructions: "",
        schemaReferenceStrategy: "inline",
      },
    });
    const providerSchema = getLessonSummaryProviderTransportOutputSchema(
      subject.key,
      "CONTEXTUAL",
      12,
    );
    const result = await providerCalls.generateStructured(
      {
        feature: AiGenerationType.SUMMARY,
        attempt: 1,
        callSequence: 1,
        idempotencyKey: `m9.2-live-stage-one:${lessonId}:${LESSON_SUMMARY_PROMPT_VERSIONS.MATH}:${model}`,
        routeSnapshot: {
          feature: AiGenerationType.SUMMARY,
          version: 1,
          model,
          temperature: 0.1,
          reasoningEffort: "medium",
          maxOutputTokens: 16_000,
          candidates: [candidate],
          hasConfiguration: true,
        },
      },
      structuredInput,
      providerSchema,
    );
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output: result.data,
      packetPageCount: packet.manifest.pageCount,
      targetGrade: 12,
      subjectKey: subject.key,
    });

    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          lessonId,
          lessonTitle: lesson.title,
          model,
          promptVersion: LESSON_SUMMARY_PROMPT_VERSIONS.MATH,
          schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
          usage: result.usage ?? null,
          providerRequestId: result.providerRequestId ?? null,
          latencyMs: result.latencyMs,
          packetManifest: packet.modelManifest,
          providerOutput: result.data,
          mappedContent: mapped.content,
          figurePlans: mapped.figures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.stdout.write(`LIVE_SUCCESS ${outputPath}\n`);
  } finally {
    if (packetObjectKey) {
      await packets.cleanup(packetObjectKey).catch(() => undefined);
    }
    await app.close();
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

void main();
