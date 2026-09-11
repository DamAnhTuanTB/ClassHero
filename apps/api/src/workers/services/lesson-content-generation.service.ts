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
  getGeneratedTestOutputSchema,
  LESSON_CONTENT_MAX_OUTPUT_TOKENS,
  LESSON_CONTENT_SCHEMA_VERSION,
  testGenerationJobInputSchema,
  type GeneratedQuestion,
} from "#api/modules/ai/types/lesson-content-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import {
  assertGeneratedContent,
  mapGeneratedQuestion,
} from "#api/modules/ai/utils/lesson-content-generation-mapper";
import {
  buildLessonContentSystemPrompt,
  buildTestPrompt,
  resolveLessonContentPromptVersion,
} from "#api/modules/ai/utils/lesson-content-generation-prompt";
import type { ProviderUsageOperation } from "#api/modules/provider-operations/types/provider-operations.types";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";

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
    if (context.type === AiGenerationType.TEST)
      return this.persistTest(context, prepared);
    throw new UnrecoverableError(
      `Unsupported lesson content persistence type ${context.type}.`,
    );
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
      buildTestPrompt({
        lessonTitle: source.lessonTitle,
        ...input,
        subject: source.subject,
      }),
      "generated_test",
    );
    const providerSchema = getGeneratedTestOutputSchema(source.subject.key);
    const output = this.providerCall
      ? await this.providerCall.generateStructured(
          providerContext(context, "TEST_GENERATION"),
          request,
          providerSchema,
        )
      : await this.aiService.generateStructured(request, providerSchema);
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

  private async persistTest(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ) {
    const input = parseJobInput(testGenerationJobInputSchema, context.inputMeta, "test");
    const output = parseAiStructuredOutput(
      getGeneratedTestOutputSchema(input.subjectKey),
      prepared.output.data,
    );
    return this.prisma.$transaction(async (tx) => {
      const sortOrder = await nextTestSetSortOrder(tx, context.lessonId!);
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
        await createGeneratedTestQuestion(
          tx,
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

function providerContext(
  context: AiGenerationExecutionContext,
  operation: ProviderUsageOperation,
) {
  return {
    feature: context.type,
    aiGenerationId: context.aiGenerationId,
    backgroundJobId: context.backgroundJobId,
    attempt: context.attempt,
    operation,
    targetContext: buildWholeFeatureUsageTarget(context.type, context.aiGenerationId),
    routeSnapshot: context.providerRouteSnapshot,
  };
}

function structuredInput(
  source: RetrievedSource,
  userPrompt: string,
  outputName: string,
) {
  return {
    systemPrompt: buildLessonContentSystemPrompt(source.subject),
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
      subject: source.subject,
      documentIds: source.documentIds,
      sourceHash: source.sourceHash,
    },
    outputName,
    promptVersion: resolveLessonContentPromptVersion(source.subject.key),
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

async function createGeneratedTestQuestion(
  tx: Prisma.TransactionClient,
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
      targetType: AiExplanationTargetType.TEST_QUESTION,
      targetId: id,
      lessonId: context.lessonId!,
      contentJson: json(mapped.explanationJson),
      source: ContentSource.AI,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      aiGenerationId: context.aiGenerationId,
      targetContentHash: hashAiValue(mapped.questionJson),
      sourceContextHash: sourceHash,
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
      await sourceMetadata(tx, sourceChunkIds, sourceHash, {
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
  await tx.testQuestion.create({
    data: { ...data, testSetId: setId, points: null },
  });
  return mapped.recoveryIssues.map((issue) => ({
    ...issue,
    questionIndex,
    blocking: false,
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

async function nextTestSetSortOrder(tx: Prisma.TransactionClient, lessonId: string) {
  const record = await tx.testSet.findFirst({
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

function readQuestionSourceChunkIds(question: GeneratedQuestion) {
  return "sourceChunkIds" in question ? question.sourceChunkIds : [];
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
