import stemFigureToolboxManifestJson from "./stem-figure-toolbox-manifest.json" with { type: "json" };

export const APP_NAME = "learning-path-mvp";

export const LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS = 64_000;

export const AI_REASONING_EFFORT_LEVELS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type AiReasoningEffort = (typeof AI_REASONING_EFFORT_LEVELS)[number];

export function isAiReasoningEffort(value: unknown): value is AiReasoningEffort {
  return AI_REASONING_EFFORT_LEVELS.some((level) => level === value);
}

export function normalizeAiReasoningEffortLevels(
  values: readonly unknown[],
): AiReasoningEffort[] {
  const supportedLevels = new Set(values.filter(isAiReasoningEffort));
  return AI_REASONING_EFFORT_LEVELS.filter((level) => supportedLevels.has(level));
}

export const PROVIDER_USAGE_OPERATIONS = [
  "SUMMARY_GENERATION",
  "QUIZ_GENERATION",
  "FLASHCARD_GENERATION",
  "TEST_GENERATION",
  "EXPLANATION_GENERATION",
  "CHAT_RESPONSE_GENERATION",
  "EMBEDDING_GENERATION",
  "DOCUMENT_EXTRACTION",
  "DIAGRAM_GENERATION",
  "QUIZ_SOLUTION_REFINEMENT",
  "QUIZ_SOLUTION_REGENERATION",
  "SUMMARY_FIGURE_GENERATION",
  "SUMMARY_QUESTION_FIGURE_GENERATION",
  "SUMMARY_SOLUTION_FIGURE_GENERATION",
  "SUMMARY_FIGURE_EDITING",
  "SUMMARY_FIGURE_REPAIR",
  "QUIZ_QUESTION_FIGURE_GENERATION",
  "QUIZ_QUESTION_FIGURE_EDITING",
  "QUIZ_QUESTION_FIGURE_REFINEMENT",
  "QUIZ_SOLUTION_FIGURE_GENERATION",
  "QUIZ_SOLUTION_FIGURE_EDITING",
  "QUIZ_SOLUTION_FIGURE_REFINEMENT",
  "FLASHCARD_SOLUTION_FIGURE_GENERATION",
] as const;

export type ProviderUsageOperation = (typeof PROVIDER_USAGE_OPERATIONS)[number];

export const STEM_FIGURE_SUBJECT_KEYS = [
  "MATH",
  "PHYSICS",
  "CHEMISTRY",
  "GENERAL",
] as const;

export type StemFigureSubjectKey = (typeof STEM_FIGURE_SUBJECT_KEYS)[number];

export type StemFigureToolboxProfile = {
  rootEnvironments: string[];
  headerCommands: string[];
  packages: Array<{ name: string; options?: string }>;
  tikzLibraries: string[];
  pgfplotsLibraries: string[];
  compilerDeclarations: string[];
};

export type StemFigureToolboxManifest = {
  version: string;
  subjects: Record<StemFigureSubjectKey, StemFigureToolboxProfile>;
};

export const STEM_FIGURE_TOOLBOX_MANIFEST =
  stemFigureToolboxManifestJson as StemFigureToolboxManifest;
