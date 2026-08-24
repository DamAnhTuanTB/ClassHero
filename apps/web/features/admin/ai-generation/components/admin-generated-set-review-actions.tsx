"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, EyeOff, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { reviewAdminGeneratedSet } from "@/features/admin/ai-generation/api/admin-ai-generation-api";
import type {
  AdminAiGenerationType,
  AdminLessonSummaryReviewStatus,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

export function AdminGeneratedSetReviewActions({
  isReviewingAllPending = false,
  lessonId,
  onReviewAllPending,
  pendingReviewQuestionCount = 0,
  reviewStatus,
  setId,
  source,
  type,
  unpublishedApprovedQuestionCount = 0,
}: {
  isReviewingAllPending?: boolean;
  lessonId: string;
  onReviewAllPending?: () => void;
  pendingReviewQuestionCount?: number;
  reviewStatus: string;
  setId: string;
  source: string;
  type: Exclude<AdminAiGenerationType, "SUMMARY">;
  unpublishedApprovedQuestionCount?: number;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: {
      action?: "SAVE" | "PUBLISH" | "WITHDRAW";
      reviewStatus: AdminLessonSummaryReviewStatus;
    }) => reviewAdminGeneratedSet(type, setId, input.reviewStatus, token, input.action),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "flashcards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "tests"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "lessons", lessonId, "ai-generation-panel"],
        }),
      ]);
      toast.success(
        input.action === "SAVE"
          ? "Đã lưu nội dung bộ Quiz"
          : input.action === "PUBLISH"
            ? "Đã phát hành bộ Quiz"
            : input.action === "WITHDRAW"
              ? "Đã thu hồi phát hành bộ Quiz"
              : input.reviewStatus === "APPROVED"
                ? "Đã duyệt nội dung"
                : "Đã ẩn nội dung",
      );
    },
    onError: (error) => {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa cập nhật được trạng thái. Vui lòng thử lại.",
        ),
      );
    },
  });

  const isStandaloneAiSet = source === "AI";
  const isQuiz = type === "QUIZ";
  const isPublishBlocked = isQuiz && pendingReviewQuestionCount > 0;
  const currentReviewStatus: AdminLessonSummaryReviewStatus =
    reviewStatus === "NEEDS_REVIEW" ||
    reviewStatus === "APPROVED" ||
    reviewStatus === "HIDDEN"
      ? reviewStatus
      : "DRAFT";
  if (!isQuiz && !isStandaloneAiSet && pendingReviewQuestionCount === 0) {
    return null;
  }
  if (isQuiz) {
    const isActionPending = mutation.isPending || isReviewingAllPending;
    return (
      <div
        className="mt-3 flex max-w-full items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Hành động bộ Quiz"
      >
        <button
          type="button"
          disabled={isActionPending || pendingReviewQuestionCount === 0}
          onClick={onReviewAllPending}
          title={
            pendingReviewQuestionCount === 0
              ? "Không còn câu AI chờ duyệt"
              : "Duyệt tất cả câu AI đang chờ duyệt trong bộ Quiz này"
          }
          className="theme-button-success inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          {isReviewingAllPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Duyệt tất cả
        </button>
        <button
          type="button"
          disabled={isActionPending}
          onClick={() =>
            mutation.mutate({
              action: "SAVE",
              reviewStatus: currentReviewStatus,
            })
          }
          className="theme-button-primary-subtle inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Lưu
        </button>
        {reviewStatus !== "APPROVED" ? (
          <button
            type="button"
            disabled={isActionPending || isPublishBlocked}
            onClick={() =>
              mutation.mutate({
                action: "PUBLISH",
                reviewStatus: "APPROVED",
              })
            }
            title={
              isPublishBlocked
                ? "Cần duyệt hết câu hỏi trước khi phát hành bộ Quiz"
                : "Phát hành bộ Quiz"
            }
            className="theme-button-primary inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Phát hành
          </button>
        ) : (
          <button
            type="button"
            disabled={isActionPending}
            onClick={() =>
              mutation.mutate({
                action: "WITHDRAW",
                reviewStatus: "HIDDEN",
              })
            }
            className="theme-button-neutral inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            Thu hồi phát hành
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold",
          reviewStatus === "APPROVED"
            ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
            : reviewStatus === "NEEDS_REVIEW"
              ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
              : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
        )}
      >
        {pendingReviewQuestionCount > 0
          ? `${pendingReviewQuestionCount} câu AI cần duyệt`
          : reviewStatus === "APPROVED"
            ? isQuiz
              ? "Đã phát hành"
              : "Đã duyệt"
            : reviewStatus === "HIDDEN"
              ? "Đã ẩn"
              : "Cần duyệt"}
      </span>
      {reviewStatus !== "APPROVED" || pendingReviewQuestionCount > 0 ? (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ reviewStatus: "APPROVED" })}
          className="theme-button-primary-subtle inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Duyệt
        </button>
      ) : null}
      {isStandaloneAiSet && reviewStatus !== "HIDDEN" ? (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ reviewStatus: "HIDDEN" })}
          className="theme-button-neutral inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          Ẩn
        </button>
      ) : null}
    </div>
  );
}
