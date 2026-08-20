"use client";

import { useState } from "react";

import { JsonViewer } from "@/components/common/ui/json-viewer";

export function AdminAiJsonInputViewer({ data }: { data: unknown }) {
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2">
        <button
          type="button"
          onClick={() => setIsJsonExpanded(true)}
          className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Xổ toàn bộ
        </button>
        <button
          type="button"
          onClick={() => setIsJsonExpanded(false)}
          className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Thu lại toàn bộ
        </button>
      </div>
      <div className="max-h-96 overflow-auto bg-white p-4 dark:bg-slate-950">
        <JsonViewer
          key={isJsonExpanded ? "expanded" : "collapsed"}
          collapseAtDepth={isJsonExpanded ? 999 : 1}
          data={data}
        />
      </div>
    </div>
  );
}
