import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  AiGenerationType,
  AiModelPurpose,
  BackgroundJobQueue,
  BackgroundJobStatus,
  QuestionType,
} from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import {
  AiProviderCallService,
  type ResolvedAiStructuredRequestPreview,
} from "#api/modules/ai/services/ai-provider-call.service";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import {
  buildOpenAiStructuredResponseRequest,
  OPENAI_PREVIEW_BINARY_DATA,
} from "#api/modules/ai/utils/openai-response-request";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import type {
  PreviewQuizSolutionRefinementDto,
  QueueQuizSolutionRefinementDto,
} from "#api/modules/quiz/dto/refine-quiz-solution.dto";
import {
  QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE,
  isMultiStatementQuizSolutionRefinement,
  multipleChoiceQuizSolutionRegenerationOutputSchema,
  multiStatementQuizSolutionRegenerationOutputSchema,
  multiStatementQuizSolutionRefinementOutputSchema,
  singleQuizSolutionRefinementOutputSchema,
  textInputQuizSolutionRegenerationOutputSchema,
  trueFalseQuizSolutionRegenerationOutputSchema,
} from "#api/modules/quiz/types/quiz-solution-refinement.types";
import { serializeQuizRichText } from "#api/modules/quiz/utils/quiz-generation-output";
import {
  buildQuizSolutionRefinementInput,
  buildQuizSolutionRegenerationInput,
} from "#api/modules/quiz/utils/quiz-solution-refinement-prompt";
import { resolveQuizSubject } from "#api/modules/quiz/utils/quiz-subject";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";

