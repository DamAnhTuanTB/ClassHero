import { AI_REASONING_EFFORT_LEVELS } from "@learning-path/shared";
import { Difficulty, QuestionType } from "@prisma/client";
import { z } from "zod";

import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";

export const LESSON_CONTENT_PROMPT_VERSION = "lesson-content-subject-prompt-v6";
export const LESSON_CONTENT_SCHEMA_VERSION = "lesson-content-subject-schema-v6";
export const LESSON_CONTENT_MAX_CONTEXT_TOKENS = 8_000;
export const LESSON_CONTENT_MAX_OUTPUT_TOKENS = 12_000;
export const LESSON_CONTENT_MIN_OUTPUT_TOKENS = 1_000;

const text = (max: number) => z.string().trim().min(1).max(max);
const difficultySchema = z.enum([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]);
const sourceChunkIdsSchema = z.array(z.uuid()).min(1).max(8);

const assessmentExampleBaseShape = {
  problem: text(2_000),
  solution: text(5_000).nullable(),
  answer: text(2_000),
};

const mathAssessmentExampleSchema = z
  .object({
    ...assessmentExampleBaseShape,
    geometryStatement: z
      .object({
        hypotheses: z.array(text(1_000)).max(20),
        conclusions: z.array(text(1_000)).max(20),
      })
      .strict()
      .nullable(),
  })
  .strict();

const nonMathAssessmentExampleSchema = z
  .object(assessmentExampleBaseShape)
  .strict();

const commonQuizQuestionFields = {
  difficulty: difficultySchema,
  hint: text(1_000),
  example: mathAssessmentExampleSchema.describe(
    "Nội dung chữ của một câu Quiz: đề, lời giải, đáp án và GT–KL nếu phù hợp. Không sinh hình trong pipeline Quiz.",
  ),
};

const commonTestQuestionFields = {
  difficulty: difficultySchema,
  example: mathAssessmentExampleSchema.describe(
    "Nội dung chữ của một câu Test. Không sinh hình trong pipeline Test.",
  ),
  sourceChunkIds: sourceChunkIdsSchema,
};
const nonMathQuizQuestionFields = {
  ...commonQuizQuestionFields,
  example: nonMathAssessmentExampleSchema.describe(
    "Nội dung chữ của một câu Quiz: đề, lời giải và đáp án theo đúng schema của môn hiện tại.",
  ),
};
const nonMathTestQuestionFields = {
  ...commonTestQuestionFields,
  example: nonMathAssessmentExampleSchema.describe(
    "Nội dung chữ của một câu Test: đề, lời giải và đáp án theo đúng schema của môn hiện tại.",
  ),
};

const optionSchema = z.object({ id: text(40), text: text(1_000) }).strict();

function buildQuestionUnion<T extends z.ZodRawShape>(commonFields: T) {
  return z.discriminatedUnion("questionType", [
    z
      .object({
        questionType: z.literal(QuestionType.MULTIPLE_CHOICE),
        ...commonFields,
        options: z.array(optionSchema).min(2).max(6),
        correctOptionIds: z.array(text(40)).min(1).max(6),
      })
      .strict(),
    z
      .object({
        questionType: z.literal(QuestionType.TRUE_FALSE),
        ...commonFields,
        correctAnswer: z.boolean(),
      })
      .strict(),
    z
      .object({
        questionType: z.literal(QuestionType.MULTI_STATEMENT_TRUE_FALSE),
        ...commonFields,
        statements: z
          .array(
            z.object({ id: text(40), text: text(1_000), value: z.boolean() }).strict(),
          )
          .min(2)
          .max(8),
      })
      .strict(),
    z
      .object({
        questionType: z.literal(QuestionType.TEXT_INPUT),
        ...commonFields,
        acceptedAnswers: z.array(text(500)).min(1).max(12),
        caseSensitive: z.boolean(),
        exactMatch: z.boolean(),
        keywords: z.array(text(120)).max(20),
      })
      .strict(),
  ]);
}

export const generatedQuizQuestionSchema = buildQuestionUnion(commonQuizQuestionFields);
export const generatedTestQuestionSchema = buildQuestionUnion(commonTestQuestionFields);
const generatedNonMathQuizQuestionSchema = buildQuestionUnion(
  nonMathQuizQuestionFields,
);
const generatedNonMathTestQuestionSchema = buildQuestionUnion(
  nonMathTestQuestionFields,
);

export const generatedQuizOutputSchema = z
  .object({
    title: text(180),
    questions: z.array(generatedQuizQuestionSchema).min(1).max(50),
  })
  .strict();

