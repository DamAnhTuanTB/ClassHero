import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { addCoordinateAxes } from "#api/modules/ai/utils/diagram-compilers/coordinate-axis-builder";
import {
  DiagramBuilder,
  formatDiagramNumber,
  safeDiagramId,
} from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type CoordinateIntent = Extract<
  LessonSummaryDiagramIntent,
  { family: "NUMBER_COORDINATE" }
>;

export function compileCoordinateDiagram(
  intent: CoordinateIntent,
): LessonSummaryDiagramSpec {
  switch (intent.archetype) {
    case "NUMBER_LINE":
      return compileNumberLine(intent);
    case "INTERVAL":
      return compileInterval(intent);
    case "COORDINATE_POINTS":
      return compileCoordinatePoints(intent);
    case "INEQUALITY_REGION":
      return compileInequalityRegion(intent);
  }
}

function compileNumberLine(
  intent: Extract<CoordinateIntent, { archetype: "NUMBER_LINE" }>,
) {
  const captionRange = numberLineRangeFromCaption(intent.caption);
  const hasCollapsedPointValues =
    new Set(intent.points.map((item) => item.value)).size < intent.points.length;
  const shouldRecoverFromCaption =
    captionRange !== null &&
    (hasCollapsedPointValues ||
      Math.abs(captionRange.min - intent.min) > 1e-8 ||
      Math.abs(captionRange.max - intent.max) > 1e-8);
  const displayOffset = shouldRecoverFromCaption ? captionRange.min : 0;
  const min = shouldRecoverFromCaption ? 0 : intent.min;
  const max = shouldRecoverFromCaption ? captionRange.max - captionRange.min : intent.max;
  const step = shouldRecoverFromCaption ? 1 : intent.step;
  const visiblePoints = shouldRecoverFromCaption ? [] : intent.points;
  assertAscending(min, max, "number line");
  const builder = new DiagramBuilder(
    {
      minX: min - step * 0.8,
      minY: -1.3,
      width: max - min + step * 1.6,
      height: 2.6,
    },
    intent.caption ?? "Trục số",
  );
  const axisStart = builder.addPoint(point("axisStart", min, 0));
  const axisEnd = builder.addPoint(point("axisEnd", max, 0));
  builder.addLine("numberAxis", axisStart, axisEnd);
  addNumberLineTicks(
    builder,
    min,
    max,
    step,
    visiblePoints.map((item) => item.value),
    displayOffset,
  );

  for (const item of visiblePoints) {
    assertWithin(item.value, min, max, item.id);
    const pointId = builder.addPoint({
      id: item.id,
      x: item.value,
      y: 0,
      label: item.label,
      pointStyle: item.endpoint === "OPEN" ? "OPEN" : "FILLED",
      labelPosition: "TOP",
    });
    builder.addLabel({
      text: formatNumberLineValue(item.value, step),
      anchorPointId: pointId,
      anchorPrimitiveId: null,
      position: "BOTTOM",
    });
  }
  return builder.build();
}

function numberLineRangeFromCaption(caption: string | null) {
  const match = caption?.match(/\btừ\s+(\d[\d\s]*?)\s+đến\s+(\d[\d\s]*)/iu);
  if (!match) return null;
  const min = Number(match[1]!.replaceAll(/\s/gu, ""));
  const max = Number(match[2]!.replaceAll(/\s/gu, ""));
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min >= max) return null;
  if (max - min > 100) return null;
  return { min, max };
}

