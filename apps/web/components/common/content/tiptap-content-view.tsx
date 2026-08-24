"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import "@/components/common/content/math-content-typography.css";
import type { CSSProperties, ReactNode } from "react";
import type {
  TiptapJsonMark,
  TiptapJsonNode,
  TiptapTextDocument,
} from "@/types/rich-text";
import {
  normalizeLatexCommandBackslashes,
  normalizeMathTextLatexCommands,
  tokenizeMathText,
} from "@learning-path/shared";
import {
  LEARNING_CONTENT_KATEX_MACROS,
  normalizeLearningContentLatex,
} from "@/lib/learning-content-math";
import { cn } from "@/lib/utils";

export function TiptapContentView({
  className,
  content,
  contentAlignment = "authored",
}: {
  className?: string;
  content: TiptapTextDocument | null | undefined;
  contentAlignment?: "authored" | "left";
}) {
  if (!content?.content?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "tiptap-content-view space-y-3 leading-relaxed text-slate-700 dark:text-[var(--theme-text)]",
        contentAlignment === "left" &&
          "text-left [&_.katex-display]:!text-left [&_.katex-display>.katex]:!text-left",
        className,
      )}
    >
      {content.content.map((node, index) => (
        <ContentNode
          key={`${node.type}-${index}`}
          contentAlignment={contentAlignment}
          node={node}
        />
      ))}
    </div>
  );
}

function ContentNode({
  contentAlignment,
  node,
}: {
  contentAlignment: "authored" | "left";
  node: TiptapJsonNode;
}): ReactNode {
  const children = node.content?.map((child, index) => (
    <ContentNode
      key={`${child.type}-${index}`}
      contentAlignment={contentAlignment}
      node={child}
    />
  ));

  if (node.type === "text") {
    return renderTextWithFallbackMath(node.text ?? "", node.marks, contentAlignment);
  }
  if (node.type === "paragraph") {
    return (
      <p
        style={paragraphStyle(node, contentAlignment)}
        className="min-h-5 whitespace-pre-wrap"
      >
        {children}
      </p>
    );
  }
  if (node.type === "heading") {
    const level = node.attrs?.level === 3 ? 3 : 2;
    const classes =
      level === 3
        ? "text-lg font-black text-slate-900 dark:text-[var(--theme-text-strong)]"
        : "text-xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]";
    return level === 3 ? (
      <h3 className={classes} style={paragraphStyle(node, contentAlignment)}>
        {children}
      </h3>
    ) : (
      <h2 className={classes} style={paragraphStyle(node, contentAlignment)}>
        {children}
      </h2>
    );
  }
  if (node.type === "bulletList") {
    return <ul className="ml-5 list-disc space-y-1">{children}</ul>;
  }
  if (node.type === "orderedList") {
    return <ol className="ml-5 list-decimal space-y-1">{children}</ol>;
  }
  if (node.type === "listItem") {
    return <li>{children}</li>;
  }
  if (node.type === "hardBreak") {
    return <br />;
  }
  if (node.type === "inlineMath" || node.type === "blockMath") {
    const latex =
      typeof node.attrs?.latex === "string"
        ? normalizeLatexCommandBackslashes(node.attrs.latex)
        : "";
    const html = renderMath(latex, node.type === "blockMath");
    return (
      <span
        className={cn(
          node.type === "blockMath" && "my-3 block overflow-x-auto py-1",
          contentAlignment === "left" &&
            node.type === "blockMath" &&
            "overflow-y-hidden text-left",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (node.type === "image") {
    const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    if (!src) return null;
    return (
      <img
        src={src}
        alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""}
        className="mx-auto max-h-[28rem] max-w-full rounded-2xl object-contain"
      />
    );
  }
  if (node.type === "table") {
    return (
      <div
        className={cn(
          "overflow-x-auto rounded-xl border border-slate-200 dark:border-[var(--theme-border)]",
          contentAlignment === "left" && "overflow-y-hidden",
        )}
      >
        <table className="w-full border-collapse text-sm">
          <tbody>{children}</tbody>
        </table>
      </div>
    );
  }
  if (node.type === "tableRow") {
    return <tr>{children}</tr>;
  }
  if (node.type === "tableHeader") {
    return (
      <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-black dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]">
        {children}
      </th>
    );
  }
  if (node.type === "tableCell") {
    return (
      <td className="border border-slate-200 px-3 py-2 dark:border-[var(--theme-border)]">
        {children}
      </td>
    );
  }

  return <>{children}</>;
}

function renderTextWithFallbackMath(
  text: string,
  marks: TiptapJsonMark[] | undefined,
  contentAlignment: "authored" | "left",
) {
  return tokenizeMathText(normalizeMathTextLatexCommands(text)).map((token, index) =>
    token.type === "text" ? (
      <span key={`text-${index}`}>{applyMarks(token.value, marks)}</span>
    ) : (
      <span
        key={`math-${index}`}
        className={cn(
          token.display && "my-3 block overflow-x-auto py-1",
          contentAlignment === "left" && token.display && "overflow-y-hidden text-left",
        )}
        dangerouslySetInnerHTML={{
          __html: renderMath(token.latex, token.display),
        }}
      />
    ),
  );
}

function applyMarks(text: string, marks: TiptapJsonMark[] | undefined): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark) => {
    if (mark.type === "bold") return <strong>{child}</strong>;
    if (mark.type === "italic") return <em>{child}</em>;
    if (mark.type === "underline") return <u>{child}</u>;
    if (mark.type === "strike") return <s>{child}</s>;
    if (mark.type === "textStyle" && typeof mark.attrs?.color === "string") {
      return <span style={{ color: mark.attrs.color }}>{child}</span>;
    }
    return child;
  }, text);
}

function paragraphStyle(
  node: TiptapJsonNode,
  contentAlignment: "authored" | "left",
): CSSProperties {
  const textAlign =
    contentAlignment === "left"
      ? "left"
      : ["left", "center", "right", "justify"].includes(String(node.attrs?.textAlign))
        ? (node.attrs?.textAlign as CSSProperties["textAlign"])
        : undefined;
  const indent =
    typeof node.attrs?.indent === "number"
      ? Math.min(8, Math.max(0, node.attrs.indent))
      : 0;
  return {
    textAlign,
    ...(indent ? { marginLeft: `${indent * 1.25}rem` } : {}),
  };
}

function renderMath(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(normalizeLearningContentLatex(latex), {
      displayMode,
      macros: LEARNING_CONTENT_KATEX_MACROS,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}
