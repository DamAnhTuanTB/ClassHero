"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { StudentAiChatHeaderTrigger } from "@/features/student/ai-chat/components/student-ai-chat-header-trigger";
import type { AiChatEntryContext } from "@/features/student/ai-chat/utils/ai-chat-link";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentQuestionCard } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-question-card";
import { AssessmentExplanationPanel } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-explanation-panel";
import type {
  AssessmentReview,
  StudentAssessmentQuestion,
} from "@/features/student/lessons/types/student-lesson-types";
import { cn } from "@/lib/utils";

export function QuizReviewScreen({
  accent = "sky",
  activityLabel = "Quiz",
  aiChatContext,
  backLabel = "Quay lại kết quả Quiz",
  currentIndex,
  displayScope,
  onBack,
  onCurrentIndexChange,
  review,
  reviewTitle,
  stackedOverDialog = false,
  targetType = "QUIZ_QUESTION",
  testId = "quiz-review-screen",
}: {
  accent?: "emerald" | "sky";
  activityLabel?: string;
  aiChatContext?: AiChatEntryContext;
  backLabel?: string;
  currentIndex: number;
  displayScope: "ALL" | "INCORRECT";
  onBack: () => void;
  onCurrentIndexChange: (index: number) => void;
  review: AssessmentReview;
  reviewTitle?: string;
  stackedOverDialog?: boolean;
  targetType?: "QUIZ_QUESTION" | "TEST_QUESTION";
  testId?: string;
}) {
  useDocumentScrollLock();

  const usesEmeraldAccent = accent === "emerald";
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
  const isFirstQuestion = question !== undefined && currentIndex === 0;
  const isLastQuestion =
    question !== undefined && currentIndex >= visibleQuestionCount - 1;
  const progressPercent =
    (visibleQuestionNumber / Math.max(visibleQuestionCount, 1)) * 100;
  const currentAiChatContext =
    aiChatContext?.scopeType === "COURSE" && question
      ? ({
          ...aiChatContext,
          target: { targetType, targetId: question.id },
        } satisfies AiChatEntryContext)
      : aiChatContext;

  function handleQuestionSelect(questionId: string) {
    const nextIndex = visibleQuestions.findIndex((item) => item.id === questionId);
    if (nextIndex >= 0) {
      onCurrentIndexChange(nextIndex);
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 overflow-y-auto text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]",
        usesEmeraldAccent
          ? "bg-[linear-gradient(180deg,#def8e9_0%,#eefbf5_100%)]"
          : "bg-[linear-gradient(180deg,#e0f2fe_0%,#f0f9ff_100%)]",
        stackedOverDialog ? "z-[115]" : "z-[80]",
      )}
      data-testid={testId}
    >
      <header
        className={cn(
          "sticky top-0 z-20 border-b bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4",
          usesEmeraldAccent ? "border-emerald-100" : "border-sky-100",
        )}
      >
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition focus-visible:outline-none focus-visible:ring-4 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]",
              usesEmeraldAccent
                ? "hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-emerald-100"
                : "hover:bg-sky-50 hover:text-sky-700 focus-visible:ring-sky-100",
            )}
            aria-label={backLabel}
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
          {currentAiChatContext ? (
            <StudentAiChatHeaderTrigger
              context={currentAiChatContext}
              testId="student-ai-chat-trigger-review"
            />
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-10 sm:px-6 sm:py-7">
        <section aria-labelledby="quiz-review-question-title">
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-black",
                usesEmeraldAccent
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-sky-600 dark:text-sky-300",
              )}
            >
              {reviewTitle ??
                (displayScope === "INCORRECT"
                  ? "Xem lại các câu trả lời sai"
                  : "Xem lại tất cả câu trả lời")}
            </p>
            <h1
              id="quiz-review-question-title"
              className="mt-1 text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl"
            >
              {question ? `Câu hỏi ${questionNumber}` : `Xem lại ${activityLabel}`}
            </h1>
          </div>

          {question ? (
            <div
              className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-[var(--theme-surface-muted)]"
              role="progressbar"
              aria-label={`Tiến độ xem lại ${activityLabel}`}
              aria-valuemin={0}
              aria-valuemax={visibleQuestionCount}
              aria-valuenow={visibleQuestionNumber}
            >
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-[width] duration-300 motion-reduce:transition-none",
                  usesEmeraldAccent
                    ? "from-emerald-500 to-teal-400"
                    : "from-sky-500 to-cyan-400",
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          ) : null}
        </section>

        <div className="mt-4">
          {question ? (
            <div
              className={cn(
                "rounded-[1.25rem] border bg-white px-2 py-2.5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:py-3",
                usesEmeraldAccent
                  ? "border-emerald-100 shadow-[0_24px_55px_-42px_rgb(16_185_129_/_65%)]"
                  : "border-sky-100 shadow-[0_24px_55px_-42px_rgb(2_132_199_/_60%)]",
              )}
            >
              <div className="mb-2 flex items-center gap-2.5 px-0.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black",
                      usesEmeraldAccent
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
                    )}
                  >
                    {String(questionNumber).padStart(2, "0")}
                  </span>
                  <h2
                    className={cn(
                      "truncate text-base font-black sm:text-lg",
                      usesEmeraldAccent
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-sky-700 dark:text-sky-300",
                    )}
                  >
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
              <AssessmentExplanationPanel
                content={question.explanationJson}
                correctAnswer={question.correctAnswerJson}
                explanationBlock={question.explanationBlock}
                optionIds={question.optionsJson?.map((option) => option.id)}
                questionType={question.questionType}
                separateAnswerItems={
                  question.questionType === "MULTI_STATEMENT_TRUE_FALSE"
                }
                solutionFigure={question.solutionFigure}
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
                    "relative h-3 shrink-0 rounded-full transition-[width,background-color,filter,transform] duration-200 before:absolute before:-inset-x-1 before:-inset-y-2 before:rounded-lg before:content-[''] hover:brightness-95 active:scale-90 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none",
                    usesEmeraldAccent
                      ? "focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-500/30"
                      : "focus-visible:ring-sky-200 dark:focus-visible:ring-sky-500/30",
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
            disabled={!question}
            onClick={() => {
              if (isFirstQuestion) {
                onBack();
                return;
              }
              onCurrentIndexChange(Math.max(0, currentIndex - 1));
            }}
            className={cn(
              "student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border bg-white px-2 text-sm font-black transition active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[var(--theme-surface)] sm:gap-2.5 sm:px-3 sm:text-base",
              usesEmeraldAccent
                ? "border-emerald-200 text-emerald-700 shadow-[0_4px_0_rgb(167_243_208)] hover:bg-emerald-50 active:shadow-[0_1px_0_rgb(167_243_208)] dark:border-emerald-400/30 dark:text-emerald-300 dark:shadow-[0_4px_0_rgb(6_78_59)] dark:active:shadow-[0_1px_0_rgb(6_78_59)]"
                : "border-sky-200 text-sky-700 shadow-[0_4px_0_rgb(186_230_253)] hover:bg-sky-50 active:shadow-[0_1px_0_rgb(186_230_253)] dark:border-sky-400/30 dark:text-sky-300 dark:shadow-[0_4px_0_rgb(7_89_133)] dark:active:shadow-[0_1px_0_rgb(7_89_133)]",
            )}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            {isFirstQuestion ? "Trở về" : "Câu trước"}
          </button>
          <button
            type="button"
            disabled={!question}
            onClick={() => {
              if (isLastQuestion) {
                onBack();
                return;
              }
              onCurrentIndexChange(
                Math.min(visibleQuestions.length - 1, currentIndex + 1),
              );
            }}
            className={cn(
              "student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-2 text-sm font-black text-white transition active:translate-y-[3px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700 sm:gap-2.5 sm:px-3 sm:text-base",
              usesEmeraldAccent
                ? "bg-emerald-600 shadow-[0_4px_0_rgb(4_120_87)] active:shadow-[0_1px_0_rgb(4_120_87)] enabled:hover:bg-emerald-500"
                : "bg-sky-600 shadow-[0_4px_0_rgb(3_105_161)] active:shadow-[0_1px_0_rgb(3_105_161)] enabled:hover:bg-sky-500",
            )}
          >
            {isLastQuestion ? "Kết thúc xem lại" : "Câu tiếp"}
            {isLastQuestion ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            )}
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
