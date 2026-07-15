"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CourseFilterSelectOption<TValue extends string> = {
  label: string;
  value: TValue;
};

export function CourseFilterSelect<TValue extends string>({
  ariaLabel,
  className,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  className?: string;
  options: Array<CourseFilterSelectOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const listbox = listboxRef.current;
      const selectedElement = selectedOptionRef.current;

      if (!listbox || !selectedElement) {
        return;
      }

      const centeredScrollTop =
        selectedElement.offsetTop -
        listbox.clientHeight / 2 +
        selectedElement.offsetHeight / 2;
      listbox.scrollTop = Math.max(centeredScrollTop, 0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, value]);

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            triggerRef.current?.focus();
            return;
          }

          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "student-soft-bold-text flex min-h-12 w-full min-w-0 touch-manipulation items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-4 text-left text-[15px] font-extrabold text-slate-600 shadow-none outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-strong)] dark:focus:border-sky-500/40 dark:focus:ring-1 dark:focus:ring-sky-500/15",
          isOpen &&
            "border-sky-400 ring-2 ring-sky-100 dark:border-sky-500/40 dark:ring-1 dark:ring-sky-500/15",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ease-out dark:text-[var(--theme-text-muted)]",
            isOpen && "rotate-180 text-sky-400 dark:text-sky-400",
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          ref={listboxRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-sky-100 bg-white p-1 shadow-none dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                ref={isSelected ? selectedOptionRef : undefined}
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  triggerRef.current?.blur();
                }}
                className={cn(
                  "relative flex min-h-10 w-full items-center rounded-lg py-2 pl-9 pr-3 text-left text-sm font-bold outline-none transition",
                  isSelected
                    ? "bg-blue-50 text-blue-600 dark:bg-[var(--theme-surface-soft)] dark:text-[var(--theme-primary)]"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-[var(--theme-primary)]",
                )}
              >
                <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
                  {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
