"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import "@/components/common/content/math-content-typography.css";
import "@/components/common/content/tiptap-content-view.css";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  TiptapJsonMark,
  TiptapJsonNode,
  TiptapTextDocument,
} from "@learning-path/shared";
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
  ariaLabel,
  className,
  content,
  contentAlignment = "authored",
}: {
  ariaLabel?: string;
  className?: string;
  content: TiptapTextDocument | null | undefined;
  contentAlignment?: "authored" | "left";
}) {
  if (!content?.content?.length) {
    return null;
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "tiptap-content-view min-w-0 leading-relaxed text-slate-700 dark:text-[var(--theme-text)]",
        contentAlignment === "left" && "tiptap-content-view--left-aligned text-left",
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
    return renderTextWithFallbackMath(node.text ?? "", node.marks);
  }
  if (node.type === "paragraph") {
    return (
      <p
        data-indent={readIndent(node.attrs?.indent)}
        style={paragraphStyle(node, contentAlignment)}
        className="min-h-5 whitespace-pre-wrap"
      >
        {children}
      </p>
    );
  }
  if (node.type === "heading") {
    const level = node.attrs?.level === 3 ? 3 : 2;
    const headingProps = {
      "data-indent": readIndent(node.attrs?.indent),
      style: paragraphStyle(node, contentAlignment),
    };
    return level === 3 ? (
      <h3 {...headingProps}>{children}</h3>
    ) : (
      <h2 {...headingProps}>{children}</h2>
    );
  }
  if (node.type === "bulletList") {
    return <ul>{children}</ul>;
  }
  if (node.type === "orderedList") {
    return <ol start={readNumber(node.attrs?.start, 1)}>{children}</ol>;
  }
  if (node.type === "listItem") {
    return <li>{children}</li>;
  }
  if (node.type === "blockquote") {
    return <blockquote>{children}</blockquote>;
  }
  if (node.type === "codeBlock") {
    return (
      <pre>
        <code>{children}</code>
      </pre>
    );
  }
  if (node.type === "hardBreak") {
    return <br />;
  }
  if (node.type === "horizontalRule") {
    return <hr />;
  }
  if (node.type === "inlineMath" || node.type === "blockMath") {
    const latex =
      typeof node.attrs?.latex === "string"
        ? normalizeLatexCommandBackslashes(node.attrs.latex)
        : "";
    return node.type === "blockMath" ? (
      <TiptapBlockMath latex={latex} />
    ) : (
      <span dangerouslySetInnerHTML={{ __html: renderMath(latex, false) }} />
    );
  }
  if (node.type === "image") {
    return <TiptapContentImage node={node} />;
  }
  if (node.type === "table") {
    return <TiptapContentTable contentAlignment={contentAlignment} node={node} />;
  }
  if (node.type === "tableRow") {
    return <tr>{children}</tr>;
  }
  if (node.type === "tableHeader") {
    return (
      <TiptapContentTableCell
        contentAlignment={contentAlignment}
        node={node}
        tag="th"
      />
    );
  }
  if (node.type === "tableCell") {
    return (
      <TiptapContentTableCell
        contentAlignment={contentAlignment}
        node={node}
        tag="td"
      />
    );
  }

  return <>{children}</>;
}

function renderTextWithFallbackMath(
  text: string,
  marks: TiptapJsonMark[] | undefined,
) {
  return tokenizeMathText(normalizeMathTextLatexCommands(text)).map((token, index) =>
    token.type === "text" ? (
      <span key={`text-${index}`}>{applyMarks(token.value, marks)}</span>
    ) : (
      <span
        key={`math-${index}`}
      >
        {token.display ? (
          <TiptapBlockMath latex={token.latex} />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: renderMath(token.latex, false) }} />
        )}
      </span>
    ),
  );
}

function applyMarks(text: string, marks: TiptapJsonMark[] | undefined): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark) => {
    if (mark.type === "bold") return <strong>{child}</strong>;
    if (mark.type === "italic") return <em>{child}</em>;
    if (mark.type === "underline") return <u>{child}</u>;
    if (mark.type === "strike") return <s>{child}</s>;
    if (mark.type === "code") return <code>{child}</code>;
    if (mark.type === "textStyle" && typeof mark.attrs?.color === "string") {
      return <span style={{ color: mark.attrs.color }}>{child}</span>;
    }
    return child;
  }, text);
}

