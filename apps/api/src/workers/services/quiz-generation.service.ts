import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  AiExplanationTargetType,
  AiGenerationType,
  ContentSource,
  Prisma,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import type { AiOutputSchema } from "#api/modules/ai/types/ai-text.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { QuizGenerationContextService } from "#api/modules/quiz/services/quiz-generation-context.service";
import type {
  AiFeatureRoute,
  ProviderUsageOperation,
} from "#api/modules/provider-operations/types/provider-operations.types";
import {
  buildItemUsageTarget,
  buildWholeFeatureUsageTarget,
} from "#api/modules/provider-operations/utils/provider-usage-target";
import {
  generatedQuizSourceCoverageAuditSchema,
  getGeneratedQuizOutputSchema,
  quizGenerationJobInputSchema,
  type GeneratedQuizQuestion,
} from "#api/modules/quiz/types/quiz-generation.types";
import {
  getGeneratedQuizSolutionText,
  mapGeneratedQuizQuestion,
  normalizeQuizLearnerText,
  toQuizSolutionTiptap,
  toQuizTiptap,
} from "#api/modules/quiz/utils/quiz-generation-mapper";
import {
  readQuizGenerationQuestion,
  readQuizGenerationQuestionReference,
  replaceQuizGenerationQuestionOutput,
  serializeQuizRichText,
} from "#api/modules/quiz/utils/quiz-generation-output";
import {
  QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE,
  TEST_SOLUTION_REFINEMENT_TARGET_TYPE,
  isMultiStatementQuizSolutionRefinement,
  multipleChoiceQuizSolutionRegenerationOutputSchema,
  multiStatementQuizSolutionRegenerationOutputSchema,
  multiStatementQuizSolutionRefinementOutputSchema,
  quizSolutionRefinementJobInputSchema,
  singleQuizSolutionRefinementOutputSchema,
  textInputQuizSolutionRegenerationOutputSchema,
  trueFalseQuizSolutionRegenerationOutputSchema,
  type QuizSolutionRefinementJobInput,
  type QuizSolutionRefinementOutput,
  type QuizSolutionRegenerationOutput,
} from "#api/modules/quiz/types/quiz-solution-refinement.types";
import {
  buildQuizSolutionRefinementInput,
  buildQuizSolutionRegenerationInput,
} from "#api/modules/quiz/utils/quiz-solution-refinement-prompt";
import {
  normalizeGeneratedQuizQuestionContent,
  normalizeQuizConclusionParagraph,
} from "#api/modules/quiz/utils/quiz-generation-content-normalizer";
import { buildQuizStructuredInput } from "#api/modules/quiz/utils/quiz-generation-prompt";
import {
  type GenerationRecoveryIssue,
  validateQuizOutput,
} from "#api/modules/quiz/utils/quiz-generation-validation";

