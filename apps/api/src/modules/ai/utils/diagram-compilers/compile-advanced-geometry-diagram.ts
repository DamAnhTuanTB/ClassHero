import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { DiagramBuilder } from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type AdvancedIntent = Extract<
  LessonSummaryDiagramIntent,
  { family: "ADVANCED_GEOMETRY" }
>;

export function compileAdvancedGeometryDiagram(
  intent: AdvancedIntent,
): LessonSummaryDiagramSpec {
  switch (intent.archetype) {
    case "TRIANGLE_CENTROID":
      return compileTriangleCentroid(intent);
    case "TRIANGLE_CONCURRENCY":
      return compileTriangleConcurrency(intent);
    case "THALES":
      return compileThales(intent);
    case "RIGHT_TRIANGLE_ALTITUDE":
      return compileRightTriangleAltitude(intent);
    case "CIRCLE_RELATIONS":
      return compileCircleRelations(intent);
    case "TRIANGLE_SIMILARITY":
      return compileTriangleSimilarity(intent);
  }
}

function compileTriangleSimilarity(intent: AdvancedIntent) {
  const labels = requireLabels(intent, 6);
  const [aLabel, bLabel, cLabel, dLabel, eLabel, fLabel] = labels;
  const firstLabels = [aLabel!, bLabel!, cLabel!] as const;
  const secondLabels = [dLabel!, eLabel!, fLabel!] as const;
  const derivedMeasures =
    intent.variant === "SSS_SIMILARITY"
      ? deriveMissingSimilarityMeasures(intent, firstLabels, secondLabels)
      : [];
  const effectiveIntent =
    derivedMeasures.length > 0
      ? { ...intent, measures: [...intent.measures, ...derivedMeasures] }
      : intent;
  const firstIncluded =
    intent.variant === "SAS_SIMILARITY"
      ? includedAngleForMeasuredSides(firstLabels, effectiveIntent)
      : null;
  const secondIncluded =
    intent.variant === "SAS_SIMILARITY"
      ? includedAngleForMeasuredSides(secondLabels, effectiveIntent)
      : null;
  const fallbackSides = [4.2, 5.1, 3.8] as const;
  const firstSides = triangleSidesForVariant(
    effectiveIntent,
    firstLabels,
    firstIncluded,
  );
  const secondSides = triangleSidesForVariant(
    effectiveIntent,
    secondLabels,
    secondIncluded,
  );
  const firstShape =
    triangleShape(firstSides ?? secondSides ?? fallbackSides);
  let secondShape = triangleShape(secondSides ?? firstSides ?? fallbackSides);
  const derivedScale = derivedSimilarityScale(intent, firstSides, secondSides);
  if (derivedScale !== null) {
    secondShape = secondShape.map((point) => ({
      x: point.x * derivedScale,
      y: point.y * derivedScale,
    }));
  }
  const secondOffsetX = Math.max(...firstShape.map((point) => point.x)) + 3;
  const secondTranslated = secondShape.map((point) => ({
    x: point.x + secondOffsetX,
    y: point.y,
  }));
  const maximumX = Math.max(...secondTranslated.map((point) => point.x));
  const maximumY = Math.max(
    ...firstShape.map((point) => point.y),
    ...secondTranslated.map((point) => point.y),
  );
  const builder = createBuilder(intent, {
    minX: -1.2,
    minY: -1.3,
    width: maximumX + 2.4,
    height: maximumY + 2.6,
  });
  const a = builder.addPoint(vertex("similarA", firstShape[0]!.x, firstShape[0]!.y, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("similarB", firstShape[1]!.x, firstShape[1]!.y, bLabel!, "BOTTOM_RIGHT"));
  const c = builder.addPoint(vertex("similarC", firstShape[2]!.x, firstShape[2]!.y, cLabel!, "TOP"));
  const d = builder.addPoint(vertex("similarD", secondTranslated[0]!.x, secondTranslated[0]!.y, dLabel!, "BOTTOM_LEFT"));
  const e = builder.addPoint(vertex("similarE", secondTranslated[1]!.x, secondTranslated[1]!.y, eLabel!, "BOTTOM_RIGHT"));
  const f = builder.addPoint(vertex("similarF", secondTranslated[2]!.x, secondTranslated[2]!.y, fLabel!, "TOP"));
  const edgeEntries = [
    [segmentKey(aLabel!, bLabel!), builder.addSegment("similarAB", a, b)],
    [segmentKey(bLabel!, cLabel!), builder.addSegment("similarBC", b, c)],
    [segmentKey(cLabel!, aLabel!), builder.addSegment("similarCA", c, a)],
    [segmentKey(dLabel!, eLabel!), builder.addSegment("similarDE", d, e)],
    [segmentKey(eLabel!, fLabel!), builder.addSegment("similarEF", e, f)],
    [segmentKey(fLabel!, dLabel!), builder.addSegment("similarFD", f, d)],
  ] as const;
  const anglePoints = new Map([
    [normalizeTarget(aLabel!), { vertex: a, arms: [b, c] as const }],
    [normalizeTarget(bLabel!), { vertex: b, arms: [a, c] as const }],
    [normalizeTarget(cLabel!), { vertex: c, arms: [a, b] as const }],
    [normalizeTarget(dLabel!), { vertex: d, arms: [e, f] as const }],
    [normalizeTarget(eLabel!), { vertex: e, arms: [d, f] as const }],
    [normalizeTarget(fLabel!), { vertex: f, arms: [d, e] as const }],
  ]);
  const measuredAngles = intent.measures.filter((measure) =>
    anglePoints.has(normalizeTarget(measure.target)),
  );
  if (intent.variant === "AA_SIMILARITY") {
    if (measuredAngles.length > 0) {
      for (const measure of measuredAngles) {
        const angle = anglePoints.get(normalizeTarget(measure.target))!;
        builder.addAngle(angle.vertex, angle.arms[0], angle.arms[1], measure.text);
      }
    } else {
      builder.addAngle(a, b, c, "α");
      builder.addAngle(d, e, f, "α");
      builder.addAngle(b, a, c, "β");
      builder.addAngle(e, d, f, "β");
    }
  } else if (intent.variant === "SAS_SIMILARITY") {
    const firstAngle = anglePoints.get(normalizeTarget(firstIncluded ?? aLabel!))!;
    const secondAngle = anglePoints.get(normalizeTarget(secondIncluded ?? dLabel!))!;
    const criterionAngleLabel = intent.measures.length === 0 ? "α" : null;
    builder.addAngle(
      firstAngle.vertex,
      firstAngle.arms[0],
      firstAngle.arms[1],
      criterionAngleLabel,
    );
    builder.addAngle(
      secondAngle.vertex,
      secondAngle.arms[0],
      secondAngle.arms[1],
      criterionAngleLabel,
    );
  }
  if (intent.measures.length === 0) {
    addSimilarityCriterionSideLabels(builder, intent.variant);
  }
  addMeasures(
    builder,
    effectiveIntent,
    new Map(edgeEntries),
    a,
    new Map([
      ["similarAB", "BOTTOM"],
      ["similarBC", "RIGHT"],
      ["similarCA", "LEFT"],
      ["similarDE", "BOTTOM"],
      ["similarEF", "RIGHT"],
      ["similarFD", "LEFT"],
    ]),
  );
  return builder.build();
}

function addSimilarityCriterionSideLabels(
  builder: DiagramBuilder,
  variant: AdvancedIntent["variant"],
) {
  const criterionLabels =
    variant === "SSS_SIMILARITY"
      ? [
          ["similarAB", "a", "BOTTOM"],
          ["similarBC", "b", "RIGHT"],
          ["similarCA", "c", "LEFT"],
          ["similarDE", "ka", "BOTTOM"],
          ["similarEF", "kb", "RIGHT"],
          ["similarFD", "kc", "LEFT"],
        ]
      : variant === "SAS_SIMILARITY"
        ? [
            ["similarAB", "a", "BOTTOM"],
            ["similarCA", "b", "LEFT"],
            ["similarDE", "ka", "BOTTOM"],
            ["similarFD", "kb", "LEFT"],
          ]
        : [];
  for (const [primitiveId, text, position] of criterionLabels) {
    builder.addLabel({
      text: text!,
      anchorPointId: "similarA",
      anchorPrimitiveId: primitiveId!,
      position: position as "BOTTOM" | "LEFT" | "RIGHT",
    });
  }
}

function triangleSidesForVariant(
  intent: AdvancedIntent,
  labels: readonly [string, string, string],
  includedAngle: string | null,
) {
  if (intent.variant === "SSS_SIMILARITY") {
    return triangleSideLengths(intent, labels);
  }
  if (intent.variant === "SAS_SIMILARITY") {
    return triangleSideLengthsFromSas(intent, labels, includedAngle);
  }
  return triangleSideLengthsFromAa(intent, labels);
}

function triangleSideLengths(
  intent: AdvancedIntent,
  labels: readonly [string, string, string],
): readonly [number, number, number] | null {
  const values = new Map(
    intent.measures.map((measure) => [
      normalizeTarget(measure.target),
      parseMeasureNumber(measure.text),
    ]),
  );
  const lengths = [
    values.get(segmentKey(labels[0], labels[1])),
    values.get(segmentKey(labels[1], labels[2])),
    values.get(segmentKey(labels[2], labels[0])),
  ];
  if (lengths.some((value) => value === null || value === undefined)) return null;
  const [first, second, third] = lengths as [number, number, number];
  if (
    first + second <= third ||
    second + third <= first ||
    third + first <= second
  ) {
    return null;
  }
  return [first, second, third];
}

function triangleShape(sideLengths: readonly [number, number, number]) {
  const [side01, side12, side20] = sideLengths;
  const thirdX =
    (side01 * side01 + side20 * side20 - side12 * side12) / (2 * side01);
  const thirdY = Math.sqrt(Math.max(side20 * side20 - thirdX * thirdX, 0));
  const raw = [
    { x: 0, y: 0 },
    { x: side01, y: 0 },
    { x: thirdX, y: thirdY },
  ];
  const minimumX = Math.min(...raw.map((point) => point.x));
  const scale = 5 / Math.max(...sideLengths);
  return raw.map((point) => ({
    x: (point.x - minimumX) * scale,
    y: point.y * scale,
  }));
}

function triangleSideLengthsFromSas(
  intent: AdvancedIntent,
  labels: readonly [string, string, string],
  includedAngle: string | null,
): readonly [number, number, number] | null {
  if (!includedAngle) return null;
  const includedIndex = labels.indexOf(includedAngle);
  if (includedIndex < 0) return null;
  const others = labels.filter((_, index) => index !== includedIndex);
  const values = measureValues(intent);
  const firstLength = values.get(segmentKey(includedAngle, others[0]!));
  const secondLength = values.get(segmentKey(includedAngle, others[1]!));
  if (firstLength === null || firstLength === undefined) return null;
  if (secondLength === null || secondLength === undefined) return null;
  const oppositeLength = Math.sqrt(
    firstLength * firstLength +
      secondLength * secondLength -
      firstLength * secondLength,
  );
  const byEdge = new Map([
    [segmentKey(includedAngle, others[0]!), firstLength],
    [segmentKey(includedAngle, others[1]!), secondLength],
    [segmentKey(others[0]!, others[1]!), oppositeLength],
  ]);
  return [
    byEdge.get(segmentKey(labels[0], labels[1]))!,
    byEdge.get(segmentKey(labels[1], labels[2]))!,
    byEdge.get(segmentKey(labels[2], labels[0]))!,
  ];
}

function triangleSideLengthsFromAa(
  intent: AdvancedIntent,
  labels: readonly [string, string, string],
): readonly [number, number, number] | null {
  const values = measureValues(intent);
  const base = values.get(segmentKey(labels[0], labels[1]));
  const firstAngle = values.get(normalizeTarget(labels[0]));
  const secondAngle = values.get(normalizeTarget(labels[1]));
  if (base === null || base === undefined) return null;
  if (firstAngle === null || firstAngle === undefined) return null;
  if (secondAngle === null || secondAngle === undefined) return null;
  const thirdAngle = 180 - firstAngle - secondAngle;
  if (thirdAngle <= 0) return null;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const side12 = (base * Math.sin(radians(firstAngle))) / Math.sin(radians(thirdAngle));
  const side20 = (base * Math.sin(radians(secondAngle))) / Math.sin(radians(thirdAngle));
  return [base, side12, side20];
}

function deriveMissingSimilarityMeasures(
  intent: AdvancedIntent,
  firstLabels: readonly [string, string, string],
  secondLabels: readonly [string, string, string],
) {
  const firstSides = triangleSideLengths(intent, firstLabels);
  const secondSides = triangleSideLengths(intent, secondLabels);
  if ((firstSides === null) === (secondSides === null)) return [];
  const ratio = similarityRatioFromCaption(intent.caption);
  if (ratio === null) return [];
  const sourceLabels = firstSides ? firstLabels : secondLabels;
  const targetLabels = firstSides ? secondLabels : firstLabels;
  const sourceSides = firstSides ?? secondSides!;
  const multiplier = firstSides ? ratio : 1 / ratio;
  const sourceMeasures = new Map(
    intent.measures.map((measure) => [normalizeTarget(measure.target), measure]),
  );
  const sideIndexes = [
    [0, 1],
    [1, 2],
    [2, 0],
  ] as const;
  return sideIndexes.map(([fromIndex, toIndex], sideIndex) => {
    const sourceMeasure = sourceMeasures.get(
      segmentKey(sourceLabels[fromIndex]!, sourceLabels[toIndex]!),
    );
    const unit = sourceMeasure?.text.match(/[\p{L}]+$/u)?.[0] ?? "";
    const value = sourceSides[sideIndex]! * multiplier;
    return {
      target: `${targetLabels[fromIndex]}${targetLabels[toIndex]}`,
      text: `${formatVietnameseNumber(value)}${unit ? ` ${unit}` : ""}`,
    };
  });
}

function similarityRatioFromCaption(caption: string | null) {
  const match = caption?.match(/(?:tỉ|tỷ|tỷ)\s*số[^\d]*(\d+(?:[,.]\d+)?)\s*\/\s*(\d+(?:[,.]\d+)?)/iu);
  if (!match) return null;
  const numerator = Number(match[1]!.replace(",", "."));
  const denominator = Number(match[2]!.replace(",", "."));
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function derivedSimilarityScale(
  intent: AdvancedIntent,
  firstSides: readonly [number, number, number] | null,
  secondSides: readonly [number, number, number] | null,
) {
  if (!firstSides || !secondSides) return null;
  const originalFirst = triangleSideLengths(intent, [
    intent.pointLabels[0]!,
    intent.pointLabels[1]!,
    intent.pointLabels[2]!,
  ]);
  const originalSecond = triangleSideLengths(intent, [
    intent.pointLabels[3]!,
    intent.pointLabels[4]!,
    intent.pointLabels[5]!,
  ]);
  if (originalFirst && originalSecond) return null;
  return similarityRatioFromCaption(intent.caption);
}

function formatVietnameseNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(".", ",");
}

function measureValues(intent: AdvancedIntent) {
  return new Map(
    intent.measures.map((measure) => [
      normalizeTarget(measure.target),
      parseMeasureNumber(measure.text),
    ]),
  );
}

function includedAngleForMeasuredSides(
  labels: readonly [string, string, string],
  intent: AdvancedIntent,
) {
  const measuredEdges = new Set(
    intent.measures
      .map((measure) => normalizeTarget(measure.target))
      .filter((target) => target.length > 1),
  );
  for (const [index, label] of labels.entries()) {
    const otherLabels = labels.filter((_, candidateIndex) => candidateIndex !== index);
    if (
      measuredEdges.has(segmentKey(label, otherLabels[0]!)) &&
      measuredEdges.has(segmentKey(label, otherLabels[1]!))
    ) {
      return label;
    }
  }
  return null;
}

function parseMeasureNumber(text: string) {
  const match = text.replaceAll(",", ".").match(/-?\d+(?:\.\d+)?/u);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function compileTriangleConcurrency(intent: AdvancedIntent) {
  if (intent.variant === "ANGLE_BISECTORS") {
    return compileTriangleAngleBisectors(intent);
  }
  if (intent.variant === "PERPENDICULAR_BISECTORS") {
    return compileTrianglePerpendicularBisectors(intent);
  }
  if (intent.variant === "ALTITUDES") return compileTriangleAltitudes(intent);
  throw new Error(`TRIANGLE_CONCURRENCY does not support ${intent.variant}.`);
}

function compileTriangleAngleBisectors(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, iLabel] = requireLabels(intent, 4);
  const aCoordinate = { x: 0, y: 0 };
  const bCoordinate = { x: 6, y: 0 };
  const cCoordinate = { x: 2, y: 5 };
  const sideA = pointDistance(bCoordinate, cCoordinate);
  const sideB = pointDistance(cCoordinate, aCoordinate);
  const sideC = pointDistance(aCoordinate, bCoordinate);
  const perimeter = sideA + sideB + sideC;
  const incenter = {
    x:
      (sideA * aCoordinate.x + sideB * bCoordinate.x + sideC * cCoordinate.x) /
      perimeter,
    y:
      (sideA * aCoordinate.y + sideB * bCoordinate.y + sideC * cCoordinate.y) /
      perimeter,
  };
  const builder = createBuilder(intent, { minX: -1, minY: -1, width: 8, height: 7 });
  const a = builder.addPoint(vertex("bisectorsA", aCoordinate.x, aCoordinate.y, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("bisectorsB", bCoordinate.x, bCoordinate.y, bLabel!, "BOTTOM_RIGHT"));
  const c = builder.addPoint(vertex("bisectorsC", cCoordinate.x, cCoordinate.y, cLabel!, "TOP"));
  const i = builder.addPoint(center("bisectorsI", incenter.x, incenter.y, iLabel!));
  builder.addSegment("bisectorsAB", a, b);
  builder.addSegment("bisectorsBC", b, c);
  builder.addSegment("bisectorsCA", c, a);
  builder.addSegment("bisectorAI", a, i);
  builder.addSegment("bisectorBI", b, i);
  builder.addSegment("bisectorCI", c, i);
  builder.addAngle(a, b, i, null);
  builder.addAngle(a, i, c, null);
  return builder.build();
}

function compileTriangleAltitudes(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, dLabel, eLabel, fLabel, hLabel] = requireLabels(intent, 7);
  const aCoordinate = { x: 0, y: 0 };
  const bCoordinate = { x: 6, y: 0 };
  const cCoordinate = { x: 2, y: 5 };
  const dCoordinate = projectPointToLine(aCoordinate, bCoordinate, cCoordinate);
  const eCoordinate = projectPointToLine(bCoordinate, cCoordinate, aCoordinate);
  const fCoordinate = projectPointToLine(cCoordinate, aCoordinate, bCoordinate);
  const orthocenter = lineIntersection(
    aCoordinate,
    dCoordinate,
    bCoordinate,
    eCoordinate,
  );
  const builder = createBuilder(intent, { minX: -1, minY: -1, width: 8, height: 7 });
  const a = builder.addPoint(vertex("altitudesA", aCoordinate.x, aCoordinate.y, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("altitudesB", bCoordinate.x, bCoordinate.y, bLabel!, "BOTTOM_RIGHT"));
  const c = builder.addPoint(vertex("altitudesC", cCoordinate.x, cCoordinate.y, cLabel!, "TOP"));
  const d = builder.addPoint(vertex("altitudesD", dCoordinate.x, dCoordinate.y, dLabel!, "TOP_RIGHT"));
  const e = builder.addPoint(vertex("altitudesE", eCoordinate.x, eCoordinate.y, eLabel!, "TOP_LEFT"));
  const f = builder.addPoint(vertex("altitudesF", fCoordinate.x, fCoordinate.y, fLabel!, "BOTTOM"));
  builder.addPoint(center("altitudesH", orthocenter.x, orthocenter.y, hLabel!));
  builder.addSegment("altitudesAB", a, b);
  builder.addSegment("altitudesBC", b, c);
  builder.addSegment("altitudesCA", c, a);
  builder.addSegment("altitudeAD", a, d);
  builder.addSegment("altitudeBE", b, e);
  builder.addSegment("altitudeCF", c, f);
  builder.addRightAngle(d, a, b);
  builder.addRightAngle(e, b, a);
  builder.addRightAngle(f, c, a);
  return builder.build();
}

function compileTrianglePerpendicularBisectors(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, dLabel, eLabel, fLabel, oLabel] = requireLabels(intent, 7);
  const aCoordinate = { x: 0, y: 0 };
  const bCoordinate = { x: 6, y: 0 };
  const cCoordinate = { x: 2, y: 5 };
  const dCoordinate = midpoint(bCoordinate, cCoordinate);
  const eCoordinate = midpoint(cCoordinate, aCoordinate);
  const fCoordinate = midpoint(aCoordinate, bCoordinate);
  const circumcenter = triangleCircumcenter(aCoordinate, bCoordinate, cCoordinate);
  const builder = createBuilder(intent, { minX: -1.5, minY: -1.5, width: 9, height: 8 });
  const a = builder.addPoint(vertex("perpendicularA", aCoordinate.x, aCoordinate.y, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("perpendicularB", bCoordinate.x, bCoordinate.y, bLabel!, "BOTTOM_RIGHT"));
  const c = builder.addPoint(vertex("perpendicularC", cCoordinate.x, cCoordinate.y, cLabel!, "TOP"));
  const d = builder.addPoint(vertex("perpendicularD", dCoordinate.x, dCoordinate.y, dLabel!, "TOP_RIGHT"));
  const e = builder.addPoint(vertex("perpendicularE", eCoordinate.x, eCoordinate.y, eLabel!, "TOP_LEFT"));
  const f = builder.addPoint(vertex("perpendicularF", fCoordinate.x, fCoordinate.y, fLabel!, "BOTTOM"));
  builder.addPoint(center("perpendicularO", circumcenter.x, circumcenter.y, oLabel!));
  builder.addSegment("perpendicularAF", a, f);
  builder.addSegment("perpendicularFB", f, b);
  builder.addSegment("perpendicularBD", b, d);
  builder.addSegment("perpendicularDC", d, c);
  builder.addSegment("perpendicularCE", c, e);
  builder.addSegment("perpendicularEA", e, a);
  builder.addEqualLengths(["perpendicularAF", "perpendicularFB"], 1);
  builder.addEqualLengths(["perpendicularBD", "perpendicularDC"], 2);
  builder.addEqualLengths(["perpendicularCE", "perpendicularEA"], 3);
  const dBisector = addPerpendicularBisector(builder, "perpendicularDLine", dCoordinate, circumcenter);
  const eBisector = addPerpendicularBisector(builder, "perpendicularELine", eCoordinate, circumcenter);
  const fBisector = addPerpendicularBisector(builder, "perpendicularFLine", fCoordinate, circumcenter);
  builder.addRightAngle(d, dBisector, b);
  builder.addRightAngle(e, eBisector, c);
  builder.addRightAngle(f, fBisector, a);
  return builder.build();
}

function addPerpendicularBisector(
  builder: DiagramBuilder,
  id: string,
  midpointCoordinate: { x: number; y: number },
  centerCoordinate: { x: number; y: number },
) {
  const dx = centerCoordinate.x - midpointCoordinate.x;
  const dy = centerCoordinate.y - midpointCoordinate.y;
  const length = Math.hypot(dx, dy);
  const unit = { x: dx / length, y: dy / length };
  const start = builder.addPoint({
    id: `${id}Start`,
    x: midpointCoordinate.x - unit.x * 0.75,
    y: midpointCoordinate.y - unit.y * 0.75,
    label: null,
    pointStyle: "NONE",
    labelPosition: "TOP",
  });
  const end = builder.addPoint({
    id: `${id}End`,
    x: midpointCoordinate.x + unit.x * 4.25,
    y: midpointCoordinate.y + unit.y * 4.25,
    label: null,
    pointStyle: "NONE",
    labelPosition: "TOP",
  });
  builder.addSegment(id, start, end);
  return end;
}

function compileTriangleCentroid(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, dLabel, eLabel, fLabel, gLabel] = requireLabels(intent, 7);
  const builder = createBuilder(intent, { minX: -1, minY: -1, width: 8, height: 7 });
  const a = builder.addPoint(vertex("centroidA", 3, 5, aLabel!, "TOP"));
  const b = builder.addPoint(vertex("centroidB", 0, 0, bLabel!, "BOTTOM_LEFT"));
  const c = builder.addPoint(vertex("centroidC", 6, 0, cLabel!, "BOTTOM_RIGHT"));
  const d = builder.addPoint(vertex("centroidD", 3, 0, dLabel!, "BOTTOM"));
  const e = builder.addPoint(vertex("centroidE", 4.5, 2.5, eLabel!, "TOP_RIGHT"));
  const f = builder.addPoint(vertex("centroidF", 1.5, 2.5, fLabel!, "TOP_LEFT"));
  builder.addPoint(center("centroidG", 3, 5 / 3, gLabel!));
  builder.addSegment("centroidAF", a, f);
  builder.addSegment("centroidFB", f, b);
  builder.addSegment("centroidBD", b, d);
  builder.addSegment("centroidDC", d, c);
  builder.addSegment("centroidCE", c, e);
  builder.addSegment("centroidEA", e, a);
  builder.addSegment("medianAD", a, d);
  builder.addSegment("medianBE", b, e);
  builder.addSegment("medianCF", c, f);
  builder.addEqualLengths(["centroidBD", "centroidDC"]);
  builder.addEqualLengths(["centroidAF", "centroidFB"], 2);
  builder.addEqualLengths(["centroidCE", "centroidEA"], 3);
  return builder.build();
}

function compileThales(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, dLabel, eLabel] = requireLabels(intent, 5);
  const builder = createBuilder(intent, { minX: -1, minY: -1, width: 8, height: 7 });
  const a = builder.addPoint(vertex("thalesA", 2.8, 5, aLabel!, "TOP"));
  const b = builder.addPoint(vertex("thalesB", 0, 0, bLabel!, "BOTTOM_LEFT"));
  const c = builder.addPoint(vertex("thalesC", 6, 0, cLabel!, "BOTTOM_RIGHT"));
  const d = builder.addPoint(vertex("thalesD", 1.4, 2.5, dLabel!, "LEFT"));
  const e = builder.addPoint(vertex("thalesE", 4.4, 2.5, eLabel!, "RIGHT"));
  builder.addSegment("thalesAB", a, b);
  builder.addSegment("thalesBC", b, c);
  builder.addSegment("thalesCA", c, a);
  builder.addSegment("thalesDE", d, e);
  builder.addParallels(["thalesDE", "thalesBC"]);
  addMeasures(builder, intent, new Map([
    [segmentKey(aLabel!, bLabel!), "thalesAB"],
    [segmentKey(bLabel!, cLabel!), "thalesBC"],
    [segmentKey(cLabel!, aLabel!), "thalesCA"],
    [segmentKey(dLabel!, eLabel!), "thalesDE"],
  ]), a);
  return builder.build();
}

