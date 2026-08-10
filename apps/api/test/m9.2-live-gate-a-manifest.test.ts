import { describe, expect, it } from "vitest";

import { mathDiagramLiveGateACases } from "./fixtures/math-diagram/live-gate-a-cases";

describe("M9.2 paid live Gate A manifest", () => {
  it("contains exactly 8 calibration, 24 core and 12 edge requests", () => {
    expect(mathDiagramLiveGateACases).toHaveLength(44);
    expect(
      mathDiagramLiveGateACases.filter((liveCase) => liveCase.batch === "CALIBRATION"),
    ).toHaveLength(8);
    expect(
      mathDiagramLiveGateACases.filter((liveCase) => liveCase.batch === "CORE"),
    ).toHaveLength(24);
    expect(
      mathDiagramLiveGateACases.filter((liveCase) => liveCase.batch === "EDGE"),
    ).toHaveLength(12);
  });

  it("includes semantic edge labels in schematic prompts", () => {
    const tree = mathDiagramLiveGateACases.find(
      (liveCase) => liveCase.sourceFixtureId === "schematic-tree",
    );

    expect(tree?.problem).toContain("Bắt đầu → Ngửa, nhãn 1/2");
    expect(tree?.problem).toContain("Bắt đầu → Sấp, nhãn 1/2");
  });

  it("keeps every request and source fixture unique", () => {
    expect(new Set(mathDiagramLiveGateACases.map((liveCase) => liveCase.caseId)).size).toBe(
      44,
    );
    expect(
      new Set(mathDiagramLiveGateACases.map((liveCase) => liveCase.sourceFixtureId)).size,
    ).toBe(44);
  });

  it("covers every family once in calibration and at all difficulties in core", () => {
    const calibration = mathDiagramLiveGateACases.filter(
      (liveCase) => liveCase.batch === "CALIBRATION",
    );
    const core = mathDiagramLiveGateACases.filter(
      (liveCase) => liveCase.batch === "CORE",
    );
    const families = new Set(mathDiagramLiveGateACases.map((liveCase) => liveCase.expectedFamily));

    expect(families.size).toBe(8);
    for (const family of families) {
      expect(
        calibration.filter((liveCase) => liveCase.expectedFamily === family),
      ).toHaveLength(1);
      expect(
        new Set(
          core
            .filter((liveCase) => liveCase.expectedFamily === family)
            .map((liveCase) => liveCase.difficulty),
        ),
      ).toEqual(new Set(["SIMPLE", "MEDIUM", "HARD"]));
    }
  });
});
