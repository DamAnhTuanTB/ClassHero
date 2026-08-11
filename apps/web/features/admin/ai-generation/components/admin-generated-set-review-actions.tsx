"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, EyeOff, Loader2 } from "lucide-react";
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
  lessonId,
  pendingReviewQuestionCount = 0,
  reviewStatus,
  setId,
  source,
  type,
}: {
  lessonId: string;
  pendingReviewQuestionCount?: number;
  reviewStatus: string;
  setId: string;
  source: string;
  type: Exclude<AdminAiGenerationType, "SUMMARY">;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (nextStatus: AdminLessonSummaryReviewStatus) =>
      reviewAdminGeneratedSet(type, setId, nextStatus, token),
    onSuccess: async (_data, nextStatus) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "flashcards"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "tests"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "lessons", lessonId, "ai-generation-panel"],
        }),
      ]);
      toast.success(nextStatus === "APPROVED" ? "Đã duyệt nội dung" : "Đã ẩn nội dung");
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
  if (!isStandaloneAiSet && pendingReviewQuestionCount === 0) {
    return null;
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
            ? "Đã duyệt"
            : reviewStatus === "HIDDEN"
              ? "Đã ẩn"
              : "Cần duyệt"}
      </span>
      {reviewStatus !== "APPROVED" || pendingReviewQuestionCount > 0 ? (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("APPROVED")}
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
          onClick={() => mutation.mutate("HIDDEN")}
          className="theme-button-neutral inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          Ẩn
        </button>
      ) : null}
    </div>
  );
}