@Injectable()
export class QuizGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(QuizGenerationContextService)
    private readonly generationContext: QuizGenerationContextService,
    @Inject(QuizFigureJobService)
    private readonly quizFigureJobs: QuizFigureJobService,
    @Inject(QuizFigureArtifactService)
    private readonly quizFigureArtifacts: QuizFigureArtifactService,
    @Optional()
    @Inject(AiProviderCallService)
    private readonly providerCall?: AiProviderCallService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput> {
    if (isSolutionRefinementJob(context)) {
      return this.generateSolutionRefinement(context);
    }
    if (!context.lessonId || !isQuizAssessmentJob(context)) {
      throw new UnrecoverableError(
        "Assessment generation requires a QUIZ or versioned TEST job with lessonId.",
      );
    }
    const input = parseJobInput(quizGenerationJobInputSchema, context.inputMeta, "quiz");
    const draft = await this.prisma.quizGenerationRequestDraft.findFirst({
      where: { id: input.requestDraftId, lessonId: context.lessonId },
    });
    if (
      !draft ||
      draft.requestHash !== input.requestHash ||
      draft.packetHash !== input.packetHash ||
      draft.manifestHash !== input.manifestHash
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Không tìm thấy request draft Quiz bất biến khớp với job.",
      );
    }
    const currentSourceHash = await this.generationContext.computeCurrentSourceHash(
      context.lessonId,
      input.documentIds,
    );
    if (currentSourceHash !== input.sourceHash) {
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Tài liệu buổi học đã thay đổi sau khi job được tạo.",
      );
    }
    const packetBytes = await this.generationContext.downloadPacket(
      draft.packetObjectKey,
    );
    const packetHash = createHash("sha256").update(packetBytes).digest("hex");
    if (
      packetHash !== draft.packetHash ||
      BigInt(packetBytes.length) !== draft.packetSizeBytes
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_PACKET_INVALID: Packet PDF Quiz không còn khớp snapshot.",
      );
    }
    const sourceSnapshot = asRecord(draft.sourceSnapshotJson);
    readQuizPacketManifest(draft.manifestJson);
    const request = buildQuizStructuredInput({
      lessonId: context.lessonId,
      lessonTitle: readRequiredText(sourceSnapshot.lessonTitle, "lessonTitle"),
      documentIds: input.documentIds,
      sourceHash: input.sourceHash,
      packet: {
        filename: draft.packetFilename,
        bytes: packetBytes,
      },
      configuration: {
        ...input,
        systemInstructions: draft.systemInstructions,
        userPrompt: draft.userPrompt,
      },
    });
    const providerSchema = getGeneratedQuizOutputSchema({
      subjectKey: input.subjectKey,
      targetGrade: input.targetGrade,
      questionCount: input.questionCount,
      questionTypes: input.questionTypes,
      difficulty: input.difficulty,
      includeSourceCoverageAudit: !input.systemInstructions,
    });
    const schemaHash = hashAiValue(
      buildAiStructuredTextFormat(
        providerSchema,
        request.outputName,
        request.schemaReferenceStrategy,
      ).schema,
    );
    if (schemaHash !== draft.schemaHash) {
      throw new UnrecoverableError(
        "AI_INPUT_SCHEMA_STALE: Output schema Quiz đã thay đổi sau khi preview.",
      );
    }
    let output;
    try {
      output = this.providerCall
        ? await this.providerCall.generateStructured(
            providerContext(context),
            request,
            providerSchema,
          )
        : await this.aiService.generateStructured(request, providerSchema);
    } finally {
      await this.generationContext
        .cleanupPacket(draft.packetObjectKey)
        .catch(() => undefined);
    }
    const normalizedQuestions = output.data.questions.map(
      normalizeGeneratedQuizQuestionContent,
    );
    const sourceCoverageAudit =
      "sourceCoverageAudit" in output.data
        ? generatedQuizSourceCoverageAuditSchema.parse(output.data.sourceCoverageAudit)
        : undefined;
    const validation = validateQuizOutput({
      questions: normalizedQuestions,
      sourceCoverageAudit,
      requestedCount: input.questionCount,
      requestedTypes: input.questionTypes,
      requestedDifficulty: input.difficulty,
      difficultyCounts: input.difficultyCounts,
    });
    return {
      action: "QUIZ",
      output: {
        ...output,
        data: { ...output.data, questions: validation.questions },
      },
      contextMetadata: validation.metadata,
    };
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (isSolutionRefinementJob(context)) {
      return this.persistSolutionRefinement(context, prepared);
    }
    if (!context.lessonId || !isQuizAssessmentJob(context)) {
      throw new UnrecoverableError(
        "Assessment persistence requires a QUIZ or versioned TEST job with lessonId.",
      );
    }
    const input = parseJobInput(quizGenerationJobInputSchema, context.inputMeta, "quiz");
    const output = parseAiStructuredOutput(
      getGeneratedQuizOutputSchema({
        subjectKey: input.subjectKey,
        targetGrade: input.targetGrade,
        questionCount: input.questionCount,
        questionTypes: input.questionTypes,
        difficulty: input.difficulty,
        includeSourceCoverageAudit: !input.systemInstructions,
      }),
      prepared.output.data,
    );
    const normalizedQuestions = output.questions.map(
      normalizeGeneratedQuizQuestionContent,
    );
    const persisted = await this.prisma.$transaction(async (tx) => {
      const isTest = input.assessmentKind === "TEST";
      const set = isTest
        ? await tx.testSet.findFirst({
            where: {
              id: input.targetTestSetId ?? undefined,
              lessonId: context.lessonId!,
              deletedAt: null,
            },
            select: { id: true, questionCount: true, durationSeconds: true },
          })
        : await tx.quizSet.findFirst({
            where: {
              id: input.targetQuizSetId ?? undefined,
              lessonId: context.lessonId!,
              deletedAt: null,
            },
            select: { id: true, questionCount: true },
          });
      if (!set) {
        throw new UnrecoverableError(
          isTest
            ? "TEST_TARGET_SET_NOT_FOUND: The selected Test set no longer exists."
            : "QUIZ_TARGET_SET_NOT_FOUND: The selected Quiz set no longer exists.",
        );
      }
      if (
        isTest &&
        (!input.durationSeconds ||
          ("durationSeconds" in set && set.durationSeconds !== input.durationSeconds))
      ) {
        throw new UnrecoverableError(
          "TEST_TARGET_DURATION_STALE: Test duration changed after preview.",
        );
      }
      const lastQuestion = isTest
        ? await tx.testQuestion.findFirst({
            where: { testSetId: set.id, deletedAt: null },
            orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
            select: { sortOrder: true },
          })
        : await tx.quizQuestion.findFirst({
            where: { quizSetId: set.id, deletedAt: null },
            orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
            select: { sortOrder: true },
          });
      const firstSortOrder = (lastQuestion?.sortOrder ?? -1) + 1;
      const mappingIssues: GenerationRecoveryIssue[] = [];
      const figureIds: string[] = [];
      for (const [index, question] of normalizedQuestions.entries()) {
        const created = await createGeneratedAssessmentQuestion(
          tx,
          set.id,
          context,
          question,
          firstSortOrder + index,
          index,
          input.subjectKey,
          input.subjectName,
          input.subjectSlug,
        );
        mappingIssues.push(...created.recoveryIssues);
        figureIds.push(...created.figureIds);
      }
      if (isTest)
        await tx.testSet.update({
          where: { id: set.id },
          data: {
            questionCount: set.questionCount + normalizedQuestions.length,
            updatedById: context.ownerUserId,
          },
        });
      else
        await tx.quizSet.update({
          where: { id: set.id },
          data: {
            questionCount: set.questionCount + normalizedQuestions.length,
            updatedById: context.ownerUserId,
          },
        });
      const recovery = readRecoveryMetadata(prepared.contextMetadata);
      const generationIssues = [...recovery.issues, ...mappingIssues];
      const generationAudit = {
        requestedCount: input.questionCount,
        initialGeneratedCount:
          recovery.initialGeneratedCount > 0
            ? recovery.initialGeneratedCount
            : normalizedQuestions.length,
        currentActiveCount: normalizedQuestions.length,
        deletedCount: 0,
      };
      await tx.aiGeneration.update({
        where: { id: context.aiGenerationId },
        data: {
          inputMetaJson: json({
            ...asRecord(context.inputMeta),
            generationAudit,
            generationIssues,
          }),
        },
      });
      await auditGeneratedAssessment(tx, context, set.id, isTest);
      return {
        figureIds,
        response: {
          resourceType: isTest ? "TEST_SET" : "QUIZ_SET",
          resourceId: set.id,
          message:
            generationIssues.length > 0
              ? `Đã thêm câu hỏi AI vào bộ ${isTest ? "Test" : "Quiz"} và giữ các mục cần admin kiểm tra.`
              : `Đã thêm câu hỏi AI vào bộ ${isTest ? "Test" : "Quiz"}.`,
          result: {
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            itemCount: normalizedQuestions.length,
            generationAudit,
            generationIssues,
          },
        },
      };
    });
    const imageRouteSnapshot =
      readImageRouteSnapshot(input.imageRouteSnapshot) ?? context.providerRouteSnapshot;
    await Promise.all(
      persisted.figureIds.map((figureId) =>
        this.quizFigureJobs.enqueue(figureId, context.ownerUserId, imageRouteSnapshot),
      ),
    );
    return persisted.response;
  }

  private async generateSolutionRefinement(
    context: AiGenerationExecutionContext,
  ): Promise<
    AiGenerationPreparedOutput<
      QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput
    >
  > {
    if (!context.lessonId || !isSolutionRefinementJob(context)) {
      throw new UnrecoverableError(
        "Solution refinement requires a Quiz job or a versioned Test job with lessonId.",
      );
    }
    const input = parseJobInput(
      quizSolutionRefinementJobInputSchema,
      context.inputMeta,
      "quiz solution refinement",
    );
    const target = resolveSolutionRefinementTarget(context, input);
    const targetContext = await this.assertSolutionSnapshotCurrent(input, target);
    const questionImageDataUrl =
      input.mode === "REGENERATE" && input.questionFigure
        ? await buildQuizFigureRefinementImageDataUrl(
            await this.quizFigureArtifacts.readDeliveryObject(
              input.questionFigure.objectKey,
            ),
          )
        : null;
    const commonInput = {
      subject: {
        key: input.subjectKey,
        name: input.subjectName,
        slug: input.subjectSlug,
      },
      targetGrade: input.targetGrade,
      question: input.questionSnapshot,
      adminInstructions: input.adminInstructions,
      questionImageDataUrl,
      includeCurrentSolutionAsRejected: input.includeCurrentSolutionAsRejected,
    };
    const request =
      input.mode === "REFINE"
        ? buildQuizSolutionRefinementInput(commonInput)
        : buildQuizSolutionRegenerationInput(commonInput);
    const generate = <TOutput>(schema: AiOutputSchema<TOutput>) =>
      this.providerCall
        ? this.providerCall.generateStructured(
            providerContext(context, {
              callSequence: 1,
              operation:
                input.mode === "REFINE"
                  ? target.refinementOperation
                  : target.regenerationOperation,
              targetContext,
            }),
            request,
            schema,
          )
        : this.aiService.generateStructured(request, schema);
    const output =
      input.mode === "REGENERATE"
        ? input.questionSnapshot.questionType === QuestionType.MULTIPLE_CHOICE
          ? await generate(multipleChoiceQuizSolutionRegenerationOutputSchema)
          : input.questionSnapshot.questionType === QuestionType.TRUE_FALSE
            ? await generate(trueFalseQuizSolutionRegenerationOutputSchema)
            : input.questionSnapshot.questionType ===
                QuestionType.MULTI_STATEMENT_TRUE_FALSE
              ? await generate(multiStatementQuizSolutionRegenerationOutputSchema)
              : await generate(textInputQuizSolutionRegenerationOutputSchema)
        : isMultiStatementQuizSolutionRefinement(input.questionSnapshot.questionType)
          ? await generate(multiStatementQuizSolutionRefinementOutputSchema)
          : await generate(singleQuizSolutionRefinementOutputSchema);
    assertSolutionOperationOutputMatchesQuestion(input, output.data);
    return {
      action: target.refinementTargetType,
      output,
      recordedOutput: { mode: input.mode, result: output.data },
    };
  }

  private async persistSolutionRefinement(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    const input = parseJobInput(
      quizSolutionRefinementJobInputSchema,
      context.inputMeta,
      "quiz solution refinement",
    );
    const target = resolveSolutionRefinementTarget(context, input);
    const output = parseSolutionOperationOutput(input, prepared.output.data);
    assertSolutionOperationOutputMatchesQuestion(input, output);
    const refinedSolution = toSolutionText(output);

    return this.prisma.$transaction(async (tx) => {
      const questionQuery = {
        where: { id: input.questionId, deletedAt: null },
        include: {
          explanation: true,
          figures: {
            where: { role: "QUESTION", deletedAt: null, status: "SUCCEEDED" },
            take: 1,
            include: { currentRevision: { include: { deliveryFile: true } } },
          },
        },
      } as const;
      const question =
        target.kind === "TEST"
          ? await tx.testQuestion.findFirst(questionQuery)
          : await tx.quizQuestion.findFirst(questionQuery);
      if (!question) {
        throw new UnrecoverableError(
          `${target.code}_QUESTION_NOT_FOUND: Câu ${target.label} không còn tồn tại.`,
        );
      }
      if (hashAiValue(buildStoredQuestionSnapshot(question)) !== input.baseContentHash) {
        throw new UnrecoverableError(
          `${target.code}_SOLUTION_REFINEMENT_CONFLICT: Nội dung câu ${target.label} đã đổi sau khi job bắt đầu.`,
        );
      }
      const metadata = asRecord(question.sourceMetadataJson);
      const existingBlock = asRecord(metadata.quizExplanationBlock);
      const explanationBlock = {
        ...existingBlock,
        type: "quizExplanation",
        problem:
          typeof existingBlock.problem === "string"
            ? existingBlock.problem
            : input.questionSnapshot.problem,
        solution: refinedSolution,
      };
      const explanationJson = toQuizSolutionTiptap(refinedSolution);
      let explanationId = question.explanationId;
      if (explanationId) {
        await tx.aiExplanation.update({
          where: { id: explanationId },
          data: {
            contentJson: json(explanationJson),
            source: ContentSource.AI,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            staleAt: null,
          },
        });
      } else {
        explanationId = randomUUID();
        await tx.aiExplanation.create({
          data: {
            id: explanationId,
            targetType:
              target.kind === "TEST"
                ? AiExplanationTargetType.TEST_QUESTION
                : AiExplanationTargetType.QUIZ_QUESTION,
            targetId: question.id,
            lessonId: question.lessonId,
            contentJson: json(explanationJson),
            source: ContentSource.AI,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            aiGenerationId: context.aiGenerationId,
            targetContentHash: hashAiValue(question.questionJson),
            sourceContextHash: null,
          },
        });
      }
      const updatedMetadata = {
        ...metadata,
        quizExplanationBlock: explanationBlock,
      };
      const questionUpdateData = {
        sourceMetadataJson: json(updatedMetadata),
        explanationId,
        ...(input.mode === "REGENERATE"
          ? {
              correctAnswerJson: json(
                toRegeneratedCorrectAnswer(input.questionSnapshot.questionType, output),
              ),
              hintJson: json(toQuizTiptap(readRegeneratedHint(output))),
            }
          : {}),
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      };
      if (target.kind === "TEST") {
        await tx.testQuestion.update({
          where: { id: question.id },
          data: questionUpdateData,
        });
      } else {
        await tx.quizQuestion.update({
          where: { id: question.id },
          data: { ...questionUpdateData, publishedAt: null },
        });
      }
      await syncSolutionOperationToGenerationOutput(tx, {
        sourceMetadataJson: updatedMetadata,
        mode: input.mode,
        questionType: input.questionSnapshot.questionType,
        output,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: context.ownerUserId,
          action:
            input.mode === "REFINE"
              ? `${target.code}_SOLUTION_AI_REFINED`
              : `${target.code}_SOLUTION_AI_REGENERATED`,
          entityType: target.kind === "TEST" ? "TestQuestion" : "QuizQuestion",
          entityId: question.id,
          before: toJobJson({ contentHash: input.baseContentHash }),
          after: toJobJson({
            mode: input.mode,
            solutionHash: hashAiValue(refinedSolution),
          }),
          metadata: toJobJson({
            backgroundJobId: context.backgroundJobId,
            aiGenerationId: context.aiGenerationId,
          }),
        },
      });
      return {
        resourceType: target.refinementTargetType,
        resourceId: question.id,
        message:
          input.mode === "REFINE"
            ? `Đã tinh chỉnh lời giải ${target.label} bằng AI và chuyển câu về trạng thái cần duyệt.`
            : `Đã tạo lại đáp án, gợi ý và lời giải ${target.label} bằng AI; câu cần được duyệt lại.`,
        result: { questionId: question.id, reviewStatus: ReviewStatus.NEEDS_REVIEW },
      };
    });
  }

  private async assertSolutionSnapshotCurrent(
    input: QuizSolutionRefinementJobInput,
    target: SolutionRefinementTarget,
  ) {
    const questionQuery = {
      where: { id: input.questionId, deletedAt: null },
      select: {
        questionType: true,
        questionJson: true,
        optionsJson: true,
        correctAnswerJson: true,
        hintJson: true,
        sourceMetadataJson: true,
        sortOrder: true,
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
      },
    } as const;
    const question =
      target.kind === "TEST"
        ? await this.prisma.testQuestion.findFirst(questionQuery)
        : await this.prisma.quizQuestion.findFirst(questionQuery);
    if (!question) {
      throw new UnrecoverableError(
        `${target.code}_QUESTION_NOT_FOUND: Câu ${target.label} không còn tồn tại.`,
      );
    }
    if (hashAiValue(buildStoredQuestionSnapshot(question)) !== input.baseContentHash) {
      throw new UnrecoverableError(
        `${target.code}_SOLUTION_REFINEMENT_CONFLICT: Nội dung câu ${target.label} đã đổi trước khi gọi AI.`,
      );
    }
    return buildItemUsageTarget({
      kind: target.kind === "TEST" ? "TEST_QUESTION" : "QUIZ_QUESTION",
      entityId: input.questionId,
      sortOrder: question.sortOrder,
    });
  }
}

