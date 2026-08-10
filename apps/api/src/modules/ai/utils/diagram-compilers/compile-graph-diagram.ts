import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { addCoordinateAxes } from "#api/modules/ai/utils/diagram-compilers/coordinate-axis-builder";
import {
  DiagramBuilder,
  safeDiagramId,
} from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type GraphIntent = Extract<
  LessonSummaryDiagramIntent,
  { family: "ALGEBRA_GRAPH" }
>;
type GraphFunction = GraphIntent["functions"][number];

const CONSTRUCTION_POINT_NAMES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "K",
  "M",
  "N",
  "P",
  "Q",
] as const;

export function compileGraphDiagram(intent: GraphIntent): LessonSummaryDiagramSpec {
  validateGraphIntent(intent);
  const graphFunctions = canonicalGraphFunctions(intent);
  const { xRenderScale, yRenderScale } = resolveGraphRenderScale(intent);
  const renderX = (value: number) => value * xRenderScale;
  const renderY = (value: number) => value * yRenderScale;
  const renderedXMin = renderX(intent.xMin);
  const renderedXMax = renderX(intent.xMax);
  const renderedYMin = renderY(intent.yMin);
  const renderedYMax = renderY(intent.yMax);
  const xPadding = Math.max((renderedXMax - renderedXMin) * 0.08, 0.5);
  const yPadding = Math.max((renderedYMax - renderedYMin) * 0.08, 0.5);
  const builder = new DiagramBuilder(
    {
      minX: renderedXMin - xPadding,
      minY: renderedYMin - yPadding,
      width: renderedXMax - renderedXMin + xPadding * 2,
      height: renderedYMax - renderedYMin + yPadding * 2,
    },
    intent.caption,
  );
  const hasOriginConstructionPoint = graphFunctions.some((graphFunction) =>
    graphFunction.constructionXs.some(
      (x) => Math.abs(x) <= 1e-9 && Math.abs(evaluateFunction(graphFunction, x)) <= 1e-9,
    ),
  );
  const { originX, originY, originPointId } = addCoordinateAxes(builder, {
    ...intent,
    markOriginPoint: hasOriginConstructionPoint,
    xRenderScale,
    yRenderScale,
  });
  const inferredIntersectionXs = resolveIntersectionXs(intent);
  const constructionPointsByCoordinate = new Map<string, string>();
  if (hasOriginConstructionPoint && originPointId) {
    constructionPointsByCoordinate.set("0:0", originPointId);
  }
  const functionLabelAnchors: Array<{ x: number; y: number }> = [];
  let constructionNameIndex = 0;

  for (const [functionIndex, graphFunction] of graphFunctions.entries()) {
    const constructionXs = new Set(
      [...graphFunction.constructionXs, ...inferredIntersectionXs].map((value) =>
        rounded(value),
      ),
    );
    const sampleGroups = buildFunctionSampleGroups(
      graphFunction,
      intent.xMin,
      intent.xMax,
      [...constructionXs],
    );
    const visibleGroups = sampleGroups
      .map((samples, groupIndex) => {
        const pointIds: string[] = [];
        for (const [sampleIndex, x] of samples.entries()) {
          const y = evaluateFunction(graphFunction, x);
          if (y < intent.yMin - 1e-8 || y > intent.yMax + 1e-8) continue;
          const isConstruction = constructionXs.has(rounded(x));
          const coordinateKey = `${rounded(x)}:${rounded(y)}`;
          const sharedConstructionPointId =
            constructionPointsByCoordinate.get(coordinateKey);
          if (sharedConstructionPointId) {
            pointIds.push(sharedConstructionPointId);
            continue;
          }
          const pointId =
            sampleGroups.length === 1
              ? safeDiagramId(`graph${functionIndex}Point`, sampleIndex)
              : `graph${functionIndex}Group${groupIndex}Point${sampleIndex}`;
          const name = isConstruction
            ? CONSTRUCTION_POINT_NAMES[constructionNameIndex]
            : undefined;
          if (isConstruction && !name) {
            throw new Error("A graph can show at most 14 named construction points.");
          }
          builder.addPoint({
            id: pointId,
            x: renderX(x),
            y: renderY(y),
            label: name ?? null,
            pointStyle: isConstruction ? "FILLED" : "NONE",
            labelPosition: resolveGraphPointLabelPosition(x, y, originX, originY),
          });
          pointIds.push(pointId);
          if (isConstruction) {
            constructionPointsByCoordinate.set(coordinateKey, pointId);
            addConstructionProjections(
              builder,
              pointId,
              renderX(x),
              renderY(y),
              originX,
              originY,
              constructionNameIndex,
            );
            constructionNameIndex += 1;
          }
        }
        return pointIds;
      })
      .filter((pointIds) => pointIds.length >= 2);
    if (visibleGroups.length === 0) {
      throw new Error(`${graphFunction.id} has fewer than two visible points.`);
    }
    for (const [groupIndex, pointIds] of visibleGroups.entries()) {
      const primitiveId = `functionCurve${functionIndex}Branch${groupIndex}`;
      if (graphFunction.kind === "LINEAR") {
        builder.addLine(primitiveId, pointIds[0]!, pointIds.at(-1)!);
      } else {
        builder.addPolyline(primitiveId, pointIds);
      }
    }
    const labelPlacement = resolveFunctionLabelPlacement(
      graphFunction,
      intent,
      [...constructionXs],
      [
        ...[...constructionPointsByCoordinate.keys()].map((key) => {
          const [x = 0, y = 0] = key.split(":").map(Number);
          return { x, y };
        }),
        ...functionLabelAnchors,
      ],
    );
    const labelAnchor = builder.addPoint({
      id: safeDiagramId("functionLabelAnchor", functionIndex),
      x: renderX(labelPlacement.x),
      y:
        renderY(labelPlacement.y) +
        (labelPlacement.position.startsWith("BOTTOM") ? -1 : 1) *
          (renderedYMax - renderedYMin) *
          0.08,
      label: null,
      pointStyle: "NONE",
      labelPosition: labelPlacement.position,
    });
    builder.addLabel({
      text: graphFunction.label,
      anchorPointId: labelAnchor,
      anchorPrimitiveId: null,
      position: labelPlacement.position,
    });
    functionLabelAnchors.push({ x: labelPlacement.x, y: labelPlacement.y });
  }

  return builder.build();
}

