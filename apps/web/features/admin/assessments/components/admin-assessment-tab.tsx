"use client";

import {
  orderQuizQuestionsByType,
  QUIZ_QUESTION_TYPE_ORDER,
  type OrderedQuizQuestionType,
} from "@learning-path/shared";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coins,
  Clock3,
  Code2,
  Columns,
  FileQuestion,
  Gauge,
  LayoutTemplate,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  TextCursorInput,
  ToggleLeft,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { toast } from "sonner";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import {
  isQuizExplanationBlockData,
  QuizExplanationCard,
} from "@/components/common/content/quiz-explanation-content";
import { resolveQuizCorrectAnswerDisplay } from "@/components/common/content/quiz-explanation-content-normalizer";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import type {
  AdminMultiStatementAnswer,
  AdminQuizQuestion,
  AdminQuizSet,
} from "@/features/admin/quiz/api/admin-quiz-api";
import type {
  AdminAssessmentInitialData,
  AdminAssessmentKind,
  AdminAssessmentQuestion,
  AdminAssessmentSet,
} from "@/features/admin/assessments/types/admin-assessment.types";
import {
  useAdminAssessmentQuestionMutations,
  useAdminAssessmentQuestions,
  useAdminAssessmentSetMutations,
  useAdminAssessmentSets,
} from "@/features/admin/assessments/hooks/use-admin-assessment";
import { QuizRichContentViewer } from "@/features/admin/quiz/components/quiz-rich-content-viewer";
import { AdminQuizFigurePreview } from "@/features/admin/quiz/components/admin-quiz-figure-preview";
import { AdminQuizFigureStatusSummary } from "@/features/admin/quiz/components/admin-quiz-figure-status-summary";
import { AdminQuizQuestionFigureAiMenu } from "@/features/admin/quiz/components/admin-quiz-question-figure-ai-menu";
import {
  getTiptapDocumentText,
  removeTrailingOptionPeriod,
} from "@/lib/tiptap-rich-content";
import { getQueryRenderState } from "@/lib/query-render-state";
import { useRevealActiveHorizontalItem } from "@/lib/use-reveal-active-horizontal-item";
import { useStableTabPanelHeight } from "@/lib/use-stable-tab-panel-height";
import { cn } from "@/lib/utils";
import { AdminGeneratedSetReviewActions } from "@/features/admin/ai-generation/components/admin-generated-set-review-actions";
import {
  buildQuizQuestionPreviewFromGenerationJson,
  isProtectedQuizGenerationJsonEdit,
} from "@/features/admin/quiz/utils/quiz-generation-json";

const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

// Legacy names stay local during the screen extraction. Test transport is normalized
// before reaching this component, so neither alias imports the old Test feature.
type AdminTestSet = AdminAssessmentSet;
type AdminTestQuestion = AdminAssessmentQuestion;

const AdminAssessmentQuestionEditorDialog = dynamic(
  () =>
    import("@/features/admin/assessments/components/admin-assessment-question-editor-dialog").then(
      (module) => module.AdminAssessmentQuestionEditorDialog,
    ),
  { ssr: false },
);

const AdminAssessmentSetEditorDialog = dynamic(
  () =>
    import("@/features/admin/assessments/components/admin-assessment-set-editor-dialog").then(
      (module) => module.AdminAssessmentSetEditorDialog,
    ),
  { ssr: false },
);

const AdminQuizSolutionRefinementDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-solution-refinement-dialog").then(
      (module) => module.AdminQuizSolutionRefinementDialog,
    ),
  { ssr: false },
);

const AdminQuizGenerationHistoryDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-generation-history-dialog").then(
      (module) => module.AdminQuizGenerationHistoryDialog,
    ),
  { ssr: false },
);

interface AdminAssessmentTabProps {
  assessmentKind?: AdminAssessmentKind;
  initialQuizData?: AdminAssessmentInitialData;
  lessonId: string;
  onSelectedSetIdChange?: (setId: string | undefined) => void;
  preferredSetId?: string;
}

type DeleteTarget =
  | { type: "set"; id: string; label: string }
  | { type: "question"; id: string; label: string }
  | null;

type QuizQuestionViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";

const approvedQuizQuestionRowLabels: Record<OrderedQuizQuestionType, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng / Sai 1 mệnh đề",
  MULTI_STATEMENT_TRUE_FALSE: "Đúng / Sai nhiều mệnh đề",
  TEXT_INPUT: "Nhập đáp án",
};

const approvedQuizQuestionRowIcons: Record<OrderedQuizQuestionType, LucideIcon> = {
  MULTIPLE_CHOICE: ListChecks,
  TRUE_FALSE: ToggleLeft,
  MULTI_STATEMENT_TRUE_FALSE: Columns,
  TEXT_INPUT: TextCursorInput,
};

