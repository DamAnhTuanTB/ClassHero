import { StatCard } from "@/features/admin-courses/components/stat-card";
import type { AdminCourseStats } from "@/features/admin-courses/utils";

type AdminCoursesStatsRowProps = {
  isDarkTheme: boolean;
  stats: AdminCourseStats;
};

export function AdminCoursesStatsRow({ isDarkTheme, stats }: AdminCoursesStatsRowProps) {
  return (
    <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard
        isDarkTheme={isDarkTheme}
        label="Tổng lộ trình"
        value={stats.total}
        tone="sky"
      />
      <StatCard
        isDarkTheme={isDarkTheme}
        label="Phát hành"
        value={stats.published}
        tone="emerald"
      />
      <StatCard
        isDarkTheme={isDarkTheme}
        label="Chưa phát hành"
        value={stats.notPublished}
        tone="amber"
      />
    </section>
  );
}
