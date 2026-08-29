"use client";

import { Check, CircleSlash2, CircleX } from "lucide-react";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { StudentMathAnswerInput } from "@/features/student/lessons/screens/student-lesson-screen/components/student-math-answer-input";
import type {
  CheckedAnswer,
  StudentAnswer,
  StudentAssessmentQuestion,
} from "@/features/student/lessons/types/student-lesson-types";
import { removeTrailingOptionPeriod } from "@/lib/tiptap-rich-content";
import { getStemFigureDisplayPercent } from "@/lib/stem-figure-display";
import { cn } from "@/lib/utils";

const QUIZ_CONTENT_NORMAL_WEIGHT_CLASS =
  "font-normal [&_b]:font-normal [&_h2]:font-normal [&_h3]:font-normal [&_strong]:font-normal [&_th]:font-normal";

export function AssessmentQuestionCard({
  accent = "quiz",
  answer,
  feedback,
  onChange,
  question,
  readOnly = false,
}: {
  accent?: "quiz" | "test";
  answer: StudentAnswer | undefined;
  feedback?: CheckedAnswer | null;
  onChange: (answer: StudentAnswer) => void;
  question: StudentAssessmentQuestion;
  readOnly?: boolean;
}) {
  const disabled = readOnly || Boolean(feedback);
  const questionFigureDisplayPercent = getStemFigureDisplayPercent(
    question.questionFigure?.displayScale,
  );

  return (
    <section
      className={cn(
        "student-assessment-content rounded-[1.4rem] bg-white px-1.5 dark:bg-[var(--theme-surface)] sm:px-2.5",
        accent === "quiz" && "learning-content-text pb-2 pt-1",
        accent === "test"
          ? "border border-emerald-100 py-3 shadow-[0_18px_45px_-36px_rgb(16_185_129_/_55%)] dark:border-[var(--theme-border)] sm:py-4"
          : null,
      )}
    >
      <TiptapContentView
        content={question.questionJson}
        className={cn(
          "text-base leading-6 text-slate-950 dark:text-[var(--theme-text-strong)]",
          accent === "quiz" ? QUIZ_CONTENT_NORMAL_WEIGHT_CLASS : "font-bold",
        )}
      />

      {question.questionFigure?.url ? (
        <figure
          className="mx-auto mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-[var(--theme-border)]"
          style={
            questionFigureDisplayPercent === null
              ? undefined
              : { width: `${questionFigureDisplayPercent}%` }
          }
        >
          {/* The URL is produced by the trusted QuizFigure/File pipeline. */}
          <img
            src={question.questionFigure.url}
            alt={question.questionFigure.altText}
            className={cn(
              "mx-auto max-h-[28rem] max-w-full object-contain",
              questionFigureDisplayPercent === null ? "w-auto" : "w-full",
            )}
          />
          {question.questionFigure.caption ? (
            <figcaption
              className={cn(
                "mt-2 text-center text-sm text-slate-500 dark:text-[var(--theme-text-muted)]",
                accent === "quiz" ? "font-normal" : "font-bold",
              )}
            >
              {question.questionFigure.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="mt-2">
        {question.questionType === "MULTIPLE_CHOICE" ? (
          <MultipleChoiceAnswer
            accent={accent}
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
            question={question}
          />
        ) : question.questionType === "TRUE_FALSE" ? (
          <TrueFalseAnswer
            accent={accent}
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
          />
        ) : question.questionType === "MULTI_STATEMENT_TRUE_FALSE" ? (
          <MultiStatementAnswer
            accent={accent}
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
            question={question}
          />
        ) : (
          <TextAnswer
            key={question.id}
            accent={accent}
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
          />
        )}
      </div>

      {feedback &&
      (question.questionType !== "MULTI_STATEMENT_TRUE_FALSE" || feedback.isSkipped) ? (
        <div
          role="status"
          className={cn(
            "mt-1 flex items-center gap-2 rounded-2xl px-0 py-1 text-sm font-black",
            feedback.isSkipped
              ? "text-amber-600 dark:text-amber-300"
              : feedback.isCorrect
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300",
          )}
        >
          {feedback.isSkipped ? (
            <CircleSlash2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : feedback.isCorrect ? (
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleX className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          {feedback.isSkipped
            ? "Đã bỏ qua"
            : feedback.isCorrect
              ? "Chính xác!"
              : "Chưa chính xác"}
        </div>
      ) : null}
    </section>
  );
}

function MultipleChoiceAnswer({
  accent,
  answer,
  disabled,
  feedback,
  onChange,
  question,
}: {
  accent: "quiz" | "test";
  answer: StudentAnswer | undefined;
  disabled: boolean;
  feedback?: CheckedAnswer | null;
  onChange: (answer: StudentAnswer) => void;
  question: StudentAssessmentQuestion;
}) {
  const selected = Array.isArray(answer)
    ? answer.filter((value): value is string => typeof value === "string").slice(-1)
    : [];
  const correct = Array.isArray(feedback?.correctAnswerJson)
    ? feedback.correctAnswerJson.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return (
    <div className="grid gap-2">
      {(question.optionsJson ?? []).map((option, index) => {
        const isSelected = selected.includes(option.id);
        const isCorrect = correct.includes(option.id);
        const isSelectedWrong = Boolean(feedback) && isSelected && !isCorrect;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onChange([option.id])}
            className={cn(
              "student-mobile-border flex min-h-14 w-full items-center gap-2.5 rounded-[1.1rem] border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-default",
              accent === "test"
                ? "focus-visible:ring-emerald-200"
                : "focus-visible:ring-sky-200",
              feedback && isCorrect
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-500/10 dark:text-emerald-300"
                : isSelectedWrong
                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-300"
                  : isSelected
                    ? accent === "test"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_4px_12px_-10px_rgb(16_185_129_/_75%)] dark:border-emerald-400/70 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-sky-400 bg-sky-50 text-sky-700 shadow-[0_4px_12px_-10px_rgb(2_132_199_/_75%)] dark:border-sky-400/70 dark:bg-sky-500/10 dark:text-sky-300"
                    : accent === "test"
                      ? "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-500/45 dark:bg-[var(--theme-surface-soft)] dark:text-[var(--theme-text)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-500/45 dark:bg-[var(--theme-surface-soft)] dark:text-[var(--theme-text)]",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-black transition-colors",
                feedback && isCorrect
                  ? "bg-emerald-500 text-white"
                  : isSelectedWrong
                    ? "bg-rose-500 text-white"
                    : isSelected
                      ? accent === "test"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-sky-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
              )}
            >
              {getOptionLabel(index)}
            </span>
            <TiptapContentView
              content={removeTrailingOptionPeriod(option.richText)}
              className={cn(
                "min-w-0 flex-1 text-base",
                accent === "quiz" ? QUIZ_CONTENT_NORMAL_WEIGHT_CLASS : "font-bold",
              )}
              contentAlignment="left"
            />
          </button>
        );
      })}
    </div>
  );
}

function getOptionLabel(index: number) {
  let value = index + 1;
  let label = "";

  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }

  return label;
}

function TrueFalseAnswer({
  accent,
  answer,
  disabled,
  feedback,
  onChange,
}: {
  accent: "quiz" | "test";
  answer: StudentAnswer | undefined;
  disabled: boolean;
  feedback?: CheckedAnswer | null;
  onChange: (answer: StudentAnswer) => void;
}) {
  const correct =
    typeof feedback?.correctAnswerJson === "boolean"
      ? feedback.correctAnswerJson
      : undefined;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[true, false].map((value) => (
        <ChoiceButton
          key={String(value)}
          accent={accent}
          label={value ? "Đúng" : "Sai"}
          selected={answer === value}
          correct={correct === value}
          hasFeedback={Boolean(feedback)}
          disabled={disabled}
          onClick={() => onChange(value)}
        />
      ))}
    </div>
  );
}

function MultiStatementAnswer({
  accent,
  answer,
  disabled,
  feedback,
  onChange,
  question,
}: {
  accent: "quiz" | "test";
  answer: StudentAnswer | undefined;
  disabled: boolean;
  feedback?: CheckedAnswer | null;
  onChange: (answer: StudentAnswer) => void;
  question: StudentAssessmentQuestion;
}) {
  const selected = Array.isArray(answer)
    ? answer.filter(
        (
          value,
        ): value is {
          statementId: string;
          value: boolean;
        } => typeof value === "object" && value !== null && "statementId" in value,
      )
    : [];

  function update(statementId: string, value: boolean) {
    onChange([
      ...selected.filter((entry) => entry.statementId !== statementId),
      { statementId, value },
    ]);
  }

  return (
    <div className="grid gap-3">
      {(question.optionsJson ?? []).map((statement, index) => {
        const selectedValue = selected.find(
          (entry) => entry.statementId === statement.id,
        )?.value;
        const statementFeedback = feedback?.statementResults?.find(
          (entry) => entry.statementId === statement.id,
        );
        return (
          <div
            key={statement.id}
            className={cn(
              "student-mobile-border rounded-2xl border p-3",
              feedback?.isSkipped
                ? "border-slate-200 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-soft)]"
                : statementFeedback
                  ? statementFeedback.isCorrect
                    ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)]"
                    : "border-[var(--theme-error-border)] bg-[var(--theme-error-bg)]"
                  : "border-slate-200 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-soft)]",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-100 text-xs font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                {accent === "quiz" ? getOptionLabel(index).toLowerCase() : index + 1}
              </span>
              <TiptapContentView
                content={statement.richText}
                className={cn(
                  "min-w-0 flex-1 text-base leading-6 text-slate-950 dark:text-[var(--theme-text-strong)]",
                  accent === "quiz" ? QUIZ_CONTENT_NORMAL_WEIGHT_CLASS : "font-bold",
                )}
                contentAlignment="left"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[true, false].map((value) => (
                <ChoiceButton
                  key={String(value)}
                  accent={accent}
                  label={value ? "Đúng" : "Sai"}
                  selected={selectedValue === value}
                  correct={statementFeedback?.correctValue === value}
                  hasFeedback={Boolean(statementFeedback)}
                  revealCorrectAnswer={feedback?.isSkipped === true}
                  disabled={disabled}
                  onClick={() => update(statement.id, value)}
                />
              ))}
            </div>
            {statementFeedback && !feedback?.isSkipped ? (
              <div className="mt-2 flex items-center px-0 text-sm">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-bold",
                    statementFeedback.isCorrect
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300",
                  )}
                >
                  {statementFeedback.isCorrect ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CircleX className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {statementFeedback.isCorrect ? "Chính xác" : "Chưa chính xác"}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TextAnswer({
  accent,
  answer,
  disabled,
  feedback,
  onChange,
}: {
  accent: "quiz" | "test";
  answer: StudentAnswer | undefined;
  disabled: boolean;
  feedback?: CheckedAnswer | null;
  onChange: (answer: StudentAnswer) => void;
}) {
  const correctAnswers = Array.isArray(feedback?.correctAnswerJson)
    ? feedback.correctAnswerJson.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return (
    <div>
      <StudentMathAnswerInput
        accent={accent}
        value={typeof answer === "string" ? answer : ""}
        disabled={disabled}
        answerState={
          feedback?.isSkipped
            ? "idle"
            : feedback?.isCorrect
              ? "correct"
              : feedback
                ? "incorrect"
                : "idle"
        }
        onChange={onChange}
      />
      {feedback && !feedback.isCorrect && correctAnswers.length > 0 ? (
        <p
          className={cn(
            "mt-2 text-sm text-emerald-700 dark:text-emerald-300",
            accent === "quiz" ? "font-normal" : "font-bold",
          )}
        >
          Đáp án: {correctAnswers.join(" hoặc ")}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceButton({
  accent,
  correct,
  disabled,
  hasFeedback,
  label,
  onClick,
  revealCorrectAnswer = true,
  selected,
}: {
  accent: "quiz" | "test";
  correct: boolean;
  disabled: boolean;
  hasFeedback: boolean;
  label: string;
  onClick: () => void;
  revealCorrectAnswer?: boolean;
  selected: boolean;
}) {
  const selectedWrong = hasFeedback && selected && !correct;
  const showCorrect = hasFeedback && correct && (selected || revealCorrectAnswer);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "student-mobile-border min-h-11 rounded-xl border px-2 text-sm transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-default",
        accent === "quiz" ? "font-normal" : "font-black",
        accent === "test"
          ? "focus-visible:ring-emerald-200"
          : "focus-visible:ring-sky-200",
        showCorrect
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-500/10 dark:text-emerald-300"
          : selectedWrong
            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-300"
            : selected
              ? accent === "test"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/45 dark:bg-sky-500/10 dark:text-sky-300"
              : accent === "test"
                ? "border-slate-200 bg-slate-50/40 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-500/45 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]"
                : "border-slate-200 bg-slate-50/40 text-slate-600 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-500/45 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]",
      )}
    >
      {label}
    </button>
  );
}
