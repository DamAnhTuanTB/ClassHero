import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import {
  DiagramBuilder,
  safeDiagramId,
} from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type ElementaryIntent = Extract<
  LessonSummaryDiagramIntent,
  { family: "ELEMENTARY_MODEL" }
>;

export function compileElementaryDiagram(
  intent: ElementaryIntent,
): LessonSummaryDiagramSpec {
  switch (intent.archetype) {
    case "MULTIPLICATION_ARRAY":
      return compileMultiplicationArray(intent);
    case "TAPE_COMPARISON":
      return compileTapeComparison(intent);
    case "FRACTION_MODEL":
      return compileFractionModel(intent);
    case "RECTILINEAR_COMPOSITE":
      return compileRectilinearComposite(intent);
    case "MEASUREMENT_SCALE":
      return compileMeasurementScale(intent);
  }
}

function compileMeasurementScale(
  intent: Extract<ElementaryIntent, { archetype: "MEASUREMENT_SCALE" }>,
) {
  return intent.variant === "RULER" ? compileRuler(intent) : compileThermometer(intent);
}

function compileRuler(
  intent: Extract<ElementaryIntent, { archetype: "MEASUREMENT_SCALE" }>,
) {
  const tickValues = measurementTickValues(intent.min, intent.max, intent.step);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1.4, width: 12, height: 4.2 },
    intent.caption,
  );
  const start = builder.addPoint(hiddenPoint("rulerStart", 0, 0));
  const end = builder.addPoint(hiddenPoint("rulerEnd", 10, 0));
  const topStart = builder.addPoint(hiddenPoint("rulerTopStart", 0, 1.35));
  const topEnd = builder.addPoint(hiddenPoint("rulerTopEnd", 10, 1.35));
  builder.addPolygon("rulerBody", [start, end, topEnd, topStart], "SOFT_BLUE");
  for (const [index, value] of tickValues.entries()) {
    const x = scaleMeasurementValue(value, intent.min, intent.max, 10);
    const lower = builder.addPoint(hiddenPoint(`rulerTick${index}Lower`, x, 0));
    const upper = builder.addPoint(hiddenPoint(`rulerTick${index}Upper`, x, 0.62));
    builder.addSegment(`rulerTick${index}`, lower, upper);
    builder.addLabel({
      text: formatMeasurementValue(value),
      anchorPointId: lower,
      anchorPrimitiveId: null,
      position: "BOTTOM",
    });
  }
  const valueX = scaleMeasurementValue(intent.value, intent.min, intent.max, 10);
  const valuePoint = builder.addPoint({
    id: "rulerValue",
    x: valueX,
    y: 1.35,
    label: null,
    pointStyle: "FILLED",
    labelPosition: "TOP",
  });
  builder.addLabel({
    text: formatMeasurementValue(intent.value),
    anchorPointId: valuePoint,
    anchorPrimitiveId: null,
    position: "TOP",
  });
  builder.addLabel({
    text: intent.unit,
    anchorPointId: end,
    anchorPrimitiveId: null,
    position: "BOTTOM_RIGHT",
  });
  return builder.build();
}

