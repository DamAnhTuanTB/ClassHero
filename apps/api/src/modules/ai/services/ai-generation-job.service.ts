import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  AiGenerationStatus,
  BackgroundJobQueue,
  BackgroundJobStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import type { CreateAiGenerationJobInput } from "#api/modules/ai/types/ai-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";

@Injectable()
export class AiGenerationJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly backgroundJobQueue: BackgroundJobQueueService,
    @Optional()
    @Inject(AiModelRoutingService)
    private readonly modelRouting?: AiModelRoutingService,
  ) {}

  async createAndEnqueue(input: CreateAiGenerationJobInput) {
    const routeSnapshot =
      input.routeSnapshot ??
      (this.modelRouting ? await this.modelRouting.resolve(input.type) : undefined);
    const persistedInputMeta = mergeRouteSnapshot(input.inputMeta, routeSnapshot);
    const pair = await this.prisma.$transaction(async (transaction) => {
      if (input.deduplicateActive && input.lessonId) {
        await transaction.$queryRaw`
          SELECT id
          FROM lessons
          WHERE id = ${input.lessonId}::uuid
          FOR UPDATE
        `;
        const active = await transaction.backgroundJob.findFirst({
          where: {
            queue: BackgroundJobQueue.AI_GENERATION,
            lessonId: input.lessonId,
            status: {
              in: [BackgroundJobStatus.QUEUED, BackgroundJobStatus.RUNNING],
            },
            aiGenerations: {
              some: { type: input.type },
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            aiGenerations: {
              where: { type: input.type },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { id: true },
            },
          },
        });
        const activeGeneration = active?.aiGenerations[0];
        if (active && activeGeneration) {
          return {
            backgroundJobId: active.id,
            aiGenerationId: activeGeneration.id,
            status: active.status,
            created: false,
          };
        }
      }

      if (input.idempotencyKey) {
        const existing = await transaction.backgroundJob.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: {
            id: true,
            status: true,
            aiGenerations: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { id: true },
            },
          },
        });
        const existingGeneration = existing?.aiGenerations[0];

        if (existing && existingGeneration) {
          return {
            backgroundJobId: existing.id,
            aiGenerationId: existingGeneration.id,
            status: existing.status,
            created: false,
          };
        }
      }

      const backgroundJob = await transaction.backgroundJob.create({
        data: {
          queue: BackgroundJobQueue.AI_GENERATION,
          status: BackgroundJobStatus.QUEUED,
          maxAttempts: Math.max(1, input.maxAttempts ?? 3),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          ...(input.createdByUserId ? { ownerUserId: input.createdByUserId } : {}),
          ...(input.lessonId ? { lessonId: input.lessonId } : {}),
          ...(input.targetType ? { resourceType: input.targetType } : {}),
          ...(input.targetId ? { resourceId: input.targetId } : {}),
          ...(persistedInputMeta === undefined
            ? {}
            : { inputMeta: toJobJson(persistedInputMeta) }),
        },
        select: { id: true },
      });
      const aiGeneration = await transaction.aiGeneration.create({
        data: {
          type: input.type,
          status: AiGenerationStatus.QUEUED,
          backgroundJobId: backgroundJob.id,
          promptVersion: input.promptVersion,
          schemaVersion: input.schemaVersion,
          inputHash: hashAiValue(input.inputFingerprint),
          ...(input.createdByUserId ? { createdByUserId: input.createdByUserId } : {}),
          ...(input.lessonId ? { lessonId: input.lessonId } : {}),
          ...(input.targetType ? { targetType: input.targetType } : {}),
          ...(input.targetId ? { targetId: input.targetId } : {}),
          ...(persistedInputMeta === undefined
            ? {}
            : { inputMetaJson: toJobJson(persistedInputMeta) }),
        },
        select: { id: true },
      });

      return {
        backgroundJobId: backgroundJob.id,
        aiGenerationId: aiGeneration.id,
        status: BackgroundJobStatus.QUEUED,
        created: true,
      };
    });

    if (!pair.created) {
      return pair;
    }

    try {
      await this.backgroundJobQueue.enqueue(pair.backgroundJobId);
      return pair;
    } catch (error) {
      await this.prisma.aiGeneration.update({
        where: { id: pair.aiGenerationId },
        data: {
          status: AiGenerationStatus.FAILED,
          errorMessage: "Không thể đưa AI job vào hàng đợi xử lý.",
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }
}

function mergeRouteSnapshot(inputMeta: unknown, routeSnapshot: unknown) {
  if (routeSnapshot === undefined) return inputMeta;
  if (inputMeta && typeof inputMeta === "object" && !Array.isArray(inputMeta)) {
    return {
      ...(inputMeta as Record<string, unknown>),
      providerRouteSnapshot: routeSnapshot,
    };
  }
  return { input: inputMeta, providerRouteSnapshot: routeSnapshot };
}
