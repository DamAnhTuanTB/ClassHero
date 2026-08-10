import {
  lessonSummaryDiagramSpecSchema,
  normalizeLessonSummaryDiagramSpec,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";

type PointInput = LessonSummaryDiagramSpec["points"][number];
type PrimitiveInput = LessonSummaryDiagramSpec["primitives"][number];
type MarkerInput = LessonSummaryDiagramSpec["markers"][number];
type LabelInput = LessonSummaryDiagramSpec["labels"][number];

export class DiagramBuilder {
  private readonly points: PointInput[] = [];
  private readonly primitives: PrimitiveInput[] = [];
  private readonly markers: MarkerInput[] = [];
  private readonly labels: LabelInput[] = [];

  constructor(
    private readonly viewBox: LessonSummaryDiagramSpec["viewBox"],
    private readonly caption: string | null,
  ) {}

  addPoint(point: PointInput) {
    this.points.push(point);
    return point.id;
  }

  addSegment(
    id: string,
    from: string,
    to: string,
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({ id, type: "SEGMENT", from, to, style });
    return id;
  }

  addLine(
    id: string,
    from: string,
    to: string,
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({ id, type: "LINE", from, to, style });
    return id;
  }

  addRay(
    id: string,
    from: string,
    to: string,
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({ id, type: "RAY", from, to, style });
    return id;
  }

  addPolyline(
    id: string,
    pointIds: string[],
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({ id, type: "POLYLINE", pointIds, style });
    return id;
  }

  addPolygon(
    id: string,
    pointIds: string[],
    fill: "NONE" | "SOFT_BLUE" | "SOFT_AMBER" | "SOFT_GREEN" = "NONE",
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({ id, type: "POLYGON", pointIds, fill, style });
    return id;
  }

  addCircle(
    id: string,
    center: string,
    radius: number,
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({ id, type: "CIRCLE", center, radius, style });
    return id;
  }

  addEllipse(
    id: string,
    center: string,
    radiusX: number,
    radiusY: number,
    rotation = 0,
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({
      id,
      type: "ELLIPSE",
      center,
      radiusX,
      radiusY,
      rotation,
      style,
    });
    return id;
  }

  addArc(
    id: string,
    center: string,
    radius: number,
    startAngle: number,
    endAngle: number,
    style: "SOLID" | "DASHED" | "DOTTED" = "SOLID",
  ) {
    this.primitives.push({
      id,
      type: "ARC",
      center,
      radius,
      startAngle,
      endAngle,
      style,
    });
    return id;
  }

  addRightAngle(vertex: string, firstArm: string, secondArm: string) {
    this.markers.push({
      type: "RIGHT_ANGLE",
      vertex,
      armPointIds: [firstArm, secondArm],
    });
  }

  addEqualLengths(segmentIds: string[], markCount = 1) {
    this.markers.push({ type: "EQUAL_LENGTH", segmentIds, markCount });
  }

  addParallels(segmentIds: string[], markCount = 1) {
    this.markers.push({ type: "PARALLEL", segmentIds, markCount });
  }

  addAngle(
    vertex: string,
    firstArm: string,
    secondArm: string,
    label: string | null,
  ) {
    this.markers.push({
      type: "ANGLE",
      vertex,
      armPointIds: [firstArm, secondArm],
      label,
    });
  }

  addLabel(label: LabelInput) {
    this.labels.push(label);
  }

  build(): LessonSummaryDiagramSpec {
    return normalizeLessonSummaryDiagramSpec(
      lessonSummaryDiagramSpecSchema.parse({
        version: 1,
        coordinateSystem: "CARTESIAN",
        viewBox: this.viewBox,
        toScale: true,
        points: this.points,
        primitives: this.primitives,
        markers: this.markers,
        labels: this.labels,
        caption: this.caption,
      }),
    );
  }
}

export function safeDiagramId(prefix: string, index: number) {
  return `${prefix}${index}`;
}

export function formatDiagramNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}
