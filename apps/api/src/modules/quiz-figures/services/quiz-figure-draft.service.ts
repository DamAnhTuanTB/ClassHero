import { Inject, Injectable } from "@nestjs/common";
import { QuizFigureRevisionStatus } from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  ApplyQuizFigureDraftDto,
  CompileQuizFigureDraftDto,
} from "#api/modules/quiz-figures/dto/quiz-figure-revision.dto";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import { QuizTexRendererClientService } from "#api/modules/quiz-figures/services/quiz-tex-renderer-client.service";
import {
  assertQuizFigureLatexSource,
  sanitizeQuizFigureSvg,
} from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

@Injectable()
export class QuizFigureDraftService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuizTexRendererClientService)
    private readonly renderer: QuizTexRendererClientService,
    @Inject(QuizFigureArtifactService)
    private readonly artifacts: QuizFigureArtifactService,
  ) {}

  async compile(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: CompileQuizFigureDraftDto,
  ) {
    const figure = await this.requireFigure(questionId, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const latexSource = dto.latexSource.trim();
    try {
      assertQuizFigureLatexSource(latexSource);
    } catch (error) {
      throw badRequestException(
        "QUIZ_FIGURE_SOURCE_POLICY_REJECTED",
        "Mã TeX phải là figure snippet hợp lệ trước khi biên dịch.",
        { message: error instanceof Error ? error.message : String(error) },
      );
    }
    const rendered = await this.renderer.render(latexSource, figure.subjectKey);
    if (!rendered.ok) {
      throw badRequestException(rendered.code, "Mã hình chưa biên dịch thành công.", {
        category: rendered.category,
        log: rendered.log,
      });
    }
    let previewSvg: string;
    try {
      previewSvg = sanitizeQuizFigureSvg(rendered.svg);
    } catch (error) {
      throw badRequestException(
        "QUIZ_FIGURE_SVG_INVALID",
        "SVG xem trước không đạt chính sách an toàn.",
        { message: error instanceof Error ? error.message : String(error) },
      );
    }
    const latest = await this.prisma.quizFigureRevision.findFirst({
      where: { quizFigureId: figure.id },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    const sourceVersion = Math.max(
      dto.sourceVersion + 1,
      (latest?.sourceVersion ?? 0) + 1,
    );
    const revision = await this.prisma.quizFigureRevision.create({
      data: {
        quizFigureId: figure.id,
        sourceKind: "AI_TEX",
        origin: "ADMIN_EDIT",
        status: "DRAFT_READY",
        latexSource,
        sourceHash: QuizFigureJobService.sourceHash(latexSource),
        sourceVersion,
        altText: dto.altText.trim(),
        caption: dto.caption?.trim() || null,
        previewSvg,
        sanitizedSvgHash: QuizFigureJobService.sourceHash(previewSvg),
        rendererVersion: rendered.rendererVersion,
        validatorVersion: "quiz-svg-policy-v1",
        createdById: actorUserId,
      },
      select: { id: true },
    });
    await this.prisma.quizFigure.update({
      where: { id: figure.id },
      data: { pendingRevisionId: revision.id },
    });
    return {
      revisionId: revision.id,
      status: "DRAFT_READY" as const,
      sourceVersion,
      previewSvg,
    };
  }

  async apply(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: ApplyQuizFigureDraftDto,
  ) {
    const figure = await this.requireFigure(questionId, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const revision = await this.prisma.quizFigureRevision.findFirst({
      where: {
        id: dto.revisionId,
        quizFigureId: figure.id,
        sourceVersion: dto.sourceVersion,
        status: QuizFigureRevisionStatus.DRAFT_READY,
      },
      select: { previewSvg: true },
    });
    if (!revision?.previewSvg) {
      throw badRequestException(
        "QUIZ_FIGURE_REVISION_CONFLICT",
        "Bản chỉnh sửa chưa sẵn sàng để áp dụng.",
      );
    }
    await this.prisma.quizFigure.update({
      where: { id: figure.id },
      data: { pendingRevisionId: dto.revisionId },
    });
    await this.artifacts.promoteSvg({
      figureId: figure.id,
      revisionId: dto.revisionId,
      svg: revision.previewSvg,
      actorUserId,
    });
    return { status: "SUCCEEDED" as const, revisionId: dto.revisionId };
  }

  private async requireFigure(questionId: string, figureId: string) {
    const figure = await this.prisma.quizFigure.findFirst({
      where: { id: figureId, quizQuestionId: questionId, deletedAt: null },
      select: { id: true, subjectKey: true, currentRevisionId: true },
    });
    if (!figure) {
      throw notFoundException("QUIZ_FIGURE_NOT_FOUND", "Không tìm thấy hình Quiz.");
    }
    return figure;
  }

  private assertBaseRevision(current: string | null, expected?: string | null) {
    if (current !== (expected ?? null)) {
      throw badRequestException(
        "QUIZ_FIGURE_REVISION_CONFLICT",
        "Hình đã có phiên bản mới. Hãy tải lại trước khi áp dụng.",
      );
    }
  }
}
