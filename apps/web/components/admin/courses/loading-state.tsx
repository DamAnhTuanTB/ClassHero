import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  description?: string;
  title?: string;
};

export function LoadingState({
  description = "ClassHero đang lấy dữ liệu mới nhất.",
  title = "Đang tải dữ liệu",
}: LoadingStateProps = {}) {
  return (
    <section
      className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center lg:min-h-[calc(100svh-16rem)]"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] shadow-sm">
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-[var(--theme-text-strong)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--theme-text)]">{description}</p>
      </div>
    </section>
  );
}