function compileRightTriangleAltitude(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, dLabel] = requireLabels(intent, 4);
  const builder = createBuilder(intent, { minX: -1, minY: -1, width: 8, height: 7 });
  const a = builder.addPoint(vertex("altitudeA", 0, 0, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("altitudeB", 0, 5, bLabel!, "TOP_LEFT"));
  const c = builder.addPoint(vertex("altitudeC", 6, 0, cLabel!, "BOTTOM_RIGHT"));
  const projection = projectPointToLine({ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 6, y: 0 });
  const d = builder.addPoint(vertex("altitudeD", projection.x, projection.y, dLabel!, "TOP_RIGHT"));
  builder.addSegment("altitudeAB", a, b);
  builder.addSegment("altitudeBC", b, c);
  builder.addSegment("altitudeCA", c, a);
  builder.addSegment("altitudeAD", a, d);
  builder.addRightAngle(a, b, c);
  builder.addRightAngle(d, a, b);
  addMeasures(builder, intent, new Map([
    [segmentKey(aLabel!, bLabel!), "altitudeAB"],
    [segmentKey(bLabel!, cLabel!), "altitudeBC"],
    [segmentKey(cLabel!, aLabel!), "altitudeCA"],
    [segmentKey(aLabel!, dLabel!), "altitudeAD"],
  ]), a);
  return builder.build();
}

