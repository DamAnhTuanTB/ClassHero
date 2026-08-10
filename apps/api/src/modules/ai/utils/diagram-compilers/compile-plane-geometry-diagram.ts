import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { DiagramBuilder } from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type PlaneIntent = Extract<LessonSummaryDiagramIntent, { family: "PLANE_GEOMETRY" }>;

export function compilePlaneGeometryDiagram(
  intent: PlaneIntent,
): LessonSummaryDiagramSpec {
  switch (intent.archetype) {
    case "ANGLE_RAYS":
      return compileAngle(intent);
    case "TRIANGLE":
      return compileTriangle(intent);
    case "QUADRILATERAL":
      return compileQuadrilateral(intent);
    case "PARALLEL_TRANSVERSAL":
      return compileParallelTransversal(intent);
    case "CIRCLE_PARTS":
      return compileCircleParts(intent);
    case "SYMMETRY":
      return intent.variant === "CENTRAL"
        ? compileCentralSymmetry(intent)
        : compileAxialSymmetry(intent);
    case "RIGHT_TRIANGLE_CONGRUENCE":
      return compileRightTriangleCongruence(intent);
    case "BASIC_CONSTRUCTION":
      return compileBasicConstruction(intent);
    case "REGULAR_POLYGON":
      return compileRegularPolygon(intent);
  }
}

function compileBasicConstruction(intent: PlaneIntent) {
  if (intent.variant === "MIDPOINT") return compileMidpoint(intent);
  if (intent.variant === "PERPENDICULAR") return compilePerpendicularLines(intent);
  if (intent.pointLabels.length === 3) return compileSingleLinearConstruction(intent);
  const labels = requireLabels(intent, 6);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 9, height: 7.2 },
    intent.caption,
  );
  const rows = [4.8, 2.5, 0.2] as const;
  for (const [index, y] of rows.entries()) {
    const left = builder.addPoint({
      ...vertexPoint(`linearObject${index}A`, 0, y, labels[index * 2]!, "BOTTOM_LEFT"),
      pointStyle: "FILLED",
    });
    const right = builder.addPoint({
      ...vertexPoint(
        `linearObject${index}B`,
        6,
        y,
        labels[index * 2 + 1]!,
        "BOTTOM_RIGHT",
      ),
      pointStyle: "FILLED",
    });
    if (index === 0) builder.addLine("basicLine", left, right);
    else if (index === 1) builder.addRay("basicRay", left, right);
    else builder.addSegment("basicSegment", left, right);
  }
  return builder.build();
}

function compileSingleLinearConstruction(intent: PlaneIntent) {
  const labels = requireLabels(intent, 3);
  const firstLabel = labels[0]!;
  const middleLabel = labels[1]!;
  const lastLabel = labels[2]!;
  const caption = intent.caption ?? "";
  const isNamedRay = /thuộc\s+tia|tia\s+[A-Z][a-z](?:\s|\b)/u.test(caption);
  const isOppositeRayPair =
    /hai\s+tia\s+đối|là\s+hai\s+tia\s+đối|OX\s+và\s+OY/iu.test(caption);
  const isDirectionNamedLine =
    middleLabel === "O" &&
    firstLabel.toLocaleUpperCase("vi") === "X" &&
    lastLabel.toLocaleUpperCase("vi") === "Y" &&
    /đường\s+thẳng/iu.test(caption);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1.35, width: 10, height: 3.4 },
    intent.caption,
  );

  const first = builder.addPoint(
    isDirectionNamedLine
      ? hiddenPoint("linearFirst", 0, 0)
      : {
          ...vertexPoint("linearFirst", 0, 0, firstLabel, "TOP"),
          pointStyle: "FILLED",
        },
  );
  const middle = builder.addPoint({
    ...vertexPoint("linearMiddle", 3.6, 0, middleLabel, "TOP"),
    pointStyle: "FILLED",
  });
  const lastIsDirectionName = isDirectionNamedLine || isNamedRay;
  const last = builder.addPoint(
    lastIsDirectionName
      ? hiddenPoint("linearLast", 7.2, 0)
      : {
          ...vertexPoint("linearLast", 7.2, 0, lastLabel, "TOP"),
          pointStyle: "FILLED",
        },
  );

  if (isDirectionNamedLine) {
    builder.addLabel({
      text: firstLabel.toLocaleLowerCase("vi"),
      anchorPointId: first,
      anchorPrimitiveId: null,
      position: "TOP",
    });
  }
  if (lastIsDirectionName) {
    builder.addLabel({
      text: lastLabel.toLocaleLowerCase("vi"),
      anchorPointId: last,
      anchorPrimitiveId: null,
      position: isNamedRay ? "BOTTOM_RIGHT" : "TOP",
    });
  }

  if (isNamedRay) builder.addRay("basicRay", first, last);
  else if (isOppositeRayPair) {
    builder.addRay("oppositeRayFirst", middle, first);
    builder.addRay("oppositeRaySecond", middle, last);
  } else builder.addLine("basicLine", first, last);

  return builder.build();
}

function compileMidpoint(intent: PlaneIntent) {
  const labels = requireLabels(intent, 3);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1.6, width: 10, height: 3.6 },
    intent.caption,
  );
  const a = builder.addPoint(vertexPoint("midpointA", 0, 0, labels[0]!, "BOTTOM_LEFT"));
  const m = builder.addPoint({
    id: "midpointM",
    x: 4,
    y: 0,
    label: labels[1]!,
    pointStyle: "FILLED",
    labelPosition: "TOP",
  });
  const b = builder.addPoint(vertexPoint("midpointB", 8, 0, labels[2]!, "BOTTOM_RIGHT"));
  builder.addSegment("midpointAM", a, m);
  builder.addSegment("midpointMB", m, b);
  builder.addEqualLengths(["midpointAM", "midpointMB"]);
  return builder.build();
}

