import {
  normalizeAiReasoningEffortLevels,
  type AiReasoningEffort,
} from "@learning-path/shared";

export const AI_REASONING_EFFORT_LABELS: Record<AiReasoningEffort, string> = {
  none: "Không (None)",
  minimal: "Tối thiểu (Minimal)",
  low: "Thấp (Low)",
  medium: "Trung bình (Medium)",
  high: "Cao (High)",
  xhigh: "Rất cao (Extra High)",
  max: "Tối đa (Max)",
};

export function buildAiReasoningEffortOptions(
  levels: readonly unknown[] | undefined,
  currentLevel?: unknown,
) {
  const normalizedLevels = normalizeAiReasoningEffortLevels([
    ...(levels ?? []),
    ...(currentLevel === undefined || currentLevel === null ? [] : [currentLevel]),
  ]);

  return [
    { value: "", label: "Mặc định của model" },
    ...normalizedLevels.map((level) => ({
      value: level,
      label: AI_REASONING_EFFORT_LABELS[level],
    })),
  ];
}
