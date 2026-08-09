import { Inject, Injectable, Optional } from "@nestjs/common";
import { AiGenerationType, ContentSource, Prisma, ReviewStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { AiService } from "#api/modules/ai/services/ai.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import {
  LessonSummaryContextError,
  LessonSummaryContextService,
} from "#api/modules/ai/services/lesson-summary-context.service";
import {
  LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
  lessonSummaryJobInputSchema,
  lessonSummaryOutputSchema,
  lessonSummaryProviderOutputSchema,
  type LessonSummaryOutput,
} from "#api/modules/ai/types/lesson-summary.types";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";

@Injectable()
export class LessonSummaryGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(LessonSummaryContextService)
    private readonly summaryContext: LessonSummaryContextService,
    @Optional()
    @Inject(AiProviderCallService)
    private readonly providerCall?: AiProviderCallService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput<LessonSummaryOutput>> {
    if (context.type !== AiGenerationType.SUMMARY || !context.lessonId) {
      throw new UnrecoverableError("Invalid lesson summary generation context.");
    }
    const input = lessonSummaryJobInputSchema.safeParse(
      omitProviderRouteSnapshot(context.inputMeta),
    );
    if (!input.success) {
      throw new UnrecoverableError(
        `Invalid lesson summary job input: ${input.error.issues[0]?.message ?? "unknown error"}`,
      );
    }

    let sourceContext;
    try {
      sourceContext = await this.summaryContext.load(
        context.lessonId,
        input.data.documentIds,
      );
    } catch (error) {
      if (error instanceof LessonSummaryContextError) {
        throw new UnrecoverableError(`${error.code}: ${error.message}`);
      }
      throw error;
    }
    if (sourceContext.sourceHash !== input.data.sourceHash) {
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Tài liệu buổi học đã thay đổi sau khi job được tạo.",
      );
    }

    const structuredInput = buildLessonSummaryStructuredInput({
      lessonId: context.lessonId,
      lessonTitle: sourceContext.lessonTitle,
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
      chunks: sourceContext.chunks,
      configuration: input.data,
      systemInstructions: input.data.systemInstructions,
      userPrompt: input.data.userPrompt,
    });
    const providerOutput = this.providerCall
      ? await this.providerCall.generateStructured(
          {
            feature: AiGenerationType.SUMMARY,
            aiGenerationId: context.aiGenerationId,
            backgroundJobId: context.backgroundJobId,
            attempt: context.attempt,
            callSequence: 1,
            routeSnapshot: normalizeSummaryRouteSnapshot(context.providerRouteSnapshot),
          },
          structuredInput,
          lessonSummaryProviderOutputSchema,
        )
      : await this.aiService.generateStructured(
          structuredInput,
          lessonSummaryProviderOutputSchema,
        );

    const data = mapLessonSummaryProviderOutput({
      lessonId: context.lessonId,
      output: providerOutput.data,
      contextChunks: sourceContext.chunks,
    });
    return { action: "SUMMARY", output: { ...providerOutput, data } };
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId) {
      throw new UnrecoverableError("Lesson summary persistence requires lessonId.");
    }
    const output = parseAiStructuredOutput(
      lessonSummaryOutputSchema,
      prepared.output.data,
    );
    const contentJson = {
      type: "lesson_summary_blocks",
      version: 1,
      data: output,
    } as Prisma.InputJsonValue;

    const summary = await this.prisma.$transaction(async (transaction) => {
      const lesson = await transaction.lesson.findFirst({
        where: { id: context.lessonId!, deletedAt: null },
        select: { id: true },
      });
      if (!lesson) {
        throw new UnrecoverableError("LESSON_NOT_FOUND: Không tìm thấy buổi học.");
      }
      const before = await transaction.lessonSummary.findUnique({
        where: { lessonId: context.lessonId! },
        select: { id: true, aiGenerationId: true },
      });
      const persisted = await transaction.lessonSummary.upsert({
        where: { lessonId: context.lessonId! },
        create: {
          lessonId: context.lessonId!,
          contentJson,
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: context.aiGenerationId,
          ...(context.ownerUserId
            ? {
                createdById: context.ownerUserId,
                updatedById: context.ownerUserId,
              }
            : {}),
        },
        update: {
          contentJson,
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: context.aiGenerationId,
          ...(context.ownerUserId ? { updatedById: context.ownerUserId } : {}),
          deletedAt: null,
        },
        select: {
          id: true,
          lessonId: true,
          source: true,
          reviewStatus: true,
          aiGenerationId: true,
          updatedAt: true,
        },
      });

      if (before?.aiGenerationId !== context.aiGenerationId) {
        await transaction.auditLog.create({
          data: {
            actorUserId: context.ownerUserId,
            action: "LESSON_SUMMARY_AI_GENERATED",
            entityType: "LessonSummary",
            entityId: persisted.id,
            after: toJobJson(persisted),
            metadata: toJobJson({
              backgroundJobId: context.backgroundJobId,
              aiGenerationId: context.aiGenerationId,
            }),
          },
        });
      }

      return persisted;
    });

    return {
      resourceType: "LESSON_SUMMARY",
      resourceId: summary.id,
      message: "Đã tạo tóm tắt buổi học bằng AI.",
      result: {
        lessonId: summary.lessonId,
        reviewStatus: summary.reviewStatus,
      },
    };
  }
}

function omitProviderRouteSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "providerRouteSnapshot",
    ),
  );
}

function normalizeSummaryRouteSnapshot(
  route: AiGenerationExecutionContext["providerRouteSnapshot"],
) {
  if (!route) return undefined;
  return {
    ...route,
    maxOutputTokens: Math.max(
      route.maxOutputTokens ?? 0,
      LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
    ),
  };
}