function compileThermometer(
  intent: Extract<ElementaryIntent, { archetype: "MEASUREMENT_SCALE" }>,
) {
  const tickValues = measurementTickValues(intent.min, intent.max, intent.step);
  const builder = new DiagramBuilder(
    { minX: -2.8, minY: -1.6, width: 6.8, height: 10.2 },
    intent.caption,
  );
  const tubeBottomLeft = builder.addPoint(
    hiddenPoint("thermometerTubeBottomLeft", -0.14, 0),
  );
  const tubeBottomRight = builder.addPoint(
    hiddenPoint("thermometerTubeBottomRight", 0.14, 0),
  );
  const tubeTopLeft = builder.addPoint(hiddenPoint("thermometerTubeTopLeft", -0.14, 7));
  const tubeTopRight = builder.addPoint(hiddenPoint("thermometerTubeTopRight", 0.14, 7));
  const top = builder.addPoint(hiddenPoint("thermometerTop", 0, 7));
  const bulbCenter = builder.addPoint(hiddenPoint("thermometerBulbCenter", 0, -0.45));
  builder.addSegment("thermometerTubeLeft", tubeBottomLeft, tubeTopLeft);
  builder.addSegment("thermometerTubeRight", tubeBottomRight, tubeTopRight);
  builder.addSegment("thermometerTubeTop", tubeTopLeft, tubeTopRight);
  builder.addCircle("thermometerBulb", bulbCenter, 0.42);
  for (const [index, value] of tickValues.entries()) {
    const y = scaleMeasurementValue(value, intent.min, intent.max, 7);
    const tickStart = builder.addPoint(hiddenPoint(`thermometerTick${index}A`, 0.2, y));
    const tickEnd = builder.addPoint(hiddenPoint(`thermometerTick${index}B`, 0.5, y));
    builder.addSegment(`thermometerTick${index}`, tickStart, tickEnd);
    builder.addLabel({
      text: formatMeasurementValue(value),
      anchorPointId: tickEnd,
      anchorPrimitiveId: null,
      position: "RIGHT",
    });
  }
  const valueY = scaleMeasurementValue(intent.value, intent.min, intent.max, 7);
  const valuePoint = builder.addPoint({
    id: "thermometerValue",
    x: 0,
    y: valueY,
    label: null,
    pointStyle: "NONE",
    labelPosition: "LEFT",
  });
  builder.addSegment("thermometerReading", bulbCenter, valuePoint);
  const valueAlreadyLabelsATick = tickValues.some(
    (tickValue) => Math.abs(tickValue - intent.value) <= 1e-9,
  );
  if (!valueAlreadyLabelsATick) {
    builder.addLabel({
      text: formatMeasurementValue(intent.value),
      anchorPointId: valuePoint,
      anchorPrimitiveId: null,
      position: "LEFT",
    });
  }
  builder.addLabel({
    text: intent.unit,
    anchorPointId: top,
    anchorPrimitiveId: null,
    position: "TOP_RIGHT",
  });
  return builder.build();
}

function measurementTickValues(min: number, max: number, step: number) {
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  if (count < 2 || count > 16) {
    throw new Error("A measurement scale supports between 2 and 16 major ticks.");
  }
  return Array.from({ length: count }, (_, index) => min + index * step);
}

function scaleMeasurementValue(value: number, min: number, max: number, extent: number) {
  return ((value - min) / (max - min)) * extent;
}

function formatMeasurementValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function compileMultiplicationArray(
  intent: Extract<ElementaryIntent, { archetype: "MULTIPLICATION_ARRAY" }>,
) {
  const width = Math.max(intent.columns - 1, 1);
  const height = Math.max(intent.rows - 1, 1);
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -0.8, width: width + 2.4, height: height + 1.6 },
    intent.caption,
  );
  const corners = [
    builder.addPoint(hiddenPoint("arrayCornerA", -0.35, -0.35)),
    builder.addPoint(hiddenPoint("arrayCornerB", width + 0.35, -0.35)),
    builder.addPoint(hiddenPoint("arrayCornerC", width + 0.35, height + 0.35)),
    builder.addPoint(hiddenPoint("arrayCornerD", -0.35, height + 0.35)),
  ];
  builder.addPolygon("arrayFrame", corners, "NONE", "DOTTED");
  for (let row = 0; row < intent.rows; row += 1) {
    for (let column = 0; column < intent.columns; column += 1) {
      builder.addPoint({
        id: `itemR${row}C${column}`,
        x: column,
        y: height - row,
        label: null,
        pointStyle: "FILLED",
        labelPosition: "TOP",
      });
    }
  }
  builder.addLabel({
    text: intent.rowLabel ?? `${intent.rows} hàng`,
    anchorPointId: corners[0]!,
    anchorPrimitiveId: null,
    position: "LEFT",
  });
  builder.addLabel({
    text: intent.columnLabel ?? `${intent.columns} cột`,
    anchorPointId: corners[1]!,
    anchorPrimitiveId: null,
    position: "BOTTOM",
  });
  return builder.build();
}

