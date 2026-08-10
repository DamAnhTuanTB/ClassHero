import { z } from "zod";

const safeText = z.string().trim().min(1).max(160);
const shortLabel = z.string().trim().min(1).max(24);
const pointLabel = z
  .string()
  .trim()
  .regex(/^[A-Z](?:['′″]|[0-9₀-₉]){0,3}$/u)
  .max(8);
const finiteValue = z.number().finite().min(-10_000).max(10_000);
const positiveValue = z.number().finite().positive().max(10_000);
const difficulty = z.enum(["SIMPLE", "MEDIUM", "HARD"]);
const baseIntentShape = {
  intentVersion: z.literal(1),
  grade: z.number().int().min(3).max(9),
  difficulty,
  caption: safeText.nullable(),
};

const multiplicationArrayIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ELEMENTARY_MODEL"),
    archetype: z.literal("MULTIPLICATION_ARRAY"),
    rows: z.number().int().min(1).max(12),
    columns: z.number().int().min(1).max(12),
    rowLabel: shortLabel.nullable(),
    columnLabel: shortLabel.nullable(),
  })
  .strict();

const tapeComparisonIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ELEMENTARY_MODEL"),
    archetype: z.literal("TAPE_COMPARISON"),
    bars: z
      .array(
        z
          .object({
            label: shortLabel,
            parts: z.array(positiveValue).min(1).max(8),
            partLabels: z.array(shortLabel).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    unit: shortLabel.nullable(),
  })
  .strict();

const fractionModelIntentTransportSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ELEMENTARY_MODEL"),
    archetype: z.literal("FRACTION_MODEL"),
    numerator: z.number().int().min(0).max(24),
    denominator: z.number().int().min(1).max(24),
    shape: z.enum(["BAR", "CIRCLE"]),
    fractionLabel: shortLabel.nullable(),
  })
  .strict();

const fractionModelIntentSchema = fractionModelIntentTransportSchema.superRefine(
  (intent, context) => {
    if (intent.numerator <= intent.denominator) return;
    context.addIssue({
      code: "custom",
      path: ["numerator"],
      message: "A single fraction model cannot shade more parts than its denominator.",
    });
  },
);

const rectilinearCompositeIntentTransportSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ELEMENTARY_MODEL"),
    archetype: z.literal("RECTILINEAR_COMPOSITE"),
    outerWidth: positiveValue,
    outerHeight: positiveValue,
    cutoutWidth: positiveValue,
    cutoutHeight: positiveValue,
    unit: shortLabel,
  })
  .strict();

const rectilinearCompositeIntentSchema =
  rectilinearCompositeIntentTransportSchema.superRefine((intent, context) => {
    if (
      intent.cutoutWidth < intent.outerWidth &&
      intent.cutoutHeight < intent.outerHeight
    ) {
      return;
    }
    context.addIssue({
      code: "custom",
      path: ["cutoutWidth"],
      message: "The cutout must be smaller than the outer rectangle in both dimensions.",
    });
  });

const measurementScaleIntentTransportSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ELEMENTARY_MODEL"),
    archetype: z.literal("MEASUREMENT_SCALE"),
    variant: z.enum(["RULER", "THERMOMETER"]),
    min: finiteValue,
    max: finiteValue,
    step: positiveValue,
    value: finiteValue,
    unit: shortLabel,
  })
  .strict();

const measurementScaleIntentSchema = measurementScaleIntentTransportSchema.superRefine(
  (intent, context) => {
    if (
      intent.min < intent.max &&
      intent.value >= intent.min &&
      intent.value <= intent.max
    ) {
      return;
    }
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "Measurement value must lie inside an increasing scale domain.",
    });
  },
);

const numberLinePointSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
      .max(64),
    label: pointLabel,
    value: finiteValue,
    endpoint: z.enum(["POINT", "CLOSED", "OPEN"]),
  })
  .strict();

const numberLineIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("NUMBER_COORDINATE"),
    archetype: z.literal("NUMBER_LINE"),
    min: finiteValue,
    max: finiteValue,
    step: positiveValue,
    points: z.array(numberLinePointSchema).max(16),
  })
  .strict();

const intervalIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("NUMBER_COORDINATE"),
    archetype: z.literal("INTERVAL"),
    min: finiteValue,
    max: finiteValue,
    step: positiveValue,
    left: finiteValue,
    right: finiteValue,
    leftClosed: z.boolean(),
    rightClosed: z.boolean(),
    intervalLabel: shortLabel.nullable(),
  })
  .strict();

const coordinatePointSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
      .max(64),
    label: pointLabel,
    x: finiteValue,
    y: finiteValue,
    showProjections: z.boolean(),
  })
  .strict();

const coordinatePointsIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("NUMBER_COORDINATE"),
    archetype: z.literal("COORDINATE_POINTS"),
    xMin: finiteValue,
    xMax: finiteValue,
    yMin: finiteValue,
    yMax: finiteValue,
    xStep: positiveValue,
    yStep: positiveValue,
    points: z.array(coordinatePointSchema).min(1).max(16),
  })
  .strict();

const inequalityRegionIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("NUMBER_COORDINATE"),
    archetype: z.literal("INEQUALITY_REGION"),
    xMin: finiteValue,
    xMax: finiteValue,
    yMin: finiteValue,
    yMax: finiteValue,
    tickStep: positiveValue,
    boundaries: z
      .array(
        z
          .object({
            a: finiteValue,
            b: finiteValue,
            c: finiteValue,
            operator: z.enum(["LE", "LT", "GE", "GT"]),
            label: safeText,
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

const graphFunctionTransportSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("LINEAR"),
      id: z
        .string()
        .trim()
        .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
        .max(64),
      label: safeText,
      slope: finiteValue,
      intercept: finiteValue,
      constructionXs: z.array(finiteValue).min(2).max(8),
    })
    .strict(),
  z
    .object({
      kind: z.literal("QUADRATIC"),
      id: z
        .string()
        .trim()
        .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
        .max(64),
      label: safeText,
      a: finiteValue,
      b: finiteValue,
      c: finiteValue,
      constructionXs: z.array(finiteValue).min(3).max(9),
    })
    .strict(),
  z
    .object({
      kind: z.literal("INVERSE"),
      id: z
        .string()
        .trim()
        .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
        .max(64),
      label: safeText,
      coefficient: finiteValue,
      constructionXs: z.array(finiteValue).min(4).max(10),
    })
    .strict(),
]);

const graphFunctionSchema = graphFunctionTransportSchema.superRefine((fn, context) => {
  if (fn.kind === "QUADRATIC" && fn.a === 0) {
    context.addIssue({
      code: "custom",
      path: ["a"],
      message: "Quadratic coefficient a cannot be zero.",
    });
  }
  if (fn.kind !== "INVERSE") return;
  if (fn.coefficient === 0) {
    context.addIssue({
      code: "custom",
      path: ["coefficient"],
      message: "Inverse coefficient cannot be zero.",
    });
  }
  fn.constructionXs.forEach((value, index) => {
    if (value !== 0) return;
    context.addIssue({
      code: "custom",
      path: ["constructionXs", index],
      message: "x cannot be zero.",
    });
  });
});

const algebraGraphIntentTransportSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ALGEBRA_GRAPH"),
    archetype: z.enum([
      "LINEAR_FUNCTION",
      "QUADRATIC_FUNCTION",
      "LINEAR_SYSTEM",
      "LINE_QUADRATIC_INTERSECTION",
      "INVERSE_FUNCTION",
    ]),
    xMin: finiteValue,
    xMax: finiteValue,
    yMin: finiteValue,
    yMax: finiteValue,
    xStep: positiveValue,
    yStep: positiveValue,
    functions: z.array(graphFunctionTransportSchema).min(1).max(3),
  })
  .strict();

const algebraGraphIntentSchema = algebraGraphIntentTransportSchema.superRefine(
  (intent, context) => {
    intent.functions.forEach((fn, index) => {
      const result = graphFunctionSchema.safeParse(fn);
      if (result.success) return;
      result.error.issues.forEach((issue) =>
        context.addIssue({
          code: "custom",
          path: ["functions", index, ...issue.path],
          message: issue.message,
        }),
      );
    });
  },
);

const dataSeriesSchema = z
  .object({
    label: shortLabel,
    values: z.array(finiteValue.min(0)).min(1).max(16),
  })
  .strict();

const valueTableIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("DATA_STATISTICS"),
    archetype: z.literal("VALUE_TABLE"),
    columns: z.array(shortLabel).min(1).max(8),
    rows: z.array(z.array(shortLabel).min(1).max(8)).min(1).max(12),
  })
  .strict();

const chartIntentTransportSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("DATA_STATISTICS"),
    archetype: z.enum(["BAR_CHART", "LINE_CHART", "HISTOGRAM", "PIE_CHART"]),
    categories: z.array(shortLabel).min(1).max(16),
    series: z.array(dataSeriesSchema).min(1).max(4),
    yStep: positiveValue,
    unit: shortLabel.nullable(),
  })
  .strict();

const chartIntentSchema = chartIntentTransportSchema.superRefine((intent, context) => {
  intent.series.forEach((series, seriesIndex) => {
    if (series.values.length === intent.categories.length) return;
    context.addIssue({
      code: "custom",
      path: ["series", seriesIndex, "values"],
      message: "Every chart series must contain one value for each category.",
    });
  });
  if (intent.archetype !== "PIE_CHART") return;
  if (intent.series.length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["series"],
      message: "A pie chart must contain exactly one data series.",
    });
  }
  if ((intent.series[0]?.values.reduce((sum, value) => sum + value, 0) ?? 0) <= 0) {
    context.addIssue({
      code: "custom",
      path: ["series", 0, "values"],
      message: "Pie chart values must have a positive total.",
    });
  }
});

const clockIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("DATA_STATISTICS"),
    archetype: z.literal("CLOCK"),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  })
  .strict();

const pictogramIntentTransportSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("DATA_STATISTICS"),
    archetype: z.literal("PICTOGRAM"),
    categories: z.array(shortLabel).min(1).max(8),
    values: z.array(z.number().int().nonnegative().max(240)).min(1).max(8),
    valuePerSymbol: z.number().int().positive().max(100),
    symbol: z.enum(["CIRCLE", "SQUARE", "STAR"]),
    unit: shortLabel,
  })
  .strict();

const pictogramIntentSchema = pictogramIntentTransportSchema.superRefine(
  (intent, context) => {
    if (intent.categories.length !== intent.values.length) {
      context.addIssue({
        code: "custom",
        path: ["values"],
        message: "Pictogram values must match the category count.",
      });
    }
    intent.values.forEach((value, index) => {
      if (value % intent.valuePerSymbol === 0) return;
      context.addIssue({
        code: "custom",
        path: ["values", index],
        message: "Every pictogram value must be divisible by valuePerSymbol.",
      });
    });
  },
);

const planeGeometryIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("PLANE_GEOMETRY"),
    archetype: z.enum([
      "ANGLE_RAYS",
      "TRIANGLE",
      "QUADRILATERAL",
      "PARALLEL_TRANSVERSAL",
      "CIRCLE_PARTS",
      "SYMMETRY",
      "RIGHT_TRIANGLE_CONGRUENCE",
      "BASIC_CONSTRUCTION",
      "REGULAR_POLYGON",
    ]),
    variant: z.enum([
      "GENERAL",
      "ACUTE",
      "RIGHT",
      "OBTUSE",
      "STRAIGHT",
      "ISOSCELES",
      "EQUILATERAL",
      "RECTANGLE",
      "SQUARE",
      "PARALLELOGRAM",
      "TRAPEZOID",
      "RHOMBUS",
      "KITE",
      "LINE_RAY_SEGMENT",
      "MIDPOINT",
      "PERPENDICULAR",
      "REGULAR_HEXAGON",
      "RADIUS_DIAMETER_CHORD",
      "ARC_SECTOR",
      "AXIAL",
      "CENTRAL",
      "TWO_LEGS",
      "HYPOTENUSE_ACUTE_ANGLE",
      "HYPOTENUSE_LEG",
      "SHARED_HYPOTENUSE_LEG",
    ]),
    pointLabels: z.array(pointLabel).min(2).max(8),
    measures: z
      .array(
        z
          .object({
            target: z.string().trim().min(1).max(64),
            text: shortLabel,
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

const advancedGeometryIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("ADVANCED_GEOMETRY"),
    archetype: z.enum([
      "TRIANGLE_CENTROID",
      "TRIANGLE_CONCURRENCY",
      "THALES",
      "RIGHT_TRIANGLE_ALTITUDE",
      "CIRCLE_RELATIONS",
      "TRIANGLE_SIMILARITY",
    ]),
    variant: z.enum([
      "THREE_MEDIANS",
      "ANGLE_BISECTORS",
      "PERPENDICULAR_BISECTORS",
      "ALTITUDES",
      "PARALLEL_SEGMENT",
      "ALTITUDE_TO_HYPOTENUSE",
      "TANGENT",
      "INTERSECTING_CHORDS",
      "CYCLIC_QUADRILATERAL",
      "INCIRCLE",
      "CIRCUMCIRCLE",
      "CENTRAL_INSCRIBED_ANGLES",
      "TWO_CIRCLES",
      "AA_SIMILARITY",
      "SAS_SIMILARITY",
      "SSS_SIMILARITY",
    ]),
    pointLabels: z.array(pointLabel).min(4).max(12),
    measures: z
      .array(
        z
          .object({
            target: z.string().trim().min(1).max(64),
            text: shortLabel,
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

const spatialAppliedIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("SPATIAL_APPLIED"),
    archetype: z.enum([
      "CUBOID",
      "PRISM_OR_PYRAMID",
      "CYLINDER",
      "CONE_OR_SPHERE",
      "APPLIED_RIGHT_TRIANGLE",
      "NET",
    ]),
    variant: z.enum([
      "CUBE",
      "RECTANGULAR_PRISM",
      "TRIANGULAR_PRISM",
      "PYRAMID",
      "TRIANGULAR_PYRAMID",
      "CYLINDER",
      "CONE",
      "SPHERE",
      "LADDER",
      "SHADOW",
      "HEIGHT_DISTANCE",
      "CUBE_NET",
      "CUBOID_NET",
    ]),
    pointLabels: z.array(pointLabel).max(12),
    dimensions: z
      .array(
        z
          .object({
            target: z.string().trim().min(1).max(64),
            value: positiveValue,
            unit: shortLabel,
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

const schematicNodeSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
      .max(64),
    label: shortLabel,
    group: shortLabel.nullable(),
  })
  .strict();

const setSchematicIntentSchema = z
  .object({
    ...baseIntentShape,
    family: z.literal("SET_SCHEMATIC"),
    archetype: z.enum(["VENN", "VENN_UNIVERSE", "TREE", "FLOW", "NETWORK"]),
    nodes: z.array(schematicNodeSchema).min(1).max(24),
    edges: z
      .array(
        z
          .object({
            from: z.string().trim().min(1).max(64),
            to: z.string().trim().min(1).max(64),
            label: shortLabel.nullable(),
          })
          .strict(),
      )
      .max(32),
    setLabels: z.array(shortLabel).max(4),
  })
  .strict();

export const lessonSummaryDiagramIntentTransportSchema = z.union([
  z.discriminatedUnion("archetype", [
    multiplicationArrayIntentSchema,
    tapeComparisonIntentSchema,
    fractionModelIntentTransportSchema,
    rectilinearCompositeIntentTransportSchema,
    measurementScaleIntentTransportSchema,
  ]),
  z.discriminatedUnion("archetype", [
    numberLineIntentSchema,
    intervalIntentSchema,
    coordinatePointsIntentSchema,
    inequalityRegionIntentSchema,
  ]),
  algebraGraphIntentTransportSchema,
  z.discriminatedUnion("archetype", [
    valueTableIntentSchema,
    chartIntentTransportSchema,
    clockIntentSchema,
    pictogramIntentTransportSchema,
  ]),
  planeGeometryIntentSchema,
  advancedGeometryIntentSchema,
  spatialAppliedIntentSchema,
  setSchematicIntentSchema,
]);

export const lessonSummaryDiagramIntentSchema = z
  .union([
    z.discriminatedUnion("archetype", [
      multiplicationArrayIntentSchema,
      tapeComparisonIntentSchema,
      fractionModelIntentSchema,
      rectilinearCompositeIntentSchema,
      measurementScaleIntentSchema,
    ]),
    z.discriminatedUnion("archetype", [
      numberLineIntentSchema,
      intervalIntentSchema,
      coordinatePointsIntentSchema,
      inequalityRegionIntentSchema,
    ]),
    algebraGraphIntentSchema,
    z.discriminatedUnion("archetype", [
      valueTableIntentSchema,
      chartIntentSchema,
      clockIntentSchema,
      pictogramIntentSchema,
    ]),
    planeGeometryIntentSchema,
    advancedGeometryIntentSchema,
    spatialAppliedIntentSchema,
    setSchematicIntentSchema,
  ])
  .superRefine((intent, context) => {
    if (!("variant" in intent)) return;
    const allowedVariants = resolveAllowedVariants(intent.family, intent.archetype);
    if (allowedVariants?.includes(intent.variant)) return;
    context.addIssue({
      code: "custom",
      path: ["variant"],
      message: `${intent.archetype} does not support variant ${intent.variant}.`,
    });
  });

function resolveAllowedVariants(family: string, archetype: string): string[] | null {
  if (family === "ELEMENTARY_MODEL") {
    return (
      {
        MEASUREMENT_SCALE: ["RULER", "THERMOMETER"],
      }[archetype] ?? null
    );
  }
  if (family === "PLANE_GEOMETRY") {
    return (
      {
        ANGLE_RAYS: ["GENERAL", "ACUTE", "RIGHT", "OBTUSE", "STRAIGHT"],
        TRIANGLE: ["GENERAL", "ACUTE", "RIGHT", "OBTUSE", "ISOSCELES", "EQUILATERAL"],
        QUADRILATERAL: [
          "GENERAL",
          "RECTANGLE",
          "SQUARE",
          "PARALLELOGRAM",
          "TRAPEZOID",
          "RHOMBUS",
          "KITE",
        ],
        BASIC_CONSTRUCTION: ["LINE_RAY_SEGMENT", "MIDPOINT", "PERPENDICULAR"],
        REGULAR_POLYGON: ["REGULAR_HEXAGON"],
        PARALLEL_TRANSVERSAL: ["GENERAL"],
        CIRCLE_PARTS: ["RADIUS_DIAMETER_CHORD", "ARC_SECTOR"],
        SYMMETRY: ["AXIAL", "CENTRAL"],
        RIGHT_TRIANGLE_CONGRUENCE: [
          "TWO_LEGS",
          "HYPOTENUSE_ACUTE_ANGLE",
          "HYPOTENUSE_LEG",
          "SHARED_HYPOTENUSE_LEG",
        ],
      }[archetype] ?? null
    );
  }
  if (family === "ADVANCED_GEOMETRY") {
    return (
      {
        TRIANGLE_CENTROID: ["THREE_MEDIANS"],
        TRIANGLE_CONCURRENCY: ["ANGLE_BISECTORS", "PERPENDICULAR_BISECTORS", "ALTITUDES"],
        THALES: ["PARALLEL_SEGMENT"],
        RIGHT_TRIANGLE_ALTITUDE: ["ALTITUDE_TO_HYPOTENUSE"],
        CIRCLE_RELATIONS: [
          "TANGENT",
          "INTERSECTING_CHORDS",
          "CYCLIC_QUADRILATERAL",
          "INCIRCLE",
          "CIRCUMCIRCLE",
          "CENTRAL_INSCRIBED_ANGLES",
          "TWO_CIRCLES",
        ],
        TRIANGLE_SIMILARITY: ["AA_SIMILARITY", "SAS_SIMILARITY", "SSS_SIMILARITY"],
      }[archetype] ?? null
    );
  }
  if (family === "SPATIAL_APPLIED") {
    return (
      {
        CUBOID: ["CUBE", "RECTANGULAR_PRISM"],
        PRISM_OR_PYRAMID: ["TRIANGULAR_PRISM", "PYRAMID", "TRIANGULAR_PYRAMID"],
        CYLINDER: ["CYLINDER"],
        CONE_OR_SPHERE: ["CONE", "SPHERE"],
        APPLIED_RIGHT_TRIANGLE: ["LADDER", "SHADOW", "HEIGHT_DISTANCE"],
        NET: ["CUBE_NET", "CUBOID_NET"],
      }[archetype] ?? null
    );
  }
  return null;
}

export type LessonSummaryDiagramIntent = z.infer<typeof lessonSummaryDiagramIntentSchema>;

export type LessonSummaryDiagramFamily = LessonSummaryDiagramIntent["family"];
export type LessonSummaryDiagramDifficulty = z.infer<typeof difficulty>;