function resolveGraphRenderScale(intent: GraphIntent) {
  const xRange = intent.xMax - intent.xMin;
  const yRange = intent.yMax - intent.yMin;
  const rawAspectRatio = xRange / yRange;
  return {
    xRenderScale: rawAspectRatio > 2.4 ? (yRange * 1.8) / xRange : 1,
    yRenderScale: 1,
  };
}

export function canonicalGraphFunctions(intent: GraphIntent): GraphFunction[] {
  return intent.functions
    .map((graphFunction) => ({
      ...graphFunction,
      constructionXs: canonicalConstructionXs(graphFunction),
    }))
    .sort((left, right) => {
      const kindOrder = { QUADRATIC: 0, LINEAR: 1, INVERSE: 2 } as const;
      return (
        kindOrder[left.kind] - kindOrder[right.kind] ||
        left.label.localeCompare(right.label)
      );
    });
}

function canonicalConstructionXs(graphFunction: GraphFunction) {
  const values = uniqueSorted(graphFunction.constructionXs);
  if (graphFunction.kind !== "LINEAR" || values.length <= 2) return values;
  const first = values[0];
  const last = values.at(-1);
  return first === undefined || last === undefined ? values : [first, last];
}

function resolveFunctionLabelPlacement(
  graphFunction: GraphFunction,
  intent: GraphIntent,
  constructionXs: number[],
  avoidancePoints: Array<{ x: number; y: number }>,
) {
  const xRange = intent.xMax - intent.xMin;
  const yRange = intent.yMax - intent.yMin;
  const preferredFractions =
    (graphFunction.kind === "LINEAR" && graphFunction.slope < 0) ||
    graphFunction.kind === "INVERSE"
      ? [0.62, 0.7, 0.54, 0.78]
      : [0.82, 0.74, 0.88, 0.66];
  const candidates = preferredFractions
    .map((fraction) => {
      const x = intent.xMin + xRange * fraction;
      const y = evaluateFunction(graphFunction, x);
      const edgeClearance = Math.min(
        x - intent.xMin,
        intent.xMax - x,
        y - intent.yMin,
        intent.yMax - y,
      );
      const constructionClearance = constructionXs.length
        ? Math.min(...constructionXs.map((value) => Math.abs(x - value)))
        : xRange;
      const pointClearance = avoidancePoints.length
        ? Math.min(
            ...avoidancePoints.map((point) =>
              Math.hypot((x - point.x) / xRange, (y - point.y) / yRange),
            ),
          )
        : 1;
      return {
        x,
        y,
        pointClearance,
        score:
          Math.min(edgeClearance / Math.max(xRange, yRange), 0.2) +
          Math.min(constructionClearance / xRange, 0.2) +
          Math.min(pointClearance, 0.25),
      };
    })
    .filter(
      ({ y, pointClearance }) =>
        y >= intent.yMin + yRange * 0.08 &&
        y <= intent.yMax - yRange * 0.08 &&
        pointClearance >= 0.12,
    )
    .sort((left, right) => right.score - left.score);
  const selected = candidates[0];
  if (!selected) {
    const visiblePoint = findVisibleFunctionLabelPoint(graphFunction, intent);
    return {
      ...visiblePoint,
      position: resolveFunctionLabelPosition(
        graphFunction,
        visiblePoint.x,
        constructionXs,
      ),
    };
  }
  return {
    x: rounded(selected.x),
    y: rounded(selected.y),
    position: resolveFunctionLabelPosition(graphFunction, selected.x, constructionXs),
  };
}

