import { z } from "zod";

const safeId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u);
const pointId = safeId.describe(
  "ID duy nhất của một điểm trong diagramSpec; dùng A_prime cho điểm có nhãn A′.",
);
const pointReference = safeId.describe(
  "ID của một điểm đã khai báo trong mảng points của cùng diagramSpec.",
);
const primitiveId = safeId.describe(
  "ID duy nhất của primitive trong diagramSpec; không lặp lại hoặc tái sử dụng cho primitive khác.",
);
const finiteCoordinate = z.number().finite().min(-10_000).max(10_000);
const positiveMeasure = z.number().finite().positive().max(10_000);
const safeLabel = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .describe(
    "Chỉ dùng text thuần để SVG hiển thị trực tiếp; không dùng dấu $ hoặc lệnh LaTeX như \\angle, \\widehat, \\mathrm. Viết 3 cm, 40° hoặc x ≥ 0; không lặp tên điểm/cạnh trong nhãn.",
  )
  .refine(
    (value) =>
      !/(?:<\/?(?:script|style|iframe|object|embed|svg)\b|javascript:|data:|https?:\/\/)/iu.test(
        value,
      ),
    "Diagram labels cannot contain markup, scripts, data URIs, or remote URLs.",
  );
const safePointLabel = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .regex(
    /^(?:[A-Z](?:['′″]|[0-9₀-₉]){0,3}|\$[A-Z](?:['′″]|[0-9₀-₉]){0,3}\$)$/u,
    "Point labels must be one uppercase point name with optional primes or numeric subscripts.",
  )
  .describe(
    "Chỉ là tên một điểm như A, B′ hoặc M₁; không ghép nhiều điểm, độ dài, góc hay công thức vào point.label.",
  );

function normalizeBlankOptionalText(value: unknown) {
  return value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
    ? null
    : value;
}

function normalizeMissingNullableValue(value: unknown) {
  return value === undefined ? null : value;
}

export const lessonSummaryDiagramPointSchema = z
  .object({
    id: pointId,
    x: finiteCoordinate,
    y: finiteCoordinate,
    label: z.preprocess(normalizeBlankOptionalText, safePointLabel.nullable()),
    pointStyle: z
      .enum(["NONE", "FILLED", "OPEN"])
      .optional()
      .describe(
        "NONE hoặc bỏ trống cho đỉnh hình học thường, neo text và điểm lấy mẫu làm mượt; FILLED/OPEN cho điểm dựng đồ thị có ý nghĩa, điểm cần nhấn mạnh hoặc đầu mút đóng/mở.",
      ),
    labelPosition: z.preprocess(
      normalizeMissingNullableValue,
      z
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
    ),
  })
  .strict();

const lineStyleSchema = z.enum(["SOLID", "DASHED", "DOTTED"]);
const fillStyleSchema = z.enum(["NONE", "SOFT_BLUE", "SOFT_AMBER", "SOFT_GREEN"]);

const segmentLikeSchema = z.object({
  id: primitiveId,
  from: pointReference,
  to: pointReference,
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
      id: primitiveId,
      type: z
        .literal("POLYLINE")
        .describe(
          "Đường gấp khúc mở qua các điểm theo thứ tự; dùng nhiều điểm đúng tỉ lệ để xấp xỉ đồ thị cong, không lặp điểm đầu ở cuối.",
        ),
      pointIds: z.array(pointReference).min(2).max(64),
      style: lineStyleSchema,
    })
    .strict(),
  z
    .object({
      id: primitiveId,
      type: z
        .literal("ELLIPSE")
        .describe(
          "Ellipse có ý nghĩa toán học hoặc dùng làm đường tròn nhìn phối cảnh trong khối trụ, nón, cầu; không dùng thay điểm.",
        ),
      center: pointReference,
      radiusX: positiveMeasure,
      radiusY: positiveMeasure,
      rotation: z.number().finite().min(-360).max(360),
      style: lineStyleSchema,
    })
    .strict(),
  z
    .object({
      id: primitiveId,
      type: z
        .literal("POLYGON")
        .describe(
          "Hình kín có ít nhất ba đỉnh phân biệt. Nếu cần marker cho từng cạnh, phải tạo thêm SEGMENT có ID riêng cho các cạnh đó.",
        ),
      pointIds: z
        .array(pointReference)
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
      id: primitiveId,
      type: z
        .literal("CIRCLE")
        .describe(
          "Chỉ dùng cho đường tròn có ý nghĩa toán học; không dùng thay cạnh, điểm hoặc dấu góc.",
        ),
      center: pointReference,
      radius: positiveMeasure,
      style: lineStyleSchema,
    })
    .strict(),
  z
    .object({
      id: primitiveId,
      type: z
        .literal("ARC")
        .describe(
          "Chỉ dùng một lần cho cung tròn thật sự cần trong đề hoặc thao tác dựng hình; cạnh tam giác luôn là SEGMENT.",
        ),
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
]);

export const lessonSummaryDiagramMarkerSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("RIGHT_ANGLE"),
      vertex: pointReference,
      armPointIds: z
        .array(pointReference)
        .length(2)
        .describe("Hai điểm khác nhau, đều khác vertex, xác định hai cạnh của góc."),
    })
    .strict(),
  z
    .object({
      type: z.literal("EQUAL_LENGTH"),
      segmentIds: z
        .array(primitiveId)
        .min(2)
        .max(16)
        .describe(
          "Các ID phải khớp chính xác với ID của SEGMENT đã khai báo trước trong primitives; không lặp ID trong cùng marker.",
        ),
      markCount: z.number().int().min(1).max(4),
    })
    .strict(),
  z
    .object({
      type: z.literal("PARALLEL"),
      segmentIds: z
        .array(primitiveId)
        .min(2)
        .max(16)
        .describe(
          "Các ID phải khớp chính xác với ID của SEGMENT đã khai báo trước trong primitives; không lặp ID trong cùng marker.",
        ),
      markCount: z.number().int().min(1).max(4),
    })
    .strict(),
  z
    .object({
      type: z.literal("ANGLE"),
      vertex: pointReference,
      armPointIds: z
        .array(pointReference)
        .length(2)
        .describe("Hai điểm khác nhau, đều khác vertex, xác định hai cạnh của góc."),
      label: z.preprocess(normalizeBlankOptionalText, safeLabel.nullable()),
    })
    .strict(),
]);

