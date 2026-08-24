"use client";

import { Code2, FileImage, LoaderCircle, Play, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { StemFigureCodeEditor } from "@/features/admin/ai-generation/components/stem-figure-code-editor";
import type { AdminQuizFigure } from "@/features/admin/quiz/api/admin-quiz-api";
import { useAdminQuizFigureMutations } from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

export function AdminQuizFigureCodeDialog({
  figure,
  isOpen,
  mode,
  onClose,
  questionId,
  setId,
}: {
  figure: AdminQuizFigure;
  isOpen: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  questionId: string;
  setId: string;
}) {
  const mutations = useAdminQuizFigureMutations(setId);
  const [source, setSource] = useState("");
  const [caption, setCaption] = useState("");
  const [result, setResult] = useState<{
    previewSvg: string;
    revisionId: string;
    sourceVersion: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSource(
      mode === "edit" && figure.currentRevision?.latexSource
        ? figure.currentRevision.latexSource
        : createQuizFigureStarterSource(),
    );
    setCaption(figure.currentRevision?.caption ?? "");
    setResult(null);
  }, [
    figure.currentRevision?.caption,
    figure.currentRevision?.latexSource,
    isOpen,
    mode,
  ]);

  const pending = mutations.compileDraft.isPending || mutations.applyDraft.isPending;
  const previewUrl = result
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.previewSvg)}`
    : mode === "edit"
      ? figure.currentRevision?.deliveryFile?.publicUrl
      : null;

  async function compile() {
    try {
      const compiled = await mutations.compileDraft.mutateAsync({
        questionId,
        figure,
        latexSource: source,
        altText: figure.currentRevision?.altText ?? roleLabel(figure.role),
        caption: caption.trim() || null,
      });
      setResult(compiled);
      toast.success("Biên dịch hình thành công.");
      return compiled;
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Mã hình chưa biên dịch thành công."));
      return null;
    }
  }

  async function apply() {
    const compiled = result ?? (await compile());
    if (!compiled) return;
    try {
      await mutations.applyDraft.mutateAsync({
        questionId,
        figure,
        revisionId: compiled.revisionId,
        sourceVersion: compiled.sourceVersion,
      });
      toast.success(
        mode === "create" ? "Đã tạo hình bằng mã code." : "Đã áp dụng bản sửa hình.",
      );
      onClose();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa áp dụng được mã hình."));
    }
  }

  return (
    <EditorDialogShell
      ariaLabel={
        mode === "create" ? "Tạo mới hình bằng mã code" : "Chỉnh sửa hình bằng mã code"
      }
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="h-[calc(100dvh-2rem)] max-w-[96rem]"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 pr-20 sm:px-5">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          {mode === "create" ? "Tạo mới hình bằng mã code" : "Chỉnh sửa bằng mã code"}
        </h2>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(22rem,1fr)_minmax(18rem,0.8fr)] overflow-hidden xl:grid-cols-2 xl:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-[var(--theme-border)] xl:border-b-0 xl:border-r">
          <div className="flex items-center border-b border-[var(--theme-border)] px-4 py-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
              <Code2 className="h-4 w-4" aria-hidden="true" /> Mã vẽ hình
            </h3>
          </div>
          <StemFigureCodeEditor
            focusLine={null}
            issues={[]}
            value={source}
            onChange={(value) => {
              setSource(value);
              setResult(null);
            }}
          />
          <label className="border-t border-[var(--theme-border)] p-3 text-xs font-bold text-[var(--theme-text)]">
            Caption
            <input
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm"
              maxLength={500}
              value={caption}
              onChange={(event) => {
                setCaption(event.target.value);
                setResult(null);
              }}
            />
          </label>
        </section>

        <section className="flex min-h-0 flex-col bg-[var(--theme-surface-soft)]">
          <div className="border-b border-[var(--theme-border)] px-4 py-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
            Xem trước hình
          </div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-white p-5">
            {mutations.compileDraft.isPending ? (
              <div role="status" className="text-center text-slate-700">
                <LoaderCircle
                  className="mx-auto h-9 w-9 animate-spin text-sky-600"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-extrabold">Đang biên dịch…</p>
              </div>
            ) : previewUrl ? (
              <img
                alt={caption.trim() || roleLabel(figure.role)}
                className="max-h-[65dvh] max-w-full object-contain"
                src={previewUrl}
              />
            ) : (
              <div className="text-center text-slate-600">
                <FileImage
                  className="mx-auto h-8 w-8 text-amber-500"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-bold">Bấm Biên dịch để xem hình</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="theme-dialog-footer grid shrink-0 grid-cols-3 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={pending}
          onClick={onClose}
          type="button"
        >
          Hủy
        </button>
        <button
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={pending}
          onClick={() => void compile()}
          type="button"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Biên dịch
        </button>
        <button
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={pending}
          onClick={() => void apply()}
          type="button"
        >
          <Save className="h-4 w-4" aria-hidden="true" /> Áp dụng
        </button>
      </footer>
    </EditorDialogShell>
  );
}

function createQuizFigureStarterSource() {
  return [
    "\\begin{tikzpicture}[line cap=round,line join=round]",
    "  \\draw[thick] (0,0) -- (4,0) -- (2,2.6) -- cycle;",
    "  % QUIZ_SOLUTION_EXTENSION",
    "\\end{tikzpicture}",
  ].join("\n");
}

function roleLabel(role: AdminQuizFigure["role"]) {
  return role === "QUESTION" ? "Hình minh họa đề Quiz" : "Hình lời giải Quiz";
}
