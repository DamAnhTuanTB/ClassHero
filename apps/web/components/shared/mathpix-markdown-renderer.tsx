"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";
import "@/components/shared/mathpix-markdown-renderer.css";
import {
  LEARNING_CONTENT_KATEX_MACROS,
  normalizeLearningContentLatex,
  normalizeMathpixMarkdown,
} from "@/lib/learning-content-math";
import { cn } from "@/lib/utils";

/**
 * Renders Mathpix Markdown (MMD) content with LaTeX math and table support.
 * Uses the native mathpix-markdown-it library for perfect rendering.
 */
export function MathpixMarkdownRenderer({
  content = "",
  contentAlignment = "authored",
  className,
}: {
  content?: string;
  contentAlignment?: "authored" | "left";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let disposeFormulaScrollbars: () => void = () => undefined;

    // Dynamic import to avoid SSR issues with mathpix-markdown-it
    import("mathpix-markdown-it").then(({ MathpixMarkdownModel }) => {
      if (cancelled) return;

      // Đã xóa bỏ logic tự động xóa khoảng trắng của AI vì regex cũ bị sai (xóa lầm khoảng trắng bên ngoài $).
      // AI hiện tại đã được cấu hình prompt không sinh ra khoảng trắng thừa bên trong $.
      const safeContent = normalizeMathpixMarkdown(content || "");

      const html = MathpixMarkdownModel.markdownToHTML(safeContent, {
        htmlTags: true,
        outMath: {
          include_latex: true,
          include_svg: false,
          output_format: "latex",
        },
      });
      if (containerRef.current) {
        containerRef.current.innerHTML = html;
        renderLearningContentMath(containerRef.current);
        disposeFormulaScrollbars = installPersistentFormulaScrollbars(
          containerRef.current,
        );
      }
    });

    return () => {
      cancelled = true;
      disposeFormulaScrollbars();
    };
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "mmd-content",
        contentAlignment === "left" && "mmd-content--left-aligned",
        className,
      )}
    />
  );
}

function renderLearningContentMath(container: HTMLDivElement) {
  for (const mathElement of container.querySelectorAll<HTMLElement>(
    ".math-inline, .math-block",
  )) {
    const displayMode = mathElement.classList.contains("math-block");
    const latex = readDelimitedLatex(mathElement.textContent ?? "", displayMode);
    if (!latex) continue;

    mathElement.innerHTML = katex.renderToString(
      normalizeLearningContentLatex(latex),
      {
        displayMode,
        macros: LEARNING_CONTENT_KATEX_MACROS,
        strict: false,
        throwOnError: false,
      },
    );
  }
}

function readDelimitedLatex(value: string, displayMode: boolean) {
  const normalizedValue = value.trim();
  const delimiterPairs = displayMode
    ? ([
        ["$$", "$$"],
        ["\\[", "\\]"],
      ] as const)
    : ([
        ["$", "$"],
        ["\\(", "\\)"],
      ] as const);

  for (const [openingDelimiter, closingDelimiter] of delimiterPairs) {
    if (
      normalizedValue.startsWith(openingDelimiter) &&
      normalizedValue.endsWith(closingDelimiter)
    ) {
      return normalizedValue.slice(
        openingDelimiter.length,
        normalizedValue.length - closingDelimiter.length,
      );
    }
  }

  return normalizedValue;
}

function installPersistentFormulaScrollbars(container: HTMLDivElement) {
  const cleanups: Array<() => void> = [];
  const formulaScrollers = Array.from(
    container.querySelectorAll<HTMLElement>(".math-block, .katex-display"),
  ).filter(
    (scroller) =>
      !scroller.classList.contains("katex-display") ||
      scroller.closest(".math-block") === null,
  );

  for (const scroller of formulaScrollers) {
    const parent = scroller.parentNode;
    if (!parent) continue;

    const shell = document.createElement("div");
    shell.className = "mmd-formula-scroll-shell";

    const scrollbar = document.createElement("input");
    scrollbar.className = "mmd-formula-scrollbar";
    scrollbar.type = "range";
    scrollbar.min = "0";
    scrollbar.max = "0";
    scrollbar.step = "1";
    scrollbar.value = "0";
    scrollbar.hidden = true;
    scrollbar.setAttribute("aria-label", "Cuộn ngang công thức");

    parent.insertBefore(shell, scroller);
    shell.append(scroller, scrollbar);

    const syncScrollbar = () => {
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const hasHorizontalOverflow = maxScrollLeft > 1;

      scrollbar.max = String(Math.ceil(maxScrollLeft));
      scrollbar.value = String(Math.min(maxScrollLeft, scroller.scrollLeft));
      scrollbar.hidden = !hasHorizontalOverflow;
      shell.classList.toggle(
        "mmd-formula-scroll-shell--overflowing",
        hasHorizontalOverflow,
      );
    };
    const handleScrollbarInput = () => {
      scroller.scrollLeft = Number(scrollbar.value);
    };

    scroller.addEventListener("scroll", syncScrollbar, { passive: true });
    scrollbar.addEventListener("input", handleScrollbarInput);

    const resizeObserver = new ResizeObserver(syncScrollbar);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) {
      resizeObserver.observe(scroller.firstElementChild);
    }
    const animationFrame = window.requestAnimationFrame(syncScrollbar);

    cleanups.push(() => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", syncScrollbar);
      scrollbar.removeEventListener("input", handleScrollbarInput);
    });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
