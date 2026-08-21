"use client";

import {
  BookImage,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  LayoutTemplate,
  Code2,
  Columns,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { toast } from "sonner";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import dynamic from "next/dynamic";
import {
  useAdminAiGenerationPanel,
  useAdminLessonSummary,
  useAdminStemFigures,
  useDeleteAdminLessonSummary,
  useUpsertAdminLessonSummary,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminLessonSummaryContent,
  AdminLessonSummaryReviewStatus,
  AdminAiPanelJob,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import { SummaryBlockRenderer } from "@/features/student/lessons/screens/student-lesson-screen/components/summary-block-renderer";
import {
  createEmptyTiptapDocument,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import { MathToolbar } from "@/features/student/lessons/screens/student-lesson-screen/components/math-toolbar";
import { AiJobMetadata } from "@/features/admin/ai-generation/components/ai-job-metadata";
import { AdminStemFigureStatusSummary } from "@/features/admin/ai-generation/components/admin-stem-figure-status-summary";
import { AdminStemFigureInline } from "@/features/admin/ai-generation/components/admin-stem-figures-panel";
import { AdminBlockImageActions } from "@/features/admin/ai-generation/components/admin-block-image-actions";
import { AdminSummarySourcePagesDialog } from "@/features/admin/ai-generation/components/admin-summary-source-pages-dialog";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { StemFigureVisual } from "@/components/common/content/stem-figure";
import {
  canReconcileStemFigureSnapshot,
  syncStemFigureReferencesInContent,
} from "@/features/admin/ai-generation/utils/lesson-summary-stem-figure-sync";
import {
  applyPhaseOneLayoutOperation,
  applyPhaseOneBlockPreview,
  applyPhaseOneBlocksPreview,
  type LessonSummaryPhaseOneLayoutOperation,
} from "@/features/admin/ai-generation/utils/lesson-summary-phase-one-preview";
import { toAdminLessonSummaryBlockElementId } from "@/features/admin/ai-generation/utils/admin-lesson-summary-block";
import {
  createTextbookImageBulkReplacePlan,
  useAdminReplaceAllTextbookImages,
} from "@/features/admin/ai-generation/hooks/use-admin-replace-all-textbook-images";
import { AdminLessonSummaryPublishActions } from "@/features/admin/ai-generation/components/admin-lesson-summary-publish-actions";

const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });
const ReplaceAllTextbookImagesDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-replace-all-textbook-images-dialog").then(
      (module) => module.AdminReplaceAllTextbookImagesDialog,
    ),
  { ssr: false },
);

type ViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";