function compileCircleRelations(intent: AdvancedIntent) {
  switch (intent.variant) {
    case "TANGENT":
      return compileTangent(intent);
    case "INTERSECTING_CHORDS":
      return compileIntersectingChords(intent);
    case "CYCLIC_QUADRILATERAL":
      return compileCyclicQuadrilateral(intent);
    case "INCIRCLE":
      return compileIncircle(intent);
    case "CIRCUMCIRCLE":
      return compileCircumcircle(intent);
    case "CENTRAL_INSCRIBED_ANGLES":
      return compileCentralAndInscribedAngles(intent);
    case "TWO_CIRCLES":
      return compileTwoCircles(intent);
    default:
      throw new Error(`CIRCLE_RELATIONS does not support ${intent.variant}.`);
  }
}

function compileCentralAndInscribedAngles(intent: AdvancedIntent) {
  const [oLabel, aLabel, bLabel, cLabel] = requireLabels(intent, 4);
  const builder = createBuilder(intent, { minX: -4, minY: -4, width: 8, height: 8.4 });
  const o = builder.addPoint(center("circleAnglesO", 0, 0, oLabel!));
  const aCoordinate = pointOnCircle(3, -40);
  const bCoordinate = pointOnCircle(3, 40);
  const cCoordinate = pointOnCircle(3, 180);
  const a = builder.addPoint(vertex("circleAnglesA", aCoordinate.x, aCoordinate.y, aLabel!, "BOTTOM_RIGHT"));
  const b = builder.addPoint(vertex("circleAnglesB", bCoordinate.x, bCoordinate.y, bLabel!, "TOP_RIGHT"));
  const c = builder.addPoint(vertex("circleAnglesC", cCoordinate.x, cCoordinate.y, cLabel!, "LEFT"));
  builder.addCircle("circleAnglesCircle", o, 3);
  builder.addSegment("circleAnglesOA", o, a);
  builder.addSegment("circleAnglesOB", o, b);
  builder.addSegment("circleAnglesCA", c, a);
  builder.addSegment("circleAnglesCB", c, b);
  builder.addAngle(
    o,
    a,
    b,
    intent.measures.find((measure) => measure.target === "CENTRAL")?.text ?? null,
  );
  builder.addAngle(
    c,
    a,
    b,
    intent.measures.find((measure) => measure.target === "INSCRIBED")?.text ?? null,
  );
  return builder.build();
}

