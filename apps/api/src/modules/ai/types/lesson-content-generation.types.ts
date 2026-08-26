import { Difficulty, QuestionType } from "@prisma/client";
import { z } from "zod";

import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";

export const LESSON_CONTENT_PROMPT_VERSION =
  "lesson-content-subject-prompt-v7-declared-standard-notation";
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

const nonMathAssessmentExampleSchema = z.object(assessmentExampleBaseShape).strict();

const commonTestQuestionFields = {
  difficulty: difficultySchema,
  example: mathAssessmentExampleSchema.describe(
    "Nội dung chữ của một câu Test. Không sinh hình trong pipeline Test.",
  ),
  sourceChunkIds: sourceChunkIdsSchema,
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

export const generatedTestQuestionSchema = buildQuestionUnion(commonTestQuestionFields);
const generatedNonMathTestQuestionSchema = buildQuestionUnion(nonMathTestQuestionFields);

export const generatedTestOutputSchema = z
  .object({
    title: text(180),
    questions: z.array(generatedTestQuestionSchema).min(1).max(50),
  })
  .strict();

const generatedNonMathTestOutputSchema = z
  .object({
    title: text(180),
    questions: z.array(generatedNonMathTestQuestionSchema).min(1).max(50),
  })
  .strict();

export function getGeneratedTestOutputSchema(
  subjectKey: z.infer<typeof lessonSummarySubjectKeySchema>,
) {
  return subjectKey === "MATH"
    ? generatedTestOutputSchema
    : generatedNonMathTestOutputSchema;
}

export const generatedQuestionSchema = z.union([
  generatedTestQuestionSchema,
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
export type GeneratedFlashcardOutput = z.infer<typeof generatedFlashcardOutputSchema>;
export type GeneratedTestOutput = z.infer<typeof generatedTestOutputSchema>;
export type FlashcardGenerationJobInput = z.infer<
  typeof flashcardGenerationJobInputSchema
>;
export type TestGenerationJobInput = z.infer<typeof testGenerationJobInputSchema>;
