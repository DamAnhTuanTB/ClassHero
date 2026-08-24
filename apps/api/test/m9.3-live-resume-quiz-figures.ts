import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { QuizFigureRole, QuizFigureStatus, UserRole } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import { QUIZ_PROMPT_VERSION } from "#api/modules/quiz/types/quiz-generation.types";

const lessonIds = [
  "b700e523-0e2e-4168-8b6a-9a32a91123ac",
  "23cfdbcc-2ef8-4486-b673-ed23603ad208",
  "ca04044c-4609-4535-aa05-954ed9f21fe9",
];
const timeoutMs = 10 * 60_000;

async function main() {
  if (process.env.M9_3_LIVE_EXECUTE !== "1") {
    throw new Error("Set M9_3_LIVE_EXECUTE=1 to allow pending solution calls.");
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const prisma = app.get(PrismaService);
    const jobs = app.get(QuizFigureJobService);
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });
    const generations = await Promise.all(
      lessonIds.map((lessonId) =>
        prisma.aiGeneration.findFirstOrThrow({
          where: {
            lessonId,
            status: "SUCCEEDED",
            promptVersion: QUIZ_PROMPT_VERSION,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, lessonId: true },
        }),
      ),
    );
    const generationIds = generations.map((generation) => generation.id);
    const expectedFigureCount = await prisma.quizFigure.count({
      where: { aiGenerationId: { in: generationIds }, deletedAt: null },
    });
    const beforeCostVnd = await totalCost(prisma, generationIds);
    const failedQuestions = await prisma.quizFigure.findMany({
      where: {
        aiGenerationId: { in: generationIds },
        role: QuizFigureRole.QUESTION,
        status: QuizFigureStatus.NEEDS_REVIEW,
        pendingRevision: { latexSource: { not: null } },
        deletedAt: null,
      },
      select: { id: true },
    });
    for (const figure of failedQuestions) {
      await jobs.retryPersistedSource(figure.id, admin.id);
    }

    const figures = await waitForTerminalFigures(
      prisma,
      generationIds,
      expectedFigureCount,
    );
    const afterCostVnd = await totalCost(prisma, generationIds);
    process.stdout.write(
      `${JSON.stringify(
        {
          retriedQuestionFigureCount: failedQuestions.length,
          paidCostBeforeVnd: beforeCostVnd,
          paidCostAfterVnd: afterCostVnd,
          paidCostDeltaVnd: afterCostVnd - beforeCostVnd,
          figures,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await app.close();
  }
}

async function waitForTerminalFigures(
  prisma: PrismaService,
  aiGenerationIds: string[],
  expectedFigureCount: number,
) {
  if (expectedFigureCount === 0) return [];
  const deadline = Date.now() + timeoutMs;
  const terminal = new Set<QuizFigureStatus>([
    QuizFigureStatus.SUCCEEDED,
    QuizFigureStatus.NEEDS_REVIEW,
    QuizFigureStatus.FAILED,
  ]);
  while (Date.now() < deadline) {
    const figures = await prisma.quizFigure.findMany({
      where: { aiGenerationId: { in: aiGenerationIds }, deletedAt: null },
      orderBy: [{ lessonId: "asc" }, { quizQuestionId: "asc" }, { role: "asc" }],
      select: {
        id: true,
        lessonId: true,
        quizQuestionId: true,
        role: true,
        status: true,
        lastErrorCode: true,
        currentRevision: {
          select: {
            id: true,
            derivedFromQuestionRevisionId: true,
            deliveryFile: { select: { objectKey: true } },
          },
        },
      },
    });
    if (
      figures.length === expectedFigureCount &&
      figures.every((figure) => terminal.has(figure.status))
    ) {
      return figures;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Timed out waiting for resumed Quiz figures.");
}

async function totalCost(prisma: PrismaService, aiGenerationIds: string[]) {
  const aggregate = await prisma.providerUsageEvent.aggregate({
    where: { aiGenerationId: { in: aiGenerationIds } },
    _sum: { costVnd: true },
  });
  return aggregate._sum.costVnd ?? 0;
}

void main();
