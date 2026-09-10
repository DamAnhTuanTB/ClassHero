"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Code2, Columns, LayoutTemplate } from "lucide-react";
import type { TiptapContent } from "@learning-path/shared";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import { hasTiptapDocumentContent } from "@/lib/tiptap-rich-content";
import { SummaryBlockRenderer } from "@/features/student/lessons/screens/student-lesson-screen/components/summary-block-renderer";
import { AdminLessonSummaryBlockEditorDialog } from "@/features/admin/ai-generation/components/admin-lesson-summary-block-editor-dialog";
import { AdminLessonSummaryPublishActions } from "@/features/admin/ai-generation/components/admin-lesson-summary-publish-actions";
import { isLessonSummaryEditableBlock } from "@/features/admin/ai-generation/utils/lesson-summary-block-editor";

const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

type ViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";
type SaveAction = "SAVE" | "PUBLISH" | "WITHDRAW";
type SummaryData = ComponentProps<typeof SummaryBlockRenderer>["data"];

export function VideoSummaryEditorDialog({
  initialContent,
  isOpen,
  isSaving,
  lessonId,
  reviewStatus,
  subjectKey,
  onClose,
  onSave,
  onVideoSeek,
}: {
  initialContent: TiptapContent;
  isOpen: boolean;
  isSaving: boolean;
  lessonId: string;
  reviewStatus?: "NEEDS_REVIEW" | "APPROVED" | "HIDDEN";
  subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL" | null;
  onClose: () => void;
  onSave: (action: SaveAction, content: TiptapContent) => void;
  onVideoSeek?: (seconds: number) => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("UI_ONLY");
  const [jsonCollapsed, setJsonCollapsed] = useState<boolean | number>(2);
  const [editingBlockPath, setEditingBlockPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setContent(initialContent);
    setError(undefined);
    setViewMode("UI_ONLY");
    setEditingBlockPath(null);
  }, [initialContent, isOpen]);

  const summaryData =
    content.type === "lesson_summary_blocks" && content.version === 5 && content.data
      ? (content.data as SummaryData)
      : null;
  const editingBlock = useMemo(() => {
    if (!summaryData || !editingBlockPath) return null;
    const match = /^sections\.(\d+)\.blocks\.(\d+)$/u.exec(editingBlockPath);
    if (!match) return null;
    const block = summaryData.sections[Number(match[1])]?.blocks[Number(match[2])];
    return isLessonSummaryEditableBlock(block) ? block : null;
  }, [editingBlockPath, summaryData]);

  const updateSummaryData = (data: SummaryData) => {
    setContent((current) => ({ ...current, data }) as TiptapContent);
  };

  const save = (action: SaveAction) => {
    if (
      content.type === "lesson_summary_blocks" &&
      content.version === 5 &&
      content.data &&
      typeof content.data === "object"
    ) {
      onSave(action, content);
      return;
    }
    if (content.type !== "doc" || !hasTiptapDocumentContent(content)) {
      setError("Nhập nội dung Tổng quan video trước khi lưu");
      return;
    }
    onSave(action, content);
  };

  const replaceEditingBlock = (nextBlock: Record<string, unknown>) => {
    if (!summaryData || !editingBlockPath) return;
    const match = /^sections\.(\d+)\.blocks\.(\d+)$/u.exec(editingBlockPath);
    if (!match) return;
    const sectionIndex = Number(match[1]);
    const blockIndex = Number(match[2]);
    const nextData = structuredClone(summaryData);
    const section = nextData.sections[sectionIndex];
    if (!section?.blocks[blockIndex]) return;
    section.blocks[blockIndex] = nextBlock;
    updateSummaryData(nextData);
    setEditingBlockPath(null);
  };

  return (
    <>
      <EditorDialogShell
        isOpen={isOpen}
        onClose={() => {
          if (!isSaving) onClose();
        }}
        ariaLabel="Chỉnh sửa Tổng quan video"
        panelClassName="max-w-6xl"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5">
            <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Chỉnh sửa Tổng quan video
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {summaryData ? (
              <div className="space-y-4">
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <ViewModeButton
                    active={viewMode === "UI_ONLY"}
                    icon={LayoutTemplate}
                    label="Chỉ xem UI"
                    onClick={() => setViewMode("UI_ONLY")}
                  />
                  <ViewModeButton
                    active={viewMode === "JSON_ONLY"}
                    icon={Code2}
                    label="Chỉ xem JSON"
                    onClick={() => setViewMode("JSON_ONLY")}
                  />
                  <ViewModeButton
                    active={viewMode === "SPLIT"}
                    icon={Columns}
                    label="Song song"
                    onClick={() => setViewMode("SPLIT")}
                  />
                </div>

                {viewMode === "JSON_ONLY" ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setJsonCollapsed(false)}
                        className="theme-button-neutral min-h-9 rounded-lg px-3 text-xs font-bold"
                      >
                        Xổ toàn bộ
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonCollapsed(2)}
                        className="theme-button-neutral min-h-9 rounded-lg px-3 text-xs font-bold"
                      >
                        Thu lại toàn bộ
                      </button>
                    </div>
                    <div className="max-h-[65dvh] overflow-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <ReactJson
                        src={summaryData}
                        onEdit={(event) =>
                          updateSummaryData(event.updated_src as SummaryData)
                        }
                        onAdd={(event) =>
                          updateSummaryData(event.updated_src as SummaryData)
                        }
                        onDelete={(event) =>
                          updateSummaryData(event.updated_src as SummaryData)
                        }
                        theme="rjv-default"
                        style={{ backgroundColor: "transparent" }}
                        collapsed={jsonCollapsed}
                        displayDataTypes={false}
                        name={false}
                        enableClipboard={false}
                        keyModifier={(event) =>
                          event instanceof MouseEvent &&
                          (event.detail >= 2 || event.metaKey || event.ctrlKey)
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <SummaryBlockRenderer
                    alwaysShowEditingActions
                    className="mt-0"
                    data={summaryData}
                    anchorPrefix="video-summary-editor"
                    objectivesLabel="Các kiến thức sẽ học"
                    onBlockEdit={({ blockPath }) => setEditingBlockPath(blockPath)}
                    onChange={updateSummaryData}
                    onVideoSeek={onVideoSeek}
                    showTableOfContents
                    viewMode={viewMode}
                  />
                )}
              </div>
            ) : content.type === "doc" ? (
              <div className="[&_.quiz-rich-content-prosemirror]:min-h-72">
                <QuizRichContentEditor
                  ariaLabel="Nội dung Tổng quan video"
                  disabled={isSaving}
                  error={error}
                  placeholder="Nhập nội dung tổng quan buổi học..."
                  value={content}
                  onBlur={() => {
                    if (!hasTiptapDocumentContent(content)) {
                      setError("Nhập nội dung Tổng quan video trước khi lưu");
                    }
                  }}
                  onChange={(value) => {
                    setContent(value);
                    if (hasTiptapDocumentContent(value)) setError(undefined);
                  }}
                />
              </div>
            ) : null}
          </div>
          <footer className="theme-dialog-footer flex shrink-0 flex-wrap justify-end gap-2 p-3 sm:p-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
            >
              Hủy
            </button>
            <AdminLessonSummaryPublishActions
              figureActionsBlocked={false}
              isPending={isSaving}
              reviewStatus={reviewStatus}
              onSave={save}
            />
          </footer>
        </div>
      </EditorDialogShell>

      {editingBlockPath && editingBlock ? (
        <AdminLessonSummaryBlockEditorDialog
          block={editingBlock}
          blockPath={editingBlockPath}
          figures={[]}
          isOpen
          lessonId={lessonId}
          subjectKey={subjectKey}
          onClose={() => setEditingBlockPath(null)}
          onSave={replaceEditingBlock}
        />
      ) : null}
    </>
  );
}

function ViewModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof LayoutTemplate;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