export const generatedTestOutputSchema = z
  .object({
    title: text(180),
    questions: z.array(generatedTestQuestionSchema).min(1).max(50),
  })
  .strict();

const generatedNonMathQuizOutputSchema = z
  .object({
    title: text(180),
    questions: z.array(generatedNonMathQuizQuestionSchema).min(1).max(50),
  })
  .strict();
const generatedNonMathTestOutputSchema = z
  .object({
    title: text(180),
    questions: z.array(generatedNonMathTestQuestionSchema).min(1).max(50),
  })
  .strict();

export function getGeneratedQuizOutputSchema(
  subjectKey: z.infer<typeof lessonSummarySubjectKeySchema>,
) {
  return subjectKey === "MATH"
    ? generatedQuizOutputSchema
    : generatedNonMathQuizOutputSchema;
}

export function getGeneratedTestOutputSchema(
  subjectKey: z.infer<typeof lessonSummarySubjectKeySchema>,
) {
  return subjectKey === "MATH"
    ? generatedTestOutputSchema
    : generatedNonMathTestOutputSchema;
}

export const generatedQuestionSchema = z.union([
  generatedQuizQuestionSchema,
  generatedTestQuestionSchema,
  generatedNonMathQuizQuestionSchema,
  generatedNonMathTestQuestionSchema,
]);

export const generatedFlashcardOutputSchema = z
  .object({
    title: text(180),
    cards: z
      .array(
        z
          .object({
            difficulty: difficultySchema,
            front: text(1_500),
            back: text(2_500),
            explanation: text(3_000),
            sourceChunkIds: sourceChunkIdsSchema,
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict();

const sourceSnapshotSchema = z
  .object({
    documentIds: z.array(z.uuid()).min(1).max(50),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    targetGrade: z.number().int().min(1).max(12).nullable().default(null),
    subjectKey: lessonSummarySubjectKeySchema,
    subjectName: z.string().trim().min(1).max(120),
    subjectSlug: z.string().trim().min(1).max(140),
  })
  .strict();

const difficultyCountsSchema = z
  .object({
    easy: z.number().int().min(0).max(50),
    medium: z.number().int().min(0).max(50),
    hard: z.number().int().min(0).max(50),
  })
  .strict();

export const quizGenerationJobInputSchema = sourceSnapshotSchema
  .extend({
    targetQuizSetId: z.uuid().nullable().default(null),
    questionCount: z.number().int().min(1).max(50),
    difficulty: z.nativeEnum(Difficulty),
    difficultyCounts: difficultyCountsSchema.nullable().default(null),
    questionTypes: z.array(z.nativeEnum(QuestionType)).min(1).max(4),
    style: z
      .enum(["student_friendly", "concise", "academic"])
      .default("student_friendly"),
    styleInstructions: z.string().trim().max(1_000).default(""),
    extraInstructions: z.string().trim().max(2_000).default(""),
    systemInstructions: z.string().trim().max(64_000).default(""),
    userPrompt: z.string().trim().max(16_000).default(""),
    model: z.string().trim().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z.enum(AI_REASONING_EFFORT_LEVELS).optional(),
    maxOutputTokens: z
      .number()
      .int()
      .min(LESSON_CONTENT_MIN_OUTPUT_TOKENS)
      .max(32_000)
      .optional(),
  })
  .strict();

export const flashcardGenerationJobInputSchema = sourceSnapshotSchema
  .extend({
    cardCount: z.number().int().min(1).max(60),
    difficulty: z.nativeEnum(Difficulty),
  })
  .strict();

export const testGenerationJobInputSchema = sourceSnapshotSchema
  .extend({
    questionCount: z.number().int().min(1).max(50),
    durationSeconds: z.number().int().min(60).max(14_400),
    difficultyRatio: z
      .object({
        easy: z.number().min(0).max(1),
        medium: z.number().min(0).max(1),
        hard: z.number().min(0).max(1),
      })
      .strict(),
    questionTypes: z.array(z.nativeEnum(QuestionType)).min(1).max(4),
  })
  .strict();

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuizOutput = z.infer<typeof generatedQuizOutputSchema>;
export type GeneratedFlashcardOutput = z.infer<typeof generatedFlashcardOutputSchema>;
export type GeneratedTestOutput = z.infer<typeof generatedTestOutputSchema>;
export type QuizGenerationJobInput = z.infer<typeof quizGenerationJobInputSchema>;
export type FlashcardGenerationJobInput = z.infer<
  typeof flashcardGenerationJobInputSchema
>;
export type TestGenerationJobInput = z.infer<typeof testGenerationJobInputSchema>;
