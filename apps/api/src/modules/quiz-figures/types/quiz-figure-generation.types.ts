import { z } from "zod";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import {
  buildQuizFigureRefinementSystemPrompt,
  buildQuizFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/quiz-figure-system-prompt-resolver";

export const QUIZ_FIGURE_SCHEMA_VERSION = "quiz-figure-schema-v6-redraw-model";
export const QUIZ_FIGURE_EXTENSION_MARKER = "% QUIZ_SOLUTION_EXTENSION";

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

export const generatedQuizSolutionExtensionSchema = z
  .object({
    extensionLatex: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const generatedQuizSolutionRedrawSchema = z
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

const quizExtendedSolutionFigurePlanSchema = z
  .object({
    version: z.literal(1),
    role: z.literal("SOLUTION"),
    mode: z.literal("EXTEND_QUESTION"),
    problem: z.string().trim().min(1),
    solution: z.string().trim().min(1),
    addedObjects: z.array(z.string().trim().min(1)).min(1).max(20),
    clarifiedRelations: z.array(z.string().trim().min(1)).min(1).max(20),
  })
  .strict();

const quizRedrawnSolutionFigurePlanSchema = z
  .object({
    version: z.literal(1),
    role: z.literal("SOLUTION"),
    mode: z.literal("REDRAW_AS_MODEL"),
    problem: z.string().trim().min(1),
    solution: z.string().trim().min(1),
    modelingGoal: z.string().trim().min(1).max(500),
    modeledObjects: z.array(z.string().trim().min(1)).min(1).max(20),
    clarifiedRelations: z.array(z.string().trim().min(1)).min(1).max(20),
  })
  .strict();

export const quizFigurePlanSchema = z.union([
  quizQuestionFigurePlanSchema,
  quizExtendedSolutionFigurePlanSchema,
  quizRedrawnSolutionFigurePlanSchema,
]);

export type QuizFigurePlan = z.infer<typeof quizFigurePlanSchema>;
export type QuizQuestionFigurePlan = z.infer<typeof quizQuestionFigurePlanSchema>;
export type QuizExtendedSolutionFigurePlan = z.infer<
  typeof quizExtendedSolutionFigurePlanSchema
>;
export type QuizRedrawnSolutionFigurePlan = z.infer<
  typeof quizRedrawnSolutionFigurePlanSchema
>;

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
  currentLatexSource: string;
  currentImageDataUrl: string;
}): AiStructuredInput {
  const mode =
    input.plan.role === "QUESTION"
      ? "QUESTION"
      : input.plan.mode === "EXTEND_QUESTION"
        ? "EXTEND_QUESTION"
        : "REDRAW_AS_MODEL";
  return {
    systemPrompt: buildQuizFigureRefinementSystemPrompt(input.subject, mode),
    userPrompt: JSON.stringify({
      figurePlan: input.plan,
      ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
      currentLatexSource: input.currentLatexSource,
    }),
    inputImages: [{ imageUrl: input.currentImageDataUrl, detail: "high" }],
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "quiz_figure_refinement",
    promptVersion: `quiz-figure-${input.subject.key.toLowerCase()}-${mode.toLowerCase()}-refinement-${input.subject.key === "MATH" ? "v6-target-grade-context" : "v5-target-grade-context"}`,
    schemaVersion: "quiz-figure-refinement-schema-v1",
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

export function buildSolutionFigureExtensionInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizExtendedSolutionFigurePlan;
  targetGrade?: number | null;
  exactQuestionLatexSource: string;
  adminInstructions?: string | null;
  mode?: "REGENERATE" | "EDIT_CURRENT";
  currentSolutionLatexSource?: string | null;
}): AiStructuredInput {
  return {
    systemPrompt: buildQuizFigureSystemPrompt(input.subject, "EXTEND_QUESTION"),
    userPrompt: JSON.stringify({
      role: "SOLUTION",
      aiMode: input.mode ?? "REGENERATE",
      mode: "EXTEND_QUESTION",
      ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
      problem: input.plan.problem,
      solution: input.plan.solution,
      requiredAddedObjects: input.plan.addedObjects,
      requiredClarifiedRelations: input.plan.clarifiedRelations,
      ...(input.mode === "EDIT_CURRENT" && input.currentSolutionLatexSource?.trim()
        ? { currentSolutionLatexSource: input.currentSolutionLatexSource.trim() }
        : {}),
      ...(input.adminInstructions?.trim()
        ? { adminInstructions: input.adminInstructions.trim() }
        : {}),
      exactQuestionLatexSource: input.exactQuestionLatexSource,
      insertionMarker: QUIZ_FIGURE_EXTENSION_MARKER,
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 8_000,
    outputName: "quiz_solution_figure_extension",
    promptVersion: resolveQuizFigurePromptVersion(input.subject, "solution-extend"),
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "quiz-figure-solution",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

export function buildSolutionFigureRedrawInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizRedrawnSolutionFigurePlan;
  targetGrade?: number | null;
  exactQuestionLatexSource: string;
  adminInstructions?: string | null;
  mode?: "REGENERATE" | "EDIT_CURRENT";
  currentSolutionLatexSource?: string | null;
}): AiStructuredInput {
  return {
    systemPrompt: buildQuizFigureSystemPrompt(input.subject, "REDRAW_AS_MODEL"),
    userPrompt: JSON.stringify({
      role: "SOLUTION",
      aiMode: input.mode ?? "REGENERATE",
      mode: "REDRAW_AS_MODEL",
      ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
      problem: input.plan.problem,
      solution: input.plan.solution,
      modelingGoal: input.plan.modelingGoal,
      requiredModeledObjects: input.plan.modeledObjects,
      requiredClarifiedRelations: input.plan.clarifiedRelations,
      exactQuestionLatexSource: input.exactQuestionLatexSource,
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
    outputName: "quiz_solution_figure_redraw",
    promptVersion: resolveQuizFigurePromptVersion(input.subject, "solution-redraw"),
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "quiz-figure-solution-redraw",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

function resolveQuizFigurePromptVersion(
  subject: QuizSubjectSnapshot,
  mode: "question" | "solution-extend" | "solution-redraw",
) {
  const version =
    subject.key === "MATH"
      ? mode === "question"
        ? "v34-target-grade-context"
        : "v33-target-grade-context"
      : mode === "question"
        ? "v32-target-grade-context"
        : "v31-target-grade-context";
  return `quiz-figure-${subject.key.toLowerCase()}-${mode}-${version}`;
}
