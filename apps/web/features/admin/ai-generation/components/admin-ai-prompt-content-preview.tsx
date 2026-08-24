"use client";

import { Braces } from "lucide-react";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import "@/components/shared/mathpix-markdown-renderer.css";

import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";

type PromptKind = "system" | "user";

export function AdminAiPromptContentPreview({
  content,
  kind,
}: {
  content: string;
  kind: PromptKind;
}) {
  if (kind === "system") {
    return <PromptMarkdownPreview content={content} />;
  }

  const structuredPrompt = parseJsonSuffix(content);

  if (!structuredPrompt) {
    return <PromptMarkdownPreview content={content} />;
  }

  return (
    <div>
      {structuredPrompt.introduction ? (
        <div className="border-b border-[var(--theme-border)] p-4">
          <PromptMarkdownContent content={structuredPrompt.introduction} />
        </div>
      ) : null}

      <section aria-label="Dữ liệu JSON trong câu lệnh người dùng">
        <div className="flex items-start gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-3">
          <Braces
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]"
          />
          <div>
            <h4 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Brief JSON
            </h4>
            <p className="mt-0.5 text-xs leading-5 text-[var(--theme-text-muted)]">
              Đã định dạng để dễ kiểm tra; nội dung thực tế gửi đến model không thay đổi.
            </p>
          </div>
        </div>
        <AdminAiJsonInputViewer data={structuredPrompt.data} />
      </section>
    </div>
  );
}

function PromptMarkdownPreview({ content }: { content: string }) {
  return (
    <div
      className="max-h-96 overflow-y-auto p-4"
      data-testid="admin-ai-prompt-markdown-preview"
    >
      <PromptMarkdownContent content={content} />
    </div>
  );
}

function PromptMarkdownContent({ content }: { content: string }) {
  return (
    <div className="mmd-content whitespace-pre-wrap break-words [&_code]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--theme-surface-soft)] [&_pre]:p-3">
      <ReactMarkdown
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function parseJsonSuffix(content: string) {
  const candidateStarts = findJsonLineStarts(content);

  for (const start of [...candidateStarts].reverse()) {
    const candidate = content.slice(start).trim();

    try {
      const data: unknown = JSON.parse(candidate);
      if (typeof data !== "object" || data === null) continue;

      return {
        introduction: content.slice(0, start).trim(),
        data,
      };
    } catch {
      // A prompt may contain braces before its final JSON payload. Try the next candidate.
    }
  }

  return null;
}

function findJsonLineStarts(content: string) {
  const starts: number[] = [];
  const lineStartPattern = /^[\t ]*(?=[{[])/gmu;

  for (const match of content.matchAll(lineStartPattern)) {
    const leadingWhitespaceLength = match[0].length;
    starts.push((match.index ?? 0) + leadingWhitespaceLength);
  }

  const trimmedStart = content.search(/\S/u);
  if (trimmedStart >= 0 && /^[{[]/u.test(content.slice(trimmedStart, trimmedStart + 1))) {
    starts.push(trimmedStart);
  }

  return [...new Set(starts)];
}
