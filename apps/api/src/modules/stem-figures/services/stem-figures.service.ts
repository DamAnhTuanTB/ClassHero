import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiGenerationType,
  AiModelPurpose,
  FilePurpose,
  FileStatus,
  FileVisibility,
  Prisma,
  StemFigureStatus,
} from "@prisma/client";
import sharp from "sharp";

import {
  throwBadRequest,
  throwNotFound,
  throwServiceUnavailable,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import type {
  CreateNewStemFigureAiDto,
  CreateStemFigureForBlockAiDto,
  EnsureStemFigureForBlockDto,
  RetryStemFigureDto,
  StemFigureAiCreateOptionsDto,
  StemFigureMutationGuardDto,
  UseStemFigureSourceCropDto,
} from "#api/modules/stem-figures/dto/stem-figure-mutation-guard.dto";
import { StemFigureReferenceImageMode } from "#api/modules/stem-figures/dto/stem-figure-mutation-guard.dto";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { FilesService } from "#api/modules/files/services/files.service";
import type { UploadedFileBuffer } from "#api/modules/files/types/uploaded-file.types";
import { reconcileLessonSummaryReviewIssues } from "#api/modules/learning-paths/utils/lesson-summary-review";
import {
  stemFigureRenderPlanSchema,
  type StemFigureRenderPlan,
} from "#api/modules/ai/types/lesson-summary.types";
import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";
import { lessonSourcePacketManifestSchema } from "#api/modules/ai/schemas/lesson-source-packet.schema";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { buildLessonSummaryFigureAltText } from "#api/modules/ai/utils/lesson-summary-figure-alt-text";
import {
  FigureReferenceResolverService,
  hashFigureReferenceSnapshot,
  type FigureReferenceSnapshot,
} from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import {
  stemFigureSelect,
  type StemFigureRecord,
} from "#api/modules/stem-figures/selectors/stem-figure.selects";
import { serializeStemFigure } from "#api/modules/stem-figures/serializers/stem-figure.serializers";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import {
  resolveStemFigureProviderReferenceAssets,
  StemFigureRepairService,
} from "#api/modules/stem-figures/services/stem-figure-repair.service";
import { parseStemFigureDiagnosticBatch } from "#api/modules/stem-figures/utils/stem-figure-diagnostics";
import {
  buildStemFigureGenerationBrief,
  stemFigureLessonContextSchema,
  type StemFigureLessonContext,
} from "#api/modules/stem-figures/utils/stem-figure-generation-brief";
import { resolveCourseSubject } from "#api/modules/ai/utils/lesson-summary-subject";
import { ensureStemFigureSummaryReference } from "#api/modules/stem-figures/utils/stem-figure-summary-reference";
import { compareStemFigurePositions } from "#api/modules/stem-figures/utils/stem-figure-position";
import { prepareStemFigureProviderReferenceImages } from "#api/modules/stem-figures/utils/stem-figure-reference-images";
import {
  applyConservativeRasterEnhancement,
  STEM_FIGURE_RASTER_EDIT_MAX_PIXELS,
  STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
} from "#api/modules/stem-figures/utils/stem-figure-raster-edit";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type {
  AiFeatureRoute,
  ProviderRouteCandidate,
} from "#api/modules/provider-operations/types/provider-operations.types";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

@Injectable()
export class StemFiguresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(StemFigureJobService)
    private readonly jobs: StemFigureJobService,
    @Inject(StemFigureRepairService)
    private readonly repair: StemFigureRepairService,
    @Inject(FigureReferenceResolverService)
    private readonly figureReferences: FigureReferenceResolverService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
  ) {}

  async listForAdmin(lessonId: string) {
    const records = await this.prisma.stemFigure.findMany({
      where: { lessonId, deletedAt: null },
      orderBy: [{ blockPath: "asc" }, { createdAt: "asc" }],
      select: stemFigureSelect,
    });
    return Promise.all(
      records
        .sort(compareStemFigurePositions)
        .map((record) => serializeStemFigure(record, this.files, this.storage, true)),
    );
  }

  async getForAdmin(lessonId: string, figureId: string) {
    return serializeStemFigure(
      await this.requireFigure(lessonId, figureId),
      this.files,
      this.storage,
      true,
    );
  }

  async ensureForBlock(
    lessonId: string,
    actorUserId: string,
    dto: EnsureStemFigureForBlockDto,
  ) {
    const summary = await this.prisma.lessonSummary.findFirst({
      where: { lessonId, deletedAt: null },
      select: {
        id: true,
        aiGenerationId: true,
        contentJson: true,
        lesson: {
          select: {
            learningPath: {
              select: {
                domain: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });
    const envelope = asRecord(summary?.contentJson);
    const output = stemFigureLessonContextSchema.safeParse(envelope.data);
    if (!summary || !output.success) {
      throwBadRequest(
        "STEM_FIGURE_LOCAL_CONTEXT_MISSING",
        "Không đọc được nội dung khối để chuẩn bị hình.",
      );
    }
    const blockContext = readBlockContext(output.data, dto.blockPath);
    if (!blockContext) {
      throwBadRequest(
        "STEM_FIGURE_BLOCK_NOT_FOUND",
        "Khối nội dung không còn tồn tại. Hãy tải lại trang.",
      );
    }
    const figureIndex = dto.figureIndex ?? 0;

    const active = await this.prisma.stemFigure.findFirst({
      where: {
        lessonSummaryId: summary.id,
        blockPath: dto.blockPath,
        figureIndex,
        deletedAt: null,
      },
      select: stemFigureSelect,
    });
    if (active) {
      return serializeStemFigure(active, this.files, this.storage, true);
    }

    const deleted = await this.prisma.stemFigure.findFirst({
      where: {
        lessonSummaryId: summary.id,
        blockPath: dto.blockPath,
        figureIndex,
        deletedAt: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: stemFigureSelect,
    });
    const plan = deleted ? stemFigureRenderPlanSchema.safeParse(deleted.planJson) : null;
    const localPlanId =
      deleted?.localPlanId ?? `F${String(figureIndex + 1).padStart(3, "0")}`;
    const draftPlan = plan?.success
      ? plan.data
      : buildBlockFigurePlan(blockContext, localPlanId);
    const previousRevision = deleted?.currentRevision ?? deleted?.pendingRevision ?? null;
    const referenceSnapshot =
      readFigureReferenceSnapshot(previousRevision?.referenceSnapshotJson) ??
      (await this.resolveReferenceSnapshot({
        aiGenerationId: summary.aiGenerationId,
        lessonId,
        plan: draftPlan,
      }).catch(() => emptyFigureReferenceSnapshot(draftPlan.localId)));
    const sourceVersion = deleted ? await this.nextSourceVersion(deleted.id) : 1;
    const latexSource = createStarterFigureSource();
    const altText =
      previousRevision?.altText ??
      buildLessonSummaryFigureAltText({
        block: blockContext.block,
        sectionHeading: blockContext.sectionHeading,
      });
    const caption = previousRevision?.caption ?? null;
    const subject = resolveCourseSubject({
      domainName: summary.lesson.learningPath.domain.name,
      domainSlug: summary.lesson.learningPath.domain.slug,
    });

    const figureId = await this.prisma.$transaction(async (transaction) => {
      const figure = deleted
        ? await transaction.stemFigure.update({
            where: { id: deleted.id },
            data: {
              deletedAt: null,
              currentRevisionId: null,
              pendingRevisionId: null,
              status: "FAILED",
              lastErrorCategory: null,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
            select: { id: true },
          })
        : await transaction.stemFigure.create({
            data: {
              lessonId,
              lessonSummaryId: summary.id,
              aiGenerationId: summary.aiGenerationId,
              blockPath: dto.blockPath,
              figureIndex,
              localPlanId,
              planJson: draftPlan,
              subjectKey: subject.key,
              subjectName: subject.name,
              subjectSlug: subject.slug,
              status: "FAILED",
              createdById: actorUserId,
            },
            select: { id: true },
          });
      const revision = await transaction.stemFigureRevision.create({
        data: {
          stemFigureId: figure.id,
          sourceKind: "AI_TEX",
          origin: "ADMIN_EDIT",
          status: "DRAFT_READY",
          latexSource,
          sourceHash: StemFigureJobService.sourceHash(latexSource),
          sourceVersion,
          altText,
          caption,
          referenceSnapshotJson: referenceSnapshot,
          referenceSnapshotHash: hashFigureReferenceSnapshot(referenceSnapshot),
          createdById: actorUserId,
        },
        select: { id: true },
      });
      await transaction.stemFigure.update({
        where: { id: figure.id },
        data: { pendingRevisionId: revision.id },
      });
      return figure.id;
    });
    return this.getForAdmin(lessonId, figureId);
  }

  async retry(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    dto: RetryStemFigureDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertMutationHead(figure, dto);
    const revision = figure.pendingRevision ?? figure.currentRevision;
    if (!revision) {
      throwBadRequest(
        "STEM_FIGURE_RETRY_DIAGNOSTICS_MISSING",
        "Hình chưa có revision để thử lại.",
      );
    }
    const attempt = revision.attempts[0];
    if (
      (dto.latestAttemptId ?? null) !== (attempt?.id ?? null) ||
      (dto.diagnosticBatchHash ?? null) !== (attempt?.diagnosticBatchHash ?? null)
    ) {
      throwBadRequest(
        "STEM_FIGURE_RETRY_DIAGNOSTICS_STALE",
        "Diagnostic đã thay đổi. Hãy tải lại trước khi Retry.",
      );
    }
    const batch = parseStemFigureDiagnosticBatch(attempt?.diagnosticBatch);
    const category = revision.lastErrorCategory ?? batch?.category ?? null;
    const sourceMissing = !revision.latexSource?.trim() && !revision.sourceHash;
    if (
      sourceMissing &&
      (category === "BUDGET" ||
        category === "PROVIDER_OUTPUT" ||
        category === "INFRASTRUCTURE")
    ) {
      const referenceSnapshot =
        revision.referenceSnapshotJson as FigureReferenceSnapshot | null;
      if (!referenceSnapshot) {
        throwBadRequest(
          "STEM_FIGURE_SOURCE_MANIFEST_MISSING",
          "Revision không có snapshot ảnh nguồn bất biến để thử lại.",
        );
      }
      const generationBrief = await this.buildGenerationBrief({
        figure,
        referenceSnapshot,
        altText: revision.altText,
        caption: revision.caption,
      });
      const job = await this.jobs.enqueue(figureId, actorUserId, {
        revisionId: revision.id,
        trigger: "MANUAL_SOURCE_RETRY",
        generationBrief,
      });
      return {
        jobId: job.id,
        status: job.status,
        retryUsesAi: true,
        issueCount: 0,
        estimatedMaxCostVnd: null,
      };
    }
    if (category === "INFRASTRUCTURE") {
      const job = await this.jobs.enqueue(figureId, actorUserId, {
        revisionId: revision.id,
        trigger: "INFRASTRUCTURE_RETRY",
        diagnosticBatchHash: batch?.batchHash,
      });
      return {
        jobId: job.id,
        status: job.status,
        retryUsesAi: false,
        issueCount: batch?.issues.length ?? 0,
      };
    }
    if (!batch || !attempt?.diagnosticBatchHash) {
      throwBadRequest(
        "STEM_FIGURE_RETRY_DIAGNOSTICS_MISSING",
        "Không tìm thấy diagnostic batch đầy đủ của lần xử lý gần nhất.",
      );
    }
    if (
      batch.sourceVersion !== revision.sourceVersion ||
      batch.sourceHash !== revision.sourceHash ||
      batch.batchHash !== attempt.diagnosticBatchHash
    ) {
      throwBadRequest(
        "STEM_FIGURE_RETRY_DIAGNOSTICS_STALE",
        "Diagnostic không còn khớp source hiện tại. Hãy tải lại.",
      );
    }
    this.repair.assertRepairPayloadFits({
      source: revision.latexSource ?? "",
      diagnosticBatch: batch,
    });
    const trigger =
      batch.category === "VALIDATOR" ? "MANUAL_VALIDATOR_RETRY" : "MANUAL_COMPILER_RETRY";
    const job = await this.jobs.enqueue(figureId, actorUserId, {
      revisionId: revision.id,
      trigger,
      diagnosticBatchHash: batch.batchHash,
    });
    return {
      jobId: job.id,
      status: job.status,
      retryUsesAi: true,
      issueCount: batch.issues.length,
      estimatedMaxCostVnd: null,
    };
  }

  async createNewAi(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    dto: CreateNewStemFigureAiDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertMutationHead(figure, dto);
    const prepared = await this.prepareCreateNewAi(figure, dto);
    const { generationBrief, metadataRevision, referenceSnapshot } = prepared;
    const routeSnapshot = await this.resolveCreateAiRoute(dto);
    const sourceVersion = await this.nextSourceVersion(figureId);
    const revision = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.stemFigureRevision.create({
        data: {
          stemFigureId: figureId,
          sourceKind: "AI_TEX",
          origin: "ADMIN_REGENERATE",
          status: "QUEUED",
          sourceVersion,
          altText: metadataRevision.altText,
          caption: metadataRevision.caption,
          referenceSnapshotJson: referenceSnapshot,
          referenceSnapshotHash: hashFigureReferenceSnapshot(referenceSnapshot),
          generationBriefHash: hashAiValue(generationBrief),
          createdById: actorUserId,
        },
        select: { id: true },
      });
      await transaction.stemFigure.update({
        where: { id: figureId },
        data: { pendingRevisionId: created.id, status: "QUEUED" },
      });
      return created;
    });
    const job = await this.jobs.enqueue(figureId, actorUserId, {
      revisionId: revision.id,
      trigger: "ADMIN_REGENERATE",
      generationBrief,
      routeSnapshot,
      systemPrompt: dto.systemPrompt,
      userPrompt: dto.userPrompt,
    });
    return { jobId: job.id, status: job.status, estimatedMaxCostVnd: null };
  }

  async createNewAiForBlock(
    lessonId: string,
    actorUserId: string,
    dto: CreateStemFigureForBlockAiDto,
  ) {
    const prepared = await this.prepareCreateNewAiForBlock(lessonId, dto);
    const routeSnapshot = await this.resolveCreateAiRoute(dto);
    const sourceVersion = prepared.deletedFigure
      ? await this.nextSourceVersion(prepared.deletedFigure.id)
      : 1;
    const figure = await this.prisma.$transaction(async (transaction) => {
      const logicalFigure = prepared.deletedFigure
        ? await transaction.stemFigure.update({
            where: { id: prepared.deletedFigure.id },
            data: {
              deletedAt: null,
              lessonSummaryId: prepared.summary.id,
              aiGenerationId: prepared.summary.aiGenerationId,
              blockPath: dto.blockPath,
              figureIndex: prepared.figureIndex,
              localPlanId: prepared.localPlanId,
              planJson: prepared.plan,
              subjectKey: prepared.subject.key,
              subjectName: prepared.subject.name,
              subjectSlug: prepared.subject.slug,
              status: "QUEUED",
              currentRevisionId: null,
              pendingRevisionId: null,
              lastErrorCategory: null,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
            select: { id: true },
          })
        : await transaction.stemFigure.create({
            data: {
              lessonId,
              lessonSummaryId: prepared.summary.id,
              aiGenerationId: prepared.summary.aiGenerationId,
              blockPath: dto.blockPath,
              figureIndex: prepared.figureIndex,
              localPlanId: prepared.localPlanId,
              planJson: prepared.plan,
              subjectKey: prepared.subject.key,
              subjectName: prepared.subject.name,
              subjectSlug: prepared.subject.slug,
              status: "QUEUED",
              createdById: actorUserId,
            },
            select: { id: true },
          });
      const revision = await transaction.stemFigureRevision.create({
        data: {
          stemFigureId: logicalFigure.id,
          sourceKind: "AI_TEX",
          origin: "ADMIN_REGENERATE",
          status: "QUEUED",
          sourceVersion,
          altText: prepared.altText,
          caption: prepared.caption,
          referenceSnapshotJson: prepared.referenceSnapshot,
          referenceSnapshotHash: hashFigureReferenceSnapshot(
            prepared.referenceSnapshot,
          ),
          generationBriefHash: hashAiValue(prepared.generationBrief),
          createdById: actorUserId,
        },
        select: { id: true },
      });
      await transaction.stemFigure.update({
        where: { id: logicalFigure.id },
        data: { pendingRevisionId: revision.id },
      });
      return { id: logicalFigure.id, revisionId: revision.id };
    });
    const job = await this.jobs.enqueue(figure.id, actorUserId, {
      revisionId: figure.revisionId,
      trigger: "ADMIN_REGENERATE",
      generationBrief: prepared.generationBrief,
      routeSnapshot,
      systemPrompt: dto.systemPrompt,
      userPrompt: dto.userPrompt,
    });
    return {
      figureId: figure.id,
      jobId: job.id,
      status: job.status,
      estimatedMaxCostVnd: null,
    };
  }

  async previewCreateNewAi(
    lessonId: string,
    figureId: string,
    dto: CreateNewStemFigureAiDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertMutationHead(figure, dto);
    const { generationBrief } = await this.prepareCreateNewAi(figure, dto);
    return this.buildCreateNewAiPreview({
      subject: {
        key: lessonSummarySubjectKeySchema.parse(figure.subjectKey),
        name: figure.subjectName,
        slug: figure.subjectSlug,
      },
      generationBrief,
      dto,
    });
  }

  async previewCreateNewAiForBlock(
    lessonId: string,
    dto: CreateStemFigureForBlockAiDto,
  ) {
    const prepared = await this.prepareCreateNewAiForBlock(lessonId, dto);
    return this.buildCreateNewAiPreview({
      subject: prepared.subject,
      generationBrief: prepared.generationBrief,
      dto,
    });
  }

  private async buildCreateNewAiPreview(input: {
    subject: {
      key: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";
      name: string;
      slug: string;
    };
    generationBrief: StemFigureGenerationBrief;
    dto: CreateNewStemFigureAiDto | CreateStemFigureForBlockAiDto;
  }) {
    const { generationBrief } = input;
    const routeSnapshot = await this.resolveCreateAiRoute(input.dto);
    const preparedReferences = await prepareStemFigureProviderReferenceImages({
      assets: resolveStemFigureProviderReferenceAssets(generationBrief),
      downloadObject: (objectKey) => this.storage.downloadObject(objectKey),
    });
    const providerBrief = {
      ...generationBrief,
      referenceAssets: preparedReferences.assets,
    };
    const providerPreview = await this.repair.previewCreateInput({
      subject: input.subject,
      brief: providerBrief,
      routeSnapshot,
      systemPrompt: input.dto.systemPrompt,
      userPrompt: input.dto.userPrompt,
    });
    return {
      referenceImageMode: generationBrief.referenceImageMode,
      adminInstructions: generationBrief.adminInstructions,
      generationBrief: providerBrief,
      ...providerPreview,
      referenceImages: await Promise.all(
        providerBrief.referenceAssets.map(async (asset, order) => ({
          order,
          ...asset,
          mimeType:
            generationBrief.referenceAssets.find(
              (source) => source.objectKey === asset.objectKey,
            )?.mimeType ?? asset.mimeType,
          accessUrl: await this.storage
            .createSignedGetUrl(asset.objectKey)
            .catch(() => null),
        })),
      ),
    };
  }

  private async prepareCreateNewAiForBlock(
    lessonId: string,
    dto: CreateStemFigureForBlockAiDto,
  ) {
    if (dto.referenceImageMode !== StemFigureReferenceImageMode.NONE) {
      throwBadRequest(
        "STEM_FIGURE_BLOCK_CREATE_REFERENCE_MODE_INVALID",
        "Khối chưa có hình chỉ có thể tạo mới mà không dùng ảnh tham chiếu.",
      );
    }
    const summary = await this.prisma.lessonSummary.findFirst({
      where: { lessonId, deletedAt: null },
      select: {
        id: true,
        aiGenerationId: true,
        contentJson: true,
        lesson: {
          select: {
            learningPath: {
              select: {
                domain: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });
    const envelope = asRecord(summary?.contentJson);
    const output = stemFigureLessonContextSchema.safeParse(envelope.data);
    if (!summary || !output.success) {
      throwBadRequest(
        "STEM_FIGURE_LOCAL_CONTEXT_MISSING",
        "Không đọc được nội dung khối để tạo hình.",
      );
    }
    const blockContext = readBlockContext(output.data, dto.blockPath);
    if (!blockContext) {
      throwBadRequest(
        "STEM_FIGURE_BLOCK_NOT_FOUND",
        "Khối nội dung không còn tồn tại. Hãy tải lại trang.",
      );
    }
    assertStemFigureAiTargetBlock(blockContext.block, dto.targetMode);
    const expectedTargetFigureIndex =
      dto.targetMode === "SOLUTION" ? 1 : dto.targetMode === "QUESTION" ? 0 : null;
    const figureIndex = dto.figureIndex ?? expectedTargetFigureIndex ?? 0;
    if (
      expectedTargetFigureIndex !== null &&
      figureIndex !== expectedTargetFigureIndex
    ) {
      throwBadRequest(
        "STEM_FIGURE_AI_TARGET_SLOT_INVALID",
        dto.targetMode === "SOLUTION"
          ? "Hình lời giải phải dùng đúng vị trí hình lời giải."
          : "Hình đề bài phải dùng đúng vị trí hình đề bài.",
      );
    }
    const activeFigure = await this.prisma.stemFigure.findFirst({
      where: {
        lessonSummaryId: summary.id,
        blockPath: dto.blockPath,
        figureIndex,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (activeFigure) {
      throwBadRequest(
        "STEM_FIGURE_BLOCK_SLOT_ALREADY_EXISTS",
        "Khối đã có hình ở vị trí này. Hãy tải lại trước khi thao tác.",
      );
    }
    const deletedFigure = await this.prisma.stemFigure.findFirst({
      where: {
        lessonSummaryId: summary.id,
        blockPath: dto.blockPath,
        figureIndex,
        deletedAt: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        localPlanId: true,
        currentRevision: { select: { altText: true, caption: true } },
        pendingRevision: { select: { altText: true, caption: true } },
      },
    });
    const localPlanId =
      deletedFigure?.localPlanId ?? `F${String(figureIndex + 1).padStart(3, "0")}`;
    const plan = buildBlockFigurePlan(blockContext, localPlanId);
    const referenceSnapshot = emptyFigureReferenceSnapshot(localPlanId);
    const previousRevision =
      deletedFigure?.currentRevision ?? deletedFigure?.pendingRevision ?? null;
    const subject = resolveCourseSubject({
      domainName: summary.lesson.learningPath.domain.name,
      domainSlug: summary.lesson.learningPath.domain.slug,
    });
    const generationBrief = buildStemFigureGenerationBrief({
      output: output.data,
      blockPath: dto.blockPath,
      plan,
      targetGrade: output.data.targetGrade ?? null,
      referenceAssets: [],
      referenceImageMode: StemFigureReferenceImageMode.NONE,
      targetMode: dto.targetMode,
      adminInstructions: dto.adminInstructions,
    });
    return {
      summary,
      figureIndex,
      deletedFigure,
      localPlanId,
      plan,
      referenceSnapshot,
      subject,
      generationBrief,
      altText:
        previousRevision?.altText ??
        buildLessonSummaryFigureAltText({
          block: blockContext.block,
          sectionHeading: blockContext.sectionHeading,
        }),
      caption: previousRevision?.caption ?? null,
    };
  }

  private async resolveCreateAiRoute(
    dto: StemFigureAiCreateOptionsDto,
  ): Promise<AiFeatureRoute> {
    const baseRoute = await this.modelRouting.resolve(
      AiGenerationType.SUMMARY,
      AiModelPurpose.IMAGE,
    );
    if (!dto.model && (dto.temperature != null || dto.reasoningEffort != null)) {
      throwBadRequest(
        "AI_MODEL_REQUIRED_FOR_CONFIGURATION",
        "Vui lòng chọn model trước khi thay đổi Temperature hoặc Reasoning Effort.",
      );
    }

    let candidates = baseRoute.candidates;
    if (dto.model) {
      let selectedCandidate: ProviderRouteCandidate | null | undefined = candidates.find(
        (candidate) => candidate.model === dto.model && candidate.available,
      );
      if (!selectedCandidate) {
        selectedCandidate = await this.modelRouting.resolveCandidateByModel(dto.model);
      }
      if (!selectedCandidate?.available) {
        throwBadRequest(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không còn khả dụng cho chức năng tạo hình.",
          { model: dto.model },
        );
      }
      candidates = [selectedCandidate];
    }

    const selectedCandidate = candidates.find((candidate) => candidate.available);
    if (!selectedCandidate) {
      throwServiceUnavailable(
        "AI_PROVIDER_UNAVAILABLE",
        "Chưa có model khả dụng cho chức năng tạo hình.",
      );
    }
    const capability = readAiConfigurationCapability(selectedCandidate.capabilitiesJson);
    if (dto.temperature != null && capability !== "TEMPERATURE") {
      throwBadRequest(
        "AI_TEMPERATURE_NOT_SUPPORTED",
        "Model đã chọn không hỗ trợ cấu hình Temperature.",
        { model: selectedCandidate.model },
      );
    }
    if (dto.reasoningEffort) {
      const allowedLevels = readReasoningEffortLevels(selectedCandidate.capabilitiesJson);
      if (
        capability !== "REASONING_EFFORT" ||
        !allowedLevels.includes(dto.reasoningEffort)
      ) {
        throwBadRequest(
          "AI_REASONING_EFFORT_NOT_SUPPORTED",
          "Mức Reasoning Effort đã chọn không được cấu hình cho model này.",
          {
            model: selectedCandidate.model,
            reasoningEffort: dto.reasoningEffort,
            allowedReasoningEffortLevels: allowedLevels,
          },
        );
      }
    }

    return {
      ...baseRoute,
      model: selectedCandidate.model,
      candidates,
      temperature:
        capability === "TEMPERATURE" ? (dto.temperature ?? baseRoute.temperature) : null,
      reasoningEffort:
        capability === "REASONING_EFFORT"
          ? (dto.reasoningEffort ?? baseRoute.reasoningEffort)
          : null,
    };
  }

  private async prepareCreateNewAi(
    figure: StemFigureRecord,
    dto: CreateNewStemFigureAiDto,
  ) {
    if (
      dto.targetMode &&
      dto.referenceImageMode === StemFigureReferenceImageMode.SOURCE_CROP_ONLY
    ) {
      throwBadRequest(
        "STEM_FIGURE_AI_TARGET_REFERENCE_MODE_INVALID",
        "Tạo hình đề bài hoặc lời giải độc lập không dùng ảnh nguồn sách giáo khoa.",
      );
    }
    if (
      dto.targetMode &&
      figure.figureIndex !== (dto.targetMode === "SOLUTION" ? 1 : 0)
    ) {
      throwBadRequest(
        "STEM_FIGURE_AI_TARGET_SLOT_INVALID",
        dto.targetMode === "SOLUTION"
          ? "Hình lời giải phải dùng đúng vị trí hình lời giải."
          : "Hình đề bài phải dùng đúng vị trí hình đề bài.",
      );
    }
    const metadataRevision = figure.currentRevision ?? figure.pendingRevision;
    if (!metadataRevision) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_MISSING",
        "Hình không có revision để kế thừa metadata.",
      );
    }
    const plan = stemFigureRenderPlanSchema.safeParse(figure.planJson);
    if (!plan.success) {
      throwBadRequest(
        "STEM_FIGURE_LOCAL_CONTEXT_MISSING",
        "Không đọc được figure plan gốc để phân giải lại ảnh nguồn.",
      );
    }
    const wantsSource =
      dto.referenceImageMode === StemFigureReferenceImageMode.SOURCE_CROP_ONLY;
    const wantsCurrent =
      dto.referenceImageMode === StemFigureReferenceImageMode.CURRENT_ONLY;
    const storedReferenceSnapshot =
      readFigureReferenceSnapshot(metadataRevision.referenceSnapshotJson) ??
      emptyFigureReferenceSnapshot(plan.data.localId);
    const shouldResolveTextbookReference =
      wantsSource ||
      (wantsCurrent &&
        (storedReferenceSnapshot.assets.length > 0 ||
          plan.data.sourceReferences.length > 0));
    const referenceSnapshot = shouldResolveTextbookReference
      ? preserveHistoricalExactReferenceAssets({
          fresh: await this.resolveFreshReferenceSnapshot({
            figure,
            plan: plan.data,
          }),
          historical: storedReferenceSnapshot,
          plan: plan.data,
        })
      : storedReferenceSnapshot;
    if (wantsSource && referenceSnapshot.assets.length === 0) {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_REFERENCE_MISSING",
        "Không có ảnh gốc sách giáo khoa phù hợp cho chế độ đã chọn.",
      );
    }
    const currentLatexSource = wantsCurrent
      ? figure.currentRevision?.latexSource?.trim() || null
      : null;
    if (wantsCurrent && !currentLatexSource) {
      throwBadRequest(
        "STEM_FIGURE_CURRENT_LATEX_SOURCE_MISSING",
        "Hình hiện tại không có code TikZ để AI sửa.",
      );
    }
    const referenceAssets =
      wantsSource || wantsCurrent ? referenceSnapshot.assets : [];
    const generationBrief = await this.buildGenerationBrief({
      figure,
      referenceSnapshot,
      referenceAssets,
      referenceImageMode: dto.referenceImageMode,
      targetMode: dto.targetMode,
      currentLatexSource,
      adminInstructions: dto.adminInstructions,
      altText: metadataRevision.altText,
      caption: metadataRevision.caption,
    });
    return { generationBrief, metadataRevision, referenceSnapshot };
  }

  private async buildGenerationBrief(input: {
    figure: StemFigureRecord;
    referenceSnapshot: FigureReferenceSnapshot;
    altText: string;
    caption: string | null;
    referenceAssets?: Parameters<
      typeof buildStemFigureGenerationBrief
    >[0]["referenceAssets"];
    referenceImageMode?: Parameters<
      typeof buildStemFigureGenerationBrief
    >[0]["referenceImageMode"];
    targetMode?: Parameters<
      typeof buildStemFigureGenerationBrief
    >[0]["targetMode"];
    currentLatexSource?: string | null;
    adminInstructions?: string | null;
  }) {
    const { figure } = input;
    if (!figure.lessonSummaryId) {
      throwBadRequest(
        "STEM_FIGURE_LOCAL_CONTEXT_MISSING",
        "Hình không còn gắn với bản kiến thức để dựng lại context.",
      );
    }
    const summary = await this.prisma.lessonSummary.findUnique({
      where: { id: figure.lessonSummaryId },
      select: { contentJson: true },
    });
    const envelope = asRecord(summary?.contentJson);
    const output = stemFigureLessonContextSchema.safeParse(envelope.data);
    const plan = stemFigureRenderPlanSchema.safeParse(figure.planJson);
    if (!output.success || !plan.success) {
      throwBadRequest(
        "STEM_FIGURE_LOCAL_CONTEXT_MISSING",
        "Không đọc được block hoặc figure plan gốc để dựng lại hình.",
      );
    }
    const blockContext = readBlockContext(output.data, figure.blockPath);
    if (!blockContext) {
      throwBadRequest(
        "STEM_FIGURE_BLOCK_NOT_FOUND",
        "Khối nội dung không còn tồn tại. Hãy tải lại trang.",
      );
    }
    assertStemFigureAiTargetBlock(blockContext.block, input.targetMode);
    return buildStemFigureGenerationBrief({
      output: output.data,
      blockPath: figure.blockPath,
      plan: plan.data,
      targetGrade: output.data.targetGrade ?? null,
      referenceAssets: input.referenceAssets ?? input.referenceSnapshot.assets,
      referenceImageMode: input.referenceImageMode,
      targetMode: input.targetMode,
      currentLatexSource: input.currentLatexSource,
      adminInstructions: input.adminInstructions,
    });
  }

  private async resolveFreshReferenceSnapshot(input: {
    figure: StemFigureRecord;
    plan: ReturnType<typeof stemFigureRenderPlanSchema.parse>;
  }) {
    return this.resolveReferenceSnapshot({
      aiGenerationId: input.figure.aiGenerationId,
      lessonId: input.figure.lessonId,
      plan: input.plan,
    });
  }

  private async resolveReferenceSnapshot(input: {
    aiGenerationId: string | null;
    lessonId: string;
    plan: StemFigureRenderPlan;
  }) {
    if (!input.aiGenerationId) {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_MANIFEST_MISSING",
        "Hình không còn liên kết với lần sinh kiến thức gốc.",
      );
    }
    const generation = await this.prisma.aiGeneration.findUnique({
      where: { id: input.aiGenerationId },
      select: { inputMetaJson: true },
    });
    const generationInput = asRecord(generation?.inputMetaJson);
    const requestDraftId = generationInput.requestDraftId;
    if (typeof requestDraftId !== "string") {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_MANIFEST_MISSING",
        "Lần sinh kiến thức gốc không còn request draft để phân giải ảnh nguồn.",
      );
    }
    const requestDraft = await this.prisma.lessonSummaryRequestDraft.findFirst({
      where: {
        id: requestDraftId,
        lessonId: input.lessonId,
      },
      select: { manifestJson: true },
    });
    const manifest = lessonSourcePacketManifestSchema.safeParse(
      requestDraft?.manifestJson,
    );
    if (!manifest.success) {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_MANIFEST_MISSING",
        "Manifest nguồn của lần sinh kiến thức không còn hợp lệ.",
      );
    }
    return this.figureReferences.resolve({
      manifest: manifest.data,
      plan: input.plan,
    });
  }

  async delete(lessonId: string, figureId: string, dto: StemFigureMutationGuardDto) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertMutationHead(figure, dto);
    await this.prisma.$transaction(async (transaction) => {
      if (figure.lessonSummaryId) {
        const summary = await transaction.lessonSummary.findUnique({
          where: { id: figure.lessonSummaryId },
          select: { contentJson: true },
        });
        if (summary) {
          const content = removeFigureReference(summary.contentJson, figureId);
          await transaction.lessonSummary.update({
            where: { id: figure.lessonSummaryId },
            data: {
              contentJson: reconcileLessonSummaryReviewIssues(
                content as Record<string, unknown>,
              ) as Prisma.InputJsonValue,
            },
          });
        }
      }
      await transaction.stemFigure.update({
        where: { id: figureId },
        data: { deletedAt: new Date(), pendingRevisionId: null },
      });
    });
    return { deleted: true, figureId };
  }

  async replaceUpload(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    file: UploadedFileBuffer | undefined,
    dto: StemFigureMutationGuardDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertMutationHead(figure, dto);
    const metadataRevision = figure.currentRevision ?? figure.pendingRevision;
    if (!metadataRevision) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_MISSING",
        "Hình không có revision để kế thừa metadata.",
      );
    }
    if (!file) {
      throwBadRequest("STEM_FIGURE_UPLOAD_INVALID", "Vui lòng chọn ảnh thay thế.");
    }
    return this.persistRasterRevision({
      lessonId,
      figure,
      actorUserId,
      metadataRevision,
      bytes: file.buffer,
      declaredMimeType: file.mimetype,
      originalName: file.originalname,
      uploadSource: "stem-figure.replace-upload",
    });
  }

  async useSourceCrop(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    dto: UseStemFigureSourceCropDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertMutationHead(figure, dto);
    if (["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status)) {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_CROP_BUSY",
        "Hãy đợi revision đang sinh kết thúc trước khi dùng hình sách giáo khoa.",
      );
    }
    const metadataRevision = figure.pendingRevision ?? figure.currentRevision;
    if (!metadataRevision) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_MISSING",
        "Hình không có revision để kế thừa metadata.",
      );
    }
    const sourceReference = await this.resolveSourceReferenceSnapshot(
      figure.id,
      metadataRevision,
    );
    if (!sourceReference.hash || sourceReference.hash !== dto.sourceSnapshotHash) {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_SNAPSHOT_STALE",
        "Ảnh nguồn đã thay đổi. Hãy tải lại trước khi chọn hình sách giáo khoa.",
      );
    }
    const snapshot = sourceReference.snapshot;
    const asset = snapshot?.assets.find(
      (candidate) => candidate.objectKey === dto.sourceObjectKey,
    );
    if (!asset || asset.source !== "OCR_CROP") {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_CROP_INVALID",
        "Ảnh được chọn không phải crop sách giáo khoa hợp lệ của revision này.",
      );
    }
    let bytes: Buffer;
    try {
      bytes = await this.storage.downloadObject(asset.objectKey);
    } catch {
      throwServiceUnavailable(
        "STEM_FIGURE_SOURCE_CROP_UNAVAILABLE",
        "Không tải được crop sách giáo khoa. Vui lòng thử lại sau.",
      );
    }
    return this.persistRasterRevision({
      lessonId,
      figure,
      actorUserId,
      metadataRevision,
      bytes,
      declaredMimeType: asset.mimeType,
      originalName: `${asset.label || "textbook-crop"}.${mimeExtension(asset.mimeType)}`,
      uploadSource: "stem-figure.use-source-crop",
      sourceObjectKey: asset.objectKey,
      referenceSnapshot: snapshot,
      referenceSnapshotHash: sourceReference.hash,
      autoEnhance: dto.enhance,
    });
  }

  async promoteResolvedSourceCrop(input: {
    lessonId: string;
    figureId: string;
    actorUserId: string | null;
    assetObjectKey: string;
    referenceSnapshot: FigureReferenceSnapshot;
    referenceSnapshotHash: string;
    autoEnhance: boolean;
  }) {
    const figure = await this.requireFigure(input.lessonId, input.figureId);
    const metadataRevision = figure.pendingRevision ?? figure.currentRevision;
    if (!metadataRevision) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_MISSING",
        "Hình không có revision để kế thừa metadata.",
      );
    }
    const asset = input.referenceSnapshot.assets.find(
      (candidate) => candidate.objectKey === input.assetObjectKey,
    );
    if (!asset || asset.source !== "OCR_CROP") {
      throwBadRequest(
        "STEM_FIGURE_SOURCE_CROP_INVALID",
        "Ảnh tự động được chọn không phải crop sách giáo khoa hợp lệ.",
      );
    }
    let bytes: Buffer;
    try {
      bytes = await this.storage.downloadObject(asset.objectKey);
    } catch {
      throwServiceUnavailable(
        "STEM_FIGURE_SOURCE_CROP_UNAVAILABLE",
        "Không tải được crop sách giáo khoa để tự động gắn vào bài.",
      );
    }
    return this.persistRasterRevision({
      lessonId: input.lessonId,
      figure,
      actorUserId: input.actorUserId,
      metadataRevision,
      bytes,
      declaredMimeType: asset.mimeType,
      originalName: `${asset.label || "textbook-crop"}.${mimeExtension(asset.mimeType)}`,
      uploadSource: "lesson-summary.auto-source-crop",
      sourceObjectKey: asset.objectKey,
      referenceSnapshot: input.referenceSnapshot,
      referenceSnapshotHash: input.referenceSnapshotHash,
      autoEnhance: input.autoEnhance,
    });
  }

  private async persistRasterRevision(input: {
    lessonId: string;
    figure: Awaited<ReturnType<StemFiguresService["requireFigure"]>>;
    actorUserId: string | null;
    metadataRevision: NonNullable<StemFigureRecord["currentRevision"]>;
    bytes: Buffer;
    declaredMimeType: string;
    originalName: string;
    uploadSource:
      | "stem-figure.replace-upload"
      | "stem-figure.use-source-crop"
      | "lesson-summary.auto-source-crop";
    sourceObjectKey?: string;
    referenceSnapshot?: FigureReferenceSnapshot | null;
    referenceSnapshotHash?: string | null;
    autoEnhance?: boolean;
  }) {
    const maxBytes = Math.floor(
      this.config.get("MAX_IMAGE_UPLOAD_MB", { infer: true }) * 1024 * 1024,
    );
    if (input.bytes.length > maxBytes) {
      throwBadRequest("STEM_FIGURE_UPLOAD_INVALID", "Ảnh vượt dung lượng cho phép.");
    }
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(input.declaredMimeType)) {
      throwBadRequest(
        "STEM_FIGURE_UPLOAD_UNSUPPORTED",
        "Chỉ hỗ trợ JPEG, PNG hoặc WebP.",
      );
    }
    let metadata;
    try {
      metadata = await sharp(input.bytes, { failOn: "error" }).metadata();
    } catch {
      throwBadRequest(
        "STEM_FIGURE_UPLOAD_INVALID",
        "File ảnh không giải mã được hoặc sai định dạng.",
      );
    }
    if (
      !metadata.width ||
      !metadata.height ||
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      metadata.width > 12_000 ||
      metadata.height > 12_000 ||
      metadata.width * metadata.height >
        (input.autoEnhance ? STEM_FIGURE_RASTER_EDIT_MAX_PIXELS : 40_000_000)
    ) {
      throwBadRequest(
        "STEM_FIGURE_UPLOAD_INVALID",
        "Kích thước hoặc định dạng ảnh không hợp lệ.",
      );
    }
    const decodedMimeType =
      metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : null;
    if (decodedMimeType !== input.declaredMimeType) {
      throwBadRequest(
        "STEM_FIGURE_UPLOAD_INVALID",
        "MIME khai báo không khớp định dạng ảnh thực tế.",
      );
    }
    const sourceReference =
      input.referenceSnapshot === undefined
        ? await this.resolveSourceReferenceSnapshot(
            input.figure.id,
            input.metadataRevision,
          )
        : {
            snapshot: input.referenceSnapshot,
            hash: input.referenceSnapshotHash ?? null,
          };
    let rasterPipeline = sharp(input.bytes, { failOn: "error" }).rotate();
    if (input.autoEnhance) {
      rasterPipeline = applyConservativeRasterEnhancement(rasterPipeline);
    }
    const normalized = await rasterPipeline
      .webp(input.autoEnhance ? { lossless: true, effort: 4 } : { quality: 92 })
      .toBuffer();
    const checksum = createHash("sha256").update(normalized).digest("hex");
    const sourceVersion = await this.nextSourceVersion(input.figure.id);
    const objectKey = this.storage.createObjectKey({
      environment: this.config.get("NODE_ENV", { infer: true }),
      originalName: `stem-figure-${input.figure.id}-${sourceVersion}.webp`,
      purpose: FilePurpose.AI_DIAGRAM,
    });
    await this.storage.uploadBuffer(objectKey, normalized, "image/webp");
    try {
      await this.prisma.$transaction(async (transaction) => {
        const storedFile = await transaction.file.create({
          data: {
            provider: this.storage.fileProvider,
            purpose: FilePurpose.AI_DIAGRAM,
            bucket: this.storage.bucketName,
            objectKey,
            originalName: `stem-figure-${input.figure.id}.webp`,
            mimeType: "image/webp",
            sizeBytes: BigInt(normalized.length),
            visibility: FileVisibility.PUBLIC,
            status: FileStatus.READY,
            uploadedById: input.actorUserId,
            publicUrl: this.storage.getPublicUrl(objectKey),
            checksum,
            metadataJson: {
              uploadSource: input.uploadSource,
              originalMimeType: input.declaredMimeType,
              originalName: input.originalName,
              ...(input.sourceObjectKey
                ? { textbookSourceObjectKey: input.sourceObjectKey }
                : {}),
              ...(input.autoEnhance
                ? {
                    rasterCleanupPipelineVersion:
                      STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
                    rasterCleanupOperations: ["ENHANCE"],
                    automaticEnhancement: true,
                  }
                : {}),
              width: metadata.width,
              height: metadata.height,
            },
          },
          select: { id: true },
        });
        const revision = await transaction.stemFigureRevision.create({
          data: {
            stemFigureId: input.figure.id,
            sourceKind: "ADMIN_UPLOAD",
            origin: "ADMIN_UPLOAD",
            status: "SUCCEEDED",
            sourceVersion,
            altText: input.metadataRevision.altText,
            caption: input.metadataRevision.caption,
            deliveryFileId: storedFile.id,
            sanitizedSvgHash: checksum,
            referenceSnapshotJson: sourceReference.snapshot ?? undefined,
            referenceSnapshotHash: sourceReference.hash,
            createdById: input.actorUserId,
            finishedAt: new Date(),
          },
          select: { id: true },
        });
        await transaction.stemFigure.update({
          where: { id: input.figure.id },
          data: {
            status: StemFigureStatus.SUCCEEDED,
            currentRevisionId: revision.id,
            pendingRevisionId: null,
            lastErrorCategory: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        if (input.figure.lessonSummaryId) {
          const summary = await transaction.lessonSummary.findUnique({
            where: { id: input.figure.lessonSummaryId },
            select: { contentJson: true },
          });
          if (summary) {
            const plan = stemFigureRenderPlanSchema.parse(input.figure.planJson);
            const content = ensureStemFigureSummaryReference(summary.contentJson, {
              blockPath: input.figure.blockPath,
              figureIndex: input.figure.figureIndex,
              figureId: input.figure.id,
              figureOrigin: plan.figureOrigin,
              altText: input.metadataRevision.altText,
              caption: input.metadataRevision.caption,
            });
            await transaction.lessonSummary.update({
              where: { id: input.figure.lessonSummaryId },
              data: {
                contentJson: reconcileLessonSummaryReviewIssues(
                  content as Record<string, unknown>,
                ) as Prisma.InputJsonValue,
              },
            });
          }
        }
      });
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
    return this.getForAdmin(input.lessonId, input.figure.id);
  }

  private async nextSourceVersion(figureId: string) {
    const latest = await this.prisma.stemFigureRevision.findFirst({
      where: { stemFigureId: figureId },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    return (latest?.sourceVersion ?? 0) + 1;
  }

  private async resolveSourceReferenceSnapshot(
    figureId: string,
    revision: {
      referenceSnapshotJson: unknown;
      referenceSnapshotHash: string | null;
    },
  ) {
    const directSnapshot = readFigureReferenceSnapshot(revision.referenceSnapshotJson);
    if (directSnapshot && revision.referenceSnapshotHash) {
      return { snapshot: directSnapshot, hash: revision.referenceSnapshotHash };
    }
    const historicalRevision = await this.prisma.stemFigureRevision.findFirst({
      where: {
        stemFigureId: figureId,
        referenceSnapshotHash: { not: null },
      },
      orderBy: { sourceVersion: "desc" },
      select: {
        referenceSnapshotJson: true,
        referenceSnapshotHash: true,
      },
    });
    return {
      snapshot: readFigureReferenceSnapshot(historicalRevision?.referenceSnapshotJson),
      hash: historicalRevision?.referenceSnapshotHash ?? null,
    };
  }

  private assertMutationHead(
    figure: Awaited<ReturnType<typeof this.requireFigure>>,
    dto: StemFigureMutationGuardDto,
  ) {
    const working = figure.pendingRevision ?? figure.currentRevision;
    if (
      figure.currentRevisionId !== (dto.baseCurrentRevisionId ?? null) ||
      figure.pendingRevisionId !== (dto.basePendingRevisionId ?? null) ||
      working?.sourceVersion !== dto.baseSourceVersion
    ) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_CONFLICT",
        "Hình đã có revision mới. Hãy tải lại trước khi thao tác.",
      );
    }
  }

  private async requireFigure(lessonId: string, figureId: string) {
    const record = await this.prisma.stemFigure.findFirst({
      where: { id: figureId, lessonId, deletedAt: null },
      select: stemFigureSelect,
    });
    if (!record) {
      throwNotFound("STEM_FIGURE_NOT_FOUND", "Không tìm thấy hình STEM.");
    }
    return record;
  }
}

function mimeExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readFigureReferenceSnapshot(value: unknown): FigureReferenceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<FigureReferenceSnapshot>;
  return snapshot.version === 1 &&
    typeof snapshot.localPlanId === "string" &&
    Array.isArray(snapshot.assets) &&
    Array.isArray(snapshot.references)
    ? (snapshot as FigureReferenceSnapshot)
    : null;
}

function emptyFigureReferenceSnapshot(localPlanId: string): FigureReferenceSnapshot {
  return {
    version: 1,
    localPlanId,
    status: "not_found",
    assets: [],
    references: [],
  };
}

export function preserveHistoricalExactReferenceAssets(input: {
  fresh: FigureReferenceSnapshot;
  historical: FigureReferenceSnapshot;
  plan: StemFigureRenderPlan;
}): FigureReferenceSnapshot {
  const exactReferenceKeys = new Set(
    input.plan.sourceReferences.flatMap((reference) => {
      const label = normalizeReferenceLabel(reference.figureLabel);
      return label
        ? [
            referenceIdentity({
              packetPageNumber: reference.packetPageNumber,
              label,
            }),
          ]
        : [];
    }),
  );
  if (exactReferenceKeys.size === 0) return input.fresh;

  const assets = [...input.fresh.assets];
  const seenObjectKeys = new Set(assets.map((asset) => asset.objectKey));
  const exactCropCounts = new Map<string, number>();
  for (const asset of assets) {
    if (asset.source !== "OCR_CROP") continue;
    const key = referenceIdentity({
      packetPageNumber: asset.packetPageNumber,
      label: normalizeReferenceLabel(asset.label),
    });
    exactCropCounts.set(key, (exactCropCounts.get(key) ?? 0) + 1);
  }

  for (const asset of input.historical.assets) {
    if (assets.length >= 6) break;
    if (asset.source !== "OCR_CROP") continue;
    const key = referenceIdentity({
      packetPageNumber: asset.packetPageNumber,
      label: normalizeReferenceLabel(asset.label),
    });
    if (
      !exactReferenceKeys.has(key) ||
      seenObjectKeys.has(asset.objectKey) ||
      (exactCropCounts.get(key) ?? 0) >= 4
    ) {
      continue;
    }
    assets.push(asset);
    seenObjectKeys.add(asset.objectKey);
    exactCropCounts.set(key, (exactCropCounts.get(key) ?? 0) + 1);
  }

  return assets.length === input.fresh.assets.length
    ? input.fresh
    : {
        ...input.fresh,
        status: assets.length > 1 ? "ambiguous" : input.fresh.status,
        assets,
      };
}

function referenceIdentity(input: { packetPageNumber: number | null; label: string }) {
  return `${input.packetPageNumber ?? "none"}|${input.label}`;
}

function normalizeReferenceLabel(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/gu, "d")
    .trim()
    .toLowerCase();
}

