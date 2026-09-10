import { Inject, Injectable } from "@nestjs/common";
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
  hasValidVideoSummaryCueStartTimes,
  toVideoSummaryBlocksDocument,
  videoSummaryOutputSchema,
} from "#api/modules/learning-paths/utils/video-summary-output";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";
import {
  buildVideoSummarySource,
  serializeVideoSummarySourceText,
} from "#api/modules/learning-paths/utils/video-summary-source";
import { VIDEO_SUMMARY_PROMPT_VERSION } from "#api/modules/learning-paths/utils/video-summary-prompt";
import { z } from "zod";

const inputSchema = z.object({
  requestDraftId: z.string().uuid(),
  requestHash: z.string().length(64),
  sourceHash: z.string().length(64),
});
@Injectable()
export class VideoSummaryGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService) private readonly provider: AiProviderCallService,
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
    const draft = await this.prisma.lessonVideoSummaryRequestDraft.findFirst({
      where: {
        id: input.data.requestDraftId,
        lessonId: context.lessonId,
        requestHash: input.data.requestHash,
      },
    });
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: context.lessonId, deletedAt: null },
      select: { videoUrl: true, customVideoSettings: true },
    });
    const source = lesson && buildVideoSummarySource(lesson);
    if (!draft || !source || source.hashes.source !== input.data.sourceHash)
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Video hoặc transcript đã thay đổi sau khi tạo job.",
      );
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
        outputName: draft.schemaName,
        promptVersion: VIDEO_SUMMARY_PROMPT_VERSION,
        schemaVersion: draft.schemaVersion,
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
      videoSummaryOutputSchema,
    );
    const parsedOutput = videoSummaryOutputSchema.safeParse(output.data);
    if (
      !parsedOutput.success ||
      !hasValidVideoSummaryCueStartTimes(
        parsedOutput.data,
        source.transcript.map((cue) => cue.time),
      )
    ) {
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_TIMELINE_INVALID: Timestamp của khối không khớp cue transcript.",
      );
    }
    return {
      action: "VIDEO_SUMMARY",
      output,
      contextMetadata: { hashes: source.hashes },
    };
  }
  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId)
      throw new UnrecoverableError("Video summary persistence requires lessonId.");
    const parsed = videoSummaryOutputSchema.safeParse(prepared.output.data);
    if (!parsed.success)
      throw new UnrecoverableError(
        "VIDEO_SUMMARY_OUTPUT_INVALID: Kết quả AI không đúng cấu trúc.",
      );
    const hashes = readHashes(prepared.contextMetadata);
    const contentJson = toVideoSummaryBlocksDocument(parsed.data);
    const summary = await this.prisma.lessonVideoSummary.upsert({
      where: { lessonId: context.lessonId },
      create: {
        lessonId: context.lessonId,
        contentJson: contentJson as Prisma.InputJsonValue,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
        aiGenerationId: context.aiGenerationId,
        sourceVideoUrlHash: hashes.videoUrl,
        sourceTranscriptHash: hashes.transcript,
        sourceChaptersHash: hashes.chapters,
        sourcePlayerSettingsHash: hashes.playerSettings,
        createdById: context.ownerUserId,
        updatedById: context.ownerUserId,
      },
      update: {
        contentJson: contentJson as Prisma.InputJsonValue,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
        aiGenerationId: context.aiGenerationId,
        sourceVideoUrlHash: hashes.videoUrl,
        sourceTranscriptHash: hashes.transcript,
        sourceChaptersHash: hashes.chapters,
        sourcePlayerSettingsHash: hashes.playerSettings,
        staleAt: null,
        updatedById: context.ownerUserId,
        deletedAt: null,
      },
    });
    return {
      resourceType: "LESSON_VIDEO_SUMMARY",
      resourceId: summary.id,
      message: "Đã tạo tóm tắt video bằng AI.",
      result: { lessonId: summary.lessonId, reviewStatus: summary.reviewStatus },
    };
  }
}
function omitRoute(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { routeSnapshot: _routeSnapshot, ...rest } = value as Record<string, unknown>;
  return rest;
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
    !hashes.playerSettings
  )
    throw new UnrecoverableError("VIDEO_SUMMARY_SOURCE_HASHES_MISSING");
  return hashes;
}
