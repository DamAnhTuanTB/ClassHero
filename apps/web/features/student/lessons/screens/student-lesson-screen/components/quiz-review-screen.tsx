"use client";

import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentQuestionCard } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-question-card";
import type {
  AssessmentReview,
  StudentAssessmentQuestion,
} from "@/features/student/lessons/types/student-lesson-types";
import { cn } from "@/lib/utils";

export function QuizReviewScreen({
  currentIndex,
  displayScope,
  onBack,
  onCurrentIndexChange,
  review,
}: {
  currentIndex: number;
  displayScope: "ALL" | "INCORRECT";
  onBack: () => void;
  onCurrentIndexChange: (index: number) => void;
  review: AssessmentReview;
}) {
  useDocumentScrollLock();

  const visibleQuestions =
    displayScope === "INCORRECT"
      ? review.questions.filter((item) => !item.isCorrect)
      : review.questions;
  const question = visibleQuestions[currentIndex];
  const questionIndex = question
    ? review.questions.findIndex((item) => item.id === question.id)
    : -1;
  const questionNumber = question?.questionNumber ?? questionIndex + 1;
  const totalCount = review.originalTotalCount ?? review.totalCount;
  const visibleQuestionNumber = currentIndex + 1;
  const visibleQuestionCount = visibleQuestions.length;
  const progressPercent =
    (visibleQuestionNumber / Math.max(visibleQuestionCount, 1)) * 100;

  function handleQuestionSelect(questionId: string) {
    const nextIndex = visibleQuestions.findIndex((item) => item.id === questionId);
    if (nextIndex >= 0) {
      onCurrentIndexChange(nextIndex);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[linear-gradient(180deg,#e0f2fe_0%,#f0f9ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]">
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại kết quả Quiz"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-10 sm:px-6 sm:py-7">
        <section aria-labelledby="quiz-review-question-title">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-sky-600 dark:text-sky-300">
                {displayScope === "INCORRECT"
                  ? "Xem lại các câu trả lời sai"
                  : "Xem lại tất cả câu trả lời"}
              </p>
              <h1
                id="quiz-review-question-title"
                className="mt-1 text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl"
              >
                {question ? `Câu hỏi ${questionNumber}/${totalCount}` : "Xem lại Quiz"}
              </h1>
            </div>
            {question ? (
              <span className="shrink-0 rounded-2xl border border-blue-300 bg-blue-200 px-3 py-2 text-xs font-black text-blue-800 shadow-[0_3px_0_rgb(147_197_253)] dark:border-blue-300/30 dark:bg-blue-500/20 dark:text-blue-200 dark:shadow-[0_3px_0_rgb(30_58_138)]">
                {displayScope === "INCORRECT"
                  ? `Câu sai ${currentIndex + 1}/${visibleQuestions.length}`
                  : `Đã xem ${currentIndex + 1}`}
              </span>
            ) : null}
          </div>

          {question ? (
            <div
              className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-[var(--theme-surface-muted)]"
              role="progressbar"
              aria-label="Tiến độ xem lại Quiz"
              aria-valuemin={0}
              aria-valuemax={visibleQuestionCount}
              aria-valuenow={visibleQuestionNumber}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          ) : null}
        </section>

        <div className="mt-4">
          {question ? (
            <div className="rounded-[1.25rem] border border-sky-100 bg-white px-2 py-2.5 shadow-[0_24px_55px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:py-3">
              <div className="mb-2 flex items-center gap-2.5 px-0.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sm font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    {String(questionNumber).padStart(2, "0")}
                  </span>
                  <h2 className="truncate text-base font-black text-sky-700 dark:text-sky-300 sm:text-lg">
                    {getQuestionInstruction(question.questionType)}
                  </h2>
                </div>
              </div>

              <AssessmentQuestionCard
                question={question}
                answer={question.answerJson}
                feedback={question}
                onChange={() => undefined}
                readOnly
              />
            </div>
          ) : (
            <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm font-bold text-slate-500 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]">
              Không có câu trả lời sai để xem lại.
            </p>
          )}
        </div>

        {question ? (
          <nav
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
            aria-label="Điều hướng câu hỏi xem lại"
          >
            {review.questions.map((item, index) => {
              const isCurrent = item.id === question.id;
              const isSelectable = displayScope === "ALL" || !item.isCorrect;
              const itemQuestionNumber = item.questionNumber ?? index + 1;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!isSelectable}
                  onClick={() => handleQuestionSelect(item.id)}
                  aria-label={`Câu ${itemQuestionNumber}: ${
                    item.isCorrect ? "đúng" : "sai"
                  }${isSelectable ? "" : ", không thuộc phạm vi xem lại câu sai"}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "relative h-3 shrink-0 rounded-full transition-[width,background-color,filter,transform] duration-200 before:absolute before:-inset-x-1 before:-inset-y-2 before:rounded-lg before:content-[''] hover:brightness-95 active:scale-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none dark:focus-visible:ring-sky-500/30",
                    isCurrent ? "w-8" : "w-3",
                    item.isCorrect ? "bg-emerald-400" : "bg-rose-400",
                  )}
                />
              );
            })}
          </nav>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onCurrentIndexChange(Math.max(0, currentIndex - 1))}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border border-sky-200 bg-white px-3 text-base font-black text-sky-700 shadow-[0_4px_0_rgb(186_230_253)] transition hover:bg-sky-50 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(186_230_253)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-400/30 dark:bg-[var(--theme-surface)] dark:text-sky-300 dark:shadow-[0_4px_0_rgb(7_89_133)] dark:active:shadow-[0_1px_0_rgb(7_89_133)]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Câu trước
          </button>
          <button
            type="button"
            disabled={currentIndex >= visibleQuestions.length - 1}
            onClick={() =>
              onCurrentIndexChange(
                Math.min(visibleQuestions.length - 1, currentIndex + 1),
              )
            }
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-sky-600 px-3 text-base font-black text-white shadow-[0_4px_0_rgb(3_105_161)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(3_105_161)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700 enabled:hover:bg-sky-500"
          >
            Câu tiếp
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}

function getQuestionInstruction(questionType: StudentAssessmentQuestion["questionType"]) {
  if (questionType === "MULTIPLE_CHOICE") return "Chọn đáp án đúng";
  if (questionType === "TRUE_FALSE") return "Chọn Đúng hoặc Sai";
  if (questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    return "Đánh giá từng nhận định";
  }
  return "Nhập câu trả lời";
}