function parseSolutionOperationOutput(
  input: QuizSolutionRefinementJobInput,
  value: unknown,
): QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput {
  if (input.mode === "REFINE") {
    return isMultiStatementQuizSolutionRefinement(input.questionSnapshot.questionType)
      ? parseAiStructuredOutput(multiStatementQuizSolutionRefinementOutputSchema, value)
      : parseAiStructuredOutput(singleQuizSolutionRefinementOutputSchema, value);
  }
  switch (input.questionSnapshot.questionType) {
    case QuestionType.MULTIPLE_CHOICE:
      return parseAiStructuredOutput(
        multipleChoiceQuizSolutionRegenerationOutputSchema,
        value,
      );
    case QuestionType.TRUE_FALSE:
      return parseAiStructuredOutput(
        trueFalseQuizSolutionRegenerationOutputSchema,
        value,
      );
    case QuestionType.MULTI_STATEMENT_TRUE_FALSE:
      return parseAiStructuredOutput(
        multiStatementQuizSolutionRegenerationOutputSchema,
        value,
      );
    case QuestionType.TEXT_INPUT:
      return parseAiStructuredOutput(
        textInputQuizSolutionRegenerationOutputSchema,
        value,
      );
  }
}

function assertSolutionOperationOutputMatchesQuestion(
  input: QuizSolutionRefinementJobInput,
  output: QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput,
) {
  const expectedIds = input.questionSnapshot.options.map((option) => option.id);
  if (input.questionSnapshot.questionType === QuestionType.MULTIPLE_CHOICE) {
    if (
      input.mode === "REGENERATE" &&
      (!("correctOptionId" in output) || !expectedIds.includes(output.correctOptionId))
    ) {
      throw new UnrecoverableError(
        "QUIZ_SOLUTION_REGENERATION_OUTPUT_INVALID: correctOptionId không thuộc phương án hiện có.",
      );
    }
    return;
  }
  if (input.questionSnapshot.questionType !== QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    return;
  }
  if (!("statementSolutions" in output)) {
    throw new UnrecoverableError(
      "QUIZ_SOLUTION_REFINEMENT_OUTPUT_INVALID: Thiếu lời giải đã tinh chỉnh.",
    );
  }
  assertOrderedIds(
    expectedIds,
    output.statementSolutions.map((item) => item.statementId),
  );
  if (input.mode === "REGENERATE") {
    if (!("statementAnswers" in output)) {
      throw new UnrecoverableError(
        "QUIZ_SOLUTION_REGENERATION_OUTPUT_INVALID: Thiếu đáp án theo mệnh đề.",
      );
    }
    assertOrderedIds(
      expectedIds,
      output.statementAnswers.map((item) => item.statementId),
    );
  }
}

