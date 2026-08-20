import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAiReasoningEffort } from "@learning-path/shared";
import {
  AiGenerationType,
  Prisma,
  ProviderUsageMetric,
  StemFigureRevisionStatus,
} from "@prisma/client";
import type { ProviderRouteCandidate } from "#api/modules/provider-operations/types/provider-operations.types";

import { throwBadRequest, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";
import { LessonSourcePacketError } from "#api/modules/ai/services/lesson-source-packet.service";
import { lessonSourcePacketManifestSchema } from "#api/modules/ai/schemas/lesson-source-packet.schema";
import {
  LessonSummaryContextError,
  LessonSummaryContextService,
} from "#api/modules/ai/services/lesson-summary-context.service";
import {
  LESSON_SUMMARY_MAX_OUTPUT_TOKENS,
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  getLessonSummaryProviderTransportOutputSchema,
  resolveLessonSummaryOutputTokenFloor,
  stemFigureRenderPlanSchema,
  type LessonSummaryJobInput,
} from "#api/modules/ai/types/lesson-summary.types";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import {
  buildAiStructuredTextFormat,
  estimateAiStructuredInputTokens,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import {
  applyLessonSummaryPhaseOneBlockEdits,
  prepareLessonSummaryPhaseOneLayoutEdits,
  readLessonSummaryPhaseOneSnapshot,
} from "#api/modules/ai/utils/lesson-summary-phase-one-editor";
import {
  buildOpenAiResponseInput,
  buildOpenAiStructuredResponseRequest,
  OPENAI_PREVIEW_BINARY_DATA,
  OPENAI_PREVIEW_FILE_ID,
} from "#api/modules/ai/utils/openai-response-request";
import { GenerateLessonSummaryDto } from "#api/modules/learning-paths/dto/generate-lesson-summary.dto";
import { UpdateLessonSummaryPhaseOneBlocksDto } from "#api/modules/learning-paths/dto/update-lesson-summary-phase-one-blocks.dto";
import { UpsertLessonSummaryDto } from "#api/modules/learning-paths/dto/upsert-lesson-summary.dto";
import { lessonSummarySelect } from "#api/modules/learning-paths/selectors/lesson-summary.selects";
import { serializeLessonSummary } from "#api/modules/learning-paths/serializers/lesson-summary.serializers";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  throwLessonNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/lesson.helpers";
import { reconcileLessonSummaryReviewIssues } from "#api/modules/learning-paths/utils/lesson-summary-review";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { supportsHighDetailPdfInput } from "#api/modules/provider-operations/utils/ai-model-capabilities";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

@Injectable()
export class LessonSummariesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiGenerationJobService)
    private readonly aiGenerationJobs: AiGenerationJobService,
    @Inject(LessonSummaryContextService)
    private readonly summaryContext: LessonSummaryContextService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(LessonSourcePacketService)
    private readonly packets: LessonSourcePacketService,
  ) {}

  async getForAdmin(lessonId: string) {
    await this.assertLessonExists(lessonId);
    const summary = await this.prisma.lessonSummary.findUnique({
      where: { lessonId },
      select: {
        ...lessonSummarySelect,
        aiGeneration: { select: { inputMetaJson: true, outputJson: true } },
      },
    });

    if (!summary || summary.deletedAt) return null;

    const requestDraftId = readString(
      readJsonRecord(summary.aiGeneration?.inputMetaJson).requestDraftId,
    );
    const requestDraft = requestDraftId
      ? await this.prisma.lessonSummaryRequestDraft.findFirst({
          where: { id: requestDraftId, lessonId },
          select: { manifestJson: true },
        })
      : null;

    return {
      ...serializeLessonSummary(summary),
      phaseOneBlockJsonByPath: readPhaseOneBlockJsonByPath(
        summary.aiGeneration?.outputJson,
      ),
      sourcePages: readAdminLessonSummarySourcePages(requestDraft?.manifestJson),
    };
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
      const reconciledContent = reconcileLessonSummaryReviewIssues(dto.contentJson);
      const referencedFigureIds = collectStemFigureIds(reconciledContent);
      if (referencedFigureIds.length > 0) {
        const figures = before
          ? await transaction.stemFigure.findMany({
              where: {
                id: { in: referencedFigureIds },
                lessonId,
                lessonSummaryId: before.id,
                deletedAt: null,
              },
              select: {
                id: true,
                currentRevision: {
                  select: { status: true, deliveryFileId: true },
                },
              },
            })
          : [];
        assertLessonSummaryStemFigureReferences({
          referencedFigureIds,
          figures,
          requireReadyAsset: dto.reviewStatus === "APPROVED",
        });
      }
      const contentJson = reconciledContent as Prisma.InputJsonValue;
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

  async updatePhaseOneBlocksForAdmin(
    lessonId: string,
    actorUserId: string,
    dto: UpdateLessonSummaryPhaseOneBlocksDto,
    context: RequestContext = {},
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const summary = await transaction.lessonSummary.findFirst({
        where: {
          lessonId,
          deletedAt: null,
          lesson: { deletedAt: null, learningPath: { deletedAt: null } },
        },
        select: {
          ...lessonSummarySelect,
          aiGeneration: { select: { id: true, outputJson: true } },
          stemFigures: {
            where: { deletedAt: null },
            orderBy: [{ blockPath: "asc" }, { figureIndex: "asc" }],
            select: {
              id: true,
              blockPath: true,
              figureIndex: true,
              localPlanId: true,
              planJson: true,
              status: true,
              currentRevision: {
                select: {
                  id: true,
                  status: true,
                  deliveryFileId: true,
                  altText: true,
                  caption: true,
                },
              },
              pendingRevision: {
                select: { id: true, altText: true, caption: true },
              },
            },
          },
        },
      });
      if (!summary) throwLessonNotFound();

      const snapshot = readLessonSummaryPhaseOneSnapshot(
        summary.aiGeneration?.outputJson,
      );
      if (!snapshot || !summary.aiGeneration) {
        throwBadRequest(
          "LESSON_SUMMARY_PHASE_ONE_RAW_UNAVAILABLE",
          "Bản kiến thức này chưa có raw Phase 1 có thể chỉnh sửa. Hãy sinh lại kiến thức.",
        );
      }
      const layoutOperations = (dto.phaseOneLayoutOperations ?? []).map((operation) => {
        if (operation.type === "MERGE_SECTION") {
          return {
            type: operation.type,
            sectionIndex: operation.sectionIndex,
          } as const;
        }
        if (operation.blockIndex === undefined) {
          throwBadRequest(
            "LESSON_SUMMARY_PHASE_ONE_LAYOUT_INVALID",
            "Thao tác xóa block thiếu vị trí block.",
          );
        }
        return {
          type: operation.type,
          sectionIndex: operation.sectionIndex,
          blockIndex: operation.blockIndex,
        } as const;
      });
      const prepared = prepareLessonSummaryPhaseOneLayoutEdits(
        snapshot,
        layoutOperations,
      );
      if (!prepared.success) {
        throwBadRequest(prepared.code, prepared.message, prepared.details);
      }
      assertRawFigureCountsUnchanged(
        prepared.snapshot.blocks,
        dto.phaseOneBlockJsonByPath,
      );
      const applied = applyLessonSummaryPhaseOneBlockEdits({
        lessonId,
        snapshot: prepared.snapshot,
        blocks: dto.phaseOneBlockJsonByPath,
      });
      if (!applied.success) {
        throwBadRequest(applied.code, applied.message, applied.details);
      }

      const relocatedFigures = summary.stemFigures.flatMap((figure) => {
        const nextPath = prepared.blockPathChanges.get(figure.blockPath);
        return nextPath === null
          ? []
          : [{ ...figure, blockPath: nextPath ?? figure.blockPath }];
      });
      const deletedFigures = summary.stemFigures.filter(
        (figure) => prepared.blockPathChanges.get(figure.blockPath) === null,
      );
      const movedFigures = relocatedFigures.filter((figure) => {
        const original = summary.stemFigures.find((item) => item.id === figure.id);
        return original?.blockPath !== figure.blockPath;
      });

      const plannedFigures = new Map(
        applied.mapped.figures.map((figure) => [
          stemFigurePositionKey(figure.blockPath, figure.figureIndex),
          figure.draft,
        ]),
      );
      const activeFigures = new Map(
        relocatedFigures.map((figure) => [
          stemFigurePositionKey(figure.blockPath, figure.figureIndex),
          figure,
        ]),
      );
      const missingFigurePositions = [...plannedFigures.keys()].filter(
        (position) => !activeFigures.has(position),
      );
      if (missingFigurePositions.length > 0) {
        throwBadRequest(
          "LESSON_SUMMARY_PHASE_ONE_FIGURE_MISSING",
          "Một số figure trong raw không còn khớp dữ liệu hiện tại. Hãy tải lại trang.",
          { positions: missingFigurePositions },
        );
      }

      const content = structuredClone(applied.mapped.content);
      for (const figure of [...movedFigures, ...deletedFigures]) {
        await transaction.stemFigure.update({
          where: { id: figure.id },
          data: { blockPath: `layout-operation-${figure.id}` },
        });
      }
      for (const figure of movedFigures) {
        await transaction.stemFigure.update({
          where: { id: figure.id },
          data: { blockPath: figure.blockPath },
        });
      }
      if (deletedFigures.length > 0) {
        await transaction.stemFigure.updateMany({
          where: { id: { in: deletedFigures.map((figure) => figure.id) } },
          data: { deletedAt: new Date() },
        });
      }

      for (const figure of relocatedFigures) {
        const position = stemFigurePositionKey(figure.blockPath, figure.figureIndex);
        const planned = plannedFigures.get(position);
        const currentPlan = isRecord(figure.planJson) ? figure.planJson : {};
        const plan = planned ? { ...planned, localId: figure.localPlanId } : currentPlan;
        const metadataRevision = figure.currentRevision ?? figure.pendingRevision;
        const altText = planned?.altText ?? metadataRevision?.altText ?? "Hình minh họa";
        const caption = planned?.caption ?? metadataRevision?.caption ?? null;
        const parsedPlan = stemFigureRenderPlanSchema.safeParse(plan);
        if (!parsedPlan.success) {
          throwBadRequest(
            "LESSON_SUMMARY_FIGURE_PLAN_INVALID",
            "Figure plan không còn đúng contract v3. Hãy sinh lại nội dung.",
          );
        }
        const figureOrigin = parsedPlan.data.figureOrigin;
        attachPhaseOneFigureReference(content, {
          blockPath: figure.blockPath,
          figureIndex: figure.figureIndex,
          figureId: figure.id,
          figureOrigin,
          altText,
          caption,
          status: figure.status,
        });

        if (!planned) continue;
        await transaction.stemFigure.update({
          where: { id: figure.id },
          data: { planJson: plan as Prisma.InputJsonValue },
        });
        if (metadataRevision) {
          await transaction.stemFigureRevision.update({
            where: { id: metadataRevision.id },
            data: { altText, caption },
          });
        }
      }

      const reconciledContent = reconcileLessonSummaryReviewIssues({
        type: "lesson_summary_blocks",
        version: 3,
        data: content,
      });
      const referencedFigureIds = collectStemFigureIds(reconciledContent);
      assertLessonSummaryStemFigureReferences({
        referencedFigureIds,
        figures: relocatedFigures.map((figure) => ({
          id: figure.id,
          currentRevision: figure.currentRevision
            ? {
                status: figure.currentRevision.status,
                deliveryFileId: figure.currentRevision.deliveryFileId,
              }
            : null,
        })),
        requireReadyAsset: dto.reviewStatus === "APPROVED",
      });

      const updated = await transaction.lessonSummary.update({
        where: { id: summary.id },
        data: {
          contentJson: reconciledContent as Prisma.InputJsonValue,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          updatedById: actorUserId,
        },
        select: lessonSummarySelect,
      });
      await transaction.aiGeneration.update({
        where: { id: summary.aiGeneration.id },
        data: {
          outputJson: applied.snapshot as unknown as Prisma.InputJsonValue,
          outputHash: hashAiValue(applied.snapshot),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_SUMMARY_PHASE_ONE_RAW_UPDATED",
          entityType: "LessonSummary",
          entityId: summary.id,
          before: toInputJson(serializeLessonSummary(summary)),
          after: toInputJson(serializeLessonSummary(updated)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: toInputJson({
            providerCalled: false,
            figureJobsEnqueued: 0,
            layoutOperations,
          }),
        },
      });
    });

    return this.getForAdmin(lessonId);
  }

  async deleteForAdmin(
    lessonId: string,
    actorUserId: string,
    context: RequestContext = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
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

      const summary = await transaction.lessonSummary.findUnique({
        where: { lessonId },
        select: lessonSummarySelect,
      });
      if (!summary) {
        return { deleted: false };
      }

      await transaction.lessonSummary.delete({ where: { id: summary.id } });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_SUMMARY_DELETED",
          entityType: "LessonSummary",
          entityId: summary.id,
          before: toInputJson(serializeLessonSummary(summary)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return { deleted: true };
    });
  }

  async generate(lessonId: string, actorUserId: string, dto: GenerateLessonSummaryDto) {
    if (!dto.requestDraftId || !dto.requestHash) {
      throwBadRequest(
        "AI_REQUEST_DRAFT_REQUIRED",
        "Hãy tạo lại bản xem trước request trước khi bắt đầu.",
      );
    }
    const draft = await this.prisma.lessonSummaryRequestDraft.findFirst({
      where: { id: dto.requestDraftId, lessonId },
    });
    if (!draft || draft.expiresAt.getTime() <= Date.now() || draft.consumedAt) {
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Bản xem trước đã hết hạn hoặc đã được sử dụng.",
      );
    }
    if (draft.requestHash !== dto.requestHash) {
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Prompt hiện tại không còn khớp bản xem trước.",
      );
    }
    const sourceSnapshot = readJsonRecord(draft.sourceSnapshotJson);
    const configuration = normalizeConfiguration(
      dto,
      this.resolveSchemaReferenceStrategy(),
      this.resolvePromptCacheConfiguration(),
    );
    if (
      hashAiValue(configuration) !==
      hashAiValue(readJsonRecord(sourceSnapshot.generationConfiguration))
    ) {
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Cấu hình sinh hiện tại không còn khớp bản xem trước.",
      );
    }
    const documentIds = readStringArray(sourceSnapshot.documentIds);
    const currentSourceHash = await this.packets.computeCurrentSourceHash(
      lessonId,
      documentIds,
    );
    if (
      currentSourceHash !== readRequiredString(sourceSnapshot.sourceHash, "sourceHash")
    ) {
      throwBadRequest(
        "AI_INPUT_SNAPSHOT_STALE",
        "Nguồn PDF hoặc khoảng trang đã thay đổi; hãy preview lại.",
      );
    }
    const route = readJsonRecord(
      readJsonRecord(draft.modelConfigJson).routeSnapshot,
    ) as unknown as AiFeatureRoute;

    const requestId = randomUUID();
    const inputMeta = {
      requestDraftId: draft.id,
      requestHash: draft.requestHash,
      packetHash: draft.packetHash,
      manifestHash: draft.manifestHash,
      documentIds,
      sourceHash: currentSourceHash,
      targetGrade: readNumber(sourceSnapshot.targetGrade),
      subjectKey: readRequiredString(sourceSnapshot.subjectKey, "subjectKey"),
      subjectName: readRequiredString(sourceSnapshot.subjectName, "subjectName"),
      subjectSlug: readRequiredString(sourceSnapshot.subjectSlug, "subjectSlug"),
      ...configuration,
    } as const;
    const job = await this.aiGenerationJobs.createAndEnqueue({
      type: AiGenerationType.SUMMARY,
      createdByUserId: actorUserId,
      lessonId,
      targetType: "LESSON",
      targetId: lessonId,
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      inputFingerprint: {
        lessonId,
        ...inputMeta,
        route: {
          candidates: route.candidates.map((candidate) => ({
            provider: candidate.provider,
            model: candidate.model,
          })),
          temperature: route.temperature,
          reasoningEffort: route.reasoningEffort,
          maxOutputTokens: route.maxOutputTokens,
        },
      },
      inputMeta,
      routeSnapshot: route,
      idempotencyKey: ["ai-summary", lessonId, currentSourceHash, requestId].join(":"),
      deduplicateActive: true,
      // An admin click authorizes exactly one provider request. Local recovery
      // handles block defects; the worker must not silently spend another call.
      maxAttempts: 1,
    });
    await this.prisma.lessonSummaryRequestDraft.update({
      where: { id: draft.id },
      data: { consumedAt: new Date() },
    });

    return {
      mode: "QUEUED" as const,
      jobId: job.backgroundJobId,
      status: job.status,
    };
  }

  async previewPrompt(
    lessonId: string,
    actorUserId: string,
    dto: GenerateLessonSummaryDto,
  ) {
    await this.cleanupRequestDraftPackets(lessonId, actorUserId);
    const sourceContext = await this.loadPacketSourceContext(lessonId, dto.documentIds);
    if (!sourceContext.packet) throw new Error("Missing lesson source packet.");
    const configuration = normalizeConfiguration(
      dto,
      this.resolveSchemaReferenceStrategy(),
      this.resolvePromptCacheConfiguration(),
    );
    const { baseRoute, route } = await this.resolveSummaryRoute(dto);
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: sourceContext.lessonTitle,
      targetGrade: sourceContext.targetGrade,
      subject: sourceContext.subject,
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
      packet: {
        filename: sourceContext.packet.filename,
        bytes: sourceContext.packet.bytes,
        modelManifest: sourceContext.packet.modelManifest,
      },
      configuration,
      systemInstructions: configuration.systemInstructions,
      userPrompt: configuration.userPrompt,
    });
    const inputPrompt = buildAiUserPrompt(request);
    const structuredTextFormat = buildAiStructuredTextFormat(
      getLessonSummaryProviderTransportOutputSchema(
        sourceContext.subject.key,
        "CONTEXTUAL",
        sourceContext.targetGrade,
      ),
      request.outputName,
      request.schemaReferenceStrategy,
    );
    const pdfInputTokens = Math.max(1, sourceContext.packet.manifest.pageCount * 1_000);
    const sourceManifestText = JSON.stringify(sourceContext.packet.modelManifest);
    const inputTokenEstimate = estimateAiStructuredInputTokens({
      systemPrompt: request.systemPrompt,
      inputPrompt: `${inputPrompt}\n${sourceManifestText}`,
      structuredTextFormat,
      additionalInputTokens: pdfInputTokens,
    });
    const maxOutputTokens = route.maxOutputTokens ?? LESSON_SUMMARY_MAX_OUTPUT_TOKENS;
    const resolvedCandidate =
      route.candidates.find((candidate) => candidate.available) ??
      route.candidates[0] ??
      null;
    const resolvedModel = resolvedCandidate?.model ?? null;
    const resolvedTemperature = route.temperature ?? request.temperature;
    const configuredReasoningEffort = route.reasoningEffort ?? request.reasoningEffort;
    const resolvedReasoningEffort = isAiReasoningEffort(configuredReasoningEffort)
      ? configuredReasoningEffort
      : undefined;
    const fxRate = await this.getFxRateVndPerUsd();
    const requiredCostMetrics = new Set([
      ProviderUsageMetric.INPUT_TOKEN,
      ProviderUsageMetric.OUTPUT_TOKEN,
    ]);
    const pricedMetrics = new Set(
      resolvedCandidate?.rates.map((rate) => rate.metric) ?? [],
    );
    const canEstimateCost = [...requiredCostMetrics].every((metric) =>
      pricedMetrics.has(metric),
    );
    const estimatedInputCost =
      resolvedCandidate && canEstimateCost
        ? calculateProviderCost(
            {
              promptTokens: inputTokenEstimate.estimatedTokens,
              completionTokens: 0,
              requestCount: 1,
            },
            resolvedCandidate.rates,
            fxRate,
          )
        : null;
    const estimatedOutputCost =
      resolvedCandidate && canEstimateCost
        ? calculateProviderCost(
            {
              promptTokens: 0,
              completionTokens: maxOutputTokens,
              requestCount: 0,
            },
            resolvedCandidate.rates,
            fxRate,
          )
        : null;
    const estimatedCost =
      resolvedCandidate && canEstimateCost
        ? calculateProviderCost(
            {
              promptTokens: inputTokenEstimate.estimatedTokens,
              completionTokens: maxOutputTokens,
              requestCount: 1,
            },
            resolvedCandidate.rates,
            fxRate,
          )
        : null;

    const allActiveModels = (await this.modelRouting.getAllActiveModels()).filter(
      supportsHighDetailPdfInput,
    );
    const schemaJson = structuredTextFormat.schema;
    const schemaHash = hashAiValue(schemaJson);
    const requestHash = hashAiValue({
      packetHash: sourceContext.packet.packetHash,
      manifestHash: sourceContext.packet.manifestHash,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      schemaHash,
      model: resolvedModel,
      temperature: resolvedTemperature,
      reasoningEffort: resolvedReasoningEffort,
      maxOutputTokens,
      detail: "high",
    });
    const expiresAt = new Date(
      Date.now() +
        this.configService.get("AI_SUMMARY_REQUEST_DRAFT_TTL_SECONDS", {
          infer: true,
        }) *
          1_000,
    );
    const draft = await this.prisma.lessonSummaryRequestDraft.create({
      data: {
        lessonId,
        createdById: actorUserId,
        requestHash,
        packetHash: sourceContext.packet.packetHash,
        manifestHash: sourceContext.packet.manifestHash,
        packetObjectKey: sourceContext.packet.objectKey,
        packetFilename: sourceContext.packet.filename,
        packetSizeBytes: BigInt(sourceContext.packet.bytes.length),
        packetPageCount: sourceContext.packet.manifest.pageCount,
        systemInstructions: request.systemPrompt,
        userPrompt: request.userPrompt,
        schemaName: request.outputName,
        schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
        schemaHash,
        schemaJson: schemaJson as unknown as Prisma.InputJsonValue,
        manifestJson: sourceContext.packet.manifest as unknown as Prisma.InputJsonValue,
        sourceSnapshotJson: {
          ...sourceContext.packet.sourceSnapshot,
          documentIds: sourceContext.documentIds,
          sourceHash: sourceContext.sourceHash,
          lessonTitle: sourceContext.lessonTitle,
          targetGrade: sourceContext.targetGrade,
          subjectKey: sourceContext.subject.key,
          subjectName: sourceContext.subject.name,
          subjectSlug: sourceContext.subject.slug,
          generationConfiguration: configuration,
        } as Prisma.InputJsonValue,
        modelConfigJson: {
          resolvedProvider: resolvedCandidate?.provider ?? null,
          resolvedModel,
          temperature: resolvedTemperature,
          reasoningEffort: resolvedReasoningEffort,
          maxOutputTokens,
          pdfDetail: "high",
          routeSnapshot: route,
        } as unknown as Prisma.InputJsonValue,
        costEstimateJson: estimatedCost
          ? ({
              inputUpperBoundUsd: estimatedInputCost?.costUsd ?? null,
              inputUpperBoundVnd: estimatedInputCost?.costVnd ?? null,
              outputUpperBoundUsd: estimatedOutputCost?.costUsd ?? null,
              outputUpperBoundVnd: estimatedOutputCost?.costVnd ?? null,
              upperBoundUsd: estimatedCost.costUsd,
              upperBoundVnd: estimatedCost.costVnd,
              fxRateVndPerUsd: fxRate,
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        expiresAt,
      },
    });

    return {
      requestDraftId: draft.id,
      requestHash,
      expiresAt,
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      inputPrompt,
      openAiFileUploadRequest: {
        purpose: "user_data" as const,
        file: `<File name="${sourceContext.packet.filename}" type="application/pdf" size=${sourceContext.packet.bytes.length}; ${OPENAI_PREVIEW_BINARY_DATA}>`,
      },
      openAiRequest: buildOpenAiStructuredResponseRequest({
        request: {
          ...request,
          model: resolvedModel ?? undefined,
          temperature: resolvedTemperature,
          reasoningEffort: resolvedReasoningEffort,
          maxTokens: maxOutputTokens,
        },
        model: resolvedModel,
        structuredTextFormat,
        responseInput: buildOpenAiResponseInput(request, [
          {
            type: "input_file",
            file_id: OPENAI_PREVIEW_FILE_ID,
            detail: "high",
          },
        ]),
      }),
      context: {
        lessonTitle: sourceContext.lessonTitle,
        documentCount: sourceContext.documentIds.length,
        packet: {
          filename: sourceContext.packet.filename,
          sizeBytes: sourceContext.packet.bytes.length,
          pageCount: sourceContext.packet.manifest.pageCount,
          packetHash: sourceContext.packet.packetHash,
          manifestHash: sourceContext.packet.manifestHash,
          detail: "high",
          manifest: sourceContext.packet.manifest,
        },
        chunkCount: 0,
        estimatedTokens: inputTokenEstimate.estimatedTokens,
        textInputTokens: inputTokenEstimate.textInputTokens,
        pdfInputTokens,
        promptTokens: inputTokenEstimate.promptTokens,
        schemaTokens: inputTokenEstimate.schemaTokens,
        contextTokens: 0,
        maxContextTokens: null,
        chunks: [],
        tokenBreakdown: {
          systemInstructionsTokens: estimateTextTokens(request.systemPrompt),
          userPromptTokens: estimateTextTokens(request.userPrompt),
          contextTokens: 0,
          schemaTokens: inputTokenEstimate.schemaTokens,
          textInputTokens: inputTokenEstimate.textInputTokens,
          pdfInputTokens,
          estimatedTokens: inputTokenEstimate.estimatedTokens,
        },
      },
      configuration: {
        selectedModel: dto.model ?? null,
        isDefaultConfigured: baseRoute.hasConfiguration,
        resolvedProvider: resolvedCandidate?.provider ?? null,
        resolvedModel: resolvedCandidate?.model ?? null,
        temperature: route.temperature ?? request.temperature ?? 0.2,
        reasoningEffort: route.reasoningEffort ?? null,
        maxOutputTokens,
        modelOptions: allActiveModels.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      estimatedCost: estimatedCost
        ? {
            available: true,
            inputUpperBoundUsd: estimatedInputCost?.costUsd ?? null,
            inputUpperBoundVnd: estimatedInputCost?.costVnd ?? null,
            outputUpperBoundUsd: estimatedOutputCost?.costUsd ?? null,
            outputUpperBoundVnd: estimatedOutputCost?.costVnd ?? null,
            upperBoundUsd: estimatedCost.costUsd,
            upperBoundVnd: estimatedCost.costVnd,
            fxRateVndPerUsd: fxRate,
          }
        : {
            available: false,
            inputUpperBoundUsd: null,
            inputUpperBoundVnd: null,
            outputUpperBoundUsd: null,
            outputUpperBoundVnd: null,
            upperBoundUsd: null,
            upperBoundVnd: null,
            fxRateVndPerUsd: fxRate,
          },
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

  private async cleanupRequestDraftPackets(lessonId: string, actorUserId: string) {
    const drafts = await this.prisma.lessonSummaryRequestDraft.findMany({
      where: {
        consumedAt: null,
        OR: [{ expiresAt: { lte: new Date() } }, { lessonId, createdById: actorUserId }],
      },
      select: { id: true, packetObjectKey: true },
      take: 50,
    });
    if (drafts.length === 0) return;
    await Promise.all(
      drafts.map((draft) =>
        this.packets.cleanup(draft.packetObjectKey).catch(() => undefined),
      ),
    );
    await this.prisma.lessonSummaryRequestDraft.deleteMany({
      where: { id: { in: drafts.map((draft) => draft.id) } },
    });
  }

  private async loadSourceContext(lessonId: string, documentIds: string[]) {
    try {
      return await this.summaryContext.load(lessonId, documentIds);
    } catch (error) {
      this.rethrowContextError(error);
    }
  }

  private async loadPacketSourceContext(lessonId: string, documentIds: string[]) {
    try {
      return await this.summaryContext.loadPacket(lessonId, documentIds);
    } catch (error) {
      if (error instanceof LessonSourcePacketError) {
        if (error.code === "LESSON_NOT_FOUND") {
          throwNotFound("NOT_FOUND", error.message, error.details);
        }
        throwBadRequest(error.code, error.message, error.details);
      }
      this.rethrowContextError(error);
    }
  }

  private async resolveSummaryRoute(dto: GenerateLessonSummaryDto) {
    const baseRoute = await this.modelRouting.resolve(AiGenerationType.SUMMARY);
    let candidates = baseRoute.candidates.filter(supportsHighDetailPdfInput);
    if (!dto.model && candidates.length === 0) {
      throwBadRequest(
        "AI_PDF_MODEL_NOT_AVAILABLE",
        "Chưa có model OpenAI hỗ trợ PDF detail=high cho chức năng tóm tắt.",
      );
    }
    if (dto.model) {
      let selectedCandidate: ProviderRouteCandidate | null | undefined = candidates.find(
        (candidate) => candidate.model === dto.model && candidate.available,
      );
      if (!selectedCandidate) {
        selectedCandidate = await this.modelRouting.resolveCandidateByModel(dto.model);
      }
      if (
        !selectedCandidate ||
        !selectedCandidate.available ||
        !supportsHighDetailPdfInput(selectedCandidate)
      ) {
        throwBadRequest(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không còn khả dụng cho chức năng tóm tắt.",
          { model: dto.model },
        );
      }
      candidates = [selectedCandidate];
    }

    const route: AiFeatureRoute = {
      ...baseRoute,
      model: candidates[0]?.model ?? baseRoute.model,
      candidates,
      temperature: dto.temperature ?? baseRoute.temperature,
      reasoningEffort: dto.reasoningEffort ?? baseRoute.reasoningEffort,
      maxOutputTokens: Math.max(
        dto.maxOutputTokens ?? baseRoute.maxOutputTokens ?? 0,
        resolveLessonSummaryOutputTokenFloor({
          length: dto.length ?? "standard",
          targetWordCount: dto.targetWordCount ?? null,
        }),
      ),
    };
    if (dto.model && dto.reasoningEffort) {
      const allowedReasoningEffortLevels = readReasoningEffortLevels(
        candidates[0]?.capabilitiesJson,
      );
      if (!allowedReasoningEffortLevels.includes(dto.reasoningEffort)) {
        throwBadRequest(
          "AI_REASONING_EFFORT_NOT_SUPPORTED",
          "Mức Reasoning Effort đã chọn không được cấu hình cho model này.",
          {
            model: dto.model,
            reasoningEffort: dto.reasoningEffort,
            allowedReasoningEffortLevels,
          },
        );
      }
    }
    return { baseRoute, route };
  }

  private async getFxRateVndPerUsd() {
    const setting = await this.prisma.providerAccountingSetting.findUnique({
      where: { singletonKey: "default" },
      select: { fxRateVndPerUsd: true },
    });
    return setting?.fxRateVndPerUsd.toNumber() ?? 25_000;
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

  private resolveSchemaReferenceStrategy(): LessonSummaryJobInput["schemaReferenceStrategy"] {
    return this.configService.get("AI_SUMMARY_SCHEMA_REFERENCE_STRATEGY", {
      infer: true,
    });
  }

  private resolvePromptCacheConfiguration(): Pick<
    LessonSummaryJobInput,
    "promptCacheKeyEnabled" | "promptCacheRetention"
  > {
    return {
      promptCacheKeyEnabled: this.configService.get(
        "AI_SUMMARY_PROMPT_CACHE_KEY_ENABLED",
        { infer: true },
      ),
      promptCacheRetention: this.configService.get("AI_SUMMARY_PROMPT_CACHE_RETENTION", {
        infer: true,
      }),
    };
  }
}

function estimateTextTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readRequiredString(value: unknown, field: string) {
  const result = readString(value);
  if (result === null) {
    throwBadRequest("AI_INPUT_SNAPSHOT_INVALID", `Snapshot thiếu trường ${field}.`);
  }
  return result;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return isRecord(value) ? value : {};
}

export function readAdminLessonSummarySourcePages(
  value: Prisma.JsonValue | null | undefined,
) {
  const manifest = lessonSourcePacketManifestSchema.safeParse(value);
  if (!manifest.success) return [];

  return manifest.data.pages.map((page) => ({
    packetPageNumber: page.packetPageNumber,
    sourceFileId: page.sourceFileId,
    sourcePdfPageNumber: page.sourcePdfPageNumber,
    printedPageLabel: page.printedPageLabel,
    documentTitle: page.documentTitle,
  }));
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function collectStemFigureIds(contentJson: Record<string, unknown>) {
  const data = isRecord(contentJson.data) ? contentJson.data : null;
  const sections = data && Array.isArray(data.sections) ? data.sections : [];
  const ids = new Set<string>();
  for (const section of sections) {
    if (!isRecord(section) || !Array.isArray(section.blocks)) continue;
    for (const block of section.blocks) {
      if (!isRecord(block) || !Array.isArray(block.figures)) continue;
      for (const figure of block.figures) {
        if (
          isRecord(figure) &&
          figure.kind === "TEX_FIGURE" &&
          typeof figure.figureId === "string"
        ) {
          ids.add(figure.figureId);
        }
      }
    }
  }
  return [...ids];
}

export function assertLessonSummaryStemFigureReferences(input: {
  referencedFigureIds: string[];
  figures: Array<{
    id: string;
    currentRevision: {
      status: StemFigureRevisionStatus;
      deliveryFileId: string | null;
    } | null;
  }>;
  requireReadyAsset: boolean;
}) {
  const figuresById = new Map(input.figures.map((figure) => [figure.id, figure]));
  const invalidFigureIds = input.referencedFigureIds.filter(
    (figureId) => !figuresById.has(figureId),
  );
  if (invalidFigureIds.length > 0) {
    throwBadRequest(
      "LESSON_SUMMARY_STEM_FIGURES_INVALID_REFERENCE",
      "Nội dung chứa hình không còn thuộc bản kiến thức hiện tại. Hãy tải lại trang trước khi lưu.",
      { figureIds: invalidFigureIds.slice(0, 20) },
    );
  }
  if (!input.requireReadyAsset) return;

  const blockedFigureIds = input.referencedFigureIds.filter((figureId) => {
    const figure = figuresById.get(figureId)!;
    return (
      figure.currentRevision?.status !== StemFigureRevisionStatus.SUCCEEDED ||
      !figure.currentRevision.deliveryFileId
    );
  });
  if (blockedFigureIds.length > 0) {
    throwBadRequest(
      "LESSON_SUMMARY_STEM_FIGURES_UNRESOLVED",
      `Còn ${blockedFigureIds.length} hình chưa có asset hợp lệ để phát hành.`,
      { figureIds: blockedFigureIds.slice(0, 20) },
    );
  }
}

function assertRawFigureCountsUnchanged(
  previousBlocks: Record<string, unknown>,
  nextBlocks: Record<string, unknown>,
) {
  const changedPaths = Object.keys(previousBlocks).filter(
    (blockPath) =>
      readRawFigureCount(previousBlocks[blockPath]) !==
      readRawFigureCount(nextBlocks[blockPath]),
  );
  if (changedPaths.length > 0) {
    throwBadRequest(
      "LESSON_SUMMARY_PHASE_ONE_FIGURE_COUNT_CHANGED",
      "Không thêm hoặc xóa figure trực tiếp trong raw JSON. Hãy dùng menu ảnh của block.",
      { blockPaths: changedPaths },
    );
  }
}

function readRawFigureCount(value: unknown) {
  return isRecord(value) && Array.isArray(value.figures) ? value.figures.length : 0;
}

function stemFigurePositionKey(blockPath: string, figureIndex: number) {
  return `${blockPath}:${figureIndex}`;
}

function attachPhaseOneFigureReference(
  content: {
    sections: Array<{ blocks: Array<Record<string, unknown>> }>;
  },
  input: {
    blockPath: string;
    figureIndex: number;
    figureId: string;
    figureOrigin: "TEXTBOOK_SOURCE" | "GENERATED_FROM_BRIEF";
    altText: string;
    caption: string | null;
    status: string;
  },
) {
  const match = input.blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  const block = match
    ? content.sections[Number(match[1])]?.blocks[Number(match[2])]
    : undefined;
  if (!block) {
    throwBadRequest(
      "LESSON_SUMMARY_PHASE_ONE_BLOCK_PATH_INVALID",
      `Không tìm thấy block ${input.blockPath} sau khi map raw JSON.`,
    );
  }
  const figures = Array.isArray(block.figures) ? [...block.figures] : [];
  figures[input.figureIndex] = {
    kind: "TEX_FIGURE",
    figureId: input.figureId,
    figureOrigin: input.figureOrigin,
    altText: input.altText,
    caption: input.caption,
    status: input.status,
  };
  block.figures = figures;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPhaseOneBlockJsonByPath(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (
    value.type !== "lesson_summary_phase_one_blocks" ||
    (value.version !== 1 && value.version !== 2)
  ) {
    return null;
  }
  return isRecord(value.blocks) ? value.blocks : null;
}

function readReasoningEffortLevels(capabilities: unknown): string[] {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    return [];
  }
  const value = (capabilities as Record<string, unknown>).reasoningEffortLevels;
  return Array.isArray(value)
    ? value.filter((level): level is string => typeof level === "string")
    : [];
}

function normalizeConfiguration(
  dto: GenerateLessonSummaryDto,
  schemaReferenceStrategy: LessonSummaryJobInput["schemaReferenceStrategy"],
  promptCacheConfiguration: Pick<
    LessonSummaryJobInput,
    "promptCacheKeyEnabled" | "promptCacheRetention"
  >,
): Omit<
  LessonSummaryJobInput,
  | "documentIds"
  | "sourceHash"
  | "targetGrade"
  | "subjectKey"
  | "subjectName"
  | "subjectSlug"
  | "requestDraftId"
  | "requestHash"
  | "packetHash"
  | "manifestHash"
> {
  return {
    useTextbookSourceImages: dto.useTextbookSourceImages ?? false,
    autoEnhanceTextbookSourceImages:
      dto.useTextbookSourceImages === true &&
      dto.autoEnhanceTextbookSourceImages === true,
    style: dto.style,
    styleInstructions: dto.styleInstructions?.trim() ?? "",
    length: dto.length ?? "standard",
    targetWordCount: dto.targetWordCount ?? null,

    extraInstructions: dto.extraInstructions?.trim() ?? "",
    systemInstructions: dto.systemInstructions ?? "",
    userPrompt: dto.userPrompt ?? "",

    ...(dto.model ? { model: dto.model } : {}),
    ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
    ...(dto.reasoningEffort ? { reasoningEffort: dto.reasoningEffort } : {}),
    schemaReferenceStrategy,
    ...promptCacheConfiguration,
    ...(dto.maxOutputTokens !== undefined
      ? { maxOutputTokens: dto.maxOutputTokens }
      : {}),
  };
}