export function AdminLessonSummaryTab({
  lessonId,
  lessonTitle,
  onEdit,
  onRegenerate,
}: {
  lessonId: string;
  lessonTitle?: string;
  onEdit: () => void;
  onRegenerate: () => void;
}) {
  const summaryQuery = useAdminLessonSummary(lessonId);
  const figuresQuery = useAdminStemFigures(lessonId);
  const hasActiveStemFigures = (figuresQuery.data ?? []).some((figure) =>
    ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status),
  );
  const panelQuery = useAdminAiGenerationPanel(lessonId, {
    pollUsage: hasActiveStemFigures,
  });
  const wasProcessingStemFigures = useRef(false);
  const summaryJob = panelQuery.data?.jobs?.SUMMARY;
  const isSummaryPhaseOneActive =
    summaryJob?.status === "QUEUED" || summaryJob?.status === "RUNNING";
  const upsertMutation = useUpsertAdminLessonSummary(lessonId);
  const deleteMutation = useDeleteAdminLessonSummary(lessonId);
  const replaceAllTextbookImagesMutation = useAdminReplaceAllTextbookImages(lessonId);
  const [content, setContent] = useState<AdminLessonSummaryContent>(
    createEmptyTiptapDocument(),
  );
  const [phaseOneBlockJsonByPath, setPhaseOneBlockJsonByPath] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [phaseOneLayoutOperations, setPhaseOneLayoutOperations] = useState<
    LessonSummaryPhaseOneLayoutOperation[]
  >([]);
  const [contentError, setContentError] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("UI_ONLY");
  const [jsonCollapsed, setJsonCollapsed] = useState<boolean | number>(2);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isReplaceAllImagesConfirmOpen, setIsReplaceAllImagesConfirmOpen] =
    useState(false);
  const [replaceAllImagesCompletedCount, setReplaceAllImagesCompletedCount] = useState(0);
  const [selectedSourcePageNumbers, setSelectedSourcePageNumbers] = useState<
    number[] | null
  >(null);
  const [sourceCropFigureId, setSourceCropFigureId] = useState<string | null>(null);
  const unresolvedReviewIssueCount = countUnresolvedReviewIssues(content);
  const textbookImageBulkReplacePlan = useMemo(
    () => createTextbookImageBulkReplacePlan(figuresQuery.data ?? []),
    [figuresQuery.data],
  );
  const stemFigureVisuals = useMemo(
    () =>
      new Map<string, StemFigureVisual>(
        (figuresQuery.data ?? []).map((figure) => [
          figure.id,
          {
            kind: "TEX_FIGURE",
            figureId: figure.id,
            ...(figure.figureOrigin ? { figureOrigin: figure.figureOrigin } : {}),
            status: figure.status,
            altText: figure.altText,
            caption: figure.caption,
            previewSvg: figure.previewSvg ?? undefined,
            assetUrl: figure.assetUrl,
          },
        ]),
      ),
    [figuresQuery.data],
  );
  const stemFiguresById = useMemo(
    () =>
      new Map<string, AdminStemFigure>(
        (figuresQuery.data ?? []).map((figure) => [figure.id, figure]),
      ),
    [figuresQuery.data],
  );
  const jsonViewContent = useMemo(
    () => addStemFigureSourceReferencesForJsonView(content, figuresQuery.data ?? []),
    [content, figuresQuery.data],
  );
  const updateContentFromJsonView = useCallback(
    (value: AdminLessonSummaryContent) =>
      setContent(removeStemFigureSourceReferencesFromJsonView(value)),
    [],
  );
  const renderStemFigure = useCallback(
    (visual: StemFigureVisual) => {
      const figure = stemFiguresById.get(visual.figureId);
      return figure ? (
        <AdminStemFigureInline
          figure={figure}
          isSourceCropOpen={sourceCropFigureId === figure.id}
          lessonId={lessonId}
          modelConfiguration={panelQuery.data?.summaryConfiguration}
          onSourceCropOpenChange={(isOpen) =>
            setSourceCropFigureId((current) =>
              isOpen ? figure.id : current === figure.id ? null : current,
            )
          }
        />
      ) : null;
    },
    [
      lessonId,
      panelQuery.data?.summaryConfiguration,
      sourceCropFigureId,
      stemFiguresById,
    ],
  );
  const stemFiguresByBlockPath = useMemo(() => {
    const groups = new Map<string, AdminStemFigure[]>();
    for (const figure of figuresQuery.data ?? []) {
      const current = groups.get(figure.blockPath) ?? [];
      current.push(figure);
      groups.set(
        figure.blockPath,
        current.sort((left, right) => left.figureIndex - right.figureIndex),
      );
    }
    return groups;
  }, [figuresQuery.data]);
  const renderBlockImageActions = useCallback(
    ({ blockPath }: { blockPath: string }) => (
      <AdminBlockImageActions
        blockPath={blockPath}
        figures={stemFiguresByBlockPath.get(blockPath) ?? []}
        lessonId={lessonId}
        onViewTextbookSource={(figure) => setSourceCropFigureId(figure.id)}
      />
    ),
    [lessonId, stemFiguresByBlockPath],
  );
  const renderBlockSourceAction = useCallback(({ block }: { block: unknown }) => {
    const sourcePageNumbers = readBlockSourcePageNumbers(block);
    const hasSourcePages = sourcePageNumbers.length > 0;
    return (
      <button
        aria-label="Xem PDF nguồn của khối"
        className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
        disabled={!hasSourcePages}
        onClick={() => setSelectedSourcePageNumbers(sourcePageNumbers)}
        title={
          hasSourcePages ? "Xem PDF nguồn của khối" : "Khối này không có trang nguồn PDF"
        }
        type="button"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }, []);

  useEffect(() => {
    if (wasProcessingStemFigures.current && !hasActiveStemFigures) {
      void panelQuery.refetch();
    }
    wasProcessingStemFigures.current = hasActiveStemFigures;
  }, [hasActiveStemFigures, panelQuery]);

  useEffect(() => {
    const savedMode = localStorage.getItem("admin-lesson-summary-view-mode");
    if (savedMode === "UI_ONLY" || savedMode === "JSON_ONLY" || savedMode === "SPLIT") {
      setViewMode(savedMode);
    }
  }, []);

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("admin-lesson-summary-view-mode", mode);
  };
  const handleNavigateToBlock = useCallback(
    (blockPath: string) => {
      const elementId = toAdminLessonSummaryBlockElementId(blockPath);
      if (!elementId) return;

      if (viewMode === "JSON_ONLY") {
        setViewMode("UI_ONLY");
        localStorage.setItem("admin-lesson-summary-view-mode", "UI_ONLY");
      }
      window.setTimeout(() => {
        document.getElementById(elementId)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 240);
    },
    [viewMode],
  );
  const updateAllPhaseOneBlocks = (blocks: Record<string, unknown>) => {
    setPhaseOneBlockJsonByPath(blocks);
    setContent((current) => applyPhaseOneBlocksPreview(current, blocks));
  };
  const applyLayoutOperation = useCallback(
    (operation: LessonSummaryPhaseOneLayoutOperation) => {
      setPhaseOneBlockJsonByPath((current) =>
        current ? applyPhaseOneLayoutOperation(current, operation) : current,
      );
      setPhaseOneLayoutOperations((current) => [...current, operation]);
    },
    [],
  );

  useEffect(() => {
    setContent(summaryQuery.data?.contentJson ?? createEmptyTiptapDocument());
    setPhaseOneBlockJsonByPath(
      summaryQuery.data?.phaseOneBlockJsonByPath
        ? structuredClone(summaryQuery.data.phaseOneBlockJsonByPath)
        : null,
    );
    setPhaseOneLayoutOperations([]);
    setContentError(undefined);
  }, [summaryQuery.data]);

  const referencedStemFigureIds = useMemo(
    () => collectReferencedStemFigureIds(content),
    [content],
  );
  useEffect(() => {
    const figures = figuresQuery.data ?? [];
    const summary = summaryQuery.data;
    if (
      !summary ||
      !canReconcileStemFigureSnapshot({
        figures,
        isFetching: figuresQuery.isFetching,
        isSuccess: figuresQuery.isSuccess,
        summaryAiGenerationId: summary.aiGenerationId,
      })
    ) {
      return;
    }
    setContent((current) => syncStemFigureReferencesInContent(current, figures));
  }, [
    figuresQuery.data,
    figuresQuery.isFetching,
    figuresQuery.isSuccess,
    summaryQuery.data,
  ]);

  if (summaryQuery.isPending) {
    return <SummarySkeleton />;
  }
  if (summaryQuery.isError) {
    return (
      <AdminDataErrorState
        description="Vui lòng thử lại để tiếp tục xem và biên tập tóm tắt."
        headingLevel={3}
        isRetrying={summaryQuery.isFetching}
        onRetry={() => summaryQuery.refetch()}
        title="Không tải được tóm tắt buổi học"
        variant="section"
      />
    );
  }

  const summary = summaryQuery.data;
  const stemFigureBlockers = (figuresQuery.data ?? []).filter(
    (figure) => referencedStemFigureIds.has(figure.id) && !figure.hasCurrentAsset,
  );
  const figureActionsBlocked = figuresQuery.isPending || stemFigureBlockers.length > 0;
  const figureBlockerTitle = figuresQuery.isPending
    ? "Đang kiểm tra trạng thái hình STEM."
    : stemFigureBlockers.length > 0
      ? `Cần xử lý hình tại: ${stemFigureBlockers.map((figure) => figure.blockPath).join(", ")}`
      : undefined;
  const save = async (action: "SAVE" | "PUBLISH" | "WITHDRAW") => {
    if (action !== "WITHDRAW" && figureActionsBlocked) {
      toast.error(figureBlockerTitle ?? "Còn hình STEM chưa có asset hợp lệ.");
      return;
    }
    const isBlocks = content?.type === "lesson_summary_blocks";
    if (action !== "WITHDRAW" && isBlocks && !phaseOneBlockJsonByPath) {
      toast.error("Bản này chưa có raw Phase 1 để chỉnh sửa. Hãy sinh lại kiến thức.");
      return;
    }
    if (action !== "WITHDRAW" && !isBlocks && !hasTiptapDocumentContent(content)) {
      setContentError("Nhập nội dung Kiến thức trước khi lưu");
      return;
    }
    setContentError(undefined);
    const reviewStatus: AdminLessonSummaryReviewStatus =
      action === "WITHDRAW"
        ? "HIDDEN"
        : action === "PUBLISH"
          ? "APPROVED"
          : summary?.reviewStatus || "DRAFT";
    try {
      await upsertMutation.mutateAsync(
        action === "WITHDRAW" && summary
          ? {
              contentJson: summary.contentJson,
              source: summary.source,
              reviewStatus,
            }
          : content?.type === "lesson_summary_blocks"
            ? {
                phaseOneBlockJsonByPath: phaseOneBlockJsonByPath!,
                phaseOneLayoutOperations,
                source: summary?.source ?? "AI",
                reviewStatus,
              }
            : {
                contentJson: content,
                source: summary?.source ?? "ADMIN",
                reviewStatus,
              },
      );
      toast.success(
        action === "WITHDRAW"
          ? "Đã thu hồi phát hành tóm tắt"
          : action === "PUBLISH"
            ? "Đã phát hành tóm tắt"
            : "Đã lưu nội dung chỉnh sửa",
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa lưu được nội dung. Vui lòng thử lại."),
      );
    }
  };

  const deleteSummary = async () => {
    try {
      await deleteMutation.mutateAsync();
      setContent(createEmptyTiptapDocument());
      setIsDeleteConfirmOpen(false);
      toast.success("Đã xóa toàn bộ kiến thức đã sinh.");
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa xóa được kiến thức đã sinh."));
    }
  };

  const replaceAllImagesWithEnhancedTextbookSources = async () => {
    setReplaceAllImagesCompletedCount(0);
    try {
      const result = await replaceAllTextbookImagesMutation.mutateAsync({
        items: textbookImageBulkReplacePlan.eligibleItems,
        onProgress: setReplaceAllImagesCompletedCount,
      });
      setIsReplaceAllImagesConfirmOpen(false);

      if (result.failedCount > 0) {
        toast.warning(
          `Đã thay và làm nét ${result.succeededCount} hình AI ban đầu; ${result.failedCount} hình chưa hoàn tất.`,
        );
        return;
      }
      toast.success(
        `Đã thay và làm nét ${result.succeededCount} hình AI ban đầu bằng ảnh gốc SGK.`,
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa hoàn tất thay ảnh gốc sách giáo khoa. Vui lòng thử lại.",
        ),
      );
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6" data-testid="admin-lesson-summary-tab">
      <MathToolbar />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Kiến thức buổi học
            </h3>
            {summary ? (
              <SummaryStatusBadge
                status={summary.reviewStatus}
                job={summaryJob ?? null}
              />
            ) : null}
            {unresolvedReviewIssueCount > 0 ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-2.5 text-xs font-extrabold text-[var(--theme-warning-text)]">
                {unresolvedReviewIssueCount} mục cần kiểm tra
              </span>
            ) : null}
            {summary && !isSummaryPhaseOneActive && figuresQuery.isSuccess ? (
              <AdminStemFigureStatusSummary
                content={content}
                figures={figuresQuery.data ?? []}
                lessonId={lessonId}
                modelConfiguration={panelQuery.data?.summaryConfiguration}
                onNavigateToBlock={handleNavigateToBlock}
              />
            ) : null}
          </div>
          {summary ? <AiJobMetadata job={summaryJob ?? null} /> : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          {summary ? (
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              data-testid="summary-header-actions"
            >
              <span className="group relative">
                <button
                  aria-label="Thay các hình từ lượt AI sinh ban đầu còn lại bằng hình gốc sách giáo khoa đã làm nét"
                  className="theme-button-primary-subtle relative grid min-h-10 min-w-10 place-items-center rounded-lg px-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    replaceAllTextbookImagesMutation.isPending ||
                    !figuresQuery.isSuccess ||
                    textbookImageBulkReplacePlan.initialAiImageCount === 0
                  }
                  onClick={() => setIsReplaceAllImagesConfirmOpen(true)}
                  type="button"
                >
                  {replaceAllTextbookImagesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <BookImage className="h-5 w-5" aria-hidden="true" />
                      <Sparkles
                        className="absolute right-0.5 top-0.5 h-3 w-3"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
                <span className="pointer-events-none absolute right-0 top-12 z-40 w-max max-w-72 rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-bold leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  Thay các hình AI ban đầu còn lại bằng ảnh gốc SGK đã làm nét
                </span>
              </span>
              <AdminLessonSummaryPublishActions
                compact
                figureActionsBlocked={figureActionsBlocked}
                figureBlockerTitle={figureBlockerTitle}
                isPending={upsertMutation.isPending}
                reviewStatus={summary.reviewStatus}
                onSave={save}
              />
              <button
                type="button"
                onClick={onEdit}
                className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Sửa
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold disabled:opacity-60"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Xóa
              </button>
            </div>
          ) : null}
          {content?.type === "lesson_summary_blocks" ? (
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => handleSetViewMode("UI_ONLY")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === "UI_ONLY"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                title="Chỉ xem UI"
              >
                <LayoutTemplate className="h-4 w-4" />
                <span className="hidden lg:inline">Chỉ xem UI</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("JSON_ONLY")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === "JSON_ONLY"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                title="Chỉ xem JSON"
              >
                <Code2 className="h-4 w-4" />
                <span className="hidden lg:inline">Chỉ xem JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("SPLIT")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === "SPLIT"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                title="Xem song song"
              >
                <Columns className="h-4 w-4" />
                <span className="hidden lg:inline">Song song</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {content?.type === "lesson_summary_blocks" ? (
        <div className="-mx-3 sm:mx-0 py-6 px-3 sm:p-8 bg-white dark:bg-slate-950 rounded-none sm:rounded-2xl shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50">
          {viewMode === "JSON_ONLY" ? (
            <div className="flex flex-col space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setJsonCollapsed(false)}
                  className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Xổ toàn bộ
                </button>
                <button
                  onClick={() => setJsonCollapsed(2)}
                  className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Thu lại toàn bộ
                </button>
              </div>
              <div className="w-full overflow-auto max-h-[800px] border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm">
                {phaseOneBlockJsonByPath ? (
                  <ReactJson
                    src={phaseOneBlockJsonByPath}
                    onEdit={(event) =>
                      updateAllPhaseOneBlocks(
                        event.updated_src as Record<string, unknown>,
                      )
                    }
                    onAdd={(event) =>
                      updateAllPhaseOneBlocks(
                        event.updated_src as Record<string, unknown>,
                      )
                    }
                    onDelete={(event) =>
                      updateAllPhaseOneBlocks(
                        event.updated_src as Record<string, unknown>,
                      )
                    }
                    theme="rjv-default"
                    style={{ backgroundColor: "transparent" }}
                    collapsed={jsonCollapsed}
                    displayDataTypes={false}
                    name={false}
                    enableClipboard={false}
                    keyModifier={(event) =>
                      event instanceof MouseEvent &&
                      (event.detail >= 2 || event.metaKey || event.ctrlKey)
                    }
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Bản này chưa có raw Phase 1. Hãy sinh lại kiến thức để chỉnh sửa JSON
                    gốc.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <SummaryBlockRenderer
              data={
                (viewMode === "SPLIT" && jsonViewContent.type === "lesson_summary_blocks"
                  ? jsonViewContent.data
                  : content.data) as ComponentProps<typeof SummaryBlockRenderer>["data"]
              }
              displayTitle={lessonTitle}
              viewMode={viewMode === "UI_ONLY" ? "UI_ONLY" : "SPLIT"}
              showEditorialMetadata
              showTableOfContents
              renderStemFigure={renderStemFigure}
              renderBlockImageActions={renderBlockImageActions}
              renderBlockSourceAction={renderBlockSourceAction}
              phaseOneBlockJsonByPath={phaseOneBlockJsonByPath}
              onPhaseOneBlockJsonChange={(blockPath, value) => {
                setPhaseOneBlockJsonByPath((current) =>
                  current ? { ...current, [blockPath]: value } : current,
                );
                setContent((current) =>
                  applyPhaseOneBlockPreview(current, blockPath, value),
                );
              }}
              onPhaseOneLayoutOperation={applyLayoutOperation}
              stemFigureVisuals={stemFigureVisuals}
              onChange={(newData) =>
                updateContentFromJsonView({ ...content, data: newData })
              }
            />
          )}
        </div>
      ) : (
        <QuizRichContentEditor
          ariaLabel="Nội dung Kiến thức buổi học"
          disabled={upsertMutation.isPending}
          error={contentError}
          placeholder="Nhập các ý chính, công thức, ví dụ và câu hỏi ôn tập..."
          value={content}
          onBlur={() => {
            if (!hasTiptapDocumentContent(content)) {
              setContentError("Nhập nội dung Kiến thức trước khi lưu");
            }
          }}
          onChange={(value) => {
            setContent(value);
            if (hasTiptapDocumentContent(value)) {
              setContentError(undefined);
            }
          }}
        />
      )}

      <div
        className="flex flex-col-reverse gap-2 border-t border-[var(--theme-border)] pt-4 sm:flex-row sm:justify-end"
        data-testid="summary-footer-actions"
      >
        <button
          type="button"
          disabled={upsertMutation.isPending}
          onClick={onRegenerate}
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
        >
          {summary ? (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {summary ? "Tạo mới" : "Tạo Kiến thức"}
        </button>
        <AdminLessonSummaryPublishActions
          figureActionsBlocked={figureActionsBlocked}
          figureBlockerTitle={figureBlockerTitle}
          isPending={upsertMutation.isPending}
          reviewStatus={summary?.reviewStatus}
          onSave={save}
        />
      </div>
      <DeleteConfirmDialog
        confirmLabel="Xóa vĩnh viễn"
        description="Thao tác này xóa vĩnh viễn toàn bộ kiến thức đã sinh của buổi học, gồm cả các hình STEM liên quan. Không thể khôi phục."
        isConfirming={deleteMutation.isPending}
        isOpen={isDeleteConfirmOpen}
        itemName="kiến thức đã sinh"
        title="Xóa toàn bộ kiến thức đã sinh?"
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={deleteSummary}
      />
      <ReplaceAllTextbookImagesDialog
        completedCount={replaceAllImagesCompletedCount}
        isOpen={isReplaceAllImagesConfirmOpen}
        isPending={replaceAllTextbookImagesMutation.isPending}
        onCancel={() => setIsReplaceAllImagesConfirmOpen(false)}
        onConfirm={() => void replaceAllImagesWithEnhancedTextbookSources()}
        plan={textbookImageBulkReplacePlan}
      />
      {selectedSourcePageNumbers ? (
        <AdminSummarySourcePagesDialog
          isOpen
          sourcePageNumbers={selectedSourcePageNumbers}
          sourcePages={summary?.sourcePages ?? []}
          onClose={() => setSelectedSourcePageNumbers(null)}
        />
      ) : null}
    </div>
  );
}

function readBlockSourcePageNumbers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const sourcePageNumbers = (value as Record<string, unknown>).sourcePageNumbers;
  if (!Array.isArray(sourcePageNumbers)) return [];
  return [...new Set(sourcePageNumbers)].filter(
    (pageNumber): pageNumber is number =>
      typeof pageNumber === "number" && Number.isInteger(pageNumber) && pageNumber > 0,
  );
}

function collectReferencedStemFigureIds(value: unknown) {
  const ids = new Set<string>();
  visit(value);
  return ids;

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.kind === "TEX_FIGURE" && typeof record.figureId === "string") {
      ids.add(record.figureId);
    }
    Object.values(record).forEach(visit);
  }
}

function addStemFigureSourceReferencesForJsonView(
  value: AdminLessonSummaryContent,
  figures: AdminStemFigure[],
) {
  if (value.type !== "lesson_summary_blocks") return value;
  const copy = structuredClone(value);
  const data = copy.data as {
    sections?: Array<{ blocks?: Array<Record<string, unknown>> }>;
  };
  for (const figure of figures) {
    const sourceReferences = readStemFigureSourceReferences(figure.planJson);
    if (!sourceReferences) continue;
    const match = figure.blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
    const block = match
      ? data.sections?.[Number(match[1])]?.blocks?.[Number(match[2])]
      : null;
    if (!block || !Array.isArray(block.figures)) continue;
    const reference = block.figures.find(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).kind === "TEX_FIGURE" &&
        (item as Record<string, unknown>).figureId === figure.id,
    );
    if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
      continue;
    }
    (reference as Record<string, unknown>).sourceReferences = sourceReferences;
  }
  return copy;
}

function removeStemFigureSourceReferencesFromJsonView(value: AdminLessonSummaryContent) {
  const copy = structuredClone(value);
  visit(copy);
  return copy;

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.kind === "TEX_FIGURE") {
      delete record.sourceReferences;
    }
    Object.values(record).forEach(visit);
  }
}

