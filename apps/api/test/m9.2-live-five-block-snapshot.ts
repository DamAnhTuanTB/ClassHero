import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { validateEnv, type EnvConfig } from "#api/config/env.validation";

async function main() {
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
  const lessonId = requiredEnv("M9_2_LIVE_LESSON_ID");
  const label = requiredEnv("M9_2_SNAPSHOT_LABEL");
  const outputDirectory = resolve(
    process.cwd(),
    process.env.M9_2_LIVE_OUTPUT_DIR ??
      "../../.codex/artifacts/m9.2-five-block-live-b15",
  );
  const env = validateEnv(process.env);
  const prisma = new PrismaService(new ConfigService<EnvConfig, true>(env, true));
  try {
    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        learningPath: { select: { id: true, title: true } },
        summary: {
          select: {
            id: true,
            source: true,
            reviewStatus: true,
            aiGenerationId: true,
            contentJson: true,
            createdAt: true,
            updatedAt: true,
            stemFigures: {
              where: { deletedAt: null },
              orderBy: [{ blockPath: "asc" }, { figureIndex: "asc" }],
              select: {
                id: true,
                blockPath: true,
                figureIndex: true,
                localPlanId: true,
                planJson: true,
                status: true,
                lastErrorCategory: true,
                lastErrorCode: true,
                currentRevision: {
                  select: {
                    id: true,
                    latexSource: true,
                    repairCount: true,
                    maxRepairAttempts: true,
                    status: true,
                    referenceSnapshotJson: true,
                    deliveryFile: { select: { objectKey: true } },
                    attempts: {
                      orderBy: { attemptNumber: "asc" },
                      select: {
                        attemptNumber: true,
                        kind: true,
                        status: true,
                        errorCategory: true,
                        errorCode: true,
                        collectionComplete: true,
                        durationMs: true,
                      },
                    },
                  },
                },
              },
            },
            aiGeneration: {
              select: {
                id: true,
                backgroundJobId: true,
                status: true,
                provider: true,
                model: true,
                promptVersion: true,
                schemaVersion: true,
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
                estimatedCostVnd: true,
                retryCount: true,
                startedAt: true,
                finishedAt: true,
                providerUsageEvents: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    provider: true,
                    feature: true,
                    attempt: true,
                    status: true,
                    promptTokens: true,
                    cachedInputTokens: true,
                    completionTokens: true,
                    totalTokens: true,
                    requestCount: true,
                    costVnd: true,
                    errorCode: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    await mkdir(outputDirectory, { recursive: true });
    const target = resolve(outputDirectory, `${label}-snapshot.json`);
    await writeFile(target, `${JSON.stringify(lesson, null, 2)}\n`, "utf8");
    process.stdout.write(`${target}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

void main();
