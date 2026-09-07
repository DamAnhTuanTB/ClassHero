"use client";

import { Link2, LoaderCircle, Unlink2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  type StemFigureQuickSegmentInput,
  type StemFigureSegmentAction,
  updateStemFigureSegment,
} from "@/lib/stem-figure-geometry-actions";

export function StemFigureQuickSegmentForm({
  disabled,
  onUpdate,
  source,
}: {
  disabled: boolean;
  onUpdate: (
    action: StemFigureSegmentAction,
    input: StemFigureQuickSegmentInput,
  ) => Promise<boolean>;
  source: string;
}) {
  const [pendingAction, setPendingAction] = useState<StemFigureSegmentAction | null>(
    null,
  );
  const [segmentName, setSegmentName] = useState("");
  const [submittedAction, setSubmittedAction] =
    useState<StemFigureSegmentAction | null>(null);
  const input = useMemo(() => ({ segmentName }), [segmentName]);
  const connectPreview = useMemo(
    () => updateStemFigureSegment(source, input, "CONNECT"),
    [input, source],
  );
  const disconnectPreview = useMemo(
    () => updateStemFigureSegment(source, input, "DISCONNECT"),
    [input, source],
  );
  const activePreview =
    submittedAction === "DISCONNECT" ? disconnectPreview : connectPreview;
  const isConnected = connectPreview.issue?.code === "SEGMENT_ALREADY_EXISTS";
  const canDescribeState =
    connectPreview.canonicalSegment !== null &&
    (isConnected || connectPreview.issue === null);

  async function submit(action: StemFigureSegmentAction) {
    setSubmittedAction(action);
    const preview = action === "CONNECT" ? connectPreview : disconnectPreview;
    if (preview.issue) return;
    setPendingAction(action);
    try {
      const changed = await onUpdate(action, input);
      if (!changed) return;
      setSegmentName("");
      setSubmittedAction(null);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
      data-testid="stem-figure-quick-segment-form"
    >
      <div className="mb-2">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
          Chỉnh đoạn thẳng
        </h4>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--theme-text-muted)]">
          Nhập hai đầu đoạn, ví dụ BD, rồi chọn nối hoặc bỏ nối.
        </p>
      </div>

      <label className="block text-[11px] font-bold text-[var(--theme-text)]">
        Tên đoạn
        <input
          aria-label="Tên đoạn thẳng nhanh"
          autoComplete="off"
          className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-base font-semibold uppercase text-[var(--theme-text-strong)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
          disabled={disabled || pendingAction !== null}
          onChange={(event) => {
            setSegmentName(event.target.value);
            setSubmittedAction(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void submit(isConnected ? "DISCONNECT" : "CONNECT");
          }}
          placeholder="BD"
          spellCheck={false}
          value={segmentName}
        />
      </label>

      {segmentName.trim() && canDescribeState ? (
        <p className="mt-1.5 text-[11px] font-semibold leading-4 text-[var(--theme-text-muted)]">
          Đoạn {connectPreview.canonicalSegment} {isConnected ? "đang được nối" : "chưa được nối"}.
        </p>
      ) : null}
      {submittedAction && activePreview.issue ? (
        <p
          className="mt-1.5 rounded-md border border-amber-300/70 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          {activePreview.issue.message}
        </p>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
        <button
          className="theme-button-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || pendingAction !== null}
          onClick={() => void submit("CONNECT")}
          type="button"
        >
          {pendingAction === "CONNECT" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Link2 className="h-4 w-4" aria-hidden />
          )}
          Nối
        </button>
        <button
          className="theme-button-danger inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || pendingAction !== null}
          onClick={() => void submit("DISCONNECT")}
          type="button"
        >
          {pendingAction === "DISCONNECT" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Unlink2 className="h-4 w-4" aria-hidden />
          )}
          Bỏ nối
        </button>
      </div>
    </section>
  );
}
