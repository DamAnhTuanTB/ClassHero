import { describe, expect, it } from "vitest";

import { compareStemFigurePositions } from "#api/modules/stem-figures/utils/stem-figure-position";

describe("M9.2 STEM figure position ordering", () => {
  it("sorts figures by their numeric appearance in summary content", () => {
    const figures = [
      { blockPath: "sections.1.blocks.0", figureIndex: 0 },
      { blockPath: "sections.0.blocks.10", figureIndex: 0 },
      { blockPath: "sections.0.blocks.2", figureIndex: 1 },
      { blockPath: "sections.0.blocks.2", figureIndex: 0 },
    ];

    expect(figures.sort(compareStemFigurePositions)).toEqual([
      { blockPath: "sections.0.blocks.2", figureIndex: 0 },
      { blockPath: "sections.0.blocks.2", figureIndex: 1 },
      { blockPath: "sections.0.blocks.10", figureIndex: 0 },
      { blockPath: "sections.1.blocks.0", figureIndex: 0 },
    ]);
  });
});
