import React from "react";
import {
  normalizeLessonSummaryAngleNotation,
  normalizeLessonSummaryNoteContent,
} from "@learning-path/shared";
import {
  BookOpen,
  AlertCircle,
  Info,
  Lightbulb,
  FileCheck2,
  ChevronRight,
  PenTool,
  Scale,
  Bookmark,
  GraduationCap,
  Layers,
  MessageSquareQuote,
  AlertOctagon,
  Sigma,
  FileBadge,
  PlayCircle,
  GripVertical,
  Copy,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  CheckCircle2,
  Combine,
} from "lucide-react";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import {
  StemFigure,
  type StemFigureVisual,
} from "@/components/common/content/stem-figure";
import {
  LessonSummaryExampleCard,
  type LessonSummaryFigureRenderer,
} from "@/components/common/content/lesson-summary-example-content";
import {
  getLessonSummarySectionAnchorId,
  LESSON_SUMMARY_OBJECTIVES_ANCHOR_ID,
  LessonSummaryTableOfContents,
} from "@/components/common/content/lesson-summary-table-of-contents";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";

// Define a type for any generic block (loose typing since it comes from JSON)
type BlockData = any;
type PendingDeleteTarget =
  | {
      kind: "SECTION";
      itemName: string;
      sectionIndex: number;
    }
  | {
      kind: "BLOCK";
      blockIndex: number;
      itemName: string;
      sectionIndex: number;
    };
type ReviewIssueData = {
  id: string;
  code: string;
  path: string;
  message: string;
  suggestion: string;
  technicalDetails?: string | null;
  accepted?: boolean;
  resolution?: "ACCEPT_OR_FIX" | "FIX_ONLY";
};

const FIX_ONLY_REVIEW_CODES = new Set([
  "BLOCK_CANNOT_PROCESS",
  "BLOCK_SCHEMA_INVALID",
  "DIAGRAM_CANNOT_RENDER",
  "MISSING_REQUIRED_FIGURE",
  "MISSING_REQUIRED_FIELD",
  "MISSING_SUMMARY_TITLE",
  "MISSING_THEORY_SECTION",
  "MISSING_THEORY_UNIT",
]);

function resolveReviewIssueResolution(
  issue: ReviewIssueData,
): "ACCEPT_OR_FIX" | "FIX_ONLY" {
  if (
    issue.resolution === "FIX_ONLY" ||
    FIX_ONLY_REVIEW_CODES.has(issue.code) ||
    issue.code.endsWith("_CANNOT_RENDER") ||
    issue.code.endsWith("_CANNOT_PROCESS")
  ) {
    return "FIX_ONLY";
  }

  return "ACCEPT_OR_FIX";
}

import dynamic from "next/dynamic";
const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

interface SummaryBlockRendererProps {
  data: {
    title: string;
    objectives?: string[];
    reviewIssues?: ReviewIssueData[];
    sections: {
      order: number;
      sourceHeading?: string;
      displayHeading: string;
      blocks: BlockData[];
    }[];
  };
  displayTitle?: string;
  hideTitle?: boolean;
  onChange?: (newData: any) => void;
  viewMode?: "UI_ONLY" | "SPLIT";
  showEditorialMetadata?: boolean;
  stemFigureVisuals?: ReadonlyMap<string, StemFigureVisual>;
  renderStemFigure?: LessonSummaryFigureRenderer;
  renderBlockImageActions?: (input: {
    blockPath: string;
    block: BlockData;
  }) => React.ReactNode;
  renderBlockSourceAction?: (input: {
    blockPath: string;
    block: BlockData;
  }) => React.ReactNode;
  phaseOneBlockJsonByPath?: Readonly<Record<string, unknown>> | null;
  onPhaseOneBlockJsonChange?: (blockPath: string, value: unknown) => void;
  onPhaseOneLayoutOperation?: (
    operation:
      | { type: "MERGE_SECTION"; sectionIndex: number }
      | { type: "DELETE_SECTION"; sectionIndex: number }
      | { type: "DELETE_BLOCK"; sectionIndex: number; blockIndex: number }
      | { type: "MOVE_SECTION"; sectionIndex: number; targetSectionIndex: number }
      | {
          type: "MOVE_BLOCK";
          sectionIndex: number;
          blockIndex: number;
          targetSectionIndex: number;
          targetBlockIndex: number;
        },
  ) => void;
  showTableOfContents?: boolean;
}

const BLOCK_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  knowledge: { label: "Kiến thức", color: "yellow", icon: BookOpen },
  property: { label: "Tính chất", color: "teal", icon: Bookmark },
  theorem: { label: "Định lí", color: "green", icon: GraduationCap },
  note: { label: "Chú ý", color: "rose", icon: AlertCircle },

  example: { label: "Ví dụ", color: "blue", icon: PlayCircle },
};

