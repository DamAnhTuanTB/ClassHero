import React from "react";
import { BookOpen, AlertCircle, Info, Lightbulb, FileCheck2, ChevronRight, PenTool, Scale, Bookmark, GraduationCap } from "lucide-react";
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

export function SummaryBlockRenderer({ data, displayTitle, onChange }: SummaryBlockRendererProps) {
  const isEdit = !!onChange;

  return (
    <div className="mt-4 space-y-8">
      {/* Title */}
      <div className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
        <div className="text-2xl font-black mb-4">{displayTitle || data.title}</div>
        {isEdit && (
          <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto mb-4">
            <ReactJson 
              src={{ title: data.title }}
              onEdit={(e) => onChange({ ...data, title: (e.updated_src as any).title })}
              theme="rjv-default"
              style={{ backgroundColor: 'transparent' }}
              displayDataTypes={false}
              name={false}
              enableClipboard={false}
            />
          </div>
        )}
      </div>

      {/* Objectives */}
      {data.objectives && data.objectives.length > 0 && (
        <div className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
          <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
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
              />
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      {data.sections?.map((section, idx) => (
        <div key={idx} className="space-y-4">
          <div className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-3">
              <span className="flex-none bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black">
                {section.order || idx + 1}
              </span>
              <span>{section.displayHeading}</span>
            </h3>
            {isEdit && (
              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto">
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
                />
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

                return (
                  <div key={bIdx} className={isEdit ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
                    <BlockItem block={blockToRender} />
                    {isEdit && (
                      <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 overflow-auto max-h-[500px]">
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
                        />
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
    case "definition":
      return <CalloutBlock block={block} variant="blue" />;
    case "rule":
      return <CalloutBlock block={block} variant="indigo" />;
    case "property":
      return <CalloutBlock block={block} variant="teal" />;
    case "theorem":
      return <CalloutBlock block={block} variant="rose" />;
    
    case "remark":
      return <CalloutBlock block={block} variant="slate" />;
      
    case "note":
      return <CalloutBlock block={block} variant="amber" />;
      
    case "common_mistake":
      return <CalloutBlock block={block} variant="red" />;
      
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
      
    default:
      // Fallback for unknown blocks or extended blocks not implemented yet
      return (
        <div className="p-3 border border-slate-200 rounded text-sm text-slate-500 overflow-auto">
          <em>Unsupported block type: {block.type}</em>
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
  }
}

// Helper for block type labels
const getBlockTypeLabel = (type: string) => {
  switch (type) {
    case "definition": return "Định nghĩa";
    case "rule": return "Quy tắc";
    case "property": return "Tính chất";
    case "theorem": return "Định lí";
    case "remark": return "Nhận xét";
    case "note": return "Chú ý";
    case "common_mistake": return "Lỗi thường gặp";
    case "formula": return "Công thức";
    case "procedure": return "Quy trình";
    case "proof": return "Chứng minh";
    case "example": return "Ví dụ";
    case "additional_info": return "Thông tin bổ sung";
    case "section_recap": return "Tóm tắt phần";
    default: return type;
  }
}

// Reusable Callout Block
function CalloutBlock({ block, variant }: { block: BlockData, variant: "blue" | "amber" | "red" | "indigo" | "teal" | "rose" | "slate" }) {
  const styles = {
    blue: "bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-900/10 dark:border-blue-900/50 dark:text-blue-100",
    amber: "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-900/10 dark:border-amber-900/50 dark:text-amber-100",
    red: "bg-red-50/50 border-red-200 text-red-900 dark:bg-red-900/10 dark:border-red-900/50 dark:text-red-100",
    indigo: "bg-indigo-50/50 border-indigo-200 text-indigo-900 dark:bg-indigo-900/10 dark:border-indigo-900/50 dark:text-indigo-100",
    teal: "bg-teal-50/50 border-teal-200 text-teal-900 dark:bg-teal-900/10 dark:border-teal-900/50 dark:text-teal-100",
    rose: "bg-rose-50/50 border-rose-200 text-rose-900 dark:bg-rose-900/10 dark:border-rose-900/50 dark:text-rose-100",
    slate: "bg-slate-50/50 border-slate-200 text-slate-900 dark:bg-slate-900/10 dark:border-slate-900/50 dark:text-slate-100",
  };
  
  const Icon = variant === "blue" ? Info 
             : variant === "amber" ? Lightbulb 
             : variant === "indigo" ? Scale
             : variant === "teal" ? Bookmark
             : variant === "rose" ? GraduationCap
             : variant === "slate" ? Info
             : AlertCircle;

  return (
    <div className={`rounded-xl border p-4 ${styles[variant]}`}>
      <div className="text-[11px] font-black uppercase tracking-wider mb-2 opacity-60">
        {getBlockTypeLabel(block.type)} {block.displayNumber ? block.displayNumber : ""}
      </div>
      <div className="flex items-center gap-2 mb-2 font-bold">
        <Icon className="w-5 h-5 opacity-70" />
        {block.title}
      </div>
      <div className="space-y-2 opacity-90 text-[15px] leading-relaxed">
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
      </div>
    </div>
  );
}

function FormulaBlock({ block }: { block: BlockData }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
      <div className="text-[11px] font-black uppercase tracking-wider mb-2 text-emerald-600/70 dark:text-emerald-400/70">
        {getBlockTypeLabel(block.type)} {block.displayNumber ? block.displayNumber : ""}
      </div>
      <h4 className="font-bold text-emerald-800 dark:text-emerald-400 mb-3 flex items-center gap-2">
        <PenTool className="w-4 h-4" />
        {block.title}
      </h4>
      <div className="space-y-4">
        {block.formulas?.map((f: any, i: number) => (
          <div key={i} className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-emerald-50 dark:border-emerald-900/20">
            <MathpixMarkdownRenderer content={`$$ ${f.latex} $$`} />
            {f.explanation && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
                <MathpixMarkdownRenderer content={f.explanation} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepsBlock({ block }: { block: BlockData }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="text-[11px] font-black uppercase tracking-wider mb-2 text-slate-500/70">
        {getBlockTypeLabel(block.type)} {block.displayNumber ? block.displayNumber : ""}
      </div>
      <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3">
        {block.title}
      </h4>
      <div className="space-y-3">
        {block.steps?.map((step: any, i: number) => (
          <div key={i} className="flex gap-3">
            <div className="flex-none w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
              {step.order || i + 1}
            </div>
            <div className="flex-1 text-[15px] text-slate-700 dark:text-slate-300">
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
    </div>
  );
}

function ExampleBlock({ block }: { block: BlockData }) {
  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 dark:border-purple-900/30 dark:bg-purple-900/10">
      <div className="text-[11px] font-black uppercase tracking-wider mb-2 text-purple-600/70 dark:text-purple-400/70">
        {getBlockTypeLabel(block.type)} {block.displayNumber ? block.displayNumber : ""}
      </div>
      <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
        <FileCheck2 className="w-5 h-5" />
        {block.title}
      </h4>
      <div className="mb-3 text-[15px] font-medium text-slate-800 dark:text-slate-200">
        <MathpixMarkdownRenderer content={block.problem} />
      </div>
      
      {block.solutionSteps && block.solutionSteps.length > 0 && (
        <div className="pl-4 border-l-2 border-purple-200 dark:border-purple-800 space-y-3 mb-3">
          {block.solutionSteps.map((step: any, i: number) => (
            <div key={i} className="text-sm text-slate-700 dark:text-slate-300">
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
        <div className="text-[15px] font-semibold text-purple-900 dark:text-purple-200 mt-2">
          Kết luận: <MathpixMarkdownRenderer content={block.answer} />
        </div>
      )}
    </div>
  );
}

function AdditionalInfoBlock({ block }: { block: BlockData }) {
  return (
    <div className="space-y-2 py-2">
      <div className="text-[11px] font-black uppercase tracking-wider mb-1 text-slate-500/70 pl-7">
        {getBlockTypeLabel(block.type)} {block.displayNumber ? block.displayNumber : ""}
      </div>
      <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <ChevronRight className="w-5 h-5 text-sky-500" />
        {block.title}
      </h4>
      <ul className="list-disc pl-8 space-y-1 text-[15px] text-slate-700 dark:text-slate-300">
        {block.points?.map((point: string, i: number) => (
          <li key={i}>
            <MathpixMarkdownRenderer content={point} />
          </li>
        ))}
      </ul>
    </div>
  );
}
