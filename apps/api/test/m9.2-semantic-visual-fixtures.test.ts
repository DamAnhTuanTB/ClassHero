import { describe, expect, it } from "vitest";

import { compileLessonSummaryDiagramIntent } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

import { semanticDiagramVisualCases } from "./fixtures/math-diagram/semantic-visual-cases";

describe("M9.2 semantic visual fixture matrix", () => {
  it("covers every supported family and eligible difficulty with unique cases", () => {
    expect(semanticDiagramVisualCases.length).toBeGreaterThanOrEqual(44);
    expect(new Set(semanticDiagramVisualCases.map((item) => item.caseId)).size).toBe(
      semanticDiagramVisualCases.length,
    );
    expect(new Set(semanticDiagramVisualCases.map((item) => item.intent.family)).size).toBe(
      8,
    );
    expect(new Set(semanticDiagramVisualCases.map((item) => item.intent.difficulty))).toEqual(
      new Set(["SIMPLE", "MEDIUM", "HARD"]),
    );
  });

  it("compiles every review fixture deterministically", () => {
    for (const visualCase of semanticDiagramVisualCases) {
      const first = compileLessonSummaryDiagramIntent(visualCase.intent);
      const second = compileLessonSummaryDiagramIntent(visualCase.intent);
      expect(second, visualCase.caseId).toEqual(first);
      expect(first.spec.points.length, visualCase.caseId).toBeGreaterThan(1);
      expect(first.spec.primitives.length, visualCase.caseId).toBeGreaterThan(0);
    }
  });
});