function compileTapeComparison(
  intent: Extract<ElementaryIntent, { archetype: "TAPE_COMPARISON" }>,
) {
  for (const bar of intent.bars) {
    if (bar.partLabels.length !== 0 && bar.partLabels.length !== bar.parts.length) {
      throw new Error(`${bar.label} must provide zero or one label for every part.`);
    }
  }
  const maximumTotal = Math.max(
    ...intent.bars.map((bar) => bar.parts.reduce((sum, value) => sum + value, 0)),
  );
  const builder = new DiagramBuilder(
    {
      minX: -2,
      minY: -1,
      width: maximumTotal + 4,
      height: intent.bars.length * 1.6 + 1.8,
    },
    intent.caption,
  );
  for (const [barIndex, bar] of intent.bars.entries()) {
    const y = (intent.bars.length - barIndex - 1) * 1.6;
    const barAnchor = builder.addPoint(
      hiddenPoint(safeDiagramId("barAnchor", barIndex), 0, y + 1.35),
    );
    builder.addLabel({
      text: bar.label,
      anchorPointId: barAnchor,
      anchorPrimitiveId: null,
      position: "TOP_RIGHT",
    });
    let x = 0;
    for (const [partIndex, value] of bar.parts.entries()) {
      const pointIds = [
        builder.addPoint(hiddenPoint(`bar${barIndex}Part${partIndex}A`, x, y)),
        builder.addPoint(hiddenPoint(`bar${barIndex}Part${partIndex}B`, x + value, y)),
        builder.addPoint(
          hiddenPoint(`bar${barIndex}Part${partIndex}C`, x + value, y + 1),
        ),
        builder.addPoint(hiddenPoint(`bar${barIndex}Part${partIndex}D`, x, y + 1)),
      ];
      builder.addPolygon(
        `bar${barIndex}Part${partIndex}`,
        pointIds,
        partIndex % 2 === 0 ? "SOFT_BLUE" : "SOFT_GREEN",
      );
      const center = builder.addPoint(
        hiddenPoint(`bar${barIndex}Part${partIndex}Center`, x + value / 2, y + 0.5),
      );
      builder.addLabel({
        text:
          bar.partLabels[partIndex] ?? `${value}${intent.unit ? ` ${intent.unit}` : ""}`,
        anchorPointId: center,
        anchorPrimitiveId: null,
        position: "CENTER",
      });
      x += value;
    }
  }
  return builder.build();
}

function compileFractionModel(
  intent: Extract<ElementaryIntent, { archetype: "FRACTION_MODEL" }>,
) {
  return intent.shape === "BAR"
    ? compileFractionBar(intent)
    : compileFractionCircle(intent);
}

function compileFractionBar(
  intent: Extract<ElementaryIntent, { archetype: "FRACTION_MODEL" }>,
) {
  const builder = new DiagramBuilder(
    { minX: -0.8, minY: -1.2, width: intent.denominator + 1.6, height: 3.2 },
    intent.caption,
  );
  for (let index = 0; index < intent.denominator; index += 1) {
    const points = [
      builder.addPoint(hiddenPoint(`fraction${index}A`, index, 0)),
      builder.addPoint(hiddenPoint(`fraction${index}B`, index + 1, 0)),
      builder.addPoint(hiddenPoint(`fraction${index}C`, index + 1, 1)),
      builder.addPoint(hiddenPoint(`fraction${index}D`, index, 1)),
    ];
    builder.addPolygon(
      safeDiagramId("fractionPart", index),
      points,
      index < intent.numerator ? "SOFT_BLUE" : "NONE",
    );
  }
  const anchor = builder.addPoint(
    hiddenPoint("fractionLabelAnchor", intent.denominator / 2, 1),
  );
  builder.addLabel({
    text: intent.fractionLabel ?? `${intent.numerator}/${intent.denominator}`,
    anchorPointId: anchor,
    anchorPrimitiveId: null,
    position: "TOP",
  });
  return builder.build();
}

