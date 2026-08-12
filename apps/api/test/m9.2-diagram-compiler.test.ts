import { lessonSummaryDiagramSpecSchema } from "@learning-path/shared";
import { describe, expect, it } from "vitest";

import {
  lessonSummaryProviderDiagramInputSchema,
  mapLessonSummaryProviderDiagramInput,
} from "#api/modules/ai/types/lesson-summary-provider-diagram.types";
import {
  compileLessonSummaryDiagramIntent,
  compileLessonSummaryDiagramIntentWithDiagnostics,
} from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

const base = {
  intentVersion: 1 as const,
  grade: 7,
  difficulty: "MEDIUM" as const,
  caption: null,
};

const cases: Array<{ name: string; input: unknown; expectedKey: string }> = [
  {
    name: "multiplication array",
    expectedKey: "elementary.multiplication-array.v1",
    input: {
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "ELEMENTARY_MODEL",
      archetype: "MULTIPLICATION_ARRAY",
      rows: 4,
      columns: 6,
      rowLabel: "4 hàng",
      columnLabel: "6 cột",
    },
  },
  {
    name: "fraction model",
    expectedKey: "elementary.fraction-model.v1",
    input: {
      ...base,
      grade: 5,
      family: "ELEMENTARY_MODEL",
      archetype: "FRACTION_MODEL",
      numerator: 3,
      denominator: 5,
      shape: "CIRCLE",
      fractionLabel: "3/5",
    },
  },
  {
    name: "coordinate points with projections",
    expectedKey: "coordinate.points.v1",
    input: {
      ...base,
      family: "NUMBER_COORDINATE",
      archetype: "COORDINATE_POINTS",
      xMin: -4,
      xMax: 5,
      yMin: -4,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      points: [
        { id: "A", label: "A", x: 1, y: 3, showProjections: true },
        { id: "B", label: "B", x: 3, y: -1, showProjections: true },
      ],
    },
  },
  {
    name: "closed-open interval",
    expectedKey: "coordinate.interval.v1",
    input: {
      ...base,
      family: "NUMBER_COORDINATE",
      archetype: "INTERVAL",
      min: -5,
      max: 5,
      step: 1,
      left: -2,
      right: 3,
      leftClosed: true,
      rightClosed: false,
      intervalLabel: null,
    },
  },
  {
    name: "quadratic graph",
    expectedKey: "graph.quadratic.v1",
    input: {
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ALGEBRA_GRAPH",
      archetype: "QUADRATIC_FUNCTION",
      xMin: -4,
      xMax: 4,
      yMin: -5,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "QUADRATIC",
          id: "parabola",
          label: "y = x² - 4",
          a: 1,
          b: 0,
          c: -4,
          constructionXs: [-2, -1, 0, 1, 2],
        },
      ],
    },
  },
  {
    name: "quadratic graph comparison",
    expectedKey: "graph.quadratic.v1",
    input: {
      ...base,
      grade: 9,
      difficulty: "MEDIUM",
      family: "ALGEBRA_GRAPH",
      archetype: "QUADRATIC_FUNCTION",
      xMin: -3,
      xMax: 3,
      yMin: -5,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "QUADRATIC",
          id: "upwardParabola",
          label: "y = x²",
          a: 1,
          b: 0,
          c: 0,
          constructionXs: [-2, -1, 0, 1, 2],
        },
        {
          kind: "QUADRATIC",
          id: "downwardParabola",
          label: "y = -x²",
          a: -1,
          b: 0,
          c: 0,
          constructionXs: [-2, -1, 0, 1, 2],
        },
      ],
    },
  },
  {
    name: "value table",
    expectedKey: "data.value-table.v1",
    input: {
      ...base,
      family: "DATA_STATISTICS",
      archetype: "VALUE_TABLE",
      columns: ["x", "-1", "0", "1"],
      rows: [["y", "1", "0", "1"]],
    },
  },
  {
    name: "clock",
    expectedKey: "data.clock.v1",
    input: {
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "DATA_STATISTICS",
      archetype: "CLOCK",
      hour: 3,
      minute: 30,
    },
  },
  {
    name: "right triangle",
    expectedKey: "geometry.triangle.v1",
    input: {
      ...base,
      family: "PLANE_GEOMETRY",
      archetype: "TRIANGLE",
      variant: "RIGHT",
      pointLabels: ["A", "B", "C"],
      measures: [
        { target: "AB", text: "3 cm" },
        { target: "BC", text: "4 cm" },
      ],
    },
  },
  {
    name: "circle sector with a named central-angle target",
    expectedKey: "geometry.circle-parts.v1",
    input: {
      ...base,
      grade: 9,
      family: "PLANE_GEOMETRY",
      archetype: "CIRCLE_PARTS",
      variant: "ARC_SECTOR",
      pointLabels: ["O", "A", "B"],
      measures: [{ target: "∠AOB", text: "80°" }],
    },
  },
  {
    name: "right triangle altitude",
    expectedKey: "geometry.right-triangle-altitude.v1",
    input: {
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_ALTITUDE",
      variant: "ALTITUDE_TO_HYPOTENUSE",
      pointLabels: ["A", "B", "C", "H"],
      measures: [],
    },
  },
  {
    name: "intersecting chords",
    expectedKey: "geometry.circle-relations.v1",
    input: {
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "CIRCLE_RELATIONS",
      variant: "INTERSECTING_CHORDS",
      pointLabels: ["O", "A", "B", "C", "D", "I"],
      measures: [],
    },
  },
  {
    name: "cylinder",
    expectedKey: "spatial.cylinder.v1",
    input: {
      ...base,
      grade: 9,
      family: "SPATIAL_APPLIED",
      archetype: "CYLINDER",
      variant: "CYLINDER",
      pointLabels: ["O", "O′", "A"],
      dimensions: [
        { target: "radius", value: 3, unit: "cm" },
        { target: "height", value: 5, unit: "cm" },
      ],
    },
  },
  {
    name: "Venn diagram",
    expectedKey: "schematic.venn.v1",
    input: {
      ...base,
      grade: 6,
      family: "SET_SCHEMATIC",
      archetype: "VENN",
      nodes: [
        { id: "n1", label: "2", group: "A" },
        { id: "n2", label: "3", group: "B" },
      ],
      edges: [],
      setLabels: ["A", "B"],
    },
  },
  {
    name: "probability tree",
    expectedKey: "schematic.tree.v1",
    input: {
      ...base,
      grade: 8,
      difficulty: "HARD",
      family: "SET_SCHEMATIC",
      archetype: "TREE",
      nodes: [
        { id: "root", label: "Bắt đầu", group: null },
        { id: "heads", label: "Ngửa", group: null },
        { id: "tails", label: "Sấp", group: null },
      ],
      edges: [
        { from: "root", to: "heads", label: "1/2" },
        { from: "root", to: "tails", label: "1/2" },
      ],
      setLabels: [],
    },
  },
  {
    name: "two separate right triangles for the hypotenuse-leg theorem",
    expectedKey: "geometry.right-triangle-congruence.v1",
    input: {
      ...base,
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "HYPOTENUSE_LEG",
      pointLabels: ["A", "B", "C", "A′", "B′", "C′"],
      measures: [],
      caption: "Cạnh huyền và một cạnh góc vuông tương ứng bằng nhau",
    },
  },
  {
    name: "Bài 15 shared-hypotenuse congruent right triangles",
    expectedKey: "geometry.right-triangle-congruence.v1",
    input: {
      ...base,
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "SHARED_HYPOTENUSE_LEG",
      pointLabels: ["A", "B", "C", "D"],
      measures: [],
      caption: "Hai tam giác vuông chung cạnh huyền AC",
    },
  },
];

