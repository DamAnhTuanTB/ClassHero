import { stemFigureLatexSourceSchema } from "@learning-path/shared";
import { z } from "zod";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { QuestionFigureSubjectSnapshot } from "#api/modules/question-figures/types/question-figure-subject.types";
import { buildQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/question-figure-system-prompt-resolver";

export const QUESTION_FIGURE_SCHEMA_VERSION = "question-figure-schema-v1";
export const QUESTION_FIGURE_PROMPT_VERSION = "v1-shared";

export type QuestionFigureMode = "REGENERATE" | "EDIT_CURRENT";

export const generatedQuestionFigureSchema = z
  .object({ latexSource: stemFigureLatexSourceSchema })
  .strict();

export function buildQuestionFigureStructuredInput(input: {
  subject: QuestionFigureSubjectSnapshot;
  problem: string;
  targetGrade?: number | null;
  adminInstructions?: string | null;
  mode?: QuestionFigureMode;
  currentQuestionLatexSource?: string | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
}): AiStructuredInput {
  const mode = input.mode ?? "REGENERATE";
  const payload = {
    role: "QUESTION" as const,
    aiMode: mode,
    ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
    problem: input.problem,
    ...(mode === "EDIT_CURRENT" && input.currentQuestionLatexSource?.trim()
      ? { currentQuestionLatexSource: input.currentQuestionLatexSource.trim() }
      : {}),
    ...(input.adminInstructions?.trim()
      ? { adminInstructions: input.adminInstructions.trim() }
      : {}),
  };

  return {
    systemPrompt:
      input.systemPrompt?.trim() || buildQuestionFigureSystemPrompt(input.subject),
    userPrompt: input.userPrompt?.trim() || JSON.stringify(payload),
    inputImages: [],
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "question_figure",
    promptVersion: `question-figure-${input.subject.key.toLowerCase()}-${QUESTION_FIGURE_PROMPT_VERSION}`,
    schemaVersion: QUESTION_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "question-figure",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}
