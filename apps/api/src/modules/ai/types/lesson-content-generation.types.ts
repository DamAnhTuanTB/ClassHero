import { Difficulty, QuestionType } from "@prisma/client";
import { z } from "zod";

export const LESSON_CONTENT_PROMPT_VERSION = "lesson-content-prompt-v1";
export const LESSON_CONTENT_SCHEMA_VERSION = "lesson-content-schema-v1";
export const LESSON_CONTENT_MAX_CONTEXT_TOKENS = 8_000;
export const LESSON_CONTENT_MAX_OUTPUT_TOKENS = 6_000;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);
const difficultySchema = z.enum([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]);
const sourceChunkIdsSchema = z.array(z.uuid()).min(1).max(8);

const commonQuizQuestionFields = {
  difficulty: difficultySchema,
  prompt: text(2_000),
  hint: text(1_000),
  explanation: text(3_000),
  sourceChunkIds: sourceChunkIdsSchema,
};

const commonTestQuestionFields = {
  difficulty: difficultySchema,
  prompt: text(2_000),
  explanation: text(3_000),
  sourceChunkIds: sourceChunkIdsSchema,
};

const optionSchema = z.object({ id: text(40), text: text(1_000) }).strict();

function buildQuestionUnion<T extends z.ZodRawShape>(commonFields: T) {
  return z.discriminatedUnion("questionType", [
    z.object({
      questionType: z.literal(QuestionType.MULTIPLE_CHOICE),
      ...commonFields,
      options: z.array(optionSchema).min(2).max(6),
      correctOptionIds: z.array(text(40)).min(1).max(6),
    }).strict(),
    z.object({
      questionType: z.literal(QuestionType.TRUE_FALSE),
      ...commonFields,
      correctAnswer: z.boolean(),
    }).strict(),
    z.object({
      questionType: z.literal(QuestionType.MULTI_STATEMENT_TRUE_FALSE),
      ...commonFields,
      statements: z.array(z.object({ id: text(40), text: text(1_000), value: z.boolean() }).strict()).min(2).max(8),
    }).strict(),
    z.object({
      questionType: z.literal(QuestionType.TEXT_INPUT),
      ...commonFields,
      acceptedAnswers: z.array(text(500)).min(1).max(12),
      caseSensitive: z.boolean(),
      exactMatch: z.boolean(),
      keywords: z.array(text(120)).max(20),
    }).strict(),
  ]);
}

export const generatedQuizQuestionSchema = buildQuestionUnion(commonQuizQuestionFields);
export const generatedTestQuestionSchema = buildQuestionUnion(commonTestQuestionFields);

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

export const generatedQuestionSchema = z.union([
  generatedQuizQuestionSchema,
  generatedTestQuestionSchema,
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
  })
  .strict();

export const quizGenerationJobInputSchema = sourceSnapshotSchema
  .extend({
    questionCount: z.number().int().min(1).max(50),
    difficulty: z.nativeEnum(Difficulty),
    questionTypes: z.array(z.nativeEnum(QuestionType)).min(1).max(4),
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