function assertOrderedIds(expected: string[], actual: string[]) {
  if (
    expected.length !== actual.length ||
    expected.some((id, index) => id !== actual[index])
  ) {
    throw new UnrecoverableError(
      "QUIZ_SOLUTION_REFINEMENT_OUTPUT_INVALID: statementId không khớp câu Quiz hiện tại.",
    );
  }
}

function toSolutionText(
  output: QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput,
) {
  const solution =
    "solution" in output
      ? output.solution.trim()
      : output.statementSolutions
          .map(({ statementId, solution }) => `**${statementId})** ${solution.trim()}`)
          .join("\n\n");
  return normalizeQuizConclusionParagraph(normalizeQuizLearnerText(solution));
}

function readCurrentStoredSolution(sourceMetadata: unknown, explanationJson: unknown) {
  const block = asRecord(asRecord(sourceMetadata).quizExplanationBlock);
  if (typeof block.solution === "string" && block.solution.trim()) {
    return block.solution.trim();
  }
  return serializeQuizRichText(explanationJson).trim();
}

function buildStoredQuestionSnapshot(question: {
  questionType: QuestionType;
  questionJson: unknown;
  optionsJson: unknown;
  correctAnswerJson: unknown;
  hintJson: unknown;
  sourceMetadataJson: unknown;
  explanation?: { contentJson: unknown } | null;
  figures?: Array<{
    currentRevision?: {
      id: string;
      status: string;
      deliveryFile?: {
        objectKey: string;
        mimeType: string;
        checksum: string | null;
      } | null;
    } | null;
  }>;
}) {
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
  const questionSnapshot = {
    questionType: question.questionType,
    problem: serializeQuizRichText(question.questionJson).trim(),
    options: readStoredOptions(question.optionsJson),
    correctAnswer: question.correctAnswerJson,
    currentHint: serializeQuizRichText(question.hintJson).trim() || null,
    currentSolution: readCurrentStoredSolution(
      question.sourceMetadataJson,
      question.explanation?.contentJson,
    ),
  };
  return { questionSnapshot, questionFigure };
}

function readStoredOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    const record = asRecord(option);
    if (typeof record.id !== "string") return [];
    const text = serializeQuizRichText(record.richText).trim();
    return text ? [{ id: record.id, text }] : [];
  });
}

function readRegeneratedHint(
  output: QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput,
) {
  if (!("hint" in output)) {
    throw new UnrecoverableError(
      "QUIZ_SOLUTION_REGENERATION_OUTPUT_INVALID: Thiếu hint.",
    );
  }
  return output.hint;
}

function toRegeneratedCorrectAnswer(
  questionType: QuestionType,
  output: QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput,
) {
  switch (questionType) {
    case QuestionType.MULTIPLE_CHOICE:
      if (!("correctOptionId" in output)) break;
      return [output.correctOptionId];
    case QuestionType.TRUE_FALSE:
      if (!("correctAnswer" in output) || typeof output.correctAnswer !== "boolean")
        break;
      return output.correctAnswer;
    case QuestionType.MULTI_STATEMENT_TRUE_FALSE:
      if (!("statementAnswers" in output)) break;
      return output.statementAnswers;
    case QuestionType.TEXT_INPUT:
      if (!("correctAnswer" in output) || typeof output.correctAnswer !== "string") break;
      return [output.correctAnswer];
  }
  throw new UnrecoverableError(
    "QUIZ_SOLUTION_REGENERATION_OUTPUT_INVALID: Đáp án không khớp loại câu.",
  );
}

