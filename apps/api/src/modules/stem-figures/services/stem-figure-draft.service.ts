import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StemFigureRevisionStatus } from "@prisma/client";

import { throwBadRequest, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";
import type {
  ApplyStemFigureDraftDto,
  CompileStemFigureDraftDto,
} from "#api/modules/stem-figures/dto/stem-figure-revision.dto";
import { StemFigureArtifactService } from "#api/modules/stem-figures/services/stem-figure-artifact.service";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import { SvgValidatorService } from "#api/modules/stem-figures/services/svg-validator.service";
import { TexRendererClientService } from "#api/modules/stem-figures/services/tex-renderer-client.service";
import { createStemFigureDiagnosticBatch } from "#api/modules/stem-figures/utils/stem-figure-diagnostics";
import { validateTexSourcePolicy } from "#api/modules/stem-figures/utils/tex-source-policy";

@Injectable()
export class StemFigureDraftService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
    @Inject(TexRendererClientService)
    private readonly renderer: TexRendererClientService,
    @Inject(SvgValidatorService)
    private readonly validator: SvgValidatorService,
    @Inject(StemFigureArtifactService)
    private readonly artifacts: StemFigureArtifactService,
  ) {}

  async compile(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    dto: CompileStemFigureDraftDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const source = dto.latexSource.trim();
    const subjectKey = lessonSummarySubjectKeySchema.parse(figure.subjectKey);
    const policyIssues = validateTexSourcePolicy(
      source,
      this.config.get("TEX_RENDER_MAX_SOURCE_BYTES", { infer: true }),
      subjectKey,
    );
    if (policyIssues.length > 0) {
      throwBadRequest(
        "TEX_SOURCE_POLICY_REJECTED",
        "Mã TeX phải là figure snippet hợp lệ trước khi tạo revision biên dịch.",
        { issues: policyIssues },
      );
    }

    const [latestRevision, sourceReferenceRevision] = await Promise.all([
      this.prisma.stemFigureRevision.findFirst({
        where: { stemFigureId: figure.id },
        orderBy: { sourceVersion: "desc" },
        select: { sourceVersion: true },
      }),
      this.prisma.stemFigureRevision.findFirst({
        where: {
          stemFigureId: figure.id,
          referenceSnapshotHash: { not: null },
        },
        orderBy: { sourceVersion: "desc" },
        select: {
          referenceSnapshotJson: true,
          referenceSnapshotHash: true,
        },
      }),
    ]);
    const sourceVersion = Math.max(
      dto.sourceVersion + 1,
      (latestRevision?.sourceVersion ?? 0) + 1,
    );
    const revision = await this.prisma.stemFigureRevision.create({
      data: {
        stemFigureId: figure.id,
        sourceKind: "AI_TEX",
        origin: "ADMIN_EDIT",
        status: "RENDERING",
        latexSource: source,
        sourceHash: StemFigureJobService.sourceHash(source),
        sourceVersion,
        altText: dto.altText.trim(),
        caption: dto.caption?.trim() || null,
        ...(sourceReferenceRevision?.referenceSnapshotJson
          ? {
              referenceSnapshotJson: sourceReferenceRevision.referenceSnapshotJson,
              referenceSnapshotHash: sourceReferenceRevision.referenceSnapshotHash,
            }
          : {}),
        createdById: actorUserId,
      },
    });
    const attempt = await this.prisma.stemFigureRenderAttempt.create({
      data: {
        stemFigureId: figure.id,
        revisionId: revision.id,
        attemptNumber: await this.nextAttemptNumber(figure.id),
        sourceVersion,
        sourceHash: revision.sourceHash!,
        kind: "COMPILE_PREVIEW",
      },
      select: { id: true },
    });
    const rendered = await this.renderer.render(source, subjectKey);
    if (!rendered.ok) {
      const category = rendered.category === "SOURCE" ? "COMPILER" : "INFRASTRUCTURE";
      const batch = createStemFigureDiagnosticBatch({
        attemptId: attempt.id,
        sourceVersion,
        sourceHash: revision.sourceHash!,
        category,
        issues: rendered.issues,
        rawLogExcerpt: rendered.log,
        collectionComplete: rendered.collectionComplete,
      });
      await this.prisma.$transaction([
        this.prisma.stemFigureRenderAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "FAILED",
            errorCategory: category,
            errorCode: rendered.code,
            compileLog: rendered.log,
            diagnosticBatch: batch,
            diagnosticBatchHash: batch.batchHash,
            collectionComplete: batch.collectionComplete,
            finishedAt: new Date(),
          },
        }),
        this.prisma.stemFigureRevision.update({
          where: { id: revision.id },
          data: {
            status: "FAILED",
            lastErrorCategory: category,
            lastErrorCode: rendered.code,
            lastErrorMessage: rendered.log,
            finishedAt: new Date(),
          },
        }),
        this.prisma.stemFigure.update({
          where: { id: figure.id },
          data: {
            pendingRevisionId: revision.id,
            status: "FAILED",
            lastErrorCategory: category,
            lastErrorCode: rendered.code,
            lastErrorMessage: rendered.log,
          },
        }),
      ]);
      return {
        revisionId: revision.id,
        status: "FAILED",
        sourceVersion,
        diagnosticBatch: batch,
      };
    }

    const validation = this.validator.validate(rendered.svg);
    if (!validation.ok) {
      const batch = createStemFigureDiagnosticBatch({
        attemptId: attempt.id,
        sourceVersion,
        sourceHash: revision.sourceHash!,
        category: "VALIDATOR",
        issues: validation.issues,
        rawLogExcerpt: JSON.stringify(validation.issues),
        collectionComplete: true,
      });
      await this.prisma.$transaction([
        this.prisma.stemFigureRenderAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "FAILED",
            errorCategory: "VALIDATOR",
            errorCode: "SVG_VALIDATION_FAILED",
            diagnosticBatch: batch,
            diagnosticBatchHash: batch.batchHash,
            validatorIssues: batch.issues,
            finishedAt: new Date(),
          },
        }),
        this.prisma.stemFigureRevision.update({
          where: { id: revision.id },
          data: {
            status: "NEEDS_REVIEW",
            rendererVersion: rendered.rendererVersion,
            validatorVersion: validation.validatorVersion,
            lastErrorCategory: "VALIDATOR",
            lastErrorCode: "SVG_VALIDATION_FAILED",
            lastErrorMessage: JSON.stringify(validation.issues),
            finishedAt: new Date(),
          },
        }),
        this.prisma.stemFigure.update({
          where: { id: figure.id },
          data: { pendingRevisionId: revision.id, status: "NEEDS_REVIEW" },
        }),
      ]);
      return {
        revisionId: revision.id,
        status: "NEEDS_REVIEW",
        sourceVersion,
        diagnosticBatch: batch,
      };
    }

    await this.prisma.$transaction([
      this.prisma.stemFigureRenderAttempt.update({
        where: { id: attempt.id },
        data: { status: "SUCCEEDED", finishedAt: new Date() },
      }),
      this.prisma.stemFigureRevision.update({
        where: { id: revision.id },
        data: {
          status: "DRAFT_READY",
          previewSvg: validation.sanitizedSvg,
          sanitizedSvgHash: validation.sha256,
          rendererVersion: rendered.rendererVersion,
          validatorVersion: validation.validatorVersion,
        },
      }),
      this.prisma.stemFigure.update({
        where: { id: figure.id },
        data: {
          pendingRevisionId: revision.id,
          ...(figure.currentRevisionId ? { status: "SUCCEEDED" } : {}),
          lastErrorCategory: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      }),
    ]);
    return {
      revisionId: revision.id,
      status: "DRAFT_READY",
      sourceVersion,
      previewSvg: validation.sanitizedSvg,
    };
  }

  async apply(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    dto: ApplyStemFigureDraftDto,
  ) {
    const figure = await this.requireFigure(lessonId, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const metadata = {
      altText: dto.altText.trim(),
      caption: dto.caption?.trim() || null,
    };
    if (dto.revisionId === figure.currentRevisionId) {
      await this.artifacts.updateCurrentMetadata({
        figureId,
        revisionId: dto.revisionId,
        ...metadata,
      });
      return { status: "SUCCEEDED", revisionId: dto.revisionId };
    }
    const revision = await this.prisma.stemFigureRevision.findFirst({
      where: {
        id: dto.revisionId,
        stemFigureId: figureId,
        sourceVersion: dto.sourceVersion,
        status: StemFigureRevisionStatus.DRAFT_READY,
      },
      select: { previewSvg: true },
    });
    if (!revision?.previewSvg) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_CONFLICT",
        "Bản chỉnh sửa chưa sẵn sàng để áp dụng.",
      );
    }
    await this.artifacts.promoteSvg({
      figureId,
      revisionId: dto.revisionId,
      svg: revision.previewSvg,
      actorUserId,
      expectedCurrentRevisionId: dto.baseRevisionId ?? null,
      automatic: false,
      metadata,
    });
    return { status: "SUCCEEDED", revisionId: dto.revisionId };
  }

  private async requireFigure(lessonId: string, figureId: string) {
    const record = await this.prisma.stemFigure.findFirst({
      where: { id: figureId, lessonId, deletedAt: null },
      select: { id: true, subjectKey: true, currentRevisionId: true },
    });
    if (!record) {
      throwNotFound("STEM_FIGURE_NOT_FOUND", "Không tìm thấy hình STEM.");
    }
    return record;
  }

  private assertBaseRevision(
    current: string | null,
    expected: string | null | undefined,
  ) {
    if (current !== (expected ?? null)) {
      throwBadRequest(
        "STEM_FIGURE_REVISION_CONFLICT",
        "Hình đã có phiên bản mới. Hãy tải lại trước khi áp dụng.",
      );
    }
  }

  private async nextAttemptNumber(figureId: string) {
    const aggregate = await this.prisma.stemFigureRenderAttempt.aggregate({
      where: { stemFigureId: figureId },
      _max: { attemptNumber: true },
    });
    return (aggregate._max.attemptNumber ?? 0) + 1;
  }
}
