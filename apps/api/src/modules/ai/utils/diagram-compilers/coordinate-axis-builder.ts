import { DiagramBuilder, formatDiagramNumber, safeDiagramId } from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

export type CoordinateAxisOptions = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xStep: number;
  yStep: number;
  showOriginLabel?: boolean;
  markOriginPoint?: boolean;
  maxTicksPerAxis?: number;
  xRenderScale?: number;
  yRenderScale?: number;
};

export function addCoordinateAxes(
  builder: DiagramBuilder,
  options: CoordinateAxisOptions,
) {
  assertDomain(options.xMin, options.xMax, "x");
  assertDomain(options.yMin, options.yMax, "y");
  const xRenderScale = options.xRenderScale ?? 1;
  const yRenderScale = options.yRenderScale ?? 1;
  const renderX = (value: number) => value * xRenderScale;
  const renderY = (value: number) => value * yRenderScale;
  const originX = renderX(clamp(0, options.xMin, options.xMax));
  const originY = renderY(clamp(0, options.yMin, options.yMax));
  const axisXLeft = builder.addPoint({
    id: "axisXLeft",
    x: renderX(options.xMin),
    y: originY,
    label: null,
    pointStyle: "NONE",
    labelPosition: "LEFT",
  });
  const axisXRight = builder.addPoint({
    id: "axisXRight",
    x: renderX(options.xMax),
    y: originY,
    label: null,
    pointStyle: "NONE",
    labelPosition: "RIGHT",
  });
  const axisYBottom = builder.addPoint({
    id: "axisYBottom",
    x: originX,
    y: renderY(options.yMin),
    label: null,
    pointStyle: "NONE",
    labelPosition: "BOTTOM",
  });
  const axisYTop = builder.addPoint({
    id: "axisYTop",
    x: originX,
    y: renderY(options.yMax),
    label: null,
    pointStyle: "NONE",
    labelPosition: "TOP",
  });
  builder.addLine("axisX", axisXLeft, axisXRight);
  builder.addLine("axisY", axisYBottom, axisYTop);
  builder.addLabel({
    text: "x",
    anchorPointId: axisXRight,
    anchorPrimitiveId: null,
    position: "TOP_RIGHT",
  });
  builder.addLabel({
    text: "y",
    anchorPointId: axisYTop,
    anchorPrimitiveId: null,
    position: "TOP_RIGHT",
  });

  const tickHalfLength =
    Math.min(
      (options.xMax - options.xMin) * xRenderScale,
      (options.yMax - options.yMin) * yRenderScale,
    ) * 0.018;
  const xValues = resolveTicks(
    options.xMin,
    options.xMax,
    options.xStep,
    options.maxTicksPerAxis ?? 15,
  );
  const yValues = resolveTicks(
    options.yMin,
    options.yMax,
    options.yStep,
    options.maxTicksPerAxis ?? 15,
  );

  for (const [index, value] of xValues.entries()) {
    if (Math.abs(value - originX) <= 1e-9) continue;
    const bottom = builder.addPoint({
      id: safeDiagramId("tickXBottom", index),
      x: renderX(value),
      y: originY - tickHalfLength,
      label: null,
      pointStyle: "NONE",
      labelPosition: "BOTTOM",
    });
    const top = builder.addPoint({
      id: safeDiagramId("tickXTop", index),
      x: renderX(value),
      y: originY + tickHalfLength,
      label: null,
      pointStyle: "NONE",
      labelPosition: "TOP",
    });
    builder.addSegment(safeDiagramId("tickX", index), bottom, top);
    builder.addLabel({
      text: formatDiagramNumber(value),
      anchorPointId: bottom,
      anchorPrimitiveId: null,
      position: "BOTTOM",
    });
  }

  for (const [index, value] of yValues.entries()) {
    if (Math.abs(value - originY) <= 1e-9) continue;
    const left = builder.addPoint({
      id: safeDiagramId("tickYLeft", index),
      x: originX - tickHalfLength,
      y: renderY(value),
      label: null,
      pointStyle: "NONE",
      labelPosition: "LEFT",
    });
    const right = builder.addPoint({
      id: safeDiagramId("tickYRight", index),
      x: originX + tickHalfLength,
      y: renderY(value),
      label: null,
      pointStyle: "NONE",
      labelPosition: "RIGHT",
    });
    builder.addSegment(safeDiagramId("tickY", index), left, right);
    builder.addLabel({
      text: formatDiagramNumber(value),
      anchorPointId: left,
      anchorPrimitiveId: null,
      position: "LEFT",
    });
  }

  let originPointId: string | null = null;
  if (
    options.showOriginLabel !== false &&
    options.xMin <= 0 &&
    options.xMax >= 0 &&
    options.yMin <= 0 &&
    options.yMax >= 0
  ) {
    originPointId = builder.addPoint({
      id: "origin",
      x: 0,
      y: 0,
      label: "O",
      pointStyle: options.markOriginPoint ? "FILLED" : "NONE",
      labelPosition: "BOTTOM_LEFT",
    });
  }

  return { originX, originY, originPointId, tickHalfLength };
}

function resolveTicks(min: number, max: number, requestedStep: number, limit: number) {
  const rawCount = Math.floor((max - min) / requestedStep) + 1;
  const multiplier = Math.max(1, Math.ceil(rawCount / limit));
  const step = requestedStep * multiplier;
  const first = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let value = first; value <= max + step * 1e-8; value += step) {
    values.push(Number(value.toFixed(8)));
  }
  return values;
}

function assertDomain(min: number, max: number, axis: string) {
  if (min < max) return;
  throw new Error(`${axis} domain min must be smaller than max.`);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
