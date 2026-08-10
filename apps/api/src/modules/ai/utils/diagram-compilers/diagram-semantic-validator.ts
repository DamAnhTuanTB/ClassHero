import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { canonicalGraphFunctions } from "#api/modules/ai/utils/diagram-compilers/compile-graph-diagram";

export type DiagramSemanticIssue = {
  code: string;
  message: string;
};

export function validateCompiledDiagramSemantics(
  intent: LessonSummaryDiagramIntent,
  spec: LessonSummaryDiagramSpec,
) {
  const issues: DiagramSemanticIssue[] = [];
  const pointIds = new Set(spec.points.map((point) => point.id));
  const pointLabels = new Set(
    spec.points.flatMap((point) => (point.label ? [point.label] : [])),
  );
  const primitiveIds = new Set(spec.primitives.map((primitive) => primitive.id));
  const maxX = spec.viewBox.minX + spec.viewBox.width;
  const maxY = spec.viewBox.minY + spec.viewBox.height;

  for (const point of spec.points) {
    if (
      point.x < spec.viewBox.minX - 1e-8 ||
      point.x > maxX + 1e-8 ||
      point.y < spec.viewBox.minY - 1e-8 ||
      point.y > maxY + 1e-8
    ) {
      issues.push({
        code: "POINT_OUTSIDE_VIEWBOX",
        message: `${point.id} is outside the compiled viewBox.`,
      });
    }
  }
  for (const label of spec.labels) {
    if (!pointIds.has(label.anchorPointId)) {
      issues.push({
        code: "LABEL_UNKNOWN_POINT",
        message: `${label.text} references unknown point ${label.anchorPointId}.`,
      });
    }
    if (label.anchorPrimitiveId && !primitiveIds.has(label.anchorPrimitiveId)) {
      issues.push({
        code: "LABEL_UNKNOWN_PRIMITIVE",
        message: `${label.text} references unknown primitive ${label.anchorPrimitiveId}.`,
      });
    }
    if (pointLabels.has(label.text)) {
      issues.push({
        code: "DUPLICATE_POINT_NAME_AS_FREE_LABEL",
        message: `${label.text} duplicates an existing point name.`,
      });
    }
  }

  if (intent.family === "ALGEBRA_GRAPH") {
    validateGraph(intent, spec, issues);
  }
  if (
    intent.family === "NUMBER_COORDINATE" &&
    (intent.archetype === "COORDINATE_POINTS" || intent.archetype === "INEQUALITY_REGION")
  ) {
    requireCoordinateAxes(spec, issues);
  }
  if (intent.family === "DATA_STATISTICS") {
    validateData(intent, spec, issues);
  }
  if (intent.family === "PLANE_GEOMETRY" || intent.family === "ADVANCED_GEOMETRY") {
    validateGeometryMarkers(spec, issues);
  }
  if (
    intent.family === "PLANE_GEOMETRY" ||
    intent.family === "ADVANCED_GEOMETRY" ||
    intent.family === "SPATIAL_APPLIED"
  ) {
    for (const expectedLabel of intent.pointLabels) {
      if (pointLabels.has(expectedLabel)) continue;
      const representedAsLinearDirectionName =
        intent.family === "PLANE_GEOMETRY" &&
        intent.archetype === "BASIC_CONSTRUCTION" &&
        intent.variant === "LINE_RAY_SEGMENT" &&
        spec.labels.some(
          (label) => label.text === expectedLabel.toLocaleLowerCase("vi"),
        );
      if (representedAsLinearDirectionName) continue;
      issues.push({
        code: "DECLARED_POINT_LABEL_MISSING",
        message: `Declared point ${expectedLabel} is missing from the compiled diagram.`,
      });
    }
  }

  return issues;
}

export function assertCompiledDiagramSemantics(
  intent: LessonSummaryDiagramIntent,
  spec: LessonSummaryDiagramSpec,
) {
  const issues = validateCompiledDiagramSemantics(intent, spec);
  if (issues.length === 0) return;
  throw new Error(
    `Compiled diagram failed semantic validation: ${issues
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join(" | ")}`,
  );
}