async function syncSolutionOperationToGenerationOutput(
  tx: Prisma.TransactionClient,
  input: {
    sourceMetadataJson: unknown;
    mode: QuizSolutionRefinementJobInput["mode"];
    questionType: QuestionType;
    output: QuizSolutionRefinementOutput | QuizSolutionRegenerationOutput;
  },
) {
  const reference = readQuizGenerationQuestionReference(input.sourceMetadataJson);
  if (!reference) return;
  const generation = await tx.aiGeneration.findUnique({
    where: { id: reference.aiGenerationId },
    select: { outputJson: true },
  });
  if (!generation) return;
  const currentQuestion = readQuizGenerationQuestion(
    generation.outputJson,
    reference.generationQuestionIndex,
  );
  if (!currentQuestion) return;
  const explanation = asRecord(currentQuestion.explanation);
  if ("solution" in input.output) {
    explanation.solution = input.output.solution;
    delete explanation.statementSolutions;
  } else {
    explanation.statementSolutions = input.output.statementSolutions;
    delete explanation.solution;
  }
  currentQuestion.explanation = explanation;
  if (input.mode === "REGENERATE") {
    currentQuestion.hint = readRegeneratedHint(input.output);
    switch (input.questionType) {
      case QuestionType.MULTIPLE_CHOICE:
        if (!("correctOptionId" in input.output)) break;
        currentQuestion.correctOptionId = input.output.correctOptionId;
        break;
      case QuestionType.TRUE_FALSE:
        if (!("correctAnswer" in input.output)) break;
        currentQuestion.correctAnswer = input.output.correctAnswer;
        break;
      case QuestionType.TEXT_INPUT:
        if (!("correctAnswer" in input.output)) break;
        currentQuestion.correctAnswer = input.output.correctAnswer;
        break;
      case QuestionType.MULTI_STATEMENT_TRUE_FALSE: {
        if (!("statementAnswers" in input.output)) break;
        const answers = input.output.statementAnswers;
        const byId = new Map(
          answers.map((item: { statementId: string; value: boolean }) => [
            item.statementId,
            item.value,
          ]),
        );
        if (Array.isArray(currentQuestion.statements)) {
          currentQuestion.statements = currentQuestion.statements.map((statement) => {
            const record = asRecord(statement);
            return { ...record, value: byId.get(String(record.id)) ?? record.value };
          });
        }
        break;
      }
    }
  }
  const updatedOutput = replaceQuizGenerationQuestionOutput(
    generation.outputJson,
    reference.generationQuestionIndex,
    currentQuestion,
  );
  if (!updatedOutput) return;
  await tx.aiGeneration.update({
    where: { id: reference.aiGenerationId },
    data: { outputJson: json(updatedOutput), outputHash: hashAiValue(updatedOutput) },
  });
}

function readImageRouteSnapshot(value: unknown): AiFeatureRoute | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AiFeatureRoute)
    : undefined;
}

function providerContext(
  context: AiGenerationExecutionContext,
  options?: {
    callSequence?: number;
    operation?: ProviderUsageOperation;
    targetContext?: ReturnType<typeof buildItemUsageTarget>;
  },
) {
  return {
    feature: context.type,
    aiGenerationId: context.aiGenerationId,
    backgroundJobId: context.backgroundJobId,
    attempt: context.attempt,
    ...(options?.callSequence === undefined
      ? {}
      : { callSequence: options.callSequence }),
    ...(options?.operation === undefined ? {} : { operation: options.operation }),
    targetContext:
      options?.targetContext ??
      buildWholeFeatureUsageTarget(context.type, context.aiGenerationId),
    routeSnapshot: context.providerRouteSnapshot,
  };
}

