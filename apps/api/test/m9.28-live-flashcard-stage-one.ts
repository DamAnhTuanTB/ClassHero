import { NestFactory } from "@nestjs/core";
import {
  AiGenerationType,
  BackgroundJobStatus,
  Difficulty,
  DocumentStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FlashcardGenerationJobService } from "#api/modules/flashcards/services/flashcard-generation-job.service";

const DEFAULT_BUDGET_VND = 10_000;
const POLL_INTERVAL_MS = 1_000;
const POLL_LIMIT = 180;

async function main() {
  if (process.env.RUN_M9_28_LIVE_FLASHCARD !== "1") {
    throw new Error(
      "Set RUN_M9_28_LIVE_FLASHCARD=1 to enable the live Flashcard preview.",
    );
  }

  const execute = process.env.M9_28_LIVE_EXECUTE === "1";
  const budgetVnd = readPositiveNumberEnv(
    "M9_28_LIVE_MAX_BUDGET_VND",
    DEFAULT_BUDGET_VND,
  );
  const requestedLessonId = process.env.M9_28_LIVE_LESSON_ID?.trim();
  const learningPathQuery =
    process.env.M9_28_LIVE_LEARNING_PATH_QUERY?.trim() || "Toán 10";
  const selectedModel = process.env.M9_28_LIVE_MODEL?.trim();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const prisma = app.get(PrismaService);
  const generation = app.get(FlashcardGenerationJobService);

  try {
    const lesson = await prisma.lesson.findFirst({
      where: {
        deletedAt: null,
        learningPath: {
          deletedAt: null,
          ...(!requestedLessonId
            ? {
                title: { contains: learningPathQuery, mode: "insensitive" },
              }
            : {}),
        },
        ...(requestedLessonId
          ? { id: requestedLessonId }
          : {}),
        documents: {
          some: {
            status: DocumentStatus.READY,
            replacedAt: null,
            chunkCount: { gt: 0 },
          },
        },
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        learningPath: { select: { title: true } },
        documents: {
          where: {
            status: DocumentStatus.READY,
            replacedAt: null,
            chunkCount: { gt: 0 },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: { id: true, title: true, chunkCount: true },
        },
        flashcardSets: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: { id: true, title: true },
        },
      },
    });
    if (!lesson || !lesson.documents[0]) {
      throw new Error(
        `No READY lesson document found for ${requestedLessonId ?? learningPathQuery}.`,
      );
    }
    const admin = await prisma.user.findFirst({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!admin) throw new Error("No active admin user is available for the live test.");

    const document = lesson.documents[0];
    const targetFlashcardSetId = lesson.flashcardSets[0]?.id;
    const input = {
      ...(targetFlashcardSetId ? { targetFlashcardSetId } : {}),
      documentIds: [document.id],
      cardCount: 1,
      realWorldCardCount: 0,
      difficulty: Difficulty.MEDIUM,
      style: "student_friendly" as const,
      styleInstructions:
        "Dễ hiểu, gần gũi, sử dụng cách diễn đạt và mức độ chi tiết phù hợp lứa tuổi.",
      extraInstructions:
        "Chỉ tạo một thẻ hỏi và trả lời một kiến thức lý thuyết cốt lõi có trong tài liệu nguồn.",
      ...(selectedModel ? { model: selectedModel } : {}),
      maxOutputTokens: 1_000,
    };
    const preview = await generation.preview(lesson.id, admin.id, input);
    const estimatedUpperBoundVnd = preview.estimatedCost.upperBoundVnd;

    process.stdout.write(
      `${JSON.stringify({
        mode: execute ? "execute" : "preview",
        learningPath: lesson.learningPath.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        documentId: document.id,
        documentTitle: document.title,
        sourceChunkCount: preview.context.chunkCount,
        model: preview.configuration.resolvedModel,
        estimatedUpperBoundVnd,
        budgetVnd,
      })}\n`,
    );

    if (!execute) return;
    if (
      estimatedUpperBoundVnd === null ||
      estimatedUpperBoundVnd > budgetVnd
    ) {
      throw new Error(
        `Estimated upper bound ${String(estimatedUpperBoundVnd)} VND exceeds live budget ${budgetVnd} VND.`,
      );
    }

    const startedAt = new Date();
    const queued = await generation.queue(lesson.id, admin.id, {
      ...input,
      requestDraftId: preview.requestDraftId,
      requestHash: preview.requestHash,
    });
    const completedJob = await waitForJob(prisma, queued.jobId);
    const aiGeneration = await prisma.aiGeneration.findFirst({
      where: {
        backgroundJobId: queued.jobId,
        type: AiGenerationType.FLASHCARD,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCostVnd: true,
        latencyMs: true,
        errorMessage: true,
        targetId: true,
      },
    });
    const createdCard = aiGeneration?.targetId
      ? await prisma.flashcard.findFirst({
          where: {
            flashcardSetId: aiGeneration.targetId,
            createdAt: { gte: startedAt },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            frontJson: true,
            backJson: true,
            reviewStatus: true,
            sourceMetadataJson: true,
          },
        })
      : null;

    process.stdout.write(
      `${JSON.stringify({
        jobId: completedJob.id,
        jobStatus: completedJob.status,
        jobError: completedJob.errorMessage,
        aiGeneration,
        createdCard: createdCard
          ? {
              id: createdCard.id,
              front: tiptapText(createdCard.frontJson),
              back: tiptapText(createdCard.backJson),
              reviewStatus: createdCard.reviewStatus,
              figureDecision: createdCard.sourceMetadataJson,
            }
          : null,
      })}\n`,
    );

    if (completedJob.status !== BackgroundJobStatus.SUCCEEDED || !createdCard) {
      throw new Error("The live Flashcard job did not persist a generated card.");
    }
  } finally {
    await app.close();
  }
}

async function waitForJob(prisma: PrismaService, jobId: string) {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, errorMessage: true },
    });
    if (!job) throw new Error(`Background job ${jobId} no longer exists.`);
    if (
      job.status === BackgroundJobStatus.SUCCEEDED ||
      job.status === BackgroundJobStatus.FAILED ||
      job.status === BackgroundJobStatus.CANCELLED
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out while waiting for background job ${jobId}.`);
}

function tiptapText(value: unknown) {
  const visit = (node: unknown): string => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return "";
    const record = node as Record<string, unknown>;
    const own = typeof record.text === "string" ? record.text : "";
    const children = Array.isArray(record.content)
      ? record.content.map(visit).join(" ")
      : "";
    return `${own} ${children}`.replace(/\s+/gu, " ").trim();
  };
  return visit(value);
}

function readPositiveNumberEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
