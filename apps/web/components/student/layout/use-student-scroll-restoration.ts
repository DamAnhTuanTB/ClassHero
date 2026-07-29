"use client";

import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useRef } from "react";

const STUDENT_SCROLL_HISTORY_STATE_KEY = "__classHeroStudentScrollY";

export function getSavedStudentScrollPosition() {
  const historyState: unknown = window.history.state;

  if (typeof historyState !== "object" || historyState === null) {
    return null;
  }

  const savedScrollPosition = Reflect.get(historyState, STUDENT_SCROLL_HISTORY_STATE_KEY);

  return typeof savedScrollPosition === "number" && Number.isFinite(savedScrollPosition)
    ? Math.max(0, savedScrollPosition)
    : null;
}

function saveScrollPosition(scrollPosition: number) {
  const normalizedScrollPosition = Math.max(0, scrollPosition);

  if (getSavedStudentScrollPosition() === normalizedScrollPosition) {
    return;
  }

  const historyState: unknown = window.history.state;
  const nextHistoryState =
    typeof historyState === "object" && historyState !== null
      ? {
          ...historyState,
          [STUDENT_SCROLL_HISTORY_STATE_KEY]: normalizedScrollPosition,
        }
      : { [STUDENT_SCROLL_HISTORY_STATE_KEY]: normalizedScrollPosition };

  window.history.replaceState(nextHistoryState, "");
}

function restoreWindowScroll(scrollPosition: number) {
  window.scrollTo({
    behavior: "auto",
    left: 0,
    top: scrollPosition,
  });
}

export function useStudentScrollRestoration() {
  const pathname = usePathname();
  const initialPathnameRef = useRef(pathname);
  const hasChangedPathRef = useRef(false);
  const isRestoringRef = useRef(true);
  const saveFrameRef = useRef<number | null>(null);
  const firstRestoreFrameRef = useRef<number | null>(null);
  const secondRestoreFrameRef = useRef<number | null>(null);

  const cancelRestoreFrames = useCallback(() => {
    if (firstRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(firstRestoreFrameRef.current);
      firstRestoreFrameRef.current = null;
    }

    if (secondRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(secondRestoreFrameRef.current);
      secondRestoreFrameRef.current = null;
    }
  }, []);

  const restoreScrollPosition = useCallback(
    (scrollPosition: number) => {
      isRestoringRef.current = true;

      if (saveFrameRef.current !== null) {
        window.cancelAnimationFrame(saveFrameRef.current);
        saveFrameRef.current = null;
      }

      cancelRestoreFrames();
      restoreWindowScroll(scrollPosition);

      firstRestoreFrameRef.current = window.requestAnimationFrame(() => {
        firstRestoreFrameRef.current = null;
        restoreWindowScroll(scrollPosition);

        secondRestoreFrameRef.current = window.requestAnimationFrame(() => {
          secondRestoreFrameRef.current = null;
          restoreWindowScroll(scrollPosition);
          saveScrollPosition(scrollPosition);
          isRestoringRef.current = false;
        });
      });
    },
    [cancelRestoreFrames],
  );

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;

    window.history.scrollRestoration = "manual";

    const handleScroll = () => {
      if (isRestoringRef.current || saveFrameRef.current !== null) {
        return;
      }

      saveFrameRef.current = window.requestAnimationFrame(() => {
        saveFrameRef.current = null;

        if (!isRestoringRef.current) {
          saveScrollPosition(window.scrollY);
        }
      });
    };

    const handlePopState = () => {
      restoreScrollPosition(getSavedStudentScrollPosition() ?? 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      if (saveFrameRef.current !== null) {
        window.cancelAnimationFrame(saveFrameRef.current);
      }

      cancelRestoreFrames();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("popstate", handlePopState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [cancelRestoreFrames, restoreScrollPosition]);

  useLayoutEffect(() => {
    const [navigationEntry] = performance.getEntriesByType("navigation");
    if (pathname !== initialPathnameRef.current) {
      hasChangedPathRef.current = true;
    }

    const shouldResetAfterReload =
      !hasChangedPathRef.current &&
      (navigationEntry as PerformanceNavigationTiming | undefined)?.type === "reload";
    const targetScrollPosition = shouldResetAfterReload
      ? 0
      : (getSavedStudentScrollPosition() ?? 0);

    restoreScrollPosition(targetScrollPosition);
  }, [pathname, restoreScrollPosition]);
}