function findVisibleFunctionLabelPoint(
  graphFunction: GraphFunction,
  intent: GraphIntent,
) {
  const steps = 40;
  for (let index = steps - 3; index >= 3; index -= 1) {
    const x = intent.xMin + ((intent.xMax - intent.xMin) * index) / steps;
    const y = evaluateFunction(graphFunction, x);
    if (y >= intent.yMin && y <= intent.yMax) return { x: rounded(x), y: rounded(y) };
  }
  throw new Error(`${graphFunction.id} has no visible location for its function label.`);
}

function resolveFunctionLabelPosition(
  graphFunction: GraphFunction,
  x: number,
  constructionXs: readonly number[],
) {
  if (graphFunction.kind === "LINEAR") {
    return graphFunction.slope < 0
      ? ("BOTTOM_RIGHT" as const)
      : ("TOP_RIGHT" as const);
  }
  if (graphFunction.kind === "QUADRATIC") {
    const vertexX = -graphFunction.b / (2 * graphFunction.a);
    if (x >= vertexX) {
      const hasProjectionBlockerToTheRight = constructionXs.some(
        (constructionX) => constructionX > x + 1e-8,
      );
      return hasProjectionBlockerToTheRight
        ? ("TOP_LEFT" as const)
        : ("TOP_RIGHT" as const);
    }
    const hasProjectionBlockerToTheLeft = constructionXs.some(
      (constructionX) => constructionX < x - 1e-8,
    );
    return hasProjectionBlockerToTheLeft
      ? ("TOP_RIGHT" as const)
      : ("TOP_LEFT" as const);
  }
  const slope =
    -graphFunction.coefficient / (x * x);
  return slope >= 0 ? ("TOP_LEFT" as const) : ("TOP_RIGHT" as const);
}

function buildFunctionSampleGroups(
  graphFunction: GraphFunction,
  xMin: number,
  xMax: number,
  constructionXs: number[],
) {
  if (graphFunction.kind === "LINEAR") {
    return [uniqueSorted([xMin, ...constructionXs, xMax])];
  }
  if (graphFunction.kind === "INVERSE") {
    const sampleCount = 24;
    const epsilon = Math.max((xMax - xMin) / 240, 0.03);
    const negativeMax = Math.min(-epsilon, xMax);
    const positiveMin = Math.max(epsilon, xMin);
    const buildBranch = (start: number, end: number) =>
      start < end
        ? Array.from(
            { length: sampleCount },
            (_, index) => start + ((end - start) * index) / (sampleCount - 1),
          )
        : [];
    const negativeConstruction = constructionXs.filter((x) => x < 0);
    const positiveConstruction = constructionXs.filter((x) => x > 0);
    return [
      uniqueSorted([
        ...buildBranch(xMin, negativeMax),
        ...negativeConstruction,
      ]),
      uniqueSorted([
        ...buildBranch(positiveMin, xMax),
        ...positiveConstruction,
      ]),
    ].filter((branch) => branch.length >= 2);
  }
  const sampleCount = 33;
  const step = (xMax - xMin) / (sampleCount - 1);
  const uniform = Array.from({ length: sampleCount }, (_, index) => xMin + index * step);
  return [uniqueSorted([...uniform, ...constructionXs])];
}

