"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { tokenizeMathText } from "@learning-path/shared";
import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import type {
  TiptapJsonMark,
  TiptapJsonNode,
  TiptapTextDocument,
} from "@/types/rich-text";
import { hasTiptapDocumentContent } from "@/lib/tiptap-rich-content";
import {
  LEARNING_CONTENT_KATEX_MACROS,
  normalizeLearningContentLatex,
} from "@/lib/learning-content-math";
import { cn } from "@/lib/utils";
import "@/features/admin/quiz/components/quiz-rich-content-editor.css";
import "@/components/common/content/math-content-typography.css";

interface QuizRichContentViewerProps {
  ariaLabel?: string;
  className?: string;
  content: TiptapTextDocument | null | undefined;
  contentAlignment?: "authored" | "left";
  fallback?: string;
}

export function QuizRichContentViewer({
  ariaLabel,
  className,
  content,
  contentAlignment = "authored",
  fallback = "",
}: QuizRichContentViewerProps) {
  if (!content || !hasTiptapDocumentContent(content)) {
    return fallback ? <span className={className}>{fallback}</span> : null;
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "quiz-rich-content-editor quiz-rich-content-viewer min-w-0",
        contentAlignment === "left" && "quiz-rich-content-viewer--left-aligned",
        className,
      )}
    >
      <div className="quiz-rich-content-prosemirror">
        {renderRichContentNodes(content.content, contentAlignment)}
      </div>
    </div>
  );
}

function renderRichContentNodes(
  nodes: TiptapJsonNode[] | undefined,
  contentAlignment: "authored" | "left",
) {
  return nodes?.map((node, index) => (
    <Fragment key={`${node.type}-${index}`}>
      {renderRichContentNode(node, contentAlignment)}
    </Fragment>
  ));
}

function renderRichContentNode(
  node: TiptapJsonNode,
  contentAlignment: "authored" | "left",
): ReactNode {
  const children = renderRichContentNodes(node.content, contentAlignment);

  switch (node.type) {
    case "text":
      return renderTextWithFallbackMath(node.text ?? "", node.marks);
    case "paragraph":
      return (
        <p
          data-indent={readIndent(node.attrs?.indent)}
          style={readBlockStyle(node, contentAlignment)}
        >
          {children ?? <br />}
        </p>
      );
    case "heading": {
      const headingProps = {
        "data-indent": readIndent(node.attrs?.indent),
        style: readBlockStyle(node, contentAlignment),
      };
      return readNumber(node.attrs?.level, 2) === 3 ? (
        <h3 {...headingProps}>{children}</h3>
      ) : (
        <h2 {...headingProps}>{children}</h2>
      );
    }
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol start={readNumber(node.attrs?.start, 1)}>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre>
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br />;
    case "horizontalRule":
      return <hr />;
    case "inlineMath":
      return renderFormula(node, false);
    case "blockMath":
      return renderFormula(node, true);
    case "image":
      return <RichContentImage node={node} />;
    case "table":
      return <RichContentTable contentAlignment={contentAlignment} node={node} />;
    case "tableRow":
      return <tr>{children}</tr>;
    case "tableHeader":
      return (
        <RichContentTableCell contentAlignment={contentAlignment} node={node} tag="th" />
      );
    case "tableCell":
      return (
        <RichContentTableCell contentAlignment={contentAlignment} node={node} tag="td" />
      );
    default:
      return children;
  }
}

function renderTextWithFallbackMath(text: string, marks: TiptapJsonMark[] | undefined) {
  return tokenizeMathText(text).map((token, index) => (
    <Fragment key={`${token.type}-${index}`}>
      {token.type === "text"
        ? renderTextMarks(token.value, marks)
        : renderFormula(
            {
              type: token.display ? "blockMath" : "inlineMath",
              attrs: { latex: token.latex },
            },
            token.display,
          )}
    </Fragment>
  ));
}

function renderTextMarks(text: string, marks: TiptapJsonMark[] | undefined) {
  return (marks ?? []).reduce<ReactNode>((content, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong>{content}</strong>;
      case "italic":
        return <em>{content}</em>;
      case "underline":
        return <u>{content}</u>;
      case "strike":
        return <s>{content}</s>;
      case "code":
        return <code>{content}</code>;
      case "textStyle": {
        const color =
          typeof mark.attrs?.color === "string" ? mark.attrs.color : undefined;
        return color ? <span style={{ color }}>{content}</span> : content;
      }
      default:
        return content;
    }
  }, text);
}

function renderFormula(node: TiptapJsonNode, displayMode: boolean) {
  const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
  if (!latex) {
    return null;
  }

  const html = renderFormulaHtml(latex, displayMode);

  if (displayMode) {
    return (
      <span
        className="tiptap-mathematics-render"
        data-latex={latex}
        data-type="block-math"
      >
        <span
          className="block-math-inner"
          {...(html ? { dangerouslySetInnerHTML: { __html: html } } : {})}
        >
          {html ? null : latex}
        </span>
      </span>
    );
  }

  return (
    <span
      className="tiptap-mathematics-render"
      data-latex={latex}
      data-type="inline-math"
      {...(html ? { dangerouslySetInnerHTML: { __html: html } } : {})}
    >
      {html ? null : latex}
    </span>
  );
}

