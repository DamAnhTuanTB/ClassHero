"use client";

import { BookOpen, ListTree, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export const LESSON_SUMMARY_OBJECTIVES_ANCHOR_ID = "lesson-summary-objectives";

const SECTION_ACCENT_CLASSES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
] as const;

export function getLessonSummarySectionAnchorId(sectionIndex: number) {
  return `section-${sectionIndex}`;
}

export function LessonSummaryTableOfContents({
  accentTrigger = false,
  desktopBorderless = false,
  hasObjectives,
  sections,
}: {
  accentTrigger?: boolean;
  desktopBorderless?: boolean;
  hasObjectives: boolean;
  sections: Array<{ displayHeading: string; order: number }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const scrollToAnchor = (anchorId: string) => {
    const target = document.getElementById(anchorId);
    setIsOpen(false);
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <div ref={rootRef} className="relative z-30">
      <button
        ref={triggerRef}
        aria-controls={popoverId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Đóng mục lục" : "Mở mục lục"}
        className={`flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-extrabold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
          isOpen || accentTrigger
            ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
            : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)]"
        } ${
          accentTrigger
            ? "hover:border-sky-400 hover:bg-sky-200 hover:text-sky-700 dark:hover:border-sky-600 dark:hover:bg-sky-800/70 dark:hover:text-sky-200"
            : "hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]"
        } ${desktopBorderless ? "lg:border-transparent" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        title="Mục lục"
        type="button"
      >
        <ListTree className="h-5 w-5" aria-hidden="true" />
        <span>Mục lục</span>
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          aria-label="Mục lục bài học"
          className={`absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-[var(--theme-surface)] shadow-xl ${
            accentTrigger
              ? "right-0 border-2 border-sky-300 dark:border-sky-700"
              : "left-0 border border-[var(--theme-border)]"
          }`}
          role="dialog"
        >
          <div
            className={`flex items-center justify-between gap-2 py-3 pl-4 pr-1 ${
              accentTrigger
                ? "border-b-2 border-sky-200 dark:border-sky-800"
                : "border-b border-[var(--theme-border)]"
            }`}
          >
            <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Mục lục bài học
            </p>
            {accentTrigger ? (
              <button
                aria-label="Đóng mục lục"
                className="-my-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--theme-text-muted)] transition hover:bg-sky-100 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-sky-900/60 dark:hover:text-sky-200"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                title="Đóng mục lục"
                type="button"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <nav
            aria-label="Đi đến phần trong bài học"
            className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto p-2"
          >
            {hasObjectives ? (
              <button
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-[var(--theme-text)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                onClick={() => scrollToAnchor(LESSON_SUMMARY_OBJECTIVES_ANCHOR_ID)}
                type="button"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
                  <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span>Mục tiêu học tập</span>
              </button>
            ) : null}

            {sections.map((section, index) => {
              const accentClass =
                SECTION_ACCENT_CLASSES[index % SECTION_ACCENT_CLASSES.length] ??
                SECTION_ACCENT_CLASSES[0];

              return (
                <button
                  key={`${section.order}-${index}`}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-[var(--theme-text)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                  onClick={() => scrollToAnchor(getLessonSummarySectionAnchorId(index))}
                  title={section.displayHeading}
                  type="button"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${
                      accentTrigger
                        ? accentClass
                        : "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                    }`}
                  >
                    {section.order || index + 1}
                  </span>
                  <span className="min-w-0 whitespace-normal break-words leading-5">
                    {section.displayHeading}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
