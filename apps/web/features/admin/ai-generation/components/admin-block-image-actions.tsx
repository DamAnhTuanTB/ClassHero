"use client";

import dynamic from "next/dynamic";
import { Bot, Code2, Image as ImageIcon, ImageUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useCreateNewAdminStemFigure,
  useEnsureAdminStemFigureForBlock,
  useReplaceAdminStemFigure,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminStemFigure,
  AdminStemFigureReferenceImageMode,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const StemFigureCreateAiDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-create-ai-dialog").then(
      (module) => module.AdminStemFigureCreateAiDialog,
    ),
  { ssr: false },
);
const StemFigureEditorDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-editor-dialog").then(
      (module) => module.AdminStemFigureEditorDialog,
    ),
  { ssr: false },
);
export function AdminBlockImageActions({
  blockPath,
  figures,
  lessonId,
}: {
  blockPath: string;
  figures: AdminStemFigure[];
  lessonId: string;
}) {
  const ensureMutation = useEnsureAdminStemFigureForBlock(lessonId);
  const createMutation = useCreateNewAdminStemFigure(lessonId);
  const replaceMutation = useReplaceAdminStemFigure(lessonId);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(
    figures.length === 1 ? (figures[0]?.id ?? "") : "",
  );
  const [dialog, setDialog] = useState<"ai" | "code" | null>(null);
  const [target, setTarget] = useState<AdminStemFigure | null>(null);

  useEffect(() => {
    if (figures.length === 1) setSelectedId(figures[0]?.id ?? "");
    else if (!figures.some((figure) => figure.id === selectedId)) setSelectedId("");
  }, [figures, selectedId]);
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const selected = figures.find((figure) => figure.id === selectedId) ?? null;
  const needsSelection = figures.length > 1 && !selected;
  const busy =
    ensureMutation.isPending || createMutation.isPending || replaceMutation.isPending;

  function openMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsOpen(true);
  }

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 160);
  }

  async function resolveTarget() {
    if (selected) return selected;
    if (needsSelection) {
      toast.info("Hãy chọn hình cần thao tác.");
      return null;
    }
    try {
      const ensured = await ensureMutation.mutateAsync(blockPath);
      setSelectedId(ensured.id);
      return ensured;
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa chuẩn bị được hình cho khối này."),
      );
      return null;
    }
  }

  async function openDialog(next: "ai" | "code") {
    const figure = await resolveTarget();
    if (!figure) return;
    setTarget(figure);
    setDialog(next);
    setIsOpen(false);
  }

  return (
    <>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
        }}
        onFocus={openMenu}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Thao tác với hình của khối"
          className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-400 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
          onClick={openMenu}
          type="button"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        {isOpen ? (
          <div
            aria-label="Thao tác hình của khối"
            className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1.5 text-left shadow-xl"
            role="menu"
          >
            {figures.length > 1 ? (
              <label className="mb-1 block rounded-lg bg-[var(--theme-surface-soft)] p-2 text-xs font-bold text-[var(--theme-text)]">
                Chọn hình cần thao tác
                <select
                  className="mt-1 min-h-9 w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 text-xs"
                  onChange={(event) => setSelectedId(event.target.value)}
                  value={selectedId}
                >
                  <option value="">Chọn một hình…</option>
                  {figures.map((figure, index) => (
                    <option key={figure.id} value={figure.id}>
                      {figure.caption || `Hình ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <BlockMenuItem
              disabled={busy || needsSelection}
              icon={Bot}
              label="Tạo mới bằng AI"
              onClick={() => void openDialog("ai")}
            />
            <BlockMenuItem
              disabled={busy || needsSelection}
              icon={Code2}
              label="Tạo mới bằng mã code"
              onClick={() => void openDialog("code")}
            />
            <BlockMenuItem
              disabled={busy || needsSelection}
              icon={ImageUp}
              label="Tải ảnh lên"
              onClick={() => {
                setIsOpen(false);
                inputRef.current?.click();
              }}
            />
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          void (async () => {
            const figure = await resolveTarget();
            if (!figure) return;
            try {
              await replaceMutation.mutateAsync({ figure, file });
              toast.success("Đã tải ảnh lên.");
            } catch (error) {
              toast.error(getUserFacingErrorMessage(error, "Chưa tải được ảnh lên."));
            }
          })();
        }}
        type="file"
      />

      {dialog === "ai" && target ? (
        <StemFigureCreateAiDialog
          figure={target}
          initialAdminInstructions=""
          initialMode={defaultReferenceMode(target)}
          isCreating={createMutation.isPending}
          isOpen
          lessonId={lessonId}
          onClose={() => setDialog(null)}
          onCreate={async (input) => {
            try {
              await createMutation.mutateAsync(input);
              toast.success("Đã bắt đầu tạo hình mới bằng AI.");
              setDialog(null);
            } catch (error) {
              toast.error(getUserFacingErrorMessage(error, "Chưa tạo được hình mới."));
            }
          }}
        />
      ) : null}
      {dialog === "code" && target ? (
        <StemFigureEditorDialog
          figure={target}
          isOpen
          lessonId={lessonId}
          mode="create"
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function BlockMenuItem({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: typeof Bot;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-[var(--theme-text-strong)] transition hover:bg-[var(--theme-surface-soft)] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

function defaultReferenceMode(
  figure: AdminStemFigure,
): AdminStemFigureReferenceImageMode {
  if (
    figure.currentAssetKind === "TEXTBOOK_SOURCE" &&
    figure.sourceReferenceImages.length > 0
  ) {
    return "SOURCE_CROP_ONLY";
  }
  if (figure.hasCurrentAsset) return "CURRENT_ONLY";
  if (figure.sourceReferenceImages.length > 0) return "SOURCE_CROP_ONLY";
  return "NONE";
}