type BlockFigureContext = {
  sectionHeading: string;
  block: Record<string, unknown>;
};

function readBlockContext(
  output: StemFigureLessonContext,
  blockPath: string,
): BlockFigureContext | null {
  const match = blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match) return null;
  const section = output.sections[Number(match[1])];
  const block = section?.blocks[Number(match[2])];
  if (!section || !block) return null;
  return {
    sectionHeading: section.displayHeading,
    block: JSON.parse(JSON.stringify(block)) as Record<string, unknown>,
  };
}

function buildBlockFigurePlan(
  context: BlockFigureContext,
  localId: string,
): StemFigureRenderPlan {
  return {
    figurePlanContractVersion: 3,
    localId,
    figureOrigin: "GENERATED_FROM_BRIEF",
    // A content page proves where the block came from; it does not prove that
    // the block has a textbook figure. Only Stage 1 may attach figure-specific
    // sourceReferences. An admin-authored figure starts without visual evidence.
    sourceReferences: [],
  };
}

function assertStemFigureAiTargetBlock(
  block: Record<string, unknown>,
  targetMode: "QUESTION" | "SOLUTION" | null | undefined,
) {
  if (!targetMode) return;
  if (block.type !== "example" && block.type !== "exercise") {
    throwBadRequest(
      "STEM_FIGURE_AI_TARGET_BLOCK_INVALID",
      "Chỉ khối Ví dụ hoặc Bài tập mới có hình đề bài và hình lời giải riêng.",
    );
  }
  if (
    targetMode === "SOLUTION" &&
    (typeof block.solution !== "string" || block.solution.trim().length === 0)
  ) {
    throwBadRequest(
      "STEM_FIGURE_SOLUTION_TEXT_MISSING",
      "Cần có lời giải bằng chữ trước khi tạo hình cho lời giải.",
    );
  }
}

