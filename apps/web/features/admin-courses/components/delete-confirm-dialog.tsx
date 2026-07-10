import { AlertTriangle, Trash2 } from "lucide-react";

export function DeleteConfirmDialog({
  confirmLabel = "Xóa",
  description,
  isOpen,
  itemName,
  title = "Xóa mục này",
  onCancel,
  onConfirm,
}: {
  confirmLabel?: string;
  description?: string;
  isOpen: boolean;
  itemName: string;
  title?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-lg bg-white p-5 shadow-xl ring-1 ring-rose-900/10"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description ?? `Bạn có thực sự muốn xóa ${itemName} không?`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-extrabold text-white transition hover:bg-rose-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
