"use client";

import {
  CheckCircle2,
  Coins,
  FileQuestion,
  Gauge,
  Images,
  Layers,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type Ref } from "react";
import { toast } from "sonner";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import type {
  AdminFlashcard,
  AdminFlashcardSet,
  FlashcardItemDifficulty,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import {
  useAdminFlashcardMutations,
  useAdminFlashcards,
} from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { FlashcardCardNavigation } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-card-navigation";
import {
  FlashcardCardRow,
  type FlashcardViewMode,
} from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-card-row";
import { FlashcardSetReviewActions } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-set-review-actions";
import {
  collectFlashcardContentImages,
  flashcardDifficultyBadgeClassName,
  flashcardDifficultyLabels,
} from "@/features/admin/flashcards/screens/admin-flashcards-tab/utils/flashcard-presentation";
import { getQueryRenderState } from "@/lib/query-render-state";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

const AdminFlashcardGenerationHistoryDialog = dynamic(
  () =>
    import("@/features/admin/flashcards/screens/admin-flashcards-tab/components/admin-flashcard-generation-history-dialog").then(
      (module) => module.AdminFlashcardGenerationHistoryDialog,
    ),
  { ssr: false },
);

const AdminFlashcardImageOverviewDialog = dynamic(
  () =>
    import("@/features/admin/flashcards/screens/admin-flashcards-tab/components/admin-flashcard-image-overview-dialog").then(
      (module) => module.AdminFlashcardImageOverviewDialog,
    ),
  { ssr: false },
);

export interface FlashcardSetCounts {
  approved: number;
  pending: number;
  total: number;
}

export function FlashcardSetPanel({
  minHeight,
  panelRef,
  set,
  onAddCard,
  onCountsChange,
  onDeleteCard,
  onDeleteSet,
  onEditCard,
  onEditSet,
}: {
  minHeight: number;
  panelRef: Ref<HTMLElement>;
  set: AdminFlashcardSet;
  onAddCard: () => void;
  onCountsChange: (setId: string, counts: FlashcardSetCounts) => void;
  onDeleteCard: (card: AdminFlashcard) => void;
  onDeleteSet: () => void;
  onEditCard: (card: AdminFlashcard) => void;
  onEditSet: () => void;
}) {
  const cardsQuery = useAdminFlashcards(set.id);
  const { reviewAllPendingAiCards, reviewCard, uploadSolutionFigure } =
    useAdminFlashcardMutations(set.id, set.lessonId);
  const { data: cards, refetch } = cardsQuery;
  const queryRenderState = getQueryRenderState(cardsQuery);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [isGenerationHistoryOpen, setIsGenerationHistoryOpen] = useState(false);
  const [isImageOverviewOpen, setIsImageOverviewOpen] = useState(false);
  const [cardViewMode, setCardViewMode] = useState<FlashcardViewMode>("UI_ONLY");

  const approvedCards = useMemo(
    () => cards?.filter((card) => card.reviewStatus === "APPROVED") ?? [],
    [cards],
  );
  const pendingCards = useMemo(
    () => cards?.filter((card) => card.reviewStatus === "NEEDS_REVIEW") ?? [],
    [cards],
  );
  const navigableCards = useMemo(
    () => [...pendingCards, ...approvedCards],
    [approvedCards, pendingCards],
  );
  const images = useMemo(
    () => collectFlashcardContentImages(navigableCards),
    [navigableCards],
  );
  const difficultyCounts = useMemo(
    () =>
      navigableCards.reduce<Record<FlashcardItemDifficulty, number>>(
        (counts, card) => {
          counts[card.difficulty] += 1;
          return counts;
        },
        { EASY: 0, HARD: 0, MEDIUM: 0 },
      ),
    [navigableCards],
  );
  const selectedCardIndex = navigableCards.findIndex(
    (card) => card.id === selectedCardId,
  );
  const selectedCard = navigableCards[selectedCardIndex];
  const selectedDisplayIndex = selectedCard
    ? selectedCard.reviewStatus === "NEEDS_REVIEW"
      ? pendingCards.findIndex((card) => card.id === selectedCard.id)
      : approvedCards.findIndex((card) => card.id === selectedCard.id)
    : -1;

  useEffect(() => {
    if (!navigableCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(navigableCards[0]?.id ?? "");
    }
  }, [navigableCards, selectedCardId]);

  useEffect(() => {
    onCountsChange(set.id, {
      approved: approvedCards.length,
      pending: pendingCards.length,
      total: navigableCards.length,
    });
  }, [
    approvedCards.length,
    navigableCards.length,
    onCountsChange,
    pendingCards.length,
    set.id,
  ]);

  const selectRelativeCard = useCallback(
    (offset: -1 | 1) => {
      if (navigableCards.length < 2 || selectedCardIndex < 0) return false;
      const nextIndex =
        (selectedCardIndex + offset + navigableCards.length) % navigableCards.length;
      const nextCard = navigableCards[nextIndex];
      if (!nextCard) return false;

      const scrollPosition = {
        left: window.scrollX,
        top: window.scrollY,
      };
      setSelectedCardId(nextCard.id);
      requestAnimationFrame(() => {
        window.scrollTo({
          ...scrollPosition,
          behavior: "auto",
        });
      });
      return true;
    }, [navigableCards, selectedCardIndex],
  );

  useEffect(() => {
    function handleFlashcardShortcut(event: globalThis.KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        document.querySelector('[role="dialog"][aria-modal="true"]') ||
        isFlashcardNavigationShortcutTarget(event.target)
      ) {
        return;
      }

      const didNavigate = selectRelativeCard(event.key === "ArrowLeft" ? -1 : 1);
      if (didNavigate) event.preventDefault();
    }

    window.addEventListener("keydown", handleFlashcardShortcut);
    return () => window.removeEventListener("keydown", handleFlashcardShortcut);
  }, [selectRelativeCard]);

  async function handleReviewAll() {
    try {
      const result = await reviewAllPendingAiCards.mutateAsync();
      toast.success(`Đã duyệt ${result.approvedCardCount} thẻ Flashcard do AI tạo`);
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa thể duyệt toàn bộ thẻ Flashcard."),
      );
    }
  }

  return (
    <section
      ref={panelRef}
      id={`flashcard-set-panel-${set.id}`}
      role="tabpanel"
      className="space-y-3"
      style={{ minHeight: minHeight || undefined }}
    >
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--theme-border)] bg-white p-4 shadow-sm dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              {set.title}
            </h4>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setIsGenerationHistoryOpen(true)}
              className="-m-1 inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md p-1 text-sm font-extrabold text-[var(--theme-text-muted)] transition-colors hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
              title="Xem toàn bộ lịch sử sinh và chi phí của bộ Flashcard"
            >
              <Coins className="size-4" aria-hidden="true" />
              Tổng chi phí: {formatGenerationCost(set)}
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setIsImageOverviewOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 text-xs font-extrabold tabular-nums text-[var(--theme-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:border-sky-700 dark:hover:bg-sky-950/50 dark:hover:text-sky-200"
            >
              <Images className="size-3.5" aria-hidden="true" />
              Tổng {images.length} ảnh
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2" aria-label="Thống kê bộ Flashcard">
            <SummaryMetric icon={FileQuestion} label="Tổng thẻ" value={navigableCards.length} />
            <SummaryMetric
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-300"
              icon={CheckCircle2}
              label="Đã duyệt"
              value={approvedCards.length}
            />
            <SummaryMetric
              className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-300"
              icon={Sparkles}
              label="AI chờ duyệt"
              value={pendingCards.length}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Thống kê mức độ Flashcard">
            <span className="inline-flex min-h-8 items-center gap-1.5 pr-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
              <Gauge className="size-4" aria-hidden="true" />
              Mức độ
            </span>
            {(["EASY", "MEDIUM", "HARD"] as const).map((difficulty) => (
              <span
                key={difficulty}
                className={cn(
                  "inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 text-xs font-extrabold",
                  flashcardDifficultyBadgeClassName(difficulty),
                )}
              >
                {flashcardDifficultyLabels[difficulty]}
                <strong className="text-sm font-black">
                  {difficultyCounts[difficulty]}
                </strong>
              </span>
            ))}
          </div>

          <FlashcardSetReviewActions
            approvedCardCount={approvedCards.length}
            isReviewingAll={reviewAllPendingAiCards.isPending}
            lessonId={set.lessonId}
            onReviewAll={() => void handleReviewAll()}
            pendingCardCount={pendingCards.length}
            reviewStatus={set.reviewStatus}
            setId={set.id}
          />

          {(set.unpublishedApprovedCardCount ?? 0) > 0 ? (
            <div
              className="relative mt-3 flex max-w-xl items-start gap-3 overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-blue-50/70 to-white px-4 py-3 text-sky-950 shadow-sm dark:border-sky-800/80 dark:from-sky-950/70 dark:via-blue-950/50 dark:to-slate-950 dark:text-sky-100"
              aria-live="polite"
              data-testid="flashcard-unsaved-approved-warning"
              role="status"
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-sky-500 dark:bg-sky-400" aria-hidden="true" />
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950">
                <Save className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                <strong className="block font-black text-sky-800 dark:text-sky-200">
                  Có thay đổi chưa lưu
                </strong>
                Bạn đã duyệt thêm {set.unpublishedApprovedCardCount} thẻ. Nhớ nhấn{" "}
                <strong className="rounded bg-sky-100 px-1.5 py-0.5 font-black text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                  Lưu
                </strong>{" "}
                để cập nhật lượt phát hành gần nhất cho học sinh.
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-2 sm:flex">
          <button
            type="button"
            onClick={onAddCard}
            className="theme-button-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold sm:flex-none sm:px-4"
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm flashcard
          </button>
          <button
            type="button"
            onClick={onEditSet}
            className="theme-button-primary-subtle grid size-10 place-items-center rounded-lg"
            aria-label={`Sửa ${set.title}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDeleteSet}
            className="theme-button-danger-subtle grid size-10 place-items-center rounded-lg"
            aria-label={`Xóa ${set.title}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {queryRenderState === "loading" ? (
        <CardsSkeleton />
      ) : queryRenderState === "error" ? (
        <AdminDataErrorState
          description="Vui lòng thử lại để tiếp tục quản lý các thẻ trong bộ này."
          headingLevel={4}
          isRetrying={cardsQuery.isFetching}
          onRetry={() => refetch()}
          title="Không tải được flashcard của bộ này"
          variant="compact"
        />
      ) : navigableCards.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-[var(--theme-border)] px-4 py-10 text-center">
          <Layers className="size-9 text-[var(--theme-text-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
            Bộ này chưa có flashcard
          </p>
          <button
            type="button"
            onClick={onAddCard}
            className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-extrabold"
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm flashcard
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <FlashcardCardNavigation
            approvedCards={approvedCards}
            onSelect={setSelectedCardId}
            pendingCards={pendingCards}
            selectedCardId={selectedCardId}
          />
          {selectedCard ? (
            <FlashcardCardRow
              card={selectedCard}
              index={selectedDisplayIndex}
              viewMode={cardViewMode}
              onViewModeChange={setCardViewMode}
              isNavigationDisabled={navigableCards.length < 2}
              isReviewing={
                reviewCard.isPending &&
                reviewCard.variables?.flashcardId === selectedCard.id
              }
              isUploadingSolutionFigure={
                uploadSolutionFigure.isPending &&
                uploadSolutionFigure.variables?.flashcardId === selectedCard.id
              }
              onDelete={onDeleteCard}
              onEdit={onEditCard}
              onNext={() => selectRelativeCard(1)}
              onPrevious={() => selectRelativeCard(-1)}
              onUploadSolutionFigure={(file) => {
                void uploadSolutionFigure
                  .mutateAsync({
                    flashcardId: selectedCard.id,
                    file,
                    altText: "Hình minh họa lời giải Flashcard",
                  })
                  .then(() => toast.success("Đã tải ảnh lời giải lên."))
                  .catch((error: unknown) =>
                    toast.error(
                      getUserFacingErrorMessage(
                        error,
                        "Chưa tải được ảnh lời giải.",
                      ),
                    ),
                  );
              }}
              onReview={(target) => {
                void reviewCard
                  .mutateAsync({
                    flashcardId: target.id,
                    reviewStatus: "APPROVED",
                  })
                  .then(() => toast.success("Đã duyệt flashcard"))
                  .catch((error: unknown) =>
                    toast.error(
                      getUserFacingErrorMessage(error, "Chưa thể duyệt flashcard."),
                    ),
                  );
              }}
            />
          ) : null}
        </div>
      )}

      {isGenerationHistoryOpen ? (
        <AdminFlashcardGenerationHistoryDialog
          flashcardSet={set}
          isOpen
          onClose={() => setIsGenerationHistoryOpen(false)}
        />
      ) : null}
      {isImageOverviewOpen ? (
        <AdminFlashcardImageOverviewDialog
          images={images}
          isOpen
          onClose={() => setIsImageOverviewOpen(false)}
          onSelectCard={setSelectedCardId}
        />
      ) : null}
    </section>
  );
}

function SummaryMetric({
  className,
  icon: Icon,
  label,
  value,
}: {
  className?: string;
  icon: typeof FileQuestion;
  label: string;
  value: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 text-xs font-bold text-[var(--theme-text-muted)]",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
      <strong className="text-sm font-black text-current">{value}</strong>
    </span>
  );
}

function CardsSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <SkeletonBlock className="h-16 w-full rounded-xl" />
      <SkeletonBlock className="h-72 w-full rounded-xl" />
    </div>
  );
}

function formatGenerationCost(set: AdminFlashcardSet) {
  const cost = (set.aiGenerations ?? []).reduce(
    (total, generation) => total + generation.totalCostVnd,
    0,
  );
  return `${new Intl.NumberFormat("vi-VN").format(cost)} VNĐ`;
}

function isFlashcardNavigationShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-flashcard-card-shortcut]")) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, math-field, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], [role="spinbutton"], [role="tablist"], [role="tree"]',
    ),
  );
}