function compilePerpendicularLines(intent: PlaneIntent) {
  if (intent.pointLabels.length === 2) {
    return compilePointToLineDistance(intent);
  }
  if (intent.pointLabels.length === 3) {
    const [centerLabel, footLabel, radiusPointLabel] = intent.pointLabels;
    const hasCenterRadiusSemantics = Boolean(
      /tâm|bán\s*kính|đường\s*tròn/iu.test(intent.caption ?? "") ||
        intent.measures.some(
          (measure) =>
            normalizeSegmentName(measure.target) ===
            normalizeSegmentName(`${centerLabel}${radiusPointLabel}`),
        ),
    );
    if (hasCenterRadiusSemantics) {
      return compileCenterRadiusLineDistance(
        intent,
        centerLabel!,
        footLabel!,
        radiusPointLabel!,
      );
    }
    return compileRightTriangleConstruction(intent);
  }
  if (intent.pointLabels.length === 4) {
    return compileTriangleAltitude(intent);
  }
  const labels = requireLabels(intent, 5);
  const builder = new DiagramBuilder(
    { minX: -4.8, minY: -4.8, width: 9.6, height: 9.6 },
    intent.caption,
  );
  const a = builder.addPoint(
    vertexPoint("perpendicularA", -3.5, 0, labels[0]!, "TOP_LEFT"),
  );
  const b = builder.addPoint(
    vertexPoint("perpendicularB", 3.5, 0, labels[1]!, "TOP_RIGHT"),
  );
  const c = builder.addPoint(
    vertexPoint("perpendicularC", 0, -3.5, labels[2]!, "BOTTOM_RIGHT"),
  );
  const d = builder.addPoint(
    vertexPoint("perpendicularD", 0, 3.5, labels[3]!, "TOP_RIGHT"),
  );
  const o = builder.addPoint({
    id: "perpendicularO",
    x: 0,
    y: 0,
    label: labels[4]!,
    pointStyle: "FILLED",
    labelPosition: "BOTTOM_LEFT",
  });
  builder.addLine("perpendicularHorizontal", a, b);
  builder.addLine("perpendicularVertical", c, d);
  builder.addRightAngle(o, b, d);
  return builder.build();
}

function compilePointToLineDistance(intent: PlaneIntent) {
  const [pointLabel, footLabel] = requireLabels(intent, 2);
  const builder = new DiagramBuilder(
    { minX: -4.8, minY: -1.3, width: 9.6, height: 6.8 },
    intent.caption,
  );
  const point = builder.addPoint(
    vertexPoint("distancePoint", 0, 3.4, pointLabel!, "TOP_LEFT"),
  );
  const foot = builder.addPoint(
    vertexPoint("distanceFoot", 0, 0, footLabel!, "BOTTOM_RIGHT"),
  );
  const lineLeft = builder.addPoint(hiddenPoint("distanceLineLeft", -3.8, 0));
  const lineRight = builder.addPoint(hiddenPoint("distanceLineRight", 3.8, 0));
  builder.addLine("distanceLine", lineLeft, lineRight);
  builder.addSegment("distancePerpendicular", point, foot);
  builder.addRightAngle(foot, point, lineRight);
  builder.addLabel({
    text: "a",
    anchorPointId: lineRight,
    anchorPrimitiveId: null,
    position: "TOP_RIGHT",
  });
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [normalizeSegmentName(`${pointLabel}${footLabel}`), "distancePerpendicular"],
    ]),
    point,
  );
  return builder.build();
}

function compileCenterRadiusLineDistance(
  intent: PlaneIntent,
  centerLabel: string,
  footLabel: string,
  radiusPointLabel: string,
) {
  const builder = new DiagramBuilder(
    { minX: -4.8, minY: -1.3, width: 9.6, height: 7.6 },
    intent.caption,
  );
  const center = builder.addPoint(
    vertexPoint("distanceCircleCenter", 0, 3.7, centerLabel, "TOP_LEFT"),
  );
  const foot = builder.addPoint(
    vertexPoint("distanceCircleFoot", 0, 0, footLabel, "BOTTOM_RIGHT"),
  );
  const radiusPoint = builder.addPoint(
    vertexPoint("distanceCircleRadiusPoint", 2.25, 3.7, radiusPointLabel, "RIGHT"),
  );
  const lineLeft = builder.addPoint(hiddenPoint("distanceCircleLineLeft", -3.8, 0));
  const lineRight = builder.addPoint(hiddenPoint("distanceCircleLineRight", 3.8, 0));
  builder.addCircle("distanceCircle", center, 2.25);
  builder.addLine("distanceCircleLine", lineLeft, lineRight);
  builder.addSegment("distanceCirclePerpendicular", center, foot);
  builder.addSegment("distanceCircleRadius", center, radiusPoint);
  builder.addRightAngle(foot, center, lineRight);
  builder.addLabel({
    text: "a",
    anchorPointId: lineRight,
    anchorPrimitiveId: null,
    position: "TOP_RIGHT",
  });
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [normalizeSegmentName(`${centerLabel}${footLabel}`), "distanceCirclePerpendicular"],
      [normalizeSegmentName(`${centerLabel}${radiusPointLabel}`), "distanceCircleRadius"],
    ]),
    center,
  );
  return builder.build();
}

function compileRightTriangleConstruction(intent: PlaneIntent) {
  const [aLabel, bLabel, cLabel] = requireLabels(intent, 3);
  const baseMeasure = numericMeasureForSegment(intent, `${aLabel}${bLabel}`);
  const hypotenuseMeasure = numericMeasureForSegment(intent, `${bLabel}${cLabel}`);
  const base = 4;
  const vertical =
    baseMeasure && hypotenuseMeasure && hypotenuseMeasure > baseMeasure
      ? Math.max(
          2.4,
          Math.min(
            5.2,
            (Math.sqrt(
              hypotenuseMeasure * hypotenuseMeasure - baseMeasure * baseMeasure,
            ) /
              baseMeasure) *
              base,
          ),
        )
      : 3.2;
  const radius = Math.hypot(base, vertical);
  const constructionAngle = (Math.atan2(vertical, -base) * 180) / Math.PI;
  const builder = new DiagramBuilder(
    { minX: -1.4, minY: -1.2, width: 10.8, height: Math.max(7, vertical + 2.4) },
    intent.caption,
  );
  const a = builder.addPoint(
    vertexPoint("rightConstructionA", 0, 0, aLabel!, "BOTTOM_LEFT"),
  );
  const b = builder.addPoint(
    vertexPoint("rightConstructionB", base, 0, bLabel!, "BOTTOM_RIGHT"),
  );
  const c = builder.addPoint(
    vertexPoint("rightConstructionC", 0, vertical, cLabel!, "TOP_LEFT"),
  );
  builder.addSegment("rightConstructionAB", a, b);
  builder.addSegment("rightConstructionBC", b, c);
  builder.addSegment("rightConstructionCA", c, a);
  builder.addRightAngle(a, b, c);
  if (/dựng/iu.test(intent.caption ?? "")) {
    builder.addArc(
      "rightConstructionCompassArc",
      b,
      radius,
      constructionAngle - 24,
      constructionAngle + 24,
      "DOTTED",
    );
  }
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [normalizeSegmentName(`${aLabel}${bLabel}`), "rightConstructionAB"],
      [normalizeSegmentName(`${bLabel}${cLabel}`), "rightConstructionBC"],
      [normalizeSegmentName(`${cLabel}${aLabel}`), "rightConstructionCA"],
    ]),
    a,
  );
  return builder.build();
}