function compileTwoCircles(intent: AdvancedIntent) {
  const [oLabel, iLabel, aLabel, bLabel] = requireLabels(intent, 4);
  const builder = createBuilder(intent, { minX: -6, minY: -4, width: 12, height: 8.4 });
  const o = builder.addPoint(center("twoCirclesO", -2, 0, oLabel!));
  const i = builder.addPoint(center("twoCirclesI", 2, 0, iLabel!));
  const intersectionY = Math.sqrt(5);
  const a = builder.addPoint(vertex("twoCirclesA", 0, intersectionY, aLabel!, "TOP"));
  const b = builder.addPoint(vertex("twoCirclesB", 0, -intersectionY, bLabel!, "BOTTOM"));
  builder.addCircle("twoCirclesFirst", o, 3);
  builder.addCircle("twoCirclesSecond", i, 3);
  builder.addSegment("twoCirclesCenters", o, i);
  builder.addSegment("twoCirclesOA", o, a);
  builder.addSegment("twoCirclesIA", i, a);
  builder.addSegment("twoCirclesOB", o, b);
  builder.addSegment("twoCirclesIB", i, b);
  return builder.build();
}

function compileTangent(intent: AdvancedIntent) {
  if (/hai\s+tiếp\s+tuyến|tiếp\s+tuyến\s+cắt\s+nhau/iu.test(intent.caption ?? "")) {
    return compileTwoTangents(intent);
  }
  const [oLabel, aLabel, bLabel, cLabel] = requireLabels(intent, 4);
  const builder = createBuilder(intent, { minX: -4, minY: -4, width: 9, height: 8 });
  const o = builder.addPoint(center("tangentO", 0, 0, oLabel!));
  const a = builder.addPoint(vertex("tangentA", 3, 0, aLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("tangentB", 3, 3.2, bLabel!, "TOP_RIGHT"));
  const c = builder.addPoint(vertex("tangentC", 3, -3.2, cLabel!, "BOTTOM_RIGHT"));
  builder.addCircle("tangentCircle", o, 3);
  builder.addSegment("tangentRadius", o, a);
  builder.addLine("tangentLine", c, b);
  builder.addRightAngle(a, o, b);
  addMeasures(builder, intent, new Map([[segmentKey(oLabel!, aLabel!), "tangentRadius"]]), o);
  return builder.build();
}

function compileTwoTangents(intent: AdvancedIntent) {
  const labels = requireLabels(intent, 4);
  const oLabel = labels.find((label) => label === "O") ?? labels[0]!;
  const mLabel = labels.find((label) => label === "M") ?? labels[1]!;
  const tangentLabels = labels.filter((label) => label !== oLabel && label !== mLabel);
  const [aLabel, bLabel] = tangentLabels;
  if (!aLabel || !bLabel) {
    throw new Error("Two-tangent construction requires a center, an external point, and two tangent points.");
  }
  const values = measureValues(intent);
  const measuredRadius = values.get(segmentKey(oLabel, aLabel));
  const measuredCenterDistance = values.get(segmentKey(oLabel, mLabel));
  const radius = 3;
  const externalDistance =
    measuredRadius &&
    measuredCenterDistance &&
    measuredCenterDistance > measuredRadius
      ? Math.min(7.8, Math.max(4.8, (radius * measuredCenterDistance) / measuredRadius))
      : 5.4;
  const tangentX = (radius * radius) / externalDistance;
  const tangentY = Math.sqrt(radius * radius - tangentX * tangentX);
  const builder = createBuilder(intent, {
    minX: -4,
    minY: -4,
    width: externalDistance + 5.2,
    height: 8,
  });
  const o = builder.addPoint(center("twoTangentsO", 0, 0, oLabel));
  const m = builder.addPoint(
    vertex("twoTangentsM", externalDistance, 0, mLabel, "RIGHT"),
  );
  const a = builder.addPoint(
    vertex("twoTangentsA", tangentX, tangentY, aLabel, "TOP_RIGHT"),
  );
  const b = builder.addPoint(
    vertex("twoTangentsB", tangentX, -tangentY, bLabel, "BOTTOM_RIGHT"),
  );
  builder.addCircle("twoTangentsCircle", o, radius);
  builder.addSegment("twoTangentsOA", o, a);
  builder.addSegment("twoTangentsOB", o, b);
  builder.addSegment("twoTangentsOM", o, m);
  builder.addSegment("twoTangentsMA", m, a);
  builder.addSegment("twoTangentsMB", m, b);
  builder.addRightAngle(a, o, m);
  builder.addRightAngle(b, o, m);
  builder.addEqualLengths(["twoTangentsMA", "twoTangentsMB"]);
  addMeasures(
    builder,
    intent,
    new Map([
      [segmentKey(oLabel, aLabel), "twoTangentsOA"],
      [segmentKey(oLabel, bLabel), "twoTangentsOB"],
      [segmentKey(oLabel, mLabel), "twoTangentsOM"],
      [segmentKey(mLabel, aLabel), "twoTangentsMA"],
      [segmentKey(mLabel, bLabel), "twoTangentsMB"],
    ]),
    o,
    new Map([
      ["twoTangentsOA", "TOP_LEFT"],
      ["twoTangentsOB", "BOTTOM_LEFT"],
      ["twoTangentsOM", "BOTTOM"],
      ["twoTangentsMA", "TOP_RIGHT"],
      ["twoTangentsMB", "BOTTOM_RIGHT"],
    ]),
  );
  return builder.build();
}

function compileIntersectingChords(intent: AdvancedIntent) {
  const [oLabel, aLabel, bLabel, cLabel, dLabel, iLabel] = requireLabels(intent, 6);
  const builder = createBuilder(intent, { minX: -4, minY: -4, width: 8, height: 8.4 });
  const o = builder.addPoint(center("chordsO", 0, 0, oLabel!));
  const aCoordinate = pointOnCircle(3, 160);
  const bCoordinate = pointOnCircle(3, -60);
  const cCoordinate = pointOnCircle(3, -130);
  const dCoordinate = pointOnCircle(3, 30);
  const a = builder.addPoint(
    vertex("chordsA", aCoordinate.x, aCoordinate.y, aLabel!, "TOP_LEFT"),
  );
  const b = builder.addPoint(
    vertex("chordsB", bCoordinate.x, bCoordinate.y, bLabel!, "BOTTOM_RIGHT"),
  );
  const c = builder.addPoint(
    vertex("chordsC", cCoordinate.x, cCoordinate.y, cLabel!, "BOTTOM_LEFT"),
  );
  const d = builder.addPoint(
    vertex("chordsD", dCoordinate.x, dCoordinate.y, dLabel!, "TOP_RIGHT"),
  );
  const intersection = lineIntersection(
    aCoordinate,
    bCoordinate,
    cCoordinate,
    dCoordinate,
  );
  builder.addPoint(center("chordsI", intersection.x, intersection.y, iLabel!));
  builder.addCircle("chordsCircle", o, 3);
  builder.addSegment("chordAB", a, b);
  builder.addSegment("chordCD", c, d);
  return builder.build();
}

function compileCyclicQuadrilateral(intent: AdvancedIntent) {
  const [oLabel, aLabel, bLabel, cLabel, dLabel] = requireLabels(intent, 5);
  const builder = createBuilder(intent, { minX: -4, minY: -4, width: 8, height: 8.4 });
  const o = builder.addPoint(center("cyclicO", 0, 0, oLabel!));
  const coordinates = [
    [-2.7, 1.3],
    [1.1, 2.8],
    [2.7, -1.3],
    [-1.1, -2.8],
  ] as const;
  const labels = [aLabel!, bLabel!, cLabel!, dLabel!];
  const points = coordinates.map(([x, y], index) =>
    builder.addPoint(vertex(`cyclicPoint${index}`, x, y, labels[index]!, index < 2 ? "TOP" : "BOTTOM")),
  );
  builder.addCircle("cyclicCircle", o, 3);
  for (let index = 0; index < points.length; index += 1) {
    builder.addSegment(
      `cyclicSide${index}`,
      points[index]!,
      points[(index + 1) % points.length]!,
    );
  }
  return builder.build();
}

function compileIncircle(intent: AdvancedIntent) {
  const [aLabel, bLabel, cLabel, iLabel] = requireLabels(intent, 4);
  const builder = createBuilder(intent, { minX: -1, minY: -1, width: 8, height: 7 });
  const a = builder.addPoint(vertex("incircleA", 3, 5, aLabel!, "TOP"));
  const b = builder.addPoint(vertex("incircleB", 0, 0, bLabel!, "BOTTOM_LEFT"));
  const c = builder.addPoint(vertex("incircleC", 6, 0, cLabel!, "BOTTOM_RIGHT"));
  const inradius = 15 / (3 + Math.sqrt(34));
  const centerPoint = builder.addPoint(center("incircleI", 3, inradius, iLabel!));
  builder.addSegment("incircleAB", a, b);
  builder.addSegment("incircleBC", b, c);
  builder.addSegment("incircleCA", c, a);
  builder.addCircle("incircle", centerPoint, inradius);
  return builder.build();
}

function compileCircumcircle(intent: AdvancedIntent) {
  const [oLabel, aLabel, bLabel, cLabel] = requireLabels(intent, 4);
  const builder = createBuilder(intent, { minX: -4, minY: -4, width: 8, height: 8.4 });
  const o = builder.addPoint(center("circumcircleO", 0, 0, oLabel!));
  const a = builder.addPoint(vertex("circumcircleA", 0, 3, aLabel!, "TOP"));
  const b = builder.addPoint(vertex("circumcircleB", -2.6, -1.5, bLabel!, "BOTTOM_LEFT"));
  const c = builder.addPoint(vertex("circumcircleC", 2.6, -1.5, cLabel!, "BOTTOM_RIGHT"));
  builder.addCircle("circumcircle", o, 3);
  builder.addSegment("circumcircleAB", a, b);
  builder.addSegment("circumcircleBC", b, c);
  builder.addSegment("circumcircleCA", c, a);
  return builder.build();
}

function createBuilder(
  intent: AdvancedIntent,
  viewBox: LessonSummaryDiagramSpec["viewBox"],
) {
  return new DiagramBuilder(viewBox, intent.caption);
}

function addMeasures(
  builder: DiagramBuilder,
  intent: AdvancedIntent,
  edges: Map<string, string>,
  fallbackPointId: string,
  positionByEdge: ReadonlyMap<
    string,
    LessonSummaryDiagramSpec["labels"][number]["position"]
  > = new Map(),
) {
  for (const measure of intent.measures) {
    const edgeId = edges.get(normalizeTarget(measure.target));
    if (!edgeId) continue;
    builder.addLabel({
      text: measure.text,
      anchorPointId: fallbackPointId,
      anchorPrimitiveId: edgeId,
      position: positionByEdge.get(edgeId) ?? "TOP",
    });
  }
}

function requireLabels(intent: AdvancedIntent, count: number) {
  if (intent.pointLabels.length < count) {
    throw new Error(`${intent.archetype}/${intent.variant} requires ${count} point labels.`);
  }
  return canonicalAdvancedPointLabels(intent);
}

export function canonicalAdvancedPointLabels(intent: AdvancedIntent) {
  const preferred = preferredAdvancedPointLabels(intent);
  if (
    preferred &&
    preferred.length === intent.pointLabels.length &&
    preferred.every((label) => intent.pointLabels.includes(label))
  ) {
    return preferred;
  }
  return intent.pointLabels;
}

function preferredAdvancedPointLabels(intent: AdvancedIntent): string[] | null {
  if (intent.archetype === "TRIANGLE_CENTROID") {
    return ["A", "B", "C", "D", "E", "F", "G"];
  }
  if (intent.archetype === "TRIANGLE_CONCURRENCY") {
    if (intent.variant === "ANGLE_BISECTORS") return ["A", "B", "C", "I"];
    if (intent.variant === "PERPENDICULAR_BISECTORS") {
      return ["A", "B", "C", "D", "E", "F", "O"];
    }
    return ["A", "B", "C", "D", "E", "F", "H"];
  }
  if (intent.archetype === "THALES") return ["A", "B", "C", "D", "E"];
  if (intent.archetype === "RIGHT_TRIANGLE_ALTITUDE") {
    return ["A", "B", "C", "H"];
  }
  if (intent.archetype === "TRIANGLE_SIMILARITY") {
    return ["A", "B", "C", "D", "E", "F"];
  }
  if (intent.variant === "INTERSECTING_CHORDS") {
    return ["O", "A", "B", "C", "D", "I"];
  }
  if (intent.variant === "CYCLIC_QUADRILATERAL") {
    return ["O", "A", "B", "C", "D"];
  }
  if (intent.variant === "INCIRCLE") return ["A", "B", "C", "I"];
  if (intent.variant === "TWO_CIRCLES") return ["O", "I", "A", "B"];
  if (
    intent.variant === "TANGENT" ||
    intent.variant === "CIRCUMCIRCLE" ||
    intent.variant === "CENTRAL_INSCRIBED_ANGLES"
  ) {
    return ["O", "A", "B", "C"];
  }
  return null;
}

function segmentKey(first: string, second: string) {
  return normalizeTarget(`${first}${second}`);
}

function normalizeTarget(value: string) {
  return [...value].sort().join("");
}

function vertex(
  id: string,
  x: number,
  y: number,
  label: string,
  labelPosition: "TOP" | "TOP_RIGHT" | "RIGHT" | "BOTTOM_RIGHT" | "BOTTOM" | "BOTTOM_LEFT" | "LEFT" | "TOP_LEFT",
) {
  return { id, x, y, label, pointStyle: "NONE" as const, labelPosition };
}

function center(id: string, x: number, y: number, label: string) {
  return {
    id,
    x,
    y,
    label,
    pointStyle: "FILLED" as const,
    labelPosition: "BOTTOM_RIGHT" as const,
  };
}

function projectPointToLine(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ratio = ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy);
  return { x: from.x + ratio * dx, y: from.y + ratio * dy };
}

