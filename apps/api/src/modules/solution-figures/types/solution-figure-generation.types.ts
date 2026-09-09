import { stemFigureLatexSourceSchema } from "@learning-path/shared";
import { z } from "zod";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { SolutionFigureSubjectSnapshot } from "#api/modules/solution-figures/types/solution-figure-subject.types";
import { buildSolutionFigureSystemPrompt } from "#api/modules/solution-figures/utils/prompts/solution-figure-system-prompt-resolver";

export const SOLUTION_FIGURE_SCHEMA_VERSION = "solution-figure-schema-v1";
export const SOLUTION_FIGURE_PROMPT_VERSION = "v1-shared";

export type SolutionFigureMode = "REGENERATE" | "EDIT_CURRENT";

export const generatedSolutionFigureSchema = z
  .object({ latexSource: stemFigureLatexSourceSchema })
  .strict();

export function buildSolutionFigureStructuredInput(input: {
  subject: SolutionFigureSubjectSnapshot;
  problem: string;
  solution: string;
  targetGrade?: number | null;
  adminInstructions?: string | null;
  mode?: SolutionFigureMode;
  currentSolutionLatexSource?: string | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
}): AiStructuredInput {
  const mode = input.mode ?? "REGENERATE";
  const payload = {
    role: "SOLUTION" as const,
    aiMode: mode,
    ...(input.targetGrade == null ? {} : { targetGrade: input.targetGrade }),
    problem: input.problem,
    solution: input.solution,
    ...(mode === "EDIT_CURRENT" && input.currentSolutionLatexSource?.trim()
      ? { currentSolutionLatexSource: input.currentSolutionLatexSource.trim() }
      : {}),
    ...(input.adminInstructions?.trim()
      ? { adminInstructions: input.adminInstructions.trim() }
      : {}),
  };

  return {
    systemPrompt:
      input.systemPrompt?.trim() || buildSolutionFigureSystemPrompt(input.subject),
    userPrompt: input.userPrompt?.trim() || JSON.stringify(payload),
    inputImages: [],
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "solution_figure",
    promptVersion: `solution-figure-${input.subject.key.toLowerCase()}-${SOLUTION_FIGURE_PROMPT_VERSION}`,
    schemaVersion: SOLUTION_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "solution-figure",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}
