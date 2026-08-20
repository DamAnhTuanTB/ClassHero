"use client";

import { BookOpen, ListTree } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export const LESSON_SUMMARY_OBJECTIVES_ANCHOR_ID = "lesson-summary-objectives";

export function getLessonSummarySectionAnchorId(sectionIndex: number) {
  return `section-${sectionIndex}`;
}

export function LessonSummaryTableOfContents({
  hasObjectives,
  sections,
}: {
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
        className={`grid h-11 w-11 place-items-center rounded-xl border bg-[var(--theme-surface)] text-[var(--theme-text-muted)] shadow-sm transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
          isOpen
            ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
            : "border-[var(--theme-border)]"
        }`}
        onClick={() => setIsOpen((open) => !open)}
        title="Mục lục"
        type="button"
      >
        <ListTree className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          aria-label="Mục lục bài học"
          className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-xl"
          role="dialog"
        >
          <div className="border-b border-[var(--theme-border)] px-4 py-3">
            <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Mục lục bài học
            </p>
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
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Mục tiêu học tập</span>
              </button>
            ) : null}

            {sections.map((section, index) => (
              <button
                key={`${section.order}-${index}`}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-[var(--theme-text)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                onClick={() => scrollToAnchor(getLessonSummarySectionAnchorId(index))}
                title={section.displayHeading}
                type="button"
              >
                <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-lg bg-[var(--theme-primary-soft)] px-1.5 text-xs font-black text-[var(--theme-primary)]">
                  {section.order || index + 1}
                </span>
                <span className="min-w-0 truncate">{section.displayHeading}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