function lineIntersection(
  firstFrom: { x: number; y: number },
  firstTo: { x: number; y: number },
  secondFrom: { x: number; y: number },
  secondTo: { x: number; y: number },
) {
  const denominator =
    (firstFrom.x - firstTo.x) * (secondFrom.y - secondTo.y) -
    (firstFrom.y - firstTo.y) * (secondFrom.x - secondTo.x);
  if (Math.abs(denominator) <= 1e-12) throw new Error("Chords must intersect.");
  const determinantA = firstFrom.x * firstTo.y - firstFrom.y * firstTo.x;
  const determinantB = secondFrom.x * secondTo.y - secondFrom.y * secondTo.x;
  return {
    x:
      (determinantA * (secondFrom.x - secondTo.x) -
        (firstFrom.x - firstTo.x) * determinantB) /
      denominator,
    y:
      (determinantA * (secondFrom.y - secondTo.y) -
        (firstFrom.y - firstTo.y) * determinantB) /
      denominator,
  };
}

function pointOnCircle(radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function pointDistance(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function triangleCircumcenter(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const denominator =
    2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(denominator) <= 1e-12) {
    throw new Error("A circumcenter requires three non-collinear points.");
  }
  return {
    x:
      ((a.x * a.x + a.y * a.y) * (b.y - c.y) +
        (b.x * b.x + b.y * b.y) * (c.y - a.y) +
        (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
      denominator,
    y:
      ((a.x * a.x + a.y * a.y) * (c.x - b.x) +
        (b.x * b.x + b.y * b.y) * (a.x - c.x) +
        (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
      denominator,
  };
}