function createStarterFigureSource() {
  return [
    "\\begin{tikzpicture}[x=1cm,y=1cm,>=Latex]",
    "  % Viết mã vẽ hình tại đây",
    "\\end{tikzpicture}",
  ].join("\n");
}

function removeFigureReference(value: Prisma.JsonValue, figureId: string) {
  const copy = structuredClone(value) as unknown;
  visit(copy);
  return copy;

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (let index = node.length - 1; index >= 0; index -= 1) {
        const item = node[index];
        if (isFigureReference(item, figureId)) {
          node.splice(index, 1);
          continue;
        }
        visit(item);
      }
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (
      record.visual &&
      typeof record.visual === "object" &&
      (record.visual as Record<string, unknown>).figureId === figureId
    ) {
      record.visual = { kind: "NONE" };
    }
    Object.values(record).forEach(visit);
  }
}

function isFigureReference(value: unknown, figureId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "TEX_FIGURE" && record.figureId === figureId;
}

function readAiConfigurationCapability(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const capability = (value as Record<string, unknown>).aiConfiguration;
  return capability === "TEMPERATURE" ||
    capability === "REASONING_EFFORT" ||
    capability === "NONE"
    ? capability
    : null;
}

function readReasoningEffortLevels(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const levels = (value as Record<string, unknown>).reasoningEffortLevels;
  return Array.isArray(levels)
    ? levels.filter((level): level is string => typeof level === "string")
    : [];
}