function readStemFigureSourceReferences(value: unknown): unknown[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const sourceReferences = (value as Record<string, unknown>).sourceReferences;
  return Array.isArray(sourceReferences) ? structuredClone(sourceReferences) : undefined;
}

type ReviewIssueLike = {
  accepted?: boolean;
  code?: string;
  resolution?: "ACCEPT_OR_FIX" | "FIX_ONLY";
};
type ReviewBlockLike = { reviewIssues?: ReviewIssueLike[] };
type ReviewSectionLike = { blocks?: ReviewBlockLike[] };
type ReviewContentLike = {
  type?: string;
  data?: { reviewIssues?: ReviewIssueLike[]; sections?: ReviewSectionLike[] };
};
const FIX_ONLY_REVIEW_CODES = new Set([
  "BLOCK_CANNOT_PROCESS",
  "BLOCK_SCHEMA_INVALID",
  "DIAGRAM_CANNOT_RENDER",
  "MISSING_REQUIRED_FIGURE",
  "MISSING_REQUIRED_FIELD",
  "MISSING_SUMMARY_TITLE",
  "MISSING_THEORY_SECTION",
  "MISSING_THEORY_UNIT",
]);

function countUnresolvedReviewIssues(content: unknown) {
  const candidate = content as ReviewContentLike;
  if (candidate?.type !== "lesson_summary_blocks" || !candidate.data) return 0;
  const count = (issues: ReviewIssueLike[] | undefined) =>
    Array.isArray(issues)
      ? issues.filter(
          (issue) =>
            issue &&
            (issue.resolution === "FIX_ONLY" ||
              (issue.code !== undefined && FIX_ONLY_REVIEW_CODES.has(issue.code)) ||
              issue.code?.endsWith("_CANNOT_RENDER") ||
              issue.code?.endsWith("_CANNOT_PROCESS") ||
              issue.accepted !== true),
        ).length
      : 0;
  return (
    count(candidate.data.reviewIssues) +
    (Array.isArray(candidate.data.sections)
      ? candidate.data.sections.reduce(
          (sectionTotal: number, section) =>
            sectionTotal +
            (Array.isArray(section?.blocks)
              ? section.blocks.reduce(
                  (blockTotal: number, block) => blockTotal + count(block?.reviewIssues),
                  0,
                )
              : 0),
          0,
        )
      : 0)
  );
}

