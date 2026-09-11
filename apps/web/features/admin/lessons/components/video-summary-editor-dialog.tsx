"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Code2, Columns, LayoutTemplate } from "lucide-react";
import type { TiptapContent } from "@learning-path/shared";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import { hasTiptapDocumentContent } from "@/lib/tiptap-rich-content";
import { SummaryBlockRenderer } from "@/features/student/lessons/screens/student-lesson-screen/components/summary-block-renderer";
import { AdminLessonSummaryBlockEditorDialog } from "@/features/admin/ai-generation/components/admin-lesson-summary-block-editor-dialog";
import { AdminLessonSummaryPublishActions } from "@/features/admin/ai-generation/components/admin-lesson-summary-publish-actions";
import { isLessonSummaryEditableBlock } from "@/features/admin/ai-generation/utils/lesson-summary-block-editor";
import {
  omitJsonEditorFields,
  restoreJsonEditorFields,
} from "@/lib/json-editor-hidden-fields";
import { resolveVisibleVideoTimelineIndexes } from "@/lib/video-player-time";

const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

type ViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";
type SaveAction = "SAVE" | "PUBLISH" | "WITHDRAW";
type SummaryData = ComponentProps<typeof SummaryBlockRenderer>["data"];
const VIDEO_SUMMARY_HIDDEN_BLOCK_JSON_FIELDS = ["figures", "origin"] as const;

