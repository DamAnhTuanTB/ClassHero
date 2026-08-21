"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { STEM_FIGURE_MAX_CAPTION_CHARACTERS } from "@learning-path/shared";
import { Captions, Loader2, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { useApplyAdminStemFigureDraft } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type { AdminStemFigure } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const captionFormSchema = z.object({
  caption: z
    .string()
    .max(
      STEM_FIGURE_MAX_CAPTION_CHARACTERS,
      `Caption tối đa ${STEM_FIGURE_MAX_CAPTION_CHARACTERS} ký tự.`,
    ),
});

type CaptionFormValues = z.infer<typeof captionFormSchema>;

export function AdminStemFigureCaptionDialog({
  figure,
  isOpen,
  lessonId,
  onClose,
}: {
  figure: AdminStemFigure;
  isOpen: boolean;
  lessonId: string;
  onClose: () => void;
}) {
  const applyMutation = useApplyAdminStemFigureDraft(lessonId);
  const form = useForm<CaptionFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(captionFormSchema),
    defaultValues: { caption: figure.caption ?? "" },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ caption: figure.caption ?? "" });
    }
  }, [figure.caption, figure.id, form, isOpen]);

  function requestClose() {
    if (!applyMutation.isPending) onClose();
  }

  async function saveCaption(values: CaptionFormValues) {
    if (!figure.currentRevisionId) {
      toast.error("Hình chưa có phiên bản hiện hành để cập nhật caption.");
      return;
    }

    const caption = values.caption.trim() || null;
    if (caption === figure.caption) {
      onClose();
      return;
    }

    try {
      await applyMutation.mutateAsync({
        figureId: figure.id,
        baseRevisionId: figure.currentRevisionId,
        revisionId: figure.currentRevisionId,
        sourceVersion: figure.sourceVersion,
        altText: figure.altText,
        caption,
      });
      toast.success("Đã cập nhật caption của hình.");
      onClose();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa cập nhật được caption."));
    }
  }

  return (
    <EditorDialogShell ariaLabel="Đổi caption" isOpen={isOpen} onClose={requestClose}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(saveCaption)}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 px-4 py-3 pr-20 sm:px-5">
          <span className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
            <Captions className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Đổi caption
          </h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <TextareaField
            autoFocus
            error={form.formState.errors.caption}
            helperText="Có thể để trống. Khi lưu, caption trống sẽ được gỡ khỏi hình."
            id={`stem-figure-caption-${figure.id}`}
            isOptional
            label="Caption"
            maxLength={STEM_FIGURE_MAX_CAPTION_CHARACTERS}
            placeholder="Nhập caption cho hình"
            rows={5}
            {...form.register("caption")}
          />
        </div>

        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            className="theme-button-neutral inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
            disabled={applyMutation.isPending}
            onClick={requestClose}
            type="button"
          >
            Hủy
          </button>
          <button
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
            disabled={applyMutation.isPending}
            type="submit"
          >
            {applyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {applyMutation.isPending ? "Đang lưu" : "Lưu caption"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}
