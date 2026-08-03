import { CircleX } from "lucide-react";
import type { ReactNode } from "react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import type { AppThemeMode } from "@/lib/theme-store";

export function StudentFullScreenState({
  action,
  description,
  initialThemeMode,
  title,
}: {
  action: ReactNode;
  description: string;
  initialThemeMode?: AppThemeMode;
  title: string;
}) {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-dvh overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <section
        role="alert"
        className="my-auto mx-auto w-full max-w-xl rounded-[1.75rem] border border-red-100 bg-white px-5 py-8 text-center shadow-lg dark:border-red-400/20 dark:bg-[var(--theme-surface)] sm:px-8 sm:py-10"
      >
        <ClassHeroLogo
          className="mx-auto mb-6 h-14 max-w-[14rem] sm:h-16"
          priority
        />
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300">
          <CircleX className="h-10 w-10" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-black text-slate-900 dark:text-[var(--theme-text-strong)] sm:text-2xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-slate-500 dark:text-[var(--theme-text-muted)] sm:text-base">
          {description}
        </p>
        <div className="mt-6 flex justify-center">{action}</div>
      </section>
    </main>
  );
}
