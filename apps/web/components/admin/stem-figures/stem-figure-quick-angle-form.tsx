"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  createStemFigureQuickAngle,
  type StemFigureQuickAngleInput,
  type StemFigureQuickAngleRemovalInput,
  removeStemFigureQuickAngle,
} from "@/lib/stem-figure-geometry-actions";

export function StemFigureQuickAngleForm({
  disabled,
  onAdd,
  onRemove,
  source,
}: {
  disabled: boolean;
  onAdd: (input: StemFigureQuickAngleInput) => Promise<boolean>;
  onRemove: (input: StemFigureQuickAngleRemovalInput) => Promise<boolean>;
  source: string;
}) {
  const [angleName, setAngleName] = useState("");
  const [autoConnect, setAutoConnect] = useState(true);
  const [degreesText, setDegreesText] = useState("");
  const [submittingAction, setSubmittingAction] = useState<"ADD" | "REMOVE" | null>(null);
  const [submittedAction, setSubmittedAction] = useState<"ADD" | "REMOVE" | null>(null);
  const addPreview = useMemo(
    () =>
      createStemFigureQuickAngle(source, {
        angleName,
        autoConnect,
        degreesText,
      }),
    [angleName, autoConnect, degreesText, source],
  );
  const removePreview = useMemo(
    () => removeStemFigureQuickAngle(source, { angleName }),
    [angleName, source],
  );
  const activeIssue =
    submittedAction === "ADD"
      ? addPreview.issue
      : submittedAction === "REMOVE"
        ? removePreview.issue
        : null;

  async function submit(action: "ADD" | "REMOVE") {
    setSubmittedAction(action);
    const preview = action === "ADD" ? addPreview : removePreview;
    if (preview.issue) return;
    setSubmittingAction(action);
    try {
      const changed =
        action === "ADD"
          ? await onAdd({ angleName, autoConnect, degreesText })
          : await onRemove({ angleName });
      if (!changed) return;
      setAngleName("");
      setDegreesText("");
      setSubmittedAction(null);
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <section
      className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-800 dark:bg-sky-950/25"
      data-testid="stem-figure-quick-angle-form"
    >
      <div className="mb-2">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-sky-800 dark:text-sky-200">
          Nhập góc nhanh
        </h4>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--theme-text-muted)]">
          Ví dụ ABD nghĩa là góc có đỉnh B. Hệ thống sẽ thêm số đo và dấu cung.
        </p>
      </div>

      <div
        className="grid grid-cols-[minmax(0,1fr)_minmax(6rem,0.65fr)] gap-2"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void submit("ADD");
        }}
      >
        <label className="min-w-0 text-[11px] font-bold text-[var(--theme-text)]">
          Tên góc
          <input
            aria-label="Tên góc nhanh"
            autoComplete="off"
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-base font-semibold uppercase text-[var(--theme-text-strong)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
            disabled={disabled || submittingAction !== null}
            onChange={(event) => {
              setAngleName(event.target.value);
              setSubmittedAction(null);
            }}
            placeholder="ABD"
            spellCheck={false}
            value={angleName}
          />
        </label>
        <label className="min-w-0 text-[11px] font-bold text-[var(--theme-text)]">
          Số đo
          <span className="relative mt-1 block">
            <input
              aria-label="Số đo góc nhanh"
              autoComplete="off"
              className="min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 pr-8 text-base font-semibold text-[var(--theme-text-strong)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
              disabled={disabled || submittingAction !== null}
              inputMode="numeric"
              onChange={(event) => {
                setDegreesText(event.target.value);
                setSubmittedAction(null);
              }}
              placeholder="50"
              spellCheck={false}
              value={degreesText}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm font-bold text-[var(--theme-text-muted)]">
              °
            </span>
          </span>
        </label>
      </div>

      <label className="mt-2 flex min-h-8 cursor-pointer items-center gap-2 text-[11px] font-bold text-[var(--theme-text)]">
        <input
          checked={autoConnect}
          className="h-4 w-4 rounded border-[var(--theme-border)] text-sky-600 focus:ring-sky-500"
          disabled={disabled || submittingAction !== null}
          onChange={(event) => setAutoConnect(event.target.checked)}
          type="checkbox"
        />
        Tự nối hai cạnh còn thiếu
      </label>

      {activeIssue ? (
        <p
          aria-live="assertive"
          className="mt-1.5 rounded-md border border-amber-300/70 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          {activeIssue.message}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          className="theme-button-primary inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={disabled || submittingAction !== null}
          onClick={() => void submit("ADD")}
          type="button"
        >
          {submittingAction === "ADD" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {submittingAction === "ADD" ? "Đang thêm góc…" : "Thêm góc"}
        </button>
        <button
          className="theme-button-danger inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={disabled || submittingAction !== null}
          onClick={() => void submit("REMOVE")}
          type="button"
        >
          {submittingAction === "REMOVE" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          {submittingAction === "REMOVE" ? "Đang bỏ góc…" : "Bỏ góc"}
        </button>
      </div>
    </section>
  );
}
