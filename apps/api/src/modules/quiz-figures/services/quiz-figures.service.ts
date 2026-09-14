import { Inject, Injectable } from "@nestjs/common";
import { AiModelPurpose, Prisma, QuizFigureRole } from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  AiProviderCallService,
  type ResolvedAiStructuredRequestPreview,
} from "#api/modules/ai/services/ai-provider-call.service";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import {
  buildOpenAiStructuredResponseRequest,
  OPENAI_PREVIEW_BINARY_DATA,
} from "#api/modules/ai/utils/openai-response-request";
import type {
  ApplyQuizFigureDraftDto,
  CompileQuizFigureDraftDto,
  CreateQuestionQuizFigureAiDto,
  CreateQuizFigureAiDto,
  QuizFigureAiTargetMode,
  QuizFigureRevisionGuardDto,
  RefineQuizFigureWithAiDto,
  UpdateQuizFigureCaptionDto,
} from "#api/modules/quiz-figures/dto/quiz-figure-revision.dto";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";
import { QuizFigureDraftService } from "#api/modules/quiz-figures/services/quiz-figure-draft.service";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import {
  buildQuizFigureRefinementInput,
  buildQuestionFigureInput,
  buildSolutionFigureInput,
  generatedQuizFigureRefinementSchema,
  generatedQuizQuestionFigureSchema,
  generatedQuizSolutionFigureSchema,
  quizFigurePlanSchema,
  readQuizFigureTargetGrade,
  resolveQuizFigureSystemPrompt,
  type QuizFigurePlan,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { serializeQuizRichText } from "#api/modules/quiz/utils/quiz-generation-output";
import { resolveQuizSubject } from "#api/modules/quiz/utils/quiz-subject";
import { readQuizGenerationQuestionReference } from "#api/modules/quiz/utils/quiz-generation-output";
import { FilesService } from "#api/modules/files/services/files.service";
import {
  quizFigureTargetCreateData,
  quizFigureTargetFeature,
  quizFigureTargetLabel,
  quizFigureTargetWhere,
  type QuizFigureTarget,
} from "#api/modules/quiz-figures/types/quiz-figure-target";

const questionFigureAuthoringSelect = {
  id: true,
  lessonId: true,
  questionType: true,
  questionJson: true,
  sourceMetadataJson: true,
  explanation: { select: { contentJson: true } },
  lesson: {
    select: {
      learningPath: {
        select: {
          domain: { select: { name: true, slug: true } },
          targetAudiences: { select: { targetAudience: { select: { grade: true } } } },
        },
      },
    },
  },
  figures: {
    select: {
      id: true,
      role: true,
      deletedAt: true,
      pendingRevisionId: true,
      planJson: true,
      subjectKey: true,
      subjectName: true,
      subjectSlug: true,
      currentRevisionId: true,
      currentRevision: {
        select: {
          id: true,
          status: true,
          sourceKind: true,
          origin: true,
          latexSource: true,
          altText: true,
          caption: true,
          deliveryFile: { select: { mimeType: true } },
        },
      },
    },
  },
} satisfies Prisma.QuizQuestionSelect & Prisma.TestQuestionSelect;

@Injectable()
export class QuizFiguresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuizFigureArtifactService)
    private readonly artifacts: QuizFigureArtifactService,
    @Inject(QuizFigureDraftService)
    private readonly drafts: QuizFigureDraftService,
    @Inject(QuizFigureJobService)
    private readonly jobs: QuizFigureJobService,
    @Inject(AiProviderCallService)
    private readonly provider: AiProviderCallService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  async attachAdminUpload(input: {
    questionId: string;
    role: QuizFigureRole;
    fileId: string;
    altText: string;
    caption?: string | null;
    actorUserId: string;
    target?: QuizFigureTarget;
  }) {
    const target = input.target ?? {
      kind: "QUIZ" as const,
      questionId: input.questionId,
    };
    const question = await this.findQuestion(target);
    if (!question) {
      throw notFoundException(
        `${target.kind}_QUESTION_NOT_FOUND`,
        `Không tìm thấy câu ${quizFigureTargetLabel(target)}.`,
      );
    }
    const create = {
      lessonId: question.lessonId,
      ...quizFigureTargetCreateData(target),
      role: input.role,
      subjectKey: "GENERAL",
      subjectName: "Tổng quát",
      subjectSlug: "general",
      status: "QUEUED" as const,
      createdById: input.actorUserId,
    };
    const persisted =
      target.kind === "QUIZ"
        ? await this.prisma.quizFigure.upsert({
            where: {
              quizQuestionId_role: {
                quizQuestionId: target.questionId,
                role: input.role,
              },
            },
            update: { deletedAt: null },
            create,
            select: { id: true },
          })
        : await this.prisma.quizFigure.upsert({
            where: {
              testQuestionId_role: {
                testQuestionId: target.questionId,
                role: input.role,
              },
            },
            update: { deletedAt: null },
            create,
            select: { id: true },
          });
    await this.artifacts.attachAdminUpload({
      figureId: persisted.id,
      fileId: input.fileId,
      actorUserId: input.actorUserId,
      altText: input.altText,
      caption: input.caption,
    });
    const updated = await this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: persisted.id },
      select: quizFigureSelect,
    });
    return serializeQuizFigureAccessUrl(updated, this.files);
  }

  compileDraft(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: CompileQuizFigureDraftDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    return this.drafts.compile(questionId, figureId, actorUserId, dto, target);
  }

  applyDraft(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: ApplyQuizFigureDraftDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    return this.drafts.apply(questionId, figureId, actorUserId, dto, target);
  }

  async createForQuestion(
    questionId: string,
    actorUserId: string,
    dto: CreateQuestionQuizFigureAiDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const context = await this.loadQuestionFigureAuthoringContext(target, dto);
    this.assertQuestionFigureAuthoringContext(context, dto, true);
    const plan = buildQuestionFigureAuthoringPlan(context, dto.targetMode);
    const role = targetRole(dto.targetMode);
    const targetFigure = context.targetFigure;
    const sourceGenerationId = readQuizGenerationQuestionReference(
      context.question.sourceMetadataJson,
    )?.aiGenerationId;
    const figure = targetFigure
      ? await this.prisma.quizFigure.update({
          where: { id: targetFigure.id },
          data: {
            deletedAt: null,
            ...(sourceGenerationId ? { aiGenerationId: sourceGenerationId } : {}),
            ...(targetFigure.planJson == null ? { planJson: plan } : {}),
          },
          select: { id: true },
        })
      : await this.prisma.quizFigure.create({
          data: {
            lessonId: context.question.lessonId,
            ...quizFigureTargetCreateData(target),
            role,
            ...(sourceGenerationId ? { aiGenerationId: sourceGenerationId } : {}),
            planJson: plan,
            subjectKey: context.subject.key,
            subjectName: context.subject.name,
            subjectSlug: context.subject.slug,
            status: "QUEUED",
            createdById: actorUserId,
          },
          select: { id: true },
        });
    const latest = await this.prisma.quizFigureRevision.findFirst({
      where: { quizFigureId: figure.id },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    const revision = await this.prisma.quizFigureRevision.create({
      data: {
        quizFigureId: figure.id,
        sourceKind: "AI_TEX",
        origin: "ADMIN_REGENERATE",
        status: "QUEUED",
        sourceVersion: (latest?.sourceVersion ?? 0) + 1,
        altText:
          targetFigure?.currentRevision?.altText ??
          defaultAuthoringAltText(dto.targetMode, context.problem, target.kind),
        caption: targetFigure?.currentRevision?.caption ?? null,
        createdById: actorUserId,
      },
      select: { id: true },
    });
    await this.prisma.quizFigure.update({
      where: { id: figure.id },
      data: {
        deletedAt: null,
        status: "QUEUED",
        pendingRevisionId: revision.id,
        lastErrorCategory: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    const routeSnapshot = await this.resolveAiRoute(dto, role, target);
    const job = await this.jobs.enqueue(figure.id, actorUserId, routeSnapshot, {
      adminInstructions: dto.adminInstructions?.trim() || null,
      aiMode: dto.mode,
      systemPrompt: dto.systemPrompt?.trim() || null,
      userPrompt: dto.userPrompt?.trim() || null,
      planSnapshot: plan,
    });
    return { jobId: job.id, status: job.status };
  }

  async previewForQuestion(
    questionId: string,
    dto: CreateQuestionQuizFigureAiDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const context = await this.loadQuestionFigureAuthoringContext(target, dto);
    this.assertQuestionFigureAuthoringContext(context, dto, false);
    const plan = buildQuestionFigureAuthoringPlan(context, dto.targetMode);
    const role = targetRole(dto.targetMode);
    const routeSnapshot = await this.resolveAiRoute(dto, role, target);
    let structuredInput: AiStructuredInput;
    let trace: ResolvedAiStructuredRequestPreview;
    if (plan.role === "QUESTION") {
      structuredInput = buildQuestionFigureInput({
        subject: context.subject,
        plan,
        targetGrade: context.targetGrade,
        adminInstructions: dto.adminInstructions,
        mode: dto.mode,
        currentLatexSource: context.targetFigure?.currentRevision?.latexSource,
      });
      structuredInput = applyPromptOverrides(structuredInput, dto);
      trace = await this.provider.previewStructuredRequest(
        { feature: quizFigureTargetFeature(target), routeSnapshot },
        structuredInput,
        generatedQuizQuestionFigureSchema,
      );
    } else {
      structuredInput = buildSolutionFigureInput({
        subject: context.subject,
        plan,
        targetGrade: context.targetGrade,
        adminInstructions: dto.adminInstructions,
        mode: dto.mode,
        currentSolutionLatexSource: context.targetFigure?.currentRevision?.latexSource,
      });
      structuredInput = applyPromptOverrides(structuredInput, dto);
      trace = await this.provider.previewStructuredRequest(
        { feature: quizFigureTargetFeature(target), routeSnapshot },
        structuredInput,
        generatedQuizSolutionFigureSchema,
      );
    }
    return this.buildCreateAiPreview(dto, structuredInput, trace, routeSnapshot);
  }

  async createNewAi(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: CreateQuizFigureAiDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const figure = await this.requireFigure(target, figureId);
    await this.ensureSourceGenerationLink(target, figure.id, figure.aiGenerationId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const plan = readPlan(figure.planJson);
    this.assertPlanRole(figure.role, plan);
    if (
      dto.mode === "EDIT_CURRENT" &&
      (figure.currentRevision?.sourceKind !== "AI_TEX" ||
        !figure.currentRevision.latexSource?.trim())
    ) {
      throw badRequestException(
        "QUIZ_FIGURE_CURRENT_LATEX_SOURCE_MISSING",
        "Hình hiện tại không có mã TikZ để AI chỉnh sửa.",
      );
    }
    const latest = await this.prisma.quizFigureRevision.findFirst({
      where: { quizFigureId: figure.id },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    const revision = await this.prisma.quizFigureRevision.create({
      data: {
        quizFigureId: figure.id,
        sourceKind: "AI_TEX",
        origin: "ADMIN_REGENERATE",
        status: "QUEUED",
        sourceVersion: (latest?.sourceVersion ?? 0) + 1,
        altText:
          figure.currentRevision?.altText ?? defaultAltText(figure.role, target.kind),
        caption: figure.currentRevision?.caption ?? null,
        createdById: actorUserId,
      },
      select: { id: true },
    });
    await this.prisma.quizFigure.update({
      where: { id: figure.id },
      data: {
        deletedAt: null,
        status: "QUEUED",
        pendingRevisionId: revision.id,
        lastErrorCategory: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    const routeSnapshot = await this.resolveAiRoute(dto, figure.role, target);
    const job = await this.jobs.enqueue(figure.id, actorUserId, routeSnapshot, {
      adminInstructions: dto.adminInstructions?.trim() || null,
      aiMode: dto.mode,
      systemPrompt: dto.systemPrompt?.trim() || null,
      userPrompt: dto.userPrompt?.trim() || null,
    });
    return { jobId: job.id, status: job.status };
  }

  async previewNewAi(
    questionId: string,
    figureId: string,
    dto: CreateQuizFigureAiDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const figure = await this.requireFigure(target, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    if (
      dto.mode === "EDIT_CURRENT" &&
      (figure.currentRevision?.sourceKind !== "AI_TEX" ||
        !figure.currentRevision.latexSource?.trim())
    ) {
      throw badRequestException(
        "QUIZ_FIGURE_CURRENT_LATEX_SOURCE_MISSING",
        "Hình hiện tại không có mã TikZ để AI chỉnh sửa.",
      );
    }
    const plan = readPlan(figure.planJson);
    this.assertPlanRole(figure.role, plan);
    const subject = readSubject(figure);
    const targetGrade = readQuizFigureTargetGrade(figure.aiGeneration?.inputMetaJson);
    const routeSnapshot = await this.resolveAiRoute(dto, figure.role, target);
    let structuredInput: AiStructuredInput;
    let trace: ResolvedAiStructuredRequestPreview;
    if (figure.role === QuizFigureRole.QUESTION) {
      if (plan.role !== "QUESTION") {
        throw badRequestException(
          "QUIZ_FIGURE_PLAN_INVALID",
          "Dữ liệu dựng hình đề của câu Quiz không hợp lệ.",
        );
      }
      structuredInput = buildQuestionFigureInput({
        subject,
        plan,
        targetGrade,
        adminInstructions: dto.adminInstructions,
        mode: dto.mode,
        currentLatexSource: figure.currentRevision?.latexSource,
      });
      structuredInput = applyPromptOverrides(structuredInput, dto);
      trace = await this.provider.previewStructuredRequest(
        { feature: quizFigureTargetFeature(target), routeSnapshot },
        structuredInput,
        generatedQuizQuestionFigureSchema,
      );
    } else {
      if (plan.role !== "SOLUTION") {
        throw badRequestException(
          "QUIZ_FIGURE_PLAN_INVALID",
          "Dữ liệu dựng hình lời giải của câu Quiz không hợp lệ.",
        );
      }
      structuredInput = buildSolutionFigureInput({
        subject,
        plan,
        targetGrade,
        adminInstructions: dto.adminInstructions,
        mode: dto.mode,
        currentSolutionLatexSource: figure.currentRevision?.latexSource,
      });
      structuredInput = applyPromptOverrides(structuredInput, dto);
      trace = await this.provider.previewStructuredRequest(
        { feature: quizFigureTargetFeature(target), routeSnapshot },
        structuredInput,
        generatedQuizSolutionFigureSchema,
      );
    }
    const resolvedRequest = {
      ...structuredInput,
      model: trace.model,
      temperature: trace.temperature ?? undefined,
      reasoningEffort: trace.reasoningEffort ?? undefined,
      maxTokens: trace.maxOutputTokens ?? undefined,
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
    };
    return this.buildCreateAiPreview(dto, resolvedRequest, trace, routeSnapshot);
  }

  async refineWithAi(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: RefineQuizFigureWithAiDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const figure = await this.requireFigure(target, figureId);
    await this.ensureSourceGenerationLink(target, figure.id, figure.aiGenerationId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const current = figure.currentRevision;
    if (
      figure.status !== "SUCCEEDED" ||
      current?.status !== "SUCCEEDED" ||
      current.sourceKind !== "AI_TEX" ||
      !current.latexSource?.trim() ||
      !current.deliveryFileId ||
      current.deliveryFile?.mimeType !== "image/svg+xml"
    ) {
      throw badRequestException(
        "QUIZ_FIGURE_REFINEMENT_SOURCE_REQUIRED",
        "Chỉ có thể tinh chỉnh hình TikZ đã tạo thành công.",
      );
    }
    const plan = readPlan(figure.planJson);
    this.assertPlanRole(figure.role, plan);
    const routeSnapshot = await this.resolveAiRoute(
      { mode: "EDIT_CURRENT" },
      figure.role,
      target,
    );
    const latest = await this.prisma.quizFigureRevision.findFirst({
      where: { quizFigureId: figure.id },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    const revision = await this.prisma.quizFigureRevision.create({
      data: {
        quizFigureId: figure.id,
        sourceKind: "AI_TEX",
        origin: "AI_REFINEMENT",
        status: "QUEUED",
        sourceVersion: (latest?.sourceVersion ?? 0) + 1,
        altText: current.altText,
        caption: current.caption,
        createdById: actorUserId,
      },
      select: { id: true },
    });
    await this.prisma.quizFigure.update({
      where: { id: figure.id },
      data: {
        status: "QUEUED",
        pendingRevisionId: revision.id,
        lastErrorCategory: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    const job = await this.jobs.enqueue(figure.id, actorUserId, routeSnapshot, {
      aiMode: "EDIT_CURRENT",
      operation: "REFINE_CURRENT",
      adminInstructions: dto.adminInstructions?.trim() || null,
    });
    return { jobId: job.id, status: job.status };
  }

  async previewRefinement(
    questionId: string,
    figureId: string,
    dto: RefineQuizFigureWithAiDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const figure = await this.requireFigure(target, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const current = figure.currentRevision;
    if (
      figure.status !== "SUCCEEDED" ||
      current?.status !== "SUCCEEDED" ||
      current.sourceKind !== "AI_TEX" ||
      !current.latexSource?.trim() ||
      !current.deliveryFileId ||
      current.deliveryFile?.mimeType !== "image/svg+xml" ||
      !current.deliveryFile.objectKey
    ) {
      throw badRequestException(
        "QUIZ_FIGURE_REFINEMENT_SOURCE_REQUIRED",
        "Chỉ có thể tinh chỉnh hình TikZ đã tạo thành công.",
      );
    }
    const plan = readPlan(figure.planJson);
    this.assertPlanRole(figure.role, plan);
    const routeSnapshot = await this.resolveAiRoute(
      { mode: "EDIT_CURRENT" },
      figure.role,
      target,
    );
    const currentSvg = await this.artifacts.readDeliveryObject(
      current.deliveryFile.objectKey,
    );
    const currentImageDataUrl = await buildQuizFigureRefinementImageDataUrl(currentSvg);
    const structuredInput = buildQuizFigureRefinementInput({
      subject: readSubject(figure),
      plan,
      targetGrade: readQuizFigureTargetGrade(figure.aiGeneration?.inputMetaJson),
      adminInstructions: dto.adminInstructions,
      currentLatexSource: current.latexSource,
      currentImageDataUrl,
    });
    const previewContext = { feature: quizFigureTargetFeature(target), routeSnapshot };
    const trace: ResolvedAiStructuredRequestPreview =
      await this.provider.previewStructuredRequest(
        previewContext,
        structuredInput,
        generatedQuizFigureRefinementSchema,
      );
    const previewRequest = {
      ...structuredInput,
      model: trace.model,
      temperature: trace.temperature ?? undefined,
      reasoningEffort: trace.reasoningEffort ?? undefined,
      maxTokens: trace.maxOutputTokens ?? undefined,
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
      inputImages: structuredInput.inputImages?.map(() => ({
        imageUrl: `data:image/png;base64,${OPENAI_PREVIEW_BINARY_DATA}`,
        detail: "high" as const,
      })),
    };
    const modelOptions = await this.modelRouting.getAllActiveModels();
    return {
      operation: "REFINE_CURRENT" as const,
      adminInstructions: dto.adminInstructions?.trim() || null,
      currentImageDataUrl,
      providerInput: buildOpenAiStructuredResponseRequest({
        request: previewRequest,
        model: trace.model,
        structuredTextFormat: trace.textFormat,
      }),
      configuration: {
        isDefaultConfigured: routeSnapshot.hasConfiguration,
        resolvedProvider: trace.provider,
        resolvedModel: trace.model,
        temperature: trace.temperature,
        reasoningEffort: trace.reasoningEffort,
        maxOutputTokens: trace.maxOutputTokens,
        modelOptions: modelOptions.map((option) => ({
          provider: option.provider,
          model: option.model,
          available: option.available,
          capabilities: option.capabilitiesJson,
        })),
      },
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
      context: trace.inputTokenEstimate,
      estimatedCost: trace.estimatedCost,
    };
  }

  async updateCaption(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: UpdateQuizFigureCaptionDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const figure = await this.requireFigure(target, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    const current = figure.currentRevision;
    if (!current) {
      throw badRequestException(
        "QUIZ_FIGURE_CURRENT_REVISION_REQUIRED",
        "Hình chưa có phiên bản hiện hành để cập nhật caption.",
      );
    }
    const latest = await this.prisma.quizFigureRevision.findFirst({
      where: { quizFigureId: figure.id },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    const revision = await this.prisma.quizFigureRevision.create({
      data: {
        quizFigureId: figure.id,
        sourceKind: current.sourceKind,
        origin: "ADMIN_EDIT",
        status: "SUCCEEDED",
        latexSource: current.latexSource,
        sourceHash: current.sourceHash,
        sourceVersion: (latest?.sourceVersion ?? 0) + 1,
        altText: current.altText,
        caption: dto.caption?.trim() || null,
        deliveryFileId: current.deliveryFileId,
        sanitizedSvgHash: current.sanitizedSvgHash,
        rendererVersion: current.rendererVersion,
        validatorVersion: current.validatorVersion,
        createdById: actorUserId,
        finishedAt: new Date(),
      },
      select: { id: true },
    });
    await this.prisma.quizFigure.update({
      where: { id: figure.id },
      data: { currentRevisionId: revision.id },
    });
    const updated = await this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: figure.id },
      select: quizFigureSelect,
    });
    return serializeQuizFigureAccessUrl(updated, this.files);
  }

  async deleteFigure(
    questionId: string,
    figureId: string,
    dto: QuizFigureRevisionGuardDto,
    target: QuizFigureTarget = { kind: "QUIZ", questionId },
  ) {
    const figure = await this.requireFigure(target, figureId);
    this.assertBaseRevision(figure.currentRevisionId, dto.baseRevisionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.quizFigure.update({
        where: { id: figure.id },
        data: {
          deletedAt: new Date(),
          currentRevisionId: null,
          pendingRevisionId: null,
        },
      });
    });
    return { deleted: true, figureId };
  }

  private async requireFigure(target: QuizFigureTarget, figureId: string) {
    const figure = await this.prisma.quizFigure.findFirst({
      where: { id: figureId, ...quizFigureTargetWhere(target), deletedAt: null },
      select: {
        id: true,
        aiGenerationId: true,
        role: true,
        status: true,
        planJson: true,
        subjectKey: true,
        subjectName: true,
        subjectSlug: true,
        aiGeneration: { select: { inputMetaJson: true } },
        currentRevisionId: true,
        currentRevision: {
          select: {
            status: true,
            sourceKind: true,
            latexSource: true,
            sourceHash: true,
            altText: true,
            caption: true,
            deliveryFileId: true,
            deliveryFile: { select: { mimeType: true, objectKey: true } },
            sanitizedSvgHash: true,
            rendererVersion: true,
            validatorVersion: true,
          },
        },
      },
    });
    if (!figure) {
      throw notFoundException(
        `${target.kind}_FIGURE_NOT_FOUND`,
        `Không tìm thấy hình ${quizFigureTargetLabel(target)}.`,
      );
    }
    return figure;
  }

  private async ensureSourceGenerationLink(
    target: QuizFigureTarget,
    figureId: string,
    currentGenerationId: string | null,
  ) {
    if (currentGenerationId !== null) return;
    const question =
      target.kind === "QUIZ"
        ? await this.prisma.quizQuestion.findFirst({
            where: { id: target.questionId, deletedAt: null },
            select: { sourceMetadataJson: true },
          })
        : await this.prisma.testQuestion.findFirst({
            where: { id: target.questionId, deletedAt: null },
            select: { sourceMetadataJson: true },
          });
    const sourceGenerationId = readQuizGenerationQuestionReference(
      question?.sourceMetadataJson,
    )?.aiGenerationId;
    if (!sourceGenerationId) return;
    await this.prisma.quizFigure.update({
      where: { id: figureId },
      data: { aiGenerationId: sourceGenerationId },
    });
  }

  private findQuestion(target: QuizFigureTarget) {
    if (target.kind === "QUIZ") {
      return this.prisma.quizQuestion.findFirst({
        where: { id: target.questionId, deletedAt: null },
        select: questionFigureAuthoringSelect,
      });
    }
    return this.prisma.testQuestion.findFirst({
      where: { id: target.questionId, deletedAt: null },
      select: questionFigureAuthoringSelect,
    });
  }

  private async resolveAiRoute(
    dto: CreateQuizFigureAiDto,
    _role: QuizFigureRole,
    target: Pick<QuizFigureTarget, "kind">,
  ): Promise<AiFeatureRoute> {
    const base = await this.modelRouting.resolve(
      quizFigureTargetFeature(target),
      AiModelPurpose.IMAGE,
    );
    let candidates = base.candidates;
    if (dto.model) {
      const selected =
        candidates.find((candidate) => candidate.model === dto.model) ??
        (await this.modelRouting.resolveCandidateByModel(dto.model));
      if (!selected?.available) {
        throw badRequestException(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không còn khả dụng cho chức năng tạo hình.",
          { model: dto.model },
        );
      }
      candidates = [selected];
    }
    const selected = candidates.find((candidate) => candidate.available);
    if (!selected) {
      throw badRequestException(
        "AI_PROVIDER_UNAVAILABLE",
        "Chưa có model khả dụng cho chức năng tạo hình.",
      );
    }
    const capability = readAiConfigurationCapability(selected.capabilitiesJson);
    if (dto.temperature != null && capability !== "TEMPERATURE") {
      throw badRequestException(
        "AI_TEMPERATURE_NOT_SUPPORTED",
        "Model đã chọn không hỗ trợ cấu hình Temperature.",
      );
    }
    const allowedEfforts = readReasoningEffortLevels(selected.capabilitiesJson);
    if (
      dto.reasoningEffort &&
      (capability !== "REASONING_EFFORT" || !allowedEfforts.includes(dto.reasoningEffort))
    ) {
      throw badRequestException(
        "AI_REASONING_EFFORT_NOT_SUPPORTED",
        "Mức Reasoning Effort đã chọn không được cấu hình cho model này.",
      );
    }
    return {
      ...base,
      model: selected.model,
      candidates,
      temperature:
        capability === "TEMPERATURE" ? (dto.temperature ?? base.temperature) : null,
      reasoningEffort:
        capability === "REASONING_EFFORT"
          ? (dto.reasoningEffort ?? base.reasoningEffort)
          : null,
      maxOutputTokens: base.maxOutputTokens,
    };
  }

  private async buildCreateAiPreview(
    dto: CreateQuizFigureAiDto,
    structuredInput: AiStructuredInput,
    trace: ResolvedAiStructuredRequestPreview,
    routeSnapshot: AiFeatureRoute,
  ) {
    const resolvedRequest = {
      ...structuredInput,
      model: trace.model,
      temperature: trace.temperature ?? undefined,
      reasoningEffort: trace.reasoningEffort ?? undefined,
      maxTokens: trace.maxOutputTokens ?? undefined,
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
    };
    const modelOptions = await this.modelRouting.getAllActiveModels();
    return {
      mode: dto.mode,
      adminInstructions: dto.adminInstructions?.trim() || null,
      providerInput: buildOpenAiStructuredResponseRequest({
        request: resolvedRequest,
        model: trace.model,
        structuredTextFormat: trace.textFormat,
      }),
      configuration: {
        isDefaultConfigured: routeSnapshot.hasConfiguration,
        resolvedProvider: trace.provider,
        resolvedModel: trace.model,
        temperature: trace.temperature,
        reasoningEffort: trace.reasoningEffort,
        maxOutputTokens: trace.maxOutputTokens,
        modelOptions: modelOptions.map((option) => ({
          provider: option.provider,
          model: option.model,
          available: option.available,
          capabilities: option.capabilitiesJson,
        })),
      },
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
      context: trace.inputTokenEstimate,
      estimatedCost: trace.estimatedCost,
    };
  }

  private async loadQuestionFigureAuthoringContext(
    target: QuizFigureTarget,
    dto: CreateQuestionQuizFigureAiDto,
  ) {
    const question = await this.findQuestion(target);
    if (!question) {
      throw notFoundException(
        `${target.kind}_QUESTION_NOT_FOUND`,
        `Không tìm thấy câu ${quizFigureTargetLabel(target)}.`,
      );
    }
    const role = targetRole(dto.targetMode);
    const targetFigure = question.figures.find((figure) => figure.role === role) ?? null;
    const questionFigure =
      question.figures.find(
        (figure) => figure.role === QuizFigureRole.QUESTION && !figure.deletedAt,
      ) ?? null;
    const subjectSource = targetFigure ?? questionFigure;
    const subject = subjectSource
      ? readSubject(subjectSource)
      : resolveQuizSubject({
          domainName: question.lesson.learningPath.domain.name,
          domainSlug: question.lesson.learningPath.domain.slug,
        });
    const problem = serializeQuizRichText(question.questionJson);
    const solution = readQuestionSolution(
      question.sourceMetadataJson,
      question.explanation?.contentJson,
    );
    const targetGrade =
      question.lesson.learningPath.targetAudiences
        .map((item) => item.targetAudience.grade)
        .find((grade): grade is number => grade != null) ?? null;
    return {
      question,
      targetFigure,
      questionFigure,
      subject,
      targetGrade,
      problem,
      solution,
    };
  }

  private assertQuestionFigureAuthoringContext(
    context: Awaited<
      ReturnType<QuizFiguresService["loadQuestionFigureAuthoringContext"]>
    >,
    dto: CreateQuestionQuizFigureAiDto,
    requireIdle: boolean,
  ) {
    if (!context.problem) {
      throw badRequestException(
        "QUIZ_FIGURE_PROBLEM_REQUIRED",
        "Câu Quiz phải có nội dung trước khi tạo hình.",
      );
    }
    if (dto.targetMode !== "QUESTION" && !context.solution) {
      throw badRequestException(
        "QUIZ_SOLUTION_TEXT_REQUIRED",
        "Hãy thêm lời giải bằng chữ trước khi tạo hình lời giải.",
      );
    }
    this.assertBaseRevision(
      context.targetFigure?.currentRevisionId ?? null,
      dto.baseRevisionId,
    );
    if (requireIdle && context.targetFigure?.pendingRevisionId) {
      throw badRequestException(
        "QUIZ_FIGURE_OPERATION_IN_PROGRESS",
        "Hình đang được xử lý. Hãy chờ tác vụ hiện tại hoàn tất.",
      );
    }
    if (dto.mode === "EDIT_CURRENT") {
      const current = context.targetFigure?.currentRevision;
      if (!current?.latexSource?.trim() || current.sourceKind !== "AI_TEX") {
        throw badRequestException(
          "QUIZ_FIGURE_CURRENT_LATEX_SOURCE_MISSING",
          "Hình hiện tại không có mã TikZ để AI chỉnh sửa.",
        );
      }
    }
  }

  private assertPlanRole(role: QuizFigureRole, plan: QuizFigurePlan) {
    if (plan.role !== role) {
      throw badRequestException(
        "QUIZ_FIGURE_PLAN_ROLE_MISMATCH",
        "Dữ liệu dựng hình không khớp vai trò hình Quiz.",
      );
    }
  }

  private assertBaseRevision(current: string | null, expected?: string | null) {
    if (current !== (expected ?? null)) {
      throw badRequestException(
        "QUIZ_FIGURE_REVISION_CONFLICT",
        "Hình đã có phiên bản mới. Hãy tải lại trước khi thao tác.",
      );
    }
  }
}

function readPlan(value: unknown): QuizFigurePlan {
  const parsed = quizFigurePlanSchema.safeParse(omitLegacyAiCaption(value));
  if (!parsed.success) {
    throw badRequestException(
      "QUIZ_FIGURE_PLAN_INVALID",
      "Dữ liệu dựng hình của câu Quiz không hợp lệ.",
    );
  }
  return parsed.data;
}

function omitLegacyAiCaption(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "caption"),
  );
}

function applyPromptOverrides(
  input: AiStructuredInput,
  dto: CreateQuizFigureAiDto,
): AiStructuredInput {
  return {
    ...input,
    systemPrompt: resolveQuizFigureSystemPrompt(input.systemPrompt, dto.systemPrompt),
    userPrompt: dto.userPrompt?.trim() || input.userPrompt,
  };
}

function readSubject(value: {
  subjectKey: string;
  subjectName: string;
  subjectSlug: string;
}): QuizSubjectSnapshot {
  const key = ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"].includes(value.subjectKey)
    ? (value.subjectKey as QuizSubjectSnapshot["key"])
    : "GENERAL";
  return { key, name: value.subjectName, slug: value.subjectSlug };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readAiConfigurationCapability(value: unknown) {
  const capability = readRecord(value).aiConfiguration;
  return capability === "TEMPERATURE" ||
    capability === "REASONING_EFFORT" ||
    capability === "NONE"
    ? capability
    : null;
}

function readReasoningEffortLevels(value: unknown): string[] {
  const levels = readRecord(value).reasoningEffortLevels;
  return Array.isArray(levels)
    ? levels.filter((level): level is string => typeof level === "string")
    : [];
}

export const quizFigureSelect = {
  id: true,
  role: true,
  status: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  currentRevision: {
    select: {
      id: true,
      origin: true,
      status: true,
      sourceKind: true,
      sourceVersion: true,
      latexSource: true,
      previewSvg: true,
      altText: true,
      caption: true,
      deliveryFile: {
        select: {
          id: true,
          mimeType: true,
          objectKey: true,
          publicUrl: true,
          visibility: true,
        },
      },
    },
  },
} as const;

export async function serializeQuizFigureAccessUrl<
  T extends {
    currentRevision: {
      deliveryFile: {
        id: string;
        mimeType: string;
        objectKey: string;
        publicUrl: string | null;
        visibility: "PRIVATE" | "PUBLIC";
      } | null;
    } | null;
  },
>(figure: T, files?: Pick<FilesService, "resolveAccessUrl">) {
  const revision = figure.currentRevision;
  const file = revision?.deliveryFile;
  if (!revision || !file) return figure;

  const publicUrl = files ? await files.resolveAccessUrl(file) : file.publicUrl;
  const { objectKey: _objectKey, visibility: _visibility, ...publicFile } = file;
  return {
    ...figure,
    currentRevision: {
      ...revision,
      deliveryFile: { ...publicFile, publicUrl },
    },
  };
}

export function readQuizFigurePendingAiTargetMode(inputMeta: unknown) {
  if (!inputMeta || typeof inputMeta !== "object" || Array.isArray(inputMeta)) {
    return null;
  }
  const parsed = quizFigurePlanSchema.safeParse(
    (inputMeta as Record<string, unknown>).planSnapshot,
  );
  if (!parsed.success) return null;
  if (parsed.data.role === "QUESTION") return "QUESTION" as const;
  return "SOLUTION" as const;
}

function defaultAltText(role: QuizFigureRole, assessmentKind: QuizFigureTarget["kind"]) {
  const assessmentLabel = assessmentKind === "TEST" ? "Test" : "Quiz";
  return role === QuizFigureRole.QUESTION
    ? `Hình minh họa đề ${assessmentLabel}`
    : `Hình lời giải ${assessmentLabel}`;
}

function targetRole(targetMode: QuizFigureAiTargetMode) {
  return targetMode === "QUESTION" ? QuizFigureRole.QUESTION : QuizFigureRole.SOLUTION;
}

function buildQuestionFigureAuthoringPlan(
  context: {
    problem: string;
    solution: string;
    targetFigure: { planJson: unknown } | null;
  },
  targetMode: QuizFigureAiTargetMode,
): QuizFigurePlan {
  if (targetMode === "QUESTION") {
    return { version: 1, role: "QUESTION", problem: context.problem };
  }
  return {
    version: 2,
    role: "SOLUTION",
    problem: context.problem,
    solution: context.solution,
  };
}

function readQuestionSolution(sourceMetadata: unknown, explanationJson: unknown) {
  const metadata = readRecord(sourceMetadata);
  const block = readRecord(metadata.quizExplanationBlock);
  const blockSolution = block.solution;
  if (typeof blockSolution === "string" && blockSolution.trim()) {
    return blockSolution.trim();
  }
  return serializeQuizRichText(explanationJson);
}

function defaultAuthoringAltText(
  targetMode: QuizFigureAiTargetMode,
  problem: string,
  assessmentKind: QuizFigureTarget["kind"],
) {
  const excerpt = problem.replaceAll(/\s+/gu, " ").trim().slice(0, 160);
  const assessmentLabel = assessmentKind === "TEST" ? "Test" : "Quiz";
  const label =
    targetMode === "QUESTION"
      ? `Hình minh họa đề ${assessmentLabel}`
      : `Hình lời giải ${assessmentLabel}`;
  return excerpt ? `${label}: ${excerpt}` : label;
}
