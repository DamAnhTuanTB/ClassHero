"use client";

import { ChevronLeft, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const HEADER_REVEAL_SCROLL_DISTANCE = 100;
const HEADER_ICON_STROKE_WIDTH = 1.75;

export function StudentCourseMobileBrandBar() {
  const router = useRouter();
  const headerRef = useRef<HTMLElement | null>(null);
  const isVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const revealScrollDistanceRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);

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
      <div className="-mx-4 -mt-4 h-[4.5rem] sm:-mx-6 lg:hidden" aria-hidden="true" />
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 translate-y-0 border-b border-sky-100 bg-white py-2 pl-1 pr-2 transition-[translate] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[translate] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:pl-2 sm:pr-4 lg:hidden motion-reduce:transition-none"
      >
        <div className="flex min-h-14 items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-11 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-sky-300"
            aria-label="Quay lại màn trước"
          >
            <ChevronLeft
              className="h-8 w-8 shrink-0"
              strokeWidth={2.8}
              aria-hidden="true"
            />
          </button>
          <div className="inline-flex min-w-0 items-center gap-2.5">
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
          </div>
        </div>
      </header>
    </>
  );
}
