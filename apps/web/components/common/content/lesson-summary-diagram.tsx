"use client";

import {
  lessonSummaryDiagramSpecSchema,
  normalizeLessonSummaryDiagramSpec,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";
import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Point = LessonSummaryDiagramSpec["points"][number];
type Primitive = LessonSummaryDiagramSpec["primitives"][number];
type LabelPosition = LessonSummaryDiagramSpec["labels"][number]["position"];
const SEGMENT_LABEL_PATTERN =
  /^([A-Z](?:['′″]|[0-9₀-₉]){0,3})([A-Z](?:['′″]|[0-9₀-₉]){0,3})(?=\s*(?:=|≈|≅|⊥|∥|\b))/u;
const COORDINATE_LABEL_PATTERN = /^\(\s*-?\d+(?:[.,]\d+)?\s*;\s*-?\d+(?:[.,]\d+)?\s*\)$/u;
const COMPACT_VALUE_LABEL_PATTERN = /^-?\d+(?:[.,]\d+)?%?$/u;
const NUMBER_LINE_VALUE_LABEL_PATTERN = /^-?\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?$/u;
const POINT_NAME_LABEL_PATTERN = /^[A-Z](?:['′″]|[0-9₀-₉]){0,3}$/u;
const COMPACT_MEASUREMENT_LABEL_PATTERN =
  /^(?:-?\d+(?:[.,]\d+)?\s*(?:mm|cm|dm|m|km|°)|[rh])$/iu;
const MINIMUM_AXIS_TICK_LENGTH = 0.04;

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

  return (
    <ValidatedLessonSummaryDiagram
      spec={normalizeLessonSummaryDiagramSpec(parsed.data)}
    />
  );
}

function ValidatedLessonSummaryDiagram({ spec }: { spec: LessonSummaryDiagramSpec }) {
  const clipId = useId().replaceAll(":", "-");
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgViewport, setSvgViewport] = useState({ width: 0, height: 0 });
  const arrowId = `${clipId}-arrow`;
  const points = new Map(spec.points.map((point) => [point.id, point] as const));
  const pointsByLabel = new Map(
    spec.points.flatMap((point) => (point.label ? [[point.label, point] as const] : [])),
  );
  const primitives = new Map(
    spec.primitives.map((primitive) => [primitive.id, primitive] as const),
  );
  const { minX, minY, width, height } = spec.viewBox;
  const resolve = (id: string) => points.get(id);
  const diagramScale = Math.max(width, height);
  const textScale = Math.min(
    diagramScale,
    Math.max(Math.min(width, height), diagramScale * 0.52),
  );
  const pointPlacementScale = Math.max(textScale, diagramScale * 0.72);
  const renderPadding = diagramScale * 0.065;
  const renderViewBox = {
    minX: minX - renderPadding,
    minY: minY - renderPadding,
    width: width + renderPadding * 2,
    height: height + renderPadding * 2,
  };
  const minimumReadablePointLabelFontSize =
    svgViewport.width > 0 && svgViewport.height > 0
      ? 10 *
        Math.max(
          renderViewBox.width / svgViewport.width,
          renderViewBox.height / svgViewport.height,
        )
      : 0;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const updateViewport = () => {
      const box = svg.getBoundingClientRect();
      const nextViewport = {
        width: Math.round(box.width * 10) / 10,
        height: Math.round(box.height * 10) / 10,
      };
      setSvgViewport((current) =>
        current.width === nextViewport.width && current.height === nextViewport.height
          ? current
          : nextViewport,
      );
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const toSvgY = (value: number) =>
    renderViewBox.minY + renderViewBox.height - (value - renderViewBox.minY);
  const labelOffset = textScale * 0.035;
  const pointLabelOffset = textScale * 0.014;
  const coordinateLabelsByPointId = new Map(
    spec.labels.flatMap((label) =>
      COORDINATE_LABEL_PATTERN.test(label.text)
        ? [[label.anchorPointId, label] as const]
        : [],
    ),
  );
  const hasFunctionLabel = spec.labels.some((label) => /^y\s*=/iu.test(label.text));
  const isCoordinatePlane =
    hasFunctionLabel ||
    /(?:đồ\s*thị|mặt\s*phẳng\s*tọa\s*độ|hệ\s*trục|oxy|parabol)/iu.test(
      spec.caption ?? "",
    );
  const isAxisBasedChart = /biểu\s*đồ/iu.test(spec.caption ?? "");
  const isDataTable = /bảng/iu.test(spec.caption ?? "");
  const hasExplicitXAxisLabel = spec.labels.some(
    (label) => label.text.trim().toLowerCase() === "x",
  );
  const hasExplicitYAxisLabel = spec.labels.some(
    (label) => label.text.trim().toLowerCase() === "y",
  );
  const coordinateAxisIds = new Set(
    isCoordinatePlane
      ? spec.primitives.flatMap((primitive) => {
          if (primitive.type !== "LINE") return [];
          const from = resolve(primitive.from);
          const to = resolve(primitive.to);
          if (!from || !to) return [];
          const isXAxis =
            Math.abs(from.y) <= height * 0.01 && Math.abs(to.y) <= height * 0.01;
          const isYAxis =
            Math.abs(from.x) <= width * 0.01 && Math.abs(to.x) <= width * 0.01;
          return isXAxis || isYAxis ? [primitive.id] : [];
        })
      : [],
  );
  const chartAxisIds = new Set(
    isAxisBasedChart
      ? spec.primitives.flatMap((primitive) => {
          if (primitive.type !== "LINE" && primitive.type !== "SEGMENT") return [];
          const from = resolve(primitive.from);
          const to = resolve(primitive.to);
          if (!from || !to) return [];
          const isXAxis =
            Math.abs(from.y) <= height * 0.01 &&
            Math.abs(to.y) <= height * 0.01 &&
            Math.abs(from.x - to.x) >= width * 0.3;
          const isYAxis =
            Math.abs(from.x) <= width * 0.01 &&
            Math.abs(to.x) <= width * 0.01 &&
            Math.abs(from.y - to.y) >= height * 0.3;
          return isXAxis || isYAxis ? [primitive.id] : [];
        })
      : [],
  );
  const isNumberLine = /trục\s*số/iu.test(spec.caption ?? "");
  const hiddenNumberLineOriginLabels = new Set(
    isNumberLine
      ? spec.points.flatMap((point) => {
          if (point.label?.trim().toUpperCase() !== "O") return [];
          const hasZeroAtOrigin = spec.labels.some((label) => {
            if (label.text.trim() !== "0") return false;
            const anchor = resolve(label.anchorPointId);
            return (
              anchor &&
              Math.abs(anchor.x - point.x) <= width * 0.005 &&
              Math.abs(anchor.y - point.y) <= height * 0.2
            );
          });
          return hasZeroAtOrigin ? [point.id] : [];
        })
      : [],
  );
  const graphConstructionPointIds = new Set(
    isCoordinatePlane
      ? spec.primitives.flatMap((primitive) =>
          primitive.type === "POLYLINE" && primitive.pointIds.length >= 17
            ? primitive.pointIds.filter(
                (pointId) => resolve(pointId)?.pointStyle === "FILLED",
              )
            : [],
        )
      : [],
  );
  const coordinateProjectionPoints = isCoordinatePlane
    ? spec.points.filter(
        (point) =>
          point.pointStyle === "FILLED" &&
          Boolean(point.label) &&
          (graphConstructionPointIds.has(point.id) ||
            coordinateLabelsByPointId.has(point.id)),
      )
    : [];
  const numberLineAxisIds = new Set(
    isNumberLine
      ? spec.primitives.flatMap((primitive) => {
          if (primitive.type !== "LINE") return [];
          const from = resolve(primitive.from);
          const to = resolve(primitive.to);
          if (!from || !to) return [];
          return Math.abs(from.y - to.y) <= height * 0.01 &&
            Math.abs(from.x - to.x) >= width * 0.3
            ? [primitive.id]
            : [];
        })
      : [],
  );
  const axisPrimitiveIds = new Set([
    ...coordinateAxisIds,
    ...chartAxisIds,
    ...numberLineAxisIds,
  ]);
  const axisTickSegmentIds = new Set(
    spec.primitives.flatMap((primitive) =>
      isAxisTickSegment(primitive, spec, points, axisPrimitiveIds) ? [primitive.id] : [],
    ),
  );
  const visibleCircleCenterPointIds = new Set(
    spec.primitives.flatMap((primitive) => {
      if (primitive.type !== "CIRCLE") return [];
      const center = resolve(primitive.center);
      if (!center) return [];
      const hasVisibleName =
        POINT_NAME_LABEL_PATTERN.test(center.label ?? "") ||
        spec.labels.some(
          (label) =>
            label.anchorPointId === center.id &&
            !label.anchorPrimitiveId &&
            POINT_NAME_LABEL_PATTERN.test(label.text.trim()),
        );
      const isClockPivot = /đồng\s*hồ/iu.test(spec.caption ?? "");
      return hasVisibleName || isClockPivot ? [center.id] : [];
    }),
  );

  return (
    <figure className="mt-4 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white p-3 dark:bg-slate-950 sm:p-4">
      <svg
        ref={svgRef}
        aria-label={spec.caption ?? "Sơ đồ minh họa cho bài toán"}
        className="mx-auto block h-auto max-h-[28rem] w-full text-slate-800 dark:text-slate-100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`${renderViewBox.minX} ${renderViewBox.minY} ${renderViewBox.width} ${renderViewBox.height}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={renderViewBox.minX}
              y={renderViewBox.minY}
              width={renderViewBox.width}
              height={renderViewBox.height}
            />
          </clipPath>
          <marker
            id={arrowId}
            markerHeight="6"
            markerUnits="strokeWidth"
            markerWidth="6"
            orient="auto-start-reverse"
            refX="5"
            refY="3"
            viewBox="0 0 6 6"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="context-stroke" />
          </marker>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {coordinateProjectionPoints.flatMap((point) => [
            Math.abs(point.x) > width * 0.005 ? (
              <line
                key={`${point.id}-projection-x`}
                data-diagram-coordinate-projection="x"
                data-diagram-coordinate-projection-point-id={point.id}
                x1={point.x}
                y1={toSvgY(point.y)}
                x2={point.x}
                y2={toSvgY(0)}
                className="stroke-slate-300 dark:stroke-slate-700"
                strokeDasharray="4 4"
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
            Math.abs(point.y) > height * 0.005 ? (
              <line
                key={`${point.id}-projection-y`}
                data-diagram-coordinate-projection="y"
                data-diagram-coordinate-projection-point-id={point.id}
                x1={point.x}
                y1={toSvgY(point.y)}
                x2={0}
                y2={toSvgY(point.y)}
                className="stroke-slate-300 dark:stroke-slate-700"
                strokeDasharray="4 4"
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          ])}
          {spec.primitives.map((primitive) => {
            if (
              primitive.type === "SEGMENT" ||
              primitive.type === "LINE" ||
              primitive.type === "RAY"
            ) {
              const from = resolve(primitive.from);
              const to = resolve(primitive.to);
              if (!from || !to) return null;
              const clippedEndpoints = clipLinePrimitive(
                primitive.type,
                from,
                to,
                spec.viewBox,
              );
              const isCoordinateAxis = coordinateAxisIds.has(primitive.id);
              const isNumberLineAxis = numberLineAxisIds.has(primitive.id);
              const orientedEndpoints =
                isCoordinateAxis || isNumberLineAxis
                  ? orientCoordinateAxisEndpoints(clippedEndpoints)
                  : clippedEndpoints;
              const isAxisTick = axisTickSegmentIds.has(primitive.id);
              const endpoints = isAxisTick
                ? clampSegmentLength(
                    orientedEndpoints,
                    Math.max(MINIMUM_AXIS_TICK_LENGTH, Math.min(width, height) * 0.02),
                  )
                : orientedEndpoints;
              return (
                <line
                  key={primitive.id}
                  data-diagram-axis-tick={isAxisTick ? "true" : undefined}
                  x1={endpoints.from.x}
                  y1={toSvgY(endpoints.from.y)}
                  x2={endpoints.to.x}
                  y2={toSvgY(endpoints.to.y)}
                  className="stroke-current"
                  markerEnd={
                    primitive.type === "RAY" || isCoordinateAxis || isNumberLineAxis
                      ? `url(#${arrowId})`
                      : undefined
                  }
                  strokeDasharray={dashArray(primitive.style)}
                  strokeLinecap="round"
                  strokeWidth={1.75}
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
                    strokeDasharray={dashArray(primitive.style)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
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
                  strokeDasharray={dashArray(primitive.style)}
                  strokeLinejoin="round"
                  strokeWidth={1.75}
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
                  strokeDasharray={dashArray(primitive.style)}
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (primitive.type === "ELLIPSE") {
              return (
                <ellipse
                  key={primitive.id}
                  cx={center.x}
                  cy={toSvgY(center.y)}
                  rx={primitive.radiusX}
                  ry={primitive.radiusY}
                  className="fill-none stroke-current"
                  strokeDasharray={dashArray(primitive.style)}
                  strokeWidth={1.75}
                  transform={`rotate(${-primitive.rotation} ${center.x} ${toSvgY(center.y)})`}
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
                strokeDasharray={dashArray(primitive.style)}
                strokeLinecap="round"
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {spec.markers.map((marker, index) => {
            if (
              isNumberLine &&
              (marker.type === "EQUAL_LENGTH" || marker.type === "PARALLEL")
            ) {
              return null;
            }
            if (marker.type === "RIGHT_ANGLE") {
              const vertex = resolve(marker.vertex);
              const first = resolve(marker.armPointIds[0]!);
              const second = resolve(marker.armPointIds[1]!);
              if (!vertex || !first || !second) return null;
              const markerPoints = rightAnglePoints(
                vertex,
                first,
                second,
                Math.min(
                  diagramScale * 0.055,
                  pointDistance(vertex, first) * 0.18,
                  pointDistance(vertex, second) * 0.18,
                ),
              );
              return (
                <polyline
                  key={`right-angle-${index}`}
                  data-diagram-marker-type="RIGHT_ANGLE"
                  points={markerPoints
                    .map((point) => `${point.x},${toSvgY(point.y)}`)
                    .join(" ")}
                  className="fill-none stroke-sky-600 dark:stroke-sky-300"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (marker.type === "ANGLE") {
              const vertex = resolve(marker.vertex);
              const first = resolve(marker.armPointIds[0]!);
              const second = resolve(marker.armPointIds[1]!);
              if (!vertex || !first || !second) return null;
              const geometry = angleMarkerGeometry(
                vertex,
                first,
                second,
                Math.min(
                  diagramScale * 0.075,
                  pointDistance(vertex, first) * 0.22,
                  pointDistance(vertex, second) * 0.22,
                ),
              );
              return (
                <g key={`angle-${index}`} data-diagram-marker-type="ANGLE">
                  <polyline
                    points={geometry.arcPoints
                      .map((point) => `${point.x},${toSvgY(point.y)}`)
                      .join(" ")}
                    className="fill-none stroke-sky-600 dark:stroke-sky-300"
                    strokeLinecap="round"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  {marker.label ? (
                    <text
                      x={geometry.labelPoint.x}
                      y={toSvgY(geometry.labelPoint.y)}
                      className="fill-sky-700 stroke-white font-bold dark:fill-sky-300 dark:stroke-slate-950"
                      dominantBaseline="middle"
                      fontSize={textScale * 0.034}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                      strokeWidth={textScale * 0.0045}
                      textAnchor="middle"
                    >
                      {marker.label}
                    </text>
                  ) : null}
                </g>
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
              const markerSize = Math.min(
                diagramScale * 0.035,
                pointDistance(from, to) * 0.14,
              );
              const centerRatio = markerCenterRatio(from, to, spec.markers, points);
              return [
                <g
                  key={`${marker.type}-${index}-${segmentIndex}`}
                  data-diagram-marker-type={marker.type}
                >
                  {Array.from({ length: marker.markCount }).map((_, markIndex) =>
                    marker.type === "PARALLEL" ? (
                      <polyline
                        key={markIndex}
                        points={parallelMarkerPoints({
                          from,
                          to,
                          markIndex,
                          markCount: marker.markCount,
                          size: markerSize,
                          centerRatio,
                          toSvgY,
                        })}
                        className="fill-none stroke-sky-600 dark:stroke-sky-300"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <line
                        key={markIndex}
                        {...markerLineProps({
                          from,
                          to,
                          markIndex,
                          markCount: marker.markCount,
                          size: markerSize,
                          centerRatio,
                          toSvgY,
                        })}
                        className="stroke-sky-600 dark:stroke-sky-300"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ),
                  )}
                </g>,
              ];
            });
          })}

          {spec.points.map((point) => {
            const coordinateLabel = coordinateLabelsByPointId.get(point.id);
            const isGraphConstructionPoint = graphConstructionPointIds.has(point.id);
            const pointLabelFontSize = isGraphConstructionPoint
              ? Math.max(
                  diagramScale * 0.034,
                  minimumReadablePointLabelFontSize,
                )
              : isNumberLine
                ? Math.max(
                    diagramScale * 0.04,
                    minimumReadablePointLabelFontSize,
                  )
                : Math.max(
                    textScale * 0.028,
                    minimumReadablePointLabelFontSize,
                  );
            const pointLabelText = point.label ?? "";
            const pointLabelPlacement = resolvePointLabelPlacement(
              point,
              pointLabelText,
              spec,
              points,
              coordinateProjectionPoints,
              pointPlacementScale,
              pointLabelFontSize,
            );
            const isAxisCoordinate = Boolean(
              coordinateLabel &&
              (Math.abs(point.x) <= width * 0.005 || Math.abs(point.y) <= height * 0.005),
            );
            const axisCoordinateLabelMultiplier = isGraphConstructionPoint ? 1.08 : 1.2;
            const visiblePointLabel = Boolean(
              point.label && !hiddenNumberLineOriginLabels.has(point.id),
            );
            const isVisibleCircleCenter = visibleCircleCenterPointIds.has(point.id);
            const hasExplicitPointMarker = Boolean(
              point.pointStyle && point.pointStyle !== "NONE",
            );
            return (
              <g key={point.id}>
                {hasExplicitPointMarker || isVisibleCircleCenter ? (
                  <circle
                    data-diagram-center-marker={
                      isVisibleCircleCenter ? "true" : undefined
                    }
                    data-diagram-point-id={point.id}
                    data-diagram-graph-construction-point={
                      isGraphConstructionPoint ? "true" : undefined
                    }
                    cx={point.x}
                    cy={toSvgY(point.y)}
                    r={
                      diagramScale *
                      (isVisibleCircleCenter
                        ? 0.005
                        : isGraphConstructionPoint
                          ? 0.0065
                          : 0.0038)
                    }
                    className={
                      point.pointStyle === "OPEN"
                        ? "fill-white stroke-slate-900 dark:fill-slate-950 dark:stroke-slate-100"
                        : "fill-slate-900 stroke-slate-900 dark:fill-slate-100 dark:stroke-slate-100"
                    }
                    strokeWidth={isGraphConstructionPoint ? 2.25 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {visiblePointLabel ? (
                  <text
                    data-diagram-point-label-id={point.id}
                    data-diagram-point-source-label-position={point.labelPosition ?? ""}
                    data-diagram-point-label-position={pointLabelPlacement.position}
                    x={
                      isAxisCoordinate
                        ? point.x +
                          (pointLabelPlacement.anchor.x - point.x) *
                            axisCoordinateLabelMultiplier
                        : pointLabelPlacement.anchor.x
                    }
                    y={
                      isAxisCoordinate
                        ? toSvgY(
                            point.y +
                              (pointLabelPlacement.anchor.y - point.y) *
                                axisCoordinateLabelMultiplier,
                          )
                        : toSvgY(pointLabelPlacement.anchor.y)
                    }
                    className="fill-slate-900 stroke-white font-bold dark:fill-slate-100 dark:stroke-slate-950"
                    dominantBaseline="middle"
                    fontSize={pointLabelFontSize}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    strokeWidth={textScale * 0.0045}
                    textAnchor={labelTextAnchor(pointLabelPlacement.position)}
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {spec.labels.map((label, index) => {
            const anchoredPoint = resolve(label.anchorPointId);
            if (COORDINATE_LABEL_PATTERN.test(label.text)) return null;
            const isRedundantCoordinateOriginValue = Boolean(
              isCoordinatePlane &&
              label.text.trim() === "0" &&
              anchoredPoint &&
              Math.abs(anchoredPoint.x) <= width * 0.02 &&
              Math.abs(anchoredPoint.y) <= height * 0.02 &&
              spec.points.some(
                (point) =>
                  point.label?.trim().toUpperCase() === "O" &&
                  Math.abs(point.x) <= width * 0.02 &&
                  Math.abs(point.y) <= height * 0.02,
              ),
            );
            if (isRedundantCoordinateOriginValue) return null;
            const effectiveLabelPosition =
              isNumberLine &&
              anchoredPoint?.pointStyle === "FILLED" &&
              NUMBER_LINE_VALUE_LABEL_PATTERN.test(label.text.trim())
                ? "BOTTOM"
                : label.position;
            const isNamedPointLabel = Boolean(
              anchoredPoint &&
              !label.anchorPrimitiveId &&
              POINT_NAME_LABEL_PATTERN.test(label.text.trim()),
            );
            const namedPointLabelPosition =
              effectiveLabelPosition === "CENTER"
                ? (anchoredPoint?.labelPosition ?? "TOP_RIGHT")
                : effectiveLabelPosition;
            const namedPointLabelPlacement =
              isNamedPointLabel && anchoredPoint
                ? resolvePointLabelPlacement(
                    { ...anchoredPoint, labelPosition: namedPointLabelPosition },
                    label.text,
                    spec,
                    points,
                    coordinateProjectionPoints,
                    pointPlacementScale,
                    textScale * 0.028,
                  )
                : null;
            const primitiveLabelAnchor = resolvePrimitiveLabelAnchor(
              label.anchorPrimitiveId,
              effectiveLabelPosition,
              primitiveLabelClearance(
                label.text,
                label.anchorPrimitiveId,
                points,
                primitives,
                spec.markers,
                textScale,
                diagramScale,
              ),
              points,
              primitives,
            );
            const anchor =
              namedPointLabelPlacement?.anchor ??
              primitiveLabelAnchor ??
              resolveDiagramLabelAnchor(
                label.text,
                label.anchorPointId,
                label.anchorPrimitiveId,
                points,
                pointsByLabel,
                primitives,
              );
            if (!anchor) return null;
            const isCompactPointValue =
              COMPACT_VALUE_LABEL_PATTERN.test(label.text) &&
              resolve(label.anchorPointId)?.pointStyle === "FILLED";
            const isNumberLinePointValue = Boolean(
              isNumberLine &&
              anchoredPoint?.pointStyle === "FILLED" &&
              NUMBER_LINE_VALUE_LABEL_PATTERN.test(label.text.trim()),
            );
            const isPrimitiveLabel = Boolean(label.anchorPrimitiveId);
            const isLongLabel = label.text.length >= 6;
            const labelFontSize = Math.max(
              textScale * (isNamedPointLabel ? 0.028 : isLongLabel ? 0.026 : 0.032),
              isNumberLine ? diagramScale * 0.028 : 0,
              isDataTable ? diagramScale * 0.038 : 0,
            );
            const labelAnchorPoint = resolve(label.anchorPointId);
            const isAxisNumericLabel = Boolean(
              (isCoordinatePlane || isNumberLine) &&
              labelAnchorPoint &&
              /^-?\d+(?:[.,/]\d+)?$/u.test(label.text.trim()) &&
              (Math.abs(labelAnchorPoint.x) <= width * 0.02 ||
                Math.abs(labelAnchorPoint.y) <= height * 0.02),
            );
            const offset = positionOffset(
              effectiveLabelPosition,
              primitiveLabelAnchor || effectiveLabelPosition === "CENTER"
                ? 0
                : isNumberLinePointValue
                  ? Math.max(pointLabelOffset * 1.5, labelFontSize * 0.65)
                  : isCompactPointValue || isPrimitiveLabel
                    ? pointLabelOffset
                    : isAxisNumericLabel
                      ? pointLabelOffset * 2.3
                      : labelOffset,
            );
            const positionedAnchor = namedPointLabelPlacement?.anchor ?? {
              x: anchor.x + offset.x,
              y: anchor.y + offset.y,
            };
            const safeAnchor = namedPointLabelPlacement
              ? namedPointLabelPlacement.anchor
              : primitiveLabelAnchor
                ? positionedAnchor
                : isAxisNumericLabel
                  ? avoidAxisNumericLabelStrokeCollision(
                      positionedAnchor,
                      label.text,
                      effectiveLabelPosition,
                      spec,
                      points,
                      coordinateProjectionPoints,
                      textScale,
                      labelFontSize,
                    )
                  : avoidLabelStrokeCollision(
                      positionedAnchor,
                      label.text,
                      effectiveLabelPosition,
                      spec,
                      points,
                      coordinateProjectionPoints,
                      textScale,
                      labelFontSize,
                    );
            return (
              <text
                key={`${label.anchorPointId}-${index}`}
                data-diagram-label-anchor-point-id={label.anchorPointId}
                data-diagram-label-text={label.text}
                x={safeAnchor.x}
                y={toSvgY(safeAnchor.y)}
                className="fill-slate-700 stroke-white font-semibold dark:fill-slate-200 dark:stroke-slate-950"
                dominantBaseline="middle"
                fontSize={labelFontSize}
                paintOrder="stroke"
                strokeLinejoin="round"
                strokeWidth={textScale * 0.0045}
                textAnchor={
                  namedPointLabelPlacement
                    ? labelTextAnchor(namedPointLabelPlacement.position)
                    : primitiveLabelAnchor
                      ? "middle"
                      : labelTextAnchor(effectiveLabelPosition)
                }
              >
                {label.text}
              </text>
            );
          })}
          {isCoordinatePlane && !hasExplicitXAxisLabel ? (
            <text
              x={minX + width + diagramScale * 0.014}
              y={toSvgY(0) + diagramScale * 0.028}
              className="fill-slate-700 stroke-white font-semibold italic dark:fill-slate-200 dark:stroke-slate-950"
              dominantBaseline="middle"
              fontSize={textScale * 0.026}
              paintOrder="stroke"
              strokeLinejoin="round"
              strokeWidth={textScale * 0.0045}
              textAnchor="end"
            >
              x
            </text>
          ) : null}
          {isCoordinatePlane && !hasExplicitYAxisLabel ? (
            <text
              x={diagramScale * 0.024}
              y={toSvgY(minY + height + diagramScale * 0.014)}
              className="fill-slate-700 stroke-white font-semibold italic dark:fill-slate-200 dark:stroke-slate-950"
              dominantBaseline="middle"
              fontSize={textScale * 0.026}
              paintOrder="stroke"
              strokeLinejoin="round"
              strokeWidth={textScale * 0.0045}
              textAnchor="start"
            >
              y
            </text>
          ) : null}
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

function clipLinePrimitive(
  type: "SEGMENT" | "LINE" | "RAY",
  from: Point,
  to: Point,
  viewBox: LessonSummaryDiagramSpec["viewBox"],
) {
  if (type === "SEGMENT") return { from, to };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) === 0) return { from, to };
  const inset = Math.max(viewBox.width, viewBox.height) * 0.025;
  const left = viewBox.minX + inset;
  const right = viewBox.minX + viewBox.width - inset;
  const bottom = viewBox.minY + inset;
  const top = viewBox.minY + viewBox.height - inset;
  const candidates: number[] = [];
  const addCandidate = (t: number) => {
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    if (x >= left - 1e-6 && x <= right + 1e-6 && y >= bottom - 1e-6 && y <= top + 1e-6) {
      candidates.push(t);
    }
  };
  if (Math.abs(dx) > 1e-9) {
    addCandidate((left - from.x) / dx);
    addCandidate((right - from.x) / dx);
  }
  if (Math.abs(dy) > 1e-9) {
    addCandidate((bottom - from.y) / dy);
    addCandidate((top - from.y) / dy);
  }
  const sorted = [...candidates].sort((leftValue, rightValue) => leftValue - rightValue);
  const pointAt = (t: number) => ({ x: from.x + dx * t, y: from.y + dy * t });
  if (type === "RAY") {
    const endParameter = sorted.filter((value) => value > 0).at(-1);
    return { from, to: endParameter === undefined ? to : pointAt(endParameter) };
  }
  const firstParameter = sorted[0];
  const lastParameter = sorted.at(-1);
  if (firstParameter === undefined || lastParameter === undefined) return { from, to };
  return {
    from: pointAt(firstParameter),
    to: pointAt(lastParameter),
  };
}

function orientCoordinateAxisEndpoints(endpoints: {
  from: Pick<Point, "x" | "y">;
  to: Pick<Point, "x" | "y">;
}) {
  const isHorizontal =
    Math.abs(endpoints.to.x - endpoints.from.x) >=
    Math.abs(endpoints.to.y - endpoints.from.y);
  const pointsTowardPositive = isHorizontal
    ? endpoints.to.x >= endpoints.from.x
    : endpoints.to.y >= endpoints.from.y;
  return pointsTowardPositive ? endpoints : { from: endpoints.to, to: endpoints.from };
}

function isAxisTickSegment(
  primitive: Primitive,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
  axisPrimitiveIds: Set<string>,
) {
  if (primitive.type !== "SEGMENT" || axisPrimitiveIds.size === 0) return false;
  const from = points.get(primitive.from);
  const to = points.get(primitive.to);
  if (!from || !to) return false;
  const segmentLength = pointDistance(from, to);
  const shorterViewBoxSide = Math.min(spec.viewBox.width, spec.viewBox.height);
  if (segmentLength > shorterViewBoxSide * 0.24) return false;

  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return spec.primitives.some((axis) => {
    if (
      !axisPrimitiveIds.has(axis.id) ||
      (axis.type !== "LINE" && axis.type !== "SEGMENT")
    )
      return false;
    const axisFrom = points.get(axis.from);
    const axisTo = points.get(axis.to);
    if (!axisFrom || !axisTo) return false;
    const segmentDx = to.x - from.x;
    const segmentDy = to.y - from.y;
    const axisDx = axisTo.x - axisFrom.x;
    const axisDy = axisTo.y - axisFrom.y;
    const directionProduct = Math.abs(segmentDx * axisDx + segmentDy * axisDy);
    const directionScale = segmentLength * Math.hypot(axisDx, axisDy);
    const isNearlyPerpendicular =
      directionScale > 0 && directionProduct / directionScale <= 0.2;
    return (
      isNearlyPerpendicular &&
      pointToLineDistance(midpoint, axisFrom, axisTo) <= shorterViewBoxSide * 0.012
    );
  });
}

function clampSegmentLength(
  endpoints: {
    from: Pick<Point, "x" | "y">;
    to: Pick<Point, "x" | "y">;
  },
  maximumLength: number,
) {
  const dx = endpoints.to.x - endpoints.from.x;
  const dy = endpoints.to.y - endpoints.from.y;
  const length = Math.hypot(dx, dy);
  if (length <= maximumLength || length === 0) return endpoints;
  const midpoint = {
    x: (endpoints.from.x + endpoints.to.x) / 2,
    y: (endpoints.from.y + endpoints.to.y) / 2,
  };
  const halfScale = maximumLength / length / 2;
  return {
    from: { x: midpoint.x - dx * halfScale, y: midpoint.y - dy * halfScale },
    to: { x: midpoint.x + dx * halfScale, y: midpoint.y + dy * halfScale },
  };
}

function dashArray(style: "SOLID" | "DASHED" | "DOTTED") {
  if (style === "SOLID") return undefined;
  return style === "DASHED" ? "6 4" : "2 4";
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

function normalizedVector(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function pointDistance(from: { x: number; y: number }, to: { x: number; y: number }) {
  return Math.hypot(to.x - from.x, to.y - from.y);
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

function angleMarkerGeometry(vertex: Point, first: Point, second: Point, radius: number) {
  let startAngle = Math.atan2(first.y - vertex.y, first.x - vertex.x);
  let endAngle = Math.atan2(second.y - vertex.y, second.x - vertex.x);
  let delta = positiveAngleDelta(startAngle, endAngle);
  if (delta > Math.PI) {
    [startAngle, endAngle] = [endAngle, startAngle];
    delta = positiveAngleDelta(startAngle, endAngle);
  }
  const steps = 10;
  const arcPoints = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startAngle + (delta * index) / steps;
    return {
      x: vertex.x + Math.cos(angle) * radius,
      y: vertex.y + Math.sin(angle) * radius,
    };
  });
  const labelAngle = startAngle + delta / 2;
  return {
    arcPoints,
    labelPoint: {
      x: vertex.x + Math.cos(labelAngle) * radius * 1.72,
      y: vertex.y + Math.sin(labelAngle) * radius * 1.72,
    },
  };
}

function positiveAngleDelta(start: number, end: number) {
  const fullTurn = Math.PI * 2;
  return (((end - start) % fullTurn) + fullTurn) % fullTurn;
}

function resolveDiagramLabelAnchor(
  text: string,
  fallbackPointId: string,
  anchorPrimitiveId: string | null | undefined,
  points: Map<string, Point>,
  pointsByLabel: Map<string, Point>,
  primitives: Map<string, Primitive>,
) {
  if (anchorPrimitiveId) {
    const primitive = primitives.get(anchorPrimitiveId);
    if (primitive?.type === "SEGMENT") {
      const from = points.get(primitive.from);
      const to = points.get(primitive.to);
      if (from && to) {
        return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      }
    }
  }
  const segmentNames = text.match(SEGMENT_LABEL_PATTERN);
  if (segmentNames) {
    const from = pointsByLabel.get(segmentNames[1]!);
    const to = pointsByLabel.get(segmentNames[2]!);
    if (from && to) {
      return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    }
  }
  return points.get(fallbackPointId);
}

function resolvePrimitiveLabelAnchor(
  anchorPrimitiveId: string | null | undefined,
  position: LabelPosition,
  clearance: number,
  points: Map<string, Point>,
  primitives: Map<string, Primitive>,
) {
  if (!anchorPrimitiveId) return null;
  const primitive = primitives.get(anchorPrimitiveId);
  if (primitive?.type !== "SEGMENT") return null;
  const from = points.get(primitive.from);
  const to = points.get(primitive.to);
  if (!from || !to) return null;
  const direction = normalizedVector(from, to);
  let normal = { x: -direction.y, y: direction.x };
  const preferredDirection = positionOffset(position, 1);
  if (preferredDirection.x * normal.x + preferredDirection.y * normal.y < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }
  return {
    x: (from.x + to.x) / 2 + normal.x * clearance,
    y: (from.y + to.y) / 2 + normal.y * clearance,
  };
}

function primitiveLabelClearance(
  text: string,
  anchorPrimitiveId: string | null | undefined,
  points: Map<string, Point>,
  primitives: Map<string, Primitive>,
  markers: LessonSummaryDiagramSpec["markers"],
  textScale: number,
  diagramScale: number,
) {
  const measurementScale = COMPACT_MEASUREMENT_LABEL_PATTERN.test(text.trim())
    ? textScale
    : diagramScale;
  const fallback = measurementScale * 0.024;
  if (!anchorPrimitiveId) return fallback;
  const primitive = primitives.get(anchorPrimitiveId);
  if (primitive?.type !== "SEGMENT") return fallback;
  const from = points.get(primitive.from);
  const to = points.get(primitive.to);
  if (!from || !to) return fallback;
  const direction = normalizedVector(from, to);
  const normal = { x: -direction.y, y: direction.x };
  const fontSize = measurementScale * (text.length >= 6 ? 0.026 : 0.032);
  const halfWidth = (fontSize * Math.max(1, text.length * 0.55)) / 2;
  const halfHeight = fontSize * 0.62;
  const projectedHalfExtent =
    Math.abs(normal.x) * halfWidth + Math.abs(normal.y) * halfHeight;
  const markerExtent = markers.some(
    (marker) =>
      (marker.type === "EQUAL_LENGTH" || marker.type === "PARALLEL") &&
      marker.segmentIds.includes(anchorPrimitiveId),
  )
    ? Math.min(diagramScale * 0.035, pointDistance(from, to) * 0.14) * 0.36
    : 0;
  const safetyGap = Math.max(measurementScale * 0.008, diagramScale * 0.005);
  return projectedHalfExtent + markerExtent + safetyGap;
}

function markerLineProps(input: {
  from: Point;
  to: Point;
  markIndex: number;
  markCount: number;
  size: number;
  centerRatio: number;
  toSvgY: (value: number) => number;
}) {
  const unit = normalizedVector(input.from, input.to);
  const normal = { x: -unit.y, y: unit.x };
  const spacing = input.size * 0.34;
  const offset = (input.markIndex - (input.markCount - 1) / 2) * spacing;
  const center = {
    x: input.from.x + (input.to.x - input.from.x) * input.centerRatio + unit.x * offset,
    y: input.from.y + (input.to.y - input.from.y) * input.centerRatio + unit.y * offset,
  };
  const half = input.size * 0.3;
  return {
    x1: center.x - normal.x * half,
    y1: input.toSvgY(center.y - normal.y * half),
    x2: center.x + normal.x * half,
    y2: input.toSvgY(center.y + normal.y * half),
  };
}

function parallelMarkerPoints(input: {
  from: Point;
  to: Point;
  markIndex: number;
  markCount: number;
  size: number;
  centerRatio: number;
  toSvgY: (value: number) => number;
}) {
  const unit = normalizedVector(input.from, input.to);
  const normal = { x: -unit.y, y: unit.x };
  const spacing = input.size * 0.72;
  const offset = (input.markIndex - (input.markCount - 1) / 2) * spacing;
  const center = {
    x: input.from.x + (input.to.x - input.from.x) * input.centerRatio + unit.x * offset,
    y: input.from.y + (input.to.y - input.from.y) * input.centerRatio + unit.y * offset,
  };
  const tip = {
    x: center.x + unit.x * input.size * 0.34,
    y: center.y + unit.y * input.size * 0.34,
  };
  const wingCenter = {
    x: center.x - unit.x * input.size * 0.34,
    y: center.y - unit.y * input.size * 0.34,
  };
  const wingSize = input.size * 0.28;
  return [
    {
      x: wingCenter.x + normal.x * wingSize,
      y: wingCenter.y + normal.y * wingSize,
    },
    tip,
    {
      x: wingCenter.x - normal.x * wingSize,
      y: wingCenter.y - normal.y * wingSize,
    },
  ]
    .map((point) => `${point.x},${input.toSvgY(point.y)}`)
    .join(" ");
}

function markerCenterRatio(
  from: Point,
  to: Point,
  markers: LessonSummaryDiagramSpec["markers"],
  points: Map<string, Point>,
) {
  const blockerPoints = markers.flatMap((marker) => {
    if (marker.type !== "ANGLE" && marker.type !== "RIGHT_ANGLE") return [];
    const blocker = points.get(marker.vertex);
    return blocker ? [blocker] : [];
  });
  if (blockerPoints.length === 0) return 0.5;
  const candidates = [0.5, 0.35, 0.65, 0.25, 0.75];
  return candidates.reduce((best, candidate) => {
    const score = markerDistanceFromBlockers(from, to, candidate, blockerPoints);
    const bestScore = markerDistanceFromBlockers(from, to, best, blockerPoints);
    return score > bestScore ? candidate : best;
  }, candidates[0]!);
}

function markerDistanceFromBlockers(
  from: Point,
  to: Point,
  ratio: number,
  blockers: Point[],
) {
  const center = {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
  return Math.min(...blockers.map((blocker) => pointDistance(center, blocker)));
}

function resolvePointLabelPosition(
  point: Point,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
): Point["labelPosition"] {
  if (point.pointStyle && point.pointStyle !== "NONE") return point.labelPosition;
  const neighborIds = new Set<string>();
  spec.primitives.forEach((primitive) => {
    if (primitive.type !== "SEGMENT") return;
    if (primitive.from === point.id) neighborIds.add(primitive.to);
    if (primitive.to === point.id) neighborIds.add(primitive.from);
  });
  let preferredPosition = point.labelPosition;
  if (neighborIds.size >= 2) {
    const inward = [...neighborIds].reduce(
      (sum, neighborId) => {
        const neighbor = points.get(neighborId);
        if (!neighbor) return sum;
        const direction = normalizedVector(point, neighbor);
        return { x: sum.x + direction.x, y: sum.y + direction.y };
      },
      { x: 0, y: 0 },
    );
    const outward = { x: -inward.x, y: -inward.y };
    if (Math.hypot(outward.x, outward.y) >= 0.15) {
      const horizontal = outward.x > 0.25 ? "RIGHT" : outward.x < -0.25 ? "LEFT" : "";
      const vertical = outward.y > 0.25 ? "TOP" : outward.y < -0.25 ? "BOTTOM" : "";
      preferredPosition = (
        vertical && horizontal
          ? `${vertical}_${horizontal}`
          : horizontal || vertical || point.labelPosition
      ) as Point["labelPosition"];
    }
  }

  const positions: Point["labelPosition"][] = [
    preferredPosition,
    "TOP",
    "TOP_RIGHT",
    "RIGHT",
    "BOTTOM_RIGHT",
    "BOTTOM",
    "BOTTOM_LEFT",
    "LEFT",
    "TOP_LEFT",
  ];
  const uniquePositions = [...new Set(positions)];
  const clearance = pointLabelClearance(
    point,
    spec,
    Math.max(spec.viewBox.width, spec.viewBox.height),
  );
  return uniquePositions.reduce((best, candidate) => {
    const bestScore = pointLabelClearanceScore(point, best, clearance, spec, points);
    const candidateScore = pointLabelClearanceScore(
      point,
      candidate,
      clearance,
      spec,
      points,
    );
    return candidateScore > bestScore + clearance * 0.08 ? candidate : best;
  }, preferredPosition);
}

function resolvePointLabelPlacement(
  point: Point,
  text: string,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
  coordinateProjectionPoints: Point[],
  diagramScale: number,
  labelFontSize: number,
) {
  const preferredPosition = resolvePointLabelPosition(point, spec, points);
  const baseClearance = Math.max(
    pointLabelClearance(point, spec, diagramScale),
    labelFontSize * 0.65,
  );
  const fontSize = labelFontSize;
  const positions: Point["labelPosition"][] = [
    preferredPosition,
    "TOP",
    "TOP_RIGHT",
    "RIGHT",
    "BOTTOM_RIGHT",
    "BOTTOM",
    "BOTTOM_LEFT",
    "LEFT",
    "TOP_LEFT",
  ];
  const uniquePositions = [...new Set(positions)];
  const candidateAt = (position: Point["labelPosition"], multiplier: number) => {
    const offset = positionOffset(position, baseClearance * multiplier);
    const anchor = { x: point.x + offset.x, y: point.y + offset.y };
    return {
      anchor,
      position,
      score: labelStrokeClearanceScore(
        anchor,
        text,
        position,
        fontSize,
        spec,
        points,
        coordinateProjectionPoints,
      ),
    };
  };
  const preferred = candidateAt(preferredPosition, 1);
  const requiredClearance = diagramScale * 0.006;
  const isNamedNumberLinePoint = Boolean(
    point.pointStyle === "FILLED" &&
    POINT_NAME_LABEL_PATTERN.test(point.label ?? "") &&
    /trục\s*số/iu.test(spec.caption ?? ""),
  );
  if (isNamedNumberLinePoint) {
    return candidateAt("TOP", 1);
  }
  if (preferred.score >= requiredClearance) return preferred;
  if (point.labelPosition) {
    for (const multiplier of [1.3, 1.6, 1.9, 2.2, 2.5]) {
      const candidate = candidateAt(point.labelPosition, multiplier);
      if (candidate.score >= requiredClearance) return candidate;
    }
  }

  let best = preferred;
  for (const multiplier of [1, 1.3, 1.6, 1.9, 2.2, 2.5]) {
    for (const position of uniquePositions) {
      const candidate = candidateAt(position, multiplier);
      if (candidate.score > best.score) best = candidate;
      if (candidate.score >= requiredClearance) return candidate;
    }
  }
  return best;
}

function pointLabelClearance(
  point: Point,
  spec: LessonSummaryDiagramSpec,
  diagramScale: number,
) {
  if (point.pointStyle === "FILLED" && /trục\s*số/iu.test(spec.caption ?? "")) {
    return diagramScale * 0.04;
  }
  const definesExtendedLine = spec.primitives.some(
    (primitive) =>
      (primitive.type === "LINE" || primitive.type === "RAY") &&
      (primitive.from === point.id || primitive.to === point.id),
  );
  return (
    diagramScale *
    (definesExtendedLine
      ? 0.024
      : !point.pointStyle || point.pointStyle === "NONE"
        ? 0.018
        : 0.018)
  );
}

function pointLabelClearanceScore(
  point: Point,
  position: Point["labelPosition"],
  clearance: number,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
) {
  const offset = positionOffset(position, clearance);
  const labelCenter = { x: point.x + offset.x, y: point.y + offset.y };
  const distances = spec.primitives.flatMap((primitive) =>
    distanceToPrimitiveStroke(labelCenter, primitive, points),
  );
  return distances.length > 0 ? Math.min(...distances) : clearance;
}

function avoidLabelStrokeCollision(
  anchor: { x: number; y: number },
  text: string,
  preferredPosition: LabelPosition,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
  coordinateProjectionPoints: Point[],
  diagramScale: number,
  fontSize: number,
) {
  const requiredClearance = diagramScale * 0.003;
  const currentScore = labelStrokeClearanceScore(
    anchor,
    text,
    preferredPosition,
    fontSize,
    spec,
    points,
    coordinateProjectionPoints,
  );
  if (currentScore >= requiredClearance) return anchor;

  const closestCircle = spec.primitives
    .flatMap((primitive) => {
      if (primitive.type !== "CIRCLE") return [];
      const center = points.get(primitive.center);
      if (!center) return [];
      return [
        {
          center,
          distance: Math.abs(pointDistance(anchor, center) - primitive.radius),
        },
      ];
    })
    .sort((left, right) => left.distance - right.distance)[0];
  if (closestCircle && closestCircle.distance < requiredClearance) {
    const towardCenter = normalizedVector(anchor, closestCircle.center);
    const inwardAnchor = {
      x: anchor.x + towardCenter.x * requiredClearance * 1.35,
      y: anchor.y + towardCenter.y * requiredClearance * 1.35,
    };
    if (
      labelStrokeClearanceScore(
        inwardAnchor,
        text,
        preferredPosition,
        fontSize,
        spec,
        points,
        coordinateProjectionPoints,
      ) >= requiredClearance
    ) {
      return inwardAnchor;
    }
  }

  const isCenteredNumber =
    preferredPosition === "CENTER" && /^-?\d+(?:[.,/]\d+)?$/u.test(text);
  const isYAxisNumber =
    isCenteredNumber &&
    Math.abs(anchor.x) <= spec.viewBox.width * 0.08 &&
    Math.abs(anchor.y) > spec.viewBox.height * 0.08;
  const candidates: LabelPosition[] = isYAxisNumber
    ? [
        "TOP",
        "BOTTOM",
        "TOP_LEFT",
        "BOTTOM_LEFT",
        "TOP_RIGHT",
        "BOTTOM_RIGHT",
        "LEFT",
        "RIGHT",
      ]
    : isCenteredNumber
      ? [
          "RIGHT",
          "LEFT",
          "TOP_RIGHT",
          "TOP_LEFT",
          "BOTTOM_RIGHT",
          "BOTTOM_LEFT",
          "TOP",
          "BOTTOM",
        ]
      : [
          "TOP",
          "TOP_RIGHT",
          "RIGHT",
          "BOTTOM_RIGHT",
          "BOTTOM",
          "BOTTOM_LEFT",
          "LEFT",
          "TOP_LEFT",
        ];
  let best = { anchor, score: currentScore };
  for (const nudgeRatio of [0.018, 0.03, 0.045]) {
    const nudge = diagramScale * nudgeRatio;
    const candidate = candidates
      .map((position) => {
        const offset = positionOffset(position, nudge);
        const candidateAnchor = { x: anchor.x + offset.x, y: anchor.y + offset.y };
        return {
          anchor: candidateAnchor,
          score: labelStrokeClearanceScore(
            candidateAnchor,
            text,
            preferredPosition,
            fontSize,
            spec,
            points,
            coordinateProjectionPoints,
          ),
        };
      })
      .reduce((currentBest, item) =>
        item.score > currentBest.score ? item : currentBest,
      );
    if (candidate.score > best.score) best = candidate;
    if (candidate.score >= requiredClearance) return candidate.anchor;
  }
  return best.anchor;
}

function avoidAxisNumericLabelStrokeCollision(
  anchor: { x: number; y: number },
  text: string,
  preferredPosition: LabelPosition,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
  coordinateProjectionPoints: Point[],
  diagramScale: number,
  fontSize: number,
) {
  const score = (candidate: { x: number; y: number }) =>
    labelStrokeClearanceScore(
      candidate,
      text,
      preferredPosition,
      fontSize,
      spec,
      points,
      coordinateProjectionPoints,
    );
  const requiredClearance = diagramScale * 0.003;
  let best = { anchor, score: score(anchor) };
  if (best.score >= requiredClearance) return anchor;

  const slideVertically = preferredPosition === "LEFT" || preferredPosition === "RIGHT";
  if (!slideVertically) {
    for (const ratio of [0.012, 0.022, 0.034]) {
      const distance = diagramScale * ratio;
      const candidate = {
        x: anchor.x,
        y: anchor.y + (preferredPosition.includes("TOP") ? distance : -distance),
      };
      const candidateScore = score(candidate);
      if (candidateScore > best.score)
        best = { anchor: candidate, score: candidateScore };
      if (candidateScore >= requiredClearance) return candidate;
    }
  }
  for (const ratio of [0.012, 0.022, 0.034]) {
    const distance = diagramScale * ratio;
    const offsets = slideVertically
      ? [
          { x: 0, y: -distance },
          { x: 0, y: distance },
        ]
      : [
          { x: -distance, y: 0 },
          { x: distance, y: 0 },
        ];
    for (const offset of offsets) {
      const candidate = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      const candidateScore = score(candidate);
      if (candidateScore > best.score)
        best = { anchor: candidate, score: candidateScore };
      if (candidateScore >= requiredClearance) return candidate;
    }
  }
  return best.anchor;
}

function labelStrokeClearanceScore(
  anchor: { x: number; y: number },
  text: string,
  position: Point["labelPosition"] | LabelPosition,
  fontSize: number,
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
  coordinateProjectionPoints: Point[],
) {
  const textLength = Math.max(1, Array.from(text).length);
  const textWidth = fontSize * (0.62 * textLength + 0.12);
  const textHeight = fontSize * 0.98;
  const textAnchor = labelTextAnchor(position);
  const minX =
    textAnchor === "start"
      ? anchor.x
      : textAnchor === "end"
        ? anchor.x - textWidth
        : anchor.x - textWidth / 2;
  const maxX = minX + textWidth;
  const minY = anchor.y - textHeight / 2;
  const maxY = anchor.y + textHeight / 2;
  const columnCount = 13;
  const rowCount = 7;
  const samples = Array.from({ length: columnCount * rowCount }, (_, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    return {
      x: minX + ((maxX - minX) * column) / (columnCount - 1),
      y: minY + ((maxY - minY) * row) / (rowCount - 1),
    };
  });
  const cellRadius = Math.hypot(
    textWidth / (columnCount - 1) / 2,
    textHeight / (rowCount - 1) / 2,
  );
  return (
    Math.min(
      ...samples.map((sample) =>
        minimumStrokeDistance(sample, spec, points, coordinateProjectionPoints),
      ),
    ) - cellRadius
  );
}

function minimumStrokeDistance(
  point: { x: number; y: number },
  spec: LessonSummaryDiagramSpec,
  points: Map<string, Point>,
  coordinateProjectionPoints: Point[] = [],
) {
  const distances = spec.primitives.flatMap((primitive) =>
    distanceToPrimitiveStroke(point, primitive, points),
  );
  coordinateProjectionPoints.forEach((projectionPoint) => {
    if (Math.abs(projectionPoint.x) > spec.viewBox.width * 0.005) {
      distances.push(
        pointToSegmentDistance(point, projectionPoint, {
          x: projectionPoint.x,
          y: 0,
        }),
      );
    }
    if (Math.abs(projectionPoint.y) > spec.viewBox.height * 0.005) {
      distances.push(
        pointToSegmentDistance(point, projectionPoint, {
          x: 0,
          y: projectionPoint.y,
        }),
      );
    }
  });
  return distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}

function distanceToPrimitiveStroke(
  point: { x: number; y: number },
  primitive: Primitive,
  points: Map<string, Point>,
) {
  if (
    primitive.type === "SEGMENT" ||
    primitive.type === "LINE" ||
    primitive.type === "RAY"
  ) {
    const from = points.get(primitive.from);
    const to = points.get(primitive.to);
    if (!from || !to) return [];
    if (primitive.type === "LINE") {
      return [pointToLineDistance(point, from, to)];
    }
    if (primitive.type === "RAY") {
      return [pointToRayDistance(point, from, to)];
    }
    return [pointToSegmentDistance(point, from, to)];
  }
  if (primitive.type === "POLYGON" || primitive.type === "POLYLINE") {
    const vertices = primitive.pointIds
      .map((pointId) => points.get(pointId))
      .filter((vertex): vertex is Point => Boolean(vertex));
    const edgeCount =
      primitive.type === "POLYGON" ? vertices.length : vertices.length - 1;
    return Array.from({ length: Math.max(0, edgeCount) }, (_, index) => {
      const from = vertices[index]!;
      const to = vertices[(index + 1) % vertices.length]!;
      return pointToSegmentDistance(point, from, to);
    });
  }
  const center = points.get(primitive.center);
  if (!center) return [];
  if (primitive.type === "CIRCLE") {
    return [Math.abs(pointDistance(point, center) - primitive.radius)];
  }
  if (primitive.type === "ELLIPSE") {
    const rotation = (-primitive.rotation * Math.PI) / 180;
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const localX = dx * Math.cos(rotation) - dy * Math.sin(rotation);
    const localY = dx * Math.sin(rotation) + dy * Math.cos(rotation);
    const normalizedRadius = Math.hypot(
      localX / primitive.radiusX,
      localY / primitive.radiusY,
    );
    return [
      Math.abs(normalizedRadius - 1) * Math.min(primitive.radiusX, primitive.radiusY),
    ];
  }
  const delta = normalizedAngleDelta(primitive.startAngle, primitive.endAngle);
  const samples = Array.from({ length: 17 }, (_, index) =>
    polarPoint(center, primitive.radius, primitive.startAngle + (delta * index) / 16),
  );
  return samples
    .slice(0, -1)
    .map((from, index) => pointToSegmentDistance(point, from, samples[index + 1]!));
}

function pointToLineDistance(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  return Math.abs(dy * point.x - dx * point.y + to.x * from.y - to.y * from.x) / length;
}

function pointToRayDistance(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const squaredLength = dx * dx + dy * dy;
  if (squaredLength === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const projection = ((point.x - from.x) * dx + (point.y - from.y) * dy) / squaredLength;
  if (projection <= 0) return Math.hypot(point.x - from.x, point.y - from.y);
  return Math.hypot(
    point.x - (from.x + projection * dx),
    point.y - (from.y + projection * dy),
  );
}

function pointToSegmentDistance(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const squaredLength = dx * dx + dy * dy;
  if (squaredLength === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / squaredLength),
  );
  return Math.hypot(
    point.x - (from.x + projection * dx),
    point.y - (from.y + projection * dy),
  );
}

function positionOffset(
  position: Point["labelPosition"] | LabelPosition,
  amount: number,
) {
  return {
    CENTER: { x: 0, y: 0 },
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

function labelTextAnchor(position: Point["labelPosition"] | LabelPosition) {
  const resolved = position ?? "TOP_RIGHT";
  if (resolved.includes("LEFT") || resolved === "LEFT") return "end";
  if (resolved.includes("RIGHT") || resolved === "RIGHT") return "start";
  return "middle";
}