async function createGeneratedAssessmentQuestion(
  tx: Prisma.TransactionClient,
  setId: string,
  context: AiGenerationExecutionContext,
  question: GeneratedQuizQuestion,
  sortOrder: number,
  questionIndex: number,
  subjectKey: string,
  subjectName: string,
  subjectSlug: string,
) {
  const isTest = isAssessmentTestMeta(context.inputMeta);
  const mapped = mapGeneratedQuizQuestion(question);
  const id = randomUUID();
  const explanationId = randomUUID();
  await tx.aiExplanation.create({
    data: {
      id: explanationId,
      targetType: isTest
        ? AiExplanationTargetType.TEST_QUESTION
        : AiExplanationTargetType.QUIZ_QUESTION,
      targetId: id,
      lessonId: context.lessonId!,
      contentJson: json(mapped.explanationJson),
      source: ContentSource.AI,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      aiGenerationId: context.aiGenerationId,
      targetContentHash: hashAiValue(mapped.questionJson),
      sourceContextHash: null,
    },
  });
  const questionData = {
    id,
    lessonId: context.lessonId!,
    questionType: mapped.questionType,
    questionJson: json(mapped.questionJson),
    optionsJson: nullableJson(mapped.optionsJson),
    correctAnswerJson: json(mapped.correctAnswerJson),
    hintJson: nullableJson(mapped.hintJson),
    gradingConfigJson: nullableJson(mapped.gradingConfigJson),
    sourceMetadataJson: json({
      aiGenerationId: context.aiGenerationId,
      generationQuestionIndex: questionIndex,
      quizExplanationBlock: mapped.explanationBlock,
    }),
    difficulty: mapped.difficulty,
    reviewStatus: ReviewStatus.NEEDS_REVIEW,
    explanationId,
    sortOrder,
  };
  if (isTest)
    await tx.testQuestion.create({
      data: { ...questionData, testSetId: setId, points: null },
    });
  else await tx.quizQuestion.create({ data: { ...questionData, quizSetId: setId } });
  const figureIds: string[] = [];
  if (question.figure.requiresQuestionFigure) {
    const questionFigure = await tx.quizFigure.create({
      data: {
        lessonId: context.lessonId!,
        ...(isTest ? { testQuestionId: id } : { quizQuestionId: id }),
        role: "QUESTION",
        aiGenerationId: context.aiGenerationId,
        planJson: json({
          version: 1,
          role: "QUESTION",
          problem: question.explanation.problem,
        }),
        subjectKey,
        subjectName,
        subjectSlug,
        status: "QUEUED",
        createdById: context.ownerUserId,
      },
      select: { id: true },
    });
    figureIds.push(questionFigure.id);
    const questionRevision = await tx.quizFigureRevision.create({
      data: {
        quizFigureId: questionFigure.id,
        origin: "INITIAL_AI",
        status: "QUEUED",
        sourceVersion: 1,
        altText: buildQuestionFigureAltText(question.explanation.problem),
        createdById: context.ownerUserId,
      },
      select: { id: true },
    });
    await tx.quizFigure.update({
      where: { id: questionFigure.id },
      data: { pendingRevisionId: questionRevision.id },
    });
  }
  if (question.figure.solutionFigure) {
    const solutionFigure = await tx.quizFigure.create({
      data: {
        lessonId: context.lessonId!,
        ...(isTest ? { testQuestionId: id } : { quizQuestionId: id }),
        role: "SOLUTION",
        aiGenerationId: context.aiGenerationId,
        planJson: json({
          version: 2,
          role: "SOLUTION",
          problem: question.explanation.problem,
          solution: getGeneratedQuizSolutionText(question),
        }),
        subjectKey,
        subjectName,
        subjectSlug,
        status: "QUEUED",
        createdById: context.ownerUserId,
      },
      select: { id: true },
    });
    figureIds.push(solutionFigure.id);
    const solutionRevision = await tx.quizFigureRevision.create({
      data: {
        quizFigureId: solutionFigure.id,
        origin: "INITIAL_AI",
        status: "QUEUED",
        sourceVersion: 1,
        altText: `Hình lời giải cho ${buildQuestionFigureAltText(question.explanation.problem)}`,
        createdById: context.ownerUserId,
      },
      select: { id: true },
    });
    await tx.quizFigure.update({
      where: { id: solutionFigure.id },
      data: { pendingRevisionId: solutionRevision.id },
    });
  }
  return {
    figureIds,
    recoveryIssues: mapped.recoveryIssues.map((issue) => ({
      ...issue,
      questionIndex,
      blocking: false,
    })),
  };
}

async function auditGeneratedAssessment(
  tx: Prisma.TransactionClient,
  context: AiGenerationExecutionContext,
  entityId: string,
  isTest: boolean,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: context.ownerUserId,
      action: isTest ? "TEST_SET_AI_GENERATED" : "QUIZ_SET_AI_GENERATED",
      entityType: isTest ? "TestSet" : "QuizSet",
      entityId,
      after: toJobJson({
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      }),
      metadata: toJobJson({
        backgroundJobId: context.backgroundJobId,
        aiGenerationId: context.aiGenerationId,
      }),
    },
  });
}

function isAssessmentTestMeta(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).assessmentKind === "TEST",
  );
}

function isQuizAssessmentJob(context: AiGenerationExecutionContext) {
  return (
    context.type === AiGenerationType.QUIZ ||
    (context.type === AiGenerationType.TEST && isAssessmentTestMeta(context.inputMeta))
  );
}

