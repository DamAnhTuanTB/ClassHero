import {
  lessonSummaryDiagramLabelSchema,
  lessonSummaryDiagramPointSchema,
  lessonSummaryDiagramSpecSchema,
  lessonSummaryDiagramSpecStructuralSchema,
} from "@learning-path/shared";
import { z } from "zod";

import {
  lessonSummaryDiagramIntentSchema,
  lessonSummaryDiagramIntentTransportSchema,
} from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { compileLessonSummaryDiagramIntentWithDiagnostics } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

const safeId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u);
const pointReference = safeId.describe(
  "ID của một điểm đã khai báo trong points của cùng diagramSpec.",
);
const primitiveId = safeId.describe(
  "ID duy nhất của primitive; marker phải dùng lại chính xác ID này khi tham chiếu.",
);
const finiteCoordinate = z.number().finite().min(-10_000).max(10_000);
const positiveMeasure = z.number().finite().positive().max(10_000);
const lineStyleSchema = z.enum(["SOLID", "DASHED", "DOTTED"]);
const fillStyleSchema = z.enum(["NONE", "SOFT_BLUE", "SOFT_AMBER", "SOFT_GREEN"]);
const GEOMETRY_RELATION_TOLERANCE = 0.02;
const providerOptionalPointLabelSchema = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^(?:[A-Z](?:['′″]|[0-9₀-₉]){0,3}|\$[A-Z](?:['′″]|[0-9₀-₉]){0,3}\$)$/u),
]);
const providerOptionalDiagramLabelTextSchema = z.union([
  z.literal(""),
  lessonSummaryDiagramLabelSchema.shape.text,
]);
const providerOptionalSafeTextSchema = z.union([
  z.literal(""),
  z.string().trim().min(1).max(160),
]);
const providerDiagramPointSchema = lessonSummaryDiagramPointSchema
  .extend({
    label: providerOptionalPointLabelSchema.nullable(),
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
    pointStyle: z
      .enum(["NONE", "FILLED", "OPEN"])
      .describe(
        "NONE cho đỉnh tam giác/tứ giác, neo text và điểm lấy mẫu làm mượt; FILLED hoặc OPEN cho điểm dựng đồ thị có ý nghĩa, điểm độc lập cần nhấn mạnh hay đầu mút đóng/mở.",
      ),
  })
  .strict();
const providerDiagramLabelSchema = lessonSummaryDiagramLabelSchema
  .extend({
    text: providerOptionalDiagramLabelTextSchema,
    anchorPrimitiveId: primitiveId
      .nullable()
      .describe(
        "ID SEGMENT để neo nhãn độ dài vào trung điểm; null cho nhãn điểm, trục, ô bảng hoặc chú thích khác.",
      ),
  })
  .strict();

const segmentSchema = z
  .object({
    id: primitiveId,
    from: pointReference,
    to: pointReference,
    style: lineStyleSchema,
  })
  .strict();

const pointListPrimitiveSchema = z
  .object({
    id: primitiveId,
    pointIds: z.array(pointReference).min(2).max(64),
    style: lineStyleSchema,
  })
  .strict();

