import { SkeletonBlock } from "@/components/common/ui/skeleton-block";

const domainNameWidths = ["w-32", "w-44", "w-36", "w-52"] as const;

export function AdminDomainsListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải danh sách lĩnh vực"
      className="animate-pulse"
    >
      {domainNameWidths.map((width) => (
        <div
          key={width}
          className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--theme-border)] px-4 py-3 last:border-0"
        >
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonBlock className="h-6 w-3 shrink-0 rounded" />
            <SkeletonBlock className={`h-4 max-w-[45vw] rounded-full ${width}`} />
          </div>
          <div className="flex shrink-0 gap-2">
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