export const lessonSummaryDiagramLabelSchema = z
  .object({
    text: safeLabel,
    anchorPointId: pointReference.describe(
      "ID của một POINT đã khai báo. Với nhãn gắn cạnh, dùng một đầu mút làm fallback và khai báo thêm anchorPrimitiveId.",
    ),
    anchorPrimitiveId: primitiveId
      .nullable()
      .optional()
      .describe(
        "ID của SEGMENT cần neo nhãn vào trung điểm; dùng cho giá trị độ dài gọn như 3 cm. Để null cho nhãn điểm, trục, ô bảng hoặc chú thích tự do.",
      ),
    position: z.enum([
      "CENTER",
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

function removeEmptyDiagramLabelEntries(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.filter((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return true;
    }
    const label = candidate as Record<string, unknown>;
    if (!("text" in label)) return false;
    return typeof label.text !== "string" || label.text.trim().length > 0;
  });
}

/**
 * Renderer-safety contract. This validates the SVG data shape, finite geometry,
 * safe labels and bounded collection sizes without enforcing textbook semantic
 * conventions. Admin review may therefore still display a safe partial diagram.
 */
export const lessonSummaryDiagramSpecStructuralSchema = z
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
      .strict()
      .describe(
        "Khung nhìn phải chứa toàn bộ điểm, đường tròn, ellipse, cung tròn và chừa biên đủ rộng để không cắt điểm hoặc nhãn.",
      ),
    toScale: z.literal(true),
    points: z
      .array(lessonSummaryDiagramPointSchema)
      .min(2)
      .max(160)
      .describe(
        "Mỗi đỉnh chỉ khai báo một lần; point.id và point.label phải duy nhất trong diagramSpec.",
      ),
    primitives: z
      .array(lessonSummaryDiagramPrimitiveSchema)
      .min(1)
      .max(96)
      .describe(
        "Danh sách tối giản, tối đa 96 phần tử để compiler deterministic có thể dựng đủ tick, đường dóng và đường cong. Không lặp primitive hoặc ID. Tam giác thường dùng đúng 3 SEGMENT; hai tam giác tách rời dùng đúng 6 SEGMENT; chỉ thêm primitive có ý nghĩa toán học.",
      ),
    markers: z
      .array(lessonSummaryDiagramMarkerSchema)
      .max(64)
      .describe("Chỉ tạo marker thể hiện quan hệ có trong đề; không lặp marker."),
    labels: z.preprocess(
      removeEmptyDiagramLabelEntries,
      z
        .array(lessonSummaryDiagramLabelSchema)
        .max(128)
        .describe(
          "Chỉ dùng cho nhãn cạnh/góc bổ sung; không lặp text tại cùng cặp anchorPointId/anchorPrimitiveId. Khi admin xóa text hoặc để text rỗng, toàn bộ phần tử nhãn được coi là đã xóa.",
        ),
    ),
    caption: z.preprocess(normalizeBlankOptionalText, safeLabel.nullable()),
  })
  .strict();

/** Full acceptance contract used before publication and for golden fixtures. */
export const lessonSummaryDiagramSpecSchema =
  lessonSummaryDiagramSpecStructuralSchema.superRefine((spec, context) => {
    addDuplicateValueIssues(
      spec.points.map((point) => point.id),
      ["points"],
      "point ID",
      context,
    );
    addDuplicateValueIssues(
      spec.points.flatMap((point) => (point.label ? [point.label] : [])),
      ["points"],
      "point label",
      context,
    );
    addDuplicateValueIssues(
      spec.primitives.map((primitive) => primitive.id),
      ["primitives"],
      "primitive ID",
      context,
    );
    addDuplicateValueIssues(
      spec.markers.map((marker) => JSON.stringify(marker)),
      ["markers"],
      "marker",
      context,
    );
    addDuplicateValueIssues(
      spec.labels.map(
        (label) =>
          `${label.anchorPointId}:${label.anchorPrimitiveId ?? "FREE"}:${label.text}`,
      ),
      ["labels"],
      "label",
      context,
    );

    const pointIds = new Set(spec.points.map((point) => point.id));
    const primitivesById = new Map(
      spec.primitives.map((primitive) => [primitive.id, primitive] as const),
    );
    const requirePoint = (id: string, path: Array<string | number>, message: string) => {
      if (pointIds.has(id)) return;
      context.addIssue({ code: "custom", path, message });
    };

    spec.primitives.forEach((primitive, primitiveIndex) => {
      if (
        (primitive.type === "SEGMENT" ||
          primitive.type === "LINE" ||
          primitive.type === "RAY") &&
        primitive.from === primitive.to
      ) {
        context.addIssue({
          code: "custom",
          path: ["primitives", primitiveIndex],
          message: `${primitive.type} must use two different points.`,
        });
      }
      if (primitive.type === "POLYGON") {
        addDuplicateValueIssues(
          primitive.pointIds,
          ["primitives", primitiveIndex, "pointIds"],
          "polygon point",
          context,
        );
      }
      if (primitive.type === "POLYLINE") {
        primitive.pointIds.slice(1).forEach((pointId, pointIndex) => {
          if (pointId !== primitive.pointIds[pointIndex]) return;
          context.addIssue({
            code: "custom",
            path: ["primitives", primitiveIndex, "pointIds", pointIndex + 1],
            message: "POLYLINE cannot repeat the same point consecutively.",
          });
        });
      }
      if (
        primitive.type === "SEGMENT" ||
        primitive.type === "LINE" ||
        primitive.type === "RAY"
      ) {
        requirePoint(
          primitive.from,
          ["primitives", primitiveIndex, "from"],
          `${primitive.type} references unknown point ${primitive.from}.`,
        );
        requirePoint(
          primitive.to,
          ["primitives", primitiveIndex, "to"],
          `${primitive.type} references unknown point ${primitive.to}.`,
        );
      } else if (primitive.type === "POLYGON" || primitive.type === "POLYLINE") {
        primitive.pointIds.forEach((id, pointIndex) =>
          requirePoint(
            id,
            ["primitives", primitiveIndex, "pointIds", pointIndex],
            `${primitive.type} references unknown point ${id}.`,
          ),
        );
      } else {
        requirePoint(
          primitive.center,
          ["primitives", primitiveIndex, "center"],
          `${primitive.type} references unknown center ${primitive.center}.`,
        );
      }
    });

    spec.markers.forEach((marker, markerIndex) => {
      if (marker.type === "EQUAL_LENGTH" || marker.type === "PARALLEL") {
        addDuplicateValueIssues(
          marker.segmentIds,
          ["markers", markerIndex, "segmentIds"],
          "marker segment",
          context,
        );
        marker.segmentIds.forEach((id, segmentIndex) => {
          const primitive = primitivesById.get(id);
          if (
            primitive?.type === "SEGMENT" ||
            primitive?.type === "LINE" ||
            primitive?.type === "RAY"
          ) {
            return;
          }
          context.addIssue({
            code: "custom",
            path: ["markers", markerIndex, "segmentIds", segmentIndex],
            message: `${marker.type} references missing or non-segment primitive ${id}.`,
          });
        });
        return;
      }
      const [firstArm, secondArm] = marker.armPointIds;
      if (
        firstArm === secondArm ||
        firstArm === marker.vertex ||
        secondArm === marker.vertex
      ) {
        context.addIssue({
          code: "custom",
          path: ["markers", markerIndex, "armPointIds"],
          message: `${marker.type} must use two different arm points, both different from its vertex.`,
        });
      }
      requirePoint(
        marker.vertex,
        ["markers", markerIndex, "vertex"],
        `${marker.type} references unknown vertex ${marker.vertex}.`,
      );
      marker.armPointIds.forEach((id, armIndex) =>
        requirePoint(
          id,
          ["markers", markerIndex, "armPointIds", armIndex],
          `${marker.type} references unknown arm point ${id}.`,
        ),
      );
      if (marker.type === "ANGLE" && marker.label) {
        const vertexLabel = spec.points.find(
          (point) => point.id === marker.vertex,
        )?.label;
        if (vertexLabel && marker.label.replaceAll(" ", "") === `∠${vertexLabel}`) {
          context.addIssue({
            code: "custom",
            path: ["markers", markerIndex, "label"],
            message:
              "An angle marker must not repeat the vertex name; use null unless a numeric angle measure is needed.",
          });
        }
      }
    });
    spec.labels.forEach((label, labelIndex) => {
      requirePoint(
        label.anchorPointId,
        ["labels", labelIndex, "anchorPointId"],
        `Label references unknown point ${label.anchorPointId}.`,
      );
      if (label.anchorPrimitiveId) {
        const primitive = primitivesById.get(label.anchorPrimitiveId);
        if (primitive?.type !== "SEGMENT") {
          context.addIssue({
            code: "custom",
            path: ["labels", labelIndex, "anchorPrimitiveId"],
            message: `Label anchorPrimitiveId must reference a SEGMENT, received ${label.anchorPrimitiveId}.`,
          });
        }
      }
      if (/^[A-Z](?:['′″])?[A-Z](?:['′″])?\s*=/u.test(label.text)) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex, "text"],
          message:
            "Do not write segment names or equalities as diagram text; use compact length values and EQUAL_LENGTH markers.",
        });
      }
      if (
        /^\d+(?:[.,]\d+)?\s*(?:mm|cm|dm|m|km)$/iu.test(label.text) &&
        !label.anchorPrimitiveId
      ) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex, "anchorPrimitiveId"],
          message: "Length values must anchor to their corresponding SEGMENT.",
        });
      }
      if (
        /^(?:tường|mặt\s*đất|thang)$/iu.test(label.text.trim()) &&
        !label.anchorPrimitiveId
      ) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex, "anchorPrimitiveId"],
          message: `${label.text} must anchor to its corresponding SEGMENT.`,
        });
      }
    });

    const pointsById = new Map(spec.points.map((point) => [point.id, point] as const));
    const segmentLikePrimitives = spec.primitives.filter(
      (primitive) =>
        primitive.type === "SEGMENT" ||
        primitive.type === "LINE" ||
        primitive.type === "RAY",
    );
    const hasLongAxis = (orientation: "HORIZONTAL" | "VERTICAL") =>
      segmentLikePrimitives.some((primitive) => {
        const from = pointsById.get(primitive.from);
        const to = pointsById.get(primitive.to);
        if (!from || !to) return false;
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        return orientation === "HORIZONTAL"
          ? dy <= spec.viewBox.height * 0.01 &&
              (primitive.type === "LINE" || dx >= spec.viewBox.width * 0.3)
          : dx <= spec.viewBox.width * 0.01 &&
              (primitive.type === "LINE" || dy >= spec.viewBox.height * 0.3);
      });
    const hasFunctionLabel = spec.labels.some((label) => /^y\s*=/iu.test(label.text));
    if (hasFunctionLabel && (!hasLongAxis("HORIZONTAL") || !hasLongAxis("VERTICAL"))) {
      context.addIssue({
        code: "custom",
        path: ["primitives"],
        message:
          "Function graphs with y= labels require both horizontal and vertical axes.",
      });
    }

    const caption = spec.caption ?? "";
    const hasCoordinateContext =
      /tọa\s*độ|trục\s+(?:hoành|tung)|đồ\s*thị|\bOxy\b/iu.test(caption) ||
      segmentLikePrimitives.some((primitive) => /axis|truc/iu.test(primitive.id));
    const hasCoordinateAxisLabels =
      hasCoordinateContext &&
      ["x", "y"].every((axisLabel) =>
        spec.labels.some((label) => label.text.trim().toLowerCase() === axisLabel),
      );
    const geometryMinX = Math.min(...spec.points.map((point) => point.x));
    const geometryMaxX = Math.max(...spec.points.map((point) => point.x));
    const geometryMinY = Math.min(...spec.points.map((point) => point.y));
    const geometryMaxY = Math.max(...spec.points.map((point) => point.y));
    const axisCoversGeometry = (orientation: "HORIZONTAL" | "VERTICAL") =>
      segmentLikePrimitives.some((primitive) => {
        const from = pointsById.get(primitive.from);
        const to = pointsById.get(primitive.to);
        if (!from || !to) return false;
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const aligned =
          orientation === "HORIZONTAL"
            ? dy <= spec.viewBox.height * 0.01
            : dx <= spec.viewBox.width * 0.01;
        if (!aligned) return false;
        if (primitive.type === "LINE") return true;
        const xTolerance = spec.viewBox.width * 0.05;
        const yTolerance = spec.viewBox.height * 0.05;
        return orientation === "HORIZONTAL"
          ? Math.min(from.x, to.x) <= geometryMinX + xTolerance &&
              Math.max(from.x, to.x) >= geometryMaxX - xTolerance
          : Math.min(from.y, to.y) <= geometryMinY + yTolerance &&
              Math.max(from.y, to.y) >= geometryMaxY - yTolerance;
      });
    if (
      hasCoordinateAxisLabels &&
      (!axisCoversGeometry("HORIZONTAL") || !axisCoversGeometry("VERTICAL"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["primitives"],
        message: "Coordinate axes labeled x and y must cover all plotted points.",
      });
    }

    const coordinateLabelPattern =
      /^\(\s*(-?\d+(?:[.,]\d+)?)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\)$/u;
    const visibleCurveConstructionPointIds = new Set(
      spec.primitives.flatMap((primitive) =>
        primitive.type === "POLYLINE" && primitive.pointIds.length >= 17
          ? primitive.pointIds.filter(
              (pointId) => pointsById.get(pointId)?.pointStyle === "FILLED",
            )
          : [],
      ),
    );
    spec.labels.forEach((label, labelIndex) => {
      const coordinateMatch = label.text.match(coordinateLabelPattern);
      if (!coordinateMatch) return;
      const anchor = pointsById.get(label.anchorPointId);
      const expectedX = Number(coordinateMatch[1]!.replace(",", "."));
      const expectedY = Number(coordinateMatch[2]!.replace(",", "."));
      if (
        !anchor ||
        (!anchor.label && !visibleCurveConstructionPointIds.has(anchor.id)) ||
        anchor.pointStyle !== "FILLED" ||
        Math.abs(anchor.x - expectedX) > 0.02 ||
        Math.abs(anchor.y - expectedY) > 0.02
      ) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex, "anchorPointId"],
          message:
            "Coordinate labels must anchor directly to a matching named or visible curve-construction FILLED point.",
        });
      }
    });

    if (/bảng/iu.test(caption)) {
      spec.labels.forEach((label, labelIndex) => {
        if (label.position === "CENTER") return;
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex, "position"],
          message: "Table cell labels must use CENTER positioning.",
        });
      });
    }

    const resolveSegment = (primitive: (typeof segmentLikePrimitives)[number]) => {
      const from = pointsById.get(primitive.from);
      const to = pointsById.get(primitive.to);
      return from && to ? { primitive, from, to } : null;
    };
    const longHorizontalAxes = segmentLikePrimitives.flatMap((primitive) => {
      const resolved = resolveSegment(primitive);
      if (!resolved) return [];
      const { from, to } = resolved;
      return Math.abs(from.y - to.y) <= spec.viewBox.height * 0.01 &&
        (primitive.type === "LINE" || Math.abs(from.x - to.x) >= spec.viewBox.width * 0.3)
        ? [resolved]
        : [];
    });
    const longVerticalAxes = segmentLikePrimitives.flatMap((primitive) => {
      const resolved = resolveSegment(primitive);
      if (!resolved) return [];
      const { from, to } = resolved;
      return Math.abs(from.x - to.x) <= spec.viewBox.width * 0.01 &&
        (primitive.type === "LINE" ||
          Math.abs(from.y - to.y) >= spec.viewBox.height * 0.3)
        ? [resolved]
        : [];
    });
    const coordinatePlane =
      hasFunctionLabel ||
      /(?:đồ\s*thị|mặt\s*phẳng\s*tọa\s*độ|hệ\s*trục|oxy|parabol|miền\s*nghiệm)/iu.test(
        caption,
      );
    if (coordinatePlane) {
      spec.points.forEach((point, pointIndex) => {
        if (point.pointStyle !== "FILLED" || point.label) return;
        context.addIssue({
          code: "custom",
          path: ["points", pointIndex, "label"],
          message: `Every visible graph construction point requires a unique short point name: ${point.id}.`,
        });
      });
    }
    const horizontalCoordinateAxis = longHorizontalAxes.find(
      ({ primitive, from, to }) =>
        primitive.type === "LINE" &&
        Math.abs((from.y + to.y) / 2) <= spec.viewBox.height * 0.01,
    );
    const verticalCoordinateAxis = longVerticalAxes.find(
      ({ primitive, from, to }) =>
        primitive.type === "LINE" &&
        Math.abs((from.x + to.x) / 2) <= spec.viewBox.width * 0.01,
    );
    if (coordinatePlane && (!horizontalCoordinateAxis || !verticalCoordinateAxis)) {
      context.addIssue({
        code: "custom",
        path: ["primitives"],
        message:
          "Cartesian graphs require horizontal and vertical LINE axes through O so both negative and positive directions are visible.",
      });
    }

    const tickCountsForAxes = (
      horizontalAxis: (typeof longHorizontalAxes)[number] | undefined,
      verticalAxis: (typeof longVerticalAxes)[number] | undefined,
    ) => {
      if (!horizontalAxis || !verticalAxis) return { xTicks: 0, yTicks: 0 };
      const axisY = (horizontalAxis.from.y + horizontalAxis.to.y) / 2;
      const axisX = (verticalAxis.from.x + verticalAxis.to.x) / 2;
      let xTicks = 0;
      let yTicks = 0;
      segmentLikePrimitives.forEach((primitive) => {
        if (primitive.type !== "SEGMENT") return;
        const resolved = resolveSegment(primitive);
        if (!resolved) return;
        const { from, to } = resolved;
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        if (
          dx <= spec.viewBox.width * 0.01 &&
          dy > 0 &&
          dy <= spec.viewBox.height * 0.12 &&
          Math.abs(midY - axisY) <= spec.viewBox.height * 0.02 &&
          Math.abs(midX - axisX) > spec.viewBox.width * 0.02
        ) {
          xTicks += 1;
        }
        if (
          dy <= spec.viewBox.height * 0.01 &&
          dx > 0 &&
          dx <= spec.viewBox.width * 0.12 &&
          Math.abs(midX - axisX) <= spec.viewBox.width * 0.02 &&
          Math.abs(midY - axisY) > spec.viewBox.height * 0.02
        ) {
          yTicks += 1;
        }
      });
      return { xTicks, yTicks };
    };

    if (coordinatePlane && horizontalCoordinateAxis && verticalCoordinateAxis) {
      const { xTicks, yTicks } = tickCountsForAxes(
        horizontalCoordinateAxis,
        verticalCoordinateAxis,
      );
      if (xTicks < 2 || yTicks < 2) {
        context.addIssue({
          code: "custom",
          path: ["primitives"],
          message:
            "Cartesian axes require at least two visible unit tick segments on each axis.",
        });
      }
      const axisY = (horizontalCoordinateAxis.from.y + horizontalCoordinateAxis.to.y) / 2;
      const axisX = (verticalCoordinateAxis.from.x + verticalCoordinateAxis.to.x) / 2;
      const numericLabels = spec.labels.filter((label) =>
        /^-?\d+(?:[.,]\d+)?$/u.test(label.text.trim()),
      );
      const xNumberCount = numericLabels.filter((label) => {
        const anchor = pointsById.get(label.anchorPointId);
        return Boolean(
          anchor &&
          Math.abs(anchor.y - axisY) <= spec.viewBox.height * 0.06 &&
          Math.abs(anchor.x - axisX) > spec.viewBox.width * 0.02,
        );
      }).length;
      const yNumberCount = numericLabels.filter((label) => {
        const anchor = pointsById.get(label.anchorPointId);
        return Boolean(
          anchor &&
          Math.abs(anchor.x - axisX) <= spec.viewBox.width * 0.06 &&
          Math.abs(anchor.y - axisY) > spec.viewBox.height * 0.02,
        );
      }).length;
      if (xNumberCount < 2 || yNumberCount < 2) {
        context.addIssue({
          code: "custom",
          path: ["labels"],
          message:
            "Cartesian axes require numeric scale labels on both the x and y axes.",
        });
      }

      const hasNumericScaleLabelAt = (
        orientation: "HORIZONTAL" | "VERTICAL",
        value: number,
      ) =>
        numericLabels.some((label) => {
          const anchor = pointsById.get(label.anchorPointId);
          if (!anchor || Math.abs(Number(label.text.replace(",", ".")) - value) > 0.02) {
            return false;
          }
          return orientation === "HORIZONTAL"
            ? Math.abs(anchor.x - value) <= spec.viewBox.width * 0.01 &&
                Math.abs(anchor.y - axisY) <= spec.viewBox.height * 0.06
            : Math.abs(anchor.y - value) <= spec.viewBox.height * 0.01 &&
                Math.abs(anchor.x - axisX) <= spec.viewBox.width * 0.06;
        });
      spec.points
        .filter((point) => point.pointStyle === "FILLED")
        .forEach((point, pointIndex) => {
          const liesOnXAxis = Math.abs(point.y - axisY) <= spec.viewBox.height * 0.01;
          const liesOnYAxis = Math.abs(point.x - axisX) <= spec.viewBox.width * 0.01;
          if (
            liesOnXAxis &&
            Math.abs(point.x - axisX) > spec.viewBox.width * 0.02 &&
            !hasNumericScaleLabelAt("HORIZONTAL", point.x)
          ) {
            context.addIssue({
              code: "custom",
              path: ["points", pointIndex],
              message: `Visible point ${point.id} on the x-axis requires numeric scale label ${point.x}.`,
            });
          }
          if (
            liesOnYAxis &&
            Math.abs(point.y - axisY) > spec.viewBox.height * 0.02 &&
            !hasNumericScaleLabelAt("VERTICAL", point.y)
          ) {
            context.addIssue({
              code: "custom",
              path: ["points", pointIndex],
              message: `Visible point ${point.id} on the y-axis requires numeric scale label ${point.y}.`,
            });
          }
        });
    }

    const dataChart = /biểu\s*đồ\s*(?:cột|đường|đoạn\s*thẳng)/iu.test(caption);
    if (dataChart) {
      const chartHorizontalAxis = longHorizontalAxes[0];
      const chartVerticalAxis = longVerticalAxes[0];
      const { xTicks, yTicks } = tickCountsForAxes(
        chartHorizontalAxis,
        chartVerticalAxis,
      );
      if (!chartHorizontalAxis || !chartVerticalAxis || xTicks < 2 || yTicks < 2) {
        context.addIssue({
          code: "custom",
          path: ["primitives"],
          message: "Bar and line charts require visible subdivisions on both axes.",
        });
      }
    }

    if (/biểu\s*đồ\s*(?:đường|đoạn\s*thẳng)/iu.test(caption)) {
      const dataPointIds = new Set(
        spec.primitives.flatMap((primitive) =>
          primitive.type === "POLYLINE"
            ? primitive.pointIds.filter(
                (pointId) => pointsById.get(pointId)?.pointStyle === "FILLED",
              )
            : [],
        ),
      );
      dataPointIds.forEach((pointId) => {
        const hasDirectValue = spec.labels.some(
          (label) =>
            label.anchorPointId === pointId &&
            /^-?\d+(?:[.,]\d+)?%?$/u.test(label.text.trim()),
        );
        if (hasDirectValue) return;
        context.addIssue({
          code: "custom",
          path: ["labels"],
          message: `Line-chart data point ${pointId} requires a value label anchored directly to it.`,
        });
      });
    }

    spec.labels.forEach((label, labelIndex) => {
      const compactText = label.text.replaceAll(" ", "");
      if (/^(?:≥|≤|>|<|>=|<=)/u.test(compactText)) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex, "text"],
          message: "Inequality labels must include their left-hand expression.",
        });
      }
      const anchor = pointsById.get(label.anchorPointId);
      if (
        /^x(?:≥|>=)0$/u.test(compactText) &&
        verticalCoordinateAxis &&
        (!anchor ||
          Math.abs(anchor.x) > spec.viewBox.width * 0.02 ||
          !["RIGHT", "TOP_RIGHT", "BOTTOM_RIGHT"].includes(label.position))
      ) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex],
          message: "The x≥0 label must sit just inside the right side of the y-axis.",
        });
      }
      if (
        /^y(?:≥|>=)0$/u.test(compactText) &&
        horizontalCoordinateAxis &&
        (!anchor ||
          Math.abs(anchor.y) > spec.viewBox.height * 0.02 ||
          !["TOP", "TOP_LEFT", "TOP_RIGHT"].includes(label.position))
      ) {
        context.addIssue({
          code: "custom",
          path: ["labels", labelIndex],
          message: "The y≥0 label must sit just above the x-axis.",
        });
      }
    });

    const hasQuadraticLabel = spec.labels.some((label) =>
      /x(?:²|\^\{?2\}?)/iu.test(label.text),
    );
    if (hasQuadraticLabel) {
      const quadraticPolylines = spec.primitives.flatMap((primitive) =>
        primitive.type === "POLYLINE" && primitive.pointIds.length >= 17
          ? [primitive]
          : [],
      );
      if (quadraticPolylines.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["primitives"],
          message: "Quadratic graphs require a POLYLINE with at least 17 sample points.",
        });
      }
      quadraticPolylines.forEach((primitive, primitiveIndex) => {
        const curvePoints = primitive.pointIds
          .map((pointId) => pointsById.get(pointId))
          .filter((point): point is (typeof spec.points)[number] => Boolean(point));
        if (curvePoints.length !== primitive.pointIds.length) return;
        const first = curvePoints[0];
        const last = curvePoints.at(-1);
        if (!first || !last) return;
        const lowest = curvePoints.reduce((best, point) =>
          point.y < best.y ? point : best,
        );
        const highest = curvePoints.reduce((best, point) =>
          point.y > best.y ? point : best,
        );
        const endpointMeanY = (first.y + last.y) / 2;
        const vertex =
          Math.abs(endpointMeanY - lowest.y) >= Math.abs(endpointMeanY - highest.y)
            ? lowest
            : highest;
        const visiblePoints = curvePoints.filter(
          (point) => point.pointStyle === "FILLED",
        );
        const xTolerance = Math.max(spec.viewBox.width * 0.005, 0.02);
        const yTolerance = Math.max(spec.viewBox.height * 0.01, 0.02);
        const visibleVertex = visiblePoints.some(
          (point) =>
            Math.abs(point.x - vertex.x) <= xTolerance &&
            Math.abs(point.y - vertex.y) <= yTolerance,
        );
        const symmetricPairCount = visiblePoints
          .filter((point) => point.x < vertex.x - xTolerance)
          .filter((leftPoint) =>
            visiblePoints.some(
              (rightPoint) =>
                rightPoint.x > vertex.x + xTolerance &&
                Math.abs((leftPoint.x + rightPoint.x) / 2 - vertex.x) <= xTolerance &&
                Math.abs(leftPoint.y - rightPoint.y) <= yTolerance,
            ),
          ).length;
        if (visiblePoints.length < 5 || !visibleVertex || symmetricPairCount < 2) {
          context.addIssue({
            code: "custom",
            path: ["primitives", primitiveIndex],
            message:
              "Quadratic construction requires a visible vertex and at least two visible symmetric point pairs; additional smoothing samples stay hidden.",
          });
        }
      });
    }

    const fractionLabel = spec.labels
      .map((label) => label.text.match(/^([1-9][0-9]*)\s*\/\s*([1-9][0-9]*)$/u))
      .find((match) => match !== null);
    const areaPolygons = spec.primitives.filter(
      (primitive) => primitive.type === "POLYGON",
    );
    if (
      fractionLabel &&
      areaPolygons.length > 0 &&
      /(?:phân\s*số|tô)/iu.test(spec.caption ?? "")
    ) {
      const numerator = Number(fractionLabel[1]);
      const filledPolygonCount = areaPolygons.filter(
        (primitive) => primitive.fill !== "NONE",
      ).length;
      if (filledPolygonCount < numerator) {
        context.addIssue({
          code: "custom",
          path: ["primitives"],
          message: `Fraction area model ${fractionLabel[0]} requires at least ${numerator} filled polygons.`,
        });
      }
    }

    const ellipseCenters = new Set(
      spec.primitives.flatMap((primitive) =>
        primitive.type === "ELLIPSE" ? [primitive.center] : [],
      ),
    );
    const hasRadiusLabel = spec.labels.some((label) => /^r(?:\s*=|$)/iu.test(label.text));
    const hasRadiusSegment = segmentLikePrimitives.some(
      (primitive) =>
        primitive.type === "SEGMENT" &&
        (ellipseCenters.has(primitive.from) || ellipseCenters.has(primitive.to)),
    );
    if (ellipseCenters.size >= 2 && hasRadiusLabel && !hasRadiusSegment) {
      context.addIssue({
        code: "custom",
        path: ["primitives"],
        message: "A solid with radius label r requires a segment from an ellipse center.",
      });
    }
    if (ellipseCenters.size >= 2) {
      spec.labels.forEach((label, labelIndex) => {
        if (/^r$/iu.test(label.text.trim())) {
          const primitive = label.anchorPrimitiveId
            ? primitivesById.get(label.anchorPrimitiveId)
            : undefined;
          if (
            primitive?.type !== "SEGMENT" ||
            (!ellipseCenters.has(primitive.from) && !ellipseCenters.has(primitive.to))
          ) {
            context.addIssue({
              code: "custom",
              path: ["labels", labelIndex, "anchorPrimitiveId"],
              message: "Radius label r must anchor to a radius SEGMENT.",
            });
          }
        }
        if (/^h$/iu.test(label.text.trim())) {
          const primitive = label.anchorPrimitiveId
            ? primitivesById.get(label.anchorPrimitiveId)
            : undefined;
          const from =
            primitive?.type === "SEGMENT" ? pointsById.get(primitive.from) : undefined;
          const to =
            primitive?.type === "SEGMENT" ? pointsById.get(primitive.to) : undefined;
          if (
            !from ||
            !to ||
            Math.abs(from.x - to.x) > spec.viewBox.width * 0.02 ||
            Math.abs(from.y - to.y) < spec.viewBox.height * 0.25
          ) {
            context.addIssue({
              code: "custom",
              path: ["labels", labelIndex, "anchorPrimitiveId"],
              message: "Height label h must anchor to a vertical height SEGMENT.",
            });
          }
        }
      });
    }

    if (/venn/iu.test(caption)) {
      const universeLabelIndex = spec.labels.findIndex(
        (label) => label.text.trim() === "U",
      );
      if (universeLabelIndex >= 0) {
        const universeLabel = spec.labels[universeLabelIndex]!;
        const anchor = pointsById.get(universeLabel.anchorPointId);
        const boundaryPointIds = new Set(
          spec.primitives.flatMap((primitive) =>
            primitive.type === "POLYGON" ? primitive.pointIds : [],
          ),
        );
        if (
          !anchor ||
          boundaryPointIds.has(universeLabel.anchorPointId) ||
          universeLabel.position !== "CENTER"
        ) {
          context.addIssue({
            code: "custom",
            path: ["labels", universeLabelIndex],
            message:
              "Venn universe label U must use a separate interior point with CENTER positioning.",
          });
        }
      }
    }

    if (/đồng\s*hồ/iu.test(caption)) {
      const clockFace = spec.primitives.find((primitive) => primitive.type === "CIRCLE");
      const center =
        clockFace?.type === "CIRCLE" ? pointsById.get(clockFace.center) : undefined;
      if (!clockFace || !center) {
        context.addIssue({
          code: "custom",
          path: ["primitives"],
          message: "An analog clock requires one circular clock face.",
        });
      } else {
        const cardinalLabels = new Map(
          spec.labels
            .filter((label) => ["12", "3", "6", "9"].includes(label.text.trim()))
            .map((label) => [label.text.trim(), label] as const),
        );
        if (cardinalLabels.size !== 4) {
          context.addIssue({
            code: "custom",
            path: ["labels"],
            message: "A clock face requires the four cardinal labels 12, 3, 6 and 9.",
          });
        }

        const radialTicks = segmentLikePrimitives.filter((primitive) => {
          if (primitive.type !== "SEGMENT") return false;
          const from = pointsById.get(primitive.from);
          const to = pointsById.get(primitive.to);
          if (!from || !to) return false;
          const fromRadius = Math.hypot(from.x - center.x, from.y - center.y);
          const toRadius = Math.hypot(to.x - center.x, to.y - center.y);
          const innerRadius = Math.min(fromRadius, toRadius);
          const outerRadius = Math.max(fromRadius, toRadius);
          return (
            innerRadius >= clockFace.radius * 0.78 &&
            outerRadius >= clockFace.radius * 0.92 &&
            outerRadius <= clockFace.radius * 1.08 &&
            outerRadius - innerRadius <= clockFace.radius * 0.25
          );
        });
        if (radialTicks.length < 4) {
          context.addIssue({
            code: "custom",
            path: ["primitives"],
            message:
              "A clock face requires visible hour tick segments, including the four cardinal marks.",
          });
        }
      }
    }

    const numberLineFractions = spec.labels.flatMap((label) => {
      const match = label.text.match(/^(-?)([1-9][0-9]*)\s*\/\s*([2-9][0-9]*)$/u);
      return match ? [{ negative: match[1] === "-", denominator: Number(match[3]) }] : [];
    });
    if (numberLineFractions.length > 0 && /trục\s*số/iu.test(spec.caption ?? "")) {
      const denominator = Math.max(
        ...numberLineFractions.map((fraction) => fraction.denominator),
      );
      const hasBothSigns =
        numberLineFractions.some((fraction) => fraction.negative) &&
        numberLineFractions.some((fraction) => !fraction.negative);
      const requiredTickCount = (denominator - 1) * (hasBothSigns ? 2 : 1);
      const tickCount = segmentLikePrimitives.filter((primitive) => {
        if (primitive.type !== "SEGMENT") return false;
        const from = pointsById.get(primitive.from);
        const to = pointsById.get(primitive.to);
        if (!from || !to) return false;
        return (
          Math.abs(from.x - to.x) <= spec.viewBox.width * 0.01 &&
          Math.abs(from.y - to.y) > 0 &&
          Math.abs(from.y - to.y) <= spec.viewBox.height * 0.12
        );
      }).length;
      if (tickCount < requiredTickCount) {
        context.addIssue({
          code: "custom",
          path: ["primitives"],
          message: `Number line fractions with denominator ${denominator} require at least ${requiredTickCount} visible tick segments.`,
        });
      }
    }

    if (/trục\s*số/iu.test(caption)) {
      const numberLineAxis = longHorizontalAxes[0];
      if (numberLineAxis) {
        const axisY = (numberLineAxis.from.y + numberLineAxis.to.y) / 2;
        const originNameCount =
          spec.points.filter((point) => point.label?.trim().toUpperCase() === "O")
            .length +
          spec.labels.filter((label) => label.text.trim().toUpperCase() === "O").length;
        if (originNameCount > 0) {
          context.addIssue({
            code: "custom",
            path: ["points"],
            message:
              "A number line must use numeric 0 for the zero mark, not the coordinate-origin name O.",
          });
        }
        const zeroLabels = spec.labels.filter((label) => label.text.trim() === "0");
        const hasTickAt = (x: number) =>
          segmentLikePrimitives.some((primitive) => {
            if (primitive.type !== "SEGMENT") return false;
            const from = pointsById.get(primitive.from);
            const to = pointsById.get(primitive.to);
            if (!from || !to) return false;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              Math.abs(from.x - to.x) <= spec.viewBox.width * 0.01 &&
              Math.abs(from.y - to.y) > 0 &&
              Math.abs(from.y - to.y) <= spec.viewBox.height * 0.12 &&
              Math.abs(midX - x) <= spec.viewBox.width * 0.01 &&
              Math.abs(midY - axisY) <= spec.viewBox.height * 0.02
            );
          });
        const zeroAnchor = zeroLabels[0]
          ? pointsById.get(zeroLabels[0].anchorPointId)
          : undefined;
        const axisMinX = Math.min(numberLineAxis.from.x, numberLineAxis.to.x);
        const axisMaxX = Math.max(numberLineAxis.from.x, numberLineAxis.to.x);
        const zeroIsVisible = axisMinX <= 0 && axisMaxX >= 0;
        if (
          (zeroIsVisible &&
            (zeroLabels.length !== 1 ||
              !zeroAnchor ||
              Math.abs(zeroAnchor.x) > spec.viewBox.width * 0.01 ||
              !hasTickAt(0))) ||
          (!zeroIsVisible && zeroLabels.length > 0)
        ) {
          context.addIssue({
            code: "custom",
            path: ["labels"],
            message:
              "A number line that contains zero requires exactly one numeric 0 label at its visible zero tick.",
          });
        }
        const numericNumberLineLabels = spec.labels.filter((label) =>
          /^-?\d+(?:[.,]\d+)?(?:\s*\/\s*[1-9]\d*)?$/u.test(label.text.trim()),
        );
        numericNumberLineLabels.forEach((label) => {
          const anchor = pointsById.get(label.anchorPointId);
          const hasTick = anchor ? hasTickAt(anchor.x) : false;
          if (
            !anchor ||
            (Math.abs(anchor.y - axisY) > spec.viewBox.height * 0.06 && !hasTick)
          ) {
            context.addIssue({
              code: "custom",
              path: ["labels"],
              message: `Number-line label ${label.text} must anchor directly on its tick or marked point.`,
            });
            return;
          }
          if (label.text.trim() === "0") return;
          const hasVisibleMark =
            anchor.pointStyle === "FILLED" || anchor.pointStyle === "OPEN";
          if (!hasVisibleMark && !hasTick) {
            context.addIssue({
              code: "custom",
              path: ["primitives"],
              message: `Number-line value ${label.text} requires a visible tick or endpoint mark.`,
            });
          }
        });
      }
    }
  });

