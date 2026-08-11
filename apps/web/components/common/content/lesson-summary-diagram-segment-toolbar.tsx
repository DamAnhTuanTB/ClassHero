"use client";

import { Equal } from "lucide-react";

export function LessonSummaryDiagramSegmentToolbar({
  count,
  left,
  maxWidth,
  side,
  top,
  onCreateEqualLength,
}: {
  count: number;
  left: number;
  maxWidth: number;
  side: "LEFT" | "RIGHT";
  top: number;
  onCreateEqualLength: () => void;
}) {
  return (
    <div
      aria-label="Công cụ cho các đoạn thẳng đã chọn"
      className="absolute z-20 inline-flex min-h-12 items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-white/95 p-1 shadow-lg backdrop-blur-sm dark:bg-slate-900/95"
      data-testid="diagram-segment-toolbar"
      role="toolbar"
      style={{
        left,
        maxWidth,
        top,
        transform: side === "LEFT" ? "translateX(-100%)" : undefined,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={`Đánh dấu ${count} đoạn thẳng bằng nhau`}
        className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        data-testid="diagram-create-equal-length"
        title="Đánh dấu bằng nhau"
        onClick={onCreateEqualLength}
      >
        <Equal className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
