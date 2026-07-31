"use client";

import {
  CircleHelp,
  Clock3,
  FileQuestion,
  Gauge,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import type {
  AdminMultiStatementAnswer,
  AdminQuizInitialData,
  AdminQuizQuestion,
  AdminQuizSet,
} from "@/features/admin/quiz/api/admin-quiz-api";
import {
  useAdminQuizQuestionMutations,
  useAdminQuizQuestions,
  useAdminQuizSetMutations,
  useAdminQuizSets,
} from "@/features/admin/quiz/hooks/use-admin-quiz";
import { QuizRichContentViewer } from "@/features/admin/quiz/components/quiz-rich-content-viewer";
import type {
  AdminTestQuestion,
  AdminTestSet,
} from "@/features/admin/tests/api/admin-tests-api";
import {
  useAdminTestQuestionMutations,
  useAdminTestQuestions,
  useAdminTestSetMutations,
  useAdminTestSets,
} from "@/features/admin/tests/hooks/use-admin-tests";
import { getTiptapDocumentText } from "@/lib/tiptap-rich-content";
import { getQueryRenderState } from "@/lib/query-render-state";
import { useRevealActiveHorizontalItem } from "@/lib/use-reveal-active-horizontal-item";
import { useStableTabPanelHeight } from "@/lib/use-stable-tab-panel-height";
import { cn } from "@/lib/utils";

const AdminAssessmentQuestionEditorDialog = dynamic(
  () =>
    import("@/features/admin/assessments/components/admin-assessment-question-editor-dialog").then(
      (module) => module.AdminAssessmentQuestionEditorDialog,
    ),
  { ssr: false },
);

const AdminQuizSetEditorDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-set-editor-dialog").then(
      (module) => module.AdminQuizSetEditorDialog,
    ),
  { ssr: false },
);

const AdminTestSetEditorDialog = dynamic(
  () =>
    import("@/features/admin/tests/screens/admin-tests-tab/components/admin-test-set-editor-dialog").then(
      (module) => module.AdminTestSetEditorDialog,
    ),
  { ssr: false },
);

interface AdminAssessmentTabProps {
  assessmentKind?: "quiz" | "test";
  initialQuizData?: AdminQuizInitialData;
  lessonId: string;
}

type DeleteTarget =
  | { type: "set"; id: string; label: string }
  | { type: "question"; id: string; label: string }
  | null;

