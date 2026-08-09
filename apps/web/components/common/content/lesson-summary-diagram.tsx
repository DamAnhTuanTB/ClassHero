"use client";

import {
  lessonSummaryDiagramSpecSchema,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";

type Point = LessonSummaryDiagramSpec["points"][number];

export function LessonSummaryDiagram({
  spec,
  showEditorialWarning = false,
}: {
  spec: unknown;
  showEditorialWarning?: boolean;
}) {
  const parsed = lessonSummaryDiagramSpecSchema.safeParse(spec);
  if (!parsed.success) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-3 text-sm font-semibold text-[var(--theme-warning-text)]">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {showEditorialWarning
          ? "Sơ đồ chưa hợp lệ. Admin cần chỉnh lại diagramSpec trước khi phát hành."
          : "Sơ đồ minh họa hiện chưa thể hiển thị."}
      </div>
    );
  }

  return <ValidatedLessonSummaryDiagram spec={parsed.data} />;
}

function ValidatedLessonSummaryDiagram({ spec }: { spec: LessonSummaryDiagramSpec }) {
  const clipId = useId().replaceAll(":", "-");
  const points = new Map(spec.points.map((point) => [point.id, point] as const));
  const primitives = new Map(
    spec.primitives.map((primitive) => [primitive.id, primitive] as const),
  );
  const { minX, minY, width, height } = spec.viewBox;
  const toSvgY = (value: number) => minY + height - (value - minY);
  const resolve = (id: string) => points.get(id);
  const labelOffset = Math.max(width, height) * 0.025;

  return (
    <figure className="mt-4 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white p-3 dark:bg-slate-950 sm:p-4">
      <svg
        aria-label={spec.caption ?? "Sơ đồ minh họa cho bài toán"}
        className="mx-auto block h-auto max-h-[28rem] w-full text-slate-800 dark:text-slate-100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`${minX} ${minY} ${width} ${height}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={minX} y={minY} width={width} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {spec.primitives.map((primitive) => {
            if (
              primitive.type === "SEGMENT" ||
              primitive.type === "LINE" ||
              primitive.type === "RAY"
            ) {
              const from = resolve(primitive.from);
              const to = resolve(primitive.to);
              if (!from || !to) return null;
              const endpoints = extendLinePrimitive(
                primitive.type,
                from,
                to,
                Math.max(width, height) * 2,
              );
              return (
                <line
                  key={primitive.id}
                  x1={endpoints.from.x}
                  y1={toSvgY(endpoints.from.y)}
                  x2={endpoints.to.x}
                  y2={toSvgY(endpoints.to.y)}
                  className="stroke-current"
                  strokeDasharray={dashArray(primitive.style, width)}
                  strokeLinecap="round"
                  strokeWidth={Math.max(width, height) * 0.008}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (primitive.type === "POLYGON" || primitive.type === "POLYLINE") {
              const polygonPoints = primitive.pointIds
                .map(resolve)
                .filter((point): point is Point => Boolean(point));
              if (polygonPoints.length !== primitive.pointIds.length) return null;
              if (primitive.type === "POLYLINE") {
                return (
                  <polyline
                    key={primitive.id}
                    points={polygonPoints
                      .map((point) => `${point.x},${toSvgY(point.y)}`)
                      .join(" ")}
                    className="fill-none stroke-current"
                    strokeDasharray={dashArray(primitive.style, width)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={Math.max(width, height) * 0.008}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              return (
                <polygon
                  key={primitive.id}
                  points={polygonPoints
                    .map((point) => `${point.x},${toSvgY(point.y)}`)
                    .join(" ")}
                  className={`${fillClass(primitive.fill)} stroke-current`}
                  strokeDasharray={dashArray(primitive.style, width)}
                  strokeLinejoin="round"
                  strokeWidth={Math.max(width, height) * 0.008}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            const center = resolve(primitive.center);
            if (!center) return null;
            if (primitive.type === "CIRCLE") {
              return (
                <circle
                  key={primitive.id}
                  cx={center.x}
                  cy={toSvgY(center.y)}
                  r={primitive.radius}
                  className="fill-none stroke-current"
                  strokeDasharray={dashArray(primitive.style, width)}
                  strokeWidth={Math.max(width, height) * 0.008}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            const start = polarPoint(center, primitive.radius, primitive.startAngle);
            const end = polarPoint(center, primitive.radius, primitive.endAngle);
            const delta = normalizedAngleDelta(primitive.startAngle, primitive.endAngle);
            return (
              <path
                key={primitive.id}
                d={`M ${start.x} ${toSvgY(start.y)} A ${primitive.radius} ${primitive.radius} 0 ${delta > 180 ? 1 : 0} 0 ${end.x} ${toSvgY(end.y)}`}
                className="fill-none stroke-current"
                strokeDasharray={dashArray(primitive.style, width)}
                strokeWidth={Math.max(width, height) * 0.008}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {spec.markers.map((marker, index) => {
            if (marker.type === "RIGHT_ANGLE") {
              const vertex = resolve(marker.vertex);
              const first = resolve(marker.armPointIds[0]!);
              const second = resolve(marker.armPointIds[1]!);
              if (!vertex || !first || !second) return null;
              const markerPoints = rightAnglePoints(
                vertex,
                first,
                second,
                Math.max(width, height) * 0.08,
              );
              return (
                <polyline
                  key={`right-angle-${index}`}
                  points={markerPoints
                    .map((point) => `${point.x},${toSvgY(point.y)}`)
                    .join(" ")}
                  className="fill-none stroke-sky-600 dark:stroke-sky-300"
                  strokeWidth={Math.max(width, height) * 0.006}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (marker.type === "ANGLE") {
              const vertex = resolve(marker.vertex);
              if (!vertex) return null;
              return (
                <text
                  key={`angle-${index}`}
                  x={vertex.x + labelOffset}
                  y={toSvgY(vertex.y) - labelOffset}
                  className="fill-sky-700 text-[0.42px] font-bold dark:fill-sky-300"
                  fontSize={Math.max(width, height) * 0.045}
                >
                  {marker.label}
                </text>
              );
            }
            return marker.segmentIds.flatMap((segmentId, segmentIndex) => {
              const primitive = primitives.get(segmentId);
              if (
                !primitive ||
                !(
                  primitive.type === "SEGMENT" ||
                  primitive.type === "LINE" ||
                  primitive.type === "RAY"
                )
              ) {
                return [];
              }
              const from = resolve(primitive.from);
              const to = resolve(primitive.to);
              if (!from || !to) return [];
              return [
                <g key={`${marker.type}-${index}-${segmentIndex}`}>
                  {Array.from({ length: marker.markCount }).map((_, markIndex) => (
                    <line
                      key={markIndex}
                      {...markerLineProps({
                        from,
                        to,
                        markIndex,
                        markCount: marker.markCount,
                        markerType: marker.type,
                        size: Math.max(width, height) * 0.05,
                        toSvgY,
                      })}
                      className="stroke-sky-600 dark:stroke-sky-300"
                      strokeWidth={Math.max(width, height) * 0.006}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>,
              ];
            });
          })}

          {spec.points.map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={toSvgY(point.y)}
                r={Math.max(width, height) * 0.017}
                className="fill-slate-900 dark:fill-slate-100"
              />
              {point.label ? (
                <text
                  x={point.x + positionOffset(point.labelPosition, labelOffset).x}
                  y={toSvgY(point.y) - positionOffset(point.labelPosition, labelOffset).y}
                  className="fill-slate-900 font-bold dark:fill-slate-100"
                  fontSize={Math.max(width, height) * 0.05}
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}

          {spec.labels.map((label, index) => {
            const anchor = resolve(label.anchorPointId);
            if (!anchor) return null;
            const offset = positionOffset(label.position, labelOffset * 1.5);
            return (
              <text
                key={`${label.anchorPointId}-${index}`}
                x={anchor.x + offset.x}
                y={toSvgY(anchor.y) - offset.y}
                className="fill-slate-700 font-semibold dark:fill-slate-200"
                fontSize={Math.max(width, height) * 0.042}
              >
                {label.text}
              </text>
            );
          })}
        </g>
      </svg>
      {spec.caption ? (
        <figcaption className="mt-2 text-center text-xs font-semibold text-[var(--theme-text-muted)]">
          {spec.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function extendLinePrimitive(
  type: "SEGMENT" | "LINE" | "RAY",
  from: Point,
  to: Point,
  span: number,
) {
  if (type === "SEGMENT") return { from, to };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const extendedTo = { ...to, x: from.x + unit.x * span, y: from.y + unit.y * span };
  if (type === "RAY") return { from, to: extendedTo };
  return {
    from: { ...from, x: from.x - unit.x * span, y: from.y - unit.y * span },
    to: extendedTo,
  };
}

function dashArray(style: "SOLID" | "DASHED" | "DOTTED", width: number) {
  if (style === "SOLID") return undefined;
  return style === "DASHED" ? `${width * 0.04} ${width * 0.025}` : `1 ${width * 0.025}`;
}

function fillClass(fill: "NONE" | "SOFT_BLUE" | "SOFT_AMBER" | "SOFT_GREEN") {
  return {
    NONE: "fill-none",
    SOFT_BLUE: "fill-sky-100/70 dark:fill-sky-900/30",
    SOFT_AMBER: "fill-amber-100/70 dark:fill-amber-900/30",
    SOFT_GREEN: "fill-emerald-100/70 dark:fill-emerald-900/30",
  }[fill];
}

function polarPoint(center: Point, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(radians),
    y: center.y + radius * Math.sin(radians),
  };
}

function normalizedAngleDelta(start: number, end: number) {
  return (((end - start) % 360) + 360) % 360;
}

function normalizedVector(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function rightAnglePoints(vertex: Point, first: Point, second: Point, size: number) {
  const firstUnit = normalizedVector(vertex, first);
  const secondUnit = normalizedVector(vertex, second);
  const alongFirst = {
    x: vertex.x + firstUnit.x * size,
    y: vertex.y + firstUnit.y * size,
  };
  const corner = {
    x: alongFirst.x + secondUnit.x * size,
    y: alongFirst.y + secondUnit.y * size,
  };
  const alongSecond = {
    x: vertex.x + secondUnit.x * size,
    y: vertex.y + secondUnit.y * size,
  };
  return [alongFirst, corner, alongSecond];
}

function markerLineProps(input: {
  from: Point;
  to: Point;
  markIndex: number;
  markCount: number;
  markerType: "EQUAL_LENGTH" | "PARALLEL";
  size: number;
  toSvgY: (value: number) => number;
}) {
  const unit = normalizedVector(input.from, input.to);
  const normal = { x: -unit.y, y: unit.x };
  const spacing = input.size * 0.34;
  const offset = (input.markIndex - (input.markCount - 1) / 2) * spacing;
  const center = {
    x: (input.from.x + input.to.x) / 2 + unit.x * offset,
    y: (input.from.y + input.to.y) / 2 + unit.y * offset,
  };
  const half = input.markerType === "PARALLEL" ? input.size * 0.42 : input.size * 0.3;
  return {
    x1: center.x - normal.x * half,
    y1: input.toSvgY(center.y - normal.y * half),
    x2: center.x + normal.x * half,
    y2: input.toSvgY(center.y + normal.y * half),
  };
}

function positionOffset(position: Point["labelPosition"], amount: number) {
  return {
    TOP: { x: 0, y: amount },
    TOP_RIGHT: { x: amount, y: amount },
    RIGHT: { x: amount, y: 0 },
    BOTTOM_RIGHT: { x: amount, y: -amount },
    BOTTOM: { x: 0, y: -amount },
    BOTTOM_LEFT: { x: -amount, y: -amount },
    LEFT: { x: -amount, y: 0 },
    TOP_LEFT: { x: -amount, y: amount },
  }[position ?? "TOP_RIGHT"];
}