export function VideoSummaryEditorDialog({
  displayMode = "dialog",
  inlineActions,
  inlineHeader,
  initialContent,
  isOpen,
  isSaving,
  lessonId,
  reviewStatus,
  subjectKey,
  onClose,
  onSave,
  onVideoSeek,
  videoStartTimeOffsetSeconds = 0,
  videoEndTimeSeconds,
}: {
  displayMode?: "dialog" | "inline";
  inlineActions?: ReactNode;
  inlineHeader?: ReactNode;
  initialContent: TiptapContent;
  isOpen: boolean;
  isSaving: boolean;
  lessonId: string;
  reviewStatus?: "NEEDS_REVIEW" | "APPROVED" | "HIDDEN";
  subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL" | null;
  onClose: () => void;
  onSave: (action: SaveAction, content: TiptapContent) => void;
  onVideoSeek?: (seconds: number) => void;
  videoStartTimeOffsetSeconds?: number;
  videoEndTimeSeconds?: number;
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
    content.type === "lesson_summary_blocks" && content.version === 6 && content.data
      ? (content.data as SummaryData)
      : null;
  const editableSummaryData = useMemo(
    () =>
      summaryData
        ? mapVideoSummaryBlockJson(summaryData, (block) =>
            omitJsonEditorFields(block, VIDEO_SUMMARY_HIDDEN_BLOCK_JSON_FIELDS),
          )
        : null,
    [summaryData],
  );
  const editingBlock = useMemo(() => {
    if (!summaryData || !editingBlockPath) return null;
    const match = /^sections\.(\d+)\.blocks\.(\d+)$/u.exec(editingBlockPath);
    if (!match) return null;
    const block = summaryData.sections[Number(match[1])]?.blocks[Number(match[2])];
    return isLessonSummaryEditableBlock(block) ? block : null;
  }, [editingBlockPath, summaryData]);
  const isEditingBlockHiddenFromVideoPlayback = useMemo(() => {
    if (!summaryData || !editingBlockPath) return false;
    const hasCustomVideoPlaybackWindow =
      videoStartTimeOffsetSeconds > 0 || Number.isFinite(videoEndTimeSeconds);
    if (!hasCustomVideoPlaybackWindow) return false;

    const timelineBlocks = summaryData.sections.flatMap((section, sectionIndex) =>
      section.blocks.map((block, blockIndex) => ({
        path: `sections.${sectionIndex}.blocks.${blockIndex}`,
        startSeconds: block.startSeconds,
      })),
    );
    const visibleBlockIndexes = new Set(
      resolveVisibleVideoTimelineIndexes(
        timelineBlocks.map((block) => block.startSeconds),
        videoStartTimeOffsetSeconds,
        videoEndTimeSeconds,
      ),
    );
    const editingBlockIndex = timelineBlocks.findIndex(
      (block) => block.path === editingBlockPath,
    );
    return editingBlockIndex >= 0 && !visibleBlockIndexes.has(editingBlockIndex);
  }, [editingBlockPath, summaryData, videoEndTimeSeconds, videoStartTimeOffsetSeconds]);

  const updateSummaryData = (data: SummaryData) => {
    setContent((current) => ({ ...current, data }) as TiptapContent);
  };

  const updateSummaryJson = (data: SummaryData) => {
    if (!summaryData) return;
    updateSummaryData(
      mapVideoSummaryBlockJson(data, (block, sectionIndex, blockIndex) => {
        const originalBlock = summaryData.sections[sectionIndex]?.blocks[blockIndex];
        if (originalBlock) {
          return restoreJsonEditorFields(
            originalBlock,
            block,
            VIDEO_SUMMARY_HIDDEN_BLOCK_JSON_FIELDS,
          );
        }
        return {
          ...block,
          figures: [],
          ...(block.type === "example" ? { origin: "SOURCE_EXACT" } : {}),
        };
      }),
    );
  };

  const save = (action: SaveAction) => {
    if (
      content.type === "lesson_summary_blocks" &&
      content.version === 6 &&
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

  const viewModeControls = summaryData ? (
    <div className="flex w-full items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:w-fit">
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
  ) : null;

  const editorWorkspace = summaryData ? (
    <div className="space-y-4">
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
              src={editableSummaryData ?? summaryData}
              onEdit={(event) => updateSummaryJson(event.updated_src as SummaryData)}
              onAdd={(event) => updateSummaryJson(event.updated_src as SummaryData)}
              onDelete={(event) => updateSummaryJson(event.updated_src as SummaryData)}
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
          editCurrentBlockJson
          hiddenCurrentBlockJsonFields={VIDEO_SUMMARY_HIDDEN_BLOCK_JSON_FIELDS}
          anchorPrefix="video-summary-editor"
          objectivesLabel="Kiến thức bài giảng"
          onBlockEdit={({ blockPath }) => setEditingBlockPath(blockPath)}
          onChange={updateSummaryData}
          onVideoSeek={onVideoSeek}
          videoStartTimeOffsetSeconds={videoStartTimeOffsetSeconds}
          videoEndTimeSeconds={videoEndTimeSeconds}
          showVideoTimelineVisibilityMetadata
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
        placeholder="Nhập nội dung Tổng quan video..."
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
  ) : null;

  const publishActions = (
    <AdminLessonSummaryPublishActions
      compact={displayMode === "inline"}
      figureActionsBlocked={false}
      isPending={isSaving}
      reviewStatus={reviewStatus}
      onSave={save}
    />
  );

  return (
    <>
      {displayMode === "inline" ? (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>{inlineHeader}</div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {publishActions}
                {inlineActions}
              </div>
              {viewModeControls}
            </div>
          </div>
          <div className="-mx-3 rounded-none bg-white px-3 py-6 shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-950 dark:ring-slate-800/50 sm:mx-0 sm:rounded-2xl sm:p-8">
            {editorWorkspace}
          </div>
        </div>
      ) : (
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
              <div className="mb-4 flex justify-end">{viewModeControls}</div>
              {editorWorkspace}
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
              {publishActions}
            </footer>
          </div>
        </EditorDialogShell>
      )}

      {editingBlockPath && editingBlock ? (
        <AdminLessonSummaryBlockEditorDialog
          block={editingBlock}
          blockPath={editingBlockPath}
          figures={[]}
          isOpen
          isVideoTimelineEditor
          isVideoTimelineHidden={isEditingBlockHiddenFromVideoPlayback}
          lessonId={lessonId}
          subjectKey={subjectKey}
          videoEndTimeSeconds={videoEndTimeSeconds}
          videoStartTimeOffsetSeconds={videoStartTimeOffsetSeconds}
          onClose={() => setEditingBlockPath(null)}
          onSave={replaceEditingBlock}
        />
      ) : null}
    </>
  );
}

function mapVideoSummaryBlockJson(
  data: SummaryData,
  mapBlock: (
    block: Record<string, unknown>,
    sectionIndex: number,
    blockIndex: number,
  ) => Record<string, unknown>,
) {
  if (!Array.isArray(data.sections)) return data;
  return {
    ...data,
    sections: data.sections.map((section, sectionIndex) =>
      Array.isArray(section.blocks)
        ? {
            ...section,
            blocks: section.blocks.map((block, blockIndex) =>
              mapBlock(block, sectionIndex, blockIndex),
            ),
          }
        : section,
    ),
  };
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
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors sm:flex-none ${
        active
          ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