function numericMeasureForSegment(intent: PlaneIntent, segmentName: string) {
  const normalizedSegmentName = normalizeSegmentName(segmentName);
  const measure = intent.measures.find(
    (candidate) =>
      normalizeSegmentName(candidate.target.replaceAll(/[^\p{L}\p{N}′']/gu, "")) ===
      normalizedSegmentName,
  );
  if (!measure) return null;
  const numeric = Number(measure.text.replace(",", ".").match(/\d+(?:\.\d+)?/u)?.[0]);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function compileRegularPolygon(intent: PlaneIntent) {
  const labels = requireLabels(intent, 6);
  const builder = new DiagramBuilder(
    { minX: -4.4, minY: -4, width: 8.8, height: 8.4 },
    intent.caption,
  );
  const pointIds = Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 2 + (index * Math.PI) / 3;
    const x = Math.cos(angle) * 3;
    const y = Math.sin(angle) * 3;
    const horizontal = x > 0.2 ? "RIGHT" : x < -0.2 ? "LEFT" : null;
    const position = horizontal ?? (y > 0 ? "TOP" : "BOTTOM");
    return builder.addPoint(
      vertexPoint(`regularHexagon${index}`, x, y, labels[index]!, position),
    );
  });
  const segmentIds = pointIds.map((pointId, index) =>
    builder.addSegment(
      `regularHexagonSide${index}`,
      pointId,
      pointIds[(index + 1) % pointIds.length]!,
    ),
  );
  builder.addEqualLengths(segmentIds);
  return builder.build();
}

function compileAxialSymmetry(intent: PlaneIntent) {
  const labels = requireLabels(intent, 6);
  const builder = new DiagramBuilder(
    { minX: -5, minY: -1.2, width: 10, height: 6.5 },
    intent.caption,
  );
  const coordinates = [
    [-4, 1, "LEFT"],
    [-2.5, 0, "BOTTOM"],
    [-2.5, 3.4, "TOP"],
    [4, 1, "RIGHT"],
    [2.5, 0, "BOTTOM"],
    [2.5, 3.4, "TOP"],
  ] as const;
  const points = coordinates.map(([x, y, position], index) =>
    builder.addPoint(vertexPoint(`axialPoint${index}`, x, y, labels[index]!, position)),
  );
  builder.addPolygon("axialOriginal", points.slice(0, 3));
  builder.addPolygon("axialImage", points.slice(3, 6));
  const axisMidpoint = builder.addPoint(hiddenPoint("axialAxisMidpoint", 0, 1));
  builder.addSegment("axialProjectionAFirst", points[0]!, axisMidpoint, "DOTTED");
  builder.addSegment("axialProjectionASecond", axisMidpoint, points[3]!, "DOTTED");
  builder.addSegment("axialProjectionB", points[1]!, points[4]!, "DOTTED");
  builder.addSegment("axialProjectionC", points[2]!, points[5]!, "DOTTED");
  const axisBottom = builder.addPoint(hiddenPoint("axialAxisBottom", 0, -0.65));
  const axisTop = builder.addPoint(hiddenPoint("axialAxisTop", 0, 4.45));
  builder.addSegment("axialAxis", axisBottom, axisTop, "DASHED");
  builder.addEqualLengths(["axialProjectionAFirst", "axialProjectionASecond"]);
  builder.addRightAngle(axisMidpoint, points[0]!, axisTop);
  builder.addLabel({
    text: "d",
    anchorPointId: axisTop,
    anchorPrimitiveId: "axialAxis",
    position: "TOP_RIGHT",
  });
  return builder.build();
}

function compileCentralSymmetry(intent: PlaneIntent) {
  const labels = requireLabels(intent, 7);
  const builder = new DiagramBuilder(
    { minX: -5, minY: -3.5, width: 10, height: 7.5 },
    intent.caption,
  );
  const coordinates = [
    [-4, 1, "TOP_LEFT"],
    [-2.6, -1.7, "BOTTOM_LEFT"],
    [-1.7, 2.6, "TOP"],
    [4, -1, "BOTTOM_RIGHT"],
    [2.6, 1.7, "TOP_RIGHT"],
    [1.7, -2.6, "BOTTOM"],
  ] as const;
  const points = coordinates.map(([x, y, position], index) =>
    builder.addPoint(vertexPoint(`centralPoint${index}`, x, y, labels[index]!, position)),
  );
  const centerId = builder.addPoint({
    id: "centralO",
    x: 0,
    y: 0,
    label: labels[6]!,
    pointStyle: "FILLED",
    labelPosition: "TOP_RIGHT",
  });
  builder.addPolygon("centralOriginal", points.slice(0, 3));
  builder.addPolygon("centralImage", points.slice(3, 6));
  builder.addSegment("centralProjectionAFirst", points[0]!, centerId, "DOTTED");
  builder.addSegment("centralProjectionASecond", centerId, points[3]!, "DOTTED");
  builder.addSegment("centralProjectionB", points[1]!, points[4]!, "DOTTED");
  builder.addSegment("centralProjectionC", points[2]!, points[5]!, "DOTTED");
  builder.addEqualLengths(["centralProjectionAFirst", "centralProjectionASecond"]);
  return builder.build();
}

function compileAngle(intent: PlaneIntent) {
  const [vertexLabel, firstLabel, secondLabel] = requireLabels(intent, 3);
  const angleDegrees =
    intent.variant === "ACUTE"
      ? 45
      : intent.variant === "RIGHT"
        ? 90
        : intent.variant === "OBTUSE"
          ? 130
          : intent.variant === "STRAIGHT"
            ? 180
            : 60;
  const builder = new DiagramBuilder(
    angleDegrees === 180
      ? { minX: -5, minY: -1.5, width: 10, height: 3.5 }
      : { minX: -1, minY: -1.5, width: 6.5, height: 6 },
    intent.caption,
  );
  const vertex = builder.addPoint(
    vertexPoint("angleVertex", 0, 0, vertexLabel!, "BOTTOM_LEFT"),
  );
  const first = builder.addPoint(
    vertexPoint("angleArmA", 4, 0, firstLabel!, "BOTTOM_RIGHT"),
  );
  const radians = (angleDegrees * Math.PI) / 180;
  const second = builder.addPoint(
    vertexPoint(
      "angleArmB",
      4 * Math.cos(radians),
      4 * Math.sin(radians),
      secondLabel!,
      "TOP_LEFT",
    ),
  );
  builder.addRay("angleRayA", vertex, first);
  builder.addRay("angleRayB", vertex, second);
  if (angleDegrees === 90) builder.addRightAngle(vertex, first, second);
  else builder.addAngle(vertex, first, second, findMeasure(intent, "ANGLE"));
  return builder.build();
}

function compileTriangle(intent: PlaneIntent) {
  if (intent.pointLabels.length >= 4 && hasTriangleAltitude(intent)) {
    return compileTriangleAltitude(intent);
  }
  const [aLabel, bLabel, cLabel] = requireLabels(intent, 3);
  const includeDerivedPropertyMarkers = intent.grade >= 6;
  const coordinates =
    intent.variant === "RIGHT"
      ? ([
          [0, 4],
          [0, 0],
          [5, 0],
        ] as const)
      : intent.variant === "OBTUSE"
        ? ([
            [0, 0],
            [5, 0],
            [6, 2.4],
          ] as const)
        : intent.variant === "EQUILATERAL"
          ? ([
              [0, 0],
              [4, 0],
              [2, 2 * Math.sqrt(3)],
            ] as const)
          : intent.variant === "ISOSCELES"
            ? ([
                [0, 0],
                [4, 0],
                [2, 3.5],
              ] as const)
            : ([
                [0, 0],
                [5, 0],
                [1.8, 3.4],
              ] as const);
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -1.2, width: 7.4, height: 6.2 },
    intent.caption,
  );
  const a = builder.addPoint(
    vertexPoint("A", coordinates[0][0], coordinates[0][1], aLabel!, "TOP_LEFT"),
  );
  const b = builder.addPoint(
    vertexPoint("B", coordinates[1][0], coordinates[1][1], bLabel!, "BOTTOM_LEFT"),
  );
  const c = builder.addPoint(
    vertexPoint("C", coordinates[2][0], coordinates[2][1], cLabel!, "BOTTOM_RIGHT"),
  );
  const edges = new Map([
    [normalizeSegmentName(`${aLabel}${bLabel}`), builder.addSegment("sideAB", a, b)],
    [normalizeSegmentName(`${bLabel}${cLabel}`), builder.addSegment("sideBC", b, c)],
    [normalizeSegmentName(`${cLabel}${aLabel}`), builder.addSegment("sideCA", c, a)],
  ]);
  if (intent.variant === "RIGHT" && includeDerivedPropertyMarkers) {
    builder.addRightAngle(b, a, c);
    const acuteAngleMeasure = intent.measures.find((measure) =>
      /góc\s*nhọn/iu.test(measure.text),
    );
    if (acuteAngleMeasure || /góc\s*nhọn/iu.test(intent.caption ?? "")) {
      const normalizedTarget = acuteAngleMeasure?.target.normalize("NFKC").trim();
      if (normalizedTarget === cLabel) builder.addAngle(c, b, a, null);
      else builder.addAngle(a, b, c, null);
    }
  }
  if (intent.variant === "ISOSCELES" && includeDerivedPropertyMarkers) {
    builder.addEqualLengths(["sideCA", "sideBC"]);
  }
  if (intent.variant === "EQUILATERAL" && includeDerivedPropertyMarkers) {
    builder.addEqualLengths(["sideAB", "sideBC", "sideCA"]);
  }
  addMeasureLabels(builder, intent, edges, a);
  return builder.build();
}

