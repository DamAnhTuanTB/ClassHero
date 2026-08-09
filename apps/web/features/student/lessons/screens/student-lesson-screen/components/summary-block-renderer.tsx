import React from "react";
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
  ListOrdered,
  FileBadge,
  PlayCircle,
  Flag,
  GripVertical,
  Copy,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { LessonSummaryDiagram } from "@/components/common/content/lesson-summary-diagram";

// Define a type for any generic block (loose typing since it comes from JSON)
type BlockData = any;

import dynamic from "next/dynamic";
const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

interface SummaryBlockRendererProps {
  data: {
    title: string;
    objectives?: string[];
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
}

const BLOCK_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  knowledge: { label: "Kiến thức", color: "yellow", icon: BookOpen },
  property: { label: "Tính chất", color: "teal", icon: Bookmark },
  theorem: { label: "Định lí", color: "green", icon: GraduationCap },
  note: { label: "Chú ý", color: "rose", icon: AlertCircle },

  procedure: { label: "Phương pháp giải", color: "cyan", icon: ListOrdered },

  example: { label: "Ví dụ", color: "blue", icon: PlayCircle },
  section_recap: { label: "Tổng kết", color: "orange", icon: Flag },
};

export function SummaryBlockRenderer({
  data,
  displayTitle,
  hideTitle,
  onChange,
  viewMode = "SPLIT",
  showEditorialMetadata = false,
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
      case "section_recap":
        return { type, title: "Tổng kết mới", points: ["Điểm tổng kết mới"] };
      case "example":
        return {
          ...base,
          problem: "Nhập đề bài tại đây...",
          solution: "Ta có: $x=2$",
          answer: "Đáp án cuối cùng...",
        };

      case "procedure":
        return {
          ...base,
          steps: [{ content: "Nội dung bước 1..." }],
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

  return (
    <div className="mt-4 space-y-8 react-json-custom-edit-wrapper">
      {/* Title */}
      {!hideTitle && (
        <div className="relative group/title">
          {!isReadOnly && viewMode === "SPLIT" && (
            <div className="flex justify-end mb-2">
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
          <div
            className={
              viewMode === "SPLIT"
                ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
                : "flex justify-between items-start gap-4"
            }
          >
            <div className="text-2xl sm:text-3xl font-black mb-6 tracking-tight text-slate-800 dark:text-slate-100 pr-10 flex-1">
              {displayTitle || data.title}
            </div>

            {!isReadOnly && viewMode === "UI_ONLY" && (
              <div className="flex justify-end opacity-0 group-hover/title:opacity-100 transition-opacity">
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

      {/* Objectives */}
      {data.objectives && data.objectives.length > 0 && (
        <div
          className={`relative group/obj ${isObjectivesEditing ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}`}
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
                    content={obj}
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
      )}

      {/* Sections */}
      {data.sections?.map((section, idx) => {
        const isSectionEditing =
          viewMode === "SPLIT" || editingItems.has(`section-${idx}`);

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
              onClick={() => {
                if (
                  window.confirm(
                    "Bạn có chắc chắn muốn xóa toàn bộ đề mục này và các khối bên trong?",
                  )
                ) {
                  const newData = { ...data };
                  if (newData.sections) {
                    newData.sections.splice(idx, 1);
                    newData.sections.forEach((s, i) => {
                      s.order = i + 1;
                    });
                    onChange?.(newData);
                  }
                }
              }}
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
            id={`section-${idx}`}
            className={`space-y-4 transition-all rounded-2xl ${
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
                  targetBlocks.push(draggedBlockData);
                  targetSection.blocks = targetBlocks;

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
                className={`transition-all ${viewMode === "SPLIT" ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "flex items-start justify-between group/header gap-6"}`}
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
                    className={`flex flex-col items-end gap-2 ${viewMode === "SPLIT" ? "w-full" : "flex-none opacity-0 group-hover/header:opacity-100 transition-opacity z-10"}`}
                  >
                    {viewMode === "UI_ONLY" && (
                      <div className="flex justify-end gap-2 w-full relative">
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
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              if (idx === 0) return;
                              const newData = { ...data };
                              if (newData.sections) {
                                const currentBlocks =
                                  newData.sections![idx]!.blocks || [];
                                const prevBlocks =
                                  newData.sections![idx - 1]!.blocks || [];
                                newData.sections![idx - 1]!.blocks = [
                                  ...prevBlocks,
                                  ...currentBlocks,
                                ];
                                newData.sections!.splice(idx, 1);

                                newData.sections.forEach((s, i) => {
                                  s.order = i + 1;
                                });
                                onChange?.(newData);
                              }
                            }}
                            title={
                              idx === 0
                                ? "Không thể gộp vì đây là đề mục đầu tiên"
                                : "Xóa tiêu đề và gộp khối vào đề mục trên"
                            }
                            className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                runningCounts[block.type] = (runningCounts[block.type] || 0) + 1;

                // Only assign a number for "example" blocks, if there is more than 1 in the lesson
                const computedDisplayNumber =
                  block.type === "example" && (globalTypeCounts[block.type] ?? 0) > 1
                    ? runningCounts[block.type]
                    : undefined;

                // Override the AI's displayNumber (if any) with the mathematically correct one
                const blockToRender = { ...block, displayNumber: computedDisplayNumber };
                const blockColorClass = getBlockDragColor(blockToRender.type);

                const isBlockEditing =
                  viewMode === "SPLIT" || editingItems.has(`block-${idx}-${bIdx}`);

                const handleMoveUp = () => {
                  const newData = { ...data };
                  if (newData.sections) {
                    if (bIdx > 0) {
                      const blocks = [...newData.sections![idx]!.blocks!];
                      const temp = blocks[bIdx];
                      blocks[bIdx] = blocks[bIdx - 1]!;
                      blocks[bIdx - 1] = temp!;
                      newData.sections![idx]!.blocks = blocks;
                    } else if (idx > 0) {
                      const currentBlocks = [...newData.sections![idx]!.blocks!];
                      const blockToMove = currentBlocks.splice(bIdx, 1)[0]!;
                      newData.sections![idx]!.blocks = currentBlocks;
                      if (!newData.sections![idx - 1]!.blocks)
                        newData.sections![idx - 1]!.blocks = [];
                      newData.sections![idx - 1]!.blocks!.push(blockToMove);
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
                    } else if (idx < (data.sections?.length || 0) - 1) {
                      const currentBlocks = [...blocks];
                      const blockToMove = currentBlocks.splice(bIdx, 1)[0]!;
                      newData.sections![idx]!.blocks = currentBlocks;
                      if (!newData.sections![idx + 1]!.blocks)
                        newData.sections![idx + 1]!.blocks = [];
                      newData.sections![idx + 1]!.blocks!.unshift(blockToMove);
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

                          onChange?.(newData);
                        }
                        setDraggedItem(null);
                      }
                    }}
                  >
                    <BlockItem
                      block={blockToRender}
                      showEditorialMetadata={showEditorialMetadata}
                    />
                    {!isReadOnly && (
                      <div className="flex flex-col items-end gap-2 w-full h-full">
                        {/* Toolbar for UI_ONLY mode (Floating on the UI Block) */}
                        {!isBlockEditing && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity z-10 bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md px-1 py-0.5">
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
                              onClick={() => {
                                const newData = { ...data };
                                if (newData.sections?.[idx]?.blocks) {
                                  const blocks = [...newData.sections[idx].blocks];
                                  blocks.splice(bIdx, 1);
                                  newData.sections[idx].blocks = blocks;
                                  onChange(newData);
                                }
                              }}
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
                                onClick={() => {
                                  const newData = { ...data };
                                  if (newData.sections?.[idx]?.blocks) {
                                    const blocks = [...newData.sections[idx].blocks];
                                    blocks.splice(bIdx, 1);
                                    newData.sections[idx].blocks = blocks;
                                    onChange(newData);
                                  }
                                }}
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
                            <ReactJson
                              src={block}
                              onEdit={(e) => {
                                const newData = { ...data };
                                const targetSection = newData.sections?.[idx];
                                if (targetSection && targetSection.blocks)
                                  targetSection.blocks[bIdx] = e.updated_src;
                                onChange?.(newData);
                              }}
                              onAdd={(e) => {
                                const newData = { ...data };
                                const targetSection = newData.sections?.[idx];
                                if (targetSection && targetSection.blocks)
                                  targetSection.blocks[bIdx] = e.updated_src;
                                onChange?.(newData);
                              }}
                              onDelete={(e) => {
                                const newData = { ...data };
                                const targetSection = newData.sections?.[idx];
                                if (targetSection && targetSection.blocks)
                                  targetSection.blocks[bIdx] = e.updated_src;
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
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockItem({
  block,
  showEditorialMetadata,
}: {
  block: BlockData;
  showEditorialMetadata: boolean;
}) {
  switch (block.type) {
    case "procedure":
      return <StepsBlock block={block} />;
    case "example":
      return <ExampleBlock block={block} showEditorialMetadata={showEditorialMetadata} />;
    case "section_recap":
      return <SectionRecapBlock block={block} />;
    case "knowledge":
    case "property":
    case "theorem":
    case "note":
      return <CalloutBlock block={block} />;
    default:
      return (
        <div className="p-3 border border-slate-200 rounded text-sm text-slate-500 overflow-auto">
          <em>Unsupported block type: {block.type}</em>
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
  }
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
          <MathpixMarkdownRenderer content={block.title} />
        </div>
      )}
      <div className="space-y-2 opacity-90 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
}

function CalloutBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      {block.content && <MathpixMarkdownRenderer content={block.content} />}
      <TheoryBlockDiagram block={block} />
    </BaseBlockContainer>
  );
}

function StepsBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      <div className="space-y-1.5 mt-2.5">
        {block.steps?.map((step: any, i: number) => (
          <div key={i} className="flex gap-3">
            <div className="flex-none w-6 h-6 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold">
              {step.order || i + 1}
            </div>
            <div className="flex-1">
              <MathpixMarkdownRenderer content={step.content || step.statement || ""} />
            </div>
          </div>
        ))}
      </div>
      <TheoryBlockDiagram block={block} />
    </BaseBlockContainer>
  );
}

function TheoryBlockDiagram({ block }: { block: BlockData }) {
  return block.visual?.kind === "DIAGRAM_SPEC" ? (
    <LessonSummaryDiagram spec={block.visual.spec} />
  ) : null;
}

function ExampleBlock({
  block,
  showEditorialMetadata,
}: {
  block: BlockData;
  showEditorialMetadata: boolean;
}) {
  return (
    <BaseBlockContainer block={block}>
      <div className="mb-3">
        <MathpixMarkdownRenderer content={block.problem} />
      </div>

      {block.visual?.kind === "DIAGRAM_SPEC" ? (
        <LessonSummaryDiagram
          spec={block.visual.spec}
          showEditorialWarning={showEditorialMetadata}
        />
      ) : null}

      {(block.solution || block.answer) && (
        <div className="pl-4 border-l-[3px] border-blue-500/30 dark:border-blue-400/30 space-y-3 mb-3 text-sm">
          {block.solution && (
            <div>
              <MathpixMarkdownRenderer content={block.solution} />
            </div>
          )}
          {block.answer && (
            <div className="mt-2">
              <MathpixMarkdownRenderer content={`Kết luận: ${block.answer}`} />
            </div>
          )}
        </div>
      )}
    </BaseBlockContainer>
  );
}

function SectionRecapBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      <ul className="list-disc pl-5 space-y-1">
        {block.points?.map((point: string, i: number) => (
          <li key={i}>
            <MathpixMarkdownRenderer className="inline [&>*]:inline" content={point} />
          </li>
        ))}
      </ul>
    </BaseBlockContainer>
  );
}
