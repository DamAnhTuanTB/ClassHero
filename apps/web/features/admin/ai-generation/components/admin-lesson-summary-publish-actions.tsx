"use client";

import { EyeOff, Loader2, Save, Send } from "lucide-react";
import type { AdminLessonSummaryReviewStatus } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type SummarySaveAction = "SAVE" | "PUBLISH" | "WITHDRAW";

export function AdminLessonSummaryPublishActions({
  compact = false,
  figureActionsBlocked,
  figureBlockerTitle,
  isPending,
  reviewStatus,
  onSave,
}: {
  compact?: boolean;
  figureActionsBlocked: boolean;
  figureBlockerTitle?: string;
  isPending: boolean;
  reviewStatus?: AdminLessonSummaryReviewStatus;
  onSave: (action: SummarySaveAction) => void;
}) {
  const saveButtonSize = compact ? "min-h-10 px-3" : "min-h-11 px-4";
  const publishButtonSize = compact ? "min-h-10 px-3" : "min-h-11 px-5";

  return (
    <>
      <button
        type="button"
        disabled={isPending || figureActionsBlocked}
        onClick={() => onSave("SAVE")}
        title={figureBlockerTitle}
        className={`theme-button-primary-subtle inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-extrabold disabled:opacity-60 ${saveButtonSize}`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-4 w-4" aria-hidden="true" />
        )}
        Lưu nội dung
      </button>

      {reviewStatus !== "APPROVED" ? (
        <button
          type="button"
          disabled={isPending || figureActionsBlocked}
          onClick={() => onSave("PUBLISH")}
          title={figureBlockerTitle ?? "Phát hành tóm tắt"}
          className={`theme-button-primary inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-extrabold disabled:opacity-60 ${publishButtonSize}`}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Phát hành
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSave("WITHDRAW")}
          className={`theme-button-neutral inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-extrabold disabled:opacity-60 ${saveButtonSize}`}
        >
          <EyeOff className="h-4 w-4" aria-hidden="true" />
          Thu hồi phát hành
        </button>
      )}
    </>
  );
}