function compileInterval(intent: Extract<CoordinateIntent, { archetype: "INTERVAL" }>) {
  assertAscending(intent.min, intent.max, "interval domain");
  assertAscending(intent.left, intent.right, "interval endpoints");
  assertWithin(intent.left, intent.min, intent.max, "left endpoint");
  assertWithin(intent.right, intent.min, intent.max, "right endpoint");
  const builder = new DiagramBuilder(
    {
      minX: intent.min - intent.step * 0.8,
      minY: -1.3,
      width: intent.max - intent.min + intent.step * 1.6,
      height: 2.6,
    },
    intent.caption ?? "Khoảng trên trục số",
  );
  const axisStart = builder.addPoint(point("axisStart", intent.min, 0));
  const axisEnd = builder.addPoint(point("axisEnd", intent.max, 0));
  builder.addLine("numberAxis", axisStart, axisEnd);
  addNumberLineTicks(builder, intent.min, intent.max, intent.step);
  const left = builder.addPoint({
    ...point("intervalLeft", intent.left, 0),
    pointStyle: intent.leftClosed ? "FILLED" : "OPEN",
  });
  const right = builder.addPoint({
    ...point("intervalRight", intent.right, 0),
    pointStyle: intent.rightClosed ? "FILLED" : "OPEN",
  });
  const intervalSegment = builder.addSegment("intervalSegment", left, right);
  const middle = builder.addPoint(
    point("intervalLabelAnchor", (intent.left + intent.right) / 2, 0),
  );
  builder.addLabel({
    text:
      intent.intervalLabel ??
      `${formatDiagramNumber(intent.left)} ${intent.leftClosed ? "≤" : "<"} x ${
        intent.rightClosed ? "≤" : "<"
      } ${formatDiagramNumber(intent.right)}`,
    anchorPointId: middle,
    anchorPrimitiveId: intervalSegment,
    position: "TOP",
  });
  return builder.build();
}

function compileCoordinatePoints(
  intent: Extract<CoordinateIntent, { archetype: "COORDINATE_POINTS" }>,
) {
  const builder = new DiagramBuilder(
    paddedViewBox(intent.xMin, intent.xMax, intent.yMin, intent.yMax),
    intent.caption ?? "Mặt phẳng tọa độ Oxy",
  );
  const { originX, originY } = addCoordinateAxes(builder, intent);
  for (const [index, item] of intent.points.entries()) {
    assertWithin(item.x, intent.xMin, intent.xMax, `${item.id}.x`);
    assertWithin(item.y, intent.yMin, intent.yMax, `${item.id}.y`);
    const pointId = builder.addPoint({
      id: item.id,
      x: item.x,
      y: item.y,
      label: item.label,
      pointStyle: "FILLED",
      labelPosition: resolvePointLabelPosition(item.x, item.y, originX, originY),
    });
    if (!item.showProjections) continue;
    if (Math.abs(item.y - originY) > 1e-9) {
      const xProjection = builder.addPoint(
        point(safeDiagramId("projectionX", index), item.x, originY),
      );
      builder.addSegment(
        safeDiagramId("projectionToX", index),
        pointId,
        xProjection,
        "DASHED",
      );
    }
    if (Math.abs(item.x - originX) > 1e-9) {
      const yProjection = builder.addPoint(
        point(safeDiagramId("projectionY", index), originX, item.y),
      );
      builder.addSegment(
        safeDiagramId("projectionToY", index),
        pointId,
        yProjection,
        "DASHED",
      );
    }
  }
  return builder.build();
}

function compileInequalityRegion(
  intent: Extract<CoordinateIntent, { archetype: "INEQUALITY_REGION" }>,
) {
  const builder = new DiagramBuilder(
    paddedViewBox(intent.xMin, intent.xMax, intent.yMin, intent.yMax),
    intent.caption ?? "Miền nghiệm trên mặt phẳng tọa độ Oxy",
  );
  addCoordinateAxes(builder, {
    ...intent,
    xStep: intent.tickStep,
    yStep: intent.tickStep,
  });

  let polygon = [
    { x: intent.xMin, y: intent.yMin },
    { x: intent.xMax, y: intent.yMin },
    { x: intent.xMax, y: intent.yMax },
    { x: intent.xMin, y: intent.yMax },
  ];
  for (const boundary of intent.boundaries) {
    if (Math.hypot(boundary.a, boundary.b) <= 1e-9) {
      throw new Error(`Inequality ${boundary.label} must have a non-zero normal vector.`);
    }
    polygon = clipPolygon(polygon, boundary);
  }
  if (polygon.length >= 3) {
    const regionPoints = polygon.map((value, index) =>
      builder.addPoint(point(safeDiagramId("regionPoint", index), value.x, value.y)),
    );
    builder.addPolygon("solutionRegion", regionPoints, "SOFT_BLUE");
  }

  for (const [index, boundary] of intent.boundaries.entries()) {
    const endpoints = lineRectangleIntersections(
      boundary,
      intent.xMin,
      intent.xMax,
      intent.yMin,
      intent.yMax,
    );
    if (endpoints.length < 2) continue;
    const first = builder.addPoint(
      point(safeDiagramId("boundaryStart", index), endpoints[0]!.x, endpoints[0]!.y),
    );
    const second = builder.addPoint(
      point(safeDiagramId("boundaryEnd", index), endpoints[1]!.x, endpoints[1]!.y),
    );
    const isInclusiveAxisBoundary =
      (boundary.operator === "LE" || boundary.operator === "GE") &&
      Math.abs(boundary.c) <= 1e-9 &&
      (Math.abs(boundary.a) <= 1e-9 || Math.abs(boundary.b) <= 1e-9);
    if (!isInclusiveAxisBoundary) {
      builder.addLine(
        safeDiagramId("boundary", index),
        first,
        second,
        boundary.operator === "LT" || boundary.operator === "GT" ? "DASHED" : "SOLID",
      );
    }
    const labelPlacement = resolveBoundaryLabelPlacement(
      boundary,
      endpoints[0]!,
      endpoints[1]!,
      intent,
    );
    const labelAnchor = builder.addPoint(
      point(
        safeDiagramId("boundaryLabelAnchor", index),
        labelPlacement.x,
        labelPlacement.y,
      ),
    );
    builder.addLabel({
      text: boundary.label,
      anchorPointId: labelAnchor,
      anchorPrimitiveId: null,
      position: labelPlacement.position,
    });
  }
  return builder.build();
}

