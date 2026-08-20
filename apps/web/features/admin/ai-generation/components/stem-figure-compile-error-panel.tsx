"use client";

import { CircleAlert, TerminalSquare } from "lucide-react";

import type { AdminStemFigureDiagnosticBatch } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type StemFigureCompileIssue = AdminStemFigureDiagnosticBatch["issues"][number];

export function StemFigureCompileErrorPanel({
  issues,
  onSelectIssue,
}: {
  issues: StemFigureCompileIssue[];
  onSelectIssue: (issue: StemFigureCompileIssue) => void;
}) {
  return (
    <div className="min-h-full flex-1 overflow-auto bg-slate-950 p-4 text-slate-100 sm:p-5">
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-300">
            <CircleAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-red-200">
              Biên dịch thất bại
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Tìm thấy {issues.length} lỗi. Chọn từng lỗi để đi tới đúng dòng cần sửa.
            </p>
          </div>
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {issues.map((issue, index) => {
          const location = formatIssueLocation(issue);
          const canSelect = typeof issue.line === "number";

          return (
            <li key={`${issue.code}-${issue.line ?? "all"}-${index}`}>
              <button
                type="button"
                className="group w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-left transition hover:border-red-400/70 hover:bg-slate-900 disabled:cursor-default disabled:hover:border-slate-700"
                disabled={!canSelect}
                onClick={() => onSelectIssue(issue)}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 font-mono text-[11px] font-bold text-red-200">
                    <TerminalSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    {location}
                  </span>
                  <code className="text-[10px] font-semibold text-slate-500 group-hover:text-slate-400">
                    {issue.code}
                  </code>
                </span>
                <span className="mt-2 block whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-200">
                  {issue.message}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatIssueLocation(issue: StemFigureCompileIssue) {
  if (typeof issue.line !== "number") return "Toàn bộ mã";
  return typeof issue.column === "number"
    ? `Dòng ${issue.line}, cột ${issue.column}`
    : `Dòng ${issue.line}`;
}