function resolveIntersectionXs(intent: GraphIntent) {
  if (intent.archetype === "LINEAR_SYSTEM") {
    const [first, second] = intent.functions;
    if (!first || !second || first.kind !== "LINEAR" || second.kind !== "LINEAR") {
      return [];
    }
    const slopeDifference = first.slope - second.slope;
    if (Math.abs(slopeDifference) <= 1e-10) return [];
    const x = (second.intercept - first.intercept) / slopeDifference;
    return x >= intent.xMin && x <= intent.xMax ? [x] : [];
  }
  if (intent.archetype === "LINE_QUADRATIC_INTERSECTION") {
    const linear = intent.functions.find(
      (graphFunction): graphFunction is Extract<GraphFunction, { kind: "LINEAR" }> =>
        graphFunction.kind === "LINEAR",
    );
    const quadratic = intent.functions.find(
      (
        graphFunction,
      ): graphFunction is Extract<GraphFunction, { kind: "QUADRATIC" }> =>
        graphFunction.kind === "QUADRATIC",
    );
    if (!linear || !quadratic) return [];
    const a = quadratic.a;
    const b = quadratic.b - linear.slope;
    const c = quadratic.c - linear.intercept;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -1e-10) return [];
    const root = Math.sqrt(Math.max(0, discriminant));
    return uniqueSorted([(-b - root) / (2 * a), (-b + root) / (2 * a)]).filter(
      (x) => x >= intent.xMin && x <= intent.xMax,
    );
  }
  return [];
}

function evaluateFunction(graphFunction: GraphFunction, x: number) {
  if (graphFunction.kind === "LINEAR") {
    return graphFunction.slope * x + graphFunction.intercept;
  }
  if (graphFunction.kind === "QUADRATIC") {
    return graphFunction.a * x * x + graphFunction.b * x + graphFunction.c;
  }
  return graphFunction.coefficient / x;
}

function addConstructionProjections(
  builder: DiagramBuilder,
  pointId: string,
  x: number,
  y: number,
  originX: number,
  originY: number,
  index: number,
) {
  if (Math.abs(y - originY) > 1e-9) {
    const xProjection = builder.addPoint({
      id: safeDiagramId("graphProjectionX", index),
      x,
      y: originY,
      label: null,
      pointStyle: "NONE",
      labelPosition: "BOTTOM",
    });
    builder.addSegment(
      safeDiagramId("graphProjectionToX", index),
      pointId,
      xProjection,
      "DASHED",
    );
  }
  if (Math.abs(x - originX) > 1e-9) {
    const yProjection = builder.addPoint({
      id: safeDiagramId("graphProjectionY", index),
      x: originX,
      y,
      label: null,
      pointStyle: "NONE",
      labelPosition: "LEFT",
    });
    builder.addSegment(
      safeDiagramId("graphProjectionToY", index),
      pointId,
      yProjection,
      "DASHED",
    );
  }
}

function validateGraphIntent(intent: GraphIntent) {
  if (intent.xMin >= intent.xMax || intent.yMin >= intent.yMax) {
    throw new Error("Graph domains must have min smaller than max.");
  }
  const kinds = intent.functions.map((value) => value.kind);
  const valid =
    (intent.archetype === "LINEAR_FUNCTION" &&
      kinds.length === 1 &&
      kinds[0] === "LINEAR") ||
    (intent.archetype === "QUADRATIC_FUNCTION" &&
      kinds.length >= 1 &&
      kinds.length <= 3 &&
      kinds.every((kind) => kind === "QUADRATIC")) ||
    (intent.archetype === "INVERSE_FUNCTION" &&
      kinds.length === 1 &&
      kinds[0] === "INVERSE") ||
    (intent.archetype === "LINEAR_SYSTEM" &&
      kinds.length === 2 &&
      kinds.every((kind) => kind === "LINEAR")) ||
    (intent.archetype === "LINE_QUADRATIC_INTERSECTION" &&
      kinds.length === 2 &&
      kinds.includes("LINEAR") &&
      kinds.includes("QUADRATIC"));
  if (!valid) {
    throw new Error(`${intent.archetype} received incompatible function kinds.`);
  }
  for (const graphFunction of intent.functions) {
    for (const x of graphFunction.constructionXs) {
      if (x < intent.xMin || x > intent.xMax) {
        throw new Error(`${graphFunction.id} construction x=${x} is outside the x domain.`);
      }
      const y = evaluateFunction(graphFunction, x);
      if (y < intent.yMin || y > intent.yMax) {
        throw new Error(
          `${graphFunction.id} construction point (${x}, ${y}) is outside the y domain.`,
        );
      }
    }
  }
}

function resolveGraphPointLabelPosition(x: number, y: number, originX: number, originY: number) {
  if (x >= originX && y >= originY) return "TOP_RIGHT" as const;
  if (x < originX && y >= originY) return "TOP_LEFT" as const;
  if (x < originX) return "BOTTOM_LEFT" as const;
  return "BOTTOM_RIGHT" as const;
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map(rounded))].sort((left, right) => left - right);
}

function rounded(value: number) {
  return Number(value.toFixed(8));
}