type SolutionRefinementTarget = {
  kind: "QUIZ" | "TEST";
  code: "QUIZ" | "TEST";
  label: "Quiz" | "Test";
  refinementTargetType:
    | typeof QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE
    | typeof TEST_SOLUTION_REFINEMENT_TARGET_TYPE;
  refinementOperation: "QUIZ_SOLUTION_REFINEMENT" | "TEST_SOLUTION_REFINEMENT";
  regenerationOperation: "QUIZ_SOLUTION_REGENERATION" | "TEST_SOLUTION_REGENERATION";
};

function isSolutionRefinementJob(context: AiGenerationExecutionContext) {
  return (
    (context.type === AiGenerationType.QUIZ &&
      context.targetType === QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE) ||
    (context.type === AiGenerationType.TEST &&
      context.targetType === TEST_SOLUTION_REFINEMENT_TARGET_TYPE &&
      isAssessmentTestMeta(context.inputMeta) &&
      asRecord(context.inputMeta).pipelineVersion === "ASSESSMENT_QUIZ_V1")
  );
}

export function resolveSolutionRefinementTarget(
  context: AiGenerationExecutionContext,
  input: QuizSolutionRefinementJobInput,
): SolutionRefinementTarget {
  const isVersionedTest = input.assessmentKind === "TEST";
  if (isVersionedTest) {
    if (
      context.type !== AiGenerationType.TEST ||
      context.targetType !== TEST_SOLUTION_REFINEMENT_TARGET_TYPE ||
      context.targetId !== input.targetQuestionId ||
      input.targetQuestionId !== input.questionId
    ) {
      throw new UnrecoverableError(
        "TEST_SOLUTION_REFINEMENT_TARGET_INVALID: Metadata Test không khớp target job.",
      );
    }
    return {
      kind: "TEST",
      code: "TEST",
      label: "Test",
      refinementTargetType: TEST_SOLUTION_REFINEMENT_TARGET_TYPE,
      refinementOperation: "TEST_SOLUTION_REFINEMENT",
      regenerationOperation: "TEST_SOLUTION_REGENERATION",
    };
  }
  if (
    context.type !== AiGenerationType.QUIZ ||
    context.targetType !== QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE ||
    (input.targetQuestionId !== undefined &&
      input.targetQuestionId !== input.questionId) ||
    (context.targetId !== null && context.targetId !== input.questionId)
  ) {
    throw new UnrecoverableError(
      "QUIZ_SOLUTION_REFINEMENT_TARGET_INVALID: Metadata Quiz không khớp target job.",
    );
  }
  return {
    kind: "QUIZ",
    code: "QUIZ",
    label: "Quiz",
    refinementTargetType: QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE,
    refinementOperation: "QUIZ_SOLUTION_REFINEMENT",
    regenerationOperation: "QUIZ_SOLUTION_REGENERATION",
  };
}

function readRecoveryMetadata(value: unknown): {
  initialGeneratedCount: number;
  issues: GenerationRecoveryIssue[];
} {
  const record = asRecord(value);
  return {
    initialGeneratedCount:
      typeof record.initialGeneratedCount === "number" ? record.initialGeneratedCount : 0,
    issues: Array.isArray(record.issues)
      ? (record.issues as GenerationRecoveryIssue[])
      : [],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJobInput<T>(
  schema: {
    safeParse(
      value: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message: string }> } };
  },
  value: unknown,
  name: string,
): T {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).filter(
            ([key]) => key !== "providerRouteSnapshot",
          ),
        )
      : value;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new UnrecoverableError(
      `Invalid ${name} generation input: ${parsed.error.issues[0]?.message ?? "unknown error"}`,
    );
  }
  return parsed.data;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function nullableJson(value: unknown | null) {
  return value === null ? Prisma.DbNull : json(value);
}

function readRequiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UnrecoverableError(`AI_INPUT_SNAPSHOT_INVALID: Thiếu trường ${field}.`);
  }
  return value;
}

function readQuizPacketManifest(value: unknown) {
  const record = asRecord(value);
  if (record.version !== 1 || !Array.isArray(record.pages)) {
    throw new UnrecoverableError(
      "AI_INPUT_MANIFEST_INVALID: Manifest packet PDF Quiz không hợp lệ.",
    );
  }
  return {
    pages: record.pages.map((rawPage) => {
      const page = asRecord(rawPage);
      const packetPageNumber = Number(page.packetPageNumber);
      const sourcePdfPageNumber = Number(page.sourcePdfPageNumber);
      if (!Number.isInteger(packetPageNumber) || !Number.isInteger(sourcePdfPageNumber)) {
        throw new UnrecoverableError(
          "AI_INPUT_MANIFEST_INVALID: Số trang trong manifest Quiz không hợp lệ.",
        );
      }
      return {
        packetPageNumber,
        sourcePdfPageNumber,
        sourceKey: readRequiredText(page.sourceKey, "sourceKey"),
        documentTitle: readRequiredText(page.documentTitle, "documentTitle"),
        printedPageLabel:
          typeof page.printedPageLabel === "string" ? page.printedPageLabel : null,
      };
    }),
  };
}

function buildQuestionFigureAltText(problem: string) {
  const compact = problem.replace(/\s+/gu, " ").trim();
  return `Hình minh họa cho đề bài: ${compact}`.slice(0, 1_000);
}