function hasTriangleAltitude(intent: PlaneIntent) {
  const fourthLabel = intent.pointLabels[3];
  if (!fourthLabel) return false;
  const normalizedFourthLabel = fourthLabel.normalize("NFKC").trim();
  return (
    /(?:đường|chiều)\s*cao|vuông\s*góc/iu.test(intent.caption ?? "") ||
    intent.measures.some((measure) =>
      normalizeSegmentName(measure.target).includes(normalizedFourthLabel),
    )
  );
}

function compileTriangleAltitude(intent: PlaneIntent) {
  const labels = requireLabels(intent, 4);
  const [aLabel, bLabel, cLabel, hLabel] =
    intent.archetype === "BASIC_CONSTRUCTION"
      ? [labels[0]!, labels[2]!, labels[3]!, labels[1]!]
      : [labels[0]!, labels[1]!, labels[2]!, labels[3]!];
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -1.2, width: 8, height: 6.4 },
    intent.caption,
  );
  const a = builder.addPoint(vertexPoint("A", 2.1, 3.6, aLabel, "TOP"));
  const b = builder.addPoint(vertexPoint("B", 0, 0, bLabel, "BOTTOM_LEFT"));
  const c = builder.addPoint(vertexPoint("C", 5.4, 0, cLabel, "BOTTOM_RIGHT"));
  const h = builder.addPoint(vertexPoint("H", 2.1, 0, hLabel, "BOTTOM"));
  builder.addSegment("sideAB", a, b);
  builder.addSegment("sideBC", b, c);
  builder.addSegment("sideCA", c, a);
  builder.addSegment("altitudeAH", a, h);
  builder.addRightAngle(h, a, b);
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [normalizeSegmentName(`${aLabel}${bLabel}`), "sideAB"],
      [normalizeSegmentName(`${bLabel}${cLabel}`), "sideBC"],
      [normalizeSegmentName(`${cLabel}${aLabel}`), "sideCA"],
      [normalizeSegmentName(`${aLabel}${hLabel}`), "altitudeAH"],
    ]),
    a,
  );
  return builder.build();
}

