import { z } from "zod";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import {
  buildQuizFigureRefinementSystemPrompt,
  buildQuizFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/quiz-figure-system-prompt-resolver";

export const QUIZ_FIGURE_SCHEMA_VERSION =
  "quiz-figure-schema-v7-independent-solution-source";

export function resolveQuizFigureSystemPrompt(
  defaultSystemPrompt: string,
  systemPromptOverride?: string | null,
) {
  return systemPromptOverride?.trim() || defaultSystemPrompt;
}

export const quizFigureLatexSourceSchema = z
  .string()
  .trim()
  .min(20)
  .max(50_000)
  .refine(
    (source) => /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u.test(source),
    "latexSource phải chứa một root tikzpicture hoặc circuitikz.",
  );

export const generatedQuizQuestionFigureSchema = z
  .object({
    latexSource: quizFigureLatexSourceSchema,
  })
  .strict();

export const generatedQuizSolutionFigureSchema = z
  .object({
    latexSource: quizFigureLatexSourceSchema,
  })
  .strict();

export const generatedQuizFigureRefinementSchema = z
  .object({
    latexSource: quizFigureLatexSourceSchema,
  })
  .strict();

const quizQuestionFigurePlanSchema = z
  .object({
    version: z.literal(1),
    role: z.literal("QUESTION"),
    problem: z.string().trim().min(1),
  })
  .strict();

const quizSolutionFigurePlanSchema = z
  .object({
    version: z.literal(2),
    role: z.literal("SOLUTION"),
    problem: z.string().trim().min(1),
    solution: z.string().trim().min(1),
  })
  .strict();

export const quizFigurePlanSchema = z.union([
  quizQuestionFigurePlanSchema,
  quizSolutionFigurePlanSchema,
]);

export type QuizFigurePlan = z.infer<typeof quizFigurePlanSchema>;
export type QuizQuestionFigurePlan = z.infer<typeof quizQuestionFigurePlanSchema>;
export type QuizSolutionFigurePlan = z.infer<typeof quizSolutionFigurePlanSchema>;

const quizFigureTargetGradeSchema = z.number().int().min(1).max(12);

export function readQuizFigureTargetGrade(inputMeta: unknown): number | null {
  if (!inputMeta || typeof inputMeta !== "object" || Array.isArray(inputMeta)) {
    return null;
  }
  const parsed = quizFigureTargetGradeSchema.safeParse(
    (inputMeta as Record<string, unknown>).targetGrade,
  );
  return parsed.success ? parsed.data : null;
}

export function buildQuizFigureRefinementInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizFigurePlan;
  targetGrade?: number | null;
  adminInstructions?: string | null;
  currentLatexSource: string;
  currentImageDataUrl: string;
}): AiStructuredInput {
  const mode = input.plan.role;
  return {
    systemPrompt: buildQuizFigureRefinementSystemPrompt(input.subject, mode),
    userPrompt: JSON.stringify({
      figurePlan: input.plan,
      ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
      ...(input.adminInstructions?.trim()
        ? { adminInstructions: input.adminInstructions.trim() }
        : {}),
      currentLatexSource: input.currentLatexSource,
    }),
    inputImages: [{ imageUrl: input.currentImageDataUrl, detail: "high" }],
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "quiz_figure_refinement",
    promptVersion: `quiz-figure-${input.subject.key.toLowerCase()}-${mode.toLowerCase()}-refinement-comprehensive-${resolveQuizFigureRefinementPromptVersion(
      input.subject,
      mode,
    )}`,
    schemaVersion: "quiz-figure-refinement-schema-v3-independent-solution",
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: `quiz-figure-refinement-${input.subject.key.toLowerCase()}`,
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

export function buildQuestionFigureInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizQuestionFigurePlan;
  targetGrade?: number | null;
  adminInstructions?: string | null;
  mode?: "REGENERATE" | "EDIT_CURRENT";
  currentLatexSource?: string | null;
}): AiStructuredInput {
  return {
    systemPrompt: buildQuizFigureSystemPrompt(input.subject, "QUESTION"),
    userPrompt: JSON.stringify({
      role: "QUESTION",
      mode: input.mode ?? "REGENERATE",
      ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
      problem: input.plan.problem,
      ...(input.mode === "EDIT_CURRENT" && input.currentLatexSource?.trim()
        ? { currentLatexSource: input.currentLatexSource.trim() }
        : {}),
      ...(input.adminInstructions?.trim()
        ? { adminInstructions: input.adminInstructions.trim() }
        : {}),
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "quiz_question_figure",
    promptVersion: resolveQuizFigurePromptVersion(input.subject, "question"),
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "quiz-figure-question",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

export function buildSolutionFigureInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizSolutionFigurePlan;
  targetGrade?: number | null;
  adminInstructions?: string | null;
  mode?: "REGENERATE" | "EDIT_CURRENT";
  currentSolutionLatexSource?: string | null;
}): AiStructuredInput {
  return {
    systemPrompt: buildQuizFigureSystemPrompt(input.subject, "SOLUTION"),
    userPrompt: JSON.stringify({
      role: "SOLUTION",
      aiMode: input.mode ?? "REGENERATE",
      ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
      problem: input.plan.problem,
      solution: input.plan.solution,
      ...(input.mode === "EDIT_CURRENT" && input.currentSolutionLatexSource?.trim()
        ? { currentSolutionLatexSource: input.currentSolutionLatexSource.trim() }
        : {}),
      ...(input.adminInstructions?.trim()
        ? { adminInstructions: input.adminInstructions.trim() }
        : {}),
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "quiz_solution_figure",
    promptVersion: resolveQuizFigurePromptVersion(input.subject, "solution"),
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "quiz-figure-solution",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

function resolveQuizFigurePromptVersion(
  subject: QuizSubjectSnapshot,
  mode: "question" | "solution",
) {
  const version =
    subject.key === "MATH"
      ? "v66-independent-single-semantic-check"
      : subject.key === "PHYSICS"
        ? "v50-independent-single-semantic-check"
        : subject.key === "CHEMISTRY"
          ? "v49-independent-single-semantic-check"
          : "v49-independent-single-semantic-check";
  return `quiz-figure-${subject.key.toLowerCase()}-${mode}-${version}`;
}

function resolveQuizFigureRefinementPromptVersion(
  subject: QuizSubjectSnapshot,
  mode: "QUESTION" | "SOLUTION",
) {
  if (mode === "SOLUTION") {
    return subject.key === "MATH"
      ? "v39-single-semantic-check"
      : subject.key === "PHYSICS"
        ? "v26-single-semantic-check"
        : "v25-single-semantic-check";
  }

  return subject.key === "MATH"
    ? "v39-single-semantic-check"
    : subject.key === "PHYSICS"
      ? "v26-single-semantic-check"
      : "v25-single-semantic-check";
}
