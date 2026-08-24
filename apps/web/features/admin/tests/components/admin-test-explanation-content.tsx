"use client";

import { PlayCircle } from "lucide-react";

import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

interface TestExplanationBlockData {
  type: "example";
  problem: string;
  solution: string | null;
  answer: string;
}

export function isTestExplanationBlockData(
  value: unknown,
): value is TestExplanationBlockData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  return (
    block.type === "example" &&
    typeof block.problem === "string" &&
    (block.solution === null || typeof block.solution === "string") &&
    typeof block.answer === "string"
  );
}

export function AdminTestExplanationCard({
  block,
  showProblem = false,
}: {
  block: TestExplanationBlockData;
  showProblem?: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-900/10 sm:p-5">
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider text-violet-600/70 dark:text-violet-400/70">
        <PlayCircle className="h-4 w-4" aria-hidden="true" />
        Lời giải
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
        {showProblem ? <MathpixMarkdownRenderer content={block.problem} /> : null}
        {block.solution ? <MathpixMarkdownRenderer content={block.solution} /> : null}
        {block.answer ? (
          <MathpixMarkdownRenderer content={`Đáp án: ${block.answer}`} />
        ) : null}
      </div>
    </div>
  );
}
