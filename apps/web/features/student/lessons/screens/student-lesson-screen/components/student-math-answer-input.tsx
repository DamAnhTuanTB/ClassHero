"use client";

import { Keyboard } from "lucide-react";
import { useId, useState } from "react";
import { VisualMathInput } from "@/components/common/math/visual-math-input";
import { cn } from "@/lib/utils";

type AnswerState = "correct" | "incorrect" | "idle";

export function StudentMathAnswerInput({
  accent = "quiz",
  answerState = "idle",
  disabled,
  onChange,
  value,
}: {
  accent?: "quiz" | "test";
  answerState?: AnswerState;
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const keyboardId = useId();
  const [isFormulaMode, setIsFormulaMode] = useState(() => looksLikeFormula(value));
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const keyboardIsVisible = isKeyboardOpen && !disabled;
  const fieldStateClass =
    answerState === "correct"
      ? "border-emerald-400 focus:border-emerald-400 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
      : answerState === "incorrect"
        ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100 dark:focus:ring-rose-500/20"
        : accent === "test"
          ? "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-[var(--theme-border)] dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20"
          : "border-slate-200 focus:border-sky-400 focus:ring-sky-100 dark:border-[var(--theme-border)] dark:focus:border-sky-400 dark:focus:ring-sky-500/20";

  return (
    <div>
      <div className="relative">
        {isFormulaMode ? (
          <VisualMathInput
            accent={accent === "test" ? "emerald" : "primary"}
            ariaLabel="Nhập đáp án"
            value={value}
            disabled={disabled}
            paletteId={keyboardId}
            placeholder={"\\text{Nhập đáp án}"}
            preset="student-answer"
            showPalette={keyboardIsVisible}
            status={answerState}
            onChange={onChange}
          />
        ) : (
          <input
            aria-label="Nhập đáp án"
            value={value}
            disabled={disabled}
            inputMode="text"
            autoComplete="off"
            onChange={(event) => onChange(event.currentTarget.value)}
            className={cn(
              "student-mobile-border h-16 w-full rounded-2xl border bg-white px-3 pr-14 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-[var(--theme-surface-soft)] dark:text-[var(--theme-text-strong)] dark:placeholder:text-slate-500",
              fieldStateClass,
            )}
            placeholder="Nhập đáp án"
          />
        )}
        <button
          type="button"
          disabled={disabled}
          aria-controls={keyboardId}
          aria-expanded={keyboardIsVisible}
          aria-label={keyboardIsVisible ? "Đóng bàn phím toán" : "Mở bàn phím toán"}
          title={keyboardIsVisible ? "Đóng bàn phím toán" : "Mở bàn phím toán"}
          onPointerDown={() => {
            if (!isFormulaMode) {
              void import("mathlive");
            }
          }}
          onClick={() => {
            if (!isFormulaMode) {
              setIsFormulaMode(true);
              setIsKeyboardOpen(true);
              return;
            }
            const nextOpen = !isKeyboardOpen;
            setIsKeyboardOpen(nextOpen);
            if (!nextOpen && !value.trim()) {
              setIsFormulaMode(false);
            }
          }}
          className={cn(
            "absolute right-2 top-8 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border p-0 leading-none transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-default disabled:opacity-50 [&>svg]:block [&>svg]:shrink-0",
            accent === "test"
              ? "focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-500/20"
              : "focus-visible:ring-sky-200 dark:focus-visible:ring-sky-500/20",
            keyboardIsVisible
              ? accent === "test"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-sky-500 bg-sky-500 text-white"
              : accent === "test"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25",
          )}
        >
          <Keyboard className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function looksLikeFormula(value: string) {
  return /\\[a-zA-Z]+|[_^{}]/u.test(value);
}
