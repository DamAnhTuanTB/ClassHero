"use client";

import { CheckCircle2, EyeOff, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { useAdminFlashcardSetMutations } from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

export function FlashcardSetReviewActions({
  approvedCardCount,
  isReviewingAll,
  lessonId,
  onReviewAll,
  pendingCardCount,
  reviewStatus,
  setId,
}: {
  approvedCardCount: number;
  isReviewingAll: boolean;
  lessonId: string;
  onReviewAll: () => void;
  pendingCardCount: number;
  reviewStatus: string;
  setId: string;
}) {
  const { reviewSet } = useAdminFlashcardSetMutations(lessonId);
  const isPending = reviewSet.isPending || isReviewingAll;
  const isPublishBlocked = approvedCardCount < 1;
  const currentReviewStatus =
    reviewStatus === "APPROVED" ||
    reviewStatus === "NEEDS_REVIEW" ||
    reviewStatus === "HIDDEN"
      ? reviewStatus
      : "NEEDS_REVIEW";

  async function runAction(
    action: "SAVE" | "PUBLISH" | "WITHDRAW",
    nextReviewStatus: "APPROVED" | "NEEDS_REVIEW" | "HIDDEN",
  ) {
    try {
      await reviewSet.mutateAsync({
        action,
        reviewStatus: nextReviewStatus,
        setId,
      });
      toast.success(
        action === "SAVE"
          ? "Đã lưu vào lượt phát hành gần nhất"
          : action === "PUBLISH"
            ? "Đã phát hành bộ Flashcard"
            : "Đã thu hồi phát hành bộ Flashcard",
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa cập nhật được trạng thái bộ Flashcard. Vui lòng thử lại.",
        ),
      );
    }
  }

  return (
    <div
      className="mt-3 flex max-w-full items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Hành động bộ Flashcard"
    >
      <button
        type="button"
        disabled={isPending || pendingCardCount === 0}
        onClick={onReviewAll}
        title={
          pendingCardCount === 0
            ? "Không còn thẻ AI chờ duyệt"
            : "Duyệt tất cả thẻ AI đang chờ duyệt trong bộ Flashcard này"
        }
        className="theme-button-success inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
      >
        {isReviewingAll ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
        )}
        Duyệt tất cả
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => void runAction("SAVE", currentReviewStatus)}
        className="theme-button-primary-subtle inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
      >
        {reviewSet.isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-3.5" aria-hidden="true" />
        )}
        Lưu
      </button>
      {reviewStatus !== "APPROVED" ? (
        <button
          type="button"
          disabled={isPending || isPublishBlocked}
          onClick={() => void runAction("PUBLISH", "APPROVED")}
          title={
            isPublishBlocked
              ? "Cần có ít nhất 1 thẻ Flashcard được duyệt để phát hành"
              : "Phát hành bộ Flashcard"
          }
          className="theme-button-primary inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          <Send className="size-3.5" aria-hidden="true" />
          Phát hành
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => void runAction("WITHDRAW", "HIDDEN")}
          className="theme-button-neutral inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60"
        >
          <EyeOff className="size-3.5" aria-hidden="true" />
          Thu hồi phát hành
        </button>
      )}
    </div>
  );
}