function RichContentImage({ node }: { node: TiptapJsonNode }) {
  const [naturalSize, setNaturalSize] = useState(() => ({
    height: readPositiveNumber(node.attrs?.sourceHeight, 9),
    width: readPositiveNumber(node.attrs?.sourceWidth, 16),
  }));
  const baseWidthPercent = readBoundedNumber(node.attrs?.baseWidthPercent, 20, 100, 100);
  const widthPercent = readBoundedNumber(node.attrs?.widthPercent, 20, 100, 100);
  const cropTop = readBoundedNumber(node.attrs?.cropTop, 0, 90, 0);
  const cropRight = readBoundedNumber(node.attrs?.cropRight, 0, 90, 0);
  const cropBottom = readBoundedNumber(node.attrs?.cropBottom, 0, 90, 0);
  const cropLeft = readBoundedNumber(node.attrs?.cropLeft, 0, 90, 0);
  const visibleWidth = Math.max(100 - cropLeft - cropRight, 10);
  const visibleHeight = Math.max(100 - cropTop - cropBottom, 10);
  const cropAspectRatio =
    (naturalSize.width * visibleWidth) / (naturalSize.height * visibleHeight);
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
  const alignment = readImageAlignment(node.attrs?.alignment);
  const imageStyle = {
    height: `${10000 / visibleHeight}%`,
    left: `${(-cropLeft * 100) / visibleWidth}%`,
    top: `${(-cropTop * 100) / visibleHeight}%`,
    width: `${10000 / visibleWidth}%`,
  } satisfies CSSProperties;

  return (
    <figure className="quiz-rich-image-node" data-alignment={alignment}>
      <div
        className="quiz-rich-image-viewport"
        style={{
          aspectRatio: Number.isFinite(cropAspectRatio) ? cropAspectRatio : 16 / 9,
          width: `${(baseWidthPercent * widthPercent) / 100}%`,
        }}
      >
        {/* Signed/public R2 URLs and persisted crop coordinates need a regular image. */}
        <img
          alt={alt}
          className="quiz-rich-image-media"
          decoding="async"
          loading="lazy"
          src={src}
          style={imageStyle}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setNaturalSize({
                height: image.naturalHeight,
                width: image.naturalWidth,
              });
            }
          }}
        />
      </div>
    </figure>
  );
}

function RichContentTableCell({
  contentAlignment,
  node,
  tag,
}: {
  contentAlignment: "authored" | "left";
  node: TiptapJsonNode;
  tag: "td" | "th";
}) {
  const cellHeight = readOptionalBoundedNumber(node.attrs?.cellHeight, 32, 320);
  const cellProps = {
    colSpan: readNumber(node.attrs?.colspan, 1),
    rowSpan: readNumber(node.attrs?.rowspan, 1),
    ...(cellHeight ? { style: { height: `${cellHeight}px` } } : {}),
  };
  const children = renderRichContentNodes(node.content, contentAlignment);

  return tag === "th" ? (
    <th {...cellProps}>{children}</th>
  ) : (
    <td {...cellProps}>{children}</td>
  );
}

function RichContentTable({
  contentAlignment,
  node,
}: {
  contentAlignment: "authored" | "left";
  node: TiptapJsonNode;
}) {
  const columnWidths = readTableColumnWidths(node);

  return (
    <div className="tableWrapper">
      <table>
        {columnWidths.length > 0 ? (
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={width ? { width: `${width}px` } : undefined} />
            ))}
          </colgroup>
        ) : null}
        <tbody>{renderRichContentNodes(node.content, contentAlignment)}</tbody>
      </table>
    </div>
  );
}

function readTableColumnWidths(table: TiptapJsonNode) {
  const widths: Array<number | undefined> = [];

  table.content?.forEach((row) => {
    let columnIndex = 0;
    row.content?.forEach((cell) => {
      const columnSpan = Math.max(1, Math.round(readNumber(cell.attrs?.colspan, 1)));
      const cellWidths = Array.isArray(cell.attrs?.colwidth) ? cell.attrs.colwidth : [];

      for (let spanIndex = 0; spanIndex < columnSpan; spanIndex += 1) {
        const width = readOptionalBoundedNumber(cellWidths[spanIndex], 24, 2_000);
        if (width && !widths[columnIndex + spanIndex]) {
          widths[columnIndex + spanIndex] = width;
        } else if (widths[columnIndex + spanIndex] === undefined) {
          widths[columnIndex + spanIndex] = undefined;
        }
      }
      columnIndex += columnSpan;
    });
  });

  return widths;
}

function readBlockStyle(
  node: TiptapJsonNode,
  contentAlignment: "authored" | "left",
): CSSProperties | undefined {
  if (contentAlignment === "left") {
    return { textAlign: "left" };
  }

  const textAlign = node.attrs?.textAlign;
  if (
    textAlign === "left" ||
    textAlign === "center" ||
    textAlign === "right" ||
    textAlign === "justify"
  ) {
    return { textAlign };
  }
  return undefined;
}

function readIndent(value: unknown) {
  const indent = readBoundedNumber(value, 0, 8, 0);
  return indent > 0 ? indent : undefined;
}

function readImageAlignment(value: unknown) {
  return value === "left" || value === "right" ? value : "center";
}

function renderFormulaHtml(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(normalizeLearningContentLatex(latex), {
      displayMode,
      macros: LEARNING_CONTENT_KATEX_MACROS,
      strict: false,
      throwOnError: false,
    });
  } catch {
    return "";
  }
}

function readNumber(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function readPositiveNumber(value: unknown, fallback: number) {
  const numericValue = readNumber(value, fallback);
  return numericValue > 0 ? numericValue : fallback;
}

function readBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return Math.min(Math.max(readNumber(value, fallback), minimum), maximum);
}

function readOptionalBoundedNumber(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue)
    ? Math.min(Math.max(numericValue, minimum), maximum)
    : undefined;
}
