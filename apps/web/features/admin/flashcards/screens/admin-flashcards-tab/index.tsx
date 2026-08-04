"use client";

import dynamic from "next/dynamic";
import { Layers, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import type {
  AdminFlashcard,
  AdminFlashcardSet,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import {
  useAdminFlashcardMutations,
  useAdminFlashcardSetMutations,
  useAdminFlashcardSets,
} from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { FlashcardSetPanel } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-set-panel";
import { FlashcardSetTabs } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-set-tabs";
import { getQueryRenderState } from "@/lib/query-render-state";
import { useStableTabPanelHeight } from "@/lib/use-stable-tab-panel-height";
import { getTiptapDocumentText } from "@/lib/tiptap-rich-content";

const FlashcardSetEditorDialog = dynamic(() =>
  import("@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-set-editor-dialog").then(
    (module) => module.FlashcardSetEditorDialog,
  ),
);
const FlashcardEditorDialog = dynamic(() =>
  import("@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-editor-dialog").then(
    (module) => module.FlashcardEditorDialog,
  ),
);

type DeleteTarget =
  | { type: "set"; id: string; label: string }
  | { type: "card"; id: string; label: string }
  | null;

export function AdminFlashcardsTab({
  lessonId,
  preferredSetId,
}: {
  lessonId: string;
  preferredSetId?: string;
}) {
  const setsQuery = useAdminFlashcardSets(lessonId);
  const { data: sets, refetch } = setsQuery;
  const queryRenderState = getQueryRenderState(setsQuery);
  const { deleteSet } = useAdminFlashcardSetMutations(lessonId);
  const [selectedSetId, setSelectedSetId] = useState("");
  const appliedPreferredSetIdRef = useRef<string | null>(null);
  const [setEditorTarget, setSetEditorTarget] = useState<
    AdminFlashcardSet | null | undefined
  >(undefined);
  const [cardEditorTarget, setCardEditorTarget] = useState<
    AdminFlashcard | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const {
    minHeight: flashcardSetPanelMinHeight,
    panelRef: flashcardSetPanelRef,
    preserveCurrentHeight: preserveFlashcardSetPanelHeight,
  } = useStableTabPanelHeight();
  const handleSelectSet = useCallback(
    (setId: string) => {
      if (setId === selectedSetId) {
        return;
      }

      preserveFlashcardSetPanelHeight();
      setSelectedSetId(setId);
    },
    [preserveFlashcardSetPanelHeight, selectedSetId],
  );

  useEffect(() => {
    if (!sets?.length) {
      setSelectedSetId("");
      return;
    }
    if (!sets.some((set) => set.id === selectedSetId)) {
      handleSelectSet(sets[0]?.id ?? "");
    }
  }, [handleSelectSet, selectedSetId, sets]);

  useEffect(() => {
    if (
      !preferredSetId ||
      appliedPreferredSetIdRef.current === preferredSetId ||
      !sets?.some((set) => set.id === preferredSetId)
    ) {
      return;
    }
    appliedPreferredSetIdRef.current = preferredSetId;
    handleSelectSet(preferredSetId);
  }, [handleSelectSet, preferredSetId, sets]);

  const activeSet = useMemo(
    () => sets?.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets],
  );
  const { deleteCard } = useAdminFlashcardMutations(selectedSetId, lessonId);

  if (queryRenderState === "loading") {
    return <FlashcardSetsSkeleton />;
  }

  if (queryRenderState === "error") {
    return (
      <AdminDataErrorState
        description="Vui lòng thử lại để tiếp tục quản lý các bộ flashcard."
        headingLevel={3}
        isRetrying={setsQuery.isFetching}
        onRetry={() => refetch()}
        title="Không tải được danh sách bộ flashcard"
        variant="section"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Quản lý Flashcard
          </h3>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            Tạo nhiều bộ thẻ ghi nhớ cho buổi học này.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSetEditorTarget(null)}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm bộ flashcard
        </button>
      </div>

      {!sets?.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--theme-border)] px-5 py-10 text-center">
          <Layers
            className="h-10 w-10 text-[var(--theme-text-muted)]"
            aria-hidden="true"
          />
          <p className="mt-3 text-base font-extrabold text-[var(--theme-text-strong)]">
            Chưa có bộ flashcard
          </p>
          <p className="mt-1 max-w-md text-sm text-[var(--theme-text-muted)]">
            Tạo bộ đầu tiên để thêm các thẻ mặt trước, mặt sau và lời giải chi tiết.
          </p>
          <button
            type="button"
            onClick={() => setSetEditorTarget(null)}
            className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo bộ flashcard
          </button>
        </div>
      ) : (
        <>
          <FlashcardSetTabs
            activeSetId={selectedSetId}
            sets={sets}
            onSelect={handleSelectSet}
          />
          {activeSet ? (
            <FlashcardSetPanel
              minHeight={flashcardSetPanelMinHeight}
              panelRef={flashcardSetPanelRef}
              set={activeSet}
              onAddCard={() => setCardEditorTarget(null)}
              onDeleteCard={(card) =>
                setDeleteTarget({
                  type: "card",
                  id: card.id,
                  label: getTiptapDocumentText(card.frontJson) || "flashcard này",
                })
              }
              onDeleteSet={() =>
                setDeleteTarget({
                  type: "set",
                  id: activeSet.id,
                  label: activeSet.title,
                })
              }
              onEditCard={setCardEditorTarget}
              onEditSet={() => setSetEditorTarget(activeSet)}
            />
          ) : null}
        </>
      )}

      {setEditorTarget !== undefined ? (
        <FlashcardSetEditorDialog
          defaultTitle={getNextFlashcardSetTitle(sets)}
          isOpen
          lessonId={lessonId}
          set={setEditorTarget}
          onClose={() => setSetEditorTarget(undefined)}
          onSaved={(savedSet) => handleSelectSet(savedSet.id)}
        />
      ) : null}

      {activeSet && cardEditorTarget !== undefined ? (
        <FlashcardEditorDialog
          card={cardEditorTarget}
          isOpen
          lessonId={lessonId}
          setId={activeSet.id}
          onClose={() => setCardEditorTarget(undefined)}
        />
      ) : null}

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        isConfirming={deleteSet.isPending || deleteCard.isPending}
        itemName={deleteTarget?.label ?? ""}
        title={deleteTarget?.type === "set" ? "Xóa bộ flashcard" : "Xóa flashcard"}
        description={
          deleteTarget?.type === "set"
            ? `Toàn bộ flashcard trong “${deleteTarget.label}” sẽ bị xóa khỏi buổi học.`
            : `Flashcard “${deleteTarget?.label ?? ""}” sẽ bị xóa khỏi bộ này.`
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === "set") {
              await deleteSet.mutateAsync(deleteTarget.id);
              toast.success("Đã xóa bộ flashcard");
            } else {
              await deleteCard.mutateAsync(deleteTarget.id);
              toast.success("Đã xóa flashcard");
            }
            setDeleteTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Chưa xóa được dữ liệu");
          }
        }}
      />
    </div>
  );
}

function FlashcardSetsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải các bộ flashcard"
      className="min-h-64 animate-pulse space-y-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-48 rounded-full" />
          <SkeletonBlock className="h-4 w-72 max-w-full rounded-full opacity-70" />
        </div>
        <SkeletonBlock className="h-11 w-44 rounded-lg" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        <SkeletonBlock className="h-10 w-36 shrink-0 rounded-lg" />
        <SkeletonBlock className="h-10 w-36 shrink-0 rounded-lg" />
        <SkeletonBlock className="h-10 w-36 shrink-0 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--theme-border)] p-5">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-40 rounded-full" />
            <SkeletonBlock className="h-3.5 w-24 rounded-full opacity-70" />
          </div>
          <SkeletonBlock className="h-10 w-36 rounded-lg" />
        </div>
        <FlashcardRowsSkeleton />
      </div>
    </div>
  );
}

function FlashcardRowsSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-[2rem_minmax(0,1fr)_5rem] items-center gap-3 border-b border-[var(--theme-border)] p-4 last:border-b-0"
        >
          <SkeletonBlock className="h-7 w-7 rounded-lg" />
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-2/5 rounded-full" />
            <SkeletonBlock className="h-3.5 w-3/5 rounded-full opacity-70" />
          </div>
          <SkeletonBlock className="h-9 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function getNextFlashcardSetTitle(sets: AdminFlashcardSet[] | undefined) {
  const latestNumber =
    sets?.reduce((highestNumber, set) => {
      const match = /^Bộ flashcard\s+(\d+)$/iu.exec(set.title.trim());
      const currentNumber = match?.[1] ? Number.parseInt(match[1], 10) : 0;
      return Math.max(highestNumber, currentNumber);
    }, 0) ?? 0;

  return `Bộ flashcard ${latestNumber + 1}`;
}
