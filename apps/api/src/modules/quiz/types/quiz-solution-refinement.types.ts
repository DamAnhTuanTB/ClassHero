import { QuestionType } from "@prisma/client";
import { z } from "zod";

import type { QuizSubjectKey } from "#api/modules/quiz/types/quiz-generation.types";

export const QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE = "QUIZ_SOLUTION_REFINEMENT" as const;
export const QUIZ_SOLUTION_REFINEMENT_MODES = ["REFINE", "REGENERATE"] as const;
export type QuizSolutionRefinementMode =
  (typeof QUIZ_SOLUTION_REFINEMENT_MODES)[number];
export const QUIZ_SOLUTION_REFINEMENT_SCHEMA_VERSION =
  "quiz-solution-refinement-v3-split-mode";
export const QUIZ_SOLUTION_REGENERATION_SCHEMA_VERSION =
  "quiz-solution-regeneration-v1";

const refinedTextSchema = z.string().trim().min(1).max(30_000);
const hintSchema = z.string().trim().min(1).max(1_000);
const numericAnswerSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^-?(?:0|[1-9]\d*)(?:\/[1-9]\d*|\.\d)?$/u);
const statementSolutionSchema = z
  .object({
    statementId: z.string().trim().min(1).max(20),
    solution: refinedTextSchema,
  })
  .strict();

export const singleQuizSolutionRefinementOutputSchema = z
  .object({ solution: refinedTextSchema })
  .strict();
export const multiStatementQuizSolutionRefinementOutputSchema = z
  .object({ statementSolutions: z.array(statementSolutionSchema).min(2).max(20) })
  .strict();
export const multipleChoiceQuizSolutionRegenerationOutputSchema = z
  .object({
    correctOptionId: z.string().trim().min(1).max(100),
    hint: hintSchema,
    solution: refinedTextSchema,
  })
  .strict();
export const trueFalseQuizSolutionRegenerationOutputSchema = z
  .object({ correctAnswer: z.boolean(), hint: hintSchema, solution: refinedTextSchema })
  .strict();
export const multiStatementQuizSolutionRegenerationOutputSchema = z
  .object({
    statementAnswers: z
      .array(
        z
          .object({
            statementId: z.string().trim().min(1).max(20),
            value: z.boolean(),
          })
          .strict(),
      )
      .min(2)
      .max(20),
    hint: hintSchema,
    statementSolutions: z.array(statementSolutionSchema).min(2).max(20),
  })
  .strict();
export const textInputQuizSolutionRegenerationOutputSchema = z
  .object({ correctAnswer: numericAnswerSchema, hint: hintSchema, solution: refinedTextSchema })
  .strict();

export type QuizSolutionRefinementOutput =
  | z.infer<typeof singleQuizSolutionRefinementOutputSchema>
  | z.infer<typeof multiStatementQuizSolutionRefinementOutputSchema>;
export type QuizSolutionRegenerationOutput =
  | z.infer<typeof multipleChoiceQuizSolutionRegenerationOutputSchema>
  | z.infer<typeof trueFalseQuizSolutionRegenerationOutputSchema>
  | z.infer<typeof multiStatementQuizSolutionRegenerationOutputSchema>
  | z.infer<typeof textInputQuizSolutionRegenerationOutputSchema>;

export type QuizSolutionRefinementQuestionSnapshot = {
  questionType: QuestionType;
  problem: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: unknown;
  currentHint: string | null;
  currentSolution: string;
};

export const quizSolutionRefinementJobInputSchema = z
  .object({
    operation: z.literal(QUIZ_SOLUTION_REFINEMENT_TARGET_TYPE),
    mode: z.enum(QUIZ_SOLUTION_REFINEMENT_MODES),
    includeCurrentSolutionAsRejected: z.boolean(),
    questionId: z.string().uuid(),
    baseContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/u),
    subjectKey: z.enum(["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"]),
    subjectName: z.string().trim().min(1).max(200),
    subjectSlug: z.string().trim().min(1).max(200),
    targetGrade: z.number().int().min(1).max(12).nullable(),
    adminInstructions: z.string().trim().max(2_000).nullable(),
    questionFigure: z
      .object({
        revisionId: z.string().uuid(),
        objectKey: z.string().trim().min(1).max(1_000),
        checksum: z.string().trim().min(1).max(200).nullable(),
      })
      .nullable(),
    questionSnapshot: z.object({
      questionType: z.nativeEnum(QuestionType),
      problem: z.string().trim().min(1).max(30_000),
      options: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(100),
            text: z.string().trim().min(1).max(10_000),
          }),
        )
        .max(20),
      correctAnswer: z.unknown(),
      currentHint: z.string().trim().min(1).max(10_000).nullable(),
      currentSolution: z.string().trim().min(1).max(30_000),
    }),
  })
  .strict();

export type QuizSolutionRefinementJobInput = z.infer<
  typeof quizSolutionRefinementJobInputSchema
>;

export function resolveQuizSolutionRefinementPromptVersion(
  subjectKey: QuizSubjectKey,
  mode: QuizSolutionRefinementMode,
  includeCurrentSolutionAsRejected = false,
) {
  const operation = mode === "REFINE" ? "refinement" : "regeneration";
  const version =
    mode === "REFINE"
      ? "v5"
      : includeCurrentSolutionAsRejected
        ? "v3-rejected-candidate"
        : "v2";
  return `quiz-solution-${operation}-${subjectKey.toLowerCase()}-${version}`;
}

export function isMultiStatementQuizSolutionRefinement(questionType: QuestionType) {
  return questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE;
}

export function resolveQuizSolutionRegenerationOutputSchema(questionType: QuestionType) {
  switch (questionType) {
    case QuestionType.MULTIPLE_CHOICE:
      return multipleChoiceQuizSolutionRegenerationOutputSchema;
    case QuestionType.TRUE_FALSE:
      return trueFalseQuizSolutionRegenerationOutputSchema;
    case QuestionType.MULTI_STATEMENT_TRUE_FALSE:
      return multiStatementQuizSolutionRegenerationOutputSchema;
    case QuestionType.TEXT_INPUT:
      return textInputQuizSolutionRegenerationOutputSchema;
  }
}