export const lessonSummaryProviderDiagramSpecTransportSchema = z
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
    points: z
      .array(providerDiagramPointSchema)
      .min(2)
      .max(64)
      .describe(
        "Mỗi đỉnh chỉ khai báo một lần; point.id và point.label phải duy nhất. Không hiện chấm cho mọi point một cách máy móc.",
      ),
    primitives: z
      .object({
        segments: z
          .array(segmentSchema)
          .max(16)
          .describe(
            "Mọi cạnh hữu hạn, đặc biệt cạnh tam giác, phải nằm ở đây. Một tam giác dùng đúng 3 segment; hai tam giác tách rời dùng đúng 6 segment.",
          ),
        lines: z
          .array(segmentSchema)
          .max(4)
          .describe("Chỉ dùng cho đường thẳng hai chiều thật sự có trong đề."),
        rays: z
          .array(segmentSchema)
          .max(8)
          .describe("Chỉ dùng cho tia có điểm đầu from và đi qua to."),
        polylines: z
          .array(pointListPrimitiveSchema)
          .max(4)
          .describe("Chỉ dùng cho đường gấp khúc hoặc đồ thị cong qua nhiều điểm."),
        polygons: z
          .array(
            pointListPrimitiveSchema
              .extend({
                pointIds: z.array(pointReference).min(3).max(32),
                fill: fillStyleSchema,
              })
              .strict(),
          )
          .max(4)
          .describe("Chỉ dùng để tô hình kín; không thay thế các segment cạnh."),
        circles: z
          .array(
            z
              .object({
                id: primitiveId,
                center: pointReference,
                radius: positiveMeasure,
                style: lineStyleSchema,
              })
              .strict(),
          )
          .max(4)
          .describe("Để rỗng nếu đề không cần đường tròn; không dùng làm placeholder."),
        ellipses: z
          .array(
            z
              .object({
                id: primitiveId,
                center: pointReference,
                radiusX: positiveMeasure,
                radiusY: positiveMeasure,
                rotation: z.number().finite().min(-360).max(360),
                style: lineStyleSchema,
              })
              .strict(),
          )
          .max(4)
          .describe(
            "Dùng cho ellipse thật hoặc đường tròn nhìn phối cảnh của khối trụ/nón/cầu; để rỗng nếu không cần.",
          ),
        arcs: z
          .array(
            z
              .object({
                id: primitiveId,
                center: pointReference,
                radius: positiveMeasure,
                startAngle: z
                  .number()
                  .finite()
                  .min(-720)
                  .max(720)
                  .describe(
                    "Góc đầu theo hệ Descartes: 0° hướng sang phải, 90° hướng lên; cung chạy theo chiều góc tăng dương đến endAngle.",
                  ),
                endAngle: z
                  .number()
                  .finite()
                  .min(-720)
                  .max(720)
                  .describe(
                    "Góc cuối theo hệ Descartes; phải khớp tọa độ điểm mà cung đi qua và tạo cung ngắn cần minh họa.",
                  ),
                style: lineStyleSchema,
              })
              .strict(),
          )
          .max(4)
          .describe(
            "Chỉ dùng cho cung thật sự có trong đề hoặc thao tác compa; cạnh tam giác không nằm ở đây.",
          ),
      })
      .strict(),
    markers: z
      .object({
        rightAngles: z
          .array(
            z
              .object({
                vertex: pointReference,
                armPointIds: z.array(pointReference).length(2),
              })
              .strict(),
          )
          .max(8)
          .describe(
            "Tọa độ hai arm phải thật sự vuông góc tại vertex; tích vô hướng chuẩn hóa không vượt quá 2%.",
          ),
        equalLengths: z
          .array(
            z
              .object({
                segmentIds: z
                  .array(primitiveId)
                  .min(2)
                  .max(16)
                  .describe("Mỗi ID phải khớp chính xác ID trong primitives.segments."),
                markCount: z.number().int().min(1).max(4),
              })
              .strict(),
          )
          .max(8)
          .describe(
            "Mỗi nhóm chỉ đánh dấu các segment có độ dài tọa độ bằng nhau trong sai số tối đa 2%; không chỉ gắn marker lên các cạnh có độ dài khác nhau.",
          ),
        parallels: z
          .array(
            z
              .object({
                segmentIds: z
                  .array(primitiveId)
                  .min(2)
                  .max(16)
                  .describe("Mỗi ID phải khớp chính xác ID trong primitives.segments."),
                markCount: z.number().int().min(1).max(4),
              })
              .strict(),
          )
          .max(8),
        angles: z
          .array(
            z
              .object({
                vertex: pointReference,
                armPointIds: z.array(pointReference).length(2),
                label: providerOptionalSafeTextSchema.nullable(),
              })
              .strict(),
          )
          .max(8),
      })
      .strict(),
    labels: z.array(providerDiagramLabelSchema).max(32),
    caption: providerOptionalSafeTextSchema.nullable(),
  })
  .strict();

type LessonSummaryProviderDiagramSpecInput = z.infer<
  typeof lessonSummaryProviderDiagramSpecTransportSchema
>;

export const lessonSummaryProviderDiagramSpecSchema =
  lessonSummaryProviderDiagramSpecTransportSchema.superRefine((spec, context) => {
    let mapped;
    try {
      mapped = mapLessonSummaryProviderDiagramSpec(spec);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          context.addIssue({
            code: "custom",
            path: issue.path,
            message: issue.message,
          });
        });
        return;
      }
      context.addIssue({
        code: "custom",
        message: "Diagram references could not be validated.",
      });
      return;
    }

    const semanticResult = lessonSummaryDiagramSpecSchema.safeParse(mapped);
    if (!semanticResult.success) {
      semanticResult.error.issues.forEach((issue) => {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      });
    }

    addProviderGeometryRelationIssues(spec, context);
  });

