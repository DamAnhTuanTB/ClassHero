import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

type DiagramMarker = LessonSummaryDiagramSpec["markers"][number];
type DiagramLabel = LessonSummaryDiagramSpec["labels"][number];
type DiagramPoint = LessonSummaryDiagramSpec["points"][number];

export type LessonSummaryDiagramEditableTarget =
  | {
      kind: "POINT_LABEL";
      pointId: string;
      fingerprint: string;
      displayText: string;
    }
  | {
      kind: "LABEL";
      labelIndex: number;
      fingerprint: string;
      displayText: string;
    }
  | {
      kind: "ANGLE_LABEL";
      markerIndex: number;
      fingerprint: string;
      displayText: string;
    }
  | {
      kind: "CAPTION";
      fingerprint: string;
      displayText: string;
    }
  | {
      kind: "MARKER";
      markerIndex: number;
      fingerprint: string;
      markerType: DiagramMarker["type"];
    };

export interface LessonSummaryDiagramEditor {
  disabled?: boolean;
  onRequestAddEqualLength?: (segmentIds: string[]) => boolean;
  onRequestDelete?: (target: LessonSummaryDiagramEditableTarget) => void;
  onRequestReset?: () => void;
  onRequestTextEdit?: (
    target: LessonSummaryDiagramTextTarget,
    nextText: string,
  ) => boolean;
}

export type LessonSummaryDiagramTextTarget = Exclude<
  LessonSummaryDiagramEditableTarget,
  { kind: "MARKER" }
>;

export function isLessonSummaryDiagramTextTarget(
  target: LessonSummaryDiagramEditableTarget,
): target is LessonSummaryDiagramTextTarget {
  return target.kind !== "MARKER";
}

export function fingerprintLessonSummaryDiagramValue(value: unknown): string {
  return JSON.stringify(value);
}

export function createPointLabelTarget(
  point: DiagramPoint,
): Extract<LessonSummaryDiagramEditableTarget, { kind: "POINT_LABEL" }> | null {
  if (!point.label) return null;
  return {
    kind: "POINT_LABEL",
    pointId: point.id,
    fingerprint: fingerprintLessonSummaryDiagramValue(point),
    displayText: point.label,
  };
}

export function createDiagramLabelTarget(
  label: DiagramLabel,
  labelIndex: number,
): Extract<LessonSummaryDiagramEditableTarget, { kind: "LABEL" }> {
  return {
    kind: "LABEL",
    labelIndex,
    fingerprint: fingerprintLessonSummaryDiagramValue(label),
    displayText: label.text,
  };
}

export function createAngleLabelTarget(
  marker: Extract<DiagramMarker, { type: "ANGLE" }>,
  markerIndex: number,
): Extract<LessonSummaryDiagramEditableTarget, { kind: "ANGLE_LABEL" }> | null {
  if (!marker.label) return null;
  return {
    kind: "ANGLE_LABEL",
    markerIndex,
    fingerprint: fingerprintLessonSummaryDiagramValue(marker),
    displayText: marker.label,
  };
}

export function createMarkerTarget(
  marker: DiagramMarker,
  markerIndex: number,
): Extract<LessonSummaryDiagramEditableTarget, { kind: "MARKER" }> {
  return {
    kind: "MARKER",
    markerIndex,
    fingerprint: fingerprintLessonSummaryDiagramValue(marker),
    markerType: marker.type,
  };
}

export function createCaptionTarget(
  caption: string | null,
): Extract<LessonSummaryDiagramEditableTarget, { kind: "CAPTION" }> | null {
  if (!caption) return null;
  return {
    kind: "CAPTION",
    fingerprint: fingerprintLessonSummaryDiagramValue(caption),
    displayText: caption,
  };
}

export function describeLessonSummaryDiagramTarget(
  target: LessonSummaryDiagramEditableTarget,
): string {
  switch (target.kind) {
    case "POINT_LABEL":
      return `tên điểm “${target.displayText}”`;
    case "LABEL":
      return `nhãn “${target.displayText}”`;
    case "ANGLE_LABEL":
      return `số đo góc “${target.displayText}”`;
    case "CAPTION":
      return `chú thích hình “${target.displayText}”`;
    case "MARKER":
      return {
        ANGLE: "ký hiệu cung góc",
        RIGHT_ANGLE: "ký hiệu góc vuông",
        EQUAL_LENGTH: "nhóm ký hiệu đoạn thẳng bằng nhau",
        PARALLEL: "nhóm ký hiệu song song",
      }[target.markerType];
  }
}

export function lessonSummaryDiagramTargetKey(
  target: LessonSummaryDiagramEditableTarget,
): string {
  switch (target.kind) {
    case "POINT_LABEL":
      return `${target.kind}:${target.pointId}:${target.fingerprint}`;
    case "LABEL":
      return `${target.kind}:${target.labelIndex}:${target.fingerprint}`;
    case "ANGLE_LABEL":
    case "MARKER":
      return `${target.kind}:${target.markerIndex}:${target.fingerprint}`;
    case "CAPTION":
      return `${target.kind}:${target.fingerprint}`;
  }
}
