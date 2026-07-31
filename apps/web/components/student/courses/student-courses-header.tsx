"use client";

import { Bell, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { MessengerIcon } from "@/components/student/courses/messenger-icon";
import { useAutoHidingStudentHeader } from "@/components/student/layout/use-auto-hiding-student-header";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";

const HEADER_ICON_STROKE_WIDTH = 1.75;

export function StudentCoursesHeader({
  title,
  initialThemeMode = "light",
}: {
  title: string;
  initialThemeMode?: AppThemeMode;
}) {
  const headerRef = useAutoHidingStudentHeader();
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";
  const themeToggleLabel = isDarkTheme
    ? "Chuyển sang giao diện sáng"
    : "Chuyển sang giao diện tối";

  return (
    <>
      <div className="h-16 w-full shrink-0" aria-hidden="true" />
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 flex min-h-16 w-full min-w-0 translate-y-0 items-center gap-3 border-b border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-surface)_96%,transparent)] px-3 py-2 shadow-[0_8px_22px_rgb(15_23_42_/_5%)] backdrop-blur transition-[translate,left] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[translate] motion-reduce:transition-none sm:px-6 lg:left-[var(--student-sidebar-offset)] lg:w-auto lg:duration-300 lg:ease-out"
      >
        <Link
          href="/student/explore"
          className="inline-flex min-w-0 items-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          <ClassHeroLogo
            className="h-10 max-w-[9rem] min-[360px]:h-11 min-[360px]:max-w-[10rem] lg:h-12 lg:max-w-[11rem]"
            priority
          />
        </Link>

        <h1 className="hidden min-w-0 flex-1 truncate text-center text-base font-extrabold text-[var(--theme-text-strong)] md:block lg:hidden">
          {title}
        </h1>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/student/notifications"
            aria-label="Thông báo"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)] dark:hover:text-[var(--theme-primary)] sm:h-11 sm:w-11"
          >
            <span className="relative flex h-7 w-7 items-center justify-center">
              <Bell
                className="h-7 w-7"
                strokeWidth={HEADER_ICON_STROKE_WIDTH}
                aria-hidden="true"
              />
              <span className="student-notification-badge absolute -right-1.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border border-[var(--theme-surface)] px-1 text-[10px] font-extrabold leading-none">
                3
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-label={themeToggleLabel}
            title={themeToggleLabel}
            data-theme-toggle="true"
            onClick={toggleTheme}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-slate-600 transition hover:text-blue-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)] dark:hover:text-[var(--theme-primary)] sm:h-11 sm:w-11"
          >
            {isDarkTheme ? (
              <Sun
                className="h-6 w-6"
                strokeWidth={HEADER_ICON_STROKE_WIDTH}
                aria-hidden="true"
              />
            ) : (
              <Moon
                className="h-6 w-6"
                strokeWidth={HEADER_ICON_STROKE_WIDTH}
                aria-hidden="true"
              />
            )}
          </button>
          <Link
            href="/student/ai-chat"
            aria-label="Chat AI"
            className="flex h-10 w-10 items-center justify-center rounded-full text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-[var(--theme-primary)] sm:h-11 sm:w-11"
          >
            <span className="relative flex h-7 w-7 items-center justify-center">
              <MessengerIcon
                className="h-7 w-7"
                strokeWidth={HEADER_ICON_STROKE_WIDTH}
                aria-hidden="true"
              />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-extrabold leading-none tracking-normal text-white shadow-sm ring-2 ring-[var(--theme-surface)] dark:bg-[var(--theme-primary)] dark:text-[var(--theme-primary-foreground)]">
                AI
              </span>
            </span>
          </Link>
        </div>
      </header>
    </>
  );
}