const providerDiagramIntentEnvelopeSchema = z
  .object({
    kind: z.literal("INTENT"),
    intent: lessonSummaryDiagramIntentSchema.describe(
      "Chỉ chọn INTENT khi family/archetype này biểu diễn đầy đủ mọi điểm, đoạn/nét và quan hệ bắt buộc của nội dung. Backend chịu trách nhiệm dựng tọa độ, vạch chia, điểm phụ kỹ thuật, marker và bố trí nhãn; backend không tự bổ sung thực thể toán học đã bị bỏ khỏi intent.",
    ),
  })
  .strict();

const providerDiagramIntentTransportEnvelopeSchema = z
  .object({
    kind: z.literal("INTENT"),
    intent: lessonSummaryDiagramIntentTransportSchema,
  })
  .strict();

const providerRawDiagramEnvelopeSchema = z
  .object({
    kind: z.literal("RAW_SPEC"),
    spec: lessonSummaryProviderDiagramSpecSchema.describe(
      "Bắt buộc dùng khi không có family/archetype INTENT nào biểu diễn đầy đủ mọi điểm, đoạn/nét hoặc quan hệ bắt buộc; không giản lược nội dung để ép vào INTENT gần nhất.",
    ),
  })
  .strict();

const providerRawDiagramTransportEnvelopeSchema = z
  .object({
    kind: z.literal("RAW_SPEC"),
    spec: lessonSummaryProviderDiagramSpecTransportSchema,
  })
  .strict();

export const lessonSummaryProviderDiagramTransportSchema = z.union([
  providerDiagramIntentTransportEnvelopeSchema,
  providerRawDiagramTransportEnvelopeSchema,
  lessonSummaryProviderDiagramSpecTransportSchema,
]);

/**
 * Provider-facing diagram input. New generations choose INTENT only when its
 * semantic contract is complete for the requested visual; otherwise they choose
 * RAW_SPEC. The legacy unwrapped raw shape remains accepted so cached responses
 * and existing drafts can still be parsed and repaired.
 */
export const lessonSummaryProviderDiagramInputSchema = z
  .union([
    providerDiagramIntentEnvelopeSchema,
    providerRawDiagramEnvelopeSchema,
    lessonSummaryProviderDiagramSpecSchema,
  ])
  .describe(
    "Chọn INTENT khi một archetype biểu diễn đầy đủ toàn bộ nội dung hình; nếu phải bỏ bất kỳ điểm, đoạn hoặc quan hệ bắt buộc nào thì chọn RAW_SPEC. Không chọn archetype gần nhất bằng cách giản lược đề. Dạng raw không bọc chỉ được giữ để tương thích dữ liệu cũ.",
  );

function addProviderGeometryRelationIssues(
  spec: LessonSummaryProviderDiagramSpecInput,
  context: z.RefinementCtx,
) {
  const pointsById = new Map(spec.points.map((point) => [point.id, point] as const));
  const segmentsById = new Map(
    spec.primitives.segments.map((segment) => [segment.id, segment] as const),
  );
  const resolveSegmentVector = (segmentId: string) => {
    const segment = segmentsById.get(segmentId);
    if (!segment) return null;
    const from = pointsById.get(segment.from);
    const to = pointsById.get(segment.to);
    if (!from || !to) return null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { dx, dy, length: Math.hypot(dx, dy) };
  };

  spec.markers.rightAngles.forEach((marker, markerIndex) => {
    const vertex = pointsById.get(marker.vertex);
    const first = pointsById.get(marker.armPointIds[0]!);
    const second = pointsById.get(marker.armPointIds[1]!);
    if (!vertex || !first || !second) return;
    const firstVector = { x: first.x - vertex.x, y: first.y - vertex.y };
    const secondVector = { x: second.x - vertex.x, y: second.y - vertex.y };
    const denominator =
      Math.hypot(firstVector.x, firstVector.y) *
      Math.hypot(secondVector.x, secondVector.y);
    const normalizedDot =
      denominator === 0
        ? Number.POSITIVE_INFINITY
        : Math.abs(firstVector.x * secondVector.x + firstVector.y * secondVector.y) /
          denominator;
    if (normalizedDot <= GEOMETRY_RELATION_TOLERANCE) return;
    context.addIssue({
      code: "custom",
      path: ["markers", "rightAngles", markerIndex],
      message: `RIGHT_ANGLE at ${marker.vertex} is not perpendicular according to the supplied coordinates.`,
    });
  });

  spec.markers.equalLengths.forEach((marker, markerIndex) => {
    const vectors = marker.segmentIds.map(resolveSegmentVector);
    if (vectors.some((vector) => vector === null)) return;
    const lengths = vectors.map((vector) => vector!.length);
    const largest = Math.max(...lengths);
    const smallest = Math.min(...lengths);
    if (largest > 0 && (largest - smallest) / largest <= GEOMETRY_RELATION_TOLERANCE) {
      return;
    }
    context.addIssue({
      code: "custom",
      path: ["markers", "equalLengths", markerIndex, "segmentIds"],
      message: `EQUAL_LENGTH segments must have coordinate lengths within 2%: ${marker.segmentIds.join(", ")}.`,
    });
  });

  spec.markers.parallels.forEach((marker, markerIndex) => {
    const vectors = marker.segmentIds.map(resolveSegmentVector);
    if (vectors.some((vector) => vector === null)) return;
    const [first, ...rest] = vectors as Array<{
      dx: number;
      dy: number;
      length: number;
    }>;
    if (
      first &&
      first.length > 0 &&
      rest.every((vector) => {
        const denominator = first.length * vector.length;
        return (
          denominator > 0 &&
          Math.abs(first.dx * vector.dy - first.dy * vector.dx) / denominator <=
            GEOMETRY_RELATION_TOLERANCE
        );
      })
    ) {
      return;
    }
    context.addIssue({
      code: "custom",
      path: ["markers", "parallels", markerIndex, "segmentIds"],
      message: `PARALLEL segments must have coordinate directions within 2%: ${marker.segmentIds.join(", ")}.`,
    });
  });
}