function resolveBoundaryLabelPlacement(
  boundary: Boundary,
  first: { x: number; y: number },
  second: { x: number; y: number },
  domain: { xMin: number; xMax: number; yMin: number; yMax: number },
) {
  if (Math.abs(boundary.b) <= 1e-9) {
    return {
      x: first.x,
      y: domain.yMin + (domain.yMax - domain.yMin) * 0.68,
      position: "RIGHT" as const,
    };
  }
  if (Math.abs(boundary.a) <= 1e-9) {
    return {
      x: domain.xMin + (domain.xMax - domain.xMin) * 0.68,
      y: first.y,
      position: "TOP" as const,
    };
  }
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    position: boundary.b > 0 ? ("TOP_RIGHT" as const) : ("BOTTOM_RIGHT" as const),
  };
}

function addNumberLineTicks(
  builder: DiagramBuilder,
  min: number,
  max: number,
  requestedStep: number,
  speciallyLabeledValues: number[] = [],
  displayOffset = 0,
) {
  const count = Math.floor((max - min) / requestedStep) + 1;
  const multiplier = Math.max(1, Math.ceil(count / 21));
  const step = requestedStep * multiplier;
  const first = Math.ceil(min / step) * step;
  const tickHalfLength = 2.6 * 0.012;
  let index = 0;
  for (let value = first; value <= max + step * 1e-8; value += step) {
    const normalized = Number(value.toFixed(8));
    const bottom = builder.addPoint(
      point(safeDiagramId("numberTickBottom", index), normalized, -tickHalfLength),
    );
    const top = builder.addPoint(
      point(safeDiagramId("numberTickTop", index), normalized, tickHalfLength),
    );
    builder.addSegment(safeDiagramId("numberTick", index), bottom, top);
    const isSpecialValue = speciallyLabeledValues.some(
      (specialValue) => Math.abs(specialValue - normalized) <= requestedStep * 1e-6,
    );
    const isCrowdedBySpecialValue =
      Math.abs(normalized) > 1e-9 &&
      speciallyLabeledValues.some(
        (specialValue) =>
          !Number.isInteger(specialValue) &&
          Math.abs(specialValue - normalized) <= requestedStep * 1.25,
      );
    const shouldShowTickValue =
      !isSpecialValue &&
      !isCrowdedBySpecialValue &&
      (Number.isInteger(normalized) ||
        Math.abs(normalized - min) <= 1e-9 ||
        Math.abs(normalized - max) <= 1e-9);
    if (shouldShowTickValue) {
      builder.addLabel({
        text: formatNumberLineValue(normalized + displayOffset, requestedStep),
        anchorPointId: bottom,
        anchorPrimitiveId: null,
        position: "BOTTOM",
      });
    }
    index += 1;
  }
}

