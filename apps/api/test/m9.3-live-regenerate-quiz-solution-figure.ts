import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  BackgroundJobStatus,
  QuizFigureRevisionOrigin,
  QuizFigureRevisionStatus,
  QuizFigureRole,
  QuizFigureStatus,
} from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 8 * 60_000;

async function main() {
  if (process.env.M9_3_LIVE_EXECUTE !== "1") {
    throw new Error("Set M9_3_LIVE_EXECUTE=1 to authorize a paid Phase 2 call.");
  }
  const figureId = requiredEnv("M9_3_LIVE_SOLUTION_FIGURE_ID");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const prisma = app.get(PrismaService);
    const jobs = app.get(QuizFigureJobService);
    const figure = await prisma.quizFigure.findFirstOrThrow({
      where: { id: figureId, role: QuizFigureRole.SOLUTION, deletedAt: null },
      select: {
        id: true,
        createdById: true,
        currentRevision: { select: { altText: true, caption: true } },
        revisions: {
          orderBy: { sourceVersion: "desc" },
          take: 1,
          select: { sourceVersion: true },
        },
      },
    });
    if (!figure.currentRevision) throw new Error("Solution figure has no base revision.");
    const previousJob = await prisma.backgroundJob.findFirstOrThrow({
      where: { resourceType: "QUIZ_FIGURE", resourceId: figure.id },
      orderBy: { createdAt: "desc" },
      select: { inputMeta: true },
    });
    const routeSnapshot = readRecord(previousJob.inputMeta).routeSnapshot as
      | AiFeatureRoute
      | undefined;
    const revision = await prisma.$transaction(async (tx) => {
      const created = await tx.quizFigureRevision.create({
        data: {
          quizFigureId: figure.id,
          origin: QuizFigureRevisionOrigin.ADMIN_REGENERATE,
          status: QuizFigureRevisionStatus.QUEUED,
          sourceVersion: (figure.revisions[0]?.sourceVersion ?? 0) + 1,
          altText: figure.currentRevision!.altText,
          caption: figure.currentRevision!.caption,
          createdById: figure.createdById,
        },
        select: { id: true },
      });
      await tx.quizFigure.update({
        where: { id: figure.id },
        data: {
          status: QuizFigureStatus.QUEUED,
          pendingRevisionId: created.id,
          lastErrorCategory: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      return created;
    });
    const job = await jobs.enqueue(
      figure.id,
      figure.createdById,
      routeSnapshot,
    );
    const deadline = Date.now() + TIMEOUT_MS;
    let completed;
    while (Date.now() < deadline) {
      completed = await prisma.backgroundJob.findUniqueOrThrow({
        where: { id: job.id },
        select: { id: true, status: true, errorMessage: true },
      });
      if (
        completed.status === BackgroundJobStatus.SUCCEEDED ||
        completed.status === BackgroundJobStatus.FAILED ||
        completed.status === BackgroundJobStatus.CANCELLED
      ) {
        break;
      }
      await wait(POLL_INTERVAL_MS);
    }
    if (
      !completed ||
      ![
        BackgroundJobStatus.SUCCEEDED,
        BackgroundJobStatus.FAILED,
        BackgroundJobStatus.CANCELLED,
      ].includes(completed.status)
    ) {
      throw new Error(`Timed out waiting for ${job.id}.`);
    }
    const [usage, current] = await Promise.all([
      prisma.providerUsageEvent.findMany({
        where: { backgroundJobId: job.id },
        select: {
          id: true,
          status: true,
          promptTokens: true,
          completionTokens: true,
          costVnd: true,
          errorCode: true,
        },
      }),
      prisma.quizFigure.findUniqueOrThrow({
        where: { id: figure.id },
        select: {
          status: true,
          currentRevision: {
            select: {
              id: true,
              latexSource: true,
              derivedFromQuestionRevisionId: true,
              deliveryFileId: true,
            },
          },
        },
      }),
    ]);
    process.stdout.write(
      `${JSON.stringify(
        {
          job: completed,
          revisionId: revision.id,
          current,
          usage,
          totalCostVnd: usage.reduce((sum, event) => sum + event.costVnd, 0),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await app.close();
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

void main();
