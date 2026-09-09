import { useState, useMemo } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonSummaryTableOfContents } from "@/components/common/content/lesson-summary-table-of-contents";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import type { StudentLesson } from "@/features/student/lessons/types/student-lesson-types";
import { SummaryBlockRenderer } from "./summary-block-renderer";

export function LessonSummaryPanel({ lesson }: { lesson: StudentLesson }) {
  const content = lesson.summary?.contentJson as any;
  const isBlocksFormat = content?.type === "lesson_summary_blocks";

  const [activeSubTab, setActiveSubTab] = useState<"theory" | "exercises">("theory");

  const filteredData = useMemo(() => {
    if (!content?.data) return null;
    const newData = { ...content.data };

    if (newData.sections) {
      newData.sections = newData.sections
        .map((section: any) => ({
          ...section,
          blocks: section.blocks.filter((block: any) =>
            activeSubTab === "theory"
              ? block.type !== "exercise"
              : block.type === "exercise"
          ),
        }))
        .filter((section: any) => section.blocks.length > 0);
    }
    return newData;
  }, [content?.data, activeSubTab]);

  const theorySections = useMemo(() => {
    if (!content?.data?.sections) return [];
    return content.data.sections
      .map((section: any) => ({
        ...section,
        blocks: section.blocks.filter((block: any) => block.type !== "exercise"),
      }))
      .filter((section: any) => section.blocks.length > 0);
  }, [content?.data]);

  const exerciseTocItems = useMemo(() => {
    if (!content?.data?.sections) return undefined;
    const items: Array<{ title: string; anchorId: string; order?: number }> = [];
    let exerciseCount = 1;

    // Simulate the filtering that happens when activeSubTab === "exercises"
    // so we can compute the exact same idx and bIdx that SummaryBlockRenderer will use
    const exercisesSections = content.data.sections
      .map((section: any) => ({
        ...section,
        blocks: section.blocks.filter((block: any) => block.type === "exercise"),
      }))
      .filter((section: any) => section.blocks.length > 0);

    exercisesSections.forEach((section: any, idx: number) => {
      section.blocks.forEach((block: any, bIdx: number) => {
        items.push({
          title: `Bài tập ${exerciseCount}`,
          anchorId: `block-${idx}-${bIdx}`,
          order: exerciseCount,
        });
        exerciseCount++;
      });
    });
    return items;
  }, [content?.data]);

  return (
    <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-xl">
              Kiến thức
            </h2>
          </div>
        </div>

        {content?.data ? (
          <LessonSummaryTableOfContents
            accentTrigger
            desktopBorderless
            hasObjectives={Boolean(content.data.objectives?.length)}
            sections={theorySections}
            customItems={exerciseTocItems}
            title="Mục lục"
            buttonClassName="h-9 w-9 p-0 md:w-auto md:px-2.5 text-xs sm:h-10 sm:w-10 sm:p-0 lg:w-auto lg:px-3 sm:text-sm"
            onSectionClick={(id) => {
              if (activeSubTab !== "theory") {
                setActiveSubTab("theory");
                setTimeout(() => {
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              } else {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            onCustomItemClick={(id) => {
              if (activeSubTab !== "exercises") {
                setActiveSubTab("exercises");
                setTimeout(() => {
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              } else {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
          />
        ) : null}
      </div>

      {lesson.summary && isBlocksFormat && (
        <div className="mt-3 mb-2 flex flex-col gap-3 sm:mt-4 sm:mb-2">
          <div className="flex w-full items-center gap-1 rounded-xl bg-slate-100/80 p-1.5 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => setActiveSubTab("theory")}
              className={cn(
                "flex-1 min-w-0 truncate px-2 py-2 sm:px-6 sm:py-2.5 text-[15px] sm:text-[17px] font-bold transition-all rounded-lg text-center",
                activeSubTab === "theory"
                  ? "bg-white text-sky-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-slate-700 dark:text-sky-400"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-700/50"
              )}
            >
              Lý thuyết
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("exercises")}
              className={cn(
                "flex-1 min-w-0 truncate px-2 py-2 sm:px-6 sm:py-2.5 text-[15px] sm:text-[17px] font-bold transition-all rounded-lg text-center",
                activeSubTab === "exercises"
                  ? "bg-white text-sky-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-slate-700 dark:text-sky-400"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-700/50"
              )}
            >
              Bài tập
            </button>
          </div>
        </div>
      )}

      {lesson.summary ? (
        isBlocksFormat ? (
          <SummaryBlockRenderer
            data={filteredData}
            displayTitle={lesson.title}
            hideTitle
            viewMode="UI_ONLY"
            hideObjectives={activeSubTab === "exercises"}
            hideSectionHeadings={activeSubTab === "exercises"}
            className="mt-0 pt-0 sm:pt-2"
          />
        ) : (
          <TiptapContentView
            content={lesson.summary.contentJson}
            className="mt-3 sm:mt-4"
          />
        )
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          Bài học này chưa có bản kiến thức trọng tâm.
        </p>
      )}
    </section>
  );
}
