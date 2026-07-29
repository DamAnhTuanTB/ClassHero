"use client";

import { Check, CircleX } from "lucide-react";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { StudentMathAnswerInput } from "@/features/student/lessons/screens/student-lesson-screen/components/student-math-answer-input";
import type {
  CheckedAnswer,
  StudentAnswer,
  StudentAssessmentQuestion,
} from "@/features/student/lessons/types/student-lesson-types";
import { cn } from "@/lib/utils";

export function AssessmentQuestionCard({
  answer,
  feedback,
  onChange,
  question,
  readOnly = false,
}: {
  answer: StudentAnswer | undefined;
  feedback?: CheckedAnswer | null;
  onChange: (answer: StudentAnswer) => void;
  question: StudentAssessmentQuestion;
  readOnly?: boolean;
}) {
  const disabled = readOnly || Boolean(feedback);

  return (
    <section className="student-assessment-content rounded-[1.4rem] border border-sky-100 bg-white px-1.5 py-3 shadow-[0_18px_45px_-36px_rgb(2_132_199_/_55%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:px-2.5 sm:py-4">
      <TiptapContentView
        content={question.questionJson}
        className="text-base font-bold leading-6 text-slate-950 dark:text-[var(--theme-text-strong)]"
      />

      <div className="mt-3">
        {question.questionType === "MULTIPLE_CHOICE" ? (
          <MultipleChoiceAnswer
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
            question={question}
          />
        ) : question.questionType === "TRUE_FALSE" ? (
          <TrueFalseAnswer
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
          />
        ) : question.questionType === "MULTI_STATEMENT_TRUE_FALSE" ? (
          <MultiStatementAnswer
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
            question={question}
          />
        ) : (
          <TextAnswer
            key={question.id}
            answer={answer}
            disabled={disabled}
            feedback={feedback}
            onChange={onChange}
          />
        )}
      </div>

      {feedback ? (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-black",
            feedback.isCorrect
              ? "border-emerald-200 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300"
              : "border-rose-200 text-rose-700 dark:border-rose-400/30 dark:text-rose-300",
          )}
        >
          {feedback.isCorrect ? (
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleX className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          {feedback.isCorrect ? "Chính xác!" : "Chưa chính xác"}
        </div>
      ) : null}
    </section>
  );
}

function MultipleChoiceAnswer({
  answer,
  disabled,
  feedback,
  onChange,
  question,
}: {
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
              "student-mobile-border flex min-h-14 w-full items-center gap-2.5 rounded-[1.1rem] border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-default",
              feedback && isCorrect
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-500/10 dark:text-emerald-300"
                : isSelectedWrong
                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-300"
                  : isSelected
                    ? "border-sky-400 bg-sky-50 text-sky-700 shadow-[0_4px_12px_-10px_rgb(2_132_199_/_75%)] dark:border-sky-400/70 dark:bg-sky-500/10 dark:text-sky-300"
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
                      ? "bg-sky-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
              )}
            >
              {getOptionLabel(index)}
            </span>
            <TiptapContentView
              content={option.richText}
              className="min-w-0 flex-1 text-base font-bold text-inherit"
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
  answer,
  disabled,
  feedback,
  onChange,
}: {
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
  answer,
  disabled,
  feedback,
  onChange,
  question,
}: {
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
            className="student-mobile-border rounded-2xl border border-slate-200 p-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-soft)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-xs font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                {index + 1}
              </span>
              <TiptapContentView
                content={statement.richText}
                className="min-w-0 flex-1 text-base font-bold leading-6 text-slate-950 dark:text-[var(--theme-text-strong)]"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[true, false].map((value) => (
                <ChoiceButton
                  key={String(value)}
                  label={value ? "Đúng" : "Sai"}
                  selected={selectedValue === value}
                  correct={statementFeedback?.correctValue === value}
                  hasFeedback={Boolean(statementFeedback)}
                  disabled={disabled}
                  onClick={() => update(statement.id, value)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TextAnswer({
  answer,
  disabled,
  feedback,
  onChange,
}: {
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
        value={typeof answer === "string" ? answer : ""}
        disabled={disabled}
        answerState={feedback?.isCorrect ? "correct" : feedback ? "incorrect" : "idle"}
        onChange={onChange}
      />
      {feedback && !feedback.isCorrect && correctAnswers.length > 0 ? (
        <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          Đáp án đúng: {correctAnswers.join(" hoặc ")}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceButton({
  correct,
  disabled,
  hasFeedback,
  label,
  onClick,
  selected,
}: {
  correct: boolean;
  disabled: boolean;
  hasFeedback: boolean;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  const selectedWrong = hasFeedback && selected && !correct;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "student-mobile-border min-h-11 rounded-xl border px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-default",
        hasFeedback && correct
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-500/10 dark:text-emerald-300"
          : selectedWrong
            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-300"
            : selected
              ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/45 dark:bg-sky-500/10 dark:text-sky-300"
              : "border-slate-200 bg-slate-50/40 text-slate-600 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-500/45 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]",
      )}
    >
      {label}
    </button>
  );
}
