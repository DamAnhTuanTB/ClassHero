"use client";

import {
  Check,
  CircleHelp,
  FileQuestion,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import type {
  AdminQuizQuestion,
  AdminQuizSet,
} from "@/features/admin/quiz/api/admin-quiz-api";
import {
  useAdminQuizQuestionMutations,
  useAdminQuizQuestions,
  useAdminQuizSetMutations,
  useAdminQuizSets,
} from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getTiptapDocumentText } from "@/features/admin/quiz/utils/quiz-rich-content";
import { cn } from "@/lib/utils";

const AdminQuizQuestionEditorDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-question-editor-dialog").then(
      (module) => module.AdminQuizQuestionEditorDialog,
    ),
  { ssr: false },
);

interface AdminQuizTabProps {
  lessonId: string;
}

type DeleteTarget =
  | { type: "set"; id: string; label: string }
  | { type: "question"; id: string; label: string }
  | null;

export function AdminQuizTab({ lessonId }: AdminQuizTabProps) {
  const { data: quizSets, isLoading, isError } = useAdminQuizSets(lessonId);
  const { createSet, deleteSet } = useAdminQuizSetMutations(lessonId);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [editorQuestion, setEditorQuestion] = useState<AdminQuizQuestion | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const { deleteQuestion } = useAdminQuizQuestionMutations(selectedSetId, lessonId);

  useEffect(() => {
    if (!quizSets?.length) {
      setSelectedSetId("");
      return;
    }
    if (!quizSets.some((set) => set.id === selectedSetId)) {
      const firstSet = quizSets.at(0);
      if (firstSet) {
        setSelectedSetId(firstSet.id);
      }
    }
  }, [quizSets, selectedSetId]);

  const activeSet = useMemo(
    () => quizSets?.find((set) => set.id === selectedSetId) ?? null,
    [quizSets, selectedSetId],
  );

  const handleCreateSet = async () => {
    try {
      const createdSet = await createSet.mutateAsync({
        title: `Bộ câu hỏi ${(quizSets?.length ?? 0) + 1}`,
        difficulty: "MIXED",
      });
      setSelectedSetId(createdSet.id);
      toast.success("Đã tạo bộ câu hỏi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chưa tạo được bộ câu hỏi");
    }
  };

  if (isLoading) {
    return <QuizLoadingState />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] p-5 text-sm font-semibold text-[var(--theme-error-text)]">
        Không tải được danh sách bộ câu hỏi. Hãy thử tải lại trang.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Quản lý Quiz
          </h3>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            Mỗi tab là một bộ câu hỏi của buổi học.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateSet}
          disabled={createSet.isPending}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60"
        >
          {createSet.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          Thêm bộ câu hỏi
        </button>
      </div>

      {!quizSets?.length ? (
        <QuizEmptyState onCreate={handleCreateSet} isCreating={createSet.isPending} />
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Các bộ câu hỏi"
            className="flex gap-2 overflow-x-auto border-b border-[var(--theme-border)] pb-0"
          >
            {quizSets.map((set) => {
              const isActive = set.id === activeSet?.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`quiz-set-panel-${set.id}`}
                  onClick={() => setSelectedSetId(set.id)}
                  className={cn(
                    "relative inline-flex min-h-12 shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm font-extrabold transition",
                    isActive
                      ? "border-[var(--theme-primary)] bg-[var(--theme-bg)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]",
                  )}
                >
                  {set.title}
                  <span
                    className={cn(
                      "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-extrabold",
                      isActive
                        ? "bg-[var(--theme-primary)] text-white"
                        : "bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]",
                    )}
                  >
                    {set._count?.questions ?? set.questionCount}
                  </span>
                  {isActive ? (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--theme-primary)]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeSet ? (
            <QuizSetPanel
              activeSet={activeSet}
              onAddQuestion={() => {
                setEditorQuestion(null);
                setIsEditorOpen(true);
              }}
              onDeleteQuestion={(question) =>
                setDeleteTarget({
                  type: "question",
                  id: question.id,
                  label: getTiptapDocumentText(question.questionJson) || "câu hỏi này",
                })
              }
              onDeleteSet={() =>
                setDeleteTarget({
                  type: "set",
                  id: activeSet.id,
                  label: activeSet.title,
                })
              }
              onEditQuestion={(question) => {
                setEditorQuestion(question);
                setIsEditorOpen(true);
              }}
            />
          ) : null}

          {activeSet && isEditorOpen ? (
            <AdminQuizQuestionEditorDialog
              isOpen
              lessonId={lessonId}
              question={editorQuestion}
              setId={activeSet.id}
              onClose={() => {
                setIsEditorOpen(false);
                setEditorQuestion(null);
              }}
            />
          ) : null}
        </>
      )}

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        isConfirming={deleteSet.isPending || deleteQuestion.isPending}
        itemName={deleteTarget?.label ?? ""}
        title={deleteTarget?.type === "set" ? "Xóa bộ câu hỏi" : "Xóa câu hỏi"}
        description={
          deleteTarget?.type === "set"
            ? `Toàn bộ câu hỏi trong “${deleteTarget.label}” sẽ bị xóa. Hành động này không thể hoàn tác.`
            : "Câu hỏi và lời giải chi tiết đi kèm sẽ bị xóa khỏi bộ câu hỏi."
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === "set") {
              await deleteSet.mutateAsync(deleteTarget.id);
              toast.success("Đã xóa bộ câu hỏi");
            } else {
              await deleteQuestion.mutateAsync(deleteTarget.id);
              toast.success("Đã xóa câu hỏi");
            }
            setDeleteTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Chưa xóa được dữ liệu");
          }
        }}
      />
    </div>
  );
}

