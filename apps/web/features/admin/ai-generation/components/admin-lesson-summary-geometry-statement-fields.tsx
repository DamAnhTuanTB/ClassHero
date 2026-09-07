"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TiptapTextDocument } from "@learning-path/shared";
import { FieldLabel } from "@/components/common/forms/field-label";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";

export function AdminLessonSummaryGeometryStatementFields({
  conclusions,
  conclusionsError,
  disabled,
  enabled,
  hypotheses,
  hypothesesError,
  onAdd,
  onConclusionsBlur,
  onConclusionsChange,
  onHypothesesBlur,
  onHypothesesChange,
  onRemove,
}: {
  conclusions: TiptapTextDocument;
  conclusionsError?: string;
  disabled: boolean;
  enabled: boolean;
  hypotheses: TiptapTextDocument;
  hypothesesError?: string;
  onAdd: () => void;
  onConclusionsBlur: () => void;
  onConclusionsChange: (value: TiptapTextDocument) => void;
  onHypothesesBlur: () => void;
  onHypothesesChange: (value: TiptapTextDocument) => void;
  onRemove: () => void;
}) {
  if (!enabled) {
    return (
      <button
        className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={onAdd}
        type="button"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Thêm GT/KL
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          Giả thiết – Kết luận
        </h3>
        <button
          aria-label="Xóa phần giả thiết và kết luận"
          className="theme-button-danger-subtle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={onRemove}
          title="Xóa GT/KL"
          type="button"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <FieldLabel id="lesson-summary-block-hypotheses" label="Giả thiết" />
          <div className="mt-2">
            <QuizRichContentEditor
              ariaLabel="Giả thiết của khối"
              compact
              error={hypothesesError}
              placeholder="Nhập giả thiết..."
              value={hypotheses}
              onBlur={onHypothesesBlur}
              onChange={onHypothesesChange}
            />
          </div>
        </div>

        <div>
          <FieldLabel id="lesson-summary-block-conclusions" label="Kết luận" />
          <div className="mt-2">
            <QuizRichContentEditor
              ariaLabel="Kết luận của khối"
              compact
              error={conclusionsError}
              placeholder="Nhập kết luận cần chứng minh hoặc tìm..."
              value={conclusions}
              onBlur={onConclusionsBlur}
              onChange={onConclusionsChange}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
