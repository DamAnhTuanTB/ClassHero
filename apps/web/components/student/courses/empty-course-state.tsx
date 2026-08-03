import { SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { cn } from "@/lib/utils";

export function EmptyCourseState({
  action,
  className,
  description,
  isPageState = false,
  isLoading = false,
  loadingVariant = "list",
  title,
}: {
  action?: ReactNode;
  className?: string;
  description: string;
  isPageState?: boolean;
  isLoading?: boolean;
  loadingVariant?: "detail" | "list";
  title: string;
}) {
  if (isLoading) {
    return loadingVariant === "detail" ? (
      <StudentCourseDetailSkeleton className={className} title={title} />
    ) : (
      <StudentCourseListSkeleton className={className} title={title} />
    );
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-5 text-center",
        isPageState
          ? "flex min-h-72 items-center justify-center sm:min-h-80 lg:min-h-[calc(100svh-18rem)]"
          : "",
        className,
      )}
    >
      <div className="mx-auto max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
          <SearchX className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-base font-extrabold text-[var(--theme-text-strong)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">
          {description}
        </p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </section>
  );
}

function StudentCourseListSkeleton({
  className,
  title,
}: {
  className?: string;
  title: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={title}
      className={cn(
        "min-h-72 w-full animate-pulse space-y-5 sm:min-h-80 lg:min-h-[calc(100svh-18rem)]",
        className,
      )}
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-[var(--theme-skeleton-strong)] bg-white dark:bg-[var(--theme-surface)] sm:grid sm:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <SkeletonBlock className="aspect-[16/9] rounded-none sm:aspect-auto sm:h-full" />
          <div className="space-y-3 p-4">
            <SkeletonBlock className="h-5 w-3/4 rounded-full" />
            <SkeletonBlock className="h-4 w-full rounded-full opacity-75" />
            <SkeletonBlock className="h-4 w-2/3 rounded-full opacity-75" />
            <SkeletonBlock className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      ))}
    </section>
  );
}

function StudentCourseDetailSkeleton({
  className,
  title,
}: {
  className?: string;
  title: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={title}
      className={cn(
        "min-h-72 w-full animate-pulse space-y-5 sm:min-h-80 lg:min-h-[calc(100svh-18rem)]",
        className,
      )}
    >
      <SkeletonBlock className="aspect-[16/7] rounded-2xl" />
      <SkeletonBlock className="h-8 w-3/5 rounded-full" />
      <SkeletonBlock className="h-4 w-full rounded-full opacity-75" />
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-[var(--theme-skeleton-strong)] bg-white p-4 dark:bg-[var(--theme-surface)]"
        >
          <SkeletonBlock className="h-5 w-2/5 rounded-full" />
          <SkeletonBlock className="mt-4 h-14 rounded-xl" />
          <SkeletonBlock className="mt-3 h-14 rounded-xl" />
        </div>
      ))}
    </section>
  );
}
