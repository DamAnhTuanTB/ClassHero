"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { TiptapTextDocument } from "@learning-path/shared";
import { ChevronDown, ChevronUp, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { updateAdminLesson } from "@/features/admin/courses/api/admin-lessons-api";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  createTextTiptapDocument,
  getTiptapDocumentText,
} from "@/lib/tiptap-rich-content";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

export function LessonOverviewSection({
  content,
  fallbackText,
  lessonId,
  onSaved,
}: {
  content: TiptapTextDocument | null;
  fallbackText: string;
  lessonId: string;
  onSaved: () => void | Promise<void>;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const initialContent = useMemo(
    () => content ?? createTextTiptapDocument(fallbackText),
    [content, fallbackText],
  );
  const [draft, setDraft] = useState<TiptapTextDocument>(initialContent);
  const saveMutation = useMutation({
    mutationFn: () =>
      updateAdminLesson(
        lessonId,
        {
          overviewContentJson: draft,
          shortDescription: getTiptapDocumentText(draft).slice(0, 500),
        },
        token,
      ),
    onSuccess: async () => {
      await onSaved();
      setIsEditorOpen(false);
      toast.success("Đã lưu Tổng quan buổi học");
    },
    onError: (error) => {
      toast.error("Chưa lưu được Tổng quan buổi học", {
        description: getUserFacingErrorMessage(error),
      });
    },
  });

  useEffect(() => {
    if (isEditorOpen) {
      setDraft(initialContent);
    }
  }, [initialContent, isEditorOpen]);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white shadow-sm dark:bg-slate-950">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] px-4 py-3">
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--theme-text-strong)]">
            Tổng quan buổi học
            <button
              type="button"
              aria-expanded={!isCollapsed}
              aria-label={
                isCollapsed ? "Mở Tổng quan buổi học" : "Thu gọn Tổng quan buổi học"
              }
              title={isCollapsed ? "Mở Tổng quan buổi học" : "Thu gọn Tổng quan buổi học"}
              onClick={() => setIsCollapsed((current) => !current)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </span>
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="theme-button-neutral inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Chỉnh sửa
          </button>
        </header>

        {!isCollapsed ? (
          <div className="p-4 text-sm leading-relaxed text-[var(--theme-text)]">
            <TiptapContentView content={initialContent} contentAlignment="left" />
          </div>
        ) : null}
      </section>

      <EditorDialogShell
        ariaLabel="Chỉnh sửa Tổng quan buổi học"
        isOpen={isEditorOpen}
        onClose={() => {
          if (!saveMutation.isPending) {
            setIsEditorOpen(false);
          }
        }}
        panelClassName="max-w-4xl"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5">
            <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Chỉnh sửa Tổng quan buổi học
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="[&_.quiz-rich-content-prosemirror]:min-h-48">
              <QuizRichContentEditor
                ariaLabel="Nội dung Tổng quan buổi học"
                compact
                disabled={saveMutation.isPending}
                placeholder="Nhập nội dung chính, dạng bài trọng tâm hoặc ghi chú cho buổi học..."
                value={draft}
                onChange={setDraft}
              />
            </div>
          </div>
          <footer className="theme-dialog-footer flex shrink-0 justify-end gap-2 p-3 sm:p-4">
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => setIsEditorOpen(false)}
              className="theme-button-neutral min-h-10 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="theme-button-primary inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Lưu thay đổi
            </button>
          </footer>
        </div>
      </EditorDialogShell>
    </>
  );
}