export function AdminAssessmentTab({
  assessmentKind = "quiz",
  initialQuizData,
  lessonId,
  onSelectedSetIdChange,
  preferredSetId,
}: AdminAssessmentTabProps) {
  const isTest = assessmentKind === "test";
  const setsQuery = useAdminAssessmentSets(
    assessmentKind,
    lessonId,
    true,
    initialQuizData?.sets,
  );
  const setMutations = useAdminAssessmentSetMutations(assessmentKind, lessonId);
  const quizSets = setsQuery.data;
  const queryRenderState = getQueryRenderState(setsQuery);
  const copy = getAssessmentCopy(assessmentKind);
  const [selectedSetId, setSelectedSetId] = useState(
    isTest ? "" : (initialQuizData?.questionSetId ?? ""),
  );
  const appliedPreferredSetIdRef = useRef<string | null>(null);
  const [editorQuestion, setEditorQuestion] = useState<AdminAssessmentQuestion | null>(
    null,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSetEditorOpen, setIsSetEditorOpen] = useState(false);
  const [setEditorTarget, setSetEditorTarget] = useState<AdminAssessmentSet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const questionMutations = useAdminAssessmentQuestionMutations(
    assessmentKind,
    selectedSetId,
    lessonId,
  );
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
      onSelectedSetIdChange?.(setId);
    },
    [onSelectedSetIdChange, preserveQuizSetPanelHeight, selectedSetId],
  );

  useEffect(() => {
    if (!quizSets?.length) {
      setSelectedSetId("");
      onSelectedSetIdChange?.(undefined);
      return;
    }
    if (!quizSets.some((set) => set.id === selectedSetId)) {
      const firstSet = quizSets.at(0);
      if (firstSet) {
        setSelectedSetId(firstSet.id);
        onSelectedSetIdChange?.(firstSet.id);
      }
    }
  }, [onSelectedSetIdChange, quizSets, selectedSetId]);

  useEffect(() => {
    if (
      !preferredSetId ||
      appliedPreferredSetIdRef.current === preferredSetId ||
      !quizSets?.some((set) => set.id === preferredSetId)
    ) {
      return;
    }
    appliedPreferredSetIdRef.current = preferredSetId;
    handleSelectQuizSet(preferredSetId);
  }, [handleSelectQuizSet, preferredSetId, quizSets]);

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

  const handleSaveSet = async (values: { durationMinutes?: string; title: string }) => {
    try {
      if (isTest && !values.durationMinutes) {
        throw new Error("Test set form is missing required values");
      }
      const data = {
        title: values.title,
        ...(isTest ? { durationSeconds: Number(values.durationMinutes) * 60 } : {}),
      };
      const savedSet = setEditorTarget
        ? await setMutations.updateSet.mutateAsync({ setId: setEditorTarget.id, data })
        : await setMutations.createSet.mutateAsync(data);
      handleSelectQuizSet(savedSet.id);
      setIsSetEditorOpen(false);
      setSetEditorTarget(null);
      toast.success(
        setEditorTarget ? `Đã cập nhật ${copy.setName}` : `Đã tạo ${copy.setName}`,
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          `Chưa lưu được ${copy.setName}. Vui lòng thử lại.`,
        ),
      );
    }
  };

  const handleReviewQuestion = async (
    question: AdminAssessmentQuestion,
    reviewStatus: "APPROVED" | "NEEDS_REVIEW",
  ) => {
    try {
      await questionMutations.reviewQuestion.mutateAsync({
        questionId: question.id,
        reviewStatus,
      });
      toast.success(
        reviewStatus === "APPROVED" ? "Đã duyệt câu hỏi" : "Đã hủy duyệt câu hỏi",
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          reviewStatus === "APPROVED"
            ? "Chưa duyệt được câu hỏi. Vui lòng thử lại."
            : "Chưa hủy duyệt được câu hỏi. Vui lòng thử lại.",
        ),
      );
    }
  };

  const handleReviewAllQuizQuestions = async () => {
    try {
      const result = await questionMutations.reviewAllQuestions.mutateAsync();
      toast.success(
        result.approvedQuestionCount > 0
          ? `Đã duyệt ${result.approvedQuestionCount} câu hỏi AI`
          : "Không còn câu AI chờ duyệt",
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa duyệt được tất cả câu hỏi AI. Vui lòng thử lại.",
        ),
      );
    }
  };

  if (queryRenderState === "loading") {
    return <QuizLoadingState />;
  }

  if (queryRenderState === "error") {
    return (
      <AdminDataErrorState
        description={`Vui lòng thử lại để tiếp tục quản lý ${copy.setNamePlural}.`}
        headingLevel={3}
        isRetrying={setsQuery.isFetching}
        onRetry={() => setsQuery.refetch()}
        title={`Không tải được danh sách ${copy.setNamePlural}`}
        variant="section"
      />
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
              const totalQuestionCount = set._count?.questions ?? set.questionCount ?? 0;
              const isPublished = set.reviewStatus === "APPROVED";
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
                    "relative inline-flex min-h-16 shrink-0 items-center gap-3 rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-extrabold transition",
                    isActive
                      ? "border-[var(--theme-primary)] bg-[var(--theme-bg)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]",
                  )}
                >
                  <span className="flex min-w-0 flex-col items-center gap-1 text-center">
                    <span className="whitespace-nowrap leading-none">{set.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-extrabold leading-none",
                        isPublished
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                          : "bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
                      )}
                    >
                      {isPublished
                        ? `Đã phát hành - ${totalQuestionCount} câu hỏi`
                        : "Chưa phát hành"}
                    </span>
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
              lessonId={lessonId}
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
                setEditorQuestion(question as AdminAssessmentQuestion);
                setIsEditorOpen(true);
              }}
              onReviewQuestion={(question, reviewStatus) =>
                void handleReviewQuestion(
                  question as AdminAssessmentQuestion,
                  reviewStatus,
                )
              }
              onReviewAllQuestions={() => void handleReviewAllQuizQuestions()}
              onSaveGenerationJson={async (questionId, generationQuestionJson) => {
                await questionMutations.updateGenerationJson.mutateAsync({
                  questionId,
                  generationQuestionJson,
                });
              }}
              isSavingGenerationJson={questionMutations.updateGenerationJson.isPending}
              isReviewingAllQuestions={questionMutations.reviewAllQuestions.isPending}
              reviewingQuestionId={
                questionMutations.reviewQuestion.isPending
                  ? questionMutations.reviewQuestion.variables?.questionId
                  : undefined
              }
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

      {isSetEditorOpen ? (
        <AdminAssessmentSetEditorDialog
          defaultTitle={getNextSetTitle(quizSets, assessmentKind)}
          isOpen
          isSaving={setMutations.createSet.isPending || setMutations.updateSet.isPending}
          kind={assessmentKind}
          set={setEditorTarget}
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
          setMutations.deleteSet.isPending || questionMutations.deleteQuestion.isPending
        }
        itemName={deleteTarget?.label ?? ""}
        title={deleteTarget?.type === "set" ? copy.deleteSetTitle : "Xóa câu hỏi"}
        description={
          deleteTarget?.type === "set"
            ? isTest
              ? `Toàn bộ câu hỏi trong “${deleteTarget.label}” sẽ bị xóa. Hành động này không thể hoàn tác.`
              : `“${deleteTarget.label}”, toàn bộ câu hỏi, lời giải, hình và lịch sử làm bài liên quan sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.`
            : `Câu hỏi và lời giải chi tiết đi kèm sẽ bị xóa khỏi ${copy.setName}.`
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === "set") {
              await setMutations.deleteSet.mutateAsync(deleteTarget.id);
              toast.success(`Đã xóa ${copy.setName}`);
            } else {
              await questionMutations.deleteQuestion.mutateAsync(deleteTarget.id);
              toast.success("Đã xóa câu hỏi");
            }
            setDeleteTarget(null);
          } catch (error) {
            toast.error(
              getUserFacingErrorMessage(
                error,
                "Chưa xóa được dữ liệu. Vui lòng thử lại.",
              ),
            );
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
  lessonId,
  minHeight,
  panelRef,
  onAddQuestion,
  onDeleteQuestion,
  onDeleteSet,
  onEditSet,
  onEditQuestion,
  onReviewQuestion,
  onReviewAllQuestions,
  onSaveGenerationJson,
  isSavingGenerationJson,
  isReviewingAllQuestions,
  reviewingQuestionId,
}: {
  assessmentKind: "quiz" | "test";
  activeSet: AdminAssessmentSet;
  initialQuestions?: AdminQuizQuestion[];
  lessonId: string;
  minHeight: number;
  panelRef: Ref<HTMLElement>;
  onAddQuestion: () => void;
  onDeleteQuestion: (question: AdminQuizQuestion | AdminTestQuestion) => void;
  onDeleteSet: () => void;
  onEditSet: () => void;
  onEditQuestion: (question: AdminQuizQuestion | AdminTestQuestion) => void;
  onReviewQuestion: (
    question: AdminQuizQuestion | AdminTestQuestion,
    reviewStatus: "APPROVED" | "NEEDS_REVIEW",
  ) => void;
  onReviewAllQuestions: () => void;
  onSaveGenerationJson: (
    questionId: string,
    generationQuestionJson: Record<string, unknown>,
  ) => Promise<void>;
  isSavingGenerationJson: boolean;
  isReviewingAllQuestions: boolean;
  reviewingQuestionId?: string;
}) {
  const isTest = assessmentKind === "test";
  const questionsQuery = useAdminAssessmentQuestions(
    assessmentKind,
    activeSet.id,
    true,
    isTest
      ? undefined
      : initialQuestions?.map((question) => ({ ...question, setId: question.quizSetId })),
  );
  const questions = questionsQuery.data;
  const queryRenderState = getQueryRenderState(questionsQuery);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [questionNavigationTargetId, setQuestionNavigationTargetId] = useState<
    string | null
  >(null);
  const [isGenerationHistoryOpen, setIsGenerationHistoryOpen] = useState(false);
  const [questionViewMode, setQuestionViewMode] =
    useState<QuizQuestionViewMode>("UI_ONLY");
  const [jsonViewState, setJsonViewState] = useState<{
    collapsed: boolean | number;
    revision: number;
  }>({
    collapsed: false,
    revision: 0,
  });
  const quizQuestionNavigation = useMemo(() => {
    const quizQuestions = (questions ?? []) as unknown as AdminQuizQuestion[];
    const pendingQuestions = orderQuizQuestionsByType(
      quizQuestions.filter((question) => question.reviewStatus === "NEEDS_REVIEW"),
    );
    const approvedQuestions = orderQuizQuestionsByType(
      quizQuestions.filter((question) => question.reviewStatus === "APPROVED"),
    );
    const pendingRows = QUIZ_QUESTION_TYPE_ORDER.flatMap((type) => {
      const questionsForType = pendingQuestions.filter(
        (question) => question.questionType === type,
      );

      return questionsForType.length > 0
        ? [
            {
              id: `pending-ai-${type}`,
              icon: approvedQuizQuestionRowIcons[type],
              label: approvedQuizQuestionRowLabels[type],
              questions: questionsForType,
              isPendingAi: true,
              type,
            },
          ]
        : [];
    });
    const rows = [
      ...pendingRows,
      ...QUIZ_QUESTION_TYPE_ORDER.map((type) => ({
        id: type,
        icon: approvedQuizQuestionRowIcons[type],
        label: approvedQuizQuestionRowLabels[type],
        questions: approvedQuestions.filter((question) => question.questionType === type),
        isPendingAi: false,
        type,
      })),
    ];

    return {
      approvedQuestions,
      navigableQuestions: [...pendingQuestions, ...approvedQuestions],
      pendingQuestions,
      rows,
    };
  }, [questions]);
  const selectedQuestionIndex =
    questions?.findIndex((question) => question.id === selectedQuestionId) ?? -1;
  const selectedQuestion =
    selectedQuestionIndex >= 0 ? questions?.[selectedQuestionIndex] : undefined;
  const selectedQuizQuestion = selectedQuestion as AdminQuizQuestion | undefined;
  const selectedApprovedQuestionIndex =
    quizQuestionNavigation.approvedQuestions.findIndex(
      (question) => question.id === selectedQuestionId,
    );
  const selectedPendingQuestionIndex = quizQuestionNavigation.pendingQuestions.findIndex(
    (question) => question.id === selectedQuestionId,
  );
  const selectedQuestionDisplayIndex =
    selectedApprovedQuestionIndex >= 0
      ? selectedApprovedQuestionIndex
      : selectedPendingQuestionIndex >= 0
        ? selectedPendingQuestionIndex
        : selectedQuestionIndex;
  const isAiGeneratedQuestion = Boolean(
    selectedQuizQuestion?.sourceMetadataJson?.aiGenerationId,
  );
  const persistedQuestionReviewJson =
    selectedQuizQuestion?.generationQuestionJson ?? null;
  const [questionReviewJson, setQuestionReviewJson] = useState<Record<
    string,
    unknown
  > | null>(null);
  const hasGenerationJsonChanges = Boolean(
    questionReviewJson &&
    persistedQuestionReviewJson &&
    JSON.stringify(questionReviewJson) !== JSON.stringify(persistedQuestionReviewJson),
  );
  const previewQuizQuestion =
    selectedQuizQuestion && questionReviewJson
      ? buildQuizQuestionPreviewFromGenerationJson(
          selectedQuizQuestion,
          questionReviewJson,
        )
      : selectedQuizQuestion;
  const selectedGenerationIssues = getSelectedQuizGenerationIssues(
    activeSet as AdminQuizSet,
    (questions ?? []) as unknown as AdminQuizQuestion[],
    selectedQuizQuestion,
  );
  const {
    focusItem: focusQuestionNumber,
    scrollerRef: questionNumbersRef,
    setItemRef: setQuestionNumberRef,
  } = useRevealActiveHorizontalItem(selectedQuestionId);

  useEffect(() => {
    setSelectedQuestionId((currentQuestionId) =>
      quizQuestionNavigation.navigableQuestions.some(
        (question) => question.id === currentQuestionId,
      )
        ? currentQuestionId
        : (quizQuestionNavigation.navigableQuestions.at(0)?.id ?? ""),
    );
  }, [activeSet.id, quizQuestionNavigation.navigableQuestions]);

  useEffect(() => {
    setQuestionReviewJson(
      persistedQuestionReviewJson ? structuredClone(persistedQuestionReviewJson) : null,
    );
  }, [persistedQuestionReviewJson, selectedQuestionId]);

  useEffect(() => {
    if (
      !questionNavigationTargetId ||
      selectedQuestionId !== questionNavigationTargetId
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      focusQuestionNumber(questionNavigationTargetId);
      const target =
        document.getElementById(`quiz-question-${questionNavigationTargetId}`) ??
        document.getElementById(`${assessmentKind}-set-panel-${activeSet.id}`);
      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setQuestionNavigationTargetId(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    activeSet.id,
    assessmentKind,
    focusQuestionNumber,
    questionNavigationTargetId,
    selectedQuestionId,
  ]);

  useEffect(() => {
    const savedMode = localStorage.getItem("admin-ai-quiz-question-view-mode");
    if (savedMode === "UI_ONLY" || savedMode === "JSON_ONLY" || savedMode === "SPLIT") {
      setQuestionViewMode(savedMode);
    }
  }, []);

  const handleSetQuestionViewMode = (mode: QuizQuestionViewMode) => {
    setQuestionViewMode(mode);
    localStorage.setItem("admin-ai-quiz-question-view-mode", mode);
  };

  const resetJsonView = (collapsed: boolean | number) => {
    setJsonViewState((current) => ({
      collapsed,
      revision: current.revision + 1,
    }));
  };

  function handleQuestionNumbersKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    const navigationQuestions = quizQuestionNavigation.navigableQuestions;
    if (!navigationQuestions.length) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % navigationQuestions.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + navigationQuestions.length) % navigationQuestions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = navigationQuestions.length - 1;
    }
    if (nextIndex === null) return;

    const nextQuestion = navigationQuestions[nextIndex];
    if (!nextQuestion) return;
    event.preventDefault();
    setSelectedQuestionId(nextQuestion.id);
    focusQuestionNumber(nextQuestion.id);
  }

  const selectRelativeQuizQuestion = useCallback(
    (offset: -1 | 1) => {
      const navigationQuestions = quizQuestionNavigation.navigableQuestions;
      if (navigationQuestions.length <= 1) return false;
      const currentIndex = navigationQuestions.findIndex(
        (question) => question.id === selectedQuestionId,
      );
      if (currentIndex < 0) return false;
      const nextIndex =
        (currentIndex + offset + navigationQuestions.length) % navigationQuestions.length;
      const nextQuestion = navigationQuestions[nextIndex];
      if (!nextQuestion) return false;

      const scrollPosition = {
        left: window.scrollX,
        top: window.scrollY,
      };
      setSelectedQuestionId(nextQuestion.id);
      requestAnimationFrame(() => {
        window.scrollTo({
          ...scrollPosition,
          behavior: "auto",
        });
      });
      return true;
    },
    [quizQuestionNavigation.navigableQuestions, selectedQuestionId],
  );

  useEffect(() => {
    function handleQuizShortcut(event: globalThis.KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== "Enter" &&
          event.key !== "ArrowLeft" &&
          event.key !== "ArrowRight") ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      ) {
        return;
      }

      if (event.key === "Enter") {
        const canReviewSelectedQuestion =
          selectedQuizQuestion?.reviewStatus !== "APPROVED" &&
          Boolean(selectedQuizQuestion?.sourceMetadataJson?.aiGenerationId) &&
          reviewingQuestionId !== selectedQuizQuestion?.id;
        if (
          !selectedQuizQuestion ||
          !canReviewSelectedQuestion ||
          isQuestionReviewShortcutTarget(event.target)
        ) {
          return;
        }

        event.preventDefault();
        onReviewQuestion(selectedQuizQuestion, "APPROVED");
        return;
      }

      if (isQuestionNavigationShortcutTarget(event.target)) return;

      const didNavigate = selectRelativeQuizQuestion(event.key === "ArrowLeft" ? -1 : 1);
      if (didNavigate) event.preventDefault();
    }

    window.addEventListener("keydown", handleQuizShortcut);
    return () => window.removeEventListener("keydown", handleQuizShortcut);
  }, [
    onReviewQuestion,
    reviewingQuestionId,
    selectedQuizQuestion,
    selectRelativeQuizQuestion,
  ]);

  const unpublishedApprovedQuestionCount =
    activeSet.unpublishedApprovedQuestionCount ?? 0;
  const quizDifficultyCounts = (
    (questions ?? []) as unknown as AdminQuizQuestion[]
  ).reduce(
    (counts, question) => {
      counts[question.difficulty] += 1;
      return counts;
    },
    { EASY: 0, HARD: 0, MEDIUM: 0 },
  );

  function navigateToQuizQuestion(questionId: string) {
    setQuestionNavigationTargetId(questionId);
    setSelectedQuestionId(questionId);
  }

  const setSummary = (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--theme-border)] bg-white p-4 shadow-sm dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {activeSet.title}
          </h4>
          {isTest ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDuration(activeSet.durationSeconds ?? 0)}
              </span>
            </>
          ) : null}
          <>
            <>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setIsGenerationHistoryOpen(true)}
                className="-m-1 inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md p-1 text-sm font-extrabold text-[var(--theme-text-muted)] transition-colors hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                title={`Xem toàn bộ lịch sử dùng AI và chi phí của bộ ${isTest ? "Test" : "Quiz"}`}
              >
                <Coins className="size-4" aria-hidden="true" />
                Tổng chi phí: {formatQuizGenerationCost(activeSet as AdminQuizSet)}
              </button>
              {questions ? (
                <AdminQuizFigureStatusSummary
                  assessmentKind={assessmentKind}
                  approvedQuestions={quizQuestionNavigation.approvedQuestions}
                  onNavigateToQuestion={navigateToQuizQuestion}
                  pendingQuestions={quizQuestionNavigation.pendingQuestions}
                  setId={activeSet.id}
                />
              ) : null}
            </>
          </>
        </div>
        <>
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label={`Thống kê bộ ${isTest ? "Test" : "Quiz"}`}
          >
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 text-xs font-bold text-[var(--theme-text-muted)]">
              <FileQuestion className="size-4 text-slate-500" aria-hidden="true" />
              Tổng câu
              <strong className="text-sm font-black text-[var(--theme-text-strong)]">
                {questions?.length ??
                  activeSet._count?.questions ??
                  activeSet.questionCount}
              </strong>
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-300">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Đã duyệt
              <strong className="text-sm font-black">
                {quizQuestionNavigation.approvedQuestions.length}
              </strong>
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-300">
              <CircleHelp className="size-4" aria-hidden="true" />
              Chờ duyệt
              <strong className="text-sm font-black">
                {quizQuestionNavigation.pendingQuestions.length}
              </strong>
            </span>
          </div>
          <div
            className="mt-2 flex flex-wrap items-center gap-2"
            aria-label={`Thống kê mức độ ${isTest ? "Test" : "Quiz"}`}
          >
            <span className="inline-flex min-h-8 items-center gap-1.5 pr-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
              <Gauge className="size-4" aria-hidden="true" />
              Mức độ
            </span>
            {(
              [
                ["EASY", "Dễ"],
                ["MEDIUM", "Trung bình"],
                ["HARD", "Khó"],
              ] as const
            ).map(([difficulty, label]) => (
              <span
                key={difficulty}
                className={cn(
                  "inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 text-xs font-extrabold",
                  questionDifficultyBadgeClassName(difficulty),
                )}
              >
                {label}
                <strong className="text-sm font-black">
                  {quizDifficultyCounts[difficulty]}
                </strong>
              </span>
            ))}
          </div>
        </>
        <AdminGeneratedSetReviewActions
          approvedQuestionCount={quizQuestionNavigation.approvedQuestions.length}
          isReviewingAllPending={isReviewingAllQuestions}
          lessonId={lessonId}
          onReviewAllPending={onReviewAllQuestions}
          pendingReviewQuestionCount={
            activeSet.pendingReviewQuestionCount ??
            quizQuestionNavigation.pendingQuestions.length
          }
          reviewStatus={activeSet.reviewStatus}
          setId={activeSet.id}
          source={activeSet.source}
          type={isTest ? "TEST" : "QUIZ"}
        />
        {unpublishedApprovedQuestionCount > 0 ? (
          <div
            className="relative mt-3 flex max-w-xl items-start gap-3 overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-blue-50/70 to-white px-4 py-3 text-sky-950 shadow-sm dark:border-sky-800/80 dark:from-sky-950/70 dark:via-blue-950/50 dark:to-slate-950 dark:text-sky-100"
            aria-live="polite"
            data-testid="quiz-unsaved-approved-warning"
            role="status"
          >
            <span
              className="absolute inset-y-0 left-0 w-1 bg-sky-500 dark:bg-sky-400"
              aria-hidden="true"
            />
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950">
              <Save className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-black text-sky-800 dark:text-sky-200">
                Có thay đổi chưa lưu
              </span>
              <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                Bạn đã duyệt thêm {unpublishedApprovedQuestionCount} câu. Nhớ nhấn{" "}
                <strong className="rounded bg-sky-100 px-1.5 py-0.5 font-black text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                  Lưu
                </strong>{" "}
                để cập nhật vào lượt phát hành gần nhất cho học sinh.
              </span>
            </span>
          </div>
        ) : null}
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
  );

  return (
    <div className="space-y-3">
      {setSummary}

      {quizQuestionNavigation.navigableQuestions.length > 0 &&
      selectedQuestionIndex >= 0 ? (
        <div className="grid gap-2">
          {quizQuestionNavigation.pendingQuestions.length > 0 ? (
            <div
              className="flex w-fit items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200"
              data-testid="quiz-pending-ai-heading"
            >
              <CircleHelp className="size-4" aria-hidden="true" />
              <span>Chờ duyệt</span>
              <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                {quizQuestionNavigation.pendingQuestions.length}
              </span>
            </div>
          ) : null}
          <div
            ref={questionNumbersRef}
            role="tablist"
            aria-label={`Chọn câu hỏi ${isTest ? "Test" : "Quiz"}`}
            className="min-w-0 py-0.5"
          >
            <div className="grid min-w-0 gap-2">
              {quizQuestionNavigation.rows.map((row, rowIndex) => {
                const isPendingAiRow = row.isPendingAi === true;
                const shouldRenderApprovedHeading =
                  !isPendingAiRow &&
                  (rowIndex === 0 ||
                    quizQuestionNavigation.rows[rowIndex - 1]?.isPendingAi === true);
                const RowIcon = row.icon;

                return (
                  <Fragment key={row.id}>
                    {shouldRenderApprovedHeading ? (
                      <div
                        className="flex w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200"
                        data-testid="quiz-approved-heading"
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        <span>Đã duyệt</span>
                        <span className="rounded-full bg-emerald-200/70 px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
                          {quizQuestionNavigation.approvedQuestions.length}
                        </span>
                      </div>
                    ) : null}
                    <div
                      role="group"
                      aria-label={row.label}
                      data-testid={`quiz-question-navigation-${row.id}`}
                      className="grid min-w-0 grid-cols-1 items-start gap-2 sm:grid-cols-[11.5rem_minmax(0,1fr)]"
                    >
                      <div
                        className={cn(
                          "relative flex min-h-14 items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-1.5 shadow-sm",
                          isPendingAiRow
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200"
                            : "border-[var(--theme-border)] bg-white text-[var(--theme-text-strong)] dark:bg-slate-950",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute inset-y-2 left-0 w-1 rounded-r-full",
                            isPendingAiRow
                              ? "bg-amber-400 dark:bg-amber-500"
                              : "bg-sky-400 dark:bg-sky-500",
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-lg",
                            isPendingAiRow
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                          )}
                        >
                          <RowIcon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 text-xs font-extrabold leading-snug">
                          {row.label}
                        </span>
                        <span
                          className={cn(
                            "grid min-w-6 shrink-0 place-items-center rounded-full px-1.5 py-1 text-[10px] font-black leading-none tabular-nums",
                            isPendingAiRow
                              ? "bg-amber-200/70 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                              : "bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
                          )}
                          aria-label={`${row.questions.length} câu`}
                        >
                          {row.questions.length}
                        </span>
                      </div>
                      <div className="flex min-h-14 min-w-0 flex-wrap items-center gap-1.5">
                        {row.questions.length === 0 ? (
                          <span className="text-xs font-medium italic text-[var(--theme-text-muted)]">
                            Chưa có câu
                          </span>
                        ) : (
                          row.questions.map((question) => {
                            const isSelected = question.id === selectedQuestionId;
                            const isAiGenerated = Boolean(
                              question.sourceMetadataJson?.aiGenerationId,
                            );
                            const approvedIndex =
                              quizQuestionNavigation.approvedQuestions.findIndex(
                                (item) => item.id === question.id,
                              );
                            const pendingIndex =
                              quizQuestionNavigation.pendingQuestions.findIndex(
                                (item) => item.id === question.id,
                              );
                            const displayNumber =
                              approvedIndex >= 0 ? approvedIndex + 1 : pendingIndex + 1;
                            const navigationIndex =
                              quizQuestionNavigation.navigableQuestions.findIndex(
                                (item) => item.id === question.id,
                              );
                            return (
                              <button
                                key={question.id}
                                ref={(element) =>
                                  setQuestionNumberRef(question.id, element)
                                }
                                type="button"
                                role="tab"
                                aria-controls={`quiz-question-${question.id}`}
                                aria-label={`Xem câu ${displayNumber}, ${row.label}, mức độ ${difficultyLabel(question.difficulty)}${isAiGenerated ? ", do AI tạo" : ""}`}
                                aria-selected={isSelected}
                                tabIndex={isSelected ? 0 : -1}
                                onClick={() => setSelectedQuestionId(question.id)}
                                onKeyDown={(event) =>
                                  handleQuestionNumbersKeyDown(event, navigationIndex)
                                }
                                className={cn(
                                  "relative flex min-h-14 w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 font-extrabold transition",
                                  isSelected
                                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white shadow-sm dark:text-[var(--theme-primary-foreground)]"
                                    : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-muted)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]",
                                )}
                              >
                                {isAiGenerated ? (
                                  <span
                                    title="Câu do AI tạo"
                                    className={cn(
                                      "absolute right-1 top-1 grid size-[1.125rem] place-items-center rounded-full",
                                      isSelected
                                        ? "bg-white/20 text-white dark:text-[var(--theme-primary-foreground)]"
                                        : "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
                                    )}
                                  >
                                    <Sparkles className="size-2.5" aria-hidden="true" />
                                  </span>
                                ) : null}
                                <span className="text-sm leading-none">
                                  {displayNumber}
                                </span>
                                <span
                                  className={cn(
                                    "whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none tracking-wide",
                                    questionDifficultyBadgeClassName(question.difficulty),
                                  )}
                                >
                                  {difficultyLabel(question.difficulty)}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {selectedGenerationIssues.length > 0 && selectedQuizQuestion ? (
            <div
              aria-label="Cảnh báo cần admin kiểm tra"
              className="flex flex-col gap-3 rounded-xl border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-3 text-[var(--theme-warning-text)] sm:flex-row sm:items-start sm:justify-between"
              data-testid="quiz-generation-review-warning"
              role="region"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Cần admin kiểm tra
                </div>
                <ul className="mt-2 space-y-1 pl-5 text-sm font-medium [list-style:disc]">
                  {selectedGenerationIssues.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled={reviewingQuestionId === selectedQuizQuestion.id}
                onClick={() => onReviewQuestion(selectedQuizQuestion, "APPROVED")}
                className="theme-button-success inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-lg px-3 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewingQuestionId === selectedQuizQuestion.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {reviewingQuestionId === selectedQuizQuestion.id
                  ? "Đang chấp nhận"
                  : "Chấp nhận"}
              </button>
            </div>
          ) : null}

          {isAiGeneratedQuestion ? (
            <div className="ml-auto flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                title="Chỉ xem UI"
                aria-pressed={questionViewMode === "UI_ONLY"}
                onClick={() => handleSetQuestionViewMode("UI_ONLY")}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  questionViewMode === "UI_ONLY"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">Chỉ xem UI</span>
              </button>
              <button
                type="button"
                title="Chỉ xem JSON"
                aria-pressed={questionViewMode === "JSON_ONLY"}
                onClick={() => handleSetQuestionViewMode("JSON_ONLY")}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  questionViewMode === "JSON_ONLY"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <Code2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">Chỉ xem JSON</span>
              </button>
              <button
                type="button"
                title="Xem song song"
                aria-pressed={questionViewMode === "SPLIT"}
                onClick={() => handleSetQuestionViewMode("SPLIT")}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  questionViewMode === "SPLIT"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <Columns className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">Song song</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section
        ref={panelRef}
        id={`${assessmentKind}-set-panel-${activeSet.id}`}
        role="tabpanel"
        className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950 shadow-sm"
        style={{ minHeight: minHeight || undefined }}
      >
        {queryRenderState === "loading" ? (
          <QuizLoadingState />
        ) : queryRenderState === "error" ? (
          <AdminDataErrorState
            className="rounded-none border-0 shadow-none"
            description="Vui lòng thử lại để tiếp tục quản lý câu hỏi."
            headingLevel={4}
            isRetrying={questionsQuery.isFetching}
            onRetry={() => questionsQuery.refetch()}
            title="Không tải được câu hỏi của bộ này"
            variant="compact"
          />
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
        ) : selectedQuestion && selectedQuestionIndex >= 0 ? (
          isAiGeneratedQuestion && questionViewMode !== "UI_ONLY" ? (
            <div
              className={cn(
                "grid gap-4 bg-[var(--theme-surface-soft)] p-3 sm:p-4",
                questionViewMode === "SPLIT" && "xl:grid-cols-2",
              )}
            >
              {questionViewMode === "SPLIT" ? (
                <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950">
                  <QuestionCard
                    key={selectedQuestion.id}
                    assessmentKind={assessmentKind}
                    index={selectedQuestionDisplayIndex}
                    question={previewQuizQuestion ?? selectedQuestion}
                    setId={activeSet.id}
                    onDelete={() => onDeleteQuestion(selectedQuestion)}
                    onEdit={() => onEditQuestion(selectedQuestion)}
                    onNext={() => selectRelativeQuizQuestion(1)}
                    onPrevious={() => selectRelativeQuizQuestion(-1)}
                    onReview={(reviewStatus) =>
                      onReviewQuestion(selectedQuestion, reviewStatus)
                    }
                    isQuestionNavigationDisabled={
                      quizQuestionNavigation.navigableQuestions.length <= 1
                    }
                    isReviewing={reviewingQuestionId === selectedQuestion.id}
                  />
                </div>
              ) : null}
              <section
                aria-label={`JSON câu ${selectedQuestionDisplayIndex + 1}`}
                className="flex min-w-0 flex-col space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resetJsonView(false)}
                    className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Xổ toàn bộ
                  </button>
                  <button
                    type="button"
                    onClick={() => resetJsonView(1)}
                    className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Thu lại toàn bộ
                  </button>
                  <button
                    type="button"
                    disabled={!hasGenerationJsonChanges || isSavingGenerationJson}
                    onClick={async () => {
                      if (!questionReviewJson || !selectedQuizQuestion) return;
                      try {
                        await onSaveGenerationJson(
                          selectedQuizQuestion.id,
                          questionReviewJson,
                        );
                        toast.success(
                          `Đã lưu JSON câu ${assessmentKind === "test" ? "Test" : "Quiz"}`,
                        );
                      } catch (error) {
                        toast.error(
                          getUserFacingErrorMessage(
                            error,
                            "JSON chưa được lưu. Vui lòng kiểm tra lại cấu trúc.",
                          ),
                        );
                      }
                    }}
                    className="theme-button-primary ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingGenerationJson ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Lưu JSON
                  </button>
                </div>
                <div className="max-h-[800px] w-full overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  {questionReviewJson ? (
                    <ReactJson
                      key={`${selectedQuestion.id}-${jsonViewState.revision}`}
                      src={questionReviewJson}
                      onEdit={(event) => {
                        if (isProtectedQuizGenerationJsonEdit(event)) {
                          toast.error(
                            `Hình của câu ${assessmentKind === "test" ? "Test" : "Quiz"} được sửa bằng công cụ quản lý hình riêng.`,
                          );
                          return false;
                        }
                        setQuestionReviewJson(
                          event.updated_src as Record<string, unknown>,
                        );
                      }}
                      onAdd={(event) => {
                        if (isProtectedQuizGenerationJsonEdit(event)) {
                          toast.error(
                            `Hình của câu ${assessmentKind === "test" ? "Test" : "Quiz"} được sửa bằng công cụ quản lý hình riêng.`,
                          );
                          return false;
                        }
                        setQuestionReviewJson(
                          event.updated_src as Record<string, unknown>,
                        );
                      }}
                      onDelete={(event) => {
                        if (isProtectedQuizGenerationJsonEdit(event)) {
                          toast.error(
                            "Không thể xóa quyết định hình trực tiếp trong JSON.",
                          );
                          return false;
                        }
                        setQuestionReviewJson(
                          event.updated_src as Record<string, unknown>,
                        );
                      }}
                      theme="rjv-default"
                      style={{ backgroundColor: "transparent" }}
                      collapsed={jsonViewState.collapsed}
                      displayDataTypes={false}
                      name={false}
                      enableClipboard={false}
                      keyModifier={(event) =>
                        event instanceof MouseEvent &&
                        (event.detail >= 2 || event.metaKey || event.ctrlKey)
                      }
                    />
                  ) : (
                    <p className="text-sm font-medium text-[var(--theme-text-muted)]">
                      Không tìm thấy JSON review của câu hỏi này.
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <QuestionCard
              key={selectedQuestion.id}
              assessmentKind={assessmentKind}
              index={selectedQuestionDisplayIndex}
              question={selectedQuestion}
              setId={activeSet.id}
              onDelete={() => onDeleteQuestion(selectedQuestion)}
              onEdit={() => onEditQuestion(selectedQuestion)}
              onNext={() => selectRelativeQuizQuestion(1)}
              onPrevious={() => selectRelativeQuizQuestion(-1)}
              onReview={(reviewStatus) =>
                onReviewQuestion(selectedQuestion, reviewStatus)
              }
              isQuestionNavigationDisabled={
                quizQuestionNavigation.navigableQuestions.length <= 1
              }
              isReviewing={reviewingQuestionId === selectedQuestion.id}
            />
          )
        ) : null}
      </section>
      <AdminQuizGenerationHistoryDialog
        assessmentKind={assessmentKind}
        isOpen={isGenerationHistoryOpen}
        onClose={() => setIsGenerationHistoryOpen(false)}
        quizSet={activeSet as AdminQuizSet}
      />
    </div>
  );
}

function formatQuizGenerationCost(set: AdminQuizSet) {
  const totalCostVnd = (set.aiGenerations ?? []).reduce(
    (total, generation) => total + generation.totalCostVnd,
    0,
  );
  return `${new Intl.NumberFormat("vi-VN").format(totalCostVnd)} VNĐ`;
}

function getSelectedQuizGenerationIssues(
  set: AdminQuizSet | null,
  questions: AdminQuizQuestion[],
  question: AdminQuizQuestion | undefined,
) {
  if (question?.reviewStatus === "APPROVED") return [];
  const generationId = question?.sourceMetadataJson?.aiGenerationId;
  const questionIndex = question?.sourceMetadataJson?.generationQuestionIndex;
  if (!set || !generationId || typeof questionIndex !== "number") return [];
  const generation = set.aiGenerations?.find((item) => item.id === generationId);
  const hasApprovedQuestionInGeneration = questions.some(
    (candidate) =>
      candidate.reviewStatus === "APPROVED" &&
      candidate.sourceMetadataJson?.aiGenerationId === generationId,
  );
  return (generation?.inputMetaJson?.generationIssues ?? []).filter((issue) => {
    if (issue.questionIndex === undefined) {
      return !hasApprovedQuestionInGeneration;
    }

    return issue.questionIndex === questionIndex;
  });
}

function QuestionCard({
  assessmentKind,
  index,
  question,
  onDelete,
  onEdit,
  onNext,
  onPrevious,
  onReview,
  isQuestionNavigationDisabled = false,
  isReviewing,
  setId,
}: {
  assessmentKind: "quiz" | "test";
  index: number;
  question: AdminQuizQuestion | AdminTestQuestion;
  onDelete: () => void;
  onEdit: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onReview: (reviewStatus: "APPROVED" | "NEEDS_REVIEW") => void;
  isQuestionNavigationDisabled?: boolean;
  isReviewing: boolean;
  setId: string;
}) {
  const [solutionAiMode, setSolutionAiMode] = useState<"REFINE" | "REGENERATE" | null>(
    null,
  );
  const isAiGenerated = Boolean(question.sourceMetadataJson?.aiGenerationId);
  const isApproved = question.reviewStatus === "APPROVED";
  const quizQuestion = question as unknown as AdminQuizQuestion;
  const questionFigure = quizQuestion?.figures.find(
    (figure) => figure.role === "QUESTION",
  );
  const solutionFigure = quizQuestion?.figures.find(
    (figure) => figure.role === "SOLUTION",
  );
  const correctAnswers = getStringAnswers(question.correctAnswerJson);
  const statementAnswerById = new Map(
    getMultiStatementAnswers(question.correctAnswerJson).map((answer) => [
      answer.statementId,
      answer.value,
    ]),
  );
  const hint = getTiptapDocumentText(question.hintJson);
  const explanation = getTiptapDocumentText(question.explanation?.contentJson);
  const quizExplanationBlock = useMemo(() => {
    const candidate = question.sourceMetadataJson?.quizExplanationBlock;
    return isQuizExplanationBlockData(candidate) ? candidate : null;
  }, [question.sourceMetadataJson?.quizExplanationBlock]);
  const solutionFigurePreview = solutionFigure ? (
    <AdminQuizFigurePreview
      assessmentKind={assessmentKind}
      figure={solutionFigure}
      questionId={question.id}
      role="SOLUTION"
      setId={setId}
    />
  ) : null;
  const hasCurrentSolution = Boolean(
    quizExplanationBlock?.solution?.trim() || explanation,
  );
  const solutionRefinementAction = hasCurrentSolution ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        className="theme-button-primary-subtle inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold"
        onClick={() => setSolutionAiMode("REFINE")}
        type="button"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Tinh chỉnh lời giải
      </button>
      <button
        className="theme-button-primary-subtle inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold"
        onClick={() => setSolutionAiMode("REGENERATE")}
        type="button"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Tạo lại lời giải
      </button>
    </div>
  ) : null;

  return (
    <article
      id={`quiz-question-${question.id}`}
      className={cn("space-y-4 p-4 sm:p-5", "learning-content-text")}
    >
      <div className="space-y-2">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isAiGenerated ? (
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 text-xs font-extrabold text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                AI
              </span>
            ) : null}
            <button
              type="button"
              disabled={isReviewing}
              onClick={() => onReview(isApproved ? "NEEDS_REVIEW" : "APPROVED")}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60",
                isApproved ? "theme-button-neutral" : "theme-button-primary-subtle",
              )}
              aria-keyshortcuts={!isApproved && isAiGenerated ? "Enter" : undefined}
            >
              {isReviewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : isApproved ? (
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isReviewing
                ? isApproved
                  ? "Đang hủy duyệt"
                  : "Đang duyệt"
                : isApproved
                  ? "Hủy duyệt"
                  : "Duyệt"}
            </button>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <AdminQuizQuestionFigureAiMenu
              assessmentKind={assessmentKind}
              hasSolutionText={Boolean(explanation || quizExplanationBlock)}
              question={quizQuestion}
              setId={setId}
            />
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
            {onPrevious && onNext ? (
              <>
                <button
                  type="button"
                  disabled={isQuestionNavigationDisabled}
                  onClick={onPrevious}
                  className="theme-button-neutral grid h-10 w-10 place-items-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Câu trước"
                  aria-keyshortcuts="ArrowLeft"
                  title="Câu trước"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={isQuestionNavigationDisabled}
                  onClick={onNext}
                  className="theme-button-neutral grid h-10 w-10 place-items-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Câu tiếp theo"
                  aria-keyshortcuts="ArrowRight"
                  title="Câu tiếp theo"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold uppercase tracking-wide text-[var(--theme-primary)]">
              Câu {index + 1}
            </span>
            <span className="rounded-full bg-[var(--theme-surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--theme-text-muted)]">
              {questionTypeLabel(question.questionType)}
            </span>
            <span
              className={cn(
                "inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-extrabold tracking-wide",
                questionDifficultyBadgeClassName(question.difficulty),
              )}
            >
              <Gauge className="size-3.5 shrink-0" aria-hidden="true" />
              {difficultyLabel(question.difficulty)}
            </span>
          </div>
          <QuizRichContentViewer
            ariaLabel={`Nội dung câu ${index + 1}`}
            className="mt-2 font-normal leading-relaxed text-[var(--theme-text)]"
            content={question.questionJson}
            fallback="Câu hỏi chưa có nội dung"
          />
        </div>
      </div>

      {questionFigure ? (
        <AdminQuizFigurePreview
          assessmentKind={assessmentKind}
          figure={questionFigure}
          questionId={question.id}
          role="QUESTION"
          setId={setId}
        />
      ) : null}

      {question.questionType === "MULTIPLE_CHOICE" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.optionsJson?.map((option, optionIndex) => {
            const isCorrect = correctAnswers.includes(option.id);
            return (
              <div
                key={option.id}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-1.5 font-normal leading-relaxed",
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
                  className="min-w-0 flex-1 text-[var(--theme-text)]"
                  content={removeTrailingOptionPeriod(option.richText)}
                  contentAlignment="left"
                />
              </div>
            );
          })}
        </div>
      ) : question.questionType === "TRUE_FALSE" ? (
        <div className="inline-flex gap-1 rounded-lg border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] px-3 py-2 text-[var(--theme-success-text)]">
          <span className="font-normal">Đáp án:</span>
          <span className="font-normal">
            {question.correctAnswerJson ? "Đúng" : "Sai"}
          </span>
        </div>
      ) : question.questionType === "MULTI_STATEMENT_TRUE_FALSE" ? (
        <ul className="space-y-2">
          {question.optionsJson?.map((statement, statementIndex) => {
            const answer = statementAnswerById.get(statement.id) ?? false;
            const statementLabel = answerOptionLabel(statementIndex).toLowerCase();
            return (
              <li
                key={statement.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border px-3 py-2",
                  answer
                    ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)]"
                    : "border-[var(--theme-error-border)] bg-[var(--theme-error-bg)]",
                )}
              >
                <div className="flex min-w-0 items-center gap-2 font-normal leading-relaxed text-[var(--theme-text)]">
                  <span className="shrink-0 font-extrabold text-[var(--theme-text-muted)]">
                    {statementLabel})
                  </span>
                  <QuizRichContentViewer
                    ariaLabel={`Nội dung mệnh đề ${statementLabel}`}
                    className="min-w-0 flex-1 break-words"
                    content={statement.richText}
                    contentAlignment="left"
                  />
                </div>
                <span
                  className={cn(
                    "self-center shrink-0 rounded-full border px-2.5 py-1 text-xs font-extrabold",
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
        <div className="flex items-baseline gap-2 rounded-lg border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] p-3">
          <p className="shrink-0 font-normal text-[var(--theme-success-text)]">Đáp án:</p>
          <ul className="min-w-0 flex-1 space-y-1 font-normal leading-relaxed text-[var(--theme-success-text)]">
            {correctAnswers.slice(0, 1).map((answer, answerIndex) => (
              <li
                key={`${answerIndex}-${answer}`}
                aria-label="Đáp án đúng"
                className="break-words"
              >
                <MathpixMarkdownRenderer
                  className="min-w-0 [&>div]:inline [&_p]:m-0 [&_p]:inline"
                  content={
                    resolveQuizCorrectAnswerDisplay({
                      correctAnswer: [answer],
                      questionType: "TEXT_INPUT",
                    })?.content ?? answer
                  }
                  contentAlignment="left"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {solutionFigure || hint || explanation || quizExplanationBlock ? (
        <div className="space-y-3">
          {hint ? (
            <div className="rounded-lg border border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] p-3">
              <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[var(--theme-info-text)]">
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
                Gợi ý
              </p>
              <QuizRichContentViewer
                ariaLabel="Nội dung gợi ý"
                className="mt-1 leading-relaxed text-[var(--theme-text)]"
                content={question.hintJson}
              />
            </div>
          ) : null}
          {quizExplanationBlock ? (
            <QuizExplanationCard
              block={quizExplanationBlock}
              correctAnswer={question.correctAnswerJson}
              label="Lời giải"
              media={solutionFigurePreview}
              optionIds={question.optionsJson?.map((option) => option.id)}
              questionType={question.questionType}
              separateAnswerItems={question.questionType === "MULTI_STATEMENT_TRUE_FALSE"}
              showProblem={false}
              headerAction={solutionRefinementAction}
            />
          ) : explanation || solutionFigurePreview ? (
            <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-[var(--theme-text-muted)]">
                  Lời giải chi tiết
                </p>
                {solutionRefinementAction}
              </div>
              {solutionFigurePreview ? (
                <div className="mt-3">{solutionFigurePreview}</div>
              ) : null}
              {explanation ? (
                <div className="mt-3 leading-relaxed text-[var(--theme-text)]">
                  <TiptapContentView content={question.explanation?.contentJson} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <AdminQuizSolutionRefinementDialog
        assessmentKind={assessmentKind}
        currentSolution={quizExplanationBlock?.solution ?? explanation ?? ""}
        isOpen={solutionAiMode !== null}
        mode={solutionAiMode ?? "REFINE"}
        onClose={() => setSolutionAiMode(null)}
        questionId={question.id}
        setId={setId}
      />
    </article>
  );
}

function isQuestionNavigationShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      "[data-quiz-question-shortcut], [data-test-question-shortcut]",
    )
  ) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, math-field, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], [role="spinbutton"], [role="tablist"], [role="tree"]',
    ),
  );
}

function isQuestionReviewShortcutTarget(target: EventTarget | null) {
  if (isQuestionNavigationShortcutTarget(target)) return true;
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'a, button, summary, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"]',
    ),
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
      <div className="rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950 p-5">
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
  difficulty: AdminQuizQuestion["difficulty"] | AdminTestQuestion["difficulty"],
) {
  return {
    EASY: "Dễ",
    MEDIUM: "Trung bình",
    HARD: "Khó",
    MIXED: "Hỗn hợp",
  }[difficulty];
}

function questionDifficultyBadgeClassName(
  difficulty: AdminQuizQuestion["difficulty"] | AdminTestQuestion["difficulty"],
) {
  return {
    EASY: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-200",
    MEDIUM:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-200",
    HARD: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-200",
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
        description: "Quản lý các bộ đề và câu hỏi kiểm tra của buổi học.",
        heading: "Quản lý Bài kiểm tra",
        setName: "bộ đề",
        setNamePlural: "bộ đề",
      }
    : {
        addSetLabel: "Thêm bộ câu hỏi",
        createFirstSetLabel: "Tạo bộ câu hỏi đầu tiên",
        deleteSetTitle: "Xóa bộ câu hỏi",
        description: "Quản lý các bộ câu hỏi luyện tập của buổi học.",
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
