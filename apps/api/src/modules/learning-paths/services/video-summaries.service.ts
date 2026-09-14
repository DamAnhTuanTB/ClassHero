import { Inject, Injectable } from "@nestjs/common";
import {
  AiGenerationType,
  AiModelPurpose,
  ContentSource,
  Prisma,
  ReviewStatus,
} from "@prisma/client";
import { throwBadRequest, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { GenerateVideoSummaryDto } from "#api/modules/learning-paths/dto/generate-video-summary.dto";
import { UpsertVideoSummaryDto } from "#api/modules/learning-paths/dto/upsert-video-summary.dto";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  buildVideoSummarySource,
  serializeVideoSummarySourceText,
  type VideoSummarySource,
} from "#api/modules/learning-paths/utils/video-summary-source";
import {
  buildVideoSummaryPrompts,
  buildVideoSummaryStructuredRequestPolicy,
  resolveVideoSummarySubject,
  type VideoSummarySubject,
} from "#api/modules/learning-paths/utils/video-summary-prompt";
import {
  hasVideoSummaryBlock,
  normalizeVideoSummaryDocument,
  VIDEO_SUMMARY_DOCUMENT_VERSION,
} from "#api/modules/learning-paths/utils/video-summary-output";
import {
  buildVideoSummaryProviderContract,
  VIDEO_SUMMARY_SCHEMA_NAME,
  VIDEO_SUMMARY_SCHEMA_VERSION,
} from "#api/modules/learning-paths/utils/video-summary-provider-contract";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { VideoSummaryIndexService } from "#api/modules/learning-paths/services/video-summary-index.service";
import { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";

@Injectable()
export class VideoSummariesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiGenerationJobService) private readonly jobs: AiGenerationJobService,
    @Inject(AiModelRoutingService) private readonly routing: AiModelRoutingService,
    @Inject(AiProviderCallService) private readonly provider: AiProviderCallService,
    @Inject(VideoSummaryIndexService)
    private readonly videoSummaryIndex: VideoSummaryIndexService,
    @Inject(EmbeddingJobEnqueuer)
    private readonly embeddingEnqueuer: EmbeddingJobEnqueuer,
  ) {}

  async getForAdmin(lessonId: string) {
    const lessonContext = await this.lessonContext(lessonId);
    const summary = await this.prisma.lessonVideoSummary.findFirst({
      where: { lessonId, deletedAt: null },
    });
    if (!summary) return null;
    const currentSource = buildVideoSummarySource(lessonContext.lesson);
    const isStale =
      summary.source === ContentSource.AI &&
      (!currentSource ||
        summary.sourceVideoUrlHash !== currentSource.hashes.videoUrl ||
        summary.sourceTranscriptHash !== currentSource.hashes.transcript ||
        summary.sourceChaptersHash !== currentSource.hashes.chapters ||
        summary.sourcePlayerSettingsHash !== currentSource.hashes.playerSettings);
    const persisted =
      isStale && !summary.staleAt
        ? await this.prisma.lessonVideoSummary.update({
            where: { id: summary.id },
            data: { staleAt: new Date() },
          })
        : summary;
    return serialize(persisted);
  }

  async previewPrompt(
    lessonId: string,
    actorUserId: string,
    dto: GenerateVideoSummaryDto,
  ) {
    const source = await this.lessonSource(lessonId);
    const route = await this.resolveRoute(dto);
    const config = normalize(dto);
    const input = buildInput(source, config);
    const contract = buildVideoSummaryProviderContract(source.source.chapters);
    const preview = await this.provider.previewStructuredRequest(
      { feature: AiGenerationType.VIDEO_SUMMARY, routeSnapshot: route },
      input,
      contract.outputSchema,
    );
    const snapshot = {
      lessonTitle: source.lesson.title,
      subject: source.subject,
      targetGrade: source.targetGrade,
      source: source.source,
      hashes: source.source.hashes,
      configuration: config,
    };
    const requestHash = hashAiValue({
      snapshot,
      input,
      route: routeFingerprint(route),
      schemaHash: contract.schemaHash,
    });
    await this.prisma.lessonVideoSummaryRequestDraft.deleteMany({
      where: { lessonId, createdById: actorUserId, consumedAt: null },
    });
    const draft = await this.prisma.lessonVideoSummaryRequestDraft.create({
      data: {
        lessonId,
        createdById: actorUserId,
        requestHash,
        sourceSnapshotJson: snapshot as Prisma.InputJsonValue,
        systemInstructions: input.systemPrompt,
        userPrompt: input.userPrompt,
        schemaName: contract.schemaName,
        schemaVersion: contract.schemaVersion,
        schemaHash: contract.schemaHash,
        schemaJson: contract.schemaJson as Prisma.InputJsonValue,
        modelConfigJson: {
          routeSnapshot: route,
          promptVersion: contract.promptVersion,
        } as Prisma.InputJsonValue,
        costEstimateJson: preview.estimatedCost as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    return {
      requestDraftId: draft.id,
      requestHash,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      sourcePacket: {
        videoUrl: source.source.videoUrl,
        transcript: source.source.transcript,
        chapters: source.source.chapters,
        language: source.source.language,
        hashes: source.source.hashes,
      },
      schema: {
        name: contract.schemaName,
        version: contract.schemaVersion,
        json: contract.schemaJson,
      },
      model: preview,
      estimatedCost: preview.estimatedCost,
    };
  }

  async generate(lessonId: string, actorUserId: string, dto: GenerateVideoSummaryDto) {
    if (!dto.requestDraftId || !dto.requestHash)
      throwBadRequest(
        "AI_PREVIEW_REQUIRED",
        "Hãy xem trước dữ liệu gửi AI trước khi tạo tóm tắt video.",
      );
    const draft = await this.prisma.lessonVideoSummaryRequestDraft.findFirst({
      where: {
        id: dto.requestDraftId,
        lessonId,
        createdById: actorUserId,
        requestHash: dto.requestHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!draft)
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Bản xem trước không còn hợp lệ; hãy xem trước lại.",
      );
    const current = await this.lessonSource(lessonId);
    const snapshot = draft.sourceSnapshotJson as { hashes?: { source?: string } };
    if (snapshot.hashes?.source !== current.source.hashes.source)
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Video, transcript hoặc mốc thời gian đã thay đổi; hãy xem trước lại.",
      );
    const contract = buildVideoSummaryProviderContract(current.source.chapters);
    const modelConfig = draft.modelConfigJson as {
      routeSnapshot?: AiFeatureRoute;
      promptVersion?: string;
    };
    if (
      draft.schemaName !== contract.schemaName ||
      draft.schemaVersion !== contract.schemaVersion ||
      draft.schemaHash !== contract.schemaHash ||
      hashAiValue(draft.schemaJson) !== contract.schemaHash ||
      modelConfig.promptVersion !== contract.promptVersion
    )
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Contract AI của bản xem trước đã thay đổi; hãy xem trước lại.",
      );
    const route = modelConfig.routeSnapshot;
    if (!route)
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Thiếu cấu hình model của bản xem trước.",
      );
    const job = await this.jobs.createAndEnqueue({
      type: AiGenerationType.VIDEO_SUMMARY,
      createdByUserId: actorUserId,
      lessonId,
      targetType: "LESSON_VIDEO_SUMMARY",
      targetId: lessonId,
      promptVersion: contract.promptVersion,
      schemaVersion: contract.schemaVersion,
      inputFingerprint: {
        lessonId,
        requestHash: draft.requestHash,
        sourceHash: current.source.hashes.source,
      },
      inputMeta: {
        requestDraftId: draft.id,
        requestHash: draft.requestHash,
        sourceHash: current.source.hashes.source,
        schemaName: contract.schemaName,
        schemaVersion: contract.schemaVersion,
        schemaHash: contract.schemaHash,
        promptVersion: contract.promptVersion,
        temperature: route.temperature,
        reasoningEffort: route.reasoningEffort,
        maxOutputTokens: route.maxOutputTokens,
      },
      routeSnapshot: route,
      idempotencyKey: buildVideoSummaryJobIdempotencyKey({
        lessonId,
        sourceHash: current.source.hashes.source,
        requestHash: draft.requestHash,
        requestDraftId: draft.id,
      }),
      deduplicateActive: true,
      maxAttempts: 1,
    });
    await this.prisma.lessonVideoSummaryRequestDraft.update({
      where: { id: draft.id },
      data: { consumedAt: new Date() },
    });
    return { mode: "QUEUED" as const, jobId: job.backgroundJobId, status: job.status };
  }

  async upsertForAdmin(
    lessonId: string,
    actorUserId: string,
    dto: UpsertVideoSummaryDto,
    context: RequestContext = {},
  ) {
    const lessonContext = await this.lessonContext(lessonId);
    assertCurrentVideoSummaryDocument(dto.contentJson);
    const currentSource = buildVideoSummarySource(lessonContext.lesson);
    const approvedSourceBaseline =
      dto.reviewStatus === ReviewStatus.APPROVED && currentSource
        ? {
            sourceVideoUrlHash: currentSource.hashes.videoUrl,
            sourceTranscriptHash: currentSource.hashes.transcript,
            sourceChaptersHash: currentSource.hashes.chapters,
            sourcePlayerSettingsHash: currentSource.hashes.playerSettings,
            staleAt: null,
          }
        : {};
    const persistence = await this.prisma.$transaction(async (transaction) => {
      const before = await transaction.lessonVideoSummary.findUnique({
        where: { lessonId },
      });
      const summary = await transaction.lessonVideoSummary.upsert({
        where: { lessonId },
        create: {
          lessonId,
          contentJson: dto.contentJson as Prisma.InputJsonValue,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          ...approvedSourceBaseline,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        update: {
          contentJson: dto.contentJson as Prisma.InputJsonValue,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          ...approvedSourceBaseline,
          updatedById: actorUserId,
          deletedAt: null,
        },
      });
      const index = await this.videoSummaryIndex.syncInTransaction(transaction, {
        videoSummaryId: summary.id,
        lessonId,
        contentJson: summary.contentJson,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_VIDEO_SUMMARY_UPSERTED",
          entityType: "LessonVideoSummary",
          entityId: summary.id,
          before: before ? (before as unknown as Prisma.InputJsonValue) : undefined,
          after: summary as unknown as Prisma.InputJsonValue,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return { summary, index };
    });
    if (persistence.index.chunkCount > 0) {
      await this.embeddingEnqueuer.enqueueVideoSummaryEmbeddingJob({
        lessonId,
        videoSummaryId: persistence.index.videoSummaryId,
        summaryHash: persistence.index.summaryHash,
        ownerUserId: actorUserId,
      });
    }
    return serialize(persistence.summary);
  }
  async deleteForAdmin(
    lessonId: string,
    actorUserId: string,
    context: RequestContext = {},
  ) {
    const summary = await this.prisma.lessonVideoSummary.findFirst({
      where: { lessonId, deletedAt: null },
    });
    if (!summary) return;
    await this.prisma.$transaction([
      this.prisma.lessonVideoSummary.delete({
        where: { id: summary.id },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_VIDEO_SUMMARY_DELETED",
          entityType: "LessonVideoSummary",
          entityId: summary.id,
          before: summary as unknown as Prisma.InputJsonValue,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
    ]);
  }
  private async lessonSource(lessonId: string) {
    const context = await this.lessonContext(lessonId);
    const source = buildVideoSummarySource(context.lesson);
    if (!source)
      throwBadRequest(
        "VIDEO_SUMMARY_SOURCE_UNAVAILABLE",
        "Cần có video và bản chép lời đã lưu trước khi tóm tắt.",
      );
    return { ...context, source };
  }

  private async lessonContext(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null, learningPath: { deletedAt: null } },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        customVideoSettings: true,
        learningPath: {
          select: {
            domain: { select: { name: true, slug: true } },
            targetAudiences: {
              select: { targetAudience: { select: { grade: true } } },
            },
          },
        },
      },
    });
    if (!lesson) throwNotFound("LESSON_NOT_FOUND", "Không tìm thấy buổi học");
    const targetGrade =
      lesson.learningPath.targetAudiences
        .map(({ targetAudience }) => targetAudience.grade)
        .filter((grade): grade is number => grade !== null)
        .sort((left, right) => left - right)[0] ?? null;
    const subject = resolveVideoSummarySubject({
      domainName: lesson.learningPath.domain.name,
      domainSlug: lesson.learningPath.domain.slug,
    });
    return { lesson, subject, targetGrade };
  }
  private async resolveRoute(dto: GenerateVideoSummaryDto) {
    const base = await this.routing.resolve(
      AiGenerationType.VIDEO_SUMMARY,
      AiModelPurpose.TEXT,
    );
    let candidates = base.candidates.filter((candidate) => candidate.available);
    if (dto.model) {
      const selectedCandidate =
        candidates.find((candidate) => candidate.model === dto.model) ??
        (await this.routing.resolveCandidateByModel(dto.model));
      candidates = selectedCandidate?.available ? [selectedCandidate] : [];
    }
    if (!candidates.length)
      throwBadRequest("AI_MODEL_NOT_AVAILABLE", "Model tóm tắt video không khả dụng.");
    const selectedCandidate = candidates[0]!;
    const aiConfiguration = readAiConfiguration(selectedCandidate.capabilitiesJson);
    return {
      ...base,
      model: selectedCandidate.model,
      candidates,
      temperature:
        aiConfiguration === "REASONING_EFFORT"
          ? null
          : (dto.temperature ?? base.temperature),
      reasoningEffort:
        aiConfiguration === "TEMPERATURE"
          ? null
          : (dto.reasoningEffort ?? base.reasoningEffort),
      maxOutputTokens: dto.maxOutputTokens ?? base.maxOutputTokens ?? 1200,
    } satisfies AiFeatureRoute;
  }
}
function normalize(dto: GenerateVideoSummaryDto) {
  return {
    style: dto.style ?? "student_friendly",
    styleInstructions:
      dto.styleInstructions?.trim() ||
      "Dễ hiểu, gần gũi và phù hợp với người học của khóa học.",
    length: dto.length ?? "standard",
    targetWordCount: dto.targetWordCount ?? null,
    extraInstructions: dto.extraInstructions?.trim() || null,
    systemInstructions: dto.systemInstructions?.trim() || null,
    userPrompt: dto.userPrompt?.trim() || null,
  };
}

export function buildVideoSummaryJobIdempotencyKey(input: {
  lessonId: string;
  sourceHash: string;
  requestHash: string;
  requestDraftId: string;
}) {
  return [
    "video-summary",
    input.lessonId,
    input.sourceHash,
    input.requestHash,
    input.requestDraftId,
  ].join(":");
}

function buildInput(
  context: {
    lesson: { title: string };
    source: VideoSummarySource;
    subject: VideoSummarySubject;
    targetGrade: number | null;
  },
  config: ReturnType<typeof normalize>,
) {
  const sourceText = serializeVideoSummarySourceText(context.source);
  const prompts = buildVideoSummaryPrompts({
    lessonTitle: context.lesson.title,
    subject: context.subject,
    targetGrade: context.targetGrade,
    configuration: config,
  });
  return {
    ...buildVideoSummaryStructuredRequestPolicy(),
    outputName: VIDEO_SUMMARY_SCHEMA_NAME,
    promptVersion: prompts.promptVersion,
    schemaVersion: VIDEO_SUMMARY_SCHEMA_VERSION,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    inputTextItems: [{ id: "source_packet_manifest" as const, text: sourceText }],
  };
}
function readAiConfiguration(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const configuration = (value as Record<string, unknown>).aiConfiguration;
  return configuration === "TEMPERATURE" || configuration === "REASONING_EFFORT"
    ? configuration
    : null;
}
function routeFingerprint(route: AiFeatureRoute) {
  return {
    model: route.model,
    candidates: route.candidates.map((item) => ({
      provider: item.provider,
      model: item.model,
    })),
    temperature: route.temperature,
    reasoningEffort: route.reasoningEffort,
    maxOutputTokens: route.maxOutputTokens,
  };
}
function serialize(summary: {
  id: string;
  lessonId: string;
  contentJson: unknown;
  source: ContentSource;
  reviewStatus: ReviewStatus;
  aiGenerationId: string | null;
  staleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...summary,
    contentJson: normalizeVideoSummaryDocument(summary.contentJson),
  };
}

function assertCurrentVideoSummaryDocument(contentJson: Record<string, unknown>) {
  if (
    contentJson.type === "lesson_summary_blocks" &&
    (contentJson.version !== VIDEO_SUMMARY_DOCUMENT_VERSION ||
      hasVideoSummaryBlock(contentJson))
  ) {
    throwBadRequest(
      "VIDEO_SUMMARY_SCHEMA_VERSION_INVALID",
      "Nội dung tóm tắt video không đúng phiên bản cấu trúc hiện tại.",
    );
  }
}
