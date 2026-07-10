import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
      <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-extrabold text-rose-950">
        Chưa tải được danh sách
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-rose-800">
        Vui lòng thử lại để tiếp tục quản lý lộ trình và buổi học.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-extrabold text-white transition hover:bg-rose-700"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Thử lại
      </button>
    </div>
  );
}