describe("M9.2 deterministic math diagram compiler", () => {
  for (const testCase of cases) {
    it(`compiles ${testCase.name} into a valid diagramSpec`, () => {
      const result = compileLessonSummaryDiagramIntent(testCase.input);
      expect(result.diagnostics.compilerKey).toBe(testCase.expectedKey);
      expect(lessonSummaryDiagramSpecSchema.safeParse(result.spec).success).toBe(true);
      expect(result.spec.points.length).toBeGreaterThan(1);
      expect(result.spec.primitives.length).toBeGreaterThan(0);
      expect(new Set(result.spec.points.map((point) => point.id)).size).toBe(
        result.spec.points.length,
      );
    });
  }

  it("turns live right-triangle equalities into markers instead of duplicate text", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "TWO_LEGS",
      pointLabels: ["A", "B", "C", "A′", "B′", "C′"],
      measures: [
        { target: "AB", text: "AB = A′B′" },
        { target: "AC", text: "AC = A′C′" },
      ],
      caption: "Hai cặp cạnh góc vuông tương ứng bằng nhau",
    });
    expect(
      result.spec.markers.filter((marker) => marker.type === "EQUAL_LENGTH"),
    ).toHaveLength(2);
    expect(result.spec.labels).toEqual([]);
  });

  it("treats a four-point hypotenuse-leg intent as two right triangles sharing one hypotenuse", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "HYPOTENUSE_LEG",
      pointLabels: ["A", "B", "C", "D"],
      measures: [
        { target: "AB", text: "=" },
        { target: "AD", text: "=" },
      ],
      caption: "Hai tam giác vuông có chung cạnh huyền",
    });

    expect(compiled.spec.points.map((point) => point.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(compiled.spec.primitives.map((primitive) => primitive.id)).toEqual(
      expect.arrayContaining([
        "sharedAB",
        "sharedBC",
        "sharedAC",
        "sharedAD",
        "sharedDC",
      ]),
    );
    expect(
      compiled.spec.markers.filter((marker) => marker.type === "RIGHT_ANGLE"),
    ).toHaveLength(2);
    expect(
      compiled.spec.markers.filter((marker) => marker.type === "EQUAL_LENGTH"),
    ).toHaveLength(1);
    expect(compiled.semanticIssues).toEqual([]);
  });

  it("keeps only the numeric value when a segment measure repeats its name", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "HYPOTENUSE_LEG",
      pointLabels: ["A", "B", "C", "A′", "B′", "C′"],
      measures: [{ target: "BC", text: "BC = 5 cm" }],
      caption: "Cạnh huyền và một cạnh góc vuông",
    });
    expect(result.spec.labels.map((label) => label.text)).toEqual(["5 cm"]);
  });

  it("omits a composite optional measure instead of rejecting two right triangles", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "TWO_LEGS",
      pointLabels: ["A", "B", "C", "D", "E", "F"],
      measures: [
        { target: "AB = DE", text: "4 cm" },
        { target: "AC = DF", text: "3 cm" },
      ],
      caption: "Hai tam giác vuông có hai cạnh góc vuông tương ứng bằng nhau",
    });

    expect(result.spec.labels).toEqual([]);
    expect(result.spec.primitives.length).toBeGreaterThan(0);
    expect(result.spec.markers.some((marker) => marker.type === "EQUAL_LENGTH")).toBe(
      true,
    );
    expect(lessonSummaryDiagramSpecSchema.safeParse(result.spec).success).toBe(true);
  });

  it("keeps primary-school named quadrilaterals free of inferred property markers", () => {
    for (const variant of ["PARALLELOGRAM", "RHOMBUS", "SQUARE"] as const) {
      const result = compileLessonSummaryDiagramIntent({
        ...base,
        grade: 4,
        difficulty: "HARD",
        family: "PLANE_GEOMETRY",
        archetype: "QUADRILATERAL",
        variant,
        pointLabels: ["A", "B", "C", "D"],
        measures: [],
        caption: `Hình ${variant}`,
      });
      expect(result.spec.markers).toEqual([]);
    }
  });

  it("draws an explicitly declared primary-school right trapezoid with markers instead of 90-degree text", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 5,
      difficulty: "MEDIUM",
      family: "PLANE_GEOMETRY",
      archetype: "QUADRILATERAL",
      variant: "TRAPEZOID",
      pointLabels: ["A", "B", "C", "D"],
      measures: [
        { target: "AB", text: "đáy" },
        { target: "DC", text: "đáy" },
        { target: "A", text: "90°" },
        { target: "D", text: "90°" },
      ],
      caption: "Hình thang vuông ABCD",
    });

    expect(result.spec.markers).toEqual([
      expect.objectContaining({ type: "RIGHT_ANGLE", vertex: "quadrilateralPoint0" }),
      expect.objectContaining({ type: "RIGHT_ANGLE", vertex: "quadrilateralPoint3" }),
    ]);
    expect(result.spec.labels.map((label) => label.text)).toEqual(["đáy", "đáy"]);
    expect(result.spec.labels.map((label) => label.anchorPrimitiveId)).toEqual([
      "quadrilateralSide0",
      "quadrilateralSide2",
    ]);
    const [a, d] = ["A", "D"].map((label) =>
      result.spec.points.find((point) => point.label === label),
    );
    expect(a?.x).toBe(d?.x);
  });

  it("retains conventional property markers for secondary-school quadrilaterals", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "MEDIUM",
      family: "PLANE_GEOMETRY",
      archetype: "QUADRILATERAL",
      variant: "PARALLELOGRAM",
      pointLabels: ["A", "B", "C", "D"],
      measures: [],
      caption: "Hình bình hành ABCD",
    });
    expect(result.spec.markers).toHaveLength(2);
    expect(result.spec.markers.every((marker) => marker.type === "PARALLEL")).toBe(true);
  });

  it("supports acute and obtuse triangle variants used by area lessons", () => {
    for (const variant of ["ACUTE", "OBTUSE"] as const) {
      const result = compileLessonSummaryDiagramIntent({
        ...base,
        grade: 5,
        difficulty: "SIMPLE",
        family: "PLANE_GEOMETRY",
        archetype: "TRIANGLE",
        variant,
        pointLabels: ["A", "B", "C"],
        measures: [],
        caption: `Tam giác ${variant}`,
      });
      expect(result.spec.points.filter((point) => point.label)).toHaveLength(3);
      if (variant === "OBTUSE") {
        const [a, b, c] = ["A", "B", "C"].map((id) =>
          result.spec.points.find((point) => point.id === id),
        );
        expect(a && b && c).toBeTruthy();
        expect(
          (a!.x - b!.x) * (c!.x - b!.x) + (a!.y - b!.y) * (c!.y - b!.y),
        ).toBeLessThan(0);
      }
    }
  });

  it("infers the named circle center independently of provider point order", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 5,
      difficulty: "HARD",
      family: "PLANE_GEOMETRY",
      archetype: "CIRCLE_PARTS",
      variant: "RADIUS_DIAMETER_CHORD",
      pointLabels: ["A", "B", "O"],
      measures: [
        { target: "OA", text: "r" },
        { target: "AB", text: "d" },
      ],
      caption: "Đường tròn tâm O với bán kính OA và đường kính AB",
    });

    const center = result.spec.points.find((point) => point.id === "circleCenter");
    const a = result.spec.points.find((point) => point.label === "A");
    const b = result.spec.points.find((point) => point.label === "B");
    expect(center).toEqual(expect.objectContaining({ label: "O", pointStyle: "FILLED" }));
    expect(a?.x).toBe(-b!.x);
    expect(a?.y).toBeCloseTo(-b!.y);
    expect(result.spec.labels.map((label) => label.text)).toEqual(["r", "d"]);
    const segments = result.spec.primitives.filter(
      (primitive) => primitive.type === "SEGMENT",
    );
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.id)).toEqual([
      "circleDiameter",
      "circleMeasuredRadius0",
    ]);
    expect(result.spec.labels.map((label) => label.anchorPrimitiveId)).toEqual([
      "circleMeasuredRadius0",
      "circleDiameter",
    ]);
  });

  it("does not invent a universe and places non-members outside the Venn set", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      difficulty: "SIMPLE",
      family: "SET_SCHEMATIC",
      archetype: "VENN_UNIVERSE",
      nodes: [
        { id: "n4", label: "4", group: "M" },
        { id: "n1", label: "1", group: "M" },
        { id: "n9", label: "9", group: "M" },
        { id: "n8", label: "8", group: "M" },
        { id: "n7", label: "7", group: null },
      ],
      edges: [],
      setLabels: ["M"],
      caption: "Các phần tử của tập hợp M",
    });

    expect(result.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["M", "4", "1", "9", "8", "7"]),
    );
    expect(result.spec.labels.map((label) => label.text)).not.toContain("U");
    expect(result.spec.primitives).not.toContainEqual(
      expect.objectContaining({ id: "vennUniverse" }),
    );
    const labelSeven = result.spec.labels.find((label) => label.text === "7")!;
    const sevenAnchor = result.spec.points.find(
      (point) => point.id === labelSeven.anchorPointId,
    )!;
    expect(sevenAnchor.x).toBeGreaterThan(3);
    expect(sevenAnchor.y).toBeGreaterThan(2);
    const labelFour = result.spec.labels.find((label) => label.text === "4")!;
    const fourAnchor = result.spec.points.find(
      (point) => point.id === labelFour.anchorPointId,
    )!;
    expect(Math.hypot(fourAnchor.x, fourAnchor.y)).toBeLessThan(2);
  });

  it("keeps primary-school named triangle types free of inferred markers", () => {
    for (const variant of ["RIGHT", "ISOSCELES", "EQUILATERAL"] as const) {
      const result = compileLessonSummaryDiagramIntent({
        ...base,
        grade: 5,
        difficulty: "SIMPLE",
        family: "PLANE_GEOMETRY",
        archetype: "TRIANGLE",
        variant,
        pointLabels: ["A", "B", "C"],
        measures: [],
        caption: `Tam giác ${variant}`,
      });
      expect(result.spec.markers).toEqual([]);
    }
  });

  it("constructs and labels a triangle altitude from a fourth point", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 5,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "TRIANGLE",
      variant: "ACUTE",
      pointLabels: ["A", "B", "C", "H"],
      measures: [
        { target: "BC", text: "4 cm" },
        { target: "AH", text: "3 cm" },
      ],
      caption: "Tam giác có đáy 4 cm và chiều cao 3 cm",
    });
    expect(result.spec.points.map((point) => point.label)).toEqual(["A", "B", "C", "H"]);
    expect(result.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "altitudeAH", type: "SEGMENT" }),
    );
    expect(result.spec.markers).toContainEqual(
      expect.objectContaining({ type: "RIGHT_ANGLE", vertex: "H" }),
    );
    expect(result.spec.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "4 cm", anchorPrimitiveId: "sideBC" }),
        expect.objectContaining({ text: "3 cm", anchorPrimitiveId: "altitudeAH" }),
      ]),
    );
  });

  it("compiles a three-point perpendicular construction as a right triangle", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "PERPENDICULAR",
      pointLabels: ["A", "B", "C"],
      measures: [
        { target: "AB", text: "AB = 3 cm" },
        { target: "BC", text: "BC = 5 cm" },
      ],
      caption: "Dựng tam giác vuông từ một cạnh góc vuông và cạnh huyền",
    });
    expect(result.spec.points.map((point) => point.label)).toEqual(["A", "B", "C"]);
    expect(
      result.spec.primitives.filter((primitive) => primitive.type === "SEGMENT"),
    ).toHaveLength(3);
    expect(result.spec.primitives.some((primitive) => primitive.type === "ARC")).toBe(
      true,
    );
    expect(result.spec.markers.some((marker) => marker.type === "RIGHT_ANGLE")).toBe(
      true,
    );
    expect(result.spec.labels.map((label) => label.text)).toEqual(["3 cm", "5 cm"]);
  });

  it("compiles a two-point distance from a point to a line", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "PERPENDICULAR",
      pointLabels: ["O", "H"],
      measures: [{ target: "OH", text: "4 cm" }],
      caption: "Khoảng cách từ O đến a bằng 4 cm",
    });

    expect(result.spec.points.map((point) => point.label).filter(Boolean)).toEqual([
      "O",
      "H",
    ]);
    expect(result.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "distanceLine", type: "LINE" }),
        expect.objectContaining({ id: "distancePerpendicular", type: "SEGMENT" }),
      ]),
    );
    expect(result.spec.markers).toContainEqual(
      expect.objectContaining({ type: "RIGHT_ANGLE", vertex: "distanceFoot" }),
    );
    expect(result.spec.labels).toContainEqual(
      expect.objectContaining({
        text: "4 cm",
        anchorPrimitiveId: "distancePerpendicular",
      }),
    );
  });

  it("compiles center radius and perpendicular distance to a line", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "PERPENDICULAR",
      pointLabels: ["O", "H", "A"],
      measures: [
        { target: "OH", text: "d" },
        { target: "OA", text: "R" },
      ],
      caption: "So sánh khoảng cách từ tâm đến đường thẳng với bán kính",
    });

    expect(result.spec.points.map((point) => point.label).filter(Boolean)).toEqual([
      "O",
      "H",
      "A",
    ]);
    expect(result.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "distanceCircle", type: "CIRCLE" }),
        expect.objectContaining({ id: "distanceCircleLine", type: "LINE" }),
        expect.objectContaining({ id: "distanceCircleRadius", type: "SEGMENT" }),
        expect.objectContaining({
          id: "distanceCirclePerpendicular",
          type: "SEGMENT",
        }),
      ]),
    );
    expect(result.spec.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "d",
          anchorPrimitiveId: "distanceCirclePerpendicular",
        }),
        expect.objectContaining({ text: "R", anchorPrimitiveId: "distanceCircleRadius" }),
      ]),
    );
  });

  it("compiles the perpendicular distance between two parallel lines", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "PARALLEL_TRANSVERSAL",
      variant: "GENERAL",
      pointLabels: ["O", "H"],
      measures: [{ target: "OH", text: "6 cm" }],
      caption: "Hai đường thẳng song song cách nhau 6 cm",
    });

    expect(result.spec.points.map((point) => point.label).filter(Boolean)).toEqual([
      "O",
      "H",
    ]);
    expect(
      result.spec.primitives.filter((primitive) => primitive.type === "LINE"),
    ).toHaveLength(2);
    expect(result.spec.primitives).toContainEqual(
      expect.objectContaining({
        id: "parallelDistancePerpendicular",
        type: "SEGMENT",
      }),
    );
    expect(result.spec.markers).toContainEqual(
      expect.objectContaining({
        type: "RIGHT_ANGLE",
        vertex: "parallelDistanceLower",
      }),
    );
    expect(result.spec.markers.some((marker) => marker.type === "PARALLEL")).toBe(false);
    expect(result.spec.labels).toContainEqual(
      expect.objectContaining({
        text: "6 cm",
        anchorPrimitiveId: "parallelDistancePerpendicular",
      }),
    );
  });

  it("deduplicates paired ladder dimensions and anchors them to segments", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "MEDIUM",
      family: "SPATIAL_APPLIED",
      archetype: "APPLIED_RIGHT_TRIANGLE",
      variant: "LADDER",
      pointLabels: ["A", "B", "H", "A′", "B′", "H′"],
      dimensions: [
        { target: "AB", value: 5, unit: "m" },
        { target: "A′B′", value: 5, unit: "m" },
        { target: "BH", value: 4, unit: "m" },
        { target: "B′H′", value: 4, unit: "m" },
      ],
      caption: "Hai chiếc thang dài bằng nhau và đạt cùng độ cao",
    });
    expect(result.spec.points).toHaveLength(6);
    expect(
      result.spec.primitives.filter((primitive) => primitive.type === "SEGMENT"),
    ).toHaveLength(6);
    expect(
      result.spec.markers.filter((marker) => marker.type === "RIGHT_ANGLE"),
    ).toHaveLength(2);
    expect(
      result.spec.markers.filter((marker) => marker.type === "EQUAL_LENGTH"),
    ).toHaveLength(2);
    expect(result.spec.labels.map((label) => label.text)).toEqual(["5 m", "4 m"]);
    expect(result.spec.labels.every((label) => label.anchorPrimitiveId !== null)).toBe(
      true,
    );
  });

  it("anchors Vietnamese cuboid dimensions to the corresponding three edge directions", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      family: "SPATIAL_APPLIED",
      archetype: "CUBOID",
      variant: "RECTANGULAR_PRISM",
      pointLabels: [],
      dimensions: [
        { target: "chiều dài", value: 12, unit: "cm" },
        { target: "chiều rộng", value: 5, unit: "cm" },
        { target: "chiều cao", value: 8, unit: "cm" },
      ],
      caption: "Hình hộp chữ nhật dài 12 cm, rộng 5 cm, cao 8 cm",
    });

    expect(result.spec.labels).toEqual([
      expect.objectContaining({ text: "12 cm", anchorPrimitiveId: "cuboidEdgeAB" }),
      expect.objectContaining({
        text: "5 cm",
        anchorPrimitiveId: "cuboidEdgeAE",
        position: "RIGHT",
      }),
      expect.objectContaining({ text: "8 cm", anchorPrimitiveId: "cuboidEdgeBC" }),
    ]);
    expect(lessonSummaryDiagramSpecSchema.safeParse(result.spec).success).toBe(true);
  });

  it("omits an unknown optional solid dimension without rejecting the solid", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      family: "SPATIAL_APPLIED",
      archetype: "CUBOID",
      variant: "RECTANGULAR_PRISM",
      pointLabels: [],
      dimensions: [{ target: "cạnh chưa xác định", value: 9, unit: "cm" }],
      caption: "Hình hộp chữ nhật",
    });

    expect(result.spec.labels).toEqual([]);
    expect(result.spec.primitives.length).toBeGreaterThan(0);
    expect(lessonSummaryDiagramSpecSchema.safeParse(result.spec).success).toBe(true);
  });

  it("keeps a cube-net edge length anchored to a concrete segment", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      family: "SPATIAL_APPLIED",
      archetype: "NET",
      variant: "CUBE_NET",
      pointLabels: [],
      dimensions: [{ target: "cạnh", value: 4, unit: "cm" }],
      caption: "Hình khai triển của hình lập phương cạnh 4 cm",
    });

    expect(result.spec.labels).toEqual([
      expect.objectContaining({ text: "4 cm", anchorPrimitiveId: "netDimensionEdge" }),
    ]);
    expect(result.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "netDimensionEdge", type: "SEGMENT" }),
    );
    expect(lessonSummaryDiagramSpecSchema.safeParse(result.spec).success).toBe(true);
  });

  it("uses an angle marker instead of long descriptive text in a right triangle", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "TRIANGLE",
      variant: "RIGHT",
      pointLabels: ["A", "B", "C"],
      measures: [
        { target: "AB", text: "cạnh góc vuông" },
        { target: "B", text: "góc nhọn kề" },
      ],
      caption: "Một cạnh góc vuông và góc nhọn kề",
    });
    expect(result.spec.labels).toEqual([]);
    expect(result.spec.markers.map((marker) => marker.type).sort()).toEqual([
      "ANGLE",
      "RIGHT_ANGLE",
    ]);
  });

  it("uses the caption to preserve an acute-angle marker when measures omit it", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "TRIANGLE",
      variant: "RIGHT",
      pointLabels: ["A", "B", "C"],
      measures: [],
      caption: "Minh họa cạnh góc vuông và góc nhọn kề",
    });
    expect(result.spec.markers.map((marker) => marker.type).sort()).toEqual([
      "ANGLE",
      "RIGHT_ANGLE",
    ]);
  });

  it("keeps a named rectangle midpoint and encodes both required equalities", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "HARD",
      family: "PLANE_GEOMETRY",
      archetype: "QUADRILATERAL",
      variant: "RECTANGLE",
      pointLabels: ["A", "B", "C", "D", "M"],
      measures: [{ target: "BC", text: "M là trung điểm của BC" }],
      caption: "Chứng minh hai tam giác ABM và DCM bằng nhau",
    });
    expect(result.spec.points).toContainEqual(
      expect.objectContaining({ label: "M", pointStyle: "FILLED" }),
    );
    expect(result.spec.primitives).not.toContainEqual(
      expect.objectContaining({ id: "quadrilateralSide1" }),
    );
    expect(result.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "quadrilateralSide1FirstHalf" }),
    );
    expect(result.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "quadrilateralSide1SecondHalf" }),
    );
    expect(result.spec.markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "EQUAL_LENGTH",
          segmentIds: ["quadrilateralSide1FirstHalf", "quadrilateralSide1SecondHalf"],
          markCount: 2,
        }),
        expect.objectContaining({
          type: "EQUAL_LENGTH",
          segmentIds: ["quadrilateralSide0", "quadrilateralSide2"],
          markCount: 1,
        }),
      ]),
    );
    expect(result.spec.labels).toEqual([]);
  });

  it("places tape labels above the bar so they do not collide with part labels", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "ELEMENTARY_MODEL",
      archetype: "TAPE_COMPARISON",
      bars: [
        {
          label: "12 quả cam",
          parts: [4, 4, 4],
          partLabels: ["1 phần", "1 phần", "1 phần"],
        },
      ],
      unit: "quả",
      caption: "12 quả cam chia đều thành 3 phần",
    });
    const rowLabel = result.spec.labels.find((label) => label.text === "12 quả cam");
    const rowAnchor = result.spec.points.find(
      (point) => point.id === rowLabel?.anchorPointId,
    );
    expect(rowLabel).toEqual(expect.objectContaining({ position: "TOP_RIGHT" }));
    expect(rowAnchor).toEqual(expect.objectContaining({ x: 0, y: 1.35 }));
    expect(result.spec.labels.filter((label) => label.text === "1 phần")).toHaveLength(3);
  });

  it("names every visible parabola construction point and keeps samples hidden", () => {
    const result = compileLessonSummaryDiagramIntent(cases[4]!.input);
    const visible = result.spec.points.filter((point) => point.pointStyle === "FILLED");
    const hiddenCurveSamples = result.spec.points.filter(
      (point) => point.id.startsWith("graph0Point") && point.pointStyle === "NONE",
    );

    expect(visible).toHaveLength(5);
    expect(visible.every((point) => Boolean(point.label))).toBe(true);
    expect(new Set(visible.map((point) => point.label)).size).toBe(5);
    expect(hiddenCurveSamples.length).toBeGreaterThanOrEqual(17);
  });

  it("uses O as the single named construction point at the coordinate origin", () => {
    const result = compileLessonSummaryDiagramIntent(cases[5]!.input);
    const originPoints = result.spec.points.filter(
      (point) => Math.abs(point.x) <= 1e-9 && Math.abs(point.y) <= 1e-9,
    );

    expect(originPoints).toHaveLength(1);
    expect(originPoints[0]).toEqual(
      expect.objectContaining({ label: "O", pointStyle: "FILLED" }),
    );
  });

  it("compresses a wide real-world graph without changing its printed tick values", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "MEDIUM",
      caption: "Mô hình parabol của dây cáp cầu treo",
      family: "ALGEBRA_GRAPH",
      archetype: "QUADRATIC_FUNCTION",
      xMin: -220,
      xMax: 220,
      yMin: 0,
      yMax: 80,
      xStep: 50,
      yStep: 10,
      functions: [
        {
          kind: "QUADRATIC",
          id: "bridgeCable",
          label: "y = 3x²/1600",
          a: 0.001875,
          b: 0,
          c: 0,
          constructionXs: [-200, -100, 0, 100, 200],
        },
      ],
    });

    expect(result.spec.viewBox.width / result.spec.viewBox.height).toBeLessThan(2.1);
    expect(result.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["-200", "-100", "100", "200", "y = 3x²/1600"]),
    );
    expect(
      result.spec.labels.find((label) => label.text === "y = 3x²/1600")?.position,
    ).toBe("TOP_LEFT");
  });

  it("preserves a central-angle measure expressed with textbook point notation", () => {
    const result = compileLessonSummaryDiagramIntent(
      cases.find(
        (testCase) => testCase.name === "circle sector with a named central-angle target",
      )!.input,
    );
    expect(result.spec.markers).toContainEqual(
      expect.objectContaining({ type: "ANGLE", label: "80°" }),
    );
    expect(result.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "sectorArea", type: "POLYGON", fill: "SOFT_BLUE" }),
    );
  });

  it("places a circle fraction label below the model instead of in an unshaded part", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "ELEMENTARY_MODEL",
      archetype: "FRACTION_MODEL",
      numerator: 1,
      denominator: 4,
      shape: "CIRCLE",
      fractionLabel: "1/4",
      caption: "Tô màu 1 trong 4 phần bằng nhau",
    });
    const label = result.spec.labels.find((candidate) => candidate.text === "1/4");
    const anchor = result.spec.points.find((point) => point.id === label?.anchorPointId);
    expect(anchor).toEqual(expect.objectContaining({ x: 0, y: -1.2 }));
    expect(label).toEqual(expect.objectContaining({ position: "BOTTOM" }));
  });

  it("compiles circle radius and diameter relations from their declared targets", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "CIRCLE_PARTS",
      variant: "RADIUS_DIAMETER_CHORD",
      pointLabels: ["O", "A", "B", "M"],
      measures: [
        { target: "OM", text: "4 cm" },
        { target: "AB", text: "?" },
      ],
      caption: "Tìm đường kính khi biết bán kính",
    });
    expect(result.spec.points.map((point) => point.label).filter(Boolean)).toEqual(
      expect.arrayContaining(["O", "A", "B", "M"]),
    );
    const segments = result.spec.primitives.filter(
      (primitive) => primitive.type === "SEGMENT",
    );
    expect(segments).toHaveLength(2);
    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "circleDiameter",
          from: "circlePoint0",
          to: "circlePoint1",
        }),
        expect.objectContaining({ id: "circleMeasuredRadius0" }),
      ]),
    );
    expect(
      segments.some(
        (segment) =>
          new Set([segment.from, segment.to]).has("circlePoint0") &&
          new Set([segment.from, segment.to]).has("circlePoint1"),
      ),
    ).toBe(true);
    expect(result.spec.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "4 cm",
          anchorPrimitiveId: "circleMeasuredRadius0",
        }),
        expect.objectContaining({
          text: "?",
          anchorPrimitiveId: "circleDiameter",
        }),
      ]),
    );
  });

  it("supports a circle illustration with only a center and one radius point", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "CIRCLE_PARTS",
      variant: "RADIUS_DIAMETER_CHORD",
      pointLabels: ["O", "A"],
      measures: [{ target: "OA", text: "bán kính" }],
      caption: "Bán kính OA",
    });
    expect(result.spec.points.map((point) => point.label).filter(Boolean)).toEqual([
      "O",
      "A",
    ]);
    expect(result.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "CIRCLE" }),
        expect.objectContaining({ type: "SEGMENT" }),
      ]),
    );
    expect(result.spec.labels).toEqual([]);
  });

  it("suppresses descriptive numeric prose from geometry labels", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 3,
      difficulty: "SIMPLE",
      family: "PLANE_GEOMETRY",
      archetype: "CIRCLE_PARTS",
      variant: "RADIUS_DIAMETER_CHORD",
      pointLabels: ["O", "A", "B"],
      measures: [
        { target: "OA", text: "1 bán kính" },
        { target: "AB", text: "2 lần bán kính" },
      ],
      caption: "Đường kính dài gấp hai lần bán kính",
    });
    expect(result.spec.labels).toEqual([]);
  });

  it("removes a trailing machine rows placeholder from a value table", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 4,
      difficulty: "SIMPLE",
      family: "DATA_STATISTICS",
      archetype: "VALUE_TABLE",
      columns: ["Hàng", "Giá trị của một đơn vị ở", "rows"],
      rows: [
        ["chục nghìn", "10 000"],
        ["nghìn", "1 000"],
      ],
      caption: "Bảng các hàng của số đến 100 000",
    });
    expect(result.spec.labels.map((label) => label.text)).toEqual([
      "Hàng",
      "Giá trị của một đơn vị ở",
      "chục nghìn",
      "10 000",
      "nghìn",
      "1 000",
    ]);
    expect(result.spec.labels.map((label) => label.text)).not.toContain("rows");
    expect(result.spec.viewBox.width).toBeGreaterThan(result.spec.viewBox.height);
  });

  it("recovers a collapsed large-number range from an explicit number-line caption", () => {
    const result = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 4,
      difficulty: "SIMPLE",
      family: "NUMBER_COORDINATE",
      archetype: "NUMBER_LINE",
      min: 175,
      max: 176,
      step: 1,
      points: [
        { id: "n1", label: "P", value: 175, endpoint: "POINT" },
        { id: "n2", label: "Q", value: 175, endpoint: "POINT" },
        { id: "n3", label: "R", value: 175, endpoint: "POINT" },
        { id: "n4", label: "S", value: 176, endpoint: "POINT" },
      ],
      caption: "Tia số từ 17 595 đến 17 602",
    });
    const texts = result.spec.labels.map((label) => label.text);
    expect(texts).toEqual([
      "17 595",
      "17 596",
      "17 597",
      "17 598",
      "17 599",
      "17 600",
      "17 601",
      "17 602",
    ]);
    expect(
      result.spec.points.every(
        (point) => !["P", "Q", "R", "S"].includes(point.label ?? ""),
      ),
    ).toBe(true);
  });

  it("rejects a malformed semantic intent before rendering", () => {
    expect(() =>
      compileLessonSummaryDiagramIntent({
        ...base,
        family: "ELEMENTARY_MODEL",
        archetype: "FRACTION_MODEL",
        numerator: 5,
        denominator: 4,
        shape: "BAR",
        fractionLabel: "5/4",
      }),
    ).toThrow(/cannot shade more parts/u);
  });

  it.each([
    {
      name: "negative line-chart value",
      input: {
        ...base,
        family: "DATA_STATISTICS",
        archetype: "LINE_CHART",
        categories: ["Thứ Hai", "Thứ Ba"],
        series: [{ label: "Nhiệt độ", values: [21, -2] }],
        yStep: 5,
        unit: "°C",
      },
    },
    {
      name: "bar-chart series/category length mismatch",
      input: {
        ...base,
        family: "DATA_STATISTICS",
        archetype: "BAR_CHART",
        categories: ["A", "B", "C"],
        series: [{ label: "Số lượng", values: [2, 4] }],
        yStep: 1,
        unit: null,
      },
    },
    {
      name: "zero-total pie chart",
      input: {
        ...base,
        family: "DATA_STATISTICS",
        archetype: "PIE_CHART",
        categories: ["A", "B"],
        series: [{ label: "Tỉ lệ", values: [0, 0] }],
        yStep: 1,
        unit: "%",
      },
    },
  ])("rejects $name before compiling", ({ input }) => {
    expect(() => compileLessonSummaryDiagramIntent(input)).toThrow();
  });

  it("derives a compact textbook y-axis step instead of trusting the provider hint", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      difficulty: "MEDIUM",
      family: "DATA_STATISTICS",
      archetype: "LINE_CHART",
      categories: ["T2", "T3", "T4", "T5", "T6"],
      series: [{ label: "Nhiệt độ", values: [25, 27, 26, 30, 29] }],
      yStep: 1,
      unit: "°C",
    });

    expect(
      compiled.spec.primitives.filter((primitive) =>
        primitive.id.startsWith("chartYTick"),
      ),
    ).toHaveLength(7);
    expect(compiled.spec.labels).toContainEqual(
      expect.objectContaining({ text: "°C", anchorPointId: "chartYEnd" }),
    );
  });

  it("places a single line-series name on the y-axis and staggers three long categories", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "SIMPLE",
      family: "DATA_STATISTICS",
      archetype: "LINE_CHART",
      categories: ["Hà Nội", "Đà Nẵng", "Lâm Đồng"],
      series: [{ label: "Tần số", values: [8, 5, 4] }],
      yStep: 1,
      unit: null,
    });
    const points = new Map(compiled.spec.points.map((point) => [point.id, point]));
    const labels = new Map(compiled.spec.labels.map((label) => [label.text, label]));
    const firstCategory = points.get(labels.get("Hà Nội")!.anchorPointId)!;
    const secondCategory = points.get(labels.get("Đà Nẵng")!.anchorPointId)!;

    expect(labels.get("Tần số")?.anchorPointId).toBe("chartYEnd");
    expect(labels.get("Tần số")?.anchorPointId).not.toBe("series0Point2");
    expect(secondCategory.y).toBeLessThan(firstCategory.y);
  });

  it("separates double-bar categories, legend and near-equal value labels on mobile", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      difficulty: "MEDIUM",
      family: "DATA_STATISTICS",
      archetype: "BAR_CHART",
      categories: ["Việt Nam", "Singapore", "Nhật Bản", "Hàn Quốc"],
      series: [
        { label: "Nam", values: [162.1, 171, 172, 170.7] },
        { label: "Nữ", values: [152.2, 160, 158, 159] },
      ],
      yStep: 5,
      unit: "cm",
    });
    const points = new Map(compiled.spec.points.map((point) => [point.id, point]));
    const labelByText = new Map(compiled.spec.labels.map((label) => [label.text, label]));
    const categoryAnchor = points.get(labelByText.get("Việt Nam")!.anchorPointId)!;
    const secondCategoryAnchor = points.get(labelByText.get("Singapore")!.anchorPointId)!;
    const legendAnchor = points.get(labelByText.get("Nam")!.anchorPointId)!;
    const firstFemaleValueAnchor = points.get(labelByText.get("152.2")!.anchorPointId)!;
    const firstFemaleBarTop = points.get("bar1Value0C")!;

    expect(compiled.spec.viewBox.minY).toBeLessThanOrEqual(-2);
    expect(categoryAnchor.y - legendAnchor.y).toBeGreaterThan(1);
    expect(secondCategoryAnchor.y).toBeLessThan(categoryAnchor.y);
    expect(labelByText.get("162.1")?.position).toBe("TOP");
    expect(labelByText.get("152.2")?.position).toBe("TOP");
    expect(firstFemaleValueAnchor.y - firstFemaleBarTop.y).toBeGreaterThan(0.1);
    expect(labelByText.get("171")?.position).toBe("TOP");
    expect(labelByText.get("160")?.position).toBe("TOP");
  });

  it("moves a shorter double-bar value away from its taller neighboring bar", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      difficulty: "MEDIUM",
      family: "DATA_STATISTICS",
      archetype: "BAR_CHART",
      categories: ["Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9"],
      series: [
        { label: "Tuyên Quang", values: [220, 310, 280, 240] },
        { label: "Nha Trang", values: [60, 45, 110, 250] },
      ],
      yStep: 50,
      unit: "mm",
    });
    const labelByText = new Map(compiled.spec.labels.map((label) => [label.text, label]));

    expect(labelByText.get("280")?.position).toBe("TOP");
    expect(labelByText.get("110")?.position).toBe("CENTER");
  });

  it("maps textbook cylinder segment names to radius and central dashed height", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "MEDIUM",
      family: "SPATIAL_APPLIED",
      archetype: "CYLINDER",
      variant: "CYLINDER",
      pointLabels: ["O", "O′", "A"],
      dimensions: [
        { target: "OA", value: 3, unit: "cm" },
        { target: "OO′", value: 5, unit: "cm" },
      ],
    });

    expect(compiled.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "cylinderHeight", style: "DASHED" }),
    );
    expect(compiled.spec.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "3 cm", anchorPrimitiveId: "cylinderRadius" }),
        expect.objectContaining({ text: "5 cm", anchorPrimitiveId: "cylinderHeight" }),
      ]),
    );
  });

  it("derives elementary presentation labels when the provider omits them", () => {
    const array = compileLessonSummaryDiagramIntent({
      ...base,
      family: "ELEMENTARY_MODEL",
      archetype: "MULTIPLICATION_ARRAY",
      rows: 4,
      columns: 6,
      rowLabel: null,
      columnLabel: null,
    });
    const fraction = compileLessonSummaryDiagramIntent({
      ...base,
      family: "ELEMENTARY_MODEL",
      archetype: "FRACTION_MODEL",
      numerator: 5,
      denominator: 8,
      shape: "CIRCLE",
      fractionLabel: null,
    });

    expect(array.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["4 hàng", "6 cột"]),
    );
    expect(fraction.spec.labels.map((label) => label.text)).toContain("5/8");
  });

  it("renders a thermometer reading once and separates it from the tube outline", () => {
    const thermometer = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 4,
      family: "ELEMENTARY_MODEL",
      archetype: "MEASUREMENT_SCALE",
      variant: "THERMOMETER",
      min: 0,
      max: 50,
      step: 5,
      value: 25,
      unit: "°C",
    });

    expect(thermometer.spec.labels.filter((label) => label.text === "25")).toHaveLength(
      1,
    );
    expect(thermometer.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "thermometerTubeLeft", type: "SEGMENT" }),
        expect.objectContaining({ id: "thermometerTubeRight", type: "SEGMENT" }),
        expect.objectContaining({ id: "thermometerReading", type: "SEGMENT" }),
      ]),
    );
  });

  it("keeps line, ray and segment as distinct primitive types", () => {
    const construction = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "LINE_RAY_SEGMENT",
      pointLabels: ["A", "B", "C", "D", "E", "F"],
      measures: [],
    });

    expect(construction.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "basicLine", type: "LINE" }),
        expect.objectContaining({ id: "basicRay", type: "RAY" }),
        expect.objectContaining({ id: "basicSegment", type: "SEGMENT" }),
      ]),
    );
    expect(
      construction.spec.points
        .filter(
          (point) => point.label && ["A", "B", "C", "D", "E", "F"].includes(point.label),
        )
        .every((point) => point.pointStyle === "FILLED"),
    ).toBe(true);
  });

  it("draws a single three-point line without requiring a six-label comparison", () => {
    const construction = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "LINE_RAY_SEGMENT",
      pointLabels: ["A", "B", "C"],
      measures: [],
      caption: "Ba điểm A, B, C thẳng hàng, B nằm giữa A và C.",
    });

    expect(construction.spec.primitives).toEqual([
      expect.objectContaining({ id: "basicLine", type: "LINE" }),
    ]);
    expect(construction.spec.points.map((point) => point.label)).toEqual(["A", "B", "C"]);
    expect(construction.spec.points.every((point) => point.pointStyle === "FILLED")).toBe(
      true,
    );
  });

  it("distinguishes point labels from lowercase direction names on lines and rays", () => {
    const line = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "LINE_RAY_SEGMENT",
      pointLabels: ["X", "O", "Y"],
      measures: [],
      caption: "Điểm O nằm trên đường thẳng xy và chia đường thẳng thành hai phần.",
    });
    const ray = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "LINE_RAY_SEGMENT",
      pointLabels: ["A", "B", "M"],
      measures: [],
      caption: "Điểm B thuộc tia Am nên tia Am còn được gọi là tia AB.",
    });
    const oppositeRays = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      family: "PLANE_GEOMETRY",
      archetype: "BASIC_CONSTRUCTION",
      variant: "LINE_RAY_SEGMENT",
      pointLabels: ["X", "O", "Y"],
      measures: [],
      caption: "Trên đường thẳng XY, O nằm giữa X và Y nên OX và OY là hai tia đối nhau.",
    });

    expect(line.spec.points.map((point) => [point.label, point.pointStyle])).toEqual([
      [null, "NONE"],
      ["O", "FILLED"],
      [null, "NONE"],
    ]);
    expect(line.spec.labels.map((label) => label.text)).toEqual(["x", "y"]);
    expect(line.spec.primitives).toEqual([
      expect.objectContaining({ id: "basicLine", type: "LINE" }),
    ]);
    expect(ray.spec.points.map((point) => [point.label, point.pointStyle])).toEqual([
      ["A", "FILLED"],
      ["B", "FILLED"],
      [null, "NONE"],
    ]);
    expect(ray.spec.labels.map((label) => label.text)).toEqual(["m"]);
    expect(ray.spec.primitives).toEqual([
      expect.objectContaining({ id: "basicRay", type: "RAY" }),
    ]);
    expect(oppositeRays.spec.primitives).toEqual([
      expect.objectContaining({
        id: "oppositeRayFirst",
        type: "RAY",
        from: "linearMiddle",
        to: "linearFirst",
      }),
      expect.objectContaining({
        id: "oppositeRaySecond",
        type: "RAY",
        from: "linearMiddle",
        to: "linearLast",
      }),
    ]);
    expect(oppositeRays.spec.labels.map((label) => [label.text, label.position])).toEqual(
      [
        ["x", "TOP"],
        ["y", "TOP"],
      ],
    );
  });

  it("canonicalizes graph function order and removes redundant linear construction points", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      intentVersion: 1,
      grade: 9,
      difficulty: "HARD",
      caption: "Giao điểm đường thẳng và parabol",
      family: "ALGEBRA_GRAPH",
      archetype: "LINE_QUADRATIC_INTERSECTION",
      xMin: -3,
      xMax: 3,
      yMin: -3,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "LINEAR",
          id: "line",
          label: "y = x",
          slope: 1,
          intercept: 0,
          constructionXs: [-2, 0, 2],
        },
        {
          kind: "QUADRATIC",
          id: "parabola",
          label: "y = x² - 2",
          a: 1,
          b: 0,
          c: -2,
          constructionXs: [-2, -1, 0, 1, 2],
        },
      ],
    });

    const namedPoints = diagram.spec.points.filter(
      (point) => point.label !== null && point.pointStyle === "FILLED",
    );
    expect(namedPoints).toHaveLength(6);
    expect(
      diagram.spec.primitives.filter((primitive) => primitive.type === "POLYLINE"),
    ).toHaveLength(1);
    expect(
      diagram.spec.primitives.filter((primitive) => primitive.type === "LINE"),
    ).toHaveLength(3);
    const functionLabel = diagram.spec.labels.find(
      (label) => label.text === "y = x² - 2",
    );
    const functionAnchor = diagram.spec.points.find(
      (point) => point.id === functionLabel?.anchorPointId,
    );
    expect(functionAnchor).toBeDefined();
    expect(functionLabel?.position).toBe("TOP_LEFT");
    expect(
      Math.min(
        ...namedPoints.map((point) =>
          Math.hypot(
            (functionAnchor!.x - point.x) / 6,
            (functionAnchor!.y - point.y) / 8,
          ),
        ),
      ),
    ).toBeGreaterThanOrEqual(0.12);
  });

  it("places labels on opposite clear sides of increasing and decreasing lines", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      intentVersion: 1,
      grade: 9,
      difficulty: "MEDIUM",
      caption: "Hệ hai đường thẳng",
      family: "ALGEBRA_GRAPH",
      archetype: "LINEAR_SYSTEM",
      xMin: -2,
      xMax: 7,
      yMin: -2,
      yMax: 7,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "LINEAR",
          id: "increasing",
          label: "y = x + 1",
          slope: 1,
          intercept: 1,
          constructionXs: [0, 2],
        },
        {
          kind: "LINEAR",
          id: "decreasing",
          label: "y = -x + 5",
          slope: -1,
          intercept: 5,
          constructionXs: [0, 2],
        },
      ],
    });

    expect(
      diagram.spec.labels.find((label) => label.text === "y = x + 1")?.position,
    ).toBe("TOP_RIGHT");
    expect(
      diagram.spec.labels.find((label) => label.text === "y = -x + 5")?.position,
    ).toBe("BOTTOM_RIGHT");
  });

  it("extends a linear-function graph through its two named construction points", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "SIMPLE",
      family: "ALGEBRA_GRAPH",
      archetype: "LINEAR_FUNCTION",
      xMin: -4,
      xMax: 3,
      yMin: -2,
      yMax: 6,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "LINEAR",
          id: "linear",
          label: "y = 2x + 4",
          slope: 2,
          intercept: 4,
          constructionXs: [-2, 0],
        },
      ],
    });

    const graphLine = diagram.spec.primitives.find(
      (primitive) => primitive.id === "functionCurve0Branch0",
    );
    expect(graphLine).toEqual(expect.objectContaining({ type: "LINE" }));
    expect(
      diagram.spec.points.filter((point) => point.pointStyle === "FILLED"),
    ).toHaveLength(2);
  });

  it("maps standard advanced-geometry symbols to semantic roles independent of array order", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "SIMPLE",
      family: "ADVANCED_GEOMETRY",
      archetype: "CIRCLE_RELATIONS",
      variant: "CIRCUMCIRCLE",
      pointLabels: ["A", "B", "C", "O"],
      measures: [],
    });

    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "circumcircleO", label: "O", pointStyle: "FILLED" }),
    );
    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "circumcircleA", label: "A" }),
    );
  });

  it("fully compiles the basic cyclic-quadrilateral capability advertised to the provider", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "CIRCLE_RELATIONS",
      variant: "CYCLIC_QUADRILATERAL",
      pointLabels: ["O", "A", "B", "C", "D"],
      measures: [],
    });

    expect(diagram.diagnostics.compilerKey).toBe("geometry.circle-relations.v1");
    expect(diagram.spec.points).toHaveLength(5);
    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "cyclicO", label: "O", pointStyle: "FILLED" }),
    );
    expect(diagram.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cyclicCircle", type: "CIRCLE" }),
        expect.objectContaining({ id: "cyclicSide0", type: "SEGMENT" }),
        expect.objectContaining({ id: "cyclicSide1", type: "SEGMENT" }),
        expect.objectContaining({ id: "cyclicSide2", type: "SEGMENT" }),
        expect.objectContaining({ id: "cyclicSide3", type: "SEGMENT" }),
      ]),
    );
    expect(diagram.spec.primitives).toHaveLength(5);
  });

  it("draws both tangents from an external point with equal-length markers", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "CIRCLE_RELATIONS",
      variant: "TANGENT",
      pointLabels: ["O", "M", "A", "B"],
      measures: [],
      caption: "Hai tiếp tuyến cắt nhau của một đường tròn",
    });

    expect(diagram.spec.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "twoTangentsO", label: "O", pointStyle: "FILLED" }),
        expect.objectContaining({ id: "twoTangentsM", label: "M" }),
        expect.objectContaining({ id: "twoTangentsA", label: "A" }),
        expect.objectContaining({ id: "twoTangentsB", label: "B" }),
      ]),
    );
    expect(diagram.spec.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "twoTangentsMA", type: "SEGMENT" }),
        expect.objectContaining({ id: "twoTangentsMB", type: "SEGMENT" }),
      ]),
    );
    expect(
      diagram.spec.markers.filter((marker) => marker.type === "RIGHT_ANGLE"),
    ).toHaveLength(2);
    expect(diagram.spec.markers).toContainEqual(
      expect.objectContaining({
        type: "EQUAL_LENGTH",
        segmentIds: ["twoTangentsMA", "twoTangentsMB"],
      }),
    );
  });

  it("anchors radius and center-distance measures to the correct two-tangent segments", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "CIRCLE_RELATIONS",
      variant: "TANGENT",
      pointLabels: ["O", "M", "A", "B"],
      measures: [
        { target: "OA", text: "5 cm" },
        { target: "OM", text: "13 cm" },
      ],
      caption: "Hai tiếp tuyến từ điểm M đến đường tròn",
    });

    expect(diagram.spec.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "5 cm", anchorPrimitiveId: "twoTangentsOA" }),
        expect.objectContaining({ text: "13 cm", anchorPrimitiveId: "twoTangentsOM" }),
      ]),
    );
    const external = diagram.spec.points.find((point) => point.id === "twoTangentsM")!;
    expect(external.x).toBeCloseTo(7.8);
  });

  it("maps standard pyramid symbols to base and apex roles independent of array order", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "HARD",
      family: "SPATIAL_APPLIED",
      archetype: "PRISM_OR_PYRAMID",
      variant: "PYRAMID",
      pointLabels: ["S", "A", "B", "C", "D"],
      dimensions: [],
    });

    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "pyramidPoint4", label: "S" }),
    );
    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "pyramidPoint0", label: "A" }),
    );
  });

  it("normalizes common Venn region aliases before placing elements", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      difficulty: "SIMPLE",
      family: "SET_SCHEMATIC",
      archetype: "VENN",
      nodes: [
        { id: "two", label: "2", group: "A_ONLY" },
        { id: "six", label: "6", group: "A_INTERSECT_B" },
        { id: "nine", label: "9", group: "B_ONLY" },
      ],
      edges: [],
      setLabels: ["A", "B"],
    });

    const labelAnchors = new Map(
      diagram.spec.labels.map((label) => [
        label.text,
        diagram.spec.points.find((point) => point.id === label.anchorPointId),
      ]),
    );
    expect(labelAnchors.get("2")?.x).toBeLessThan(0);
    expect(labelAnchors.get("6")?.x).toBe(0);
    expect(labelAnchors.get("9")?.x).toBeGreaterThan(0);
  });

  it("compiles an interval with a highlighted segment and explicit endpoint styles", () => {
    const diagram = compileLessonSummaryDiagramIntent({
      ...base,
      family: "NUMBER_COORDINATE",
      archetype: "INTERVAL",
      min: -5,
      max: 5,
      step: 1,
      left: -2,
      right: 3,
      leftClosed: true,
      rightClosed: false,
      intervalLabel: null,
    });

    expect(diagram.spec.primitives).toContainEqual(
      expect.objectContaining({ id: "intervalSegment", type: "SEGMENT" }),
    );
    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "intervalLeft", pointStyle: "FILLED" }),
    );
    expect(diagram.spec.points).toContainEqual(
      expect.objectContaining({ id: "intervalRight", pointStyle: "OPEN" }),
    );
    expect(diagram.spec.labels).toContainEqual(
      expect.objectContaining({ text: "-2 ≤ x < 3" }),
    );
  });

  it("maps a semantic provider envelope to the persisted DiagramSpec contract", () => {
    const providerInput = lessonSummaryProviderDiagramInputSchema.parse({
      kind: "INTENT",
      intent: cases[4]!.input,
    });
    const mapped = mapLessonSummaryProviderDiagramInput(providerInput);

    expect(mapped.version).toBe(1);
    expect(mapped.coordinateSystem).toBe("CARTESIAN");
    expect(mapped.primitives.some((primitive) => primitive.type === "POLYLINE")).toBe(
      true,
    );
    expect(mapped.points.filter((point) => point.pointStyle === "FILLED")).toHaveLength(
      5,
    );
  });

  it("rejects an archetype/variant pair that would compile into the wrong figure", () => {
    expect(() =>
      compileLessonSummaryDiagramIntent({
        ...base,
        family: "SPATIAL_APPLIED",
        archetype: "CUBOID",
        variant: "PYRAMID",
        pointLabels: [],
        dimensions: [],
      }),
    ).toThrow(/does not support variant PYRAMID/u);
  });

  it.each([
    ["TRIANGULAR_PRISM", ["A", "B", "C", "A'", "B'", "C'"]],
    ["PYRAMID", ["A", "B", "C", "D", "S"]],
  ] as const)(
    "compiles a textbook %s with visible and hidden edges",
    (variant, pointLabels) => {
      const compiled = compileLessonSummaryDiagramIntent({
        ...base,
        grade: variant === "TRIANGULAR_PRISM" ? 7 : 8,
        family: "SPATIAL_APPLIED",
        archetype: "PRISM_OR_PYRAMID",
        variant,
        pointLabels,
        dimensions: [],
      });

      expect(compiled.diagnostics.compilerKey).toBe("spatial.prism-pyramid.v1");
      expect(
        compiled.spec.primitives.some((primitive) => primitive.style === "DASHED"),
      ).toBe(true);
      expect(compiled.spec.points.filter((point) => point.label !== null)).toHaveLength(
        pointLabels.length,
      );
    },
  );

  it("keeps an inverse graph in two branches and names every construction point", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 7,
      difficulty: "HARD",
      family: "ALGEBRA_GRAPH",
      archetype: "INVERSE_FUNCTION",
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "INVERSE",
          id: "inverseOne",
          label: "y = 4/x",
          coefficient: 4,
          constructionXs: [-4, -2, -1, 1, 2, 4],
        },
      ],
    });
    const curves = compiled.spec.primitives.filter(
      (primitive) =>
        primitive.type === "POLYLINE" && primitive.id.startsWith("functionCurve"),
    );
    const constructionPoints = compiled.spec.points.filter(
      (point) => point.pointStyle === "FILLED",
    );

    expect(curves).toHaveLength(2);
    expect(constructionPoints).toHaveLength(6);
    expect(constructionPoints.every((point) => Boolean(point.label))).toBe(true);
    for (const curve of curves) {
      if (curve.type !== "POLYLINE") continue;
      const xs = curve.pointIds.map(
        (pointId) => compiled.spec.points.find((point) => point.id === pointId)!.x,
      );
      expect(xs.some((x) => Math.abs(x) < 1e-10)).toBe(false);
      expect(xs.every((x) => x < 0) || xs.every((x) => x > 0)).toBe(true);
    }
  });

  it.each(["CUBE_NET", "CUBOID_NET"] as const)(
    "builds %s from exactly six connected faces",
    (variant) => {
      const compiled = compileLessonSummaryDiagramIntent({
        ...base,
        grade: variant === "CUBE_NET" ? 5 : 7,
        family: "SPATIAL_APPLIED",
        archetype: "NET",
        variant,
        pointLabels: [],
        dimensions: [],
      });
      const faces = compiled.spec.primitives.filter(
        (primitive) => primitive.type === "POLYGON" && primitive.id.startsWith("netFace"),
      );

      expect(faces).toHaveLength(6);
      expect(
        faces.every((face) => face.type === "POLYGON" && face.pointIds.length === 4),
      ).toBe(true);
    },
  );

  it("keeps the universe label inside the Venn universe rectangle", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 6,
      family: "SET_SCHEMATIC",
      archetype: "VENN_UNIVERSE",
      nodes: [
        { id: "a", label: "2", group: "A" },
        { id: "ab", label: "6", group: "A&B" },
        { id: "b", label: "9", group: "B" },
      ],
      edges: [],
      setLabels: ["U", "A", "B"],
    });
    const universe = compiled.spec.primitives.find(
      (primitive) => primitive.id === "vennUniverse" && primitive.type === "POLYGON",
    );
    const universeLabel = compiled.spec.labels.find((label) => label.text === "U");

    expect(universe?.type).toBe("POLYGON");
    expect(universeLabel).toBeDefined();
    if (!universe || universe.type !== "POLYGON" || !universeLabel) return;
    const corners = universe.pointIds.map((pointId) =>
      compiled.spec.points.find((point) => point.id === pointId)!,
    );
    const labelPoint = compiled.spec.points.find(
      (point) => point.id === universeLabel.anchorPointId,
    )!;
    expect(labelPoint.x).toBeGreaterThan(Math.min(...corners.map((point) => point.x)));
    expect(labelPoint.x).toBeLessThan(Math.max(...corners.map((point) => point.x)));
    expect(labelPoint.y).toBeGreaterThan(Math.min(...corners.map((point) => point.y)));
    expect(labelPoint.y).toBeLessThan(Math.max(...corners.map((point) => point.y)));
  });

  it("centers probability-tree groups above their own leaves and keeps labels off branches", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "MEDIUM",
      family: "SET_SCHEMATIC",
      archetype: "TREE",
      nodes: [
        { id: "root", label: "Lấy 1 quả cầu", group: null },
        { id: "blue", label: "Xanh", group: null },
        { id: "red", label: "Đỏ", group: null },
        ...["X1", "X2", "X3", "X4", "X5"].map((label) => ({
          id: label,
          label,
          group: null,
        })),
        ...["D1", "D2", "D3", "D4"].map((label) => ({
          id: label,
          label,
          group: null,
        })),
      ],
      edges: [
        { from: "root", to: "blue", label: null },
        { from: "root", to: "red", label: null },
        ...["X1", "X2", "X3", "X4", "X5"].map((to) => ({
          from: "blue",
          to,
          label: null,
        })),
        ...["D1", "D2", "D3", "D4"].map((to) => ({
          from: "red",
          to,
          label: null,
        })),
      ],
      setLabels: [],
    });
    const labels = new Map(compiled.spec.labels.map((label) => [label.text, label]));
    const pointFor = (label: string) =>
      compiled.spec.points.find(
        (point) => point.id === labels.get(label)?.anchorPointId,
      )!;
    const blueX = pointFor("Xanh").x;
    const redX = pointFor("Đỏ").x;

    expect(blueX).toBe(
      (Math.min(...["X1", "X2", "X3", "X4", "X5"].map((id) => pointFor(id).x)) +
        Math.max(...["X1", "X2", "X3", "X4", "X5"].map((id) => pointFor(id).x))) /
        2,
    );
    expect(redX).toBe(
      (Math.min(...["D1", "D2", "D3", "D4"].map((id) => pointFor(id).x)) +
        Math.max(...["D1", "D2", "D3", "D4"].map((id) => pointFor(id).x))) /
        2,
    );
    expect(labels.get("Lấy 1 quả cầu")?.position).toBe("TOP");
    expect(labels.get("Xanh")?.position).toBe("LEFT");
    expect(labels.get("Đỏ")?.position).toBe("RIGHT");
    expect(labels.get("X1")?.position).toBe("BOTTOM");
  });

  it("encodes the textbook 2:1 relation between central and inscribed angles", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 9,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "CIRCLE_RELATIONS",
      variant: "CENTRAL_INSCRIBED_ANGLES",
      pointLabels: ["O", "A", "B", "C"],
      measures: [
        { target: "CENTRAL", text: "80°" },
        { target: "INSCRIBED", text: "40°" },
      ],
    });
    const angles = compiled.spec.markers.filter((marker) => marker.type === "ANGLE");

    expect(angles).toHaveLength(2);
    expect(angles.map((angle) => angle.label)).toEqual(["80°", "40°"]);
    expect(new Set(angles.flatMap((angle) => angle.armPointIds))).toEqual(
      new Set(["circleAnglesA", "circleAnglesB"]),
    );
  });

  it("uses proportional 3-4-5 and 6-8-10 triangles for SSS similarity", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "HARD",
      family: "ADVANCED_GEOMETRY",
      archetype: "TRIANGLE_SIMILARITY",
      variant: "SSS_SIMILARITY",
      pointLabels: ["A", "B", "C", "D", "E", "F"],
      measures: [
        { target: "AB", text: "4" },
        { target: "AC", text: "3" },
        { target: "BC", text: "5" },
        { target: "DE", text: "8" },
        { target: "DF", text: "6" },
        { target: "EF", text: "10" },
      ],
    });
    const labelsByPrimitive = new Map(
      compiled.spec.labels
        .filter((label) => label.anchorPrimitiveId)
        .map((label) => [label.anchorPrimitiveId!, label.text]),
    );

    expect(new Set(labelsByPrimitive.values())).toEqual(
      new Set(["3", "4", "5", "6", "8", "10"]),
    );
    const point = (id: string) => compiled.spec.points.find((item) => item.id === id)!;
    const distance = (from: string, to: string) =>
      Math.hypot(point(to).x - point(from).x, point(to).y - point(from).y);
    const scale = distance("similarD", "similarE") / 8;
    expect(distance("similarE", "similarF") / scale).toBeCloseTo(10, 6);
    expect(distance("similarF", "similarD") / scale).toBeCloseTo(6, 6);
  });

  it("renders a general SSS theorem with symbolic proportional side labels", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "SIMPLE",
      family: "ADVANCED_GEOMETRY",
      archetype: "TRIANGLE_SIMILARITY",
      variant: "SSS_SIMILARITY",
      pointLabels: ["A", "B", "C", "A'", "B'", "C'"],
      measures: [],
    });

    expect(
      compiled.spec.primitives.filter((item) => item.type === "SEGMENT"),
    ).toHaveLength(6);
    expect(compiled.spec.labels.map((label) => label.text)).toEqual([
      "a",
      "b",
      "c",
      "ka",
      "kb",
      "kc",
    ]);
  });

  it("uses the included measured-side vertices for SAS angle markers", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "MEDIUM",
      family: "ADVANCED_GEOMETRY",
      archetype: "TRIANGLE_SIMILARITY",
      variant: "SAS_SIMILARITY",
      pointLabels: ["A", "B", "C", "D", "E", "F"],
      measures: [
        { target: "AB", text: "4 cm" },
        { target: "AC", text: "6 cm" },
        { target: "DE", text: "6 cm" },
        { target: "DF", text: "9 cm" },
      ],
    });
    const angles = compiled.spec.markers.filter((marker) => marker.type === "ANGLE");

    expect(angles.map((angle) => angle.vertex)).toEqual(["similarA", "similarD"]);
    const point = (id: string) => compiled.spec.points.find((item) => item.id === id)!;
    const a = point("similarA");
    const b = point("similarB");
    const c = point("similarC");
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ac = { x: c.x - a.x, y: c.y - a.y };
    const cosine =
      (ab.x * ac.x + ab.y * ac.y) / (Math.hypot(ab.x, ab.y) * Math.hypot(ac.x, ac.y));
    expect(cosine).toBeCloseTo(0.5, 6);
  });

  it("uses ordinary measured angles rather than false right angles for AA similarity", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "MEDIUM",
      family: "ADVANCED_GEOMETRY",
      archetype: "TRIANGLE_SIMILARITY",
      variant: "AA_SIMILARITY",
      pointLabels: ["A", "B", "C", "A'", "B'", "C'"],
      measures: [
        { target: "A", text: "80°" },
        { target: "B", text: "70°" },
        { target: "A'", text: "80°" },
        { target: "B'", text: "70°" },
      ],
    });
    const angles = compiled.spec.markers.filter((marker) => marker.type === "ANGLE");

    expect(compiled.spec.markers.some((marker) => marker.type === "RIGHT_ANGLE")).toBe(
      false,
    );
    expect(angles.map((angle) => angle.label)).toEqual(["80°", "70°", "80°", "70°"]);
  });

  it("derives and displays the missing similar-triangle sides from an explicit ratio", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      difficulty: "MEDIUM",
      caption: "Hai tam giác đồng dạng với tỉ số cạnh bằng 3/2.",
      family: "ADVANCED_GEOMETRY",
      archetype: "TRIANGLE_SIMILARITY",
      variant: "SSS_SIMILARITY",
      pointLabels: ["A", "B", "C", "M", "N", "P"],
      measures: [
        { target: "AB", text: "4 cm" },
        { target: "BC", text: "8 cm" },
        { target: "CA", text: "10 cm" },
      ],
    });
    const labelsByPrimitive = new Map(
      compiled.spec.labels
        .filter((label) => label.anchorPrimitiveId)
        .map((label) => [label.anchorPrimitiveId!, label]),
    );
    const point = (id: string) => compiled.spec.points.find((item) => item.id === id)!;
    const distance = (from: string, to: string) =>
      Math.hypot(point(to).x - point(from).x, point(to).y - point(from).y);

    expect(labelsByPrimitive.get("similarDE")?.text).toBe("6 cm");
    expect(labelsByPrimitive.get("similarEF")?.text).toBe("12 cm");
    expect(labelsByPrimitive.get("similarFD")?.text).toBe("15 cm");
    expect(labelsByPrimitive.get("similarBC")?.position).toBe("RIGHT");
    expect(
      distance("similarD", "similarE") / distance("similarA", "similarB"),
    ).toBeCloseTo(1.5, 6);
  });

  it("normalizes advanced-geometry assignments and omits relation prose", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 8,
      family: "ADVANCED_GEOMETRY",
      archetype: "THALES",
      variant: "PARALLEL_SEGMENT",
      pointLabels: ["A", "B", "C", "D", "E"],
      measures: [
        { target: "AB", text: "AB = 4 cm" },
        { target: "DE", text: "DE = BC" },
      ],
    });

    expect(compiled.spec.labels).toEqual([
      expect.objectContaining({ text: "4 cm", anchorPrimitiveId: "thalesAB" }),
    ]);
  });

  it("removes a repeated angle name without hiding the angle", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      family: "PLANE_GEOMETRY",
      archetype: "ANGLE_RAYS",
      variant: "ACUTE",
      pointLabels: ["O", "A", "B"],
      measures: [{ target: "ANGLE", text: "∠O" }],
    });

    expect(compiled.spec.markers).toContainEqual(
      expect.objectContaining({ type: "ANGLE", label: null }),
    );
  });

  it("omits an incomplete inequality caption but preserves the region", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      family: "NUMBER_COORDINATE",
      archetype: "INEQUALITY_REGION",
      xMin: -4,
      xMax: 4,
      yMin: -4,
      yMax: 4,
      tickStep: 1,
      boundaries: [{ a: 1, b: 1, c: 2, operator: "LE", label: ">= 0" }],
    });

    expect(compiled.spec.labels.map((label) => label.text)).not.toContain(">= 0");
    expect(compiled.spec.primitives.length).toBeGreaterThan(2);
  });

  it("keeps an incomplete value table drawable and reports a review diagnostic", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 6,
      family: "DATA_STATISTICS",
      archetype: "VALUE_TABLE",
      columns: ["x", "y"],
      rows: [["0"]],
    });

    expect(compiled.spec.primitives.length).toBeGreaterThan(0);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "TABLE_CELL_LABEL_COUNT" }),
    );
  });

  it("downsamples dense measurement scales instead of rejecting the whole ruler", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 4,
      family: "ELEMENTARY_MODEL",
      archetype: "MEASUREMENT_SCALE",
      variant: "RULER",
      min: 0,
      max: 100,
      step: 1,
      value: 50,
      unit: "cm",
    });

    expect(
      compiled.spec.primitives.filter((primitive) =>
        primitive.id.startsWith("rulerTick"),
      ),
    ).toHaveLength(16);
    expect(compiled.spec.labels.map((label) => label.text)).toContain("50");
  });

  it("keeps a tape model when only some optional part labels are supplied", () => {
    const compiled = compileLessonSummaryDiagramIntent({
      ...base,
      grade: 3,
      family: "ELEMENTARY_MODEL",
      archetype: "TAPE_COMPARISON",
      bars: [{ label: "12 quả", parts: [4, 4, 4], partLabels: ["4 quả"] }],
      unit: "quả",
    });

    expect(compiled.spec.primitives.length).toBeGreaterThan(0);
    expect(compiled.spec.labels.map((label) => label.text)).toContain("4 quả");
  });

  it("omits an out-of-domain coordinate point and asks for review", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      family: "NUMBER_COORDINATE",
      archetype: "COORDINATE_POINTS",
      xMin: -3,
      xMax: 3,
      yMin: -3,
      yMax: 3,
      xStep: 1,
      yStep: 1,
      points: [
        { id: "inside", label: "A", x: 1, y: 2, showProjections: true },
        { id: "outside", label: "B", x: 8, y: 2, showProjections: true },
      ],
    });

    expect(compiled.spec.points.some((point) => point.label === "A")).toBe(true);
    expect(compiled.spec.points.some((point) => point.label === "B")).toBe(false);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "COORDINATE_POINT_OMITTED" }),
    );
  });

  it("omits one invalid inequality boundary while preserving valid boundaries", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      family: "NUMBER_COORDINATE",
      archetype: "INEQUALITY_REGION",
      xMin: -4,
      xMax: 4,
      yMin: -4,
      yMax: 4,
      tickStep: 1,
      boundaries: [
        { a: 1, b: 1, c: 2, operator: "LE", label: "x + y ≤ 2" },
        { a: 0, b: 0, c: 0, operator: "GE", label: "0 ≥ 0" },
      ],
    });

    expect(
      compiled.spec.primitives.some((primitive) => primitive.id === "boundary0"),
    ).toBe(true);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "INEQUALITY_BOUNDARY_OMITTED" }),
    );
  });

  it("omits invalid graph construction points while preserving the curve", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 9,
      family: "ALGEBRA_GRAPH",
      archetype: "LINEAR_FUNCTION",
      xMin: -4,
      xMax: 4,
      yMin: -4,
      yMax: 4,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "LINEAR",
          id: "f",
          label: "y = x",
          slope: 1,
          intercept: 0,
          constructionXs: [-10, 2],
        },
      ],
    });

    expect(compiled.spec.primitives.some((primitive) => primitive.type === "LINE")).toBe(
      true,
    );
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "GRAPH_CONSTRUCTION_POINT_OMITTED" }),
    );
  });

  it("fills duplicate spatial point names with canonical names and asks for review", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 8,
      family: "SPATIAL_APPLIED",
      archetype: "CUBOID",
      variant: "RECTANGULAR_PRISM",
      pointLabels: ["A", "A"],
      dimensions: [],
    });

    const labels = compiled.spec.points.flatMap((point) =>
      point.label ? [point.label] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "INFERRED_POINT_LABEL" }),
    );
  });

  it("fills a missing point name in a standard plane template and asks for review", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      family: "PLANE_GEOMETRY",
      archetype: "TRIANGLE",
      variant: "ACUTE",
      pointLabels: ["A", "B"],
      measures: [],
    });

    expect(compiled.spec.points.map((point) => point.label)).toEqual(["A", "B", "C"]);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "INFERRED_POINT_LABEL" }),
    );
  });

  it("fills all omitted point names in a standard plane template", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      family: "PLANE_GEOMETRY",
      archetype: "TRIANGLE",
      variant: "RIGHT",
      pointLabels: [],
      measures: [],
    });

    expect(compiled.spec.points.map((point) => point.label)).toEqual(["A", "B", "C"]);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "INFERRED_POINT_LABEL" }),
    );
  });

  it("fills all omitted point names in an advanced geometry template", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 8,
      family: "ADVANCED_GEOMETRY",
      archetype: "THALES",
      variant: "PARALLEL_SEGMENT",
      pointLabels: [],
      measures: [],
    });

    expect(
      compiled.spec.points.flatMap((point) => (point.label ? [point.label] : [])),
    ).toEqual(expect.arrayContaining(["A", "B", "C", "D", "E"]));
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "INFERRED_POINT_LABEL" }),
    );
  });

  it("draws the matching part of a chart with unequal category and value counts", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 6,
      family: "DATA_STATISTICS",
      archetype: "BAR_CHART",
      categories: ["Tổ 1", "Tổ 2", "Tổ 3"],
      series: [{ label: "Số bạn", values: [8, 10] }],
      yStep: 2,
      unit: "bạn",
    });

    expect(compiled.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["Tổ 1", "Tổ 2", "8", "10"]),
    );
    expect(compiled.spec.labels.map((label) => label.text)).not.toContain("Tổ 3");
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "CHART_VALUE_COUNT_RECOVERED" }),
    );
  });

  it("draws the matching part of a pictogram with unequal category and value counts", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 4,
      family: "DATA_STATISTICS",
      archetype: "PICTOGRAM",
      categories: ["Cam", "Táo", "Lê"],
      values: [4, 6],
      valuePerSymbol: 2,
      symbol: "SQUARE",
      unit: "quả",
    });

    expect(compiled.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["Cam", "Táo"]),
    );
    expect(compiled.spec.labels.map((label) => label.text)).not.toContain("Lê");
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "PICTOGRAM_VALUE_COUNT_RECOVERED" }),
    );
  });

  it("omits x = 0 as an invalid inverse-function construction point", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 7,
      family: "ALGEBRA_GRAPH",
      archetype: "INVERSE_FUNCTION",
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      functions: [
        {
          kind: "INVERSE",
          id: "f",
          label: "y = 4/x",
          coefficient: 4,
          constructionXs: [-4, -2, 0, 2, 4],
        },
      ],
    });

    expect(
      compiled.spec.primitives.some((primitive) => primitive.type === "POLYLINE"),
    ).toBe(true);
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "GRAPH_CONSTRUCTION_POINT_OMITTED" }),
    );
  });

  it("omits a non-positive optional solid dimension without hiding the solid", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 8,
      family: "SPATIAL_APPLIED",
      archetype: "CUBOID",
      variant: "RECTANGULAR_PRISM",
      pointLabels: [],
      dimensions: [
        { target: "chiều dài", value: 0, unit: "cm" },
        { target: "chiều rộng", value: 5, unit: "cm" },
      ],
    });

    expect(compiled.spec.primitives.length).toBeGreaterThan(0);
    expect(compiled.spec.labels.map((label) => label.text)).toContain("5 cm");
    expect(compiled.spec.labels.map((label) => label.text)).not.toContain("0 cm");
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "SPATIAL_DIMENSION_OMITTED" }),
    );
  });

  it("uses endpoint ticks when a measurement step exceeds the whole range", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      grade: 4,
      family: "ELEMENTARY_MODEL",
      archetype: "MEASUREMENT_SCALE",
      variant: "RULER",
      min: 0,
      max: 10,
      step: 20,
      value: 6,
      unit: "cm",
    });

    expect(compiled.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["0", "10", "6", "cm"]),
    );
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "MEASUREMENT_STEP_RECOVERED" }),
    );
  });

  it("omits invalid schematic edges while preserving valid nodes and edges", () => {
    const compiled = compileLessonSummaryDiagramIntentWithDiagnostics({
      ...base,
      family: "SET_SCHEMATIC",
      archetype: "FLOW",
      nodes: [
        { id: "start", label: "Bắt đầu", group: null },
        { id: "finish", label: "Kết thúc", group: null },
      ],
      edges: [
        { from: "start", to: "finish", label: null },
        { from: "start", to: "missing", label: null },
        { from: "finish", to: "finish", label: null },
      ],
      setLabels: [],
    });

    expect(compiled.spec.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["Bắt đầu", "Kết thúc"]),
    );
    expect(compiled.semanticIssues).toContainEqual(
      expect.objectContaining({ code: "SCHEMATIC_EDGE_OMITTED" }),
    );
  });
});
