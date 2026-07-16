"use client";

import { useEffect, useRef } from "react";
import { Bell, GraduationCap, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { MessengerIcon } from "@/components/student/courses/messenger-icon";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";

const HEADER_REVEAL_SCROLL_DISTANCE = 100;
const HEADER_ICON_STROKE_WIDTH = 1.75;

export function StudentCoursesHeader({
  title,
  initialThemeMode = "light",
}: {
  title: string;
  initialThemeMode?: AppThemeMode;
}) {
  const headerRef = useRef<HTMLElement | null>(null);
  const isVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const revealScrollDistanceRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";
  const themeToggleLabel = isDarkTheme
    ? "Chuyển sang giao diện sáng"
    : "Chuyển sang giao diện tối";

  useEffect(() => {
    const getScrollTop = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const resetRevealDistance = () => {
      revealScrollDistanceRef.current = 0;
    };

    const setHeaderVisible = (visible: boolean) => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        isVisibleRef.current = true;
        headerRef.current?.classList.add("translate-y-0");
        headerRef.current?.classList.remove("-translate-y-full");
        return;
      }

      if (isVisibleRef.current === visible) {
        return;
      }

      isVisibleRef.current = visible;
      headerRef.current?.classList.toggle("translate-y-0", visible);
      headerRef.current?.classList.toggle("-translate-y-full", !visible);
    };

    const setVisibilityFromDelta = (delta: number) => {
      if (getScrollTop() <= 8) {
        resetRevealDistance();
        setHeaderVisible(true);
        return;
      }

      if (delta > 0) {
        resetRevealDistance();
        setHeaderVisible(false);
        return;
      }

      if (delta < 0) {
        revealScrollDistanceRef.current += Math.abs(delta);

        if (revealScrollDistanceRef.current >= HEADER_REVEAL_SCROLL_DISTANCE) {
          resetRevealDistance();
          setHeaderVisible(true);
        }
      }
    };

    lastScrollYRef.current = getScrollTop();

    const syncHeaderWithScroll = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setHeaderVisible(true);
        lastScrollYRef.current = getScrollTop();
        return;
      }

      const currentScrollY = getScrollTop();
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 8) {
        resetRevealDistance();
        setHeaderVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(delta) < 1) {
        return;
      }

      setVisibilityFromDelta(delta);
      lastScrollYRef.current = currentScrollY;
    };

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        syncHeaderWithScroll();
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });

    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }

      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  return (
    <>
      <div className="h-16 w-full shrink-0" aria-hidden="true" />
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 flex min-h-16 w-full min-w-0 translate-y-0 items-center gap-3 border-b border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-surface)_96%,transparent)] px-3 py-2 shadow-[0_8px_22px_rgb(15_23_42_/_5%)] backdrop-blur transition-[translate,left] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[translate] motion-reduce:transition-none sm:px-6 lg:left-[var(--student-sidebar-offset)] lg:w-auto lg:duration-300 lg:ease-out"
      >
        <Link
          href="/student/explore"
          className="inline-flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--theme-brand-secondary),var(--theme-brand-primary))] text-[var(--theme-brand-foreground)] shadow-sm">
            <GraduationCap
              className="h-5 w-5"
              strokeWidth={HEADER_ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
          </span>
          <span className="inline-flex min-w-0 items-baseline truncate leading-none tracking-normal">
            <span className="font-[var(--font-display)] text-[1.45rem] font-extrabold text-[var(--theme-brand-primary)]">
              Class
            </span>
            <span className="font-[var(--font-display)] text-[1.45rem] font-extrabold text-[var(--theme-brand-secondary)]">
              Hero
            </span>
          </span>
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
