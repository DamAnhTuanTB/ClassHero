"use client";

import { useEffect, useRef } from "react";
import "@/components/shared/mathpix-markdown-renderer.css";

/**
 * Renders Mathpix Markdown (MMD) content with LaTeX math and table support.
 * Uses the native mathpix-markdown-it library for perfect rendering.
 */
export function MathpixMarkdownRenderer({
  content = "",
  className,
}: {
  content?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamic import to avoid SSR issues with mathpix-markdown-it
    import("mathpix-markdown-it").then(({ MathpixMarkdownModel }) => {
      // Đã xóa bỏ logic tự động xóa khoảng trắng của AI vì regex cũ bị sai (xóa lầm khoảng trắng bên ngoài $).
      // AI hiện tại đã được cấu hình prompt không sinh ra khoảng trắng thừa bên trong $.
      const safeContent = normalizeMathMarkdown(content || "");

      const html = MathpixMarkdownModel.markdownToHTML(safeContent, {
        htmlTags: true,
      });
      if (containerRef.current) {
        containerRef.current.innerHTML = html;
      }
    });
  }, [content]);

  return <div ref={containerRef} className={`mmd-content ${className ?? ""}`} />;
}

function normalizeMathMarkdown(value: string) {
  return value
    .replaceAll(`${String.fromCharCode(9)}riangle`, "\\triangle")
    .replaceAll(`${String.fromCharCode(12)}rac`, "\\frac")
    .replaceAll(`${String.fromCharCode(8)}eta`, "\\beta")
    .replaceAll(`${String.fromCharCode(13)}ight`, "\\right")
    .replaceAll(`${String.fromCharCode(28)}hat{`, "\\widehat{")
    .replaceAll(`${String.fromCharCode(27)}0`, "\\circ")
    .replace(
      /\\{2,}(?=(?:angle|triangle|frac|dfrac|sqrt|cdot|times|left|right|mathrm|text|circ|widehat|overline|perp|parallel|cong|neq|ne|le|ge)\b)/gu,
      "\\",
    );
}
