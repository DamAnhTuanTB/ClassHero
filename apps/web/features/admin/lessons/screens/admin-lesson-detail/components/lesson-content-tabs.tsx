"use client";

import { ClipboardList, FileText, HelpCircle, Layers } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { useRevealActiveHorizontalItem } from "@/lib/use-reveal-active-horizontal-item";

export type LessonContentTabKey = "documents" | "quiz" | "flashcard" | "test";

const lessonContentTabs = [
  { key: "documents", label: "Tài liệu", icon: FileText },
  { key: "quiz", label: "Quiz", icon: HelpCircle },
  { key: "flashcard", label: "Flashcard", icon: Layers },
  { key: "test", label: "Test", icon: ClipboardList },
] as const satisfies ReadonlyArray<{
  key: LessonContentTabKey;
  label: string;
  icon: typeof FileText;
}>;

interface LessonContentTabsProps {
  activeTab: LessonContentTabKey;
  panelId: string;
  onChange: (tab: LessonContentTabKey) => void;
}

export function LessonContentTabs({
  activeTab,
  panelId,
  onChange,
}: LessonContentTabsProps) {
  const { focusItem, scrollerRef, setItemRef } = useRevealActiveHorizontalItem(activeTab);
  const activeTabIndex = lessonContentTabs.findIndex((tab) => tab.key === activeTab);

  function focusTabAt(index: number) {
    const nextTab = lessonContentTabs[index];
    if (!nextTab) {
      return;
    }

    onChange(nextTab.key);
    focusItem(nextTab.key);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTabAt((activeTabIndex + 1) % lessonContentTabs.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTabAt(
        (activeTabIndex - 1 + lessonContentTabs.length) % lessonContentTabs.length,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTabAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTabAt(lessonContentTabs.length - 1);
    }
  }

  return (
    <div
      ref={scrollerRef}
      className="mt-4 overflow-x-auto overflow-y-hidden border-b border-[var(--theme-border)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        role="tablist"
        aria-label="Nội dung buổi học"
        onKeyDown={handleKeyDown}
        className="relative grid min-w-[26rem] grid-cols-4"
      >
        {lessonContentTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              ref={(element) => setItemRef(tab.key, element)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-bold transition-colors sm:px-4",
                isActive
                  ? "text-[var(--theme-primary)]"
                  : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-strong)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/4 rounded-full bg-[var(--theme-primary)] transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            transform: `translateX(${activeTabIndex * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}
