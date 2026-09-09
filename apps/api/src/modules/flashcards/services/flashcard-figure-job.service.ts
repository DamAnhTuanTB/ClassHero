import { Inject, Injectable } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  FlashcardFigureRevisionStatus,
  FlashcardFigureStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import type { PreviewFlashcardFigureAiDto } from "#api/modules/flashcards/dto/flashcard-figure-ai.dto";
import type { FlashcardFigureContext } from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

@Injectable()
export class FlashcardFigureJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly queue: BackgroundJobQueueService,
  ) {}

  async enqueue(input: {
    figureId: string;
    revisionId: string;
    actorUserId: string;
    dto: PreviewFlashcardFigureAiDto;
    routeSnapshot: AiFeatureRoute;
    contextSnapshot: FlashcardFigureContext;
  }) {
    const figure = await this.prisma.flashcardFigure.findUniqueOrThrow({
      where: { id: input.figureId },
      select: { id: true, lessonId: true, flashcardId: true, role: true },
    });
    const idempotencyKey = [
      "flashcard-solution-figure-render-v2",
      figure.id,
      input.revisionId,
    ].join(":");
    const existing = await this.prisma.backgroundJob.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    });
    if (existing) return existing;
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.backgroundJob.create({
        data: {
          queue: BackgroundJobQueue.FLASHCARD_FIGURE_RENDERING,
          status: BackgroundJobStatus.QUEUED,
          idempotencyKey,
          ownerUserId: input.actorUserId,
          lessonId: figure.lessonId,
          resourceType: "FLASHCARD_FIGURE",
          resourceId: figure.id,
          inputMeta: toJobJson({
            figureId: figure.id,
            flashcardId: figure.flashcardId,
            revisionId: input.revisionId,
            role: "SOLUTION",
            mode: input.dto.mode ?? "REGENERATE",
            contextSnapshot: input.contextSnapshot,
            routeSnapshot: input.routeSnapshot,
            adminInstructions: input.dto.adminInstructions ?? null,
            systemPrompt: input.dto.systemPrompt ?? null,
            userPrompt: input.dto.userPrompt ?? null,
          }),
          maxAttempts: 1,
        },
        select: { id: true, status: true },
      });
      await tx.flashcardFigureRevision.update({
        where: { id: input.revisionId },
        data: { status: FlashcardFigureRevisionStatus.QUEUED },
      });
      await tx.flashcardFigure.update({
        where: { id: figure.id },
        data: {
          status: FlashcardFigureStatus.QUEUED,
          pendingRevisionId: input.revisionId,
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
}