export function SummaryBlockRenderer({
  data,
  displayTitle,
  hideTitle,
  onChange,
  viewMode = "SPLIT",
  showEditorialMetadata = false,
  renderBlockImageActions,
  renderBlockSourceAction,
  phaseOneBlockJsonByPath,
  onPhaseOneBlockJsonChange,
  onPhaseOneLayoutOperation,
  showTableOfContents = false,
  stemFigureVisuals,
  renderStemFigure,
}: SummaryBlockRendererProps) {
  const isReadOnly = !onChange;
  const [draggedItem, setDraggedItem] = React.useState<{
    sectionIdx: number;
    blockIdx: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = React.useState<{
    sectionIdx: number;
    blockIdx: number;
  } | null>(null);
  const [draggedSection, setDraggedSection] = React.useState<number | null>(null);
  const [dragOverSection, setDragOverSection] = React.useState<number | null>(null);
  const [activeDropdown, setActiveDropdown] = React.useState<number | null>(null);
  const [editingItems, setEditingItems] = React.useState<Set<string>>(new Set());
  const [pendingDeleteTarget, setPendingDeleteTarget] =
    React.useState<PendingDeleteTarget | null>(null);

  // Auto-scroll logic during drag
  React.useEffect(() => {
    let scrollInterval: NodeJS.Timeout | null = null;

    const handleDragOver = (e: DragEvent) => {
      if (!draggedItem && draggedSection === null) return;

      const scrollThreshold = 150;
      const maxScrollSpeed = 80;
      const { clientY } = e;
      const { innerHeight } = window;

      let scrollSpeed = 0;
      if (clientY < scrollThreshold) {
        scrollSpeed = -maxScrollSpeed * (1 - clientY / scrollThreshold);
      } else if (innerHeight - clientY < scrollThreshold) {
        scrollSpeed = maxScrollSpeed * (1 - (innerHeight - clientY) / scrollThreshold);
      }

      if (scrollSpeed !== 0) {
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            window.scrollBy(0, scrollSpeed);

            // Tries to scroll specific scrollable containers if window isn't the one scrolling
            const scrollableDivs = document.querySelectorAll(
              ".overflow-y-auto, .overflow-auto",
            );
            scrollableDivs.forEach((div) => {
              if (div.scrollHeight > div.clientHeight) {
                div.scrollBy(0, scrollSpeed);
              }
            });
          }, 16);
        }
      } else {
        if (scrollInterval) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
      }
    };

    const handleDragEnd = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    if (draggedItem || draggedSection !== null) {
      document.addEventListener("dragover", handleDragOver);
      document.addEventListener("dragend", handleDragEnd);
      document.addEventListener("drop", handleDragEnd);
    }

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragend", handleDragEnd);
      document.removeEventListener("drop", handleDragEnd);
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [draggedItem, draggedSection]);

  const toggleEdit = (key: string) => {
    setEditingItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getBlockDefaultData = (type: string) => {
    const base = { type, title: "Tiêu đề khối mới" };
    switch (type) {
      case "example":
        return {
          ...base,
          problem: "Nhập đề bài tại đây...",
          solution: "Ta có: $x=2$",
          answer: "Đáp án cuối cùng...",
          geometryStatement: null,
        };

      default:
        return {
          ...base,
          content: "Nhập nội dung tại đây...",
        };
    }
  };

  const getBlockDragColor = (type: string) => {
    // We can safely access BLOCK_CONFIG here because it's defined in the module scope
    // and evaluated before this function is called during render.
    const color = BLOCK_CONFIG[type]?.color || "slate";
    const ringColors: Record<string, string> = {
      blue: "ring-blue-400 border-blue-400",
      indigo: "ring-indigo-400 border-indigo-400",
      teal: "ring-teal-400 border-teal-400",
      rose: "ring-rose-400 border-rose-400",
      fuchsia: "ring-fuchsia-400 border-fuchsia-400",
      amber: "ring-amber-400 border-amber-400",
      yellow: "ring-yellow-400 border-yellow-400",
      red: "ring-red-400 border-red-400",
      green: "ring-green-400 border-green-400",
      emerald: "ring-emerald-400 border-emerald-400",
      cyan: "ring-cyan-400 border-cyan-400",
      violet: "ring-violet-400 border-violet-400",
      purple: "ring-purple-400 border-purple-400",
      sky: "ring-sky-400 border-sky-400",
      orange: "ring-orange-400 border-orange-400",
      slate: "ring-slate-400 border-slate-400",
    };
    return ringColors[color] || ringColors.slate;
  };

  const globalTypeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    data.sections?.forEach((s) => {
      s.blocks?.forEach((b) => {
        counts[b.type] = (counts[b.type] || 0) + 1;
      });
    });
    return counts;
  }, [data.sections]);

  const runningCounts: Record<string, number> = {};

  const isTitleEditing = viewMode === "SPLIT" || editingItems.has("title");
  const isObjectivesEditing = viewMode === "SPLIT" || editingItems.has("objectives");
  const acceptRootIssue = (issueId: string) => {
    if (!onChange) return;
    onChange({
      ...data,
      reviewIssues: data.reviewIssues?.map((issue: ReviewIssueData) =>
        issue.id === issueId && resolveReviewIssueResolution(issue) === "ACCEPT_OR_FIX"
          ? { ...issue, accepted: true }
          : issue,
      ),
    });
  };

  const confirmPendingDelete = () => {
    if (!pendingDeleteTarget || !onChange) return;

    if (pendingDeleteTarget.kind === "SECTION") {
      const sections = [...(data.sections ?? [])];
      sections.splice(pendingDeleteTarget.sectionIndex, 1);
      onPhaseOneLayoutOperation?.({
        type: "DELETE_SECTION",
        sectionIndex: pendingDeleteTarget.sectionIndex,
      });
      onChange({
        ...data,
        sections: sections.map((section, index) => ({
          ...section,
          order: index + 1,
        })),
      });
      setPendingDeleteTarget(null);
      return;
    }

    const sections = [...(data.sections ?? [])];
    const section = sections[pendingDeleteTarget.sectionIndex];
    if (!section) {
      setPendingDeleteTarget(null);
      return;
    }

    const blocks = [...(section.blocks ?? [])];
    blocks.splice(pendingDeleteTarget.blockIndex, 1);
    sections[pendingDeleteTarget.sectionIndex] = { ...section, blocks };
    onPhaseOneLayoutOperation?.({
      type: "DELETE_BLOCK",
      sectionIndex: pendingDeleteTarget.sectionIndex,
      blockIndex: pendingDeleteTarget.blockIndex,
    });
    onChange({ ...data, sections });
    setPendingDeleteTarget(null);
  };

  return (
    <div className="mt-4 space-y-8 react-json-custom-edit-wrapper">
      {/* Title */}
      {!hideTitle && (
        <div className="relative group/title">
          {(showTableOfContents || (!isReadOnly && viewMode === "SPLIT")) && (
            <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
              {showTableOfContents ? (
                <LessonSummaryTableOfContents
                  desktopBorderless
                  hasObjectives={Boolean(data.objectives?.length)}
                  sections={data.sections ?? []}
                />
              ) : (
                <span aria-hidden="true" />
              )}
              {!isReadOnly && viewMode === "SPLIT" ? (
                <button
                  type="button"
                  onClick={() => {
                    const newData = { ...data };
                    if (!newData.sections) newData.sections = [];
                    newData.sections.push({
                      order: newData.sections.length + 1,
                      displayHeading: "Đề mục mới",
                      blocks: [],
                    });
                    onChange(newData);

                    const newSectionIdx = newData.sections.length - 1;
                    setTimeout(() => {
                      const el = document.getElementById(`section-${newSectionIdx}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }, 100);
                  }}
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-md font-medium text-sm transition-colors border border-blue-200 dark:border-blue-800 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Thêm đề mục lớn
                </button>
              ) : null}
            </div>
          )}
          <div
            className={
              viewMode === "SPLIT"
                ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
                : "flex justify-between items-start gap-4"
            }
          >
            <div className="mb-6 min-w-0 flex-1 pr-0 text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:pr-10 sm:text-3xl">
              {displayTitle || data.title}
            </div>

            {!isReadOnly && viewMode === "UI_ONLY" && (
              <div className="absolute right-0 top-0 hidden justify-end opacity-0 transition-opacity group-hover/title:opacity-100 sm:flex">
                <button
                  type="button"
                  onClick={() => {
                    const newData = { ...data };
                    if (!newData.sections) newData.sections = [];
                    newData.sections.push({
                      order: newData.sections.length + 1,
                      displayHeading: "Đề mục mới",
                      blocks: [],
                    });
                    onChange(newData);

                    const newSectionIdx = newData.sections.length - 1;
                    setTimeout(() => {
                      const el = document.getElementById(`section-${newSectionIdx}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }, 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-md font-medium text-sm transition-colors border border-blue-200 dark:border-blue-800 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Thêm đề mục lớn
                </button>
              </div>
            )}

            {!isReadOnly && viewMode === "SPLIT" && (
              <div className="flex flex-col items-end w-full">
                <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto mb-4 w-full">
                  <ReactJson
                    src={{ title: data.title }}
                    onEdit={(e) =>
                      onChange({ ...data, title: (e.updated_src as any).title })
                    }
                    theme="rjv-default"
                    style={{ backgroundColor: "transparent" }}
                    displayDataTypes={false}
                    name={false}
                    enableClipboard={false}
                    keyModifier={(e: any) => e.detail >= 2 || e.metaKey || e.ctrlKey}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditorialMetadata ? (
        <ReviewIssuePanel issues={data.reviewIssues} onAccept={acceptRootIssue} />
      ) : null}

      {/* Objectives */}
      {data.objectives && data.objectives.length > 0 && (
        <div className={showTableOfContents && hideTitle ? "space-y-3" : undefined}>
          {showTableOfContents && hideTitle ? (
            <LessonSummaryTableOfContents
              accentTrigger
              desktopBorderless
              hasObjectives
              sections={data.sections ?? []}
            />
          ) : null}

          <div
            id={LESSON_SUMMARY_OBJECTIVES_ANCHOR_ID}
            className={`relative scroll-mt-24 group/obj ${isObjectivesEditing ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}`}
          >
            <div className="rounded-xl bg-blue-50 p-3 sm:p-5 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 relative">
              <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Mục tiêu học tập
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                {data.objectives.map((obj, i) => (
                  <li key={i}>
                    <MathpixMarkdownRenderer
                      className="inline [&>*]:inline"
                      content={normalizeLessonSummaryAngleNotation(obj)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {!isReadOnly && viewMode === "UI_ONLY" && (
              <button
                type="button"
                onClick={() => toggleEdit("objectives")}
                className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors opacity-0 group-hover/obj:opacity-100 z-10"
                title="Chỉnh sửa Mục tiêu"
              >
                <PenTool className="w-4 h-4" />
              </button>
            )}

            {!isReadOnly && isObjectivesEditing && (
              <div className="relative border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto max-h-[300px]">
                {viewMode === "UI_ONLY" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md px-1 py-0.5 z-10">
                    <button
                      type="button"
                      onClick={() => toggleEdit("objectives")}
                      title="Đóng chế độ chỉnh sửa"
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <ReactJson
                  src={data.objectives}
                  onEdit={(e) => onChange({ ...data, objectives: e.updated_src })}
                  onAdd={(e) => onChange({ ...data, objectives: e.updated_src })}
                  onDelete={(e) => onChange({ ...data, objectives: e.updated_src })}
                  theme="rjv-default"
                  style={{ backgroundColor: "transparent" }}
                  displayDataTypes={false}
                  name="objectives"
                  enableClipboard={false}
                  keyModifier={(e: any) => e.detail >= 2 || e.metaKey || e.ctrlKey}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sections */}
      {data.sections?.map((section, idx) => {
        const isSectionEditing =
          viewMode === "SPLIT" || editingItems.has(`section-${idx}`);
        const mergeSectionIntoPrevious = () => {
          if (idx === 0 || !data.sections?.[idx - 1]) return;

          const newData = structuredClone(data);
          const currentSection = newData.sections?.[idx];
          const previousSection = newData.sections?.[idx - 1];
          if (!currentSection || !previousSection || !newData.sections) return;

          previousSection.blocks = [
            ...(previousSection.blocks ?? []),
            ...(currentSection.blocks ?? []),
          ];
          newData.sections.splice(idx, 1);
          newData.sections.forEach((item, index) => {
            item.order = index + 1;
          });
          onPhaseOneLayoutOperation?.({
            type: "MERGE_SECTION",
            sectionIndex: idx,
          });
          onChange?.(newData);
        };

        const renderSectionActions = () => (
          <>
            {viewMode === "UI_ONLY" && (
              <button
                type="button"
                onClick={() => toggleEdit(`section-${idx}`)}
                className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors"
                title="Chỉnh sửa Đề mục"
              >
                <PenTool className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              aria-label="Gộp nội dung vào đề mục trước"
              disabled={idx === 0}
              onClick={mergeSectionIntoPrevious}
              className="flex items-center justify-center rounded border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-blue-400"
              title={
                idx === 0
                  ? "Không thể gộp vì đây là đề mục đầu tiên"
                  : "Gộp nội dung vào đề mục trước"
              }
            >
              <Combine className="h-4 w-4" aria-hidden="true" />
            </button>
            <div
              title="Kéo thả để sắp xếp đề mục"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDraggedSection(idx);
              }}
              onDragEnd={() => setDraggedSection(null)}
              className="p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 transition-colors bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm flex items-center justify-center"
            >
              <GripVertical className="w-4 h-4" />
            </div>
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => {
                const newData = { ...data };
                if (newData.sections) {
                  const temp = newData.sections[idx];
                  newData.sections[idx] = newData.sections[idx - 1]!;
                  newData.sections[idx - 1] = temp!;
                  newData.sections.forEach((s, i) => {
                    s.order = i + 1;
                  });
                  onPhaseOneLayoutOperation?.({
                    type: "MOVE_SECTION",
                    sectionIndex: idx,
                    targetSectionIndex: idx - 1,
                  });
                  onChange?.(newData);
                }
              }}
              className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-500 flex items-center justify-center"
              title="Di chuyển lên"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={idx === (data.sections?.length || 0) - 1}
              onClick={() => {
                const newData = { ...data };
                if (newData.sections) {
                  const temp = newData.sections[idx];
                  newData.sections[idx] = newData.sections[idx + 1]!;
                  newData.sections[idx + 1] = temp!;
                  newData.sections.forEach((s, i) => {
                    s.order = i + 1;
                  });
                  onPhaseOneLayoutOperation?.({
                    type: "MOVE_SECTION",
                    sectionIndex: idx,
                    targetSectionIndex: idx + 1,
                  });
                  onChange?.(newData);
                }
              }}
              className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-500 flex items-center justify-center"
              title="Di chuyển xuống"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setPendingDeleteTarget({
                  kind: "SECTION",
                  itemName: section.displayHeading || `Đề mục ${idx + 1}`,
                  sectionIndex: idx,
                })
              }
              className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-red-600 dark:text-slate-400 transition-colors flex items-center justify-center"
              title="Xóa toàn bộ đề mục"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === idx ? null : idx)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-md transition-colors shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <Plus className="w-4 h-4" />
                Thêm khối
              </button>
              <div
                className={`absolute right-0 top-full mt-1 w-48 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 transition-all z-20 ${activeDropdown === idx ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}
              >
                {Object.entries(BLOCK_CONFIG).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        const newData = { ...data };
                        if (newData.sections && newData.sections[idx]) {
                          if (!newData.sections[idx].blocks)
                            newData.sections[idx].blocks = [];
                          newData.sections[idx].blocks.push(getBlockDefaultData(type));
                          onChange?.(newData);

                          const newBlockIdx = newData.sections[idx].blocks.length - 1;
                          setTimeout(() => {
                            const el = document.getElementById(
                              `block-${idx}-${newBlockIdx}`,
                            );
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }, 100);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        );

        return (
          <div
            key={idx}
            id={getLessonSummarySectionAnchorId(idx)}
            className={`scroll-mt-24 space-y-4 transition-all rounded-2xl ${
              draggedSection === idx
                ? "opacity-50 ring-2 ring-blue-500 ring-offset-4 ring-offset-white dark:ring-offset-slate-900"
                : ""
            } ${
              dragOverSection === idx
                ? "ring-2 ring-blue-500 ring-offset-4 ring-offset-white dark:ring-offset-slate-900 bg-blue-50/30 dark:bg-blue-900/10 scale-[1.01]"
                : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedSection !== null) {
                setDragOverSection(idx);
              } else if (draggedItem !== null) {
                setDragOverSection(idx);
              }
            }}
            onDragLeave={() => setDragOverSection(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverSection(null);
              if (draggedSection !== null) {
                if (draggedSection === idx) {
                  setDraggedSection(null);
                  return;
                }
                const newData = { ...data };
                if (newData.sections) {
                  const sections = [...newData.sections];
                  const draggedSecData = sections[draggedSection]!;
                  sections.splice(draggedSection, 1);
                  sections.splice(idx, 0, draggedSecData);

                  sections.forEach((s, i) => {
                    s.order = i + 1;
                  });

                  newData.sections = sections;
                  onPhaseOneLayoutOperation?.({
                    type: "MOVE_SECTION",
                    sectionIndex: draggedSection,
                    targetSectionIndex: idx,
                  });
                  onChange?.(newData);
                }
                setDraggedSection(null);
              } else if (draggedItem !== null) {
                const newData = { ...data };
                if (newData.sections) {
                  const sourceSectionIdx = draggedItem.sectionIdx;
                  const sourceBlockIdx = draggedItem.blockIdx;

                  if (sourceSectionIdx === idx) {
                    setDraggedItem(null);
                    return;
                  }

                  const sourceSection = newData.sections[sourceSectionIdx]!;
                  const targetSection = newData.sections[idx]!;

                  const sourceBlocks = [...(sourceSection.blocks || [])];
                  const draggedBlockData = sourceBlocks[sourceBlockIdx];
                  sourceBlocks.splice(sourceBlockIdx, 1);
                  sourceSection.blocks = sourceBlocks;

                  const targetBlocks = [...(targetSection.blocks || [])];
                  const targetBlockIndex = targetBlocks.length;
                  targetBlocks.push(draggedBlockData);
                  targetSection.blocks = targetBlocks;

                  onPhaseOneLayoutOperation?.({
                    type: "MOVE_BLOCK",
                    sectionIndex: sourceSectionIdx,
                    blockIndex: sourceBlockIdx,
                    targetSectionIndex: idx,
                    targetBlockIndex,
                  });
                  onChange?.(newData);
                }
                setDraggedItem(null);
              }
            }}
          >
            <div className="relative">
              {!isReadOnly && viewMode === "SPLIT" && (
                <div className="flex justify-end gap-2 w-full relative mb-2">
                  {renderSectionActions()}
                </div>
              )}
              <div
                className={`transition-all ${viewMode === "SPLIT" ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "group/header flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"}`}
              >
                <h3
                  className={`group flex items-center gap-3 text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 ${viewMode !== "SPLIT" ? "flex-1" : ""}`}
                >
                  <span className="flex-none bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 w-9 h-9 rounded-xl flex items-center justify-center text-base font-black border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                    {section.order || idx + 1}
                  </span>
                  <span className="relative pb-1">
                    {section.displayHeading}
                    <span className="absolute bottom-0 left-0 w-12 h-1 bg-blue-500/20 dark:bg-blue-400/20 rounded-full group-hover:w-full transition-all duration-500 ease-out"></span>
                  </span>
                </h3>

                {/* Tool Bar Section */}
                {!isReadOnly && (
                  <div
                    className={`flex flex-col items-end gap-2 ${viewMode === "SPLIT" ? "w-full" : "z-10 w-full flex-none opacity-100 transition-opacity sm:w-auto sm:opacity-0 sm:group-hover/header:opacity-100"}`}
                  >
                    {viewMode === "UI_ONLY" && (
                      <div className="relative flex w-full flex-wrap justify-end gap-2">
                        {renderSectionActions()}
                      </div>
                    )}

                    {isSectionEditing && (
                      <div className="relative border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto w-full mb-4 [&_*:has(textarea)]:!flex-wrap [&_*:has(>textarea)]:!basis-full [&_*:has(>textarea)]:!block [&_*:has(>textarea)]:!w-full [&_textarea]:!w-full [&_textarea]:!min-h-[100px] [&_textarea]:!mt-2 [&_textarea]:!p-2 [&_textarea]:!box-border [&_textarea]:!leading-relaxed">
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md px-1 py-0.5 z-10">
                          {viewMode === "UI_ONLY" && (
                            <button
                              type="button"
                              onClick={() => toggleEdit(`section-${idx}`)}
                              title="Đóng chế độ chỉnh sửa"
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <ReactJson
                          src={{ displayHeading: section.displayHeading }}
                          onEdit={(e) => {
                            const newData = { ...data };
                            if (newData.sections) {
                              newData.sections[idx] = {
                                ...newData.sections[idx],
                                ...(e.updated_src as any),
                              };
                            }
                            onChange?.(newData);
                          }}
                          theme="rjv-default"
                          style={{ backgroundColor: "transparent" }}
                          displayDataTypes={false}
                          name={false}
                          enableClipboard={false}
                          keyModifier={(e: any) =>
                            e.detail >= 2 || e.metaKey || e.ctrlKey
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {section.blocks?.map((block, bIdx) => {
                const blockPath = `sections.${idx}.blocks.${bIdx}`;
                const phaseOneBlockJson = phaseOneBlockJsonByPath?.[blockPath];
                const hasPhaseOneBlockJson =
                  typeof phaseOneBlockJson === "object" &&
                  phaseOneBlockJson !== null &&
                  !Array.isArray(phaseOneBlockJson);
                runningCounts[block.type] = (runningCounts[block.type] || 0) + 1;

                // Only assign a number for "example" blocks, if there is more than 1 in the lesson
                const computedDisplayNumber =
                  block.type === "example" && (globalTypeCounts[block.type] ?? 0) > 1
                    ? runningCounts[block.type]
                    : undefined;

                // Override the AI's displayNumber (if any) with the mathematically correct one
                const blockToRender = {
                  ...block,
                  displayNumber: computedDisplayNumber,
                  figures: Array.isArray(block.figures)
                    ? block.figures.map((visual: unknown) =>
                        resolveStemFigureVisual(visual, stemFigureVisuals),
                      )
                    : [],
                };
                const blockColorClass = getBlockDragColor(blockToRender.type);

                const isBlockEditing =
                  viewMode === "SPLIT" || editingItems.has(`block-${idx}-${bIdx}`);
                const acceptBlockIssue = (issueId: string) => {
                  if (!onChange) return;
                  const newData = structuredClone(data);
                  const targetBlock = newData.sections?.[idx]?.blocks?.[bIdx];
                  if (!targetBlock) return;
                  targetBlock.reviewIssues = targetBlock.reviewIssues?.map(
                    (issue: ReviewIssueData) =>
                      issue.id === issueId &&
                      resolveReviewIssueResolution(issue) === "ACCEPT_OR_FIX"
                        ? { ...issue, accepted: true }
                        : issue,
                  );
                  onChange(newData);
                };
                const deleteBrokenDiagram = (issueId: string) => {
                  if (!onChange) return;
                  const newData = structuredClone(data);
                  const targetBlock = newData.sections?.[idx]?.blocks?.[bIdx];
                  if (!targetBlock) return;

                  const issue = targetBlock.reviewIssues?.find(
                    (candidate: ReviewIssueData) => candidate.id === issueId,
                  );
                  if (
                    !issue ||
                    !issue.code.startsWith("DIAGRAM_") ||
                    resolveReviewIssueResolution(issue) !== "FIX_ONLY"
                  ) {
                    return;
                  }

                  delete targetBlock.visual;
                  const remainingIssues = targetBlock.reviewIssues.filter(
                    (candidate: ReviewIssueData) => candidate.id !== issueId,
                  );
                  if (remainingIssues.length > 0) {
                    targetBlock.reviewIssues = remainingIssues;
                  } else {
                    delete targetBlock.reviewIssues;
                  }
                  onChange(newData);
                };

                const handleMoveUp = () => {
                  const newData = { ...data };
                  if (newData.sections) {
                    if (bIdx > 0) {
                      const blocks = [...newData.sections![idx]!.blocks!];
                      const temp = blocks[bIdx];
                      blocks[bIdx] = blocks[bIdx - 1]!;
                      blocks[bIdx - 1] = temp!;
                      newData.sections![idx]!.blocks = blocks;
                      onPhaseOneLayoutOperation?.({
                        type: "MOVE_BLOCK",
                        sectionIndex: idx,
                        blockIndex: bIdx,
                        targetSectionIndex: idx,
                        targetBlockIndex: bIdx - 1,
                      });
                    } else if (idx > 0) {
                      const currentBlocks = [...newData.sections![idx]!.blocks!];
                      const blockToMove = currentBlocks.splice(bIdx, 1)[0]!;
                      newData.sections![idx]!.blocks = currentBlocks;
                      if (!newData.sections![idx - 1]!.blocks)
                        newData.sections![idx - 1]!.blocks = [];
                      const targetBlockIndex = newData.sections![idx - 1]!.blocks!.length;
                      newData.sections![idx - 1]!.blocks!.push(blockToMove);
                      onPhaseOneLayoutOperation?.({
                        type: "MOVE_BLOCK",
                        sectionIndex: idx,
                        blockIndex: bIdx,
                        targetSectionIndex: idx - 1,
                        targetBlockIndex,
                      });
                    }
                    onChange?.(newData);
                  }
                };

                const handleMoveDown = () => {
                  const newData = { ...data };
                  if (newData.sections) {
                    const blocks = newData.sections![idx]!.blocks || [];
                    if (bIdx < blocks.length - 1) {
                      const newBlocks = [...blocks];
                      const temp = newBlocks[bIdx];
                      newBlocks[bIdx] = newBlocks[bIdx + 1]!;
                      newBlocks[bIdx + 1] = temp!;
                      newData.sections![idx]!.blocks = newBlocks;
                      onPhaseOneLayoutOperation?.({
                        type: "MOVE_BLOCK",
                        sectionIndex: idx,
                        blockIndex: bIdx,
                        targetSectionIndex: idx,
                        targetBlockIndex: bIdx + 1,
                      });
                    } else if (idx < (data.sections?.length || 0) - 1) {
                      const currentBlocks = [...blocks];
                      const blockToMove = currentBlocks.splice(bIdx, 1)[0]!;
                      newData.sections![idx]!.blocks = currentBlocks;
                      if (!newData.sections![idx + 1]!.blocks)
                        newData.sections![idx + 1]!.blocks = [];
                      newData.sections![idx + 1]!.blocks!.unshift(blockToMove);
                      onPhaseOneLayoutOperation?.({
                        type: "MOVE_BLOCK",
                        sectionIndex: idx,
                        blockIndex: bIdx,
                        targetSectionIndex: idx + 1,
                        targetBlockIndex: 0,
                      });
                    }
                    onChange?.(newData);
                  }
                };

                return (
                  <div
                    key={bIdx}
                    id={`block-${idx}-${bIdx}`}
                    className={`relative transition-all group/block ${isBlockEditing ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""} ${
                      draggedItem?.sectionIdx === idx && draggedItem?.blockIdx === bIdx
                        ? `opacity-50 ring-2 ${blockColorClass} rounded-xl`
                        : ""
                    } ${
                      dragOverItem?.sectionIdx === idx && dragOverItem?.blockIdx === bIdx
                        ? `ring-2 ${blockColorClass} rounded-xl bg-${blockColorClass!.split("-")[1]}-50/30 dark:bg-${blockColorClass!.split("-")[1]}-900/10`
                        : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedItem) {
                        setDragOverItem({ sectionIdx: idx, blockIdx: bIdx });
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverItem(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverItem(null);
                      if (draggedItem) {
                        const sourceSectionIdx = draggedItem.sectionIdx;
                        const sourceBlockIdx = draggedItem.blockIdx;
                        const targetSectionIdx = idx;
                        const targetBlockIdx = bIdx;

                        if (
                          sourceSectionIdx === targetSectionIdx &&
                          sourceBlockIdx === targetBlockIdx
                        ) {
                          setDraggedItem(null);
                          return;
                        }

                        const newData = { ...data };
                        if (newData.sections) {
                          const sourceSection = newData.sections[sourceSectionIdx]!;
                          const targetSection = newData.sections[targetSectionIdx]!;

                          const sourceBlocks = [...(sourceSection.blocks || [])];
                          const draggedBlockData = sourceBlocks[sourceBlockIdx];

                          sourceBlocks.splice(sourceBlockIdx, 1);
                          sourceSection.blocks = sourceBlocks;

                          let targetBlocks;
                          if (sourceSectionIdx === targetSectionIdx) {
                            targetBlocks = sourceBlocks;
                          } else {
                            targetBlocks = [...(targetSection.blocks || [])];
                          }

                          targetBlocks.splice(targetBlockIdx, 0, draggedBlockData);

                          if (sourceSectionIdx !== targetSectionIdx) {
                            targetSection.blocks = targetBlocks;
                          }

                          onPhaseOneLayoutOperation?.({
                            type: "MOVE_BLOCK",
                            sectionIndex: sourceSectionIdx,
                            blockIndex: sourceBlockIdx,
                            targetSectionIndex: targetSectionIdx,
                            targetBlockIndex: targetBlockIdx,
                          });
                          onChange?.(newData);
                        }
                        setDraggedItem(null);
                      }
                    }}
                  >
                    <div className="relative">
                      <BlockItem
                        block={blockToRender}
                        renderStemFigure={renderStemFigure}
                        showEditorialMetadata={showEditorialMetadata}
                      />
                      {!isReadOnly &&
                      (viewMode === "SPLIT" || isBlockEditing) &&
                      renderBlockSourceAction ? (
                        <div className="absolute right-2 top-2 z-10 flex items-center rounded-md border border-slate-200 bg-white/90 px-1 py-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                          {renderBlockSourceAction({
                            blockPath,
                            block: blockToRender,
                          })}
                        </div>
                      ) : null}
                      {showEditorialMetadata ? (
                        <ReviewIssuePanel
                          issues={block.reviewIssues}
                          onAccept={acceptBlockIssue}
                          onDeleteDiagram={deleteBrokenDiagram}
                        />
                      ) : null}
                    </div>
                    {!isReadOnly && (
                      <div className="flex flex-col items-end gap-2 w-full h-full">
                        {/* Toolbar for UI_ONLY mode (Floating on the UI Block) */}
                        {!isBlockEditing && (
                          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-slate-200 bg-white/90 px-1 py-0.5 opacity-100 shadow-sm transition-opacity focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-800/90 sm:opacity-0 sm:group-hover/block:opacity-100">
                            {renderBlockSourceAction?.({
                              blockPath,
                              block: blockToRender,
                            })}
                            {renderBlockImageActions?.({
                              blockPath,
                              block: blockToRender,
                            })}
                            {viewMode === "UI_ONLY" && (
                              <button
                                type="button"
                                onClick={() => toggleEdit(`block-${idx}-${bIdx}`)}
                                title="Chỉnh sửa Khối"
                                className="p-1.5 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors mr-1"
                              >
                                <PenTool className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleMoveUp}
                              title="Di chuyển lên"
                              disabled={bIdx === 0 && idx === 0}
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleMoveDown}
                              title="Di chuyển xuống"
                              disabled={
                                bIdx === (section.blocks?.length || 0) - 1 &&
                                idx === (data.sections?.length || 0) - 1
                              }
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newData = { ...data };
                                if (newData.sections?.[idx]?.blocks) {
                                  const blocks = [...newData.sections[idx].blocks];
                                  const copiedBlock = JSON.parse(
                                    JSON.stringify(blocks[bIdx]),
                                  );
                                  blocks.splice(bIdx + 1, 0, copiedBlock);
                                  newData.sections[idx].blocks = blocks;
                                  onChange(newData);
                                }
                              }}
                              title="Nhân bản khối này"
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingDeleteTarget({
                                  kind: "BLOCK",
                                  blockIndex: bIdx,
                                  itemName:
                                    BLOCK_CONFIG[blockToRender.type]?.label ??
                                    "Khối nội dung",
                                  sectionIndex: idx,
                                })
                              }
                              title="Xóa khối này"
                              className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
                            <div
                              title="Kéo thả để sắp xếp"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDraggedItem({ sectionIdx: idx, blockIdx: bIdx });
                              }}
                              onDragEnd={() => setDraggedItem(null)}
                              className="p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        )}

                        {/* Toolbar for SPLIT mode (Inside the JSON Editor) */}
                        {isBlockEditing && (
                          <div className="w-full h-full relative border rounded-lg bg-slate-50 dark:bg-slate-900 p-3 overflow-auto max-h-[500px] [&_*:has(textarea)]:!flex-wrap [&_*:has(>textarea)]:!basis-full [&_*:has(>textarea)]:!block [&_*:has(>textarea)]:!w-full [&_textarea]:!w-full [&_textarea]:!min-h-[200px] [&_textarea]:!mt-2 [&_textarea]:!p-3 [&_textarea]:!box-border [&_textarea]:!leading-relaxed">
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md px-1 py-0.5 z-10">
                              {viewMode === "UI_ONLY" && (
                                <button
                                  type="button"
                                  onClick={() => toggleEdit(`block-${idx}-${bIdx}`)}
                                  title="Đóng chế độ chỉnh sửa"
                                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleMoveUp}
                                title="Di chuyển lên"
                                disabled={bIdx === 0 && idx === 0}
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleMoveDown}
                                title="Di chuyển xuống"
                                disabled={
                                  bIdx === (section.blocks?.length || 0) - 1 &&
                                  idx === (data.sections?.length || 0) - 1
                                }
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newData = { ...data };
                                  if (newData.sections?.[idx]?.blocks) {
                                    const blocks = [...newData.sections[idx].blocks];
                                    const copiedBlock = JSON.parse(
                                      JSON.stringify(blocks[bIdx]),
                                    );
                                    blocks.splice(bIdx + 1, 0, copiedBlock);
                                    newData.sections[idx].blocks = blocks;
                                    onChange(newData);
                                  }
                                }}
                                title="Nhân bản khối này"
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDeleteTarget({
                                    kind: "BLOCK",
                                    blockIndex: bIdx,
                                    itemName:
                                      BLOCK_CONFIG[blockToRender.type]?.label ??
                                      "Khối nội dung",
                                    sectionIndex: idx,
                                  })
                                }
                                title="Xóa khối này"
                                className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
                              <div
                                title="Kéo thả để sắp xếp"
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = "move";
                                  setDraggedItem({ sectionIdx: idx, blockIdx: bIdx });
                                }}
                                onDragEnd={() => setDraggedItem(null)}
                                className="p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 transition-colors"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            {hasPhaseOneBlockJson ? (
                              <ReactJson
                                src={phaseOneBlockJson as object}
                                onEdit={(event) =>
                                  onPhaseOneBlockJsonChange?.(
                                    blockPath,
                                    event.updated_src,
                                  )
                                }
                                onAdd={(event) =>
                                  onPhaseOneBlockJsonChange?.(
                                    blockPath,
                                    event.updated_src,
                                  )
                                }
                                onDelete={(event) =>
                                  onPhaseOneBlockJsonChange?.(
                                    blockPath,
                                    event.updated_src,
                                  )
                                }
                                theme="rjv-default"
                                style={{ backgroundColor: "transparent" }}
                                displayDataTypes={false}
                                name={false}
                                enableClipboard={false}
                                keyModifier={(e: any) =>
                                  e.detail >= 2 || e.metaKey || e.ctrlKey
                                }
                              />
                            ) : (
                              <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                Bản này chưa có raw Phase 1. Hãy sinh lại kiến thức để
                                chỉnh sửa JSON gốc.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <DeleteConfirmDialog
        confirmLabel={
          pendingDeleteTarget?.kind === "SECTION" ? "Xóa section" : "Xóa khối"
        }
        description={
          pendingDeleteTarget?.kind === "SECTION"
            ? `Section “${pendingDeleteTarget.itemName}” và toàn bộ nội dung bên trong sẽ bị xóa. Hành động này không thể hoàn tác.`
            : pendingDeleteTarget
              ? `Khối “${pendingDeleteTarget.itemName}” sẽ bị xóa khỏi đề mục. Hành động này không thể hoàn tác.`
              : undefined
        }
        isOpen={pendingDeleteTarget !== null}
        itemName={pendingDeleteTarget?.itemName ?? ""}
        onCancel={() => setPendingDeleteTarget(null)}
        onConfirm={confirmPendingDelete}
        title={pendingDeleteTarget?.kind === "SECTION" ? "Xóa section" : "Xóa khối?"}
      />
    </div>
  );
}

function ReviewIssuePanel({
  issues,
  onAccept,
  onDeleteDiagram,
}: {
  issues?: ReviewIssueData[];
  onAccept: (issueId: string) => void;
  onDeleteDiagram?: (issueId: string) => void;
}) {
  const unresolved =
    issues?.filter(
      (issue) => resolveReviewIssueResolution(issue) === "FIX_ONLY" || !issue.accepted,
    ) ?? [];
  if (unresolved.length === 0) return null;
  const fixOnlyCount = unresolved.filter(
    (issue) => resolveReviewIssueResolution(issue) === "FIX_ONLY",
  ).length;
  const onlyContainsUnrenderableDiagrams = unresolved.every(
    (issue) => issue.code === "DIAGRAM_CANNOT_RENDER",
  );
  const summary =
    fixOnlyCount === 0
      ? `${unresolved.length} vấn đề cần sửa hoặc chấp nhận`
      : fixOnlyCount === unresolved.length
        ? `${unresolved.length} vấn đề cần sửa`
        : `${unresolved.length} vấn đề cần xử lý`;
  return (
    <div
      className={
        onlyContainsUnrenderableDiagrams
          ? "mt-3 space-y-3 text-sm"
          : "mt-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 sm:p-4"
      }
    >
      {!onlyContainsUnrenderableDiagrams ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-7 items-center rounded-full border border-amber-400 bg-amber-100 px-2.5 text-xs font-extrabold text-amber-900 dark:border-amber-600 dark:bg-amber-900/60 dark:text-amber-100">
            Cần kiểm tra
          </span>
          <span className="font-bold">{summary}</span>
        </div>
      ) : null}
      {unresolved.map((issue) => {
        const isDiagram = issue.code.startsWith("DIAGRAM_");
        const isUnrenderableDiagram = issue.code === "DIAGRAM_CANNOT_RENDER";
        const canAccept = resolveReviewIssueResolution(issue) === "ACCEPT_OR_FIX";
        const canDeleteBrokenDiagram =
          isDiagram && !canAccept && Boolean(onDeleteDiagram);
        return (
          <div
            key={issue.id}
            className={
              isUnrenderableDiagram
                ? "rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 sm:p-4"
                : "rounded-lg border border-amber-200 bg-white/80 p-3 dark:border-amber-800 dark:bg-slate-950/60"
            }
          >
            {isUnrenderableDiagram ? (
              <div className="mb-3 flex min-h-16 items-center justify-center gap-2 border-b border-amber-200 px-2 pb-3 text-center font-extrabold dark:border-amber-800">
                <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Hình lỗi — chưa đủ dữ liệu an toàn để hiển thị</span>
              </div>
            ) : null}
            <p>
              <strong>Vấn đề:</strong> {issue.message}
            </p>
            <p className="mt-1">
              <strong>Gợi ý sửa:</strong> {issue.suggestion}
            </p>
            {issue.technicalDetails ? (
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold">
                  Chi tiết kỹ thuật
                </summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-2 text-xs text-slate-100">
                  {issue.technicalDetails}
                </pre>
              </details>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {canAccept ? (
                <button
                  type="button"
                  onClick={() => onAccept(issue.id)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500 bg-white px-3 text-sm font-extrabold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-amber-950"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {isDiagram ? "Chấp nhận hình này" : "Chấp nhận khối này"}
                </button>
              ) : null}
              {canDeleteBrokenDiagram ? (
                <button
                  type="button"
                  onClick={() => onDeleteDiagram?.(issue.id)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-500 bg-white px-3 text-sm font-extrabold text-red-700 transition-colors hover:bg-red-50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Xóa hình lỗi
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockItem({
  block,
  renderStemFigure,
  showEditorialMetadata,
}: {
  block: BlockData;
  renderStemFigure?: LessonSummaryFigureRenderer;
  showEditorialMetadata: boolean;
}) {
  switch (block.type) {
    case "example":
      return (
        <ExampleBlock
          block={block}
          renderStemFigure={renderStemFigure}
          showEditorialMetadata={showEditorialMetadata}
        />
      );
    case "knowledge":
    case "property":
    case "theorem":
    case "note":
      return <CalloutBlock block={block} renderStemFigure={renderStemFigure} />;
    default:
      return (
        <div className="p-3 border border-slate-200 rounded text-sm text-slate-500 overflow-auto">
          <em>Unsupported block type: {block.type}</em>
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
  }
}

function resolveStemFigureVisual(
  visual: unknown,
  stemFigureVisuals: ReadonlyMap<string, StemFigureVisual> | undefined,
) {
  if (
    !visual ||
    typeof visual !== "object" ||
    Array.isArray(visual) ||
    (visual as { kind?: unknown }).kind !== "TEX_FIGURE" ||
    typeof (visual as { figureId?: unknown }).figureId !== "string"
  ) {
    return visual;
  }
  return stemFigureVisuals?.get((visual as { figureId: string }).figureId) ?? visual;
}

const COLOR_STYLES: Record<string, any> = {
  blue: {
    bg: "bg-blue-50/50 dark:bg-blue-900/10",
    border: "border-blue-200 dark:border-blue-900/50",
    text: "text-blue-900 dark:text-blue-100",
    label: "text-blue-600/70 dark:text-blue-400/70",
  },
  indigo: {
    bg: "bg-indigo-50/50 dark:bg-indigo-900/10",
    border: "border-indigo-200 dark:border-indigo-900/50",
    text: "text-indigo-900 dark:text-indigo-100",
    label: "text-indigo-600/70 dark:text-indigo-400/70",
  },
  teal: {
    bg: "bg-teal-50/50 dark:bg-teal-900/10",
    border: "border-teal-200 dark:border-teal-900/50",
    text: "text-teal-900 dark:text-teal-100",
    label: "text-teal-600/70 dark:text-teal-400/70",
  },
  rose: {
    bg: "bg-rose-50/50 dark:bg-rose-900/10",
    border: "border-rose-200 dark:border-rose-900/50",
    text: "text-rose-900 dark:text-rose-100",
    label: "text-rose-600/70 dark:text-rose-400/70",
  },
  fuchsia: {
    bg: "bg-fuchsia-50/50 dark:bg-fuchsia-900/10",
    border: "border-fuchsia-200 dark:border-fuchsia-900/50",
    text: "text-fuchsia-900 dark:text-fuchsia-100",
    label: "text-fuchsia-600/70 dark:text-fuchsia-400/70",
  },
  amber: {
    bg: "bg-amber-50/50 dark:bg-amber-900/10",
    border: "border-amber-200 dark:border-amber-900/50",
    text: "text-amber-900 dark:text-amber-100",
    label: "text-amber-600/70 dark:text-amber-400/70",
  },
  yellow: {
    bg: "bg-yellow-50/50 dark:bg-yellow-900/10",
    border: "border-yellow-200 dark:border-yellow-900/50",
    text: "text-yellow-900 dark:text-yellow-100",
    label: "text-yellow-600/70 dark:text-yellow-400/70",
  },
  red: {
    bg: "bg-red-50/50 dark:bg-red-900/10",
    border: "border-red-200 dark:border-red-900/50",
    text: "text-red-900 dark:text-red-100",
    label: "text-red-600/70 dark:text-red-400/70",
  },
  green: {
    bg: "bg-green-50/50 dark:bg-green-900/10",
    border: "border-green-200 dark:border-green-900/50",
    text: "text-green-900 dark:text-green-100",
    label: "text-green-600/70 dark:text-green-400/70",
  },
  emerald: {
    bg: "bg-emerald-50/50 dark:bg-emerald-900/10",
    border: "border-emerald-200 dark:border-emerald-900/50",
    text: "text-emerald-900 dark:text-emerald-100",
    label: "text-emerald-600/70 dark:text-emerald-400/70",
  },
  cyan: {
    bg: "bg-cyan-50/50 dark:bg-cyan-900/10",
    border: "border-cyan-200 dark:border-cyan-900/50",
    text: "text-cyan-900 dark:text-cyan-100",
    label: "text-cyan-600/70 dark:text-cyan-400/70",
  },
  violet: {
    bg: "bg-violet-50/50 dark:bg-violet-900/10",
    border: "border-violet-200 dark:border-violet-900/50",
    text: "text-violet-900 dark:text-violet-100",
    label: "text-violet-600/70 dark:text-violet-400/70",
  },
  purple: {
    bg: "bg-purple-50/50 dark:bg-purple-900/10",
    border: "border-purple-200 dark:border-purple-900/50",
    text: "text-purple-900 dark:text-purple-100",
    label: "text-purple-600/70 dark:text-purple-400/70",
  },
  sky: {
    bg: "bg-sky-50/50 dark:bg-sky-900/10",
    border: "border-sky-200 dark:border-sky-900/50",
    text: "text-sky-900 dark:text-sky-100",
    label: "text-sky-600/70 dark:text-sky-400/70",
  },
  orange: {
    bg: "bg-orange-50/50 dark:bg-orange-900/10",
    border: "border-orange-200 dark:border-orange-900/50",
    text: "text-orange-900 dark:text-orange-100",
    label: "text-orange-600/70 dark:text-orange-400/70",
  },
  slate: {
    bg: "bg-slate-50/50 dark:bg-slate-900/10",
    border: "border-slate-200 dark:border-slate-900/50",
    text: "text-slate-900 dark:text-slate-100",
    label: "text-slate-600/70 dark:text-slate-400/70",
  },
};

function BaseBlockContainer({
  block,
  children,
}: {
  block: BlockData;
  children: React.ReactNode;
}) {
  const config = BLOCK_CONFIG[block.type] || {
    label: block.type,
    color: "slate",
    icon: Info,
  };
  const styles = COLOR_STYLES[config.color] || COLOR_STYLES.slate;
  const Icon = config.icon;

  const hideTitleTypes = ["note", "example"];
  const shouldShowTitle = block.title && !hideTitleTypes.includes(block.type);

  return (
    <div className={`rounded-xl border p-3 sm:p-5 ${styles.bg} ${styles.border}`}>
      <div
        className={`flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider mb-1 ${styles.label}`}
      >
        <Icon className="w-4 h-4" />
        {config.label} {block.displayNumber ? block.displayNumber : ""}
      </div>
      {shouldShowTitle && (
        <div className={`font-bold ${styles.text}`}>
          <MathpixMarkdownRenderer content={normalizeBlockMath(block.title, block)} />
        </div>
      )}
      <div className="space-y-2 opacity-90 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
}

function CalloutBlock({
  block,
  renderStemFigure,
}: {
  block: BlockData;
  renderStemFigure?: LessonSummaryFigureRenderer;
}) {
  const content =
    block.type === "note"
      ? normalizeLessonSummaryNoteContent(block.content ?? "")
      : block.content;
  return (
    <BaseBlockContainer block={block}>
      {content && (
        <MathpixMarkdownRenderer content={normalizeBlockMath(content, block)} />
      )}
      <TheoryBlockDiagram block={block} renderStemFigure={renderStemFigure} />
    </BaseBlockContainer>
  );
}

function TheoryBlockDiagram({
  block,
  renderStemFigure,
}: {
  block: BlockData;
  renderStemFigure?: LessonSummaryFigureRenderer;
}) {
  return Array.isArray(block.figures)
    ? block.figures.map((visual: StemFigureVisual) =>
        visual.kind === "TEX_FIGURE" ? (
          <div key={visual.figureId}>
            {renderStemFigure ? renderStemFigure(visual) : <StemFigure visual={visual} />}
          </div>
        ) : null,
      )
    : null;
}

function ExampleBlock({
  block,
  renderStemFigure,
  showEditorialMetadata,
}: {
  block: BlockData;
  renderStemFigure?: LessonSummaryFigureRenderer;
  showEditorialMetadata: boolean;
}) {
  return (
    <LessonSummaryExampleCard
      answerLabel="Kết luận"
      block={block}
      displayNumber={block.displayNumber}
      renderFigure={renderStemFigure}
      showEditorialWarning={showEditorialMetadata}
    />
  );
}

function normalizeBlockMath(value: string, block: BlockData) {
  return normalizeLessonSummaryAngleNotation(value);
}