function compileFractionCircle(
  intent: Extract<ElementaryIntent, { archetype: "FRACTION_MODEL" }>,
) {
  const builder = new DiagramBuilder(
    { minX: -1.8, minY: -1.8, width: 3.6, height: 4.1 },
    intent.caption,
  );
  const center = builder.addPoint(hiddenPoint("fractionCenter", 0, 0));
  builder.addCircle("fractionCircle", center, 1);
  const step = 360 / intent.denominator;
  for (let index = 0; index < intent.denominator; index += 1) {
    const angle = (index * step * Math.PI) / 180;
    const edge = builder.addPoint(
      hiddenPoint(safeDiagramId("fractionEdge", index), Math.cos(angle), Math.sin(angle)),
    );
    builder.addSegment(safeDiagramId("fractionRadius", index), center, edge);
    if (index >= intent.numerator) continue;
    const wedgePoints = [center];
    for (let sample = 0; sample <= 4; sample += 1) {
      const sampleAngle = ((index + sample / 4) * step * Math.PI) / 180;
      wedgePoints.push(
        builder.addPoint(
          hiddenPoint(
            `fractionWedge${index}Point${sample}`,
            Math.cos(sampleAngle),
            Math.sin(sampleAngle),
          ),
        ),
      );
    }
    builder.addPolygon(safeDiagramId("fractionWedge", index), wedgePoints, "SOFT_BLUE");
  }
  const fractionLabelAnchor = builder.addPoint(
    hiddenPoint("fractionCircleLabelAnchor", 0, -1.2),
  );
  builder.addLabel({
    text: intent.fractionLabel ?? `${intent.numerator}/${intent.denominator}`,
    anchorPointId: fractionLabelAnchor,
    anchorPrimitiveId: null,
    position: "BOTTOM",
  });
  return builder.build();
}

function compileRectilinearComposite(
  intent: Extract<ElementaryIntent, { archetype: "RECTILINEAR_COMPOSITE" }>,
) {
  const w = intent.outerWidth;
  const h = intent.outerHeight;
  const cutW = intent.cutoutWidth;
  const cutH = intent.cutoutHeight;
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -1.2, width: w + 2.4, height: h + 2.4 },
    intent.caption,
  );
  const coordinates = [
    [0, 0],
    [w, 0],
    [w, h - cutH],
    [w - cutW, h - cutH],
    [w - cutW, h],
    [0, h],
  ] as const;
  const pointIds = coordinates.map(([x, y], index) =>
    builder.addPoint(hiddenPoint(safeDiagramId("rectilinearPoint", index), x, y)),
  );
  builder.addPolygon("rectilinearShape", pointIds, "SOFT_BLUE");
  const edgeIds = pointIds.map((from, index) =>
    builder.addSegment(
      safeDiagramId("rectilinearEdge", index),
      from,
      pointIds[(index + 1) % pointIds.length]!,
    ),
  );
  addDimension(builder, `${w} ${intent.unit}`, pointIds[0]!, edgeIds[0]!, "BOTTOM");
  addDimension(builder, `${h} ${intent.unit}`, pointIds[5]!, edgeIds[5]!, "LEFT");
  addDimension(builder, `${cutW} ${intent.unit}`, pointIds[3]!, edgeIds[3]!, "TOP");
  addDimension(builder, `${cutH} ${intent.unit}`, pointIds[2]!, edgeIds[2]!, "RIGHT");
  return builder.build();
}

function addDimension(
  builder: DiagramBuilder,
  text: string,
  anchorPointId: string,
  anchorPrimitiveId: string,
  position: "TOP" | "RIGHT" | "BOTTOM" | "LEFT",
) {
  builder.addLabel({ text, anchorPointId, anchorPrimitiveId, position });
}

function hiddenPoint(id: string, x: number, y: number) {
  return {
    id,
    x,
    y,
    label: null,
    pointStyle: "NONE" as const,
    labelPosition: "TOP" as const,
  };
}
