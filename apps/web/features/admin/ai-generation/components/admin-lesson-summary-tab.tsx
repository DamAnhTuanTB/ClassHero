"use client";

import { EyeOff, Loader2, RefreshCw, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import {
  useAdminLessonSummary,
  useUpsertAdminLessonSummary,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type { AdminLessonSummaryReviewStatus } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import {
  createEmptyTiptapDocument,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import type { TiptapTextDocument } from "@/types/rich-text";

export function AdminLessonSummaryTab({
  lessonId,
  onRegenerate,
}: {
  lessonId: string;
  onRegenerate: () => void;
}) {
  const summaryQuery = useAdminLessonSummary(lessonId);
  const upsertMutation = useUpsertAdminLessonSummary(lessonId);
  const [content, setContent] = useState<TiptapTextDocument>(createEmptyTiptapDocument());
  const [contentError, setContentError] = useState<string>();

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
    if (!hasTiptapDocumentContent(content)) {
      setContentError("Nhập nội dung tóm tắt trước khi lưu");
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
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Tóm tắt buổi học
          </h3>
          {summary ? <SummaryStatusBadge status={summary.reviewStatus} /> : null}
        </div>
        <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
          Lưu bản chỉnh sửa, sau đó phát hành khi nội dung đã sẵn sàng cho học sinh.
        </p>
      </div>

      <QuizRichContentEditor
        ariaLabel="Nội dung tóm tắt buổi học"
        disabled={upsertMutation.isPending}
        error={contentError}
        placeholder="Nhập các ý chính, công thức, ví dụ và câu hỏi ôn tập..."
        value={content}
        onBlur={() => {
          if (!hasTiptapDocumentContent(content)) {
            setContentError("Nhập nội dung tóm tắt trước khi lưu");
          }
        }}
        onChange={(value) => {
          setContent(value);
          if (hasTiptapDocumentContent(value)) {
            setContentError(undefined);
          }
        }}
      />

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--theme-border)] pt-4 sm:flex-row sm:justify-end">
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
        <button
          type="button"
          disabled={upsertMutation.isPending}
          onClick={onRegenerate}
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {summary ? "Sinh lại" : "Sinh tóm tắt"}
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
      </div>
    </div>
  );
}

function SummaryStatusBadge({ status }: { status: AdminLessonSummaryReviewStatus }) {
  const copy = {
    DRAFT: "Bản nháp",
    NEEDS_REVIEW: "Bản nháp",
    APPROVED: "Đã phát hành",
    HIDDEN: "Đã thu hồi",
  }[status];
  const className =
    status === "APPROVED"
      ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
      : status === "NEEDS_REVIEW"
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
