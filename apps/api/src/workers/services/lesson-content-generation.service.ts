import { randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  AiExplanationTargetType,
  AiGenerationType,
  ContentSource,
  Difficulty,
  Prisma,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import { AiService } from "#api/modules/ai/services/ai.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import {
  LessonContentContextError,
  LessonContentGenerationContextService,
} from "#api/modules/ai/services/lesson-content-generation-context.service";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import {
  flashcardGenerationJobInputSchema,
  generatedFlashcardOutputSchema,
  generatedQuizOutputSchema,
  generatedTestOutputSchema,
  LESSON_CONTENT_MAX_OUTPUT_TOKENS,
  LESSON_CONTENT_PROMPT_VERSION,
  LESSON_CONTENT_SCHEMA_VERSION,
  quizGenerationJobInputSchema,
  testGenerationJobInputSchema,
  type GeneratedQuestion,
} from "#api/modules/ai/types/lesson-content-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import {
  assertGeneratedContent,
  mapGeneratedQuestion,
  toTiptap,
} from "#api/modules/ai/utils/lesson-content-generation-mapper";
import {
  buildFlashcardPrompt,
  buildQuizStructuredInput,
  buildTestPrompt,
  LESSON_CONTENT_SYSTEM_PROMPT,
} from "#api/modules/ai/utils/lesson-content-generation-prompt";

