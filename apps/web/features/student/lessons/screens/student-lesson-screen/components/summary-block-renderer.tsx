import React from "react";
import { BookOpen, AlertCircle, Info, Lightbulb, FileCheck2, ChevronRight, PenTool, Scale, Bookmark, GraduationCap, Layers, MessageSquareQuote, AlertOctagon, Sigma, ListOrdered, FileBadge, PlayCircle, Flag, GripVertical, Copy, Trash2, Plus } from "lucide-react";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

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
      displayHeading: string;
      blocks: BlockData[];
    }[];
  };
  displayTitle?: string;
  onChange?: (newData: any) => void;
}

const BLOCK_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  definition: { label: "Định nghĩa", color: "yellow", icon: BookOpen },
  rule: { label: "Quy tắc", color: "sky", icon: Scale },
  property: { label: "Tính chất", color: "teal", icon: Bookmark },
  theorem: { label: "Định lí", color: "green", icon: GraduationCap },
  remark: { label: "Nhận xét", color: "fuchsia", icon: MessageSquareQuote },
  note: { label: "Chú ý", color: "amber", icon: Lightbulb },
  common_mistake: { label: "Lỗi thường gặp", color: "red", icon: AlertOctagon },
  formula: { label: "Công thức", color: "emerald", icon: Sigma },
  procedure: { label: "Phương pháp giải", color: "cyan", icon: ListOrdered },
  proof: { label: "Chứng minh", color: "violet", icon: FileBadge },
  example: { label: "Ví dụ", color: "blue", icon: PlayCircle },
  additional_info: { label: "Thông tin bổ sung", color: "slate", icon: Info },
  section_recap: { label: "Tổng kết", color: "orange", icon: Flag },
};

