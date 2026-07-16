import { studentProfile } from "@/features/student/shared/student-courses-data";

export function StudentProfileIntro() {
  return (
    <section className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-3xl shadow-[var(--theme-shadow-sm)] ring-4 ring-sky-50 dark:bg-sky-950 dark:ring-sky-900/40"
        aria-label={`Ảnh đại diện ${studentProfile.name}`}
      >
        👦🏻
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-extrabold text-slate-700 dark:text-[var(--theme-text-strong)]">
          {studentProfile.name}
        </p>
        <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-[var(--theme-text-muted)]">
          Chào bạn, sẵn sàng học tiếp hôm nay?
        </p>
      </div>
    </section>
  );
}
