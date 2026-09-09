"use client";

import { Captions, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextareaField } from "@/components/common/forms/textarea-field";
import type {
  AdminQuizAssessmentKind,
  AdminQuizFigure,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { useAdminQuizFigureMutations } from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

export function AdminQuizFigureCaptionDialog({
  assessmentKind,
  figure,
  isOpen,
  onClose,
  questionId,
  setId,
}: {
  assessmentKind: AdminQuizAssessmentKind;
  figure: AdminQuizFigure;
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  setId: string;
}) {
  const mutation = useAdminQuizFigureMutations(setId, assessmentKind).updateCaption;
  const [caption, setCaption] = useState("");
  useEffect(() => {
    if (isOpen) setCaption(figure.currentRevision?.caption ?? "");
  }, [figure.currentRevision?.caption, figure.id, isOpen]);

  async function save() {
    try {
      await mutation.mutateAsync({ questionId, figure, caption: caption.trim() || null });
      toast.success("Đã cập nhật caption của hình.");
      onClose();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa cập nhật được caption."));
    }
  }

  return (
    <EditorDialogShell ariaLabel="Chỉnh sửa caption" isOpen={isOpen} onClose={onClose}>
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 px-4 py-3 pr-20 sm:px-5">
        <span className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg">
          <Captions className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          Chỉnh sửa caption
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <TextareaField
          id={`quiz-figure-caption-${figure.id}`}
          isOptional
          label="Caption"
          maxLength={500}
          rows={5}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>
      <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={mutation.isPending}
          onClick={onClose}
          type="button"
        >
          Hủy
        </button>
        <button
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={mutation.isPending}
          onClick={() => void save()}
          type="button"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {mutation.isPending ? "Đang lưu" : "Lưu caption"}
        </button>
      </footer>
    </EditorDialogShell>
  );
}
