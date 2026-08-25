import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  QuizFigureRevisionOrigin,
  QuizFigureRevisionStatus,
  QuizFigureStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

@Injectable()
export class QuizFigureJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly queue: BackgroundJobQueueService,
  ) {}

  async enqueue(
    figureId: string,
    ownerUserId?: string | null,
    routeSnapshot?: AiFeatureRoute,
    createOptions?: {
      adminInstructions?: string | null;
      aiMode?: "REGENERATE" | "EDIT_CURRENT";
      operation?: "GENERATE" | "REFINE_CURRENT";
      systemPrompt?: string | null;
      userPrompt?: string | null;
    },
  ) {
    const figure = await this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: figureId },
      select: {
        id: true,
        lessonId: true,
        role: true,
        pendingRevisionId: true,
        currentRevisionId: true,
      },
    });
    const revisionId = figure.pendingRevisionId ?? figure.currentRevisionId;
    if (!revisionId) throw new Error(`Quiz figure ${figureId} has no revision.`);
    const revision = await this.prisma.quizFigureRevision.findFirstOrThrow({
      where: { id: revisionId, quizFigureId: figureId },
      select: { id: true, sourceVersion: true, sourceHash: true },
    });
    const idempotencyKey = [
      "quiz-figure-render-v1",
      figure.id,
      revision.id,
      revision.sourceVersion,
      revision.sourceHash ?? "pending-ai-source",
    ].join(":");
    const existing = await this.prisma.backgroundJob.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    });
    if (existing) return existing;
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.backgroundJob.create({
        data: {
          queue: BackgroundJobQueue.QUIZ_FIGURE_RENDERING,
          status: BackgroundJobStatus.QUEUED,
          idempotencyKey,
          ownerUserId: ownerUserId ?? null,
          lessonId: figure.lessonId,
          resourceType: "QUIZ_FIGURE",
          resourceId: figure.id,
          inputMeta: toJobJson({
            figureId: figure.id,
            revisionId: revision.id,
            role: figure.role,
            routeSnapshot: routeSnapshot ?? null,
            adminInstructions: createOptions?.adminInstructions ?? null,
            aiMode: createOptions?.aiMode ?? "REGENERATE",
            operation: createOptions?.operation ?? "GENERATE",
            systemPrompt: createOptions?.systemPrompt ?? null,
            userPrompt: createOptions?.userPrompt ?? null,
          }),
          maxAttempts: 1,
        },
        select: { id: true, status: true },
      });
      await tx.quizFigureRevision.update({
        where: { id: revision.id },
        data: { status: QuizFigureRevisionStatus.QUEUED },
      });
      await tx.quizFigure.update({
        where: { id: figure.id },
        data: {
          status: QuizFigureStatus.QUEUED,
          pendingRevisionId: revision.id,
          lastErrorCategory: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      return created;
    });
    await this.queue.enqueue(job.id);
    return job;
  }

  async retryPersistedSource(
    figureId: string,
    ownerUserId?: string | null,
    routeSnapshot?: AiFeatureRoute,
  ) {
    const figure = await this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: figureId },
      select: {
        id: true,
        role: true,
        quizQuestionId: true,
        createdById: true,
        pendingRevision: {
          select: {
            latexSource: true,
            altText: true,
            caption: true,
            sourceVersion: true,
          },
        },
        currentRevision: {
          select: {
            latexSource: true,
            altText: true,
            caption: true,
            sourceVersion: true,
          },
        },
        revisions: {
          orderBy: { sourceVersion: "desc" },
          take: 1,
          select: { sourceVersion: true },
        },
      },
    });
    const source = figure.pendingRevision ?? figure.currentRevision;
    if (!source?.latexSource) {
      throw new Error(`Quiz figure ${figureId} has no persisted TeX source to retry.`);
    }
    const latexSource = source.latexSource;
    const revision = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quizFigureRevision.create({
        data: {
          quizFigureId: figure.id,
          origin: QuizFigureRevisionOrigin.MANUAL_REPAIR,
          status: QuizFigureRevisionStatus.QUEUED,
          latexSource,
          sourceHash: QuizFigureJobService.sourceHash(latexSource),
          sourceVersion: (figure.revisions[0]?.sourceVersion ?? 0) + 1,
          altText: source.altText,
          caption: source.caption,
          createdById: ownerUserId ?? figure.createdById,
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
      if (figure.role === "QUESTION") {
        const dependent = await tx.quizFigure.findFirst({
          where: {
            quizQuestionId: figure.quizQuestionId,
            role: "SOLUTION",
            deletedAt: null,
          },
          select: { id: true, pendingRevisionId: true },
        });
        if (dependent) {
          await tx.quizFigure.update({
            where: { id: dependent.id },
            data: {
              status: QuizFigureStatus.QUEUED,
              lastErrorCategory: null,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          });
          if (dependent.pendingRevisionId) {
            await tx.quizFigureRevision.update({
              where: { id: dependent.pendingRevisionId },
              data: {
                status: QuizFigureRevisionStatus.QUEUED,
                derivedFromQuestionRevisionId: null,
                lastErrorCategory: null,
                lastErrorCode: null,
                lastErrorMessage: null,
                finishedAt: null,
              },
            });
          }
        }
      }
      return created;
    });
    await this.enqueue(figure.id, ownerUserId, routeSnapshot);
    return revision;
  }

  static sourceHash(source: string) {
    return createHash("sha256").update(source.trim()).digest("hex");
  }
}
