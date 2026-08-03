import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AiGenerationType, Prisma } from "@prisma/client";

import { throwBadRequest, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import {
  LessonSummaryContextError,
  LessonSummaryContextService,
} from "#api/modules/ai/services/lesson-summary-context.service";
import {
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
} from "#api/modules/ai/types/lesson-summary.types";
import { GenerateLessonSummaryDto } from "#api/modules/learning-paths/dto/generate-lesson-summary.dto";
import { UpsertLessonSummaryDto } from "#api/modules/learning-paths/dto/upsert-lesson-summary.dto";
import { lessonSummarySelect } from "#api/modules/learning-paths/selectors/lesson-summary.selects";
import { serializeLessonSummary } from "#api/modules/learning-paths/serializers/lesson-summary.serializers";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  throwLessonNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/lesson.helpers";

@Injectable()
export class LessonSummariesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiGenerationJobService)
    private readonly aiGenerationJobs: AiGenerationJobService,
    @Inject(LessonSummaryContextService)
    private readonly summaryContext: LessonSummaryContextService,
  ) {}

  async getForAdmin(lessonId: string) {
    await this.assertLessonExists(lessonId);
    const summary = await this.prisma.lessonSummary.findUnique({
      where: { lessonId },
      select: lessonSummarySelect,
    });

    return summary && !summary.deletedAt ? serializeLessonSummary(summary) : null;
  }

  async upsertForAdmin(
    lessonId: string,
    actorUserId: string,
    dto: UpsertLessonSummaryDto,
    context: RequestContext = {},
  ) {
    const summary = await this.prisma.$transaction(async (transaction) => {
      const lesson = await transaction.lesson.findFirst({
        where: {
          id: lessonId,
          deletedAt: null,
          learningPath: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!lesson) {
        throwLessonNotFound();
      }

      const before = await transaction.lessonSummary.findUnique({
        where: { lessonId },
        select: lessonSummarySelect,
      });
      const contentJson = dto.contentJson as Prisma.InputJsonValue;
      const updated = await transaction.lessonSummary.upsert({
        where: { lessonId },
        create: {
          lessonId,
          contentJson,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        update: {
          contentJson,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          updatedById: actorUserId,
          deletedAt: null,
        },
        select: lessonSummarySelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_SUMMARY_UPSERTED",
          entityType: "LessonSummary",
          entityId: updated.id,
          before: before ? toInputJson(serializeLessonSummary(before)) : undefined,
          after: toInputJson(serializeLessonSummary(updated)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return updated;
    });

    return serializeLessonSummary(summary);
  }

  async generate(lessonId: string, actorUserId: string, dto: GenerateLessonSummaryDto) {
    let sourceContext;
    try {
      sourceContext = await this.summaryContext.load(lessonId, dto.documentIds);
    } catch (error) {
      this.rethrowContextError(error);
    }

    const requestId = randomUUID();
    const inputMeta = {
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
      style: dto.style,
    } as const;
    const job = await this.aiGenerationJobs.createAndEnqueue({
      type: AiGenerationType.SUMMARY,
      createdByUserId: actorUserId,
      lessonId,
      targetType: "LESSON",
      targetId: lessonId,
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      inputFingerprint: { lessonId, ...inputMeta },
      inputMeta,
      idempotencyKey: ["ai-summary", lessonId, sourceContext.sourceHash, requestId].join(
        ":",
      ),
      deduplicateActive: true,
      maxAttempts: 3,
    });

    return {
      mode: "QUEUED" as const,
      jobId: job.backgroundJobId,
      status: job.status,
    };
  }

  private async assertLessonExists(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        learningPath: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!lesson) {
      throwLessonNotFound();
    }
  }

  private rethrowContextError(error: unknown): never {
    if (!(error instanceof LessonSummaryContextError)) {
      throw error;
    }
    if (error.code === "LESSON_NOT_FOUND") {
      throwNotFound("NOT_FOUND", error.message, error.details);
    }
    throwBadRequest(error.code, error.message, error.details);
  }
}
