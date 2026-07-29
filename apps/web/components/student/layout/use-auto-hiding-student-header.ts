"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { getSavedStudentScrollPosition } from "@/components/student/layout/use-student-scroll-restoration";

const HEADER_REVEAL_SCROLL_DISTANCE = 100;
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const HEADER_VISIBILITY_HISTORY_STATE_KEY = "__classHeroStudentHeaderVisible";
let hasConsumedPageReloadReset = false;

function getScrollTop() {
  return (
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  );
}

function applyHeaderVisibility(header: HTMLElement | null, visible: boolean) {
  header?.classList.toggle("translate-y-0", visible);
  header?.classList.toggle("-translate-y-full", !visible);
}

function getRestoredHeaderVisibility() {
  const historyState: unknown = window.history.state;

  if (typeof historyState !== "object" || historyState === null) {
    return true;
  }

  const restoredVisibility = Reflect.get(
    historyState,
    HEADER_VISIBILITY_HISTORY_STATE_KEY,
  );

  return typeof restoredVisibility === "boolean" ? restoredVisibility : true;
}

function saveHeaderVisibility(visible: boolean) {
  const historyState: unknown = window.history.state;
  const nextHistoryState =
    typeof historyState === "object" && historyState !== null
      ? { ...historyState, [HEADER_VISIBILITY_HISTORY_STATE_KEY]: visible }
      : { [HEADER_VISIBILITY_HISTORY_STATE_KEY]: visible };

  window.history.replaceState(nextHistoryState, "");
}

function consumePageReloadReset() {
  if (hasConsumedPageReloadReset) {
    return false;
  }

  hasConsumedPageReloadReset = true;

  const [navigationEntry] = performance.getEntriesByType("navigation");

  return (navigationEntry as PerformanceNavigationTiming | undefined)?.type === "reload";
}

export function useAutoHidingStudentHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const isVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const revealScrollDistanceRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
    const restoredScrollPosition = getSavedStudentScrollPosition() ?? getScrollTop();
    const isAtTop = restoredScrollPosition <= 8;
    const shouldResetAfterReload = consumePageReloadReset();
    const savedVisibility = getRestoredHeaderVisibility();
    const restoredVisibility =
      isDesktop || shouldResetAfterReload || isAtTop || savedVisibility;

    isVisibleRef.current = restoredVisibility;

    if (!isDesktop && (shouldResetAfterReload || isAtTop) && !savedVisibility) {
      saveHeaderVisibility(true);
    }

    applyHeaderVisibility(headerRef.current, restoredVisibility);
  }, [pathname]);

  useEffect(() => {
    const resetRevealDistance = () => {
      revealScrollDistanceRef.current = 0;
    };

    const setHeaderVisible = (visible: boolean) => {
      if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
        isVisibleRef.current = true;
        applyHeaderVisibility(headerRef.current, true);
        return;
      }

      if (isVisibleRef.current === visible) {
        return;
      }

      isVisibleRef.current = visible;

      if (getRestoredHeaderVisibility() !== visible) {
        saveHeaderVisibility(visible);
      }

      applyHeaderVisibility(headerRef.current, visible);
    };

    const syncHeaderWithScroll = () => {
      if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
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

      if (delta > 0) {
        resetRevealDistance();
        setHeaderVisible(false);
      } else {
        revealScrollDistanceRef.current += Math.abs(delta);

        if (revealScrollDistanceRef.current >= HEADER_REVEAL_SCROLL_DISTANCE) {
          resetRevealDistance();
          setHeaderVisible(true);
        }
      }

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

    lastScrollYRef.current = getScrollTop();
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }

      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [pathname]);

  return headerRef;
}
