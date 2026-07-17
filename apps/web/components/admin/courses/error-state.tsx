import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] p-6">
      <AlertCircle className="h-8 w-8 text-[var(--theme-danger)]" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-extrabold text-[var(--theme-danger)]">
        Chưa tải được danh sách
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--theme-text)]">
        Vui lòng thử lại để tiếp tục quản lý khóa học và bài học.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="theme-button-danger mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Thử lại
      </button>
    </div>
  );
}
