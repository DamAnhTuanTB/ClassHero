"use client";

import { EyeOff, Loader2, RefreshCw, Save, Send, LayoutTemplate, Code2, Columns } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import dynamic from "next/dynamic";
import {
  useAdminAiGenerationPanel,
  useAdminLessonSummary,
  useUpsertAdminLessonSummary,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type { 
  AdminLessonSummaryReviewStatus,
  AdminAiPanelJob 
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import { SummaryBlockRenderer } from "@/features/student/lessons/screens/student-lesson-screen/components/summary-block-renderer";
import {
  createEmptyTiptapDocument,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import type { TiptapTextDocument } from "@/types/rich-text";

const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

type ViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";

export function AdminLessonSummaryTab({
  lessonId,
  lessonTitle,
  onRegenerate,
}: {
  lessonId: string;
  lessonTitle?: string;
  onRegenerate: () => void;
}) {
  const summaryQuery = useAdminLessonSummary(lessonId);
  const panelQuery = useAdminAiGenerationPanel(lessonId);
  const summaryJob = panelQuery.data?.jobs?.SUMMARY;
  const upsertMutation = useUpsertAdminLessonSummary(lessonId);
  const [content, setContent] = useState<TiptapTextDocument | any>(createEmptyTiptapDocument());
  const [contentError, setContentError] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("SPLIT");
  const [jsonCollapsed, setJsonCollapsed] = useState<boolean | number>(2);

  useEffect(() => {
    if (summaryQuery.data?.contentJson) {
      setContent(summaryQuery.data.contentJson);
      setContentError(undefined);
    }
  }, [summaryQuery.data]);

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
  const save = async (action: "SAVE" | "PUBLISH" | "WITHDRAW") => {
    const isBlocks = content?.type === "lesson_summary_blocks";
    if (!isBlocks && !hasTiptapDocumentContent(content)) {
      setContentError("Nhập nội dung Kiến thức trước khi lưu");
      return;
    }
    setContentError(undefined);
    const reviewStatus: AdminLessonSummaryReviewStatus =
      action === "WITHDRAW"
        ? "HIDDEN"
        : action === "PUBLISH"
          ? "APPROVED"
          : summary?.reviewStatus === "HIDDEN"
            ? "HIDDEN"
            : "DRAFT";
    try {
      await upsertMutation.mutateAsync({
        contentJson: content,
        source: summary?.source ?? "ADMIN",
        reviewStatus,
      });
      toast.success(
        action === "WITHDRAW"
          ? "Đã thu hồi phát hành tóm tắt"
          : action === "PUBLISH"
            ? "Đã phát hành tóm tắt"
            : "Đã lưu nội dung chỉnh sửa",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chưa lưu được tóm tắt");
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Kiến thức buổi học
            </h3>
            {summary ? <SummaryStatusBadge status={summary.reviewStatus} job={summaryJob ?? null} /> : null}
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            Lưu bản chỉnh sửa, sau đó phát hành khi nội dung đã sẵn sàng cho học sinh.
          </p>
        </div>

        {content?.type === "lesson_summary_blocks" && (
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("UI_ONLY")}
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
              onClick={() => setViewMode("JSON_ONLY")}
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
              onClick={() => setViewMode("SPLIT")}
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
        )}
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
                <ReactJson 
                  src={content} 
                  onEdit={(e) => setContent(e.updated_src)}
                  onAdd={(e) => setContent(e.updated_src)}
                  onDelete={(e) => setContent(e.updated_src)}
                  theme="rjv-default"
                  style={{ backgroundColor: 'transparent' }}
                  collapsed={jsonCollapsed}
                  displayDataTypes={false}
                  name={false}
                  enableClipboard={false}
                />
              </div>
            </div>
          ) : (
            <SummaryBlockRenderer 
              data={content.data} 
              displayTitle={lessonTitle}
              viewMode={viewMode === "UI_ONLY" ? "UI_ONLY" : "SPLIT"}
              onChange={(newData) => setContent({ ...content, data: newData })} 
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

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--theme-border)] pt-4 sm:flex-row sm:justify-end">

        <button
          type="button"
          disabled={upsertMutation.isPending}
          onClick={onRegenerate}
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {summary ? "Sinh lại" : "Sinh Kiến thức"}
        </button>
        <button
          type="button"
          disabled={upsertMutation.isPending}
          onClick={() => save("SAVE")}
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
        >
          {upsertMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Lưu nội dung
        </button>
        {summary?.reviewStatus !== "APPROVED" ? (
          <button
            type="button"
            disabled={upsertMutation.isPending}
            onClick={() => save("PUBLISH")}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Phát hành
          </button>
        ) : null}
        {summary?.reviewStatus === "APPROVED" ? (
          <button
            type="button"
            disabled={upsertMutation.isPending}
            onClick={() => save("WITHDRAW")}
            className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Thu hồi phát hành
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SummaryStatusBadge({ status, job }: { status: AdminLessonSummaryReviewStatus, job?: AdminAiPanelJob | null }) {
  if (job?.status === "QUEUED" || job?.status === "RUNNING") {
    const label = job.status === "QUEUED" ? "Đang chờ" : "Đang tạo";
    return (
      <span className="inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] text-[var(--theme-info-text)]">
        {label}
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