export function SummaryBlockRenderer({ data, displayTitle, onChange }: SummaryBlockRendererProps) {
  const isEdit = !!onChange;
  const [draggedItem, setDraggedItem] = React.useState<{sectionIdx: number, blockIdx: number} | null>(null);
  const [dragOverItem, setDragOverItem] = React.useState<{sectionIdx: number, blockIdx: number} | null>(null);
  const [draggedSection, setDraggedSection] = React.useState<number | null>(null);
  const [dragOverSection, setDragOverSection] = React.useState<number | null>(null);
  const [activeDropdown, setActiveDropdown] = React.useState<number | null>(null);

  const getBlockDefaultData = (type: string) => {
    const base = { type, title: "Tiêu đề khối mới" };
    switch (type) {
      case "example":
        return {
          ...base,
          problem: "",
          solutionSteps: [{ explanation: "", latex: "" }],
          answer: ""
        };
      case "formula":
        return {
          ...base,
          formulas: [{ latex: "", explanation: "" }]
        };
      case "procedure":
      case "proof":
        return {
          ...base,
          steps: [{ content: "", latex: "" }]
        };
      case "common_mistake":
        return {
          ...base,
          mistake: "",
          correction: ""
        };
      case "theorem":
      case "rule":
      case "property":
        return {
          ...base,
          statement: "",
          explanation: ""
        };
      default:
        return {
          ...base,
          content: ""
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

  return (
    <div className="mt-4 space-y-8">
      {/* Title */}
      <div className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
        <div className="text-2xl sm:text-3xl font-black mb-6 tracking-tight text-slate-800 dark:text-slate-100">{displayTitle || data.title}</div>
        {isEdit && (
          <div className="flex flex-col items-end w-full">
            <div className="flex justify-end mb-2">
              <button 
                type="button"
                onClick={() => {
                  const newData = { ...data };
                  if (!newData.sections) newData.sections = [];
                  newData.sections.push({
                    order: newData.sections.length + 1,
                    displayHeading: "Đề mục mới",
                    blocks: []
                  });
                  onChange(newData);

                  const newSectionIdx = newData.sections.length - 1;
                  setTimeout(() => {
                    const el = document.getElementById(`section-${newSectionIdx}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-md font-medium text-sm transition-colors border border-blue-200 dark:border-blue-800 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Thêm đề mục lớn
              </button>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto mb-4 w-full">
              <ReactJson 
                src={{ title: data.title }}
                onEdit={(e) => onChange({ ...data, title: (e.updated_src as any).title })}
                theme="rjv-default"
                style={{ backgroundColor: 'transparent' }}
                displayDataTypes={false}
                name={false}
                enableClipboard={false}
                keyModifier={(e: any) => e.detail >= 2 || e.metaKey || e.ctrlKey}
              />
            </div>
          </div>
        )}
      </div>

      {/* Objectives */}
      {data.objectives && data.objectives.length > 0 && (
        <div className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
          <div className="rounded-xl bg-blue-50 p-3 sm:p-5 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Mục tiêu học tập
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
              {data.objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
          {isEdit && (
            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto max-h-[300px]">
              <ReactJson 
                src={data.objectives}
                onEdit={(e) => onChange({ ...data, objectives: e.updated_src })}
                onAdd={(e) => onChange({ ...data, objectives: e.updated_src })}
                onDelete={(e) => onChange({ ...data, objectives: e.updated_src })}
                theme="rjv-default"
                style={{ backgroundColor: 'transparent' }}
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
      {data.sections?.map((section, idx) => (
        <div key={idx} id={`section-${idx}`} className="space-y-4">
          <div className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
            <h3 className="group flex items-center gap-3 text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              <span className="flex-none bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 w-9 h-9 rounded-xl flex items-center justify-center text-base font-black border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                {section.order || idx + 1}
              </span>
              <span className="relative pb-1">
                {section.displayHeading}
                <span className="absolute bottom-0 left-0 w-12 h-1 bg-blue-500/20 dark:bg-blue-400/20 rounded-full group-hover:w-full transition-all duration-500 ease-out"></span>
              </span>
            </h3>
            {isEdit && (
              <div className="flex flex-col items-end gap-2 w-full">
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === idx ? null : idx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-md transition-colors shadow-sm border border-slate-200 dark:border-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm khối
                  </button>
                  <div className={`absolute right-0 top-full mt-1 w-48 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 transition-all z-20 ${activeDropdown === idx ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}>
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
                               if (!newData.sections[idx].blocks) newData.sections[idx].blocks = [];
                               newData.sections[idx].blocks.push(getBlockDefaultData(type));
                               onChange(newData);

                               const newBlockIdx = newData.sections[idx].blocks.length - 1;
                               setTimeout(() => {
                                 const el = document.getElementById(`block-${idx}-${newBlockIdx}`);
                                 if (el) {
                                   el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                <div 
                  className={`w-full relative border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto group transition-all ${
                  draggedSection === idx ? "opacity-50 ring-2 ring-blue-500" : ""
                } ${
                  dragOverSection === idx ? "ring-2 ring-blue-500 border-blue-500" : ""
                }`}
                draggable
                onDragStart={(e) => {
                  setDraggedSection(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', '');
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedSection !== null) {
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
                      
                      // Cập nhật lại số thứ tự (order) cho các section sau khi đổi vị trí
                      sections.forEach((s, i) => { s.order = i + 1; });
                      
                      newData.sections = sections;
                      onChange(newData);
                    }
                    setDraggedSection(null);
                  }
                }}
                onDragEnd={() => {
                  setDraggedSection(null);
                  setDragOverSection(null);
                }}
              >
                {/* Toolbar cho Đề mục */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    type="button"
                    onClick={() => {
                      const newData = { ...data };
                      if (newData.sections) {
                        const sections = [...newData.sections];
                        const copiedSection = JSON.parse(JSON.stringify(sections[idx]!));
                        copiedSection.order = copiedSection.order + 1; // Tạm thời cộng 1
                        sections.splice(idx + 1, 0, copiedSection);
                        // Cập nhật lại số thứ tự (order)
                        sections.forEach((s, i) => { s.order = i + 1; });
                        newData.sections = sections;
                        onChange(newData);
                      }
                    }}
                    title="Nhân bản đề mục này" 
                    className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const newData = { ...data };
                      if (newData.sections) {
                        const sections = [...newData.sections];
                        sections.splice(idx, 1);
                        // Cập nhật lại số thứ tự (order)
                        sections.forEach((s, i) => { s.order = i + 1; });
                        newData.sections = sections;
                        onChange(newData);
                      }
                    }}
                    title="Xóa đề mục này" 
                    className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-red-600 dark:text-slate-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div 
                    title="Kéo thả để sắp xếp đề mục" 
                    className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-700 transition-colors"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                </div>

                <ReactJson 
                  src={{ displayHeading: section.displayHeading, order: section.order }}
                  onEdit={(e) => {
                    const newData = { ...data };
                    const updated = e.updated_src as any;
                    if (newData.sections) {
                      newData.sections[idx] = { ...newData.sections[idx], displayHeading: updated.displayHeading, order: updated.order } as any;
                    }
                    onChange(newData);
                  }}
                  theme="rjv-default"
                  style={{ backgroundColor: 'transparent' }}
                  displayDataTypes={false}
                  name={false}
                  enableClipboard={false}
                  keyModifier={(e: any) => e.detail >= 2 || e.metaKey || e.ctrlKey}
                />
              </div>
            </div>
            )}
          </div>
          
          <div className="space-y-4">
            {(() => {
              const typeCounts = section.blocks?.reduce((acc, block) => {
                acc[block.type] = (acc[block.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>) || {};
              const currentCounts: Record<string, number> = {};

              return section.blocks?.map((block, bIdx) => {
                currentCounts[block.type] = (currentCounts[block.type] || 0) + 1;
                
                // Only assign a number if there is more than 1 block of this type in the section
                const computedDisplayNumber = typeCounts[block.type] > 1 ? currentCounts[block.type] : undefined;
                
                // Override the AI's displayNumber (if any) with the mathematically correct one
                const blockToRender = { ...block, displayNumber: computedDisplayNumber };
                const blockColorClass = getBlockDragColor(blockToRender.type);

                return (
                  <div 
                    key={bIdx} 
                    id={`block-${idx}-${bIdx}`}
                    className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}
                  >
                    <BlockItem block={blockToRender} />
                    {isEdit && (
                      <div 
                        className={`relative border rounded-lg bg-slate-50 dark:bg-slate-900 group transition-all ${
                          draggedItem?.sectionIdx === idx && draggedItem?.blockIdx === bIdx 
                            ? `opacity-50 ring-2 ${blockColorClass}` 
                            : ""
                        } ${
                          dragOverItem?.sectionIdx === idx && dragOverItem?.blockIdx === bIdx
                            ? `ring-2 ${blockColorClass}`
                            : ""
                        }`}
                        draggable
                        onDragStart={(e) => {
                          setDraggedItem({ sectionIdx: idx, blockIdx: bIdx });
                          e.dataTransfer.effectAllowed = 'move';
                          // For Firefox compatibility
                          e.dataTransfer.setData('text/plain', '');
                        }}
                        onDragOver={(e) => {
                          e.preventDefault(); // Necessary to allow dropping
                          if (draggedItem && draggedItem.sectionIdx === idx) {
                            setDragOverItem({ sectionIdx: idx, blockIdx: bIdx });
                          }
                        }}
                        onDragLeave={() => {
                          setDragOverItem(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverItem(null);
                          if (draggedItem && draggedItem.sectionIdx === idx) {
                            if (draggedItem.blockIdx === bIdx) {
                              setDraggedItem(null);
                              return;
                            }
                            const newData = { ...data };
                            if (newData.sections?.[idx]?.blocks) {
                              const blocks = [...newData.sections[idx].blocks];
                              const draggedBlockData = blocks[draggedItem.blockIdx];
                              // Remove from old pos
                              blocks.splice(draggedItem.blockIdx, 1);
                              // Insert at new pos
                              blocks.splice(bIdx, 0, draggedBlockData);
                              newData.sections[idx].blocks = blocks;
                              onChange(newData);
                            }
                            setDraggedItem(null);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDragOverItem(null);
                        }}
                      >
                        {/* Toolbar */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            type="button"
                            onClick={() => {
                              const newData = { ...data };
                              if (newData.sections?.[idx]?.blocks) {
                                const blocks = [...newData.sections[idx].blocks];
                                // Deep copy to avoid reference issues
                                const copiedBlock = JSON.parse(JSON.stringify(blocks[bIdx]));
                                blocks.splice(bIdx + 1, 0, copiedBlock);
                                newData.sections[idx].blocks = blocks;
                                onChange(newData);
                              }
                            }}
                            title="Nhân bản khối này" 
                            className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors"
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
                            className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-500 hover:text-red-600 dark:text-slate-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div 
                            title="Kéo thả để sắp xếp" 
                            className="p-1.5 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded shadow-sm text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-700 transition-colors"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div className="p-3 overflow-auto max-h-[500px]">
                          <ReactJson 
                            src={block}
                            onEdit={(e) => {
                              const newData = { ...data };
                              const targetSection = newData.sections?.[idx];
                              if (targetSection && targetSection.blocks) targetSection.blocks[bIdx] = e.updated_src;
                              onChange(newData);
                            }}
                            onAdd={(e) => {
                              const newData = { ...data };
                              const targetSection = newData.sections?.[idx];
                              if (targetSection && targetSection.blocks) targetSection.blocks[bIdx] = e.updated_src;
                              onChange(newData);
                            }}
                            onDelete={(e) => {
                              const newData = { ...data };
                              const targetSection = newData.sections?.[idx];
                              if (targetSection && targetSection.blocks) targetSection.blocks[bIdx] = e.updated_src;
                              onChange(newData);
                            }}
                            theme="rjv-default"
                            style={{ backgroundColor: 'transparent' }}
                            displayDataTypes={false}
                            name={false}
                            enableClipboard={false}
                            keyModifier={(e: any) => e.detail >= 2 || e.metaKey || e.ctrlKey}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockItem({ block }: { block: BlockData }) {
  switch (block.type) {
    case "formula":
      return <FormulaBlock block={block} />;
    case "procedure":
    case "proof":
      return <StepsBlock block={block} />;
    case "example":
      return <ExampleBlock block={block} />;
    case "additional_info":
    case "section_recap":
      return <AdditionalInfoBlock block={block} />;
    case "definition":
    case "rule":
    case "property":
    case "theorem":
    case "remark":
    case "note":
    case "common_mistake":
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
  blue: { bg: "bg-blue-50/50 dark:bg-blue-900/10", border: "border-blue-200 dark:border-blue-900/50", text: "text-blue-900 dark:text-blue-100", label: "text-blue-600/70 dark:text-blue-400/70" },
  indigo: { bg: "bg-indigo-50/50 dark:bg-indigo-900/10", border: "border-indigo-200 dark:border-indigo-900/50", text: "text-indigo-900 dark:text-indigo-100", label: "text-indigo-600/70 dark:text-indigo-400/70" },
  teal: { bg: "bg-teal-50/50 dark:bg-teal-900/10", border: "border-teal-200 dark:border-teal-900/50", text: "text-teal-900 dark:text-teal-100", label: "text-teal-600/70 dark:text-teal-400/70" },
  rose: { bg: "bg-rose-50/50 dark:bg-rose-900/10", border: "border-rose-200 dark:border-rose-900/50", text: "text-rose-900 dark:text-rose-100", label: "text-rose-600/70 dark:text-rose-400/70" },
  fuchsia: { bg: "bg-fuchsia-50/50 dark:bg-fuchsia-900/10", border: "border-fuchsia-200 dark:border-fuchsia-900/50", text: "text-fuchsia-900 dark:text-fuchsia-100", label: "text-fuchsia-600/70 dark:text-fuchsia-400/70" },
  amber: { bg: "bg-amber-50/50 dark:bg-amber-900/10", border: "border-amber-200 dark:border-amber-900/50", text: "text-amber-900 dark:text-amber-100", label: "text-amber-600/70 dark:text-amber-400/70" },
  yellow: { bg: "bg-yellow-50/50 dark:bg-yellow-900/10", border: "border-yellow-200 dark:border-yellow-900/50", text: "text-yellow-900 dark:text-yellow-100", label: "text-yellow-600/70 dark:text-yellow-400/70" },
  red: { bg: "bg-red-50/50 dark:bg-red-900/10", border: "border-red-200 dark:border-red-900/50", text: "text-red-900 dark:text-red-100", label: "text-red-600/70 dark:text-red-400/70" },
  green: { bg: "bg-green-50/50 dark:bg-green-900/10", border: "border-green-200 dark:border-green-900/50", text: "text-green-900 dark:text-green-100", label: "text-green-600/70 dark:text-green-400/70" },
  emerald: { bg: "bg-emerald-50/50 dark:bg-emerald-900/10", border: "border-emerald-200 dark:border-emerald-900/50", text: "text-emerald-900 dark:text-emerald-100", label: "text-emerald-600/70 dark:text-emerald-400/70" },
  cyan: { bg: "bg-cyan-50/50 dark:bg-cyan-900/10", border: "border-cyan-200 dark:border-cyan-900/50", text: "text-cyan-900 dark:text-cyan-100", label: "text-cyan-600/70 dark:text-cyan-400/70" },
  violet: { bg: "bg-violet-50/50 dark:bg-violet-900/10", border: "border-violet-200 dark:border-violet-900/50", text: "text-violet-900 dark:text-violet-100", label: "text-violet-600/70 dark:text-violet-400/70" },
  purple: { bg: "bg-purple-50/50 dark:bg-purple-900/10", border: "border-purple-200 dark:border-purple-900/50", text: "text-purple-900 dark:text-purple-100", label: "text-purple-600/70 dark:text-purple-400/70" },
  sky: { bg: "bg-sky-50/50 dark:bg-sky-900/10", border: "border-sky-200 dark:border-sky-900/50", text: "text-sky-900 dark:text-sky-100", label: "text-sky-600/70 dark:text-sky-400/70" },
  orange: { bg: "bg-orange-50/50 dark:bg-orange-900/10", border: "border-orange-200 dark:border-orange-900/50", text: "text-orange-900 dark:text-orange-100", label: "text-orange-600/70 dark:text-orange-400/70" },
  slate: { bg: "bg-slate-50/50 dark:bg-slate-900/10", border: "border-slate-200 dark:border-slate-900/50", text: "text-slate-900 dark:text-slate-100", label: "text-slate-600/70 dark:text-slate-400/70" },
};

function BaseBlockContainer({ block, children }: { block: BlockData, children: React.ReactNode }) {
  const config = BLOCK_CONFIG[block.type] || { label: block.type, color: "slate", icon: Info };
  const styles = COLOR_STYLES[config.color] || COLOR_STYLES.slate;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border p-3 sm:p-5 ${styles.bg} ${styles.border}`}>
      <div className={`flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider mb-2 ${styles.label}`}>
        <Icon className="w-4 h-4" />
        {config.label} {block.displayNumber ? block.displayNumber : ""}
      </div>
      <div className={`font-bold mb-3 ${styles.text}`}>
        {block.title}
      </div>
      <div className="space-y-2 opacity-90 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
}

function CalloutBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      {block.definition && (
        <div>
          {block.term && block.term.toLowerCase() !== block.title?.toLowerCase() && (
            <strong className="mr-1">{block.term}:</strong>
          )}
          <MathpixMarkdownRenderer content={block.definition} />
        </div>
      )}
      {block.statement && <MathpixMarkdownRenderer content={block.statement} />}
      {block.explanation && <MathpixMarkdownRenderer content={block.explanation} />}
      {block.content && <MathpixMarkdownRenderer content={block.content} />}
      {block.mistake && (
        <>
          <div><strong>Lỗi sai:</strong> <MathpixMarkdownRenderer content={block.mistake} /></div>
          <div><strong>Sửa lại:</strong> <MathpixMarkdownRenderer content={block.correction} /></div>
        </>
      )}
    </BaseBlockContainer>
  );
}

function FormulaBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      <div className="space-y-4">
        {block.formulas?.map((f: any, i: number) => (
          <div key={i} className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
            <MathpixMarkdownRenderer content={`$$ ${f.latex} $$`} />
            {f.explanation && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
                <MathpixMarkdownRenderer content={f.explanation} />
              </div>
            )}
          </div>
        ))}
      </div>
    </BaseBlockContainer>
  );
}

function StepsBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      <div className="space-y-3 mt-1">
        {block.steps?.map((step: any, i: number) => (
          <div key={i} className="flex gap-3">
            <div className="flex-none w-6 h-6 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold">
              {step.order || i + 1}
            </div>
            <div className="flex-1">
              <MathpixMarkdownRenderer content={step.content || step.statement || ""} />
              {step.latex && (
                <div className="mt-1">
                  <MathpixMarkdownRenderer content={`$$ ${step.latex} $$`} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </BaseBlockContainer>
  );
}

function ExampleBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      <div className="mb-3 font-medium">
        <MathpixMarkdownRenderer content={block.problem} />
      </div>
      
      {block.solutionSteps && block.solutionSteps.length > 0 && (
        <div className="pl-4 border-l-2 border-black/10 dark:border-white/10 space-y-3 mb-3">
          {block.solutionSteps.map((step: any, i: number) => (
            <div key={i} className="text-sm">
              {step.explanation && <MathpixMarkdownRenderer content={step.explanation} />}
              {step.latex && (
                <div className="mt-1 bg-white dark:bg-slate-900/50 p-2 rounded">
                  <MathpixMarkdownRenderer content={`$$ ${step.latex} $$`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {block.answer && (
        <div className="font-semibold mt-2">
          Kết luận: <MathpixMarkdownRenderer content={block.answer} />
        </div>
      )}
    </BaseBlockContainer>
  );
}

function AdditionalInfoBlock({ block }: { block: BlockData }) {
  return (
    <BaseBlockContainer block={block}>
      <ul className="list-disc pl-5 space-y-1">
        {block.points?.map((point: string, i: number) => (
          <li key={i}>
            <MathpixMarkdownRenderer content={point} />
          </li>
        ))}
      </ul>
    </BaseBlockContainer>
  );
}