function validateGraph(
  intent: Extract<LessonSummaryDiagramIntent, { family: "ALGEBRA_GRAPH" }>,
  spec: LessonSummaryDiagramSpec,
  issues: DiagramSemanticIssue[],
) {
  requireCoordinateAxes(spec, issues);
  const { xScale, yScale } = resolveGraphRenderScales(spec);
  const logicalCoordinate = (point: { x: number; y: number }) => ({
    x: point.x / xScale,
    y: point.y / yScale,
  });
  const expectedFunctions = new Map(
    canonicalGraphFunctions(intent).map((value) => [value.id, value]),
  );
  const namedConstructionPoints = spec.points.filter(
    (point) => point.pointStyle === "FILLED" && point.label,
  );
  const expectedConstructionCoordinates = new Set(
    [...expectedFunctions.values()].flatMap((graphFunction) =>
      graphFunction.constructionXs.map((x) => {
        const y = evaluateGraphFunction(graphFunction, x);
        return graphCoordinateKey(x, y);
      }),
    ),
  );
  if (namedConstructionPoints.length < expectedConstructionCoordinates.size) {
    issues.push({
      code: "GRAPH_CONSTRUCTION_POINT_COUNT",
      message: `Expected at least ${expectedConstructionCoordinates.size} unique named construction points, received ${namedConstructionPoints.length}.`,
    });
  }
  if (
    new Set(namedConstructionPoints.map((point) => point.label)).size !==
    namedConstructionPoints.length
  ) {
    issues.push({
      code: "GRAPH_CONSTRUCTION_NAMES_NOT_UNIQUE",
      message: "Every visible graph construction point must have a unique short name.",
    });
  }
  for (const graphFunction of expectedFunctions.values()) {
    for (const x of graphFunction.constructionXs) {
      const y = evaluateGraphFunction(graphFunction, x);
      const exists = namedConstructionPoints.some(
        (point) => {
          const logical = logicalCoordinate(point);
          return Math.abs(logical.x - x) <= 1e-7 && Math.abs(logical.y - y) <= 1e-7;
        },
      );
      if (!exists) {
        issues.push({
          code: "GRAPH_CONSTRUCTION_POINT_MISSING",
          message: `${graphFunction.id} is missing a named point at (${x}, ${y}).`,
        });
      }
    }
  }
  namedConstructionPoints.forEach((point) => {
    const logical = logicalCoordinate(point);
    if (expectedConstructionCoordinates.has(graphCoordinateKey(logical.x, logical.y))) {
      return;
    }
    const functionCount = [...expectedFunctions.values()].filter(
      (graphFunction) =>
        Math.abs(evaluateGraphFunction(graphFunction, logical.x) - logical.y) <= 1e-7,
    ).length;
    if (functionCount >= 2) return;
    issues.push({
      code: "GRAPH_UNEXPECTED_CONSTRUCTION_POINT",
      message: `Named point ${point.label} at (${logical.x}, ${logical.y}) is neither requested nor an intersection.`,
    });
  });
}

function resolveGraphRenderScales(spec: LessonSummaryDiagramSpec) {
  const scaleFromTicks = (axis: "X" | "Y") => {
    const prefix = axis === "X" ? "tickXBottom" : "tickYLeft";
    for (const label of spec.labels) {
      if (!label.anchorPointId.startsWith(prefix)) continue;
      const logicalValue = Number(label.text.trim().replace(",", "."));
      const anchor = spec.points.find((point) => point.id === label.anchorPointId);
      if (!anchor || !Number.isFinite(logicalValue) || Math.abs(logicalValue) <= 1e-9) {
        continue;
      }
      const renderedValue = axis === "X" ? anchor.x : anchor.y;
      const scale = renderedValue / logicalValue;
      if (Number.isFinite(scale) && scale > 0) return scale;
    }
    return 1;
  };
  return { xScale: scaleFromTicks("X"), yScale: scaleFromTicks("Y") };
}

function evaluateGraphFunction(
  graphFunction: Extract<
    LessonSummaryDiagramIntent,
    { family: "ALGEBRA_GRAPH" }
  >["functions"][number],
  x: number,
) {
  if (graphFunction.kind === "LINEAR") {
    return graphFunction.slope * x + graphFunction.intercept;
  }
  if (graphFunction.kind === "QUADRATIC") {
    return graphFunction.a * x * x + graphFunction.b * x + graphFunction.c;
  }
  return graphFunction.coefficient / x;
}

