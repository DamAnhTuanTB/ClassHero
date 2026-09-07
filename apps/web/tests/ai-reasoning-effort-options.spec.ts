import { expect, test } from "@playwright/test";
import { AI_REASONING_EFFORT_LEVELS } from "@learning-path/shared";

import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";

test("lists every supported reasoning effort in ascending order", () => {
  expect(AI_REASONING_EFFORT_LEVELS).toEqual([
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ]);
});

test("sorts and deduplicates model-configured reasoning effort options", () => {
  expect(
    buildAiReasoningEffortOptions([
      "xhigh",
      "low",
      "max",
      "none",
      "high",
      "medium",
      "minimal",
      "low",
      "unsupported",
    ]),
  ).toEqual([
    { value: "", label: "Mặc định của model" },
    { value: "none", label: "Không (None)" },
    { value: "minimal", label: "Tối thiểu (Minimal)" },
    { value: "low", label: "Thấp (Low)" },
    { value: "medium", label: "Trung bình (Medium)" },
    { value: "high", label: "Cao (High)" },
    { value: "xhigh", label: "Rất cao (Extra High)" },
    { value: "max", label: "Tối đa (Max)" },
  ]);
});
