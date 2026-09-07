"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";

import type { StemFigureQuickCircleCenterInput } from "@/lib/stem-figure-geometry-actions";

export function StemFigureQuickCircleCenterForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (input: StemFigureQuickCircleCenterInput) => Promise<boolean>;
}) {
  const [centerName, setCenterName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      const changed = await onAdd({ centerName });
      if (changed) setCenterName("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-sky-300/80 bg-sky-50/70 p-3 dark:border-sky-500/40 dark:bg-sky-950/20"
      data-testid="stem-figure-quick-circle-center-form"
    >
      <label className="flex min-h-8 cursor-pointer items-center gap-2 text-[11px] font-bold text-[var(--theme-text)]">
        <input
          checked={enabled}
          className="h-4 w-4 rounded border-[var(--theme-border)] text-sky-600 focus:ring-sky-500"
          disabled={disabled || pending}
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        Thêm tên tâm đường tròn
      </label>

      {enabled ? (
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <label className="min-w-0 text-[11px] font-bold text-[var(--theme-text)]">
            Tên tâm
            <input
              aria-label="Tên tâm đường tròn"
              autoComplete="off"
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-base font-semibold text-[var(--theme-text-strong)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
              disabled={disabled || pending}
              onChange={(event) =>
                setCenterName(event.target.value.toLocaleUpperCase("en"))
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void submit();
              }}
              placeholder="O"
              spellCheck={false}
              value={centerName}
            />
          </label>
          <button
            className="theme-button-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending}
            onClick={() => void submit()}
            type="button"
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            {pending ? "Đang thêm…" : "Thêm tên tâm"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