function compileQuadrilateral(intent: PlaneIntent) {
  const labels = requireLabels(intent, 4);
  const includeDerivedPropertyMarkers = intent.grade >= 6;
  const explicitRightAngleIndices = [
    ...new Set(
      intent.measures
        .map((measure) => explicitRightAngleIndex(measure, labels.slice(0, 4)))
        .filter((index) => index >= 0),
    ),
  ];
  const hasLeftRightSide =
    explicitRightAngleIndices.includes(0) && explicitRightAngleIndices.includes(3);
  const hasRightRightSide =
    explicitRightAngleIndices.includes(1) && explicitRightAngleIndices.includes(2);
  const coordinates =
    intent.variant === "SQUARE"
      ? ([
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ] as const)
      : intent.variant === "RECTANGLE"
        ? ([
            [0, 0],
            [5, 0],
            [5, 3],
            [0, 3],
          ] as const)
        : intent.variant === "PARALLELOGRAM"
          ? ([
              [0, 0],
              [5, 0],
              [6, 3],
              [1, 3],
            ] as const)
          : intent.variant === "TRAPEZOID"
            ? hasLeftRightSide
              ? ([
                  [0, 0],
                  [6, 0],
                  [4.8, 3],
                  [0, 3],
                ] as const)
              : hasRightRightSide
                ? ([
                    [0, 0],
                    [6, 0],
                    [6, 3],
                    [1.2, 3],
                  ] as const)
                : ([
                    [0, 0],
                    [6, 0],
                    [4.8, 3],
                    [1.5, 3],
                  ] as const)
            : intent.variant === "RHOMBUS"
              ? ([
                  [0, 0],
                  [3, -1.5],
                  [6, 0],
                  [3, 1.5],
                ] as const)
              : intent.variant === "KITE"
                ? ([
                    [0, 0],
                    [2.5, -1.5],
                    [5.5, 0],
                    [2.5, 3.2],
                  ] as const)
                : ([
                    [0, 0],
                    [5, 0],
                    [4.5, 3.5],
                    [0.7, 3],
                  ] as const);
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -1.2, width: 8.4, height: 6.2 },
    intent.caption,
  );
  const points = coordinates.map(([x, y], index) =>
    builder.addPoint(
      vertexPoint(
        `quadrilateralPoint${index}`,
        x,
        y,
        labels[index]!,
        index < 2
          ? index === 0
            ? "BOTTOM_LEFT"
            : "BOTTOM_RIGHT"
          : index === 2
            ? "TOP_RIGHT"
            : "TOP_LEFT",
      ),
    ),
  );
  const midpointRelation = findQuadrilateralMidpointRelation(intent, labels);
  const midpointPoint = midpointRelation
    ? builder.addPoint({
        id: "quadrilateralMidpoint",
        x:
          (coordinates[midpointRelation.edgeIndex]![0] +
            coordinates[(midpointRelation.edgeIndex + 1) % coordinates.length]![0]) /
          2,
        y:
          (coordinates[midpointRelation.edgeIndex]![1] +
            coordinates[(midpointRelation.edgeIndex + 1) % coordinates.length]![1]) /
          2,
        label: midpointRelation.label,
        pointStyle: "FILLED",
        labelPosition: midpointLabelPosition(
          coordinates[midpointRelation.edgeIndex]!,
          coordinates[(midpointRelation.edgeIndex + 1) % coordinates.length]!,
        ),
      })
    : null;
  const edges = new Map<string, string>();
  const sideIds: Array<string | null> = Array.from({ length: points.length }, () => null);
  let midpointSegmentIds: [string, string] | null = null;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    const id = `quadrilateralSide${index}`;
    if (midpointRelation?.edgeIndex === index && midpointPoint) {
      const firstId = `${id}FirstHalf`;
      const secondId = `${id}SecondHalf`;
      builder.addSegment(firstId, points[index]!, midpointPoint);
      builder.addSegment(secondId, midpointPoint, points[next]!);
      edges.set(
        normalizeSegmentName(`${labels[index]}${midpointRelation.label}`),
        firstId,
      );
      edges.set(
        normalizeSegmentName(`${midpointRelation.label}${labels[next]}`),
        secondId,
      );
      midpointSegmentIds = [firstId, secondId];
      continue;
    }
    builder.addSegment(id, points[index]!, points[next]!);
    sideIds[index] = id;
    edges.set(normalizeSegmentName(`${labels[index]}${labels[next]}`), id);
  }
  if (["SQUARE", "RECTANGLE"].includes(intent.variant) && includeDerivedPropertyMarkers) {
    if (midpointRelation && midpointPoint) {
      const startIndex = midpointRelation.edgeIndex;
      const endIndex = (startIndex + 1) % points.length;
      builder.addRightAngle(
        points[startIndex]!,
        points[(startIndex + points.length - 1) % points.length]!,
        midpointPoint,
      );
      builder.addRightAngle(
        points[endIndex]!,
        midpointPoint,
        points[(endIndex + 1) % points.length]!,
      );
    } else {
      builder.addRightAngle(points[0]!, points[1]!, points[3]!);
    }
  }
  explicitRightAngleIndices.forEach((index) => {
    builder.addRightAngle(
      points[index]!,
      points[(index + points.length - 1) % points.length]!,
      points[(index + 1) % points.length]!,
    );
  });
  if (intent.variant === "PARALLELOGRAM" && includeDerivedPropertyMarkers) {
    builder.addParallels(["quadrilateralSide0", "quadrilateralSide2"], 1);
    builder.addParallels(["quadrilateralSide1", "quadrilateralSide3"], 2);
  } else if (intent.variant === "TRAPEZOID" && includeDerivedPropertyMarkers) {
    builder.addParallels(["quadrilateralSide0", "quadrilateralSide2"], 1);
  }
  if (intent.variant === "SQUARE" && includeDerivedPropertyMarkers) {
    builder.addEqualLengths([...edges.values()]);
  } else if (intent.variant === "RHOMBUS" && includeDerivedPropertyMarkers) {
    builder.addEqualLengths([...edges.values()]);
  } else if (intent.variant === "KITE" && includeDerivedPropertyMarkers) {
    builder.addEqualLengths(["quadrilateralSide0", "quadrilateralSide3"], 1);
    builder.addEqualLengths(["quadrilateralSide1", "quadrilateralSide2"], 2);
  }
  if (midpointSegmentIds) {
    builder.addEqualLengths(midpointSegmentIds, 2);
    if (intent.variant === "RECTANGLE") {
      const otherOppositePair = midpointRelation!.edgeIndex % 2 === 0 ? [1, 3] : [0, 2];
      const oppositeSegmentIds = otherOppositePair.flatMap((index) =>
        sideIds[index] ? [sideIds[index]!] : [],
      );
      if (oppositeSegmentIds.length === 2) {
        builder.addEqualLengths(oppositeSegmentIds, 1);
      }
    }
  }
  addMeasureLabels(
    builder,
    {
      ...intent,
      measures: intent.measures.filter(
        (measure) => explicitRightAngleIndex(measure, labels.slice(0, 4)) < 0,
      ),
    },
    edges,
    points[0]!,
  );
  return builder.build();
}

function explicitRightAngleIndex(
  measure: PlaneIntent["measures"][number],
  labels: readonly string[],
) {
  if (!/^\s*90(?:[.,]0+)?\s*°?\s*$/u.test(measure.text)) return -1;
  const normalizedTarget = measure.target.normalize("NFKC").trim();
  return labels.findIndex(
    (label) => label.normalize("NFKC").trim() === normalizedTarget,
  );
}

