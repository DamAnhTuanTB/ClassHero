"use client";

import { CheckCircle2, ImageIcon, LocateFixed, Sparkles } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

import { AdminFigureStatusBadge } from "@/components/admin/admin-figure-status-badge";
import { AdminFigureStatusCounts } from "@/components/admin/admin-figure-status-counts";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type {
  AdminQuizFigure,
  AdminQuizQuestion,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { AdminQuizFigurePreview } from "@/features/admin/quiz/components/admin-quiz-figure-preview";
import { QuizRichContentViewer } from "@/features/admin/quiz/components/quiz-rich-content-viewer";

type QuizFigureOverviewEntry = {
  displayNumber: number;
  figure: AdminQuizFigure;
  question: AdminQuizQuestion;
};

type QuizFigureOverviewSection = {
  emptyDescription: string;
  emptyTitle: string;
  entries: QuizFigureOverviewEntry[];
  id: "pending-ai" | "approved";
  title: string;
};

export function AdminQuizFigureOverviewDialog({
  approvedQuestions,
  isOpen,
  onClose,
  onNavigateToQuestion,
  pendingQuestions,
  setId,
}: {
  approvedQuestions: AdminQuizQuestion[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToQuestion: (questionId: string) => void;
  pendingQuestions: AdminQuizQuestion[];
  setId: string;
}) {
  const [activeTab, setActiveTab] = useState<QuizFigureOverviewSection["id"]>(() =>
    hasQuizFigures(pendingQuestions) ? "pending-ai" : "approved",
  );
  const sections = useMemo<QuizFigureOverviewSection[]>(
    () => [
      {
        emptyDescription: "Ảnh của câu AI sẽ xuất hiện tại đây trước khi duyệt.",
        emptyTitle: "Không có ảnh AI chờ duyệt",
        entries: buildOverviewEntries(pendingQuestions),
        id: "pending-ai",
        title: "AI chờ duyệt",
      },
      {
        emptyDescription: "Duyệt câu Quiz để chuyển ảnh sang nhóm này.",
        emptyTitle: "Chưa có ảnh Quiz đã duyệt",
        entries: buildOverviewEntries(approvedQuestions),
        id: "approved",
        title: "Quiz đã duyệt",
      },
    ],
    [approvedQuestions, pendingQuestions],
  );
  const entries = useMemo(
    () => sections.flatMap((section) => section.entries),
    [sections],
  );
  const figures = useMemo(() => entries.map((entry) => entry.figure), [entries]);
  const activeSection =
    sections.find((section) => section.id === activeTab) ?? sections[0];

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? sections.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + sections.length) %
            sections.length;
    const nextSection = sections[nextIndex];
    if (!nextSection) return;

    setActiveTab(nextSection.id);
    requestAnimationFrame(() => {
      document.getElementById(`quiz-figure-tab-${nextSection.id}`)?.focus();
    });
  }

  return (
    <EditorDialogShell
      ariaLabel="Toàn bộ hình Quiz"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-6xl"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-6 sm:pr-20">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          Toàn bộ hình Quiz
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <AdminFigureStatusCounts figures={figures} />

        <div
          aria-label="Phân loại hình Quiz"
          className="mb-4 grid grid-cols-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
          role="tablist"
        >
          {sections.map((section, index) => {
            const isActive = section.id === activeSection?.id;
            const isPendingAi = section.id === "pending-ai";
            const TabIcon = isPendingAi ? Sparkles : CheckCircle2;

            return (
              <button
                aria-controls={`quiz-figure-panel-${section.id}`}
                aria-selected={isActive}
                className={
                  isActive
                    ? isPendingAi
                      ? "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-extrabold text-amber-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 sm:gap-2 sm:px-3 sm:text-sm"
                      : "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-xs font-extrabold text-emerald-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 sm:gap-2 sm:px-3 sm:text-sm"
                    : "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-2 text-xs font-extrabold text-[var(--theme-text-muted)] transition-colors hover:bg-[var(--theme-surface)] hover:text-[var(--theme-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] sm:gap-2 sm:px-3 sm:text-sm"
                }
                id={`quiz-figure-tab-${section.id}`}
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                type="button"
              >
                <TabIcon className="size-4 shrink-0" aria-hidden="true" />
                <span>{section.title}</span>
                <span
                  className={
                    isActive
                      ? isPendingAi
                        ? "grid min-w-6 place-items-center rounded-full bg-amber-200/70 px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                        : "grid min-w-6 place-items-center rounded-full bg-emerald-200/70 px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100"
                      : "grid min-w-6 place-items-center rounded-full bg-[var(--theme-surface)] px-1.5 py-1 text-[10px] font-black leading-none tabular-nums text-[var(--theme-text-muted)]"
                  }
                >
                  {section.entries.length}
                </span>
              </button>
            );
          })}
        </div>

        {activeSection ? (
          <QuizFigureOverviewTabPanel
            onNavigateToQuestion={onNavigateToQuestion}
            section={activeSection}
            setId={setId}
          />
        ) : (
          <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-6 text-center">
            <ImageIcon
              aria-hidden="true"
              className="h-8 w-8 text-[var(--theme-text-muted)]"
            />
          </div>
        )}
      </div>

      <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
        <button
          className="theme-button-neutral inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          onClick={onClose}
          type="button"
        >
          Đóng
        </button>
      </footer>
    </EditorDialogShell>
  );
}

