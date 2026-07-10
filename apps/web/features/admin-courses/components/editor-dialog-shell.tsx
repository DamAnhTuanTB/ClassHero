import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function EditorDialogShell({
  ariaLabel,
  children,
  isOpen,
  leadingAction,
  onClose,
}: {
  ariaLabel: string;
  children: ReactNode;
  isOpen: boolean;
  leadingAction?: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl ring-1 ring-slate-900/10 sm:p-5"
      >
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          {leadingAction}
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700 transition hover:border-sky-200 hover:bg-sky-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