function findQuadrilateralMidpointRelation(intent: PlaneIntent, labels: string[]) {
  const measure = intent.measures.find((candidate) =>
    /trung\s*điểm/iu.test(candidate.text),
  );
  if (!measure) return null;
  const target = normalizeSegmentName(measure.target);
  const edgeIndex = labels
    .slice(0, 4)
    .findIndex(
      (label, index) =>
        normalizeSegmentName(`${label}${labels[(index + 1) % 4]}`) === target,
    );
  if (edgeIndex < 0) return null;
  const labelFromText = measure.text.match(
    /^\s*([A-Z](?:['′″]|[0-9₀-₉]){0,3})\s+là\s+trung\s*điểm/iu,
  )?.[1];
  const label = labelFromText ?? labels[4];
  if (!label || labels.slice(0, 4).includes(label)) return null;
  return { edgeIndex, label };
}

function midpointLabelPosition(
  start: readonly [number, number],
  end: readonly [number, number],
): "TOP" | "RIGHT" | "BOTTOM" | "LEFT" {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "BOTTOM" : "TOP";
  }
  return deltaY >= 0 ? "RIGHT" : "LEFT";
}

function compileParallelTransversal(intent: PlaneIntent) {
  if (
    intent.pointLabels.length === 2 &&
    /cách\s*nhau|khoảng\s*cách/iu.test(intent.caption ?? "")
  ) {
    return compileParallelLineDistance(intent);
  }
  const labels = requireLabels(intent, 4);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 8, height: 7 },
    intent.caption,
  );
  const a = builder.addPoint(vertexPoint("parallelA", 0, 1, labels[0]!, "TOP_LEFT"));
  const b = builder.addPoint(vertexPoint("parallelB", 6, 1, labels[1]!, "TOP_RIGHT"));
  const c = builder.addPoint(vertexPoint("parallelC", 0, 4.5, labels[2]!, "BOTTOM_LEFT"));
  const d = builder.addPoint(
    vertexPoint("parallelD", 6, 4.5, labels[3]!, "BOTTOM_RIGHT"),
  );
  const transversalLow = builder.addPoint(hiddenPoint("transversalLow", 1.3, 0));
  const transversalHigh = builder.addPoint(hiddenPoint("transversalHigh", 4.8, 5.7));
  builder.addLine("parallelLineOne", a, b);
  builder.addLine("parallelLineTwo", c, d);
  builder.addLine("transversal", transversalLow, transversalHigh);
  builder.addParallels(["parallelLineOne", "parallelLineTwo"]);
  return builder.build();
}

function compileParallelLineDistance(intent: PlaneIntent) {
  const [upperLabel, lowerLabel] = requireLabels(intent, 2);
  const builder = new DiagramBuilder(
    { minX: -4.6, minY: -0.8, width: 9.2, height: 7.2 },
    intent.caption,
  );
  const upper = builder.addPoint(
    vertexPoint("parallelDistanceUpper", 0, 4.6, upperLabel!, "TOP_LEFT"),
  );
  const lower = builder.addPoint(
    vertexPoint("parallelDistanceLower", 0, 1, lowerLabel!, "BOTTOM_LEFT"),
  );
  const lowerLeft = builder.addPoint(hiddenPoint("parallelDistanceLowerLeft", -3.8, 1));
  const lowerRight = builder.addPoint(hiddenPoint("parallelDistanceLowerRight", 3.8, 1));
  const upperLeft = builder.addPoint(hiddenPoint("parallelDistanceUpperLeft", -3.8, 4.6));
  const upperRight = builder.addPoint(hiddenPoint("parallelDistanceUpperRight", 3.8, 4.6));
  builder.addLine("parallelDistanceLineOne", lowerLeft, lowerRight);
  builder.addLine("parallelDistanceLineTwo", upperLeft, upperRight);
  builder.addSegment("parallelDistancePerpendicular", upper, lower);
  builder.addRightAngle(lower, upper, lowerRight);
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [
        normalizeSegmentName(`${upperLabel}${lowerLabel}`),
        "parallelDistancePerpendicular",
      ],
    ]),
    upper,
  );
  return builder.build();
}

function compileCircleParts(intent: PlaneIntent) {
  if (intent.variant === "ARC_SECTOR") return compileArcSector(intent);
  const labels = requireLabels(intent, 2);
  const centerLabel = inferCircleCenterLabel(intent, labels);
  const builder = new DiagramBuilder(
    { minX: -4, minY: -4, width: 8, height: 8.4 },
    intent.caption,
  );
  const center = builder.addPoint(centerPoint("circleCenter", 0, 0, centerLabel));
  builder.addCircle("mainCircle", center, 3);
  const circumferenceLabels = labels.filter((label) => label !== centerLabel);
  const diameterMeasure = intent.measures.find(
    (measure) => targetLabelPair(measure.target, circumferenceLabels) !== null,
  );
  const diameterPair = diameterMeasure
    ? targetLabelPair(diameterMeasure.target, circumferenceLabels)
    : null;
  const coordinateByLabel = new Map<string, readonly [number, number]>();
  if (diameterPair) {
    coordinateByLabel.set(diameterPair[0], [3, 0]);
    coordinateByLabel.set(diameterPair[1], [-3, 0]);
  }
  const remainingAngles = [60, 120, -60, -120, 90, -90, 30] as const;
  let remainingIndex = 0;
  for (const [index, label] of circumferenceLabels.entries()) {
    if (coordinateByLabel.has(label)) continue;
    if (!diameterPair && index < 2) {
      coordinateByLabel.set(label, index === 0 ? [3, 0] : [-3, 0]);
      continue;
    }
    const degrees = remainingAngles[remainingIndex % remainingAngles.length]!;
    remainingIndex += 1;
    const radians = (degrees * Math.PI) / 180;
    coordinateByLabel.set(label, [3 * Math.cos(radians), 3 * Math.sin(radians)]);
  }
  const pointIdByLabel = new Map<string, string>([[centerLabel, center]]);
  for (const [index, label] of circumferenceLabels.entries()) {
    const [x, y] = coordinateByLabel.get(label)!;
    pointIdByLabel.set(
      label,
      builder.addPoint(
        vertexPoint(`circlePoint${index}`, x, y, label, circleLabelPosition(x, y)),
      ),
    );
  }
  const edges = new Map<string, string>();
  if (diameterPair) {
    const diameterId = builder.addSegment(
      "circleDiameter",
      pointIdByLabel.get(diameterPair[0])!,
      pointIdByLabel.get(diameterPair[1])!,
    );
    const radiusEndpointLabels = new Set(
      intent.measures.flatMap((measure) => {
        const pair = targetLabelPair(measure.target, labels);
        if (!pair?.includes(centerLabel)) return [];
        return pair.filter((label) => label !== centerLabel);
      }),
    );
    edges.set(
      normalizeSegmentName(`${diameterPair[0]}${diameterPair[1]}`),
      diameterId,
    );
    for (const [index, endpointLabel] of [...radiusEndpointLabels].entries()) {
      const endpointId = pointIdByLabel.get(endpointLabel);
      if (!endpointId) continue;
      edges.set(
        normalizeSegmentName(`${centerLabel}${endpointLabel}`),
        builder.addSegment(`circleMeasuredRadius${index}`, center, endpointId),
      );
    }
  }
  for (const [index, measure] of intent.measures.entries()) {
    const pair = targetLabelPair(measure.target, labels);
    if (!pair) continue;
    const normalizedTarget = normalizeSegmentName(measure.target);
    if (edges.has(normalizedTarget)) continue;
    const from = pointIdByLabel.get(pair[0]);
    const to = pointIdByLabel.get(pair[1]);
    if (!from || !to) continue;
    edges.set(normalizedTarget, builder.addSegment(`circleRelation${index}`, from, to));
  }
  if (edges.size === 0) {
    const firstCircumferenceLabel = circumferenceLabels[0]!;
    edges.set(
      normalizeSegmentName(`${centerLabel}${firstCircumferenceLabel}`),
      builder.addSegment(
        "circleDefaultRadius",
        center,
        pointIdByLabel.get(firstCircumferenceLabel)!,
      ),
    );
  }
  addMeasureLabels(builder, intent, edges, center);
  return builder.build();
}