export const lessonSummaryDiagramSpecOriginSchema = z.enum([
  "PROVIDER_RAW_SPEC",
  "COMPILED_INTENT",
  "LEGACY_UNKNOWN",
]);

const lessonSummaryDiagramProvenanceShape = {
  diagramSpecOrigin: lessonSummaryDiagramSpecOriginSchema.optional(),
  compilerKey: z
    .string()
    .trim()
    .regex(/^[a-z]+(?:[.-][a-z]+)*\.v\d+$/u)
    .max(120)
    .nullable()
    .optional(),
  intentVersion: z.number().int().positive().nullable().optional(),
};

export const lessonSummaryDiagramVisualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z
    .object({
      kind: z.literal("DIAGRAM_SPEC"),
      spec: lessonSummaryDiagramSpecSchema,
      ...lessonSummaryDiagramProvenanceShape,
    })
    .strict(),
]);

export const lessonSummaryDiagramStructuralVisualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z
    .object({
      kind: z.literal("DIAGRAM_SPEC"),
      spec: lessonSummaryDiagramSpecStructuralSchema,
      ...lessonSummaryDiagramProvenanceShape,
    })
    .strict(),
]);

export type LessonSummaryDiagramSpec = z.infer<typeof lessonSummaryDiagramSpecSchema>;
export type LessonSummaryDiagramVisual = z.infer<typeof lessonSummaryDiagramVisualSchema>;
export type LessonSummaryDiagramSpecOrigin = z.infer<
  typeof lessonSummaryDiagramSpecOriginSchema