export function AdminAssessmentTab({
  assessmentKind = "quiz",
  initialQuizData,
  lessonId,
}: AdminAssessmentTabProps) {
  const isTest = assessmentKind === "test";
  const quizSetsQuery = useAdminQuizSets(
    lessonId,
    !isTest,
    isTest ? undefined : initialQuizData?.sets,
  );
  const testSetsQuery = useAdminTestSets(lessonId, isTest);
  const quizSetMutations = useAdminQuizSetMutations(lessonId);
  const testSetMutations = useAdminTestSetMutations(lessonId);
  const setsQuery = isTest ? testSetsQuery : quizSetsQuery;
  const quizSets = setsQuery.data;
  const queryRenderState = getQueryRenderState(setsQuery);
  const copy = getAssessmentCopy(assessmentKind);
  const [selectedSetId, setSelectedSetId] = useState(
    isTest ? "" : (initialQuizData?.questionSetId ?? ""),
  );
  const [editorQuestion, setEditorQuestion] = useState<
    AdminQuizQuestion | AdminTestQuestion | null
  >(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSetEditorOpen, setIsSetEditorOpen] = useState(false);
  const [setEditorTarget, setSetEditorTarget] = useState<
    AdminQuizSet | AdminTestSet | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const quizQuestionMutations = useAdminQuizQuestionMutations(selectedSetId, lessonId);
  const testQuestionMutations = useAdminTestQuestionMutations(selectedSetId, lessonId);
  const {
    minHeight: quizSetPanelMinHeight,
    panelRef: quizSetPanelRef,
    preserveCurrentHeight: preserveQuizSetPanelHeight,
  } = useStableTabPanelHeight();
  const handleSelectQuizSet = useCallback(
    (setId: string) => {
      if (setId === selectedSetId) {
        return;
      }

      preserveQuizSetPanelHeight();
      setSelectedSetId(setId);
    },
    [preserveQuizSetPanelHeight, selectedSetId],
  );

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
  const {
    focusItem: focusQuizSetTab,
    scrollerRef: quizSetTabsRef,
    setItemRef: setQuizSetTabRef,
  } = useRevealActiveHorizontalItem(activeSet?.id);

  function handleQuizSetTabsKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (!quizSets?.length) {
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % quizSets.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + quizSets.length) % quizSets.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = quizSets.length - 1;
    }

    if (nextIndex === null) {
      return;
    }
    const nextSet = quizSets[nextIndex];
    if (!nextSet) {
      return;
    }

    event.preventDefault();
    handleSelectQuizSet(nextSet.id);
    focusQuizSetTab(nextSet.id);
  }

  const handleSaveSet = async ({
    difficulty,
    durationMinutes,
    title,
  }: {
    difficulty: AdminQuizSet["difficulty"];
    durationMinutes?: string;
    title: string;
  }) => {
    try {
      const savedSet = isTest
        ? setEditorTarget
          ? await testSetMutations.updateSet.mutateAsync({
              setId: setEditorTarget.id,
              data: {
                title,
                difficulty,
                durationSeconds: Number(durationMinutes) * 60,
              },
            })
          : await testSetMutations.createSet.mutateAsync({
              title,
              difficulty,
              durationSeconds: Number(durationMinutes) * 60,
            })
        : setEditorTarget
          ? await quizSetMutations.updateSet.mutateAsync({
              setId: setEditorTarget.id,
              data: { title, difficulty },
            })
          : await quizSetMutations.createSet.mutateAsync({
              title,
              difficulty,
            });
      handleSelectQuizSet(savedSet.id);
      setIsSetEditorOpen(false);
      setSetEditorTarget(null);
      toast.success(
        setEditorTarget ? `Đã cập nhật ${copy.setName}` : `Đã tạo ${copy.setName}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Chưa lưu được ${copy.setName}`,
      );
    }
  };

  if (queryRenderState === "loading") {
    return <QuizLoadingState />;
  }

  if (queryRenderState === "error") {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] p-5 text-center text-sm font-semibold text-[var(--theme-error-text)]">
        <p>Không tải được danh sách {copy.setNamePlural}. Hãy thử tải lại trang.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {copy.heading}
          </h3>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            {copy.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSetEditorTarget(null);
            setIsSetEditorOpen(true);
          }}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {copy.addSetLabel}
        </button>
      </div>

      {!quizSets?.length ? (
        <QuizEmptyState
          assessmentKind={assessmentKind}
          onCreate={() => {
            setSetEditorTarget(null);
            setIsSetEditorOpen(true);
          }}
        />
      ) : (
        <>
          <div
            ref={quizSetTabsRef}
            role="tablist"
            aria-label={`Các ${copy.setNamePlural}`}
            className="flex gap-2 overflow-x-auto overflow-y-hidden border-b border-[var(--theme-border)] pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {quizSets.map((set, setIndex) => {
              const isActive = set.id === activeSet?.id;
              return (
                <button
                  key={set.id}
                  ref={(element) => setQuizSetTabRef(set.id, element)}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${assessmentKind}-set-panel-${set.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleSelectQuizSet(set.id)}
                  onKeyDown={(event) => handleQuizSetTabsKeyDown(event, setIndex)}
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
                        ? "bg-[var(--theme-primary)] text-white dark:text-[var(--theme-primary-foreground)]"
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
              assessmentKind={assessmentKind}
              activeSet={activeSet}
              initialQuestions={
                !isTest && initialQuizData?.questionSetId === activeSet.id
                  ? initialQuizData.questions
                  : undefined
              }
              minHeight={quizSetPanelMinHeight}
              panelRef={quizSetPanelRef}
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
              onEditSet={() => {
                setSetEditorTarget(activeSet);
                setIsSetEditorOpen(true);
              }}
              onEditQuestion={(question) => {
                setEditorQuestion(question);
                setIsEditorOpen(true);
              }}
            />
          ) : null}

          {activeSet && isEditorOpen ? (
            <AdminAssessmentQuestionEditorDialog
              assessmentKind={assessmentKind}
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

      {isSetEditorOpen && isTest ? (
        <AdminTestSetEditorDialog
          defaultTitle={getNextSetTitle(quizSets, assessmentKind)}
          isOpen
          isSaving={
            testSetMutations.createSet.isPending || testSetMutations.updateSet.isPending
          }
          set={setEditorTarget as AdminTestSet | null}
          onClose={() => {
            setIsSetEditorOpen(false);
            setSetEditorTarget(null);
          }}
          onSubmit={handleSaveSet}
        />
      ) : null}

      {isSetEditorOpen && !isTest ? (
        <AdminQuizSetEditorDialog
          defaultTitle={getNextSetTitle(quizSets, assessmentKind)}
          isOpen
          isSaving={
            quizSetMutations.createSet.isPending || quizSetMutations.updateSet.isPending
          }
          set={setEditorTarget as AdminQuizSet | null}
          onClose={() => {
            setIsSetEditorOpen(false);
            setSetEditorTarget(null);
          }}
          onSubmit={handleSaveSet}
        />
      ) : null}

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        isConfirming={
          isTest
            ? testSetMutations.deleteSet.isPending ||
              testQuestionMutations.deleteQuestion.isPending
            : quizSetMutations.deleteSet.isPending ||
              quizQuestionMutations.deleteQuestion.isPending
        }
        itemName={deleteTarget?.label ?? ""}
        title={deleteTarget?.type === "set" ? copy.deleteSetTitle : "Xóa câu hỏi"}
        description={
          deleteTarget?.type === "set"
            ? `Toàn bộ câu hỏi trong “${deleteTarget.label}” sẽ bị xóa. Hành động này không thể hoàn tác.`
            : `Câu hỏi và lời giải chi tiết đi kèm sẽ bị xóa khỏi ${copy.setName}.`
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === "set") {
              if (isTest) {
                await testSetMutations.deleteSet.mutateAsync(deleteTarget.id);
              } else {
                await quizSetMutations.deleteSet.mutateAsync(deleteTarget.id);
              }
              toast.success(`Đã xóa ${copy.setName}`);
            } else {
              if (isTest) {
                await testQuestionMutations.deleteQuestion.mutateAsync(deleteTarget.id);
              } else {
                await quizQuestionMutations.deleteQuestion.mutateAsync(deleteTarget.id);
              }
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
  assessmentKind,
  activeSet,
  initialQuestions,
  minHeight,
  panelRef,
  onAddQuestion,
  onDeleteQuestion,
  onDeleteSet,
  onEditSet,
  onEditQuestion,
}: {
  assessmentKind: "quiz" | "test";
  activeSet: AdminQuizSet | AdminTestSet;
  initialQuestions?: AdminQuizQuestion[];
  minHeight: number;
  panelRef: Ref<HTMLElement>;
  onAddQuestion: () => void;
  onDeleteQuestion: (question: AdminQuizQuestion | AdminTestQuestion) => void;
  onDeleteSet: () => void;
  onEditSet: () => void;
  onEditQuestion: (question: AdminQuizQuestion | AdminTestQuestion) => void;
}) {
  const isTest = assessmentKind === "test";
  const quizQuestionsQuery = useAdminQuizQuestions(
    activeSet.id,
    !isTest,
    isTest ? undefined : initialQuestions,
  );
  const testQuestionsQuery = useAdminTestQuestions(activeSet.id, isTest);
  const questionsQuery = isTest ? testQuestionsQuery : quizQuestionsQuery;
  const questions = questionsQuery.data;
  const queryRenderState = getQueryRenderState(questionsQuery);
  return (
    <section
      ref={panelRef}
      id={`${assessmentKind}-set-panel-${activeSet.id}`}
      role="tabpanel"
      className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] shadow-sm"
      style={{ minHeight: minHeight || undefined }}
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
            {isTest ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDuration((activeSet as AdminTestSet).durationSeconds)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            {questions?.length ?? activeSet._count?.questions ?? activeSet.questionCount}{" "}
            câu hỏi
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-2 sm:flex">
          <button
            type="button"
            onClick={onAddQuestion}
            className="theme-button-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold sm:flex-none sm:px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm câu hỏi
          </button>
          <button
            type="button"
            onClick={onEditSet}
            className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
            aria-label={`Sửa ${activeSet.title}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
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

      {queryRenderState === "loading" ? (
        <QuizLoadingState />
      ) : queryRenderState === "error" ? (
        <div className="flex min-h-32 items-center justify-center p-6 text-center text-sm font-semibold text-[var(--theme-error-text)]">
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
  question: AdminQuizQuestion | AdminTestQuestion;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const correctAnswers = getStringAnswers(question.correctAnswerJson);
  const statementAnswerById = new Map(
    getMultiStatementAnswers(question.correctAnswerJson).map((answer) => [
      answer.statementId,
      answer.value,
    ]),
  );
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
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold",
                question.difficulty === "MEDIUM"
                  ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
                  : "border-transparent bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
              )}
            >
              {question.difficulty === "MEDIUM" ? (
                <Gauge className="size-3.5" aria-hidden="true" />
              ) : null}
              {difficultyLabel(question.difficulty)}
            </span>
          </div>
          <QuizRichContentViewer
            ariaLabel={`Nội dung câu ${index + 1}`}
            className="mt-2 text-base font-extrabold leading-6 text-[var(--theme-text-strong)]"
            content={question.questionJson}
            fallback="Câu hỏi chưa có nội dung"
          />
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
                  {answerOptionLabel(optionIndex)}
                </span>
                <QuizRichContentViewer
                  ariaLabel={`Nội dung đáp án ${answerOptionLabel(optionIndex)}`}
                  className="min-w-0 flex-1"
                  content={option.richText}
                />
              </div>
            );
          })}
        </div>
      ) : question.questionType === "TRUE_FALSE" ? (
        <div className="inline-flex gap-1 rounded-lg border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] px-3 py-2 text-sm text-[var(--theme-success-text)]">
          <span className="font-normal">Đáp án đúng:</span>
          <span className="font-extrabold">
            {question.correctAnswerJson ? "Đúng" : "Sai"}
          </span>
        </div>
      ) : question.questionType === "MULTI_STATEMENT_TRUE_FALSE" ? (
        <ul className="space-y-2">
          {question.optionsJson?.map((statement, statementIndex) => {
            const answer = statementAnswerById.get(statement.id) ?? false;
            return (
              <li
                key={statement.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2"
              >
                <div className="flex min-w-0 items-start gap-2 text-sm font-semibold text-[var(--theme-text)]">
                  <span className="shrink-0 font-extrabold text-[var(--theme-text-muted)]">
                    {statementIndex + 1}.
                  </span>
                  <QuizRichContentViewer
                    ariaLabel={`Nội dung mệnh đề ${statementIndex + 1}`}
                    className="min-w-0 flex-1 break-words"
                    content={statement.richText}
                  />
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-extrabold",
                    answer
                      ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
                      : "border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] text-[var(--theme-error-text)]",
                  )}
                >
                  {answer ? "Đúng" : "Sai"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] p-3">
          <p className="text-sm font-normal text-[var(--theme-success-text)]">
            Đáp án được chấp nhận
          </p>
          <ul className="mt-1 space-y-1 text-sm font-extrabold text-[var(--theme-success-text)]">
            {correctAnswers.map((answer, answerIndex) => (
              <li key={`${answerIndex}-${answer}`} className="break-words">
                {answer}
              </li>
            ))}
          </ul>
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
    <div
      aria-busy="true"
      aria-label="Đang tải bộ câu hỏi"
      className="min-h-64 animate-pulse space-y-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-44 rounded-full" />
          <SkeletonBlock className="h-4 w-72 max-w-full rounded-full opacity-70" />
        </div>
        <SkeletonBlock className="h-11 w-40 rounded-lg" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        <SkeletonBlock className="h-10 w-32 shrink-0 rounded-lg" />
        <SkeletonBlock className="h-10 w-32 shrink-0 rounded-lg" />
        <SkeletonBlock className="h-10 w-32 shrink-0 rounded-lg" />
      </div>
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-5">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-6 w-2/5 rounded-full" />
          <SkeletonBlock className="h-10 w-32 rounded-lg" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="mt-4 rounded-lg border border-[var(--theme-border)] p-4"
          >
            <SkeletonBlock className="h-4 w-3/4 rounded-full" />
            <SkeletonBlock className="mt-3 h-3.5 w-1/2 rounded-full opacity-70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizEmptyState({
  assessmentKind,
  onCreate,
}: {
  assessmentKind: "quiz" | "test";
  onCreate: () => void;
}) {
  const copy = getAssessmentCopy(assessmentKind);
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-12 text-center">
      <FileQuestion
        className="h-9 w-9 text-[var(--theme-text-muted)]"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
        Chưa có {copy.setName} nào
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {copy.createFirstSetLabel}
      </button>
    </div>
  );
}

function getNextSetTitle(
  quizSets: Array<AdminQuizSet | AdminTestSet> | undefined,
  assessmentKind: "quiz" | "test",
) {
  const prefix = assessmentKind === "test" ? "Bộ đề" : "Bộ câu hỏi";
  const latestNumber =
    quizSets?.reduce((highestNumber, quizSet) => {
      const match = new RegExp(`^${prefix}\\s+(\\d+)$`, "iu").exec(quizSet.title.trim());
      const currentNumber = match?.[1] ? Number.parseInt(match[1], 10) : 0;
      return Math.max(highestNumber, currentNumber);
    }, 0) ?? 0;

  return `${prefix} ${latestNumber + 1}`;
}

function difficultyLabel(
  difficulty:
    | AdminQuizSet["difficulty"]
    | AdminTestSet["difficulty"]
    | AdminQuizQuestion["difficulty"]
    | AdminTestQuestion["difficulty"],
) {
  return {
    EASY: "Dễ",
    MEDIUM: "Trung bình",
    HARD: "Khó",
    MIXED: "Hỗn hợp",
  }[difficulty];
}

function questionTypeLabel(
  type: AdminQuizQuestion["questionType"] | AdminTestQuestion["questionType"],
) {
  return {
    MULTIPLE_CHOICE: "Trắc nghiệm",
    TRUE_FALSE: "Đúng / Sai",
    MULTI_STATEMENT_TRUE_FALSE: "Đúng / Sai nhiều mệnh đề",
    TEXT_INPUT: "Nhập đáp án",
  }[type];
}

function getStringAnswers(
  correctAnswer: AdminQuizQuestion["correctAnswerJson"],
): string[] {
  return Array.isArray(correctAnswer) &&
    correctAnswer.every((answer): answer is string => typeof answer === "string")
    ? correctAnswer
    : [];
}

function getMultiStatementAnswers(
  correctAnswer: AdminQuizQuestion["correctAnswerJson"],
): AdminMultiStatementAnswer[] {
  return Array.isArray(correctAnswer) &&
    correctAnswer.every(
      (answer): answer is AdminMultiStatementAnswer =>
        typeof answer === "object" &&
        answer !== null &&
        "statementId" in answer &&
        typeof answer.statementId === "string" &&
        "value" in answer &&
        typeof answer.value === "boolean",
    )
    ? correctAnswer
    : [];
}

function getAssessmentCopy(assessmentKind: "quiz" | "test") {
  return assessmentKind === "test"
    ? {
        addSetLabel: "Thêm bộ đề",
        createFirstSetLabel: "Tạo bộ đề đầu tiên",
        deleteSetTitle: "Xóa bộ đề",
        description: "Mỗi tab là một bộ đề kiểm tra của buổi học.",
        heading: "Quản lý Bài kiểm tra",
        setName: "bộ đề",
        setNamePlural: "bộ đề",
      }
    : {
        addSetLabel: "Thêm bộ câu hỏi",
        createFirstSetLabel: "Tạo bộ câu hỏi đầu tiên",
        deleteSetTitle: "Xóa bộ câu hỏi",
        description: "Mỗi tab là một bộ câu hỏi của buổi học.",
        heading: "Quản lý Quiz",
        setName: "bộ câu hỏi",
        setNamePlural: "bộ câu hỏi",
      };
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${minutes} phút`;
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
