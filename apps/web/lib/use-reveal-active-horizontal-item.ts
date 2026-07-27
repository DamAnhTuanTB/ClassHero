"use client";

import { useCallback, useEffect, useRef } from "react";

export function useRevealActiveHorizontalItem<ItemKey extends string>(
  activeItemKey: ItemKey | null | undefined,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Partial<Record<ItemKey, HTMLElement | null>>>({});

  useEffect(() => {
    const scroller = scrollerRef.current;
    const activeItem = activeItemKey ? itemRefs.current[activeItemKey] : null;
    if (!scroller || !activeItem) {
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const visibleLeft = scroller.scrollLeft;
    const itemLeft = itemRect.left - scrollerRect.left + scroller.scrollLeft;
    const nextScrollLeft = itemLeft - (scroller.clientWidth - itemRect.width) / 2;

    const clampedScrollLeft = Math.max(
      0,
      Math.min(nextScrollLeft, scroller.scrollWidth - scroller.clientWidth),
    );
    if (Math.abs(clampedScrollLeft - visibleLeft) < 1) {
      return;
    }

    scroller.scrollTo({
      left: clampedScrollLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [activeItemKey]);

  const setItemRef = useCallback((itemKey: ItemKey, element: HTMLElement | null) => {
    itemRefs.current[itemKey] = element;
  }, []);

  const focusItem = useCallback((itemKey: ItemKey) => {
    requestAnimationFrame(() => itemRefs.current[itemKey]?.focus());
  }, []);

  return { focusItem, scrollerRef, setItemRef };
}
