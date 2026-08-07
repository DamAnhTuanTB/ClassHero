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
      let safeContent = content || "";

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