export function mapLessonSummaryProviderDiagramSpec(
  spec: LessonSummaryProviderDiagramSpecInput,
) {
  const repairedSpec = repairProviderNumberLineTicks(spec);
  return lessonSummaryDiagramSpecStructuralSchema.parse({
    version: repairedSpec.version,
    coordinateSystem: repairedSpec.coordinateSystem,
    viewBox: repairedSpec.viewBox,
    toScale: repairedSpec.toScale,
    points: repairedSpec.points,
    primitives: [
      ...repairedSpec.primitives.segments.map((primitive) => ({
        ...primitive,
        type: "SEGMENT" as const,
      })),
      ...repairedSpec.primitives.lines.map((primitive) => ({
        ...primitive,
        type: "LINE" as const,
      })),
      ...repairedSpec.primitives.rays.map((primitive) => ({
        ...primitive,
        type: "RAY" as const,
      })),
      ...repairedSpec.primitives.polylines.map((primitive) => ({
        ...primitive,
        type: "POLYLINE" as const,
      })),
      ...repairedSpec.primitives.polygons.map((primitive) => ({
        ...primitive,
        type: "POLYGON" as const,
      })),
      ...repairedSpec.primitives.circles.map((primitive) => ({
        ...primitive,
        type: "CIRCLE" as const,
      })),
      ...repairedSpec.primitives.ellipses.map((primitive) => ({
        ...primitive,
        type: "ELLIPSE" as const,
      })),
      ...repairedSpec.primitives.arcs.map((primitive) => ({
        ...primitive,
        type: "ARC" as const,
      })),
    ],
    markers: [
      ...repairedSpec.markers.rightAngles.map((marker) => ({
        ...marker,
        type: "RIGHT_ANGLE" as const,
      })),
      ...repairedSpec.markers.equalLengths.map((marker) => ({
        ...marker,
        type: "EQUAL_LENGTH" as const,
      })),
      ...repairedSpec.markers.parallels.map((marker) => ({
        ...marker,
        type: "PARALLEL" as const,
      })),
      ...repairedSpec.markers.angles.map((marker) => ({
        ...marker,
        type: "ANGLE" as const,
      })),
    ],
    labels: repairedSpec.labels,
    caption: repairedSpec.caption,
  });
}

export function mapLessonSummaryProviderDiagramInput(
  input: LessonSummaryProviderDiagramInput,
) {
  if ("kind" in input) {
    if (input.kind === "INTENT") {
      return compileLessonSummaryDiagramIntentWithDiagnostics(input.intent).spec;
    }
    return mapLessonSummaryProviderDiagramSpec(input.spec);
  }
  return mapLessonSummaryProviderDiagramSpec(input);
}

