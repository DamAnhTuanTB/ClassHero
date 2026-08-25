import { Inject, Injectable } from "@nestjs/common";
import { AiGenerationType, AiModelPurpose, QuizFigureRole } from "@prisma/client";

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
  CreateQuizFigureAiDto,
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
  buildSolutionFigureExtensionInput,
  buildSolutionFigureRedrawInput,
  generatedQuizFigureRefinementSchema,
  generatedQuizQuestionFigureSchema,
  generatedQuizSolutionExtensionSchema,
  generatedQuizSolutionRedrawSchema,
  quizFigurePlanSchema,
  readQuizFigureTargetGrade,
  resolveQuizFigureSystemPrompt,
  type QuizFigurePlan,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";

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
  ) {}

  async attachAdminUpload(input: {
    questionId: string;
    role: QuizFigureRole;
    fileId: string;
    altText: string;
    caption?: string | null;
    actorUserId: string;
  }) {
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: input.questionId, deletedAt: null },
      select: { id: true, lessonId: true, solutionFigureMode: true },
    });
    if (!question) {
      throw notFoundException("QUIZ_QUESTION_NOT_FOUND", "Không tìm thấy câu Quiz.");
    }
    const questionFigureRevision =
      input.role === QuizFigureRole.SOLUTION
        ? await this.prisma.quizFigure.findFirst({
            where: {
              quizQuestionId: question.id,
              role: QuizFigureRole.QUESTION,
              deletedAt: null,
            },
            select: { currentRevisionId: true },
          })
        : null;
    if (
      input.role === QuizFigureRole.SOLUTION &&
      !questionFigureRevision?.currentRevisionId
    ) {
      throw badRequestException(
        "QUIZ_SOLUTION_FIGURE_BASE_REQUIRED",
        "Hãy tải hình đề trước; hình lời giải phải được xây dựng trên hình đề.",
      );
    }
    const figure = await this.prisma.quizFigure.upsert({
      where: {
        quizQuestionId_role: {
          quizQuestionId: question.id,
          role: input.role,
        },
      },
      create: {
        lessonId: question.lessonId,
        quizQuestionId: question.id,
        role: input.role,
        subjectKey: "GENERAL",
        subjectName: "Tổng quát",
        subjectSlug: "general",
        status: "QUEUED",
        createdById: input.actorUserId,
      },
      update: { deletedAt: null },
      select: { id: true },
    });
    const revision = await this.artifacts.attachAdminUpload({
      figureId: figure.id,
      fileId: input.fileId,
      actorUserId: input.actorUserId,
      altText: input.altText,
      caption: input.caption,
    });
    if (input.role === QuizFigureRole.SOLUTION) {
      await this.prisma.$transaction([
        this.prisma.quizFigureRevision.update({
          where: { id: revision.id },
          data: {
            derivedFromQuestionRevisionId: questionFigureRevision!.currentRevisionId,
          },
        }),
        this.prisma.quizQuestion.update({
          where: { id: question.id },
          data: {
            solutionFigureMode:
              question.solutionFigureMode === "REDRAW_AS_MODEL"
                ? "REDRAW_AS_MODEL"
                : "EXTEND_QUESTION",
          },
        }),
      ]);
    }
    return this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: figure.id },
      select: quizFigureSelect,
    });
  }

  compileDraft(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: CompileQuizFigureDraftDto,
  ) {
    return this.drafts.compile(questionId, figureId, actorUserId, dto);
  }

  applyDraft(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: ApplyQuizFigureDraftDto,
  ) {
    return this.drafts.apply(questionId, figureId, actorUserId, dto);
  }

  async createNewAi(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: CreateQuizFigureAiDto,
  ) {
    const figure = await this.requireFigure(questionId, figureId);
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
    if (figure.role === "SOLUTION") {
      const questionFigure = await this.prisma.quizFigure.findFirst({
        where: {
          quizQuestionId: questionId,
          role: "QUESTION",
          deletedAt: null,
          currentRevisionId: { not: null },
        },
        select: { id: true },
      });
      if (!questionFigure) {
        throw badRequestException(
          "QUIZ_SOLUTION_FIGURE_BASE_REQUIRED",
          "Hình đề phải sẵn sàng trước khi tạo hình lời giải.",
        );
      }
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
        altText: figure.currentRevision?.altText ?? defaultAltText(figure.role),
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
    const routeSnapshot = await this.resolveAiRoute(
      dto,
      figure.role,
      plan.role === "SOLUTION" ? plan.mode : undefined,
    );
    const job = await this.jobs.enqueue(figure.id, actorUserId, routeSnapshot, {
      adminInstructions: dto.adminInstructions?.trim() || null,
      aiMode: dto.mode,
      systemPrompt: dto.systemPrompt?.trim() || null,
      userPrompt: dto.userPrompt?.trim() || null,
    });
    return { jobId: job.id, status: job.status };
  }

  async previewNewAi(questionId: string, figureId: string, dto: CreateQuizFigureAiDto) {
    const figure = await this.requireFigure(questionId, figureId);
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
    const routeSnapshot = await this.resolveAiRoute(
      dto,
      figure.role,
      plan.role === "SOLUTION" ? plan.mode : undefined,
    );
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
        { feature: AiGenerationType.QUIZ, routeSnapshot },
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
      const base = await this.prisma.quizFigure.findFirst({
        where: {
          quizQuestionId: questionId,
          role: QuizFigureRole.QUESTION,
          deletedAt: null,
        },
        select: { currentRevision: { select: { latexSource: true, status: true } } },
      });
      if (
        !base?.currentRevision?.latexSource ||
        base.currentRevision.status !== "SUCCEEDED"
      ) {
        throw badRequestException(
          "QUIZ_SOLUTION_FIGURE_BASE_REQUIRED",
          "Hình đề phải sẵn sàng trước khi tạo hình lời giải.",
        );
      }
      if (plan.mode === "REDRAW_AS_MODEL") {
        structuredInput = buildSolutionFigureRedrawInput({
          subject,
          plan,
          targetGrade,
          exactQuestionLatexSource: base.currentRevision.latexSource,
          adminInstructions: dto.adminInstructions,
          mode: dto.mode,
          currentSolutionLatexSource: figure.currentRevision?.latexSource,
        });
        structuredInput = applyPromptOverrides(structuredInput, dto);
        trace = await this.provider.previewStructuredRequest(
          { feature: AiGenerationType.QUIZ, routeSnapshot },
          structuredInput,
          generatedQuizSolutionRedrawSchema,
        );
      } else {
        structuredInput = buildSolutionFigureExtensionInput({
          subject,
          plan,
          targetGrade,
          exactQuestionLatexSource: base.currentRevision.latexSource,
          adminInstructions: dto.adminInstructions,
          mode: dto.mode,
          currentSolutionLatexSource: figure.currentRevision?.latexSource,
        });
        structuredInput = applyPromptOverrides(structuredInput, dto);
        trace = await this.provider.previewStructuredRequest(
          { feature: AiGenerationType.QUIZ, routeSnapshot },
          structuredInput,
          generatedQuizSolutionExtensionSchema,
        );
      }
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

  async refineWithAi(
    questionId: string,
    figureId: string,
    actorUserId: string,
    dto: RefineQuizFigureWithAiDto,
  ) {
    const figure = await this.requireFigure(questionId, figureId);
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
      plan.role === "SOLUTION" ? plan.mode : undefined,
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
        derivedFromQuestionRevisionId: current.derivedFromQuestionRevisionId,
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
    });
    return { jobId: job.id, status: job.status };
  }

  async previewRefinement(
    questionId: string,
    figureId: string,
    dto: RefineQuizFigureWithAiDto,
  ) {
    const figure = await this.requireFigure(questionId, figureId);
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
      plan.role === "SOLUTION" ? plan.mode : undefined,
    );
    const currentSvg = await this.artifacts.readDeliveryObject(
      current.deliveryFile.objectKey,
    );
    const currentImageDataUrl = await buildQuizFigureRefinementImageDataUrl(currentSvg);
    const structuredInput = buildQuizFigureRefinementInput({
      subject: readSubject(figure),
      plan,
      targetGrade: readQuizFigureTargetGrade(figure.aiGeneration?.inputMetaJson),
      currentLatexSource: current.latexSource,
      currentImageDataUrl,
    });
    const trace = await this.provider.previewStructuredRequest(
      { feature: AiGenerationType.QUIZ, routeSnapshot },
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
      inputImages: [
        {
          imageUrl: `data:image/png;base64,${OPENAI_PREVIEW_BINARY_DATA}`,
          detail: "high" as const,
        },
      ],
    };
    const modelOptions = await this.modelRouting.getAllActiveModels();
    return {
      operation: "REFINE_CURRENT" as const,
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
  ) {
    const figure = await this.requireFigure(questionId, figureId);
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
        derivedFromQuestionRevisionId: current.derivedFromQuestionRevisionId,
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
    return this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: figure.id },
      select: quizFigureSelect,
    });
  }

  async deleteFigure(
    questionId: string,
    figureId: string,
    dto: QuizFigureRevisionGuardDto,
  ) {
    const figure = await this.requireFigure(questionId, figureId);
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
      if (figure.role === "QUESTION") {
        await tx.quizFigure.updateMany({
          where: { quizQuestionId: questionId, role: "SOLUTION", deletedAt: null },
          data: {
            deletedAt: new Date(),
            currentRevisionId: null,
            pendingRevisionId: null,
          },
        });
        await tx.quizQuestion.update({
          where: { id: questionId },
          data: { solutionFigureMode: "NONE" },
        });
      } else {
        await tx.quizQuestion.update({
          where: { id: questionId },
          data: { solutionFigureMode: "NONE" },
        });
      }
    });
    return { deleted: true, figureId };
  }

  private async requireFigure(questionId: string, figureId: string) {
    const figure = await this.prisma.quizFigure.findFirst({
      where: { id: figureId, quizQuestionId: questionId, deletedAt: null },
      select: {
        id: true,
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
            derivedFromQuestionRevisionId: true,
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
      throw notFoundException("QUIZ_FIGURE_NOT_FOUND", "Không tìm thấy hình Quiz.");
    }
    return figure;
  }

  private async resolveAiRoute(
    dto: CreateQuizFigureAiDto,
    role: QuizFigureRole,
    solutionMode?: "EXTEND_QUESTION" | "REDRAW_AS_MODEL",
  ): Promise<AiFeatureRoute> {
    const base = await this.modelRouting.resolve(
      AiGenerationType.QUIZ,
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
      maxOutputTokens:
        role === QuizFigureRole.QUESTION || solutionMode === "REDRAW_AS_MODEL"
          ? 12_000
          : 8_000,
    };
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
      sourceKind: true,
      sourceVersion: true,
      latexSource: true,
      previewSvg: true,
      altText: true,
      caption: true,
      deliveryFile: {
        select: { id: true, mimeType: true, publicUrl: true },
      },
    },
  },
} as const;

function defaultAltText(role: QuizFigureRole) {
  return role === QuizFigureRole.QUESTION
    ? "Hình minh họa đề Quiz"
    : "Hình lời giải Quiz";
}
