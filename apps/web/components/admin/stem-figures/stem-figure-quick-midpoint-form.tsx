"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  type StemFigureMidpointAction,
  type StemFigureQuickMidpointInput,
} from "@/lib/stem-figure-geometry-actions";

export function StemFigureQuickMidpointForm({
  disabled,
  onUpdate,
}: {
  disabled: boolean;
  onUpdate: (
    action: StemFigureMidpointAction,
    input: StemFigureQuickMidpointInput,
  ) => Promise<boolean>;
}) {
  const [midpointName, setMidpointName] = useState("");
  const [pendingAction, setPendingAction] = useState<StemFigureMidpointAction | null>(
    null,
  );
  const [segmentName, setSegmentName] = useState("");

  async function submit(action: StemFigureMidpointAction) {
    setPendingAction(action);
    try {
      const changed = await onUpdate(
        action,
        action === "REMOVE"
          ? { segmentName }
          : { midpointName, segmentName },
      );
      if (!changed) return;
      setMidpointName("");
      setSegmentName("");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      className="rounded-xl border border-sky-300/80 bg-sky-50/70 p-3 dark:border-sky-500/40 dark:bg-sky-950/20"
      data-testid="stem-figure-quick-midpoint-form"
    >
      <div className="mb-2">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-sky-800 dark:text-sky-200">
          Thêm trung điểm
        </h4>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--theme-text-muted)]">
          Thêm: nhập đoạn và tên điểm. Xóa: chỉ cần nhập đoạn; cạnh gốc luôn được giữ
          lại.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block text-[11px] font-bold text-[var(--theme-text)]">
          Đoạn thẳng
          <input
            aria-label="Đoạn thẳng thêm trung điểm"
            autoComplete="off"
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-base font-semibold uppercase text-[var(--theme-text-strong)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
            disabled={disabled || pendingAction !== null}
            onChange={(event) => setSegmentName(event.target.value)}
            placeholder="AB"
            spellCheck={false}
            value={segmentName}
          />
        </label>
        <label className="block text-[11px] font-bold text-[var(--theme-text)]">
          Tên trung điểm
          <input
            aria-label="Tên trung điểm nhanh"
            autoComplete="off"
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-base font-semibold text-[var(--theme-text-strong)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
            disabled={disabled || pendingAction !== null}
            onChange={(event) =>
              setMidpointName(event.target.value.toLocaleUpperCase("en"))
            }
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void submit("ADD");
            }}
            placeholder="M"
            spellCheck={false}
            value={midpointName}
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
        <button
          className="theme-button-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || pendingAction !== null}
          onClick={() => void submit("ADD")}
          type="button"
        >
          {pendingAction === "ADD" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Thêm trung điểm
        </button>
        <button
          className="theme-button-danger inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || pendingAction !== null}
          onClick={() => void submit("REMOVE")}
          type="button"
        >
          {pendingAction === "REMOVE" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          Xóa trung điểm
        </button>
      </div>
    </section>
  );
}
