"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export type StemFigureRasterBrushSize = "SMALL" | "MEDIUM" | "LARGE";

type Point = { x: number; y: number };
type Stroke = { brushSize: StemFigureRasterBrushSize; id: number; points: Point[] };

const BRUSH_PIXELS: Record<StemFigureRasterBrushSize, number> = {
  SMALL: 10,
  MEDIUM: 24,
  LARGE: 44,
};

export function useStemFigureRasterMask({
  brushSize,
  canvasRef,
  enabled,
  height,
  onChange,
  width,
}: {
  brushSize: StemFigureRasterBrushSize;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  height: number;
  onChange: () => void;
  width: number;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [visibleStrokes, setVisibleStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const nextStrokeIdRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of visibleStrokes) drawStroke(context, stroke);
  }, [canvasRef, visibleStrokes]);

  useEffect(() => {
    redraw();
  }, [height, redraw, width]);

  useEffect(() => {
    if (!enabled) setCursorPoint(null);
  }, [enabled]);

  function beginStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!enabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    setCursorPoint(point);
    const stroke = {
      brushSize,
      id: nextStrokeIdRef.current,
      points: [point],
    } satisfies Stroke;
    nextStrokeIdRef.current += 1;
    activeStrokeRef.current = stroke;
    const context = event.currentTarget.getContext("2d");
    if (context) drawStroke(context, stroke);
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!enabled) return;
    const point = pointerPoint(event);
    setCursorPoint(point);
    const activeStroke = activeStrokeRef.current;
    if (!activeStroke) return;
    event.preventDefault();
    const previous = activeStroke.points.at(-1);
    activeStroke.points.push(point);
    const context = event.currentTarget.getContext("2d");
    if (context && previous) {
      drawSegment(context, previous, point, activeStroke.brushSize);
    }
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const activeStroke = activeStrokeRef.current;
    if (!activeStroke) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeStrokeRef.current = null;
    setStrokes((current) => [...current, activeStroke].slice(-50));
    setVisibleStrokes((current) => [...current, activeStroke].slice(-50));
    setRedoStrokes([]);
    onChangeRef.current();
  }

  function undo() {
    const last = strokes.at(-1);
    if (!last) return;
    setStrokes((current) => current.slice(0, -1));
    setVisibleStrokes((current) => current.filter((stroke) => stroke.id !== last.id));
    setRedoStrokes((current) => [...current, last]);
    onChangeRef.current();
  }

  function redo() {
    const last = redoStrokes.at(-1);
    if (!last) return;
    setRedoStrokes((current) => current.slice(0, -1));
    setStrokes((current) => [...current, last].slice(-50));
    setVisibleStrokes((current) => [...current, last].slice(-50));
    onChangeRef.current();
  }

  function clear() {
    if (strokes.length === 0) return;
    setStrokes([]);
    setVisibleStrokes([]);
    setRedoStrokes([]);
    onChangeRef.current();
  }

  function getMaskBlob() {
    if (strokes.length === 0) return Promise.resolve<Blob | null>(null);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvasRef.current?.width ?? width;
    maskCanvas.height = canvasRef.current?.height ?? height;
    const context = maskCanvas.getContext("2d");
    if (!context) return Promise.resolve<Blob | null>(null);
    for (const stroke of strokes) drawStroke(context, stroke);
    return new Promise<Blob | null>((resolve) => maskCanvas.toBlob(resolve, "image/png"));
  }

  function acknowledgePreview() {
    setVisibleStrokes([]);
  }

  function reset() {
    activeStrokeRef.current = null;
    setStrokes([]);
    setVisibleStrokes([]);
    setRedoStrokes([]);
    setCursorPoint(null);
  }

  return {
    bind: {
      onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => {
        finishStroke(event);
        setCursorPoint(null);
      },
      onPointerDown: beginStroke,
      onPointerLeave: () => {
        if (!activeStrokeRef.current) setCursorPoint(null);
      },
      onPointerMove: continueStroke,
      onPointerUp: finishStroke,
    },
    acknowledgePreview,
    canRedo: redoStrokes.length > 0,
    canUndo: strokes.length > 0,
    clear,
    cursor:
      enabled && cursorPoint
        ? { ...cursorPoint, diameter: BRUSH_PIXELS[brushSize] }
        : null,
    getMaskBlob,
    hasMask: strokes.length > 0,
    redo,
    reset,
    undo,
  };
}

function pointerPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
  const rectangle = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rectangle.left) / rectangle.width) * event.currentTarget.width,
    y: ((event.clientY - rectangle.top) / rectangle.height) * event.currentTarget.height,
  };
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  const first = stroke.points[0];
  if (!first) return;
  drawSegment(context, first, first, stroke.brushSize);
  for (let index = 1; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 1];
    const current = stroke.points[index];
    if (previous && current) drawSegment(context, previous, current, stroke.brushSize);
  }
}

function drawSegment(
  context: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  brushSize: StemFigureRasterBrushSize,
) {
  context.save();
  context.strokeStyle = "rgba(239, 68, 68, 0.72)";
  context.fillStyle = "rgba(239, 68, 68, 0.72)";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = BRUSH_PIXELS[brushSize];
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  if (from.x === to.x && from.y === to.y) {
    context.beginPath();
    context.arc(from.x, from.y, BRUSH_PIXELS[brushSize] / 2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
