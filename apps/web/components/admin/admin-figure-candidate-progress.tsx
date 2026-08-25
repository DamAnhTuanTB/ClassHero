"use client";

import { Loader2 } from "lucide-react";

export function AdminFigureCandidateProgress() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-3 mt-3 flex min-h-12 animate-pulse items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-center text-xs font-extrabold text-sky-800 motion-reduce:animate-none dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 sm:mx-4"
      role="status"
    >
      <Loader2
        className="h-4 w-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      Đang sinh bản hình mới tại vị trí này. Ảnh hiện hành được giữ cho đến khi bản mới
      thành công
    </div>
  );
}