function inferCircleCenterLabel(intent: PlaneIntent, labels: readonly string[]) {
  const namedCenter = intent.caption?.match(
    /\btâm\s+([A-Z](?:['′″]|[0-9₀-₉]){0,3})\b/iu,
  )?.[1];
  if (namedCenter) {
    const matchingLabel = labels.find(
      (label) => label.normalize("NFKC") === namedCenter.normalize("NFKC"),
    );
    if (matchingLabel) return matchingLabel;
  }

  const diameterMeasure = intent.measures.find((measure) =>
    /^(?:d|đường\s*kính)$/iu.test(measure.text.trim()),
  );
  const diameterPair = diameterMeasure
    ? targetLabelPair(diameterMeasure.target, labels)
    : null;
  if (diameterPair && labels.length === 3) {
    const remainingLabel = labels.find((label) => !diameterPair.includes(label));
    if (remainingLabel) return remainingLabel;
  }

  return labels.find((label) => /^O(?:['′″]|[0-9₀-₉]){0,3}$/u.test(label)) ?? labels[0]!;
}

function targetLabelPair(target: string, labels: readonly string[]) {
  const normalizedTarget = normalizeSegmentName(
    target.replaceAll(/[^A-Z0-9′'″₀-₉]/gu, ""),
  );
  for (let firstIndex = 0; firstIndex < labels.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < labels.length;
      secondIndex += 1
    ) {
      const first = labels[firstIndex]!;
      const second = labels[secondIndex]!;
      if (normalizeSegmentName(`${first}${second}`) === normalizedTarget) {
        return [first, second] as const;
      }
    }
  }
  return null;
}

function circleLabelPosition(
  x: number,
  y: number,
):
  | "TOP"
  | "TOP_RIGHT"
  | "RIGHT"
  | "BOTTOM_RIGHT"
  | "BOTTOM"
  | "BOTTOM_LEFT"
  | "LEFT"
  | "TOP_LEFT" {
  if (Math.abs(x) >= Math.abs(y) * 1.4) return x >= 0 ? "RIGHT" : "LEFT";
  if (Math.abs(y) >= Math.abs(x) * 1.4) return y >= 0 ? "TOP" : "BOTTOM";
  if (x >= 0) return y >= 0 ? "TOP_RIGHT" : "BOTTOM_RIGHT";
  return y >= 0 ? "TOP_LEFT" : "BOTTOM_LEFT";
}

function compileArcSector(intent: PlaneIntent) {
  const [oLabel, aLabel, bLabel] = requireLabels(intent, 3);
  const builder = new DiagramBuilder(
    { minX: -4, minY: -4, width: 8, height: 8.4 },
    intent.caption,
  );
  const center = builder.addPoint(centerPoint("sectorO", 0, 0, oLabel!));
  const a = builder.addPoint(vertexPoint("sectorA", 3, 0, aLabel!, "RIGHT"));
  const angle = (80 * Math.PI) / 180;
  const b = builder.addPoint(
    vertexPoint(
      "sectorB",
      3 * Math.cos(angle),
      3 * Math.sin(angle),
      bLabel!,
      "TOP_RIGHT",
    ),
  );
  const sectorArcPoints = Array.from({ length: 15 }, (_, index) => {
    const sampleAngle = ((index + 1) * 5 * Math.PI) / 180;
    return builder.addPoint(
      hiddenPoint(
        `sectorArcSample${index + 1}`,
        3 * Math.cos(sampleAngle),
        3 * Math.sin(sampleAngle),
      ),
    );
  });
  builder.addPolygon("sectorArea", [center, a, ...sectorArcPoints, b], "SOFT_BLUE");
  builder.addCircle("sectorCircle", center, 3);
  builder.addSegment("sectorRadiusOA", center, a);
  builder.addSegment("sectorRadiusOB", center, b);
  builder.addAngle(center, a, b, findMeasure(intent, "ANGLE"));
  return builder.build();
}

function compileRightTriangleCongruence(intent: PlaneIntent) {
  return intent.variant === "SHARED_HYPOTENUSE_LEG"
    ? compileSharedHypotenuseCongruence(intent)
    : compileSeparateRightTriangleCongruence(intent);
}

function compileSeparateRightTriangleCongruence(intent: PlaneIntent) {
  const labels = requireLabels(intent, 6);
  const [aLabel, bLabel, cLabel, aPrimeLabel, bPrimeLabel, cPrimeLabel] = labels;
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -1.2, width: 13.4, height: 6.4 },
    intent.caption,
  );
  const a = builder.addPoint(vertexPoint("congruenceA", 0, 0, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertexPoint("congruenceB", 0, 3.2, bLabel!, "TOP_LEFT"));
  const c = builder.addPoint(vertexPoint("congruenceC", 4.3, 0, cLabel!, "BOTTOM_RIGHT"));
  const aPrime = builder.addPoint(
    vertexPoint("congruenceAPrime", 7, 0, aPrimeLabel!, "BOTTOM_LEFT"),
  );
  const bPrime = builder.addPoint(
    vertexPoint("congruenceBPrime", 7, 3.2, bPrimeLabel!, "TOP_LEFT"),
  );
  const cPrime = builder.addPoint(
    vertexPoint("congruenceCPrime", 11.3, 0, cPrimeLabel!, "BOTTOM_RIGHT"),
  );
  builder.addSegment("congruenceAB", a, b);
  builder.addSegment("congruenceBC", b, c);
  builder.addSegment("congruenceCA", c, a);
  builder.addSegment("congruenceAPrimeBPrime", aPrime, bPrime);
  builder.addSegment("congruenceBPrimeCPrime", bPrime, cPrime);
  builder.addSegment("congruenceCPrimeAPrime", cPrime, aPrime);
  builder.addRightAngle(a, b, c);
  builder.addRightAngle(aPrime, bPrime, cPrime);

  if (intent.variant === "TWO_LEGS") {
    builder.addEqualLengths(["congruenceAB", "congruenceAPrimeBPrime"], 1);
    builder.addEqualLengths(["congruenceCA", "congruenceCPrimeAPrime"], 2);
  } else {
    builder.addEqualLengths(["congruenceBC", "congruenceBPrimeCPrime"], 1);
    if (intent.variant === "HYPOTENUSE_LEG") {
      builder.addEqualLengths(["congruenceAB", "congruenceAPrimeBPrime"], 2);
    } else {
      builder.addAngle(b, a, c, null);
      builder.addAngle(bPrime, aPrime, cPrime, null);
    }
  }
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [normalizeSegmentName(`${aLabel}${bLabel}`), "congruenceAB"],
      [normalizeSegmentName(`${bLabel}${cLabel}`), "congruenceBC"],
      [normalizeSegmentName(`${cLabel}${aLabel}`), "congruenceCA"],
      [normalizeSegmentName(`${aPrimeLabel}${bPrimeLabel}`), "congruenceAPrimeBPrime"],
      [normalizeSegmentName(`${bPrimeLabel}${cPrimeLabel}`), "congruenceBPrimeCPrime"],
      [normalizeSegmentName(`${cPrimeLabel}${aPrimeLabel}`), "congruenceCPrimeAPrime"],
    ]),
    a,
  );
  return builder.build();
}

function compileSharedHypotenuseCongruence(intent: PlaneIntent) {
  const [aLabel, bLabel, cLabel, dLabel] = requireLabels(intent, 4);
  const builder = new DiagramBuilder(
    { minX: -5.2, minY: -4.7, width: 10.4, height: 9.4 },
    intent.caption,
  );
  const vertical = Math.sqrt(16 - 2.25 ** 2);
  const a = builder.addPoint(vertexPoint("sharedA", -4, 0, aLabel!, "LEFT"));
  const b = builder.addPoint(vertexPoint("sharedB", -1.75, vertical, bLabel!, "TOP"));
  const c = builder.addPoint(vertexPoint("sharedC", 4, 0, cLabel!, "RIGHT"));
  const d = builder.addPoint(vertexPoint("sharedD", -1.75, -vertical, dLabel!, "BOTTOM"));
  builder.addSegment("sharedAB", a, b);
  builder.addSegment("sharedBC", b, c);
  builder.addSegment("sharedAC", a, c);
  builder.addSegment("sharedAD", a, d);
  builder.addSegment("sharedDC", d, c);
  builder.addRightAngle(b, a, c);
  builder.addRightAngle(d, a, c);
  builder.addEqualLengths(["sharedAB", "sharedAD"]);
  addMeasureLabels(
    builder,
    intent,
    new Map([
      [normalizeSegmentName(`${aLabel}${bLabel}`), "sharedAB"],
      [normalizeSegmentName(`${bLabel}${cLabel}`), "sharedBC"],
      [normalizeSegmentName(`${aLabel}${cLabel}`), "sharedAC"],
      [normalizeSegmentName(`${aLabel}${dLabel}`), "sharedAD"],
      [normalizeSegmentName(`${dLabel}${cLabel}`), "sharedDC"],
    ]),
    a,
  );
  return builder.build();
}

function addMeasureLabels(
  builder: DiagramBuilder,
  intent: PlaneIntent,
  edges: Map<string, string>,
  fallbackPointId: string,
) {
  for (const measure of intent.measures) {
    const text = compactMeasureText(measure.target, measure.text);
    if (!text) continue;
    const segmentId = edges.get(normalizeSegmentName(measure.target));
    builder.addLabel({
      text,
      anchorPointId: fallbackPointId,
      anchorPrimitiveId: segmentId ?? null,
      position: "TOP",
    });
  }
}

function compactMeasureText(target: string, text: string) {
  const equalityIndex = text.indexOf("=");
  if (equalityIndex < 0) {
    const compact = text.trim();
    if (/^[-+]?\d+(?:[.,]\d+)?(?:\/\d+)?\s*(?:mm|cm|dm|m|km|°|%|rad)?$/iu.test(compact)) {
      return compact;
    }
    return !/\s/u.test(compact) && compact.length <= 4 ? compact : null;
  }
  const left = text.slice(0, equalityIndex).trim();
  const right = text.slice(equalityIndex + 1).trim();
  const normalizedTarget = normalizeSegmentName(
    target.replaceAll(/[^\p{L}\p{N}′']/gu, ""),
  );
  const normalizedLeft = normalizeSegmentName(left.replaceAll(/[^\p{L}\p{N}′']/gu, ""));
  const isTargetAssignment =
    normalizedTarget.length > 0 && normalizedTarget === normalizedLeft;
  const hasNumericMeasure = /\d/u.test(right);
  // Equality between geometric objects is already encoded by EQUAL_LENGTH or
  // ANGLE markers. A numeric assignment such as "AB = 3 cm" is reduced to the
  // compact textbook label "3 cm" anchored to AB.
  return isTargetAssignment && hasNumericMeasure ? right : null;
}

function findMeasure(intent: PlaneIntent, target: string) {
  const exact = intent.measures.find((measure) => measure.target === target);
  if (exact) return exact.text;
  if (target === "ANGLE") {
    return (
      intent.measures.find((measure) => {
        const normalized = measure.target
          .normalize("NFKC")
          .replaceAll(/\s/gu, "")
          .toUpperCase();
        return (
          normalized.startsWith("∠") ||
          normalized.startsWith("\\ANGLE") ||
          normalized.startsWith("GÓC")
        );
      })?.text ?? null
    );
  }
  return null;
}

function requireLabels(intent: PlaneIntent, count: number) {
  if (intent.pointLabels.length < count) {
    throw new Error(`${intent.archetype} requires at least ${count} point labels.`);
  }
  return intent.pointLabels;
}

function normalizeSegmentName(value: string) {
  return [...value].sort().join("");
}

function vertexPoint(
  id: string,
  x: number,
  y: number,
  label: string,
  labelPosition:
    | "TOP"
    | "TOP_RIGHT"
    | "RIGHT"
    | "BOTTOM_RIGHT"
    | "BOTTOM"
    | "BOTTOM_LEFT"
    | "LEFT"
    | "TOP_LEFT",
) {
  return { id, x, y, label, pointStyle: "NONE" as const, labelPosition };
}

function centerPoint(id: string, x: number, y: number, label: string) {
  return {
    id,
    x,
    y,
    label,
    pointStyle: "FILLED" as const,
    labelPosition: "BOTTOM_RIGHT" as const,
  };
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
