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
      const html = MathpixMarkdownModel.markdownToHTML(content || "", {
        htmlTags: true,
      });
      if (containerRef.current) {
        containerRef.current.innerHTML = html;
      }
    });
  }, [content]);

  return <div ref={containerRef} className={`mmd-content ${className ?? ""}`} />;
}