@Injectable()
export class QuizSolutionRefinementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService) private readonly provider: AiProviderCallService,
    @Inject(AiGenerationJobService) private readonly jobs: AiGenerationJobService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(QuizFigureArtifactService)
    private readonly figureArtifacts: QuizFigureArtifactService,
  ) {}

  async preview(questionId: string, dto: PreviewQuizSolutionRefinementDto) {
    return this.previewForKind(questionId, dto, "QUIZ");
  }

  async previewTest(questionId: string, dto: PreviewQuizSolutionRefinementDto) {
    return this.previewForKind(questionId, dto, "TEST");
  }

  private async previewForKind(
    questionId: string,
    dto: PreviewQuizSolutionRefinementDto,
    kind: "QUIZ" | "TEST",
  ) {
    const prepared = await this.prepareRequest(questionId, dto, kind);
    const modelOptions = await this.modelRouting.getAllActiveModels();
    const resolvedRequest = {
      ...buildResolvedRequest(prepared.request, prepared.trace),
      inputImages: prepared.request.inputImages?.map(() => ({
        imageUrl: `data:image/png;base64,${OPENAI_PREVIEW_BINARY_DATA}`,
        detail: "high" as const,
      })),
    };
    return {
      mode: dto.mode,
      includeCurrentSolutionAsRejected: prepared.includeCurrentSolutionAsRejected,
      requestHash: buildRequestHash(prepared),
      baseContentHash: prepared.baseContentHash,
      questionImageDataUrl: prepared.questionImageDataUrl,
      providerInput: buildOpenAiStructuredResponseRequest({
        request: resolvedRequest,
        model: prepared.trace.model,
        structuredTextFormat: prepared.trace.textFormat,
      }),
      configuration: {
        isDefaultConfigured: prepared.route.hasConfiguration,
        resolvedProvider: prepared.trace.provider,
        resolvedModel: prepared.trace.model,
        temperature: prepared.trace.temperature,
        reasoningEffort: prepared.trace.reasoningEffort,
        maxOutputTokens: prepared.trace.maxOutputTokens,
        modelOptions: modelOptions.map((option) => ({
          provider: option.provider,
          model: option.model,
          available: option.available,
          capabilities: option.capabilitiesJson,
        })),
      },
      systemPrompt: prepared.trace.systemPrompt,
      userPrompt: prepared.trace.userPrompt,
      context: prepared.trace.inputTokenEstimate,
      estimatedCost: prepared.trace.estimatedCost,
    };
  }

  async queue(
    questionId: string,
    actorUserId: string,
    dto: QueueQuizSolutionRefinementDto,
  ) {
    return this.queueForKind(questionId, actorUserId, dto, "QUIZ");
  }

  async queueTest(
    questionId: string,
    actorUserId: string,
    dto: QueueQuizSolutionRefinementDto,
  ) {
    return this.queueForKind(questionId, actorUserId, dto, "TEST");
  }

  private async queueForKind(
    questionId: string,
    actorUserId: string,
    dto: QueueQuizSolutionRefinementDto,
    kind: "QUIZ" | "TEST",
  ) {
    const prepared = await this.prepareRequest(questionId, dto, kind);
    const requestHash = buildRequestHash(prepared);
    if (requestHash !== dto.requestHash) {
      throw badRequestException(
        "AI_INPUT_SNAPSHOT_STALE",
        "Dữ liệu câu hỏi hoặc cấu hình AI đã thay đổi. Hãy cập nhật dữ liệu gửi AI.",
      );
    }
    const active = await this.prisma.backgroundJob.findFirst({
      where: {
        queue: BackgroundJobQueue.AI_GENERATION,
        resourceType:
          kind === "TEST"
            ? "TEST_SOLUTION_REFINEMENT"
            : QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE,
        resourceId: questionId,
        status: { in: [BackgroundJobStatus.QUEUED, BackgroundJobStatus.RUNNING] },
      },
      select: { id: true, status: true },
    });
    if (active) {
      return { mode: "QUEUED" as const, jobId: active.id, status: active.status };
    }
    const job = await this.jobs.createAndEnqueue({
      type: kind === "TEST" ? AiGenerationType.TEST : AiGenerationType.QUIZ,
      createdByUserId: actorUserId,
      lessonId: prepared.lessonId,
      targetType:
        kind === "TEST"
          ? "TEST_SOLUTION_REFINEMENT"
          : QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE,
      targetId: questionId,
      promptVersion: prepared.request.promptVersion,
      schemaVersion: prepared.request.schemaVersion,
      inputFingerprint: { questionId, mode: dto.mode, requestHash, nonce: randomUUID() },
      inputMeta: {
        operation:
          kind === "TEST"
            ? "TEST_SOLUTION_REFINEMENT"
            : QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE,
        assessmentKind: kind,
        pipelineVersion: "ASSESSMENT_QUIZ_V1",
        mode: dto.mode,
        includeCurrentSolutionAsRejected: prepared.includeCurrentSolutionAsRejected,
        questionId,
        targetQuestionId: questionId,
        baseContentHash: prepared.baseContentHash,
        requestHash,
        subjectKey: prepared.subject.key,
        subjectName: prepared.subject.name,
        subjectSlug: prepared.subject.slug,
        targetGrade: prepared.targetGrade,
        adminInstructions: prepared.adminInstructions,
        questionFigure: prepared.questionFigure,
        questionSnapshot: prepared.questionSnapshot,
      },
      routeSnapshot: prepared.route,
      idempotencyKey: [
        `${kind.toLowerCase()}-solution`,
        dto.mode.toLowerCase(),
        questionId,
        randomUUID(),
      ].join(":"),
      maxAttempts: 1,
    });
    return { mode: "QUEUED" as const, jobId: job.backgroundJobId, status: job.status };
  }

  private async prepareRequest(
    questionId: string,
    dto: PreviewQuizSolutionRefinementDto,
    kind: "QUIZ" | "TEST" = "QUIZ",
  ) {
    const questionQuery = {
      where: { id: questionId, deletedAt: null },
      select: {
        lessonId: true,
        questionType: true,
        questionJson: true,
        optionsJson: true,
        correctAnswerJson: true,
        hintJson: true,
        sourceMetadataJson: true,
        explanation: { select: { contentJson: true } },
        figures: {
          where: { role: "QUESTION", deletedAt: null, status: "SUCCEEDED" },
          take: 1,
          select: {
            currentRevision: {
              select: {
                id: true,
                status: true,
                deliveryFile: {
                  select: { objectKey: true, mimeType: true, checksum: true },
                },
              },
            },
          },
        },
        lesson: {
          select: {
            learningPath: {
              select: {
                domain: { select: { name: true, slug: true } },
                targetAudiences: {
                  select: { targetAudience: { select: { grade: true } } },
                },
              },
            },
          },
        },
      },
    } as const;
    const question =
      kind === "TEST"
        ? await this.prisma.testQuestion.findFirst(questionQuery)
        : await this.prisma.quizQuestion.findFirst(questionQuery);
    if (!question) {
      throw notFoundException(
        `${kind}_QUESTION_NOT_FOUND`,
        `Không tìm thấy câu ${kind === "TEST" ? "Test" : "Quiz"}.`,
      );
    }
    const currentSolution = readCurrentSolution(
      question.sourceMetadataJson,
      question.explanation?.contentJson,
    );
    if (!currentSolution) {
      throw badRequestException(
        "QUIZ_SOLUTION_REQUIRED",
        "Câu Quiz phải có lời giải hiện tại trước khi dùng AI.",
      );
    }
    const problem = serializeQuizRichText(question.questionJson).trim();
    if (!problem) {
      throw badRequestException("QUIZ_PROBLEM_REQUIRED", "Câu Quiz phải có đề bài.");
    }
    const subject = resolveQuizSubject({
      domainName: question.lesson.learningPath.domain.name,
      domainSlug: question.lesson.learningPath.domain.slug,
    });
    const targetGrade =
      question.lesson.learningPath.targetAudiences
        .map(({ targetAudience }) => targetAudience.grade)
        .filter((grade): grade is number => grade !== null)
        .sort((left, right) => left - right)[0] ?? null;
    const questionSnapshot = {
      questionType: question.questionType,
      problem,
      options: readOptions(question.optionsJson),
      correctAnswer: question.correctAnswerJson,
      currentHint: serializeQuizRichText(question.hintJson).trim() || null,
      currentSolution,
    };
    const adminInstructions = dto.adminInstructions?.trim() || null;
    if (dto.mode !== "REGENERATE" && dto.includeCurrentSolutionAsRejected) {
      throw badRequestException(
        "QUIZ_SOLUTION_REJECTED_CANDIDATE_MODE_INVALID",
        "Chỉ có thể gửi lời giải hiện tại làm mẫu sai khi tạo lại lời giải.",
      );
    }
    const includeCurrentSolutionAsRejected =
      dto.mode === "REGENERATE" && dto.includeCurrentSolutionAsRejected === true;
    const revision = question.figures?.[0]?.currentRevision;
    const questionFigure =
      revision?.status === "SUCCEEDED" &&
      revision.deliveryFile?.mimeType.startsWith("image/") &&
      revision.deliveryFile.objectKey
        ? {
            revisionId: revision.id,
            objectKey: revision.deliveryFile.objectKey,
            checksum: revision.deliveryFile.checksum,
          }
        : null;
    const questionImageDataUrl =
      dto.mode === "REGENERATE" && questionFigure
        ? await buildQuizFigureRefinementImageDataUrl(
            await this.figureArtifacts.readDeliveryObject(questionFigure.objectKey),
          )
        : null;
    const request =
      dto.mode === "REFINE"
        ? buildQuizSolutionRefinementInput({
            subject,
            targetGrade,
            question: questionSnapshot,
            adminInstructions,
          })
        : buildQuizSolutionRegenerationInput({
            subject,
            targetGrade,
            question: questionSnapshot,
            adminInstructions,
            questionImageDataUrl,
            includeCurrentSolutionAsRejected,
          });
    const route = await this.modelRouting.resolve(
      kind === "TEST" ? AiGenerationType.TEST : AiGenerationType.QUIZ,
      AiModelPurpose.TEXT,
    );
    const previewContext = {
      feature: kind === "TEST" ? AiGenerationType.TEST : AiGenerationType.QUIZ,
      routeSnapshot: route,
    };
    const trace =
      dto.mode === "REGENERATE"
        ? await previewRegenerationRequest(
            this.provider,
            previewContext,
            request,
            question.questionType,
          )
        : isMultiStatementQuizSolutionRefinement(question.questionType)
          ? await this.provider.previewStructuredRequest(
              previewContext,
              request,
              multiStatementQuizSolutionRefinementOutputSchema,
            )
          : await this.provider.previewStructuredRequest(
              previewContext,
              request,
              singleQuizSolutionRefinementOutputSchema,
            );
    return {
      lessonId: question.lessonId,
      subject,
      targetGrade,
      adminInstructions,
      includeCurrentSolutionAsRejected,
      questionSnapshot,
      questionFigure,
      questionImageDataUrl,
      baseContentHash: hashAiValue({ questionSnapshot, questionFigure }),
      request,
      route,
      trace,
    };
  }
}