function QuizSetPanel({
  activeSet,
  onAddQuestion,
  onDeleteQuestion,
  onDeleteSet,
  onEditQuestion,
}: {
  activeSet: AdminQuizSet;
  onAddQuestion: () => void;
  onDeleteQuestion: (question: AdminQuizQuestion) => void;
  onDeleteSet: () => void;
  onEditQuestion: (question: AdminQuizQuestion) => void;
}) {
  const { data: questions, isLoading, isError } = useAdminQuizQuestions(activeSet.id);
  return (
    <section
      id={`quiz-set-panel-${activeSet.id}`}
      role="tabpanel"
      className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--theme-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              {activeSet.title}
            </h4>
            <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
              {difficultyLabel(activeSet.difficulty)}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            {questions?.length ?? activeSet._count.questions} câu hỏi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddQuestion}
            className="theme-button-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold sm:flex-none"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm câu hỏi
          </button>
          <button
            type="button"
            onClick={onDeleteSet}
            className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-lg"
            aria-label={`Xóa ${activeSet.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <QuizLoadingState />
      ) : isError ? (
        <div className="p-6 text-center text-sm font-semibold text-[var(--theme-error-text)]">
          Không tải được câu hỏi của bộ này.
        </div>
      ) : !questions?.length ? (
        <div className="m-5 flex flex-col items-center rounded-xl border-2 border-dashed border-[var(--theme-border)] px-4 py-10 text-center">
          <FileQuestion
            className="h-8 w-8 text-[var(--theme-text-muted)]"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
            Bộ này chưa có câu hỏi
          </p>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
            Tạo câu hỏi đầu tiên với đầy đủ đáp án, gợi ý và lời giải.
          </p>
          <button
            type="button"
            onClick={onAddQuestion}
            className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-extrabold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo câu hỏi đầu tiên
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--theme-border)]">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index}
              question={question}
              onDelete={() => onDeleteQuestion(question)}
              onEdit={() => onEditQuestion(question)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionCard({
  index,
  question,
  onDelete,
  onEdit,
}: {
  index: number;
  question: AdminQuizQuestion;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const correctAnswers = Array.isArray(question.correctAnswerJson)
    ? question.correctAnswerJson
    : [];
  const hint = getTiptapDocumentText(question.hintJson);
  const explanation = getTiptapDocumentText(question.explanation?.contentJson);

  return (
    <article className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-primary)]">
              Câu {index + 1}
            </span>
            <span className="rounded-full bg-[var(--theme-surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--theme-text-muted)]">
              {questionTypeLabel(question.questionType)}
            </span>
            <span className="rounded-full bg-[var(--theme-surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--theme-text-muted)]">
              {difficultyLabel(question.difficulty)}
            </span>
          </div>
          <h5 className="mt-2 whitespace-pre-wrap text-base font-extrabold leading-6 text-[var(--theme-text-strong)]">
            {getTiptapDocumentText(question.questionJson) || "Câu hỏi chưa có nội dung"}
          </h5>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
            aria-label={`Sửa câu ${index + 1}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-lg"
            aria-label={`Xóa câu ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {question.questionType === "MULTIPLE_CHOICE" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.optionsJson?.map((option, optionIndex) => {
            const isCorrect = correctAnswers.includes(option.id);
            return (
              <div
                key={option.id}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold",
                  isCorrect
                    ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
                    : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text)]",
                )}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-xs font-extrabold">
                  {isCorrect ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    answerOptionLabel(optionIndex)
                  )}
                </span>
                {getTiptapDocumentText(option.richText)}
              </div>
            );
          })}
        </div>
      ) : question.questionType === "TRUE_FALSE" ? (
        <div className="inline-flex rounded-lg border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] px-3 py-2 text-sm font-extrabold text-[var(--theme-success-text)]">
          Đáp án đúng: {question.correctAnswerJson ? "Đúng" : "Sai"}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
          <p className="text-xs font-bold text-[var(--theme-text-muted)]">
            Đáp án được chấp nhận
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--theme-text-strong)]">
            {correctAnswers.join(" · ")}
          </p>
        </div>
      )}

      {hint || explanation ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {hint ? (
            <div className="rounded-lg border border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] p-3">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[var(--theme-info-text)]">
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
                Gợi ý
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--theme-text)]">{hint}</p>
            </div>
          ) : null}
          {explanation ? (
            <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
              <p className="text-xs font-extrabold text-[var(--theme-text-muted)]">
                Lời giải chi tiết
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--theme-text)]">
                {explanation}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function QuizLoadingState() {
  return (
    <div className="flex min-h-32 items-center justify-center p-8">
      <Loader2
        className="h-6 w-6 animate-spin text-[var(--theme-primary)]"
        aria-label="Đang tải"
      />
    </div>
  );
}

function QuizEmptyState({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-12 text-center">
      <FileQuestion
        className="h-9 w-9 text-[var(--theme-text-muted)]"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
        Chưa có bộ câu hỏi nào
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tạo bộ câu hỏi đầu tiên
      </button>
    </div>
  );
}

function difficultyLabel(
  difficulty: AdminQuizSet["difficulty"] | AdminQuizQuestion["difficulty"],
) {
  return {
    EASY: "Dễ",
    MEDIUM: "Trung bình",
    HARD: "Khó",
    MIXED: "Hỗn hợp",
  }[difficulty];
}

function questionTypeLabel(type: AdminQuizQuestion["questionType"]) {
  return {
    MULTIPLE_CHOICE: "Trắc nghiệm",
    TRUE_FALSE: "Đúng / Sai",
    TEXT_INPUT: "Nhập đáp án",
  }[type];
}

function answerOptionLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