function formatNumberLineValue(value: number, step: number) {
  if (Number.isInteger(value)) return formatIntegerWithSpaces(value);
  for (let denominator = 2; denominator <= 12; denominator += 1) {
    const numerator = Math.round(value * denominator);
    if (
      Math.abs(value * denominator - numerator) <= 1e-8 &&
      Math.abs(step * denominator - Math.round(step * denominator)) <= 1e-8
    ) {
      const divisor = greatestCommonDivisor(Math.abs(numerator), denominator);
      return `${numerator / divisor}/${denominator / divisor}`;
    }
  }
  return formatDiagramNumber(value);
}

function formatIntegerWithSpaces(value: number) {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(value));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/gu, " ")}`;
}

function greatestCommonDivisor(left: number, right: number) {
  let a = left;
  let b = right;
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function paddedViewBox(xMin: number, xMax: number, yMin: number, yMax: number) {
  assertAscending(xMin, xMax, "x domain");
  assertAscending(yMin, yMax, "y domain");
  const xPadding = Math.max((xMax - xMin) * 0.08, 0.5);
  const yPadding = Math.max((yMax - yMin) * 0.08, 0.5);
  return {
    minX: xMin - xPadding,
    minY: yMin - yPadding,
    width: xMax - xMin + xPadding * 2,
    height: yMax - yMin + yPadding * 2,
  };
}

function point(id: string, x: number, y: number) {
  return {
    id,
    x,
    y,
    label: null,
    pointStyle: "NONE" as const,
    labelPosition: "TOP" as const,
  };
}

function resolvePointLabelPosition(
  x: number,
  y: number,
  originX: number,
  originY: number,
) {
  if (x >= originX && y >= originY) return "TOP_RIGHT" as const;
  if (x < originX && y >= originY) return "TOP_LEFT" as const;
  if (x < originX) return "BOTTOM_LEFT" as const;
  return "BOTTOM_RIGHT" as const;
}

function assertAscending(min: number, max: number, label: string) {
  if (min < max) return;
  throw new Error(`${label} minimum must be smaller than maximum.`);
}

function assertWithin(value: number, min: number, max: number, label: string) {
  if (value >= min && value <= max) return;
  throw new Error(`${label}=${value} is outside [${min}, ${max}].`);
}

type Boundary = Extract<
  CoordinateIntent,
  { archetype: "INEQUALITY_REGION" }
>["boundaries"][number];

function isInside(pointValue: { x: number; y: number }, boundary: Boundary) {
  const expression = boundary.a * pointValue.x + boundary.b * pointValue.y;
  return boundary.operator === "LE" || boundary.operator === "LT"
    ? expression <= boundary.c + 1e-9
    : expression >= boundary.c - 1e-9;
}

function clipPolygon(points: Array<{ x: number; y: number }>, boundary: Boundary) {
  if (points.length === 0) return points;
  const output: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const previous = points[(index + points.length - 1) % points.length]!;
    const currentInside = isInside(current, boundary);
    const previousInside = isInside(previous, boundary);
    if (currentInside !== previousInside) {
      output.push(segmentBoundaryIntersection(previous, current, boundary));
    }
    if (currentInside) output.push(current);
  }
  return output;
}

function segmentBoundaryIntersection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  boundary: Boundary,
) {
  const denominator = boundary.a * (to.x - from.x) + boundary.b * (to.y - from.y);
  if (Math.abs(denominator) <= 1e-12) return from;
  const ratio = (boundary.c - boundary.a * from.x - boundary.b * from.y) / denominator;
  return {
    x: from.x + ratio * (to.x - from.x),
    y: from.y + ratio * (to.y - from.y),
  };
}

function lineRectangleIntersections(
  boundary: Boundary,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
) {
  const candidates: Array<{ x: number; y: number }> = [];
  if (Math.abs(boundary.b) > 1e-12) {
    for (const x of [xMin, xMax]) {
      const y = (boundary.c - boundary.a * x) / boundary.b;
      if (y >= yMin - 1e-9 && y <= yMax + 1e-9) candidates.push({ x, y });
    }
  }
  if (Math.abs(boundary.a) > 1e-12) {
    for (const y of [yMin, yMax]) {
      const x = (boundary.c - boundary.b * y) / boundary.a;
      if (x >= xMin - 1e-9 && x <= xMax + 1e-9) candidates.push({ x, y });
    }
  }
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (value) =>
          Math.abs(value.x - candidate.x) <= 1e-8 &&
          Math.abs(value.y - candidate.y) <= 1e-8,
      ) === index,
  );
}
