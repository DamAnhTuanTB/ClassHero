"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FieldError } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { formFocusClass, formFocusVisibleClass } from "@/components/common/forms/form-styles";
import { cn } from "@/lib/utils";

const weekdayLabels = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

export function CourseDateField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: FieldError;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = parseDateValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const [popoverPosition, setPopoverPosition] = useState({ left: 12, top: 12 });
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function openCalendar() {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const popoverWidth = 328;
      setPopoverPosition({
        left: Math.min(Math.max(triggerRect.left, 12), window.innerWidth - popoverWidth - 12),
        top: Math.min(triggerRect.bottom + 8, window.innerHeight - 370),
      });
    }
    setVisibleMonth(selectedDate ?? new Date());
    setIsOpen(true);
  }

  return (
    <div>
      <FieldLabel id={id} label={label} isOptional />
      <div className="relative mt-2">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          onClick={() => (isOpen ? setIsOpen(false) : openCalendar())}
          className={cn(
            "flex min-h-[3.35rem] w-full touch-manipulation items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-left text-base font-semibold outline-none transition hover:border-[var(--theme-input-hover-border)] disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm",
            error
              ? "border-[var(--theme-error-border)] focus:border-[var(--theme-error-border)] focus:outline-none focus:ring-0 focus:shadow-none"
              : formFocusClass,
            value
              ? "text-[var(--theme-text-strong)]"
              : "text-[var(--theme-text-placeholder)]",
            value && "pr-12",
          )}
        >
          <CalendarDays className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {selectedDate ? formatDate(selectedDate) : "Chọn ngày"}
          </span>
        </button>
        {value ? (
          <button
            type="button"
            aria-label={`Xóa ${label.toLowerCase()}`}
            onClick={() => onChange("")}
            className={cn(
              "absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-danger)]",
              formFocusVisibleClass,
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={`Chọn ${label.toLowerCase()}`}
              className="fixed z-[100] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 shadow-[var(--theme-shadow-lg)]"
              style={{
                ...popoverPosition,
                width: "min(328px, calc(100vw - 1.5rem))",
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Tháng trước"
                  onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]",
                    formFocusVisibleClass,
                  )}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  {formatMonth(visibleMonth)}
                </p>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]",
                    formFocusVisibleClass,
                  )}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div
                className="gap-1"
                role="grid"
                aria-label={formatMonth(visibleMonth)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                }}
              >
                {weekdayLabels.map((weekday) => (
                  <span
                    key={weekday}
                    className="flex h-8 items-center justify-center text-xs font-bold text-[var(--theme-text-muted)]"
                  >
                    {weekday}
                  </span>
                ))}
                {calendarDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      role="gridcell"
                      aria-label={formatDate(day)}
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(toDateValue(day));
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={cn(
                        "h-9 rounded-lg text-sm font-bold outline-none transition",
                        formFocusVisibleClass,
                        isSelected
                          ? "bg-[var(--theme-primary)] text-[var(--theme-primary-foreground)] shadow-[var(--theme-shadow-sm)]"
                          : isCurrentMonth
                            ? "text-[var(--theme-text)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]"
                            : "text-[var(--theme-text-muted)] opacity-55 hover:bg-[var(--theme-surface-soft)]",
                        !isSelected && isToday && "ring-1 ring-[var(--theme-primary-border)]",
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function parseDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = value
    .split("-")
    .map(Number);
  const parsedDate = new Date(year, month - 1, day);
  return parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
    ? parsedDate
    : null;
}

function getCalendarDays(visibleMonth: Date) {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstGridDay = new Date(firstDay);
  firstGridDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstGridDay);
    day.setDate(firstGridDay.getDate() + index);
    return day;
  });
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}
