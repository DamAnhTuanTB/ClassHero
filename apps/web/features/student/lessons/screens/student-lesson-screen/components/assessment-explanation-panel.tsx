"use client";

import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { LessonSummaryDiagram } from "@/components/common/content/lesson-summary-diagram";
import {
  isLessonSummaryExampleBlockData,
  LessonSummaryExampleCard,
} from "@/components/common/content/lesson-summary-example-content";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import type { TiptapTextDocument } from "@/types/rich-text";

export function AssessmentExplanationPanel({
  content,
  diagramSpec,
  exampleBlock,
  isOpen: controlledIsOpen,
  onToggle,
}: {
  content: TiptapTextDocument | null | undefined;
  diagramSpec?: unknown | null;
  exampleBlock?: unknown | null;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const structuredExample = useMemo(
    () => (isLessonSummaryExampleBlockData(exampleBlock) ? exampleBlock : null),
    [exampleBlock],
  );
  if (!content && !diagramSpec && !structuredExample) return null;
  const isOpen = controlledIsOpen ?? internalIsOpen;

  function handleToggle() {
    if (onToggle) {
      onToggle();
      return;
    }
    setInternalIsOpen((value) => !value);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl bg-sky-50 px-4 text-base font-black text-sky-700 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:focus-visible:ring-sky-500/30"
      >
        <BookOpen className="h-5 w-5" aria-hidden="true" />
        {isOpen ? "Ẩn lời giải chi tiết" : "Xem lời giải chi tiết"}
      </button>
      {isOpen ? (
        structuredExample ? (
          <div className="mt-2">
            <LessonSummaryExampleCard
              block={structuredExample}
              label="Lời giải"
              showProblem={false}
            />
          </div>
        ) : (
          <div className="mt-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-400/30 dark:bg-sky-500/10">
            <>
              {content ? <TiptapContentView content={content} /> : null}
              {diagramSpec ? <LessonSummaryDiagram spec={diagramSpec} /> : null}
            </>
          </div>
        )
      ) : null}
    </div>
  );
}
