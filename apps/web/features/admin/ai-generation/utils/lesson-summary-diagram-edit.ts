import {
  lessonSummaryDiagramSpecSchema,
  lessonSummaryDiagramSpecStructuralSchema,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";
import {
  fingerprintLessonSummaryDiagramValue,
  type LessonSummaryDiagramEditableTarget,
  type LessonSummaryDiagramTextTarget,
} from "@/components/common/content/lesson-summary-diagram-editing";

export type DeleteLessonSummaryDiagramTargetResult =
  { success: true; spec: LessonSummaryDiagramSpec } | { success: false; reason: string };

export type EditLessonSummaryDiagramTargetResult = DeleteLessonSummaryDiagramTargetResult;

export function addEqualLengthMarkerToLessonSummaryDiagram(
  spec: unknown,
  segmentIds: string[],
): EditLessonSummaryDiagramTargetResult {
  const parsed = lessonSummaryDiagramSpecStructuralSchema.safeParse(spec);
  if (!parsed.success) {
    return {
      success: false,
      reason: "Hình hiện không đạt cấu trúc an toàn để chỉnh trực tiếp.",
    };
  }
  const current = parsed.data;
  const uniqueSegmentIds = [...new Set(segmentIds)];
  if (uniqueSegmentIds.length < 2) {
    return {
      success: false,
      reason: "Cần chọn ít nhất hai đoạn thẳng để đánh dấu bằng nhau.",
    };
  }
  const pointsById = new Map(current.points.map((point) => [point.id, point] as const));
  const primitivesById = new Map(
    current.primitives.map((primitive) => [primitive.id, primitive] as const),
  );
  const invalidSegmentId = uniqueSegmentIds.find((segmentId) => {
    const primitive = primitivesById.get(segmentId);
    if (primitive?.type !== "SEGMENT") return true;
    return !pointsById.get(primitive.from)?.label || !pointsById.get(primitive.to)?.label;
  });
  if (invalidSegmentId) {
    return {
      success: false,
      reason: "Chỉ có thể đánh dấu các đoạn thẳng có nhãn tên ở cả hai đầu mút.",
    };
  }
  const alreadyMarkedIds = new Set(
    current.markers.flatMap((marker) =>
      marker.type === "EQUAL_LENGTH" ? marker.segmentIds : [],
    ),
  );
  if (uniqueSegmentIds.some((segmentId) => alreadyMarkedIds.has(segmentId))) {
    return {
      success: false,
      reason: "Có đoạn đã thuộc một nhóm bằng nhau khác. Hãy bỏ chọn đoạn đó.",
    };
  }
  const usedMarkCounts = new Set(
    current.markers.flatMap((marker) =>
      marker.type === "EQUAL_LENGTH" ? [marker.markCount] : [],
    ),
  );
  const markCount = [1, 2, 3, 4].find((candidate) => !usedMarkCounts.has(candidate));
  if (!markCount) {
    return {
      success: false,
      reason: "Hình đã dùng đủ bốn kiểu vạch bằng nhau; chưa thể thêm nhóm mới.",
    };
  }
  const next: LessonSummaryDiagramSpec = {
    ...current,
    markers: [
      ...current.markers,
      { type: "EQUAL_LENGTH", segmentIds: uniqueSegmentIds, markCount },
    ],
  };
  return validateDiagramChange(current, next, "sửa");
}

export function deleteLessonSummaryDiagramTarget(
  spec: unknown,
  target: LessonSummaryDiagramEditableTarget,
): DeleteLessonSummaryDiagramTargetResult {
  const parsed = lessonSummaryDiagramSpecStructuralSchema.safeParse(spec);
  if (!parsed.success) {
    return {
      success: false,
      reason: "Hình hiện không đạt cấu trúc an toàn để chỉnh trực tiếp.",
    };
  }

  const current = parsed.data;
  let next: LessonSummaryDiagramSpec;

  switch (target.kind) {
    case "POINT_LABEL": {
      return {
        success: false,
        reason: "Tên điểm chỉ được sửa, không được xóa khỏi hình.",
      };
    }
    case "LABEL": {
      const label = current.labels[target.labelIndex];
      if (!label || fingerprintLessonSummaryDiagramValue(label) !== target.fingerprint) {
        return staleTargetResult();
      }
      next = {
        ...current,
        labels: current.labels.filter((_, index) => index !== target.labelIndex),
      };
      break;
    }
    case "ANGLE_LABEL": {
      const marker = current.markers[target.markerIndex];
      if (
        !marker ||
        marker.type !== "ANGLE" ||
        !marker.label ||
        fingerprintLessonSummaryDiagramValue(marker) !== target.fingerprint
      ) {
        return staleTargetResult();
      }
      next = {
        ...current,
        markers: current.markers.map((candidate, index) =>
          index === target.markerIndex && candidate.type === "ANGLE"
            ? { ...candidate, label: null }
            : candidate,
        ),
      };
      break;
    }
    case "CAPTION": {
      if (
        !current.caption ||
        fingerprintLessonSummaryDiagramValue(current.caption) !== target.fingerprint
      ) {
        return staleTargetResult();
      }
      next = { ...current, caption: null };
      break;
    }
    case "MARKER": {
      const marker = current.markers[target.markerIndex];
      if (
        !marker ||
        marker.type !== target.markerType ||
        fingerprintLessonSummaryDiagramValue(marker) !== target.fingerprint
      ) {
        return staleTargetResult();
      }
      next = {
        ...current,
        markers: current.markers.filter((_, index) => index !== target.markerIndex),
      };
      break;
    }
  }

  return validateDiagramChange(current, next, "xóa");
}

export function editLessonSummaryDiagramTargetText(
  spec: unknown,
  target: LessonSummaryDiagramTextTarget,
  nextText: string,
): EditLessonSummaryDiagramTargetResult {
  const parsed = lessonSummaryDiagramSpecStructuralSchema.safeParse(spec);
  if (!parsed.success) {
    return {
      success: false,
      reason: "Hình hiện không đạt cấu trúc an toàn để chỉnh trực tiếp.",
    };
  }
  const normalizedText = nextText.trim();
  if (!normalizedText) {
    return {
      success: false,
      reason: "Nội dung không được để trống. Hãy dùng nút xóa nếu muốn bỏ nhãn này.",
    };
  }

  const current = parsed.data;
  let next: LessonSummaryDiagramSpec;
  switch (target.kind) {
    case "POINT_LABEL": {
      const pointIndex = current.points.findIndex((point) => point.id === target.pointId);
      const point = current.points[pointIndex];
      if (
        pointIndex < 0 ||
        !point?.label ||
        fingerprintLessonSummaryDiagramValue(point) !== target.fingerprint
      ) {
        return staleTargetResult("sửa");
      }
      next = {
        ...current,
        points: current.points.map((candidate, index) =>
          index === pointIndex ? { ...candidate, label: normalizedText } : candidate,
        ),
      };
      break;
    }
    case "LABEL": {
      const label = current.labels[target.labelIndex];
      if (!label || fingerprintLessonSummaryDiagramValue(label) !== target.fingerprint) {
        return staleTargetResult("sửa");
      }
      next = {
        ...current,
        labels: current.labels.map((candidate, index) =>
          index === target.labelIndex
            ? { ...candidate, text: normalizedText }
            : candidate,
        ),
      };
      break;
    }
    case "ANGLE_LABEL": {
      const marker = current.markers[target.markerIndex];
      if (
        !marker ||
        marker.type !== "ANGLE" ||
        !marker.label ||
        fingerprintLessonSummaryDiagramValue(marker) !== target.fingerprint
      ) {
        return staleTargetResult("sửa");
      }
      next = {
        ...current,
        markers: current.markers.map((candidate, index) =>
          index === target.markerIndex && candidate.type === "ANGLE"
            ? { ...candidate, label: normalizedText }
            : candidate,
        ),
      };
      break;
    }
    case "CAPTION": {
      if (
        !current.caption ||
        fingerprintLessonSummaryDiagramValue(current.caption) !== target.fingerprint
      ) {
        return staleTargetResult("sửa");
      }
      next = { ...current, caption: normalizedText };
      break;
    }
  }

  return validateDiagramChange(current, next, "sửa");
}

function validateDiagramChange(
  current: LessonSummaryDiagramSpec,
  next: LessonSummaryDiagramSpec,
  action: "sửa" | "xóa",
): DeleteLessonSummaryDiagramTargetResult {
  const structurallyValid = lessonSummaryDiagramSpecStructuralSchema.safeParse(next);
  if (!structurallyValid.success) {
    return {
      success: false,
      reason: describeDiagramValidationFailure(structurallyValid.error.issues[0], action),
    };
  }

  const remainingCurrentIssues = acceptanceIssueCounts(current);
  const nextAcceptance = lessonSummaryDiagramSpecSchema.safeParse(structurallyValid.data);
  const introducedIssue = nextAcceptance.success
    ? undefined
    : nextAcceptance.error.issues.find((issue) => {
        const key = acceptanceIssueKey(issue);
        const remainingCount = remainingCurrentIssues.get(key) ?? 0;
        if (remainingCount === 0) return true;
        remainingCurrentIssues.set(key, remainingCount - 1);
        return false;
      });
  if (introducedIssue) {
    return {
      success: false,
      reason: describeDiagramValidationFailure(introducedIssue, action),
    };
  }

  return { success: true, spec: structurallyValid.data };
}

function describeDiagramValidationFailure(
  issue: { message?: string; path?: PropertyKey[] } | undefined,
  action: "sửa" | "xóa",
) {
  const path = issue?.path?.map(String) ?? [];
  const internalMessage = issue?.message?.toLowerCase() ?? "";
  if (
    (internalMessage.includes("point label") &&
      (internalMessage.includes("unique") || internalMessage.includes("duplicate"))) ||
    (internalMessage.includes("point.id") &&
      internalMessage.includes("point.label") &&
      internalMessage.includes("duy nhất"))
  ) {
    return "Tên điểm này đã được dùng trong hình. Hãy chọn một tên khác.";
  }
  if (path.includes("points") && path.includes("label")) {
    return "Tên điểm chỉ được gồm một chữ cái in hoa, có thể kèm dấu phẩy hoặc chỉ số. Ví dụ: A, A′ hoặc A1.";
  }
  if (path.includes("markers")) {
    return `Không thể ${action} vì ký hiệu hình học sẽ không còn đúng. Hãy kiểm tra lại các cạnh và góc liên quan.`;
  }
  if (path.includes("primitives")) {
    return `Không thể ${action} vì cạnh hoặc đường trên hình sẽ không còn hợp lệ.`;
  }
  if (internalMessage.includes("cardinal labels")) {
    return "Không thể xóa vì mặt đồng hồ phải giữ đủ các số 12, 3, 6 và 9.";
  }
  return `Không thể ${action} vì nội dung hoặc cấu trúc hình sẽ không còn hợp lệ. Hãy kiểm tra lại phần vừa chọn.`;
}

function staleTargetResult(
  action: "sửa" | "xóa" = "xóa",
): DeleteLessonSummaryDiagramTargetResult {
  return {
    success: false,
    reason: `Phần tử đã thay đổi. Hãy chọn lại trên hình rồi thử ${action}.`,
  };
}

function acceptanceIssueCounts(spec: LessonSummaryDiagramSpec): Map<string, number> {
  const parsed = lessonSummaryDiagramSpecSchema.safeParse(spec);
  if (parsed.success) return new Map();
  const counts = new Map<string, number>();
  parsed.error.issues.forEach((issue) => {
    const key = acceptanceIssueKey(issue);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function acceptanceIssueKey(issue: {
  code: string;
  message: string;
  path: PropertyKey[];
}): string {
  const semanticPath = issue.path
    .filter((part) => typeof part !== "number")
    .map(String)
    .join(".");
  return `${issue.code}:${semanticPath}:${issue.message}`;
}