function QuizFigureOverviewTabPanel({
  onNavigateToQuestion,
  section,
  setId,
}: {
  onNavigateToQuestion: (questionId: string) => void;
  section: QuizFigureOverviewSection;
  setId: string;
}) {
  return (
    <section
      aria-labelledby={`quiz-figure-tab-${section.id}`}
      id={`quiz-figure-panel-${section.id}`}
      role="tabpanel"
    >
      {section.entries.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {section.entries.map((entry) => (
            <QuizFigureOverviewCard
              entry={entry}
              key={entry.figure.id}
              onNavigateToQuestion={onNavigateToQuestion}
              setId={setId}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-6 text-center">
          <div>
            <ImageIcon
              aria-hidden="true"
              className="mx-auto h-8 w-8 text-[var(--theme-text-muted)]"
            />
            <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
              {section.emptyTitle}
            </p>
            <p className="mt-1 text-xs font-medium text-[var(--theme-text-muted)]">
              {section.emptyDescription}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function QuizFigureOverviewCard({
  entry,
  onNavigateToQuestion,
  setId,
}: {
  entry: QuizFigureOverviewEntry;
  onNavigateToQuestion: (questionId: string) => void;
  setId: string;
}) {
  const questionNumber = entry.displayNumber;
  const roleLabel = entry.figure.role === "QUESTION" ? "Hình đề" : "Hình lời giải";

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--theme-text-muted)]">
            Câu {questionNumber} · {roleLabel}
          </p>
          <QuizRichContentViewer
            ariaLabel={`Nội dung Câu ${questionNumber}`}
            className="mt-1 break-words text-sm font-extrabold leading-relaxed text-[var(--theme-text-strong)]"
            content={entry.question.questionJson}
            contentAlignment="left"
            fallback={`Câu ${questionNumber}`}
          />
        </div>
        <AdminFigureStatusBadge status={entry.figure.status} />
      </div>

      <div className="flex-1 bg-white p-3 dark:bg-white sm:p-4">
        <AdminQuizFigurePreview
          figure={entry.figure}
          questionId={entry.question.id}
          role={entry.figure.role}
          setId={setId}
        />
      </div>

      <div className="flex justify-end border-t border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 sm:px-4">
        <button
          className="theme-button-primary-subtle inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold"
          onClick={() => onNavigateToQuestion(entry.question.id)}
          type="button"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          Đi đến Câu {questionNumber}
        </button>
      </div>
    </article>
  );
}

function buildOverviewEntries(questions: AdminQuizQuestion[]) {
  return questions.flatMap((question, questionIndex) =>
    [...question.figures]
      .sort((left, right) => figureRoleOrder(left.role) - figureRoleOrder(right.role))
      .map((figure) => ({
        displayNumber: questionIndex + 1,
        figure,
        question,
      })),
  );
}

function hasQuizFigures(questions: AdminQuizQuestion[]) {
  return questions.some((question) => question.figures.length > 0);
}

function figureRoleOrder(role: AdminQuizFigure["role"]) {
  return role === "QUESTION" ? 0 : 1;
}