function repairProviderNumberLineTicks(
  spec: LessonSummaryProviderDiagramSpecInput,
): LessonSummaryProviderDiagramSpecInput {
  if (!/trục\s*số/iu.test(spec.caption ?? "")) return spec;
  const pointsById = new Map(spec.points.map((point) => [point.id, point] as const));
  const axis = spec.primitives.lines
    .map((line) => ({
      line,
      from: pointsById.get(line.from),
      to: pointsById.get(line.to),
    }))
    .find(
      (candidate) =>
        candidate.from &&
        candidate.to &&
        Math.abs(candidate.from.y - candidate.to.y) <= spec.viewBox.height * 0.02 &&
        Math.abs(candidate.from.x - candidate.to.x) >= spec.viewBox.width * 0.3,
    );
  if (!axis?.from || !axis.to) return spec;

  const numericLabels = spec.labels.flatMap((label) => {
    const value = parseNumberLineValue(label.text);
    const anchor = pointsById.get(label.anchorPointId);
    return value && anchor ? [{ anchor, ...value }] : [];
  });
  if (numericLabels.length < 2) return spec;
  const sortedValues = [...numericLabels].sort((left, right) => left.value - right.value);
  const left = sortedValues[0]!;
  const right = [...sortedValues]
    .reverse()
    .find((candidate) => Math.abs(candidate.value - left.value) > 1e-9);
  if (!right) return spec;
  const unitsToX = (right.anchor.x - left.anchor.x) / (right.value - left.value);
  if (!Number.isFinite(unitsToX) || unitsToX <= 0) return spec;

  const denominator = Math.max(...numericLabels.map((label) => label.denominator));
  const minStep = Math.ceil(sortedValues[0]!.value * denominator - 1e-8);
  const maxStep = Math.floor(
    sortedValues[sortedValues.length - 1]!.value * denominator + 1e-8,
  );
  const axisY = (axis.from.y + axis.to.y) / 2;
  const tickHalfHeight = spec.viewBox.height * 0.045;
  const existingIds = new Set([
    ...spec.points.map((point) => point.id),
    ...spec.primitives.segments.map((segment) => segment.id),
  ]);
  const points = [...spec.points];
  const segments = [...spec.primitives.segments];
  let autoIndex = 0;
  const nextId = (suffix: string) => {
    let candidate = `autoTick${autoIndex}${suffix}`;
    while (existingIds.has(candidate)) {
      autoIndex += 1;
      candidate = `autoTick${autoIndex}${suffix}`;
    }
    existingIds.add(candidate);
    return candidate;
  };

  for (let step = minStep; step <= maxStep; step += 1) {
    if (points.length + 2 > 64 || segments.length + 1 > 24) break;
    const value = step / denominator;
    const x = left.anchor.x + (value - left.value) * unitsToX;
    const alreadyMarked = segments.some((segment) => {
      const from =
        pointsById.get(segment.from) ?? points.find((point) => point.id === segment.from);
      const to =
        pointsById.get(segment.to) ?? points.find((point) => point.id === segment.to);
      if (!from || !to) return false;
      return (
        Math.abs(from.x - to.x) <= spec.viewBox.width * 0.01 &&
        Math.abs((from.x + to.x) / 2 - x) <= spec.viewBox.width * 0.01 &&
        Math.abs((from.y + to.y) / 2 - axisY) <= spec.viewBox.height * 0.02
      );
    });
    if (alreadyMarked) continue;
    const fromId = nextId("a");
    const toId = nextId("b");
    const segmentId = nextId("s");
    points.push(
      {
        id: fromId,
        x,
        y: axisY - tickHalfHeight,
        label: null,
        labelPosition: "TOP",
        pointStyle: "NONE",
      },
      {
        id: toId,
        x,
        y: axisY + tickHalfHeight,
        label: null,
        labelPosition: "TOP",
        pointStyle: "NONE",
      },
    );
    segments.push({ id: segmentId, from: fromId, to: toId, style: "SOLID" });
    autoIndex += 1;
  }

  return {
    ...spec,
    points,
    primitives: { ...spec.primitives, segments },
  };
}

function parseNumberLineValue(text: string) {
  const normalized = text.trim().replace(",", ".");
  const fraction = normalized.match(/^(-?\d+)\s*\/\s*([1-9]\d*)$/u);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return { value: numerator / denominator, denominator };
  }
  if (!/^-?\d+(?:\.\d+)?$/u.test(normalized)) return null;
  const value = Number(normalized);
  const decimalPlaces = normalized.split(".")[1]?.length ?? 0;
  const rawDenominator = 10 ** decimalPlaces;
  const numerator = Math.round(Math.abs(value) * rawDenominator);
  const divisor = greatestCommonDivisor(numerator, rawDenominator);
  return { value, denominator: rawDenominator / divisor };
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

export type LessonSummaryProviderDiagramSpec = z.infer<
  typeof lessonSummaryProviderDiagramSpecSchema
>;

export type LessonSummaryProviderDiagramTransport = z.infer<
  typeof lessonSummaryProviderDiagramTransportSchema
>;

export type LessonSummaryProviderDiagramInput = z.infer<
  typeof lessonSummaryProviderDiagramInputSchema
>;