function TiptapBlockMath({ latex }: { latex: string }) {
  const scrollerRef = useRef<HTMLSpanElement>(null);
  const [scrollMax, setScrollMax] = useState(0);
  const [scrollValue, setScrollValue] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const syncScrollbar = () => {
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      setScrollMax(Math.ceil(maxScrollLeft));
      setScrollValue(Math.min(maxScrollLeft, scroller.scrollLeft));
    };
    const resizeObserver = new ResizeObserver(syncScrollbar);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) resizeObserver.observe(scroller.firstElementChild);
    scroller.addEventListener("scroll", syncScrollbar, { passive: true });
    const animationFrame = window.requestAnimationFrame(syncScrollbar);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", syncScrollbar);
    };
  }, [latex]);

  return (
    <span className="tiptap-formula-scroll-shell">
      <span
        ref={scrollerRef}
        className="tiptap-content-block-math"
        dangerouslySetInnerHTML={{ __html: renderMath(latex, true) }}
      />
      <input
        aria-label="Cuộn ngang công thức"
        className="tiptap-formula-scrollbar"
        hidden={scrollMax <= 1}
        max={scrollMax}
        min={0}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          setScrollValue(nextValue);
          if (scrollerRef.current) scrollerRef.current.scrollLeft = nextValue;
        }}
        step={1}
        type="range"
        value={scrollValue}
      />
    </span>
  );
}

function TiptapContentImage({ node }: { node: TiptapJsonNode }) {
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
  const [naturalSize, setNaturalSize] = useState(() => ({
    height: readPositiveNumber(node.attrs?.sourceHeight, 9),
    width: readPositiveNumber(node.attrs?.sourceWidth, 16),
  }));
  if (!src) return null;

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
  const alignment = readImageAlignment(node.attrs?.alignment);

  return (
    <figure className="tiptap-content-image" data-alignment={alignment}>
      <span
        className="tiptap-content-image-viewport"
        style={{
          aspectRatio: Number.isFinite(cropAspectRatio) ? cropAspectRatio : 16 / 9,
          width: `${(baseWidthPercent * widthPercent) / 100}%`,
        }}
      >
        <img
          alt={alt}
          className="tiptap-content-image-media"
          decoding="async"
          loading="lazy"
          src={src}
          style={{
            height: `${10000 / visibleHeight}%`,
            left: `${(-cropLeft * 100) / visibleWidth}%`,
            top: `${(-cropTop * 100) / visibleHeight}%`,
            width: `${10000 / visibleWidth}%`,
          }}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setNaturalSize({ height: image.naturalHeight, width: image.naturalWidth });
            }
          }}
        />
      </span>
    </figure>
  );
}

function TiptapContentTable({
  contentAlignment,
  node,
}: {
  contentAlignment: "authored" | "left";
  node: TiptapJsonNode;
}) {
  const columnWidths = readTableColumnWidths(node);
  return (
    <div className="tiptap-content-table-wrapper">
      <table>
        {columnWidths.length > 0 ? (
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={width ? { width: `${width}px` } : undefined} />
            ))}
          </colgroup>
        ) : null}
        <tbody>
          {node.content?.map((row, index) => (
            <Fragment key={`${row.type}-${index}`}>
              <ContentNode contentAlignment={contentAlignment} node={row} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TiptapContentTableCell({
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
  const children = node.content?.map((child, index) => (
    <Fragment key={`${child.type}-${index}`}>
      <ContentNode contentAlignment={contentAlignment} node={child} />
    </Fragment>
  ));
  return tag === "th" ? <th {...cellProps}>{children}</th> : <td {...cellProps}>{children}</td>;
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

function readNumber(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return Math.min(maximum, Math.max(minimum, readNumber(value, fallback)));
}

function readOptionalBoundedNumber(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : undefined;
}

function readPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readIndent(value: unknown) {
  const indent = readBoundedNumber(value, 0, 8, 0);
  return indent > 0 ? indent : undefined;
}

function readImageAlignment(value: unknown) {
  return value === "left" || value === "right" ? value : "center";
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