function SummaryStatusBadge({
  status,
  job,
}: {
  status: AdminLessonSummaryReviewStatus;
  job?: AdminAiPanelJob | null;
}) {
  if (job?.status === "QUEUED" || job?.status === "RUNNING") {
    return (
      <span className="inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] text-[var(--theme-info-text)]">
        {job.status === "QUEUED" ? "Đang chờ" : "Đang tạo"}
      </span>
    );
  }

  const copy = {
    DRAFT: "Bản nháp",
    NEEDS_REVIEW: "Bản nháp",
    APPROVED: "Đã phát hành",
    HIDDEN: "Đã thu hồi",
  }[status];
  const className =
    status === "APPROVED"
      ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
      : status === "DRAFT" || status === "NEEDS_REVIEW"
        ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
        : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]";
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold ${className}`}
    >
      {copy}
    </span>
  );
}

function SummarySkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-5 p-5 sm:p-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-6 w-48 rounded-full" />
        <SkeletonBlock className="h-4 w-96 max-w-full rounded-full opacity-70" />
      </div>
      <SkeletonBlock className="h-80 rounded-xl" />
      <div className="flex justify-end gap-2">
        <SkeletonBlock className="h-11 w-32 rounded-lg" />
        <SkeletonBlock className="h-11 w-36 rounded-lg" />
      </div>
    </div>
  );
}
