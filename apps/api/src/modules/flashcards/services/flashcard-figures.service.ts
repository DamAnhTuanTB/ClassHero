import { Inject, Injectable } from "@nestjs/common";
import {
  FlashcardFigureRevisionOrigin,
  FlashcardFigureRole,
  FlashcardFigureStatus,
} from "@prisma/client";

import { notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { CreateFlashcardFigureAiDto } from "#api/modules/flashcards/dto/flashcard-figure-ai.dto";
import { FlashcardFigureArtifactService } from "#api/modules/flashcards/services/flashcard-figure-artifact.service";
import { FlashcardFigureJobService } from "#api/modules/flashcards/services/flashcard-figure-job.service";
import { FlashcardFigureRequestService } from "#api/modules/flashcards/services/flashcard-figure-request.service";
import type { FlashcardFigureContext } from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import { resolveFlashcardSubject } from "#api/modules/flashcards/utils/flashcard-subject";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

@Injectable()
export class FlashcardFiguresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlashcardFigureRequestService)
    private readonly requests: FlashcardFigureRequestService,
    @Inject(FlashcardFigureJobService)
    private readonly jobs: FlashcardFigureJobService,
    @Inject(FlashcardFigureArtifactService)
    private readonly artifacts: FlashcardFigureArtifactService,
  ) {}

  async attachAdminUpload(input: {
    flashcardId: string;
    fileId: string;
    altText: string;
    caption?: string | null;
    actorUserId: string;
  }) {
    const card = await this.prisma.flashcard.findFirst({
      where: { id: input.flashcardId, deletedAt: null },
      select: {
        id: true,
        lessonId: true,
        lesson: {
          select: {
            learningPath: {
              select: { domain: { select: { name: true, slug: true } } },
            },
          },
        },
      },
    });
    if (!card) {
      throw notFoundException("FLASHCARD_NOT_FOUND", "Không tìm thấy Flashcard.");
    }
    const subject = resolveFlashcardSubject({
      domainName: card.lesson.learningPath.domain.name,
      domainSlug: card.lesson.learningPath.domain.slug,
    });
    const figure = await this.prisma.$transaction(async (tx) => {
      const figure = await tx.flashcardFigure.upsert({
        where: {
          flashcardId_role: {
            flashcardId: card.id,
            role: FlashcardFigureRole.SOLUTION,
          },
        },
        create: {
          lessonId: card.lessonId,
          flashcardId: card.id,
          role: FlashcardFigureRole.SOLUTION,
          subjectKey: subject.key,
          subjectName: subject.name,
          subjectSlug: subject.slug,
          status: FlashcardFigureStatus.QUEUED,
          createdById: input.actorUserId,
        },
        update: {
          deletedAt: null,
          subjectKey: subject.key,
          subjectName: subject.name,
          subjectSlug: subject.slug,
        },
        select: { id: true },
      });
      await this.artifacts.attachAdminUpload(
        {
          figureId: figure.id,
          fileId: input.fileId,
          actorUserId: input.actorUserId,
          altText: input.altText,
          caption: input.caption,
        },
        tx,
      );
      return figure;
    });
    return this.prisma.flashcardFigure.findUniqueOrThrow({
      where: { id: figure.id },
      select: {
        id: true,
        role: true,
        status: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        currentRevision: {
          select: {
            id: true,
            sourceKind: true,
            latexSource: true,
            altText: true,
            caption: true,
            deliveryFile: { select: { id: true, publicUrl: true } },
          },
        },
      },
    });
  }

  async delete(flashcardId: string, figureId: string) {
    const figure = await this.prisma.flashcardFigure.findFirst({
      where: {
        id: figureId,
        flashcardId,
        role: FlashcardFigureRole.SOLUTION,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!figure) {
      throw notFoundException("FLASHCARD_FIGURE_NOT_FOUND", "Không tìm thấy hình lời giải.");
    }
    await this.prisma.flashcardFigure.update({
      where: { id: figure.id },
      data: { deletedAt: new Date(), pendingRevisionId: null },
    });
    return { deleted: true as const, figureId: figure.id };
  }

  async createWithAi(
    flashcardId: string,
    actorUserId: string,
    dto: CreateFlashcardFigureAiDto,
  ) {
    const prepared = await this.requests.prepare(flashcardId, dto);
    return this.createPrepared({
      flashcardId,
      actorUserId,
      aiGenerationId: prepared.aiGenerationId ?? undefined,
      dto,
      context: prepared.context,
      routeSnapshot: prepared.routeSnapshot,
    });
  }

  createFromContentDecision(input: {
    flashcardId: string;
    actorUserId: string;
    aiGenerationId: string;
    context: FlashcardFigureContext;
    routeSnapshot: AiFeatureRoute;
  }) {
    return this.createPrepared({
      ...input,
      dto: {
        mode: "REGENERATE",
        adminInstructions: null,
        model: input.routeSnapshot.model,
        temperature: input.routeSnapshot.temperature ?? undefined,
        reasoningEffort:
          input.routeSnapshot.reasoningEffort === "none" ||
          input.routeSnapshot.reasoningEffort === "low" ||
          input.routeSnapshot.reasoningEffort === "medium" ||
          input.routeSnapshot.reasoningEffort === "high" ||
          input.routeSnapshot.reasoningEffort === "xhigh"
            ? input.routeSnapshot.reasoningEffort
            : undefined,
      },
    });
  }

  private async createPrepared(input: {
    flashcardId: string;
    actorUserId: string;
    aiGenerationId?: string;
    dto: CreateFlashcardFigureAiDto;
    context: FlashcardFigureContext;
    routeSnapshot: AiFeatureRoute;
  }) {
    const { actorUserId, context, dto, flashcardId, routeSnapshot } = input;
    const current = await this.prisma.flashcardFigure.findUnique({
      where: {
        flashcardId_role: {
          flashcardId,
          role: FlashcardFigureRole.SOLUTION,
        },
      },
      select: { id: true },
    });
    const figure = current
      ? await this.prisma.flashcardFigure.update({
          where: { id: current.id },
          data: {
            deletedAt: null,
            subjectKey: context.subject.key,
            subjectName: context.subject.name,
            subjectSlug: context.subject.slug,
            ...(input.aiGenerationId ? { aiGenerationId: input.aiGenerationId } : {}),
          },
          select: { id: true },
        })
      : await this.prisma.flashcardFigure.create({
          data: {
            lessonId: (
              await this.prisma.flashcard.findUniqueOrThrow({
                where: { id: flashcardId },
                select: { lessonId: true },
              })
            ).lessonId,
            flashcardId,
            role: FlashcardFigureRole.SOLUTION,
            aiGenerationId: input.aiGenerationId ?? null,
            subjectKey: context.subject.key,
            subjectName: context.subject.name,
            subjectSlug: context.subject.slug,
            createdById: actorUserId,
          },
          select: { id: true },
        });
    const latest = await this.prisma.flashcardFigureRevision.findFirst({
      where: { flashcardFigureId: figure.id },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    const revision = await this.prisma.flashcardFigureRevision.create({
      data: {
        flashcardFigureId: figure.id,
        sourceKind: "AI_TEX",
        origin: current
          ? FlashcardFigureRevisionOrigin.ADMIN_REGENERATE
          : FlashcardFigureRevisionOrigin.INITIAL_AI,
        status: "QUEUED",
        sourceVersion: (latest?.sourceVersion ?? 0) + 1,
        altText: `Hình minh họa lời giải Flashcard: ${context.front}`,
        createdById: actorUserId,
      },
      select: { id: true },
    });
    const job = await this.jobs.enqueue({
      figureId: figure.id,
      revisionId: revision.id,
      actorUserId,
      dto,
      routeSnapshot,
      contextSnapshot: context,
    });
    return {
      jobId: job.id,
      figureId: figure.id,
      revisionId: revision.id,
      role: "SOLUTION",
      mode: dto.mode ?? "REGENERATE",
      status: job.status,
    };
  }
}
