import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  StemFigureRevisionStatus,
  StemFigureStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { toJobJson } from "#api/jobs/job-json";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

export type StemFigureJobTrigger =
  | "INITIAL"
  | "ADMIN_EDIT"
  | "ADMIN_REGENERATE"
  | "MANUAL_SOURCE_RETRY"
  | "MANUAL_COMPILER_RETRY"
  | "MANUAL_VALIDATOR_RETRY"
  | "INFRASTRUCTURE_RETRY";

@Injectable()
export class StemFigureJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly queue: BackgroundJobQueueService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async enqueue(
    figureId: string,
    ownerUserId?: string | null,
    options: {
      revisionId?: string;
      trigger?: StemFigureJobTrigger;
      diagnosticBatchHash?: string;
      generationBrief?: StemFigureGenerationBrief;
      routeSnapshot?: AiFeatureRoute;
      systemPrompt?: string | null;
      userPrompt?: string | null;
    } = {},
  ) {
    const figure = await this.prisma.stemFigure.findUniqueOrThrow({
      where: { id: figureId },
      select: {
        id: true,
        aiGenerationId: true,
        lessonId: true,
        subjectKey: true,
        subjectName: true,
        subjectSlug: true,
        pendingRevisionId: true,
        currentRevisionId: true,
        aiGeneration: {
          select: {
            inputMetaJson: true,
            backgroundJob: { select: { inputMeta: true } },
          },
        },
      },
    });
    const revisionId =
      options.revisionId ?? figure.pendingRevisionId ?? figure.currentRevisionId;
    if (!revisionId) {
      throw new Error(`STEM figure ${figureId} has no renderable revision.`);
    }
    const revision = await this.prisma.stemFigureRevision.findFirstOrThrow({
      where: { id: revisionId, stemFigureId: figureId },
      select: {
        id: true,
        sourceHash: true,
        sourceVersion: true,
        status: true,
      },
    });
    const trigger = options.trigger ?? "INITIAL";
    const routeSnapshot =
      options.routeSnapshot ?? readGenerationRouteSnapshot(figure.aiGeneration);
    const retryContext = trigger.endsWith("RETRY")
      ? await this.prisma.backgroundJob.findFirst({
          where: {
            queue: BackgroundJobQueue.DIAGRAM_RENDERING,
            resourceType: "STEM_FIGURE",
            resourceId: figure.id,
            status: BackgroundJobStatus.FAILED,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;
    const idempotencyKey = [
      "stem-figure-render-v2",
      figure.id,
      revision.id,
      revision.sourceVersion,
      revision.sourceHash ?? "pending-ai-source",
      trigger,
      retryContext?.id ?? "initial-attempt",
      options.diagnosticBatchHash ?? "none",
    ].join(":");
    const existing = await this.prisma.backgroundJob.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    });
    if (existing) return existing;

    const job = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.backgroundJob.create({
        data: {
          queue: BackgroundJobQueue.DIAGRAM_RENDERING,
          status: BackgroundJobStatus.QUEUED,
          idempotencyKey,
          ownerUserId: ownerUserId ?? null,
          lessonId: figure.lessonId,
          resourceType: "STEM_FIGURE",
          resourceId: figure.id,
          inputMeta: toJobJson({
            figureId: figure.id,
            revisionId: revision.id,
            sourceHash: revision.sourceHash,
            sourceVersion: revision.sourceVersion,
            subject: {
              key: figure.subjectKey,
              name: figure.subjectName,
              slug: figure.subjectSlug,
            },
            trigger,
            diagnosticBatchHash: options.diagnosticBatchHash ?? null,
            generationBrief: options.generationBrief ?? null,
            routeSnapshot: routeSnapshot ?? null,
            systemPrompt: options.systemPrompt ?? null,
            userPrompt: options.userPrompt ?? null,
          }),
          // Compiler repair is bounded inside the processor. BullMQ must not
          // automatically retry provider, network, validator, or infrastructure errors.
          maxAttempts: 1,
        },
        select: { id: true, status: true },
      });
      await transaction.stemFigureRevision.update({
        where: { id: revision.id },
        data: {
          status: StemFigureRevisionStatus.QUEUED,
          maxRepairAttempts: this.config.get("TEX_RENDER_MAX_AI_REPAIRS", {
            infer: true,
          }),
        },
      });
      await transaction.stemFigure.update({
        where: { id: figure.id },
        data: {
          pendingRevisionId: revision.id,
          status: StemFigureStatus.QUEUED,
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

  static sourceHash(source: string) {
    return createHash("sha256").update(source.trim()).digest("hex");
  }
}

function readGenerationRouteSnapshot(
  generation: {
    inputMetaJson: unknown;
    backgroundJob: { inputMeta: unknown } | null;
  } | null,
): AiFeatureRoute | undefined {
  for (const value of [generation?.inputMetaJson, generation?.backgroundJob?.inputMeta]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    for (const snapshot of [record.imageRouteSnapshot, record.providerRouteSnapshot]) {
      if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
        return snapshot as AiFeatureRoute;
      }
    }
  }
  return undefined;
}