function graphCoordinateKey(x: number, y: number) {
  return `${x.toFixed(7)}:${y.toFixed(7)}`;
}

function requireCoordinateAxes(
  spec: LessonSummaryDiagramSpec,
  issues: DiagramSemanticIssue[],
) {
  const lines = spec.primitives.filter((primitive) => primitive.type === "LINE");
  if (lines.length < 2) {
    issues.push({
      code: "COORDINATE_AXES_MISSING",
      message: "A Cartesian diagram requires two LINE axes.",
    });
  }
  const axisLabels = new Set(spec.labels.map((label) => label.text.toLowerCase()));
  if (!axisLabels.has("x") || !axisLabels.has("y")) {
    issues.push({
      code: "COORDINATE_AXIS_LABEL_MISSING",
      message: "A Cartesian diagram requires x and y labels.",
    });
  }
  const tickCount = spec.primitives.filter(
    (primitive) => primitive.type === "SEGMENT" && /^(?:tickX|tickY)/u.test(primitive.id),
  ).length;
  if (tickCount < 2) {
    issues.push({
      code: "COORDINATE_TICKS_MISSING",
      message: "A Cartesian diagram requires visible scale ticks.",
    });
  }
}

function validateData(
  intent: Extract<LessonSummaryDiagramIntent, { family: "DATA_STATISTICS" }>,
  spec: LessonSummaryDiagramSpec,
  issues: DiagramSemanticIssue[],
) {
  if (intent.archetype === "CLOCK") {
    const ticks = spec.primitives.filter(
      (primitive) => primitive.type === "SEGMENT" && /^clockTick/u.test(primitive.id),
    );
    const numbers = new Set(spec.labels.map((label) => label.text));
    if (
      ticks.length !== 12 ||
      !["3", "6", "9", "12"].every((value) => numbers.has(value))
    ) {
      issues.push({
        code: "CLOCK_FACE_INCOMPLETE",
        message: "A clock needs 12 marks and visible 3, 6, 9, 12 labels.",
      });
    }
  }
  if (intent.archetype === "VALUE_TABLE") {
    const hasTrailingRowsPlaceholder =
      intent.columns.at(-1)?.trim().toLowerCase() === "rows" &&
      intent.rows.every((row) => row.length === intent.columns.length - 1);
    const expectedColumnCount = hasTrailingRowsPlaceholder
      ? intent.columns.length - 1
      : intent.columns.length;
    const expected = expectedColumnCount * (intent.rows.length + 1);
    const centeredLabels = spec.labels.filter((label) => label.position === "CENTER");
    if (centeredLabels.length !== expected) {
      issues.push({
        code: "TABLE_CELL_LABEL_COUNT",
        message: `Expected ${expected} centered table cells, received ${centeredLabels.length}.`,
      });
    }
  }
  if (intent.archetype === "PICTOGRAM") {
    const expectedSymbols = intent.values.reduce(
      (sum, value) => sum + value / intent.valuePerSymbol,
      0,
    );
    const actualSymbols = spec.primitives.filter((primitive) =>
      /^pictogram\d+Symbol\d+$/u.test(primitive.id),
    ).length;
    if (actualSymbols !== expectedSymbols) {
      issues.push({
        code: "PICTOGRAM_SYMBOL_COUNT",
        message: `Expected ${expectedSymbols} pictogram symbols, received ${actualSymbols}.`,
      });
    }
  }
}

function validateGeometryMarkers(
  spec: LessonSummaryDiagramSpec,
  issues: DiagramSemanticIssue[],
) {
  const lineLikes = new Map(
    spec.primitives
      .filter(
        (primitive) =>
          primitive.type === "SEGMENT" ||
          primitive.type === "LINE" ||
          primitive.type === "RAY",
      )
      .map((primitive) => [primitive.id, primitive] as const),
  );
  for (const marker of spec.markers) {
    if (marker.type !== "EQUAL_LENGTH" && marker.type !== "PARALLEL") continue;
    for (const segmentId of marker.segmentIds) {
      if (lineLikes.has(segmentId)) continue;
      issues.push({
        code: "GEOMETRY_MARKER_NON_SEGMENT",
        message: `${marker.type} must reference concrete segments, received ${segmentId}.`,
      });
    }
  }
}
