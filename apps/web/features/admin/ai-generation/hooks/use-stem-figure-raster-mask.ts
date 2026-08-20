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
type Stroke = { brushSize: StemFigureRasterBrushSize; points: Point[] };

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
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) drawStroke(context, stroke);
  }, [canvasRef, strokes]);

  useEffect(() => {
    redraw();
  }, [height, redraw, width]);

  function beginStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!enabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    const stroke = { brushSize, points: [point] } satisfies Stroke;
    activeStrokeRef.current = stroke;
    const context = event.currentTarget.getContext("2d");
    if (context) drawStroke(context, stroke);
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const activeStroke = activeStrokeRef.current;
    if (!enabled || !activeStroke) return;
    event.preventDefault();
    const point = pointerPoint(event);
    const previous = activeStroke.points.at(-1);
    activeStroke.points.push(point);
    const context = event.currentTarget.getContext("2d");
    if (context && previous) drawSegment(context, previous, point, brushSize);
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const activeStroke = activeStrokeRef.current;
    if (!activeStroke) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeStrokeRef.current = null;
    setStrokes((current) => [...current, activeStroke].slice(-50));
    setRedoStrokes([]);
    onChangeRef.current();
  }

  function undo() {
    setStrokes((current) => {
      const last = current.at(-1);
      if (!last) return current;
      setRedoStrokes((redo) => [...redo, last]);
      onChangeRef.current();
      return current.slice(0, -1);
    });
  }

  function redo() {
    setRedoStrokes((current) => {
      const last = current.at(-1);
      if (!last) return current;
      setStrokes((existing) => [...existing, last].slice(-50));
      onChangeRef.current();
      return current.slice(0, -1);
    });
  }

  function clear() {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStrokes([]);
    onChangeRef.current();
  }

  function getMaskBlob() {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return Promise.resolve<Blob | null>(null);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  return {
    bind: {
      onPointerCancel: finishStroke,
      onPointerDown: beginStroke,
      onPointerMove: continueStroke,
      onPointerUp: finishStroke,
    },
    canRedo: redoStrokes.length > 0,
    canUndo: strokes.length > 0,
    clear,
    getMaskBlob,
    hasMask: strokes.length > 0,
    redo,
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
