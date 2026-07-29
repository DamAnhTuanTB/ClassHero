import { SkeletonBlock } from "@/components/common/ui/skeleton-block";

type LoadingStateProps = {
  description?: string;
  title?: string;
  variant?: "detail" | "list";
};

export function LoadingState({
  title = "Đang tải dữ liệu",
  variant = "detail",
}: LoadingStateProps = {}) {
  if (variant === "list") {
    return <CourseListSkeleton label={title} />;
  }

  return <CourseDetailSkeleton label={title} />;
}

function CourseListSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="min-h-80 animate-pulse space-y-4 lg:min-h-[calc(100svh-16rem)]"
    >
      <div className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <SkeletonBlock className="h-11 rounded-lg" />
        <SkeletonBlock className="h-11 rounded-lg" />
        <SkeletonBlock className="h-11 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_7rem_3rem] items-center gap-3 border-b border-[var(--theme-border)] p-4 last:border-b-0"
          >
            <SkeletonBlock className="h-5 w-5 rounded" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-2/5 rounded-full" />
              <SkeletonBlock className="h-3 w-3/5 rounded-full opacity-70" />
            </div>
            <SkeletonBlock className="h-7 rounded-full" />
            <SkeletonBlock className="h-9 w-9 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}

function CourseDetailSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="min-h-80 animate-pulse space-y-5 lg:min-h-[calc(100svh-16rem)]"
    >
      <SkeletonBlock className="h-40 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5"
        >
          <SkeletonBlock className="h-5 w-2/5 rounded-full" />
          <SkeletonBlock className="mt-4 h-14 rounded-lg" />
          <SkeletonBlock className="mt-3 h-14 rounded-lg" />
        </div>
      ))}
    </section>
  );
}
