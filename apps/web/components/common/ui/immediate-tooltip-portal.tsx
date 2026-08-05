"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ImmediateTooltipPortal({
  anchor,
  content,
}: {
  anchor: HTMLElement | null;
  content: string;
}) {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip || !anchor.isConnected) {
        return;
      }

      const viewportMargin = 8;
      const gap = 8;
      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const centeredLeft = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
      const maxLeft = Math.max(
        viewportMargin,
        window.innerWidth - tooltipRect.width - viewportMargin,
      );
      const left = Math.min(Math.max(centeredLeft, viewportMargin), maxLeft);
      const topAbove = anchorRect.top - tooltipRect.height - gap;
      const topBelow = anchorRect.bottom + gap;
      const maxTop = Math.max(
        viewportMargin,
        window.innerHeight - tooltipRect.height - viewportMargin,
      );
      const top =
        topAbove >= viewportMargin
          ? topAbove
          : Math.min(Math.max(topBelow, viewportMargin), maxTop);

      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, content]);

  if (!anchor || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <span
      ref={tooltipRef}
      role="tooltip"
      data-immediate-tooltip=""
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      className="pointer-events-none fixed z-[10000] max-w-64 rounded-md bg-[var(--theme-tooltip-bg)] px-2.5 py-1.5 text-center text-xs font-bold leading-4 text-[var(--theme-tooltip-text)] shadow-[var(--theme-shadow-sm)]"
    >
      {content}
    </span>,
    document.body,
  );
}