@Injectable()
export class LessonContentGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(LessonContentGenerationContextService)
    private readonly generationContext: LessonContentGenerationContextService,
    @Optional()
    @Inject(AiProviderCallService)
    private readonly providerCall?: AiProviderCallService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput> {
    if (!context.lessonId)
      throw new UnrecoverableError("AI content generation requires lessonId.");
    if (context.type === AiGenerationType.QUIZ) return this.generateQuiz(context);
    if (context.type === AiGenerationType.FLASHCARD)
      return this.generateFlashcards(context);
    if (context.type === AiGenerationType.TEST) return this.generateTest(context);
    throw new UnrecoverableError(
      `Unsupported lesson content generation type ${context.type}.`,
    );
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId)
      throw new UnrecoverableError("AI content persistence requires lessonId.");
    if (context.type === AiGenerationType.QUIZ)
      return this.persistQuiz(context, prepared);
    if (context.type === AiGenerationType.FLASHCARD)
      return this.persistFlashcards(context, prepared);
    if (context.type === AiGenerationType.TEST)
      return this.persistTest(context, prepared);
    throw new UnrecoverableError(
      `Unsupported lesson content persistence type ${context.type}.`,
    );
  }

  private async generateQuiz(context: AiGenerationExecutionContext) {
    const input = parseJobInput(quizGenerationJobInputSchema, context.inputMeta, "quiz");
    const source = await this.retrieve(
      context.lessonId!,
      input.documentIds,
      input.sourceHash,
      "kiến thức trọng tâm và bài tập ôn tập của buổi học",
    );
    const request = buildQuizStructuredInput({
      lessonId: source.lessonId,
      lessonTitle: source.lessonTitle,
      documentIds: source.documentIds,
      sourceHash: source.sourceHash,
      chunks: source.chunks.map((chunk) => ({
        id: chunk.chunkId,
        content: chunk.content,
        score: chunk.score,
        metadata: {
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          metadataJson: chunk.metadataJson,
        },
      })),
      configuration: input,
    });
    const output = this.providerCall
      ? await this.providerCall.generateStructured(
          providerContext(context),
          request,
          generatedQuizOutputSchema,
        )
      : await this.aiService.generateStructured(request, generatedQuizOutputSchema);
    const validation = validateQuestionOutput({
      questions: output.data.questions,
      requestedCount: input.questionCount,
      requestedTypes: input.questionTypes,
      requestedDifficulty: input.difficulty,
      difficultyCounts: input.difficultyCounts,
      source,
    });
    if (validation.questions.length === 0) {
      throw new UnrecoverableError(
        "AI_OUTPUT_UNRENDERABLE: No valid Quiz question could be persisted.",
      );
    }
    return {
      action: "QUIZ",
      output: {
        ...output,
        data: { ...output.data, questions: validation.questions },
      },
      contextMetadata: validation.metadata,
    };
  }

  private async generateFlashcards(context: AiGenerationExecutionContext) {
    const input = parseJobInput(
      flashcardGenerationJobInputSchema,
      context.inputMeta,
      "flashcard",
    );
    const source = await this.retrieve(
      context.lessonId!,
      input.documentIds,
      input.sourceHash,
      "khái niệm công thức định nghĩa và kiến thức cần ghi nhớ",
    );
    const request = structuredInput(
      source,
      buildFlashcardPrompt({ lessonTitle: source.lessonTitle, ...input }),
      "generated_flashcards",
    );
    const output = this.providerCall
      ? await this.providerCall.generateStructured(
          providerContext(context),
          request,
          generatedFlashcardOutputSchema,
        )
      : await this.aiService.generateStructured(request, generatedFlashcardOutputSchema);
    if (output.data.cards.length !== input.cardCount) {
      throw new UnrecoverableError(
        "AI_OUTPUT_COUNT_MISMATCH: Flashcard count does not match the request.",
      );
    }
    if (
      input.difficulty !== Difficulty.MIXED &&
      output.data.cards.some((item) => item.difficulty !== input.difficulty)
    ) {
      throw new UnrecoverableError(
        "AI_OUTPUT_DIFFICULTY_MISMATCH: Flashcard difficulty does not match the request.",
      );
    }
    assertGenerated(
      source,
      output.data.cards.map((card) => ({
        sourceChunkIds: card.sourceChunkIds,
        text: `${card.front}\n${card.back}`,
      })),
    );
    return { action: "FLASHCARD", output };
  }

  private async generateTest(context: AiGenerationExecutionContext) {
    const input = parseJobInput(testGenerationJobInputSchema, context.inputMeta, "test");
    const source = await this.retrieve(
      context.lessonId!,
      input.documentIds,
      input.sourceHash,
      "kiến thức và năng lực cần đánh giá trong bài kiểm tra",
    );
    const request = structuredInput(
      source,
      buildTestPrompt({ lessonTitle: source.lessonTitle, ...input }),
      "generated_test",
    );
    const output = this.providerCall
      ? await this.providerCall.generateStructured(
          providerContext(context),
          request,
          generatedTestOutputSchema,
        )
      : await this.aiService.generateStructured(request, generatedTestOutputSchema);
    assertQuestionOutput(
      output.data.questions,
      input.questionCount,
      input.questionTypes,
      source,
    );
    assertDifficultyRatio(output.data.questions, input.difficultyRatio);
    return { action: "TEST", output };
  }

  private async retrieve(
    lessonId: string,
    documentIds: string[],
    sourceHash: string,
    query: string,
  ) {
    try {
      return await this.generationContext.retrieve({
        lessonId,
        documentIds,
        sourceHash,
        query,
      });
    } catch (error) {
      if (error instanceof LessonContentContextError) {
        throw new UnrecoverableError(`${error.code}: ${error.message}`);
      }
      throw error;
    }
  }

  private async persistQuiz(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ) {
    const input = parseJobInput(quizGenerationJobInputSchema, context.inputMeta, "quiz");
    const output = parseAiStructuredOutput(
      generatedQuizOutputSchema,
      prepared.output.data,
    );
    return this.prisma.$transaction(async (tx) => {
      const set = await tx.quizSet.findFirst({
        where: {
          id: input.targetQuizSetId ?? undefined,
          lessonId: context.lessonId!,
          deletedAt: null,
        },
        select: { id: true, questionCount: true },
      });
      if (!set) {
        throw new UnrecoverableError(
          "QUIZ_TARGET_SET_NOT_FOUND: The selected Quiz set no longer exists.",
        );
      }
      const lastQuestion = await tx.quizQuestion.findFirst({
        where: { quizSetId: set.id, deletedAt: null },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });
      const firstSortOrder = (lastQuestion?.sortOrder ?? -1) + 1;
      const mappingIssues: GenerationRecoveryIssue[] = [];
      for (const [index, question] of output.questions.entries()) {
        mappingIssues.push(
          ...(await createGeneratedQuestion(
            tx,
            "quiz",
            set.id,
            context,
            question,
            firstSortOrder + index,
            input.sourceHash,
            index,
          )),
        );
      }
      await tx.quizSet.update({
        where: { id: set.id },
        data: {
          questionCount: set.questionCount + output.questions.length,
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
            : output.questions.length,
        currentActiveCount: output.questions.length,
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
      await auditGenerated(tx, context, "QuizSet", set.id);
      return result(
        "QUIZ_SET",
        set.id,
        generationIssues.length > 0
          ? "Đã thêm câu hỏi AI vào bộ Quiz và giữ các mục cần admin kiểm tra."
          : "Đã thêm câu hỏi AI vào bộ Quiz.",
        output.questions.length,
        { generationAudit, generationIssues },
      );
    });
  }

  private async persistFlashcards(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ) {
    const input = parseJobInput(
      flashcardGenerationJobInputSchema,
      context.inputMeta,
      "flashcard",
    );
    const output = parseAiStructuredOutput(
      generatedFlashcardOutputSchema,
      prepared.output.data,
    );
    return this.prisma.$transaction(async (tx) => {
      const sortOrder = await nextSetSortOrder(tx, "flashcard", context.lessonId!);
      const set = await tx.flashcardSet.create({
        data: {
          lessonId: context.lessonId!,
          title: output.title,
          difficulty: input.difficulty,
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          generatedByUserId: context.ownerUserId,
          aiGenerationId: context.aiGenerationId,
          cardCount: output.cards.length,
          sortOrder,
          createdById: context.ownerUserId,
          updatedById: context.ownerUserId,
        },
        select: { id: true },
      });
      for (const [index, card] of output.cards.entries()) {
        const id = randomUUID();
        const explanationId = randomUUID();
        await tx.aiExplanation.create({
          data: {
            id: explanationId,
            targetType: AiExplanationTargetType.FLASHCARD,
            targetId: id,
            lessonId: context.lessonId!,
            contentJson: json(toTiptap(card.explanation)),
            source: ContentSource.AI,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            aiGenerationId: context.aiGenerationId,
            targetContentHash: hashAiValue({ front: card.front, back: card.back }),
            sourceContextHash: input.sourceHash,
          },
        });
        await tx.flashcard.create({
          data: {
            id,
            flashcardSetId: set.id,
            lessonId: context.lessonId!,
            frontJson: json(toTiptap(card.front)),
            backJson: json(toTiptap(card.back)),
            difficulty: card.difficulty,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            explanationId,
            sortOrder: index,
            sourceMetadataJson: json(
              await sourceMetadata(tx, card.sourceChunkIds, input.sourceHash),
            ),
          },
        });
      }
      await auditGenerated(tx, context, "FlashcardSet", set.id);
      return result(
        "FLASHCARD_SET",
        set.id,
        "Đã tạo bộ flashcard bằng AI.",
        output.cards.length,
      );
    });
  }

  private async persistTest(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ) {
    const input = parseJobInput(testGenerationJobInputSchema, context.inputMeta, "test");
    const output = parseAiStructuredOutput(
      generatedTestOutputSchema,
      prepared.output.data,
    );
    return this.prisma.$transaction(async (tx) => {
      const sortOrder = await nextSetSortOrder(tx, "test", context.lessonId!);
      const set = await tx.testSet.create({
        data: {
          lessonId: context.lessonId!,
          title: output.title,
          durationSeconds: input.durationSeconds,
          difficulty: Difficulty.MIXED,
          difficultyRatioJson: json(input.difficultyRatio),
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          generatedByUserId: context.ownerUserId,
          aiGenerationId: context.aiGenerationId,
          questionCount: output.questions.length,
          sortOrder,
          createdById: context.ownerUserId,
          updatedById: context.ownerUserId,
        },
        select: { id: true },
      });
      for (const [index, question] of output.questions.entries()) {
        await createGeneratedQuestion(
          tx,
          "test",
          set.id,
          context,
          question,
          index,
          input.sourceHash,
        );
      }
      await auditGenerated(tx, context, "TestSet", set.id);
      return result(
        "TEST_SET",
        set.id,
        "Đã tạo bộ test bằng AI.",
        output.questions.length,
      );
    });
  }
}

type RetrievedSource = Awaited<
  ReturnType<LessonContentGenerationContextService["retrieve"]>
>;

function providerContext(context: AiGenerationExecutionContext) {
  return {
    feature: context.type,
    aiGenerationId: context.aiGenerationId,
    backgroundJobId: context.backgroundJobId,
    attempt: context.attempt,
    routeSnapshot: context.providerRouteSnapshot,
  };
}

function structuredInput(
  source: RetrievedSource,
  userPrompt: string,
  outputName: string,
) {
  return {
    systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
    userPrompt,
    contextChunks: source.chunks.map((chunk) => ({
      id: chunk.chunkId,
      content: chunk.content,
      score: chunk.score,
      metadata: {
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        metadataJson: chunk.metadataJson,
      },
    })),
    temperature: 0.2,
    maxTokens: LESSON_CONTENT_MAX_OUTPUT_TOKENS,
    metadata: {
      lessonId: source.lessonId,
      documentIds: source.documentIds,
      sourceHash: source.sourceHash,
    },
    outputName,
    promptVersion: LESSON_CONTENT_PROMPT_VERSION,
    schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
  };
}

function assertQuestionOutput(
  questions: GeneratedQuestion[],
  count: number,
  types: QuestionType[],
  source: RetrievedSource,
) {
  if (questions.length !== count)
    throw new UnrecoverableError(
      "AI_OUTPUT_COUNT_MISMATCH: Question count does not match the request.",
    );
  const actualTypes = new Set(questions.map((question) => question.questionType));
  if (
    types.some((type) => !actualTypes.has(type)) ||
    questions.some((question) => !types.includes(question.questionType))
  ) {
    throw new UnrecoverableError(
      "AI_OUTPUT_QUESTION_TYPES_MISMATCH: Output does not cover exactly the requested question types.",
    );
  }
  for (const question of questions) {
    if (question.questionType === QuestionType.MULTIPLE_CHOICE) {
      const ids = question.options.map((option) => option.id);
      if (
        new Set(ids).size !== ids.length ||
        question.correctOptionIds.some((id) => !ids.includes(id))
      ) {
        throw new UnrecoverableError(
          "AI_OUTPUT_ANSWER_INVALID: Multiple-choice answer does not match its options.",
        );
      }
    }
  }
  assertGenerated(
    source,
    questions.map((question) => ({
      sourceChunkIds: readQuestionSourceChunkIds(question),
      text: [question.example.problem, question.example.solution, question.example.answer]
        .filter(Boolean)
        .join("\n"),
    })),
  );
}

function assertGenerated(
  source: RetrievedSource,
  items: Array<{ sourceChunkIds: string[]; text: string }>,
) {
  try {
    assertGeneratedContent({
      items,
      allowedChunkIds: new Set(source.chunks.map((chunk) => chunk.chunkId)),
      contextTexts: source.chunks.map((chunk) => chunk.content),
    });
  } catch (error) {
    throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
  }
}

function assertDifficultyRatio(
  questions: GeneratedQuestion[],
  ratio: { easy: number; medium: number; hard: number },
) {
  const target = { EASY: ratio.easy, MEDIUM: ratio.medium, HARD: ratio.hard } as const;
  for (const difficulty of [
    Difficulty.EASY,
    Difficulty.MEDIUM,
    Difficulty.HARD,
  ] as const) {
    const actual = questions.filter(
      (question) => question.difficulty === difficulty,
    ).length;
    const expected = target[difficulty] * questions.length;
    if (Math.abs(actual - expected) > 1) {
      throw new UnrecoverableError(
        "AI_OUTPUT_DIFFICULTY_RATIO_MISMATCH: Test difficulty distribution is outside tolerance.",
      );
    }
  }
}

async function createGeneratedQuestion(
  tx: Prisma.TransactionClient,
  kind: "quiz" | "test",
  setId: string,
  context: AiGenerationExecutionContext,
  question: GeneratedQuestion,
  sortOrder: number,
  sourceHash: string,
  questionIndex = sortOrder,
) {
  const mapped = mapGeneratedQuestion(question);
  const sourceChunkIds = readQuestionSourceChunkIds(question);
  const id = randomUUID();
  const explanationId = randomUUID();
  await tx.aiExplanation.create({
    data: {
      id: explanationId,
      targetType:
        kind === "quiz"
          ? AiExplanationTargetType.QUIZ_QUESTION
          : AiExplanationTargetType.TEST_QUESTION,
      targetId: id,
      lessonId: context.lessonId!,
      contentJson: json(mapped.explanationJson),
      diagramSpecJson: nullableJson(mapped.explanationDiagramSpecJson),
      source: ContentSource.AI,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      aiGenerationId: context.aiGenerationId,
      targetContentHash: hashAiValue(mapped.questionJson),
      sourceContextHash: kind === "quiz" ? null : sourceHash,
    },
  });
  const data = {
    id,
    lessonId: context.lessonId!,
    questionType: mapped.questionType,
    questionJson: json(mapped.questionJson),
    optionsJson: nullableJson(mapped.optionsJson),
    correctAnswerJson: json(mapped.correctAnswerJson),
    hintJson: nullableJson(mapped.hintJson),
    gradingConfigJson: nullableJson(mapped.gradingConfigJson),
    sourceMetadataJson: json(
      kind === "quiz"
        ? {
            aiGenerationId: context.aiGenerationId,
            generationQuestionIndex: questionIndex,
            exampleBlock: mapped.exampleBlock,
          }
        : await sourceMetadata(tx, sourceChunkIds, sourceHash, {
            aiGenerationId: context.aiGenerationId,
            generationQuestionIndex: questionIndex,
            exampleBlock: mapped.exampleBlock,
          }),
    ),
    difficulty: mapped.difficulty,
    reviewStatus: ReviewStatus.NEEDS_REVIEW,
    explanationId,
    sortOrder,
  };
  if (kind === "quiz")
    await tx.quizQuestion.create({ data: { ...data, quizSetId: setId } });
  else
    await tx.testQuestion.create({ data: { ...data, testSetId: setId, points: null } });
  return mapped.recoveryIssues.map((issue) => ({
    ...issue,
    questionIndex,
    blocking: true,
  }));
}

async function sourceMetadata(
  tx: Prisma.TransactionClient,
  chunkIds: string[],
  sourceHash: string,
  extra: Record<string, unknown> = {},
) {
  const chunks = await tx.documentChunk.findMany({
    where: { id: { in: chunkIds } },
    orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
    select: { id: true, documentId: true, chunkIndex: true, metadataJson: true },
  });
  return { sourceHash, sourceChunkIds: chunkIds, sources: chunks, ...extra };
}

async function nextSetSortOrder(
  tx: Prisma.TransactionClient,
  kind: "quiz" | "flashcard" | "test",
  lessonId: string,
) {
  const record =
    kind === "quiz"
      ? await tx.quizSet.findFirst({
          where: { lessonId, deletedAt: null },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        })
      : kind === "flashcard"
        ? await tx.flashcardSet.findFirst({
            where: { lessonId, deletedAt: null },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          })
        : await tx.testSet.findFirst({
            where: { lessonId, deletedAt: null },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });
  return (record?.sortOrder ?? -1) + 1;
}

async function auditGenerated(
  tx: Prisma.TransactionClient,
  context: AiGenerationExecutionContext,
  entityType: string,
  entityId: string,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: context.ownerUserId,
      action: `${entityType.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}_AI_GENERATED`,
      entityType,
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

function result(
  resourceType: string,
  resourceId: string,
  message: string,
  itemCount: number,
  metadata?: Record<string, unknown>,
): AiGenerationPersistenceResult {
  return {
    resourceType,
    resourceId,
    message,
    result: {
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      itemCount,
      ...metadata,
    },
  };
}

type GenerationRecoveryIssue = {
  classification: "VALID" | "AUTO_FIXED" | "REVIEWABLE" | "UNRENDERABLE";
  code: string;
  message: string;
  questionIndex?: number;
  blocking: boolean;
  technicalDetails?: string;
};

function validateQuestionOutput(input: {
  questions: GeneratedQuestion[];
  requestedCount: number;
  requestedTypes: QuestionType[];
  requestedDifficulty: Difficulty;
  difficultyCounts: { easy: number; medium: number; hard: number } | null;
  source: RetrievedSource;
}) {
  const issues: GenerationRecoveryIssue[] = [];
  const questions = input.questions.filter((question, questionIndex) => {
    if (!input.requestedTypes.includes(question.questionType)) {
      issues.push({
        classification: "UNRENDERABLE",
        code: "QUESTION_TYPE_NOT_REQUESTED",
        message: "Câu hỏi có loại nằm ngoài cấu hình admin đã chọn.",
        questionIndex,
        blocking: true,
      });
      return false;
    }
    if (question.questionType === QuestionType.MULTIPLE_CHOICE) {
      const optionIds = question.options.map((option) => option.id);
      if (
        new Set(optionIds).size !== optionIds.length ||
        question.correctOptionIds.some((id) => !optionIds.includes(id))
      ) {
        issues.push({
          classification: "UNRENDERABLE",
          code: "ANSWER_INVALID",
          message:
            "Đáp án trắc nghiệm không khớp các lựa chọn nên câu này đã được cô lập.",
          questionIndex,
          blocking: true,
        });
        return false;
      }
    }
    try {
      assertGeneratedContent({
        items: [
          {
            text: [
              question.example.problem,
              question.example.solution,
              question.example.answer,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        allowedChunkIds: new Set(input.source.chunks.map((chunk) => chunk.chunkId)),
        contextTexts: input.source.chunks.map((chunk) => chunk.content),
      });
    } catch (error) {
      issues.push({
        classification: "REVIEWABLE",
        code: "SOURCE_GROUNDING_NEEDS_REVIEW",
        message: "Câu hỏi cần được đối chiếu lại với nguồn bài học.",
        questionIndex,
        blocking: true,
        technicalDetails: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  });

  if (input.questions.length !== input.requestedCount) {
    issues.push({
      classification: "REVIEWABLE",
      code: "INITIAL_COUNT_MISMATCH",
      message: `AI trả ${input.questions.length}/${input.requestedCount} câu ở lượt tạo ban đầu.`,
      blocking: true,
    });
  }
  if (
    input.requestedCount >= input.requestedTypes.length &&
    input.requestedTypes.some(
      (type) => !questions.some((question) => question.questionType === type),
    )
  ) {
    issues.push({
      classification: "REVIEWABLE",
      code: "QUESTION_TYPE_COVERAGE_MISMATCH",
      message: "Bộ câu hỏi chưa bao phủ đủ các loại câu đã chọn.",
      blocking: true,
    });
  }
  if (
    input.requestedDifficulty !== Difficulty.MIXED &&
    questions.some((question) => question.difficulty !== input.requestedDifficulty)
  ) {
    issues.push({
      classification: "REVIEWABLE",
      code: "DIFFICULTY_MISMATCH",
      message: "Một số câu có độ khó khác cấu hình admin đã chọn.",
      blocking: true,
    });
  }
  if (input.difficultyCounts) {
    const actual = {
      easy: questions.filter((question) => question.difficulty === Difficulty.EASY)
        .length,
      medium: questions.filter((question) => question.difficulty === Difficulty.MEDIUM)
        .length,
      hard: questions.filter((question) => question.difficulty === Difficulty.HARD)
        .length,
    };
    if (
      actual.easy !== input.difficultyCounts.easy ||
      actual.medium !== input.difficultyCounts.medium ||
      actual.hard !== input.difficultyCounts.hard
    ) {
      issues.push({
        classification: "REVIEWABLE",
        code: "DIFFICULTY_DISTRIBUTION_MISMATCH",
        message: "Phân bổ Dễ/Trung bình/Khó chưa đúng số lượng đã cấu hình.",
        blocking: true,
      });
    }
  }
  return {
    questions,
    metadata: {
      initialGeneratedCount: input.questions.length,
      validQuestionCount: questions.length,
      issues,
    },
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

function readQuestionSourceChunkIds(question: GeneratedQuestion) {
  return "sourceChunkIds" in question ? question.sourceChunkIds : [];
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
  if (!parsed.success)
    throw new UnrecoverableError(
      `Invalid ${name} generation input: ${parsed.error.issues[0]?.message ?? "unknown error"}`,
    );
  return parsed.data;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function nullableJson(value: unknown | null) {
  return value === null ? Prisma.DbNull : json(value);
}
