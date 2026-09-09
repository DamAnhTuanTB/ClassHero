import { expect, test } from "@playwright/test";

import type { UsageEvent } from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  formatReasoningEffort,
  formatUsageDuration,
  formatUsagePurpose,
  formatUsageTarget,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";

test("formats the snapshotted AI operation, reasoning effort, and latency", () => {
  const event = {
    category: "AI_MODEL",
    operation: "QUIZ_SOLUTION_REFINEMENT",
    reasoningEffort: "xhigh",
  } as UsageEvent;

  expect(formatUsagePurpose(event)).toBe("Tinh chỉnh lời giải");
  expect(formatReasoningEffort(event)).toBe("Rất cao");
  expect(formatUsageDuration(12_450, "SUCCEEDED")).toBe("12,5 giây");
  expect(formatUsageDuration(119_900, "SUCCEEDED")).toBe("2 phút");
  expect(formatUsageDuration(null, "RUNNING")).toBe("Đang xử lý");
});

test("keeps a safe fallback for legacy usage events", () => {
  const event = {
    category: "AI_MODEL",
    provider: "OPENAI",
    feature: "SUMMARY",
    purpose: "IMAGE",
    operation: null,
    reasoningEffort: null,
    backgroundJob: { queue: "DIAGRAM_RENDERING", resourceType: "STEM_FIGURE" },
  } as UsageEvent;

  expect(formatUsagePurpose(event)).toBe("Tạo hình minh họa");
  expect(formatReasoningEffort(event)).toBe("Chưa ghi nhận");
});

test("shows the concise target label returned by the API", () => {
  const event = {
    category: "AI_MODEL",
    provider: "OPENAI",
  } as UsageEvent;
  expect(
    formatUsageTarget({
      ...event,
      targetLabel: "Flashcard · Thẻ 2 · Hình lời giải",
    }),
  ).toBe("Flashcard · Thẻ 2 · Hình lời giải");
  expect(formatUsageTarget(event)).toBe("Chưa xác định");
});
