import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";

import { semanticDiagramVisualCases } from "./semantic-visual-cases";

export type MathDiagramLiveGateABatch = "CALIBRATION" | "CORE" | "EDGE";

export type MathDiagramLiveGateACase = {
  caseId: string;
  sourceFixtureId: string;
  batch: MathDiagramLiveGateABatch;
  grade: number;
  difficulty: "SIMPLE" | "MEDIUM" | "HARD";
  title: string;
  problem: string;
  expectedFamily: LessonSummaryDiagramIntent["family"];
  expectedArchetype: LessonSummaryDiagramIntent["archetype"];
  expectedIntent: LessonSummaryDiagramIntent;
};

type CaseSeed = {
  sourceFixtureId: string;
  difficulty?: MathDiagramLiveGateACase["difficulty"];
};

const calibrationSeeds: CaseSeed[] = [
  { sourceFixtureId: "elementary-tape" },
  { sourceFixtureId: "coordinate-three-points" },
  { sourceFixtureId: "graph-linear-system" },
  { sourceFixtureId: "data-line-chart" },
  { sourceFixtureId: "geometry-parallel-transversal" },
  { sourceFixtureId: "advanced-tangent" },
  { sourceFixtureId: "spatial-cylinder" },
  { sourceFixtureId: "schematic-venn-universe" },
];

const coreSeeds: CaseSeed[] = [
  { sourceFixtureId: "elementary-array" },
  { sourceFixtureId: "elementary-fraction-circle" },
  { sourceFixtureId: "elementary-composite" },
  { sourceFixtureId: "coordinate-number-line-integers" },
  { sourceFixtureId: "coordinate-interval" },
  { sourceFixtureId: "coordinate-inequality-region" },
  { sourceFixtureId: "graph-linear" },
  { sourceFixtureId: "graph-quadratic" },
  { sourceFixtureId: "graph-line-parabola" },
  { sourceFixtureId: "data-clock" },
  { sourceFixtureId: "data-bar-chart" },
  { sourceFixtureId: "data-pie-chart" },
  { sourceFixtureId: "geometry-triangle-right" },
  { sourceFixtureId: "geometry-regular-hexagon" },
  { sourceFixtureId: "geometry-congruence-shared" },
  { sourceFixtureId: "advanced-circumcircle", difficulty: "SIMPLE" },
  { sourceFixtureId: "advanced-thales" },
  { sourceFixtureId: "advanced-cyclic" },
  { sourceFixtureId: "spatial-cuboid", difficulty: "SIMPLE" },
  { sourceFixtureId: "spatial-triangular-prism" },
  { sourceFixtureId: "spatial-pyramid" },
  { sourceFixtureId: "schematic-venn" },
  { sourceFixtureId: "schematic-tree" },
  { sourceFixtureId: "schematic-network" },
];

const edgeSeeds: CaseSeed[] = [
  { sourceFixtureId: "elementary-thermometer" },
  { sourceFixtureId: "coordinate-number-line-fractions" },
  { sourceFixtureId: "graph-inverse" },
  { sourceFixtureId: "data-grouped-bar-chart" },
  { sourceFixtureId: "geometry-line-ray-segment" },
  { sourceFixtureId: "geometry-circle-sector" },
  { sourceFixtureId: "geometry-kite" },
  { sourceFixtureId: "advanced-incircle" },
  { sourceFixtureId: "advanced-two-circles" },
  { sourceFixtureId: "spatial-cuboid-net" },
  { sourceFixtureId: "schematic-venn-three-sets" },
  { sourceFixtureId: "data-histogram" },
];

const fixturesById = new Map(
  semanticDiagramVisualCases.map((visualCase) => [visualCase.caseId, visualCase]),
);

function completeProblem(
  source: (typeof semanticDiagramVisualCases)[number],
) {
  const { intent } = source;
  if (intent.family === "DATA_STATISTICS") {
    if (
      intent.archetype === "BAR_CHART" ||
      intent.archetype === "LINE_CHART" ||
      intent.archetype === "HISTOGRAM" ||
      intent.archetype === "PIE_CHART"
    ) {
      const seriesFacts = intent.series
        .map(
          (series) =>
            `${series.label}: ${series.values
              .map((value, index) => `${intent.categories[index]} = ${value}`)
              .join(", ")}`,
        )
        .join("; ");
      return `${source.problem} Dữ liệu: ${seriesFacts}${intent.unit ? ` (${intent.unit})` : ""}.`;
    }
    if (intent.archetype === "PICTOGRAM") {
      return `${source.problem} Dữ liệu: ${intent.categories
        .map((category, index) => `${category} = ${intent.values[index]}`)
        .join(", ")} ${intent.unit}.`;
    }
  }
  if (
    intent.family === "NUMBER_COORDINATE" &&
    intent.archetype === "COORDINATE_POINTS"
  ) {
    return `${source.problem} Từ mỗi điểm, kẻ đường dóng nét đứt vuông góc tới cả hai trục tọa độ.`;
  }
  if (intent.family === "SET_SCHEMATIC") {
    const labelsById = new Map(intent.nodes.map((node) => [node.id, node.label]));
    const nodeFacts = intent.nodes
      .map((node) => `${node.label} thuộc ${node.group ?? "phần không phân nhóm"}`)
      .join(", ");
    const edgeFacts = intent.edges
      .map((edge) => {
        const from = labelsById.get(edge.from) ?? edge.from;
        const to = labelsById.get(edge.to) ?? edge.to;
        return `${from} → ${to}${edge.label ? `, nhãn ${edge.label}` : ""}`;
      })
      .join(", ");
    return `${source.problem}${nodeFacts ? ` Dữ liệu nút: ${nodeFacts}.` : ""}${
      edgeFacts ? ` Các liên kết: ${edgeFacts}.` : ""
    }`;
  }
  if (
    intent.family === "PLANE_GEOMETRY" ||
    intent.family === "ADVANCED_GEOMETRY" ||
    intent.family === "SPATIAL_APPLIED"
  ) {
    return `${source.problem} Dùng các kí hiệu điểm ${intent.pointLabels.join(", ")}.`;
  }
  return source.problem;
}

function buildCases(batch: MathDiagramLiveGateABatch, seeds: CaseSeed[]) {
  return seeds.map((seed, index): MathDiagramLiveGateACase => {
    const source = fixturesById.get(seed.sourceFixtureId);
    if (!source) throw new Error(`Unknown semantic fixture ${seed.sourceFixtureId}.`);
    return {
      caseId: `${batch.toLowerCase()}-${String(index + 1).padStart(2, "0")}-${source.caseId}`,
      sourceFixtureId: source.caseId,
      batch,
      grade: source.intent.grade,
      difficulty: seed.difficulty ?? source.intent.difficulty,
      title: source.title,
      problem: completeProblem(source),
      expectedFamily: source.intent.family,
      expectedArchetype: source.intent.archetype,
      expectedIntent: {
        ...source.intent,
        difficulty: seed.difficulty ?? source.intent.difficulty,
      },
    };
  });
}

export const mathDiagramLiveGateACases = [
  ...buildCases("CALIBRATION", calibrationSeeds),
  ...buildCases("CORE", coreSeeds),
  ...buildCases("EDGE", edgeSeeds),
];
