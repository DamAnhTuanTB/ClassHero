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
