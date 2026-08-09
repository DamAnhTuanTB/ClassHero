import { z } from "zod";

const safeId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u);
const finiteCoordinate = z.number().finite().min(-10_000).max(10_000);
const positiveMeasure = z.number().finite().positive().max(10_000);
const safeLabel = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine(
    (value) =>
      !/(?:<\/?(?:script|style|iframe|object|embed|svg)\b|javascript:|data:|https?:\/\/)/iu.test(
        value,
      ),
    "Diagram labels cannot contain markup, scripts, data URIs, or remote URLs.",
  );

export const lessonSummaryDiagramPointSchema = z
  .object({
    id: safeId,
    x: finiteCoordinate,
    y: finiteCoordinate,
    label: safeLabel.nullable(),
    labelPosition: z
      .enum([
        "TOP",
        "TOP_RIGHT",
        "RIGHT",
        "BOTTOM_RIGHT",
        "BOTTOM",
        "BOTTOM_LEFT",
        "LEFT",
        "TOP_LEFT",
      ])
      .nullable(),
  })
  .strict();

const lineStyleSchema = z.enum(["SOLID", "DASHED", "DOTTED"]);
const fillStyleSchema = z.enum(["NONE", "SOFT_BLUE", "SOFT_AMBER", "SOFT_GREEN"]);

const segmentLikeSchema = z.object({
  id: safeId,
  from: safeId,
  to: safeId,
  style: lineStyleSchema,
});

export const lessonSummaryDiagramPrimitiveSchema = z.discriminatedUnion("type", [
  segmentLikeSchema
    .extend({
      type: z.literal("SEGMENT").describe("Dùng đúng cho một đoạn thẳng hữu hạn."),
    })
    .strict(),
  segmentLikeSchema
    .extend({
      type: z.literal("LINE").describe("Dùng đúng cho một đường thẳng hai chiều."),
    })
    .strict(),
  segmentLikeSchema
    .extend({
      type: z.literal("RAY").describe("Dùng đúng cho một tia bắt đầu tại from."),
    })
    .strict(),
  z
    .object({
      id: safeId,
      type: z
        .literal("POLYLINE")
        .describe(
          "Đường gấp khúc mở qua các điểm theo thứ tự; dùng nhiều điểm đúng tỉ lệ để xấp xỉ đồ thị cong, không lặp điểm đầu ở cuối.",
        ),
      pointIds: z.array(safeId).min(2).max(64),
      style: lineStyleSchema,
    })
    .strict(),
  z
    .object({
      id: safeId,
      type: z.literal("POLYGON"),
      pointIds: z
        .array(safeId)
        .min(3)
        .max(32)
        .describe(
          "Các đỉnh phân biệt của một hình kín theo thứ tự; không lặp lại đỉnh đầu ở cuối và không dùng POLYGON để vẽ tia, đường hay đoạn thẳng.",
        ),
      fill: fillStyleSchema,
      style: lineStyleSchema,
    })
    .strict(),
  z
    .object({
      id: safeId,
      type: z.literal("CIRCLE"),
      center: safeId,
      radius: positiveMeasure,
      style: lineStyleSchema,
    })
    .strict(),
  z
    .object({
      id: safeId,
      type: z.literal("ARC"),
      center: safeId,
      radius: positiveMeasure,
      startAngle: z.number().finite().min(-720).max(720),
      endAngle: z.number().finite().min(-720).max(720),
      style: lineStyleSchema,
    })
    .strict(),
]);

export const lessonSummaryDiagramMarkerSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("RIGHT_ANGLE"),
      vertex: safeId,
      armPointIds: z
        .array(safeId)
        .length(2)
        .describe("Hai điểm khác nhau, đều khác vertex, xác định hai cạnh của góc."),
    })
    .strict(),
  z
    .object({
      type: z.literal("EQUAL_LENGTH"),
      segmentIds: z.array(safeId).min(1).max(16),
      markCount: z.number().int().min(1).max(4),
    })
    .strict(),
  z
    .object({
      type: z.literal("PARALLEL"),
      segmentIds: z.array(safeId).min(2).max(16),
      markCount: z.number().int().min(1).max(4),
    })
    .strict(),
  z
    .object({
      type: z.literal("ANGLE"),
      vertex: safeId,
      armPointIds: z
        .array(safeId)
        .length(2)
        .describe("Hai điểm khác nhau, đều khác vertex, xác định hai cạnh của góc."),
      label: safeLabel,
    })
    .strict(),
]);

export const lessonSummaryDiagramLabelSchema = z
  .object({
    text: safeLabel,
    anchorPointId: safeId,
    position: z.enum([
      "TOP",
      "TOP_RIGHT",
      "RIGHT",
      "BOTTOM_RIGHT",
      "BOTTOM",
      "BOTTOM_LEFT",
      "LEFT",
      "TOP_LEFT",
    ]),
  })
  .strict();

export const lessonSummaryDiagramSpecSchema = z
  .object({
    version: z.literal(1),
    coordinateSystem: z.literal("CARTESIAN"),
    viewBox: z
      .object({
        minX: finiteCoordinate,
        minY: finiteCoordinate,
        width: positiveMeasure,
        height: positiveMeasure,
      })
      .strict(),
    toScale: z.literal(true),
    points: z.array(lessonSummaryDiagramPointSchema).min(2).max(64),
    primitives: z.array(lessonSummaryDiagramPrimitiveSchema).min(1).max(96),
    markers: z.array(lessonSummaryDiagramMarkerSchema).max(64),
    labels: z.array(lessonSummaryDiagramLabelSchema).max(64),
    caption: safeLabel.nullable(),
  })
  .strict();

export const lessonSummaryDiagramVisualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z
    .object({
      kind: z.literal("DIAGRAM_SPEC"),
      spec: lessonSummaryDiagramSpecSchema,
    })
    .strict(),
]);

export type LessonSummaryDiagramSpec = z.infer<typeof lessonSummaryDiagramSpecSchema>;
export type LessonSummaryDiagramVisual = z.infer<typeof lessonSummaryDiagramVisualSchema>;
