import { Inject, Injectable, Logger } from "@nestjs/common";
import { AiGenerationType, ContentSource, Prisma, ReviewStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import {
  alignVideoSummaryOutputToChapters,
  hasValidVideoSummaryCueStartTimes,
  hasMatchingVideoSummaryChapters,
  collectVideoSummaryOutputWarnings,
  toVideoSummaryBlocksDocument,
  videoSummarySectionsToChapters,
  videoSummaryOutputSchema,
} from "#api/modules/learning-paths/utils/video-summary-output";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { buildVideoSummaryProviderContract } from "#api/modules/learning-paths/utils/video-summary-provider-contract";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";
import {
  buildVideoSummarySource,
  serializeVideoSummarySourceText,
} from "#api/modules/learning-paths/utils/video-summary-source";
import { buildVideoSummaryStructuredRequestPolicy } from "#api/modules/learning-paths/utils/video-summary-prompt";
import { z } from "zod";
import { VideoSummaryIndexService } from "#api/modules/learning-paths/services/video-summary-index.service";
import { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";

const inputSchema = z.object({
  requestDraftId: z.string().uuid(),
  requestHash: z.string().length(64),
  sourceHash: z.string().length(64),
  schemaName: z.string().min(1),
  schemaVersion: z.string().min(1),
  schemaHash: z.string().length(64),
  promptVersion: z.string().min(1),
});
@Injectable()
export class VideoSummaryGenerationService {
  private readonly logger = new Logger(VideoSummaryGenerationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService) private readonly provider: AiProviderCallService,
    @Inject(VideoSummaryIndexService)
    private readonly videoSummaryIndex: VideoSummaryIndexService,
    @Inject(EmbeddingJobEnqueuer)
    private readonly embeddingEnqueuer: EmbeddingJobEnqueuer,
  ) {}
  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput> {
    if (context.type !== AiGenerationType.VIDEO_SUMMARY || !context.lessonId)
      throw new UnrecoverableError("Invalid video summary context.");
    const input = inputSchema.safeParse(omitRoute(context.inputMeta));
    if (!input.success)
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Dữ liệu job tóm tắt video không hợp lệ.",
      );
    const [draft, lesson, aiGeneration] = await Promise.all([
      this.prisma.lessonVideoSummaryRequestDraft.findFirst({
        where: {
          id: input.data.requestDraftId,
          lessonId: context.lessonId,
          requestHash: input.data.requestHash,
        },
      }),
      this.prisma.lesson.findFirst({
        where: { id: context.lessonId, deletedAt: null },
        select: { videoUrl: true, customVideoSettings: true },
      }),
      this.prisma.aiGeneration.findFirst({
        where: {
          id: context.aiGenerationId,
          backgroundJobId: context.backgroundJobId,
          type: AiGenerationType.VIDEO_SUMMARY,
        },
        select: { promptVersion: true, schemaVersion: true },
      }),
    ]);
    const source = lesson && buildVideoSummarySource(lesson);
    if (!draft || !source || source.hashes.source !== input.data.sourceHash)
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Video hoặc transcript đã thay đổi sau khi tạo job.",
      );
    const contract = buildVideoSummaryProviderContract(source.chapters);
    const draftPromptVersion = readPromptVersion(draft.modelConfigJson);
    if (
      !aiGeneration ||
      aiGeneration.promptVersion !== contract.promptVersion ||
      aiGeneration.schemaVersion !== contract.schemaVersion ||
      input.data.schemaName !== contract.schemaName ||
      input.data.schemaVersion !== contract.schemaVersion ||
      input.data.schemaHash !== contract.schemaHash ||
      input.data.promptVersion !== contract.promptVersion ||
      draft.schemaName !== contract.schemaName ||
      draft.schemaVersion !== contract.schemaVersion ||
      draft.schemaHash !== contract.schemaHash ||
      hashAiValue(draft.schemaJson) !== contract.schemaHash ||
      draftPromptVersion !== contract.promptVersion
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Contract AI của bản xem trước hoặc job tóm tắt video đã thay đổi.",
      );
    }
    const output = await this.provider.generateStructured(
      {
        feature: AiGenerationType.VIDEO_SUMMARY,
        aiGenerationId: context.aiGenerationId,
        backgroundJobId: context.backgroundJobId,
        attempt: context.attempt,
        callSequence: 1,
        operation: "VIDEO_SUMMARY_GENERATION",
        targetContext: buildWholeFeatureUsageTarget(
          AiGenerationType.VIDEO_SUMMARY,
          context.aiGenerationId,
        ),
        routeSnapshot: context.providerRouteSnapshot,
        allowProviderFallback: false,
      },
      {
        ...buildVideoSummaryStructuredRequestPolicy(),
        outputName: contract.schemaName,
        promptVersion: contract.promptVersion,
        schemaVersion: contract.schemaVersion,
        systemPrompt: draft.systemInstructions,
        userPrompt: draft.userPrompt,
        inputTextItems: [
          {
            id: "source_packet_manifest",
            text: serializeVideoSummarySourceText(source),
          },
        ],
        maxTokens: context.providerRouteSnapshot?.maxOutputTokens ?? undefined,
      },
      contract.outputSchema,
    );
    const providerParsedOutput = contract.outputSchema.safeParse(output.data);
    if (!providerParsedOutput.success) {
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_OUTPUT_INVALID: Kết quả AI không đúng cấu trúc chapter.",
      );
    }
    const alignedOutput = alignVideoSummaryOutputToChapters(
      providerParsedOutput.data,
      source.chapters,
    );
    const structurallyParsedOutput = videoSummaryOutputSchema.safeParse(alignedOutput);
    if (!structurallyParsedOutput.success) {
      this.logger.error(
        `Video Summary ${context.aiGenerationId} failed semantic validation: ${JSON.stringify(structurallyParsedOutput.error.issues)}`,
      );
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_OUTPUT_INVALID: Kết quả AI không đúng cấu trúc.",
      );
    }
    const parsedOutput = structurallyParsedOutput.data;
    if (!hasMatchingVideoSummaryChapters(parsedOutput, source.chapters)) {
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_CHAPTERS_INVALID: Section không khớp các mốc thời gian video.",
      );
    }
    if (
      !hasValidVideoSummaryCueStartTimes(
        parsedOutput,
        source.transcript.map((cue) => cue.time),
        source.chapters,
      )
    ) {
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_TIMELINE_INVALID: Timestamp của khối không khớp cue transcript.",
      );
    }
    const warnings = collectVideoSummaryOutputWarnings(parsedOutput);
    if (warnings.length > 0) {
      this.logger.warn(
        `Video Summary ${context.aiGenerationId} completed with ${warnings.length} review warning(s): ${warnings.map((warning) => warning.path).join(", ")}`,
      );
    }
    return {
      action: "VIDEO_SUMMARY",
      output: { ...output, data: parsedOutput },
      contextMetadata: { hashes: source.hashes, warnings },
    };
  }
  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId)
      throw new UnrecoverableError("Video summary persistence requires lessonId.");
    const lessonId = context.lessonId;
    const parsed = videoSummaryOutputSchema.safeParse(prepared.output.data);
    if (!parsed.success)
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_OUTPUT_INVALID: Kết quả AI không đúng cấu trúc.",
      );
    const hashes = readHashes(prepared.contextMetadata);
    const warnings = readWarnings(prepared.contextMetadata);
    const contentJson = toVideoSummaryBlocksDocument(parsed.data, warnings);
    const persistence = await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, deletedAt: null },
        select: { videoUrl: true, customVideoSettings: true },
      });
      const currentSource = lesson && buildVideoSummarySource(lesson);
      if (!currentSource || currentSource.hashes.source !== hashes.source) {
        throw new UnrecoverableError(
          "AI_SOURCE_CONTEXT_STALE: Video, transcript hoặc mốc thời gian đã thay đổi trước khi lưu.",
        );
      }

      let finalSource = currentSource;
      let generatedChapters = false;
      if (currentSource.chapters.length === 0) {
        const chapters = videoSummarySectionsToChapters(parsed.data);
        const customVideoSettings = appendVideoSummaryChapters(
          lesson.customVideoSettings,
          chapters,
        );
        await tx.lesson.update({
          where: { id: lessonId },
          data: {
            customVideoSettings,
            updatedById: context.ownerUserId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: context.ownerUserId,
            action: "LESSON_VIDEO_CHAPTERS_GENERATED_FROM_SUMMARY",
            entityType: "Lesson",
            entityId: lessonId,
            before: lesson.customVideoSettings ?? undefined,
            after: customVideoSettings,
          },
        });
        const rebuiltSource = buildVideoSummarySource({
          videoUrl: lesson.videoUrl,
          customVideoSettings,
        });
        if (!rebuiltSource) {
          throw new UnrecoverableError("VIDEO_SUMMARY_SOURCE_REBUILD_FAILED");
        }
        finalSource = rebuiltSource;
        generatedChapters = true;
      }

      const summary = await tx.lessonVideoSummary.upsert({
        where: { lessonId },
        create: {
          lessonId,
          contentJson: contentJson as Prisma.InputJsonValue,
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: context.aiGenerationId,
          sourceVideoUrlHash: finalSource.hashes.videoUrl,
          sourceTranscriptHash: finalSource.hashes.transcript,
          sourceChaptersHash: finalSource.hashes.chapters,
          sourcePlayerSettingsHash: finalSource.hashes.playerSettings,
          createdById: context.ownerUserId,
          updatedById: context.ownerUserId,
        },
        update: {
          contentJson: contentJson as Prisma.InputJsonValue,
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: context.aiGenerationId,
          sourceVideoUrlHash: finalSource.hashes.videoUrl,
          sourceTranscriptHash: finalSource.hashes.transcript,
          sourceChaptersHash: finalSource.hashes.chapters,
          sourcePlayerSettingsHash: finalSource.hashes.playerSettings,
          staleAt: null,
          updatedById: context.ownerUserId,
          deletedAt: null,
        },
      });
      const index = await this.videoSummaryIndex.syncInTransaction(tx, {
        videoSummaryId: summary.id,
        lessonId,
        contentJson: summary.contentJson,
      });
      return { summary, generatedChapters, index };
    });
    const { summary, generatedChapters, index } = persistence;
    if (index.chunkCount > 0) {
      await this.embeddingEnqueuer.enqueueVideoSummaryEmbeddingJob({
        lessonId,
        videoSummaryId: index.videoSummaryId,
        summaryHash: index.summaryHash,
        ownerUserId: context.ownerUserId ?? undefined,
      });
    }
    return {
      resourceType: "LESSON_VIDEO_SUMMARY",
      resourceId: summary.id,
      message: "Đã tạo tóm tắt video bằng AI.",
      result: {
        lessonId: summary.lessonId,
        reviewStatus: summary.reviewStatus,
        warnings,
        generatedChapters,
      },
    };
  }
}
function omitRoute(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { routeSnapshot: _routeSnapshot, ...rest } = value as Record<string, unknown>;
  return rest;
}
function readPromptVersion(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const promptVersion = (value as Record<string, unknown>).promptVersion;
  return typeof promptVersion === "string" ? promptVersion : null;
}
function readHashes(value: unknown) {
  const hashes =
    value && typeof value === "object" && "hashes" in value
      ? (value as { hashes?: Record<string, string> }).hashes
      : undefined;
  if (
    !hashes?.videoUrl ||
    !hashes.transcript ||
    !hashes.chapters ||
    !hashes.playerSettings ||
    !hashes.source
  )
    throw new UnrecoverableError("VIDEO_SUMMARY_SOURCE_HASHES_MISSING");
  return hashes;
}

function appendVideoSummaryChapters(
  value: Prisma.JsonValue,
  chapters: ReturnType<typeof videoSummarySectionsToChapters>,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnrecoverableError("VIDEO_SUMMARY_PLAYER_SETTINGS_INVALID");
  }
  return { ...value, chapters } as Prisma.InputJsonValue;
}

function readWarnings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const warnings = (value as { warnings?: unknown }).warnings;
  return Array.isArray(warnings)
    ? warnings.filter(
        (
          warning,
        ): warning is ReturnType<typeof collectVideoSummaryOutputWarnings>[number] =>
          Boolean(
            warning &&
            typeof warning === "object" &&
            !Array.isArray(warning) &&
            ((warning as { code?: unknown }).code === "UNRESOLVED_VISUAL_REFERENCE" ||
              (warning as { code?: unknown }).code === "MALFORMED_LATEX") &&
            typeof (warning as { path?: unknown }).path === "string" &&
            typeof (warning as { message?: unknown }).message === "string" &&
            (warning as { severity?: unknown }).severity === "WARNING",
          ),
      )
    : [];
}