>;

const BRACED_THREE_POINT_ANGLE_PATTERN =
  /\\angle\s*\{([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})\}/gu;
const THREE_POINT_ANGLE_PATTERN =
  /\\angle\s+([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})(?![A-Za-z0-9_'′″₀-₉])/gu;
const SINGLE_POINT_ANGLE_PATTERN =
  /\\angle\s+([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})(?![A-Za-z0-9_'′″₀-₉])/gu;

export function normalizeLessonSummaryAngleNotation(
  value: string,
  diagramSpec?: LessonSummaryDiagramSpec | null,
) {
  const withCanonicalThreePointAngles = value
    .replace(
      BRACED_THREE_POINT_ANGLE_PATTERN,
      (_, first: string, vertex: string, second: string) =>
        `\\widehat{${first}${vertex}${second}}`,
    )
    .replace(
      THREE_POINT_ANGLE_PATTERN,
      (_, first: string, vertex: string, second: string) =>
        `\\widehat{${first}${vertex}${second}}`,
    );
  if (!diagramSpec) return withCanonicalThreePointAngles;

  const pointsById = new Map(
    diagramSpec.points.map((point) => [point.id, point] as const),
  );
  const notationByVertexLabel = new Map<string, string | null>();
  diagramSpec.markers.forEach((marker) => {
    if (marker.type !== "ANGLE" && marker.type !== "RIGHT_ANGLE") return;
    const vertexLabel = pointsById.get(marker.vertex)?.label;
    const firstArmLabel = pointsById.get(marker.armPointIds[0]!)?.label;
    const secondArmLabel = pointsById.get(marker.armPointIds[1]!)?.label;
    if (!vertexLabel || !firstArmLabel || !secondArmLabel) return;
    const notation = `\\widehat{${firstArmLabel}${vertexLabel}${secondArmLabel}}`;
    const existing = notationByVertexLabel.get(vertexLabel);
    notationByVertexLabel.set(
      vertexLabel,
      existing === undefined || existing === notation ? notation : null,
    );
  });

  return withCanonicalThreePointAngles.replace(
    SINGLE_POINT_ANGLE_PATTERN,
    (match, vertexLabel: string) => notationByVertexLabel.get(vertexLabel) ?? match,
  );
}

export function normalizeLessonSummaryDiagramText(value: string) {
  return value
    .trim()
    .replace(/\\{2,}/gu, "\\")
    .replace(/\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}/gu, "$1/$2")
    .replace(/\b(-?)d?frac(\d)(\d)\b/giu, "$1$2/$3")
    .replace(/\\widehat\{([^{}]+)\}/gu, "∠$1")
    .replace(/\\angle\s*/gu, "∠")
    .replace(/\\triangle\s*/gu, "△")
    .replace(/\\(?:mathrm|text)\{([^{}]+)\}/gu, "$1")
    .replace(/\^\{?\\circ\}?/gu, "°")
    .replace(/\\,/gu, " ")
    .replace(/[{}$]/gu, "")
    .replace(/\\([A-Za-z]+)/gu, "$1")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

export function normalizeLessonSummaryDiagramSpec(
  spec: LessonSummaryDiagramSpec,
): LessonSummaryDiagramSpec {
  const geometrySpan = Math.max(
    Math.max(...spec.points.map((point) => point.x)) -
      Math.min(...spec.points.map((point) => point.x)),
    Math.max(...spec.points.map((point) => point.y)) -
      Math.min(...spec.points.map((point) => point.y)),
    1,
  );
  const normalizedPrimitives: LessonSummaryDiagramSpec["primitives"] = spec.primitives
    .filter(
      (primitive) =>
        !(
          primitive.type === "CIRCLE" &&
          primitive.radius < geometrySpan * 0.005 &&
          spec.primitives.length > 1
        ),
    )
    .map((primitive) =>
      primitive.type === "POLYLINE" && primitive.pointIds.length === 2
        ? {
            id: primitive.id,
            type: "SEGMENT" as const,
            from: primitive.pointIds[0]!,
            to: primitive.pointIds[1]!,
            style: primitive.style,
          }
        : primitive,
    );
  const normalized = {
    ...spec,
    points: spec.points.map((point) => ({
      ...point,
      label: point.label ? normalizeLessonSummaryDiagramText(point.label) : null,
    })),
    primitives: normalizedPrimitives,
    markers: spec.markers.map((marker) =>
      marker.type === "ANGLE"
        ? {
            ...marker,
            label: marker.label ? normalizeLessonSummaryDiagramText(marker.label) : null,
          }
        : marker,
    ),
    labels: spec.labels.map((label) => ({
      ...label,
      text: normalizeLessonSummaryDiagramText(label.text),
    })),
    caption: spec.caption ? normalizeLessonSummaryDiagramText(spec.caption) : null,
  };
  return {
    ...normalized,
    viewBox: resolveLessonSummaryDiagramViewBox(normalized),
  };
}

export function resolveLessonSummaryDiagramViewBox(
  spec: LessonSummaryDiagramSpec,
): LessonSummaryDiagramSpec["viewBox"] {
  const points = new Map(spec.points.map((point) => [point.id, point] as const));
  let geometryMinX = Math.min(...spec.points.map((point) => point.x));
  let geometryMaxX = Math.max(...spec.points.map((point) => point.x));
  let geometryMinY = Math.min(...spec.points.map((point) => point.y));
  let geometryMaxY = Math.max(...spec.points.map((point) => point.y));

  const expandBounds = (x: number, y: number) => {
    geometryMinX = Math.min(geometryMinX, x);
    geometryMaxX = Math.max(geometryMaxX, x);
    geometryMinY = Math.min(geometryMinY, y);
    geometryMaxY = Math.max(geometryMaxY, y);
  };
  spec.primitives.forEach((primitive) => {
    if (
      primitive.type !== "CIRCLE" &&
      primitive.type !== "ELLIPSE" &&
      primitive.type !== "ARC"
    ) {
      return;
    }
    const center = points.get(primitive.center);
    if (!center) return;
    if (primitive.type === "CIRCLE") {
      expandBounds(center.x - primitive.radius, center.y - primitive.radius);
      expandBounds(center.x + primitive.radius, center.y + primitive.radius);
      return;
    }
    if (primitive.type === "ELLIPSE") {
      const radians = (primitive.rotation * Math.PI) / 180;
      const halfWidth = Math.hypot(
        primitive.radiusX * Math.cos(radians),
        primitive.radiusY * Math.sin(radians),
      );
      const halfHeight = Math.hypot(
        primitive.radiusX * Math.sin(radians),
        primitive.radiusY * Math.cos(radians),
      );
      expandBounds(center.x - halfWidth, center.y - halfHeight);
      expandBounds(center.x + halfWidth, center.y + halfHeight);
      return;
    }
    arcBoundaryAngles(primitive.startAngle, primitive.endAngle).forEach((angle) => {
      const radians = (angle * Math.PI) / 180;
      expandBounds(
        center.x + primitive.radius * Math.cos(radians),
        center.y + primitive.radius * Math.sin(radians),
      );
    });
  });

  const geometrySpan = Math.max(
    geometryMaxX - geometryMinX,
    geometryMaxY - geometryMinY,
    1,
  );
  const padding = geometrySpan * 0.12;
  const declaredMaxX = spec.viewBox.minX + spec.viewBox.width;
  const declaredMaxY = spec.viewBox.minY + spec.viewBox.height;
  const minX = Math.min(spec.viewBox.minX, geometryMinX - padding);
  const minY = Math.min(spec.viewBox.minY, geometryMinY - padding);
  const maxX = Math.max(declaredMaxX, geometryMaxX + padding);
  const maxY = Math.max(declaredMaxY, geometryMaxY + padding);

  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function arcBoundaryAngles(startAngle: number, endAngle: number) {
  const delta = normalizeDegrees(endAngle - startAngle);
  return [
    startAngle,
    endAngle,
    ...[0, 90, 180, 270].filter(
      (candidate) => normalizeDegrees(candidate - startAngle) <= delta,
    ),
  ];
}

function normalizeDegrees(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function addDuplicateValueIssues(
  values: string[],
  path: Array<string | number>,
  label: string,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!seen.has(value)) {
      seen.add(value);
      return;
    }
    context.addIssue({
      code: "custom",
      path: [...path, index],
      message: `Duplicate ${label}: ${value}.`,
    });
  });
}