async function previewRegenerationRequest(
  provider: AiProviderCallService,
  context: Parameters<AiProviderCallService["previewStructuredRequest"]>[0],
  request: AiStructuredInput,
  questionType: QuestionType,
) {
  switch (questionType) {
    case QuestionType.MULTIPLE_CHOICE:
      return provider.previewStructuredRequest(
        context,
        request,
        multipleChoiceQuizSolutionRegenerationOutputSchema,
      );
    case QuestionType.TRUE_FALSE:
      return provider.previewStructuredRequest(
        context,
        request,
        trueFalseQuizSolutionRegenerationOutputSchema,
      );
    case QuestionType.MULTI_STATEMENT_TRUE_FALSE:
      return provider.previewStructuredRequest(
        context,
        request,
        multiStatementQuizSolutionRegenerationOutputSchema,
      );
    case QuestionType.TEXT_INPUT:
      return provider.previewStructuredRequest(
        context,
        request,
        textInputQuizSolutionRegenerationOutputSchema,
      );
  }
}

function buildResolvedRequest(
  request: AiStructuredInput,
  trace: ResolvedAiStructuredRequestPreview,
) {
  return {
    ...request,
    model: trace.model,
    temperature: trace.temperature ?? undefined,
    reasoningEffort: trace.reasoningEffort ?? undefined,
    maxTokens: trace.maxOutputTokens ?? undefined,
    systemPrompt: trace.systemPrompt,
    userPrompt: trace.userPrompt,
  };
}

function buildRequestHash(input: {
  baseContentHash: string;
  request: AiStructuredInput;
  trace: ResolvedAiStructuredRequestPreview;
}) {
  return hashAiValue({
    baseContentHash: input.baseContentHash,
    systemPrompt: input.trace.systemPrompt,
    userPrompt: input.trace.userPrompt,
    model: input.trace.model,
    temperature: input.trace.temperature,
    reasoningEffort: input.trace.reasoningEffort,
    maxOutputTokens: input.trace.maxOutputTokens,
    textFormat: input.trace.textFormat,
    promptVersion: input.request.promptVersion,
    schemaVersion: input.request.schemaVersion,
  });
}

function readCurrentSolution(sourceMetadata: unknown, explanationJson: unknown) {
  const block = asRecord(asRecord(sourceMetadata).quizExplanationBlock);
  if (typeof block.solution === "string" && block.solution.trim()) {
    return block.solution.trim();
  }
  return serializeQuizRichText(explanationJson).trim();
}

function readOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    const record = asRecord(option);
    if (typeof record.id !== "string") return [];
    const text = serializeQuizRichText(record.richText).trim();
    return text ? [{ id: record.id, text }] : [];
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
