import stemFigureToolboxManifestJson from "./stem-figure-toolbox-manifest.json" with {
  type: "json",
};

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
