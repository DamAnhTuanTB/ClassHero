import { describe, expect, it } from "vitest";

import {
  buildItemUsageTarget,
  buildSummaryBlockUsageTarget,
  buildWholeFeatureUsageTarget,
  formatProviderUsageTargetLabel,
  parseProviderUsageTargetContext,
} from "#api/modules/provider-operations/utils/provider-usage-target";

describe("M9.32 provider usage target context", () => {
  it("formats concise targets for whole generations and numbered items", () => {
    expect(formatProviderUsageTargetLabel(buildWholeFeatureUsageTarget("QUIZ")))
      .toBe("Quiz · Cả bộ");
    expect(
      formatProviderUsageTargetLabel(
        buildItemUsageTarget({
          kind: "QUIZ_QUESTION",
          entityId: "11111111-1111-4111-8111-111111111111",
          sortOrder: 3,
          figureRole: "SOLUTION",
        }),
      ),
    ).toBe("Quiz · Câu 4 · Hình lời giải");
    expect(
      formatProviderUsageTargetLabel(
        buildItemUsageTarget({
          kind: "FLASHCARD_CARD",
          entityId: "22222222-2222-4222-8222-222222222222",
          sortOrder: 1,
          figureRole: "SOLUTION",
        }),
      ),
    ).toBe("Flashcard · Thẻ 2 · Hình lời giải");
  });

  it("keeps summary block coordinates immutable and short", () => {
    const target = buildSummaryBlockUsageTarget({
      entityId: "33333333-3333-4333-8333-333333333333",
      blockPath: "sections.1.blocks.2",
      blockType: "example",
      targetMode: "SOLUTION",
    });

    expect(target).toMatchObject({
      sectionOrdinal: 2,
      blockOrdinal: 3,
      blockKind: "EXAMPLE",
      figureRole: "SOLUTION",
    });
    expect(formatProviderUsageTargetLabel(target)).toBe(
      "Ví dụ 2.3 · Hình lời giải",
    );
  });

  it("does not infer an invalid legacy snapshot", () => {
    expect(parseProviderUsageTargetContext({ kind: "QUIZ_QUESTION" })).toBeNull();
    expect(formatProviderUsageTargetLabel(null)).toBe("Chưa xác định");
  });
});
