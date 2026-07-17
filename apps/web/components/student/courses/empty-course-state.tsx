import { Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyCourseState({
  className,
  description,
  isLoading = false,
  title,
}: {
  className?: string;
  description: string;
  isLoading?: boolean;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-5 text-center",
        isLoading
          ? "flex min-h-72 items-center justify-center sm:min-h-80 lg:min-h-[calc(100svh-18rem)]"
          : "",
        className,
      )}
      role={isLoading ? "status" : undefined}
      aria-busy={isLoading ? "true" : undefined}
      aria-live={isLoading ? "polite" : undefined}
    >
      <div className="mx-auto max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <SearchX className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <h2 className="mt-3 text-base font-extrabold text-[var(--theme-text-strong)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">
          {description}
        </p>
      </div>
    </section>
  );
}
