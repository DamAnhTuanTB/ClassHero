"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Columns,
  LayoutTemplate,
  Loader2,
  Pencil,
  PlayCircle,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { AdminFigureCandidateProgress } from "@/components/admin/admin-figure-candidate-progress";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import type {
  AdminFlashcard,
  AdminFlashcardFigure,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import { FlashcardFigureAiMenu } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-figure-ai-menu";
import {
  flashcardDifficultyBadgeClassName,
  flashcardDifficultyLabels,
} from "@/features/admin/flashcards/screens/admin-flashcards-tab/utils/flashcard-presentation";
import { cn } from "@/lib/utils";

export type FlashcardViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";

export function FlashcardCardRow({
  card,
  index,
  onDelete,
  onEdit,
  onNext,
  onPrevious,
  onReview,
  onViewModeChange,
  viewMode,
  isReviewing,
  isNavigationDisabled,
  isUploadingSolutionFigure,
  onUploadSolutionFigure,
}: {
  card: AdminFlashcard;
  index: number;
  isNavigationDisabled: boolean;
  onDelete: (card: AdminFlashcard) => void;
  onEdit: (card: AdminFlashcard) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReview: (card: AdminFlashcard, reviewStatus: "APPROVED" | "NEEDS_REVIEW") => void;
  onViewModeChange: (mode: FlashcardViewMode) => void;
  viewMode: FlashcardViewMode;
  isReviewing: boolean;
  isUploadingSolutionFigure: boolean;
  onUploadSolutionFigure: (file: File) => void;
}) {
  const isAiCard = Boolean(card.sourceMetadataJson?.aiGenerationId);
  const generationJson = {
    difficulty: card.difficulty,
    front: card.frontJson,
    back: card.backJson,
    solution: card.solutionJson,
    requiresSolutionFigure: card.sourceMetadataJson?.requiresSolutionFigure === true,
    sourcePacketPageNumbers: card.sourceMetadataJson?.sourcePacketPageNumbers ?? [],
  };

  return (
    <div className="space-y-2">
      {isAiCard ? (
        <div className="flex justify-end">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {(
              [
                ["UI_ONLY", "Chỉ xem UI", LayoutTemplate],
                ["JSON_ONLY", "Chỉ xem JSON", Code2],
                ["SPLIT", "Song song", Columns],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                title={label}
                aria-pressed={viewMode === mode}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  viewMode === mode
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <article
        id={`flashcard-card-${card.id}`}
        role="tabpanel"
        className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white shadow-sm dark:bg-slate-950"
      >
        <div className="space-y-3 border-b border-[var(--theme-border)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {isAiCard ? (
                <span className="theme-button-primary-subtle inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  AI
                </span>
              ) : null}
              <button
                type="button"
                disabled={isReviewing}
                onClick={() =>
                  onReview(
                    card,
                    card.reviewStatus === "APPROVED" ? "NEEDS_REVIEW" : "APPROVED",
                  )
                }
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold disabled:opacity-60",
                  card.reviewStatus === "APPROVED"
                    ? "theme-button-neutral"
                    : "theme-button-primary-subtle",
                )}
                aria-keyshortcuts={
                  isAiCard && card.reviewStatus !== "APPROVED" ? "Enter" : undefined
                }
              >
                {isReviewing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : card.reviewStatus === "APPROVED" ? (
                  <Undo2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                )}
                {isReviewing
                  ? card.reviewStatus === "APPROVED"
                    ? "Đang hủy duyệt"
                    : "Đang duyệt"
                  : card.reviewStatus === "APPROVED"
                    ? "Hủy duyệt"
                    : "Duyệt"}
              </button>
            </div>
            <div className="ml-auto flex shrink-0 gap-2">
              {isAiCard ? (
                <FlashcardFigureAiMenu
                  card={card}
                  cardIndex={index}
                  isUploadingSolutionFigure={isUploadingSolutionFigure}
                  onUploadSolutionFigure={onUploadSolutionFigure}
                />
              ) : null}
              <button
                type="button"
                aria-label={`Sửa flashcard ${index + 1}`}
                onClick={() => onEdit(card)}
                className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Xóa flashcard ${index + 1}`}
                onClick={() => onDelete(card)}
                className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-lg"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Thẻ trước"
                aria-keyshortcuts="ArrowLeft"
                disabled={isNavigationDisabled}
                onClick={onPrevious}
                className="theme-button-neutral grid h-10 w-10 place-items-center rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Thẻ sau"
                aria-keyshortcuts="ArrowRight"
                disabled={isNavigationDisabled}
                onClick={onNext}
                className="theme-button-neutral grid h-10 w-10 place-items-center rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-primary)]">
              Flashcard {index + 1}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold",
                flashcardDifficultyBadgeClassName(card.difficulty),
              )}
            >
              {flashcardDifficultyLabels[card.difficulty]}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-4 sm:p-5",
            isAiCard && viewMode === "SPLIT" && "grid gap-4 xl:grid-cols-2",
          )}
        >
          {!isAiCard || viewMode !== "JSON_ONLY" ? (
            <FlashcardUi card={card} isSplit={isAiCard && viewMode === "SPLIT"} />
          ) : null}
          {isAiCard && viewMode !== "UI_ONLY" ? (
            <section
              aria-label={`JSON flashcard ${index + 1}`}
              className="min-w-0 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950"
            >
              <AdminAiJsonInputViewer data={generationJson} />
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function FlashcardUi({
  card,
  isSplit = false,
}: {
  card: AdminFlashcard;
  isSplit?: boolean;
}) {
  const solutionFigure = card.figures?.find((figure) => figure.role === "SOLUTION");
  return (
    <div
      className={cn(
        "min-w-0 space-y-4",
        isSplit &&
          "rounded-xl border border-[var(--theme-border)] bg-white p-4 dark:bg-slate-950",
      )}
    >
      <div className="rounded-lg border border-[var(--theme-border)] bg-transparent p-3">
        <p className="text-xs font-bold text-[var(--theme-text-muted)]">Mặt trước</p>
        <TiptapContentView
          className="mt-1 text-base font-normal text-[var(--theme-text-strong)]"
          content={card.frontJson}
          contentAlignment="left"
        />
      </div>
      <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
        <p className="text-xs font-bold text-[var(--theme-text-muted)]">Mặt sau</p>
        <TiptapContentView
          className="mt-1 text-sm font-normal text-[var(--theme-text-strong)]"
          content={card.backJson}
          contentAlignment="left"
        />
      </div>
      {card.solutionJson || solutionFigure ? (
        <div className="learning-content-text rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-900/10">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-sky-600/70 dark:text-sky-400/70">
            <PlayCircle className="size-4 shrink-0" aria-hidden="true" />
            Lời giải
          </div>
          <FlashcardFigure figure={solutionFigure} side="lời giải" />
          {card.solutionJson ? (
            <div className="mt-3 border-l-[3px] border-sky-500/30 pl-4 dark:border-sky-400/30">
              <TiptapContentView
                ariaLabel="Lời giải Flashcard"
                className="text-sm leading-relaxed text-slate-800 opacity-90 dark:text-slate-200"
                content={card.solutionJson}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FlashcardFigure({
  figure,
  side,
}: {
  figure: AdminFlashcardFigure | undefined;
  side: string;
}) {
  const source = figure?.currentRevision?.deliveryFile?.publicUrl;
  const isProcessing = figure?.status === "QUEUED" || figure?.status === "RENDERING";

  if (source) {
    return (
      <div className="mx-auto mt-3 w-full max-w-2xl">
        <figure className="w-full rounded-xl border border-[var(--theme-border)] bg-white p-3 shadow-sm dark:bg-white">
          <img
            alt={figure.currentRevision?.altText ?? `Hình ${side} Flashcard`}
            className="mx-auto max-h-[28rem] w-full object-contain"
            decoding="async"
            loading="lazy"
            src={source}
          />
          {figure.currentRevision?.caption ? (
            <figcaption className="mt-2 text-center text-sm font-medium leading-relaxed text-slate-600">
              {figure.currentRevision.caption}
            </figcaption>
          ) : null}
        </figure>
        {isProcessing ? <AdminFigureCandidateProgress /> : null}
      </div>
    );
  }
  if (isProcessing) {
    return (
      <p
        aria-live="polite"
        className="mx-auto mt-3 flex min-h-20 w-full max-w-2xl items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
        role="status"
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Đang tạo hình cho {side}
      </p>
    );
  }
  if (figure?.lastErrorMessage) {
    return (
      <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        Chưa tạo được hình {side}: {figure.lastErrorMessage}
      </p>
    );
  }
  return null;
}
