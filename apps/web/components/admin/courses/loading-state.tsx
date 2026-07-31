import { SkeletonBlock } from "@/components/common/ui/skeleton-block";

type LoadingStateProps = {
  description?: string;
  title?: string;
  variant?: "detail" | "detail-page" | "list" | "list-page";
};

export function LoadingState({
  title = "Đang tải dữ liệu",
  variant = "detail",
}: LoadingStateProps = {}) {
  if (variant === "list-page") {
    return <CourseListPageSkeleton label={title} />;
  }

  if (variant === "detail-page") {
    return <CourseDetailPageSkeleton label={title} />;
  }

  if (variant === "list") {
    return <CourseListSkeleton label={title} />;
  }

  return <CourseDetailSkeleton label={title} />;
}

function CourseListPageSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="min-h-[calc(100svh-2rem)] animate-pulse sm:min-h-[calc(100svh-3rem)]"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 md:flex-row md:items-center md:justify-between">
        <div className="order-2 space-y-2 md:order-1">
          <SkeletonBlock className="h-8 w-52 rounded-lg" />
          <SkeletonBlock className="h-4 w-full max-w-md rounded-full" />
        </div>
        <div className="order-1 grid grid-cols-3 gap-2 md:order-2 md:flex">
          <SkeletonBlock className="h-11 rounded-lg md:w-24" />
          <SkeletonBlock className="h-11 rounded-lg md:w-28" />
          <SkeletonBlock className="h-11 rounded-lg md:w-36" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24 rounded-xl" />
        ))}
      </div>

      <div className="mt-5">
        <CourseListSkeleton label={label} />
      </div>
    </section>
  );
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

function CourseDetailPageSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="min-h-[calc(100svh-2rem)] animate-pulse sm:min-h-[calc(100svh-3rem)]"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-10 w-44 rounded-lg" />
          <SkeletonBlock className="mt-4 h-4 w-36 rounded-full" />
          <SkeletonBlock className="mt-2 h-8 w-56 rounded-lg" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex">
          <SkeletonBlock className="h-11 rounded-lg md:w-40" />
          <SkeletonBlock className="h-11 rounded-lg md:w-32" />
          <SkeletonBlock className="h-11 rounded-lg md:w-20" />
        </div>
      </div>

      <div className="mt-5">
        <CourseDetailSkeleton label={label} />
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
