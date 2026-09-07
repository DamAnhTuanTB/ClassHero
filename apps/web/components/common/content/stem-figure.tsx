"use client";

import { AlertTriangle, Clock3, LoaderCircle } from "lucide-react";
import { normalizeMathTextLatexCommands, tokenizeMathText } from "@learning-path/shared";
import katex from "katex";
import type { ReactNode } from "react";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import "@/components/common/content/math-content-typography.css";
import {
  LEARNING_CONTENT_KATEX_MACROS,
  normalizeLearningContentLatex,
} from "@/lib/learning-content-math";
import { getStemFigureDisplayPercent } from "@/lib/stem-figure-display";

export type StemFigureVisual = {
  kind: "TEX_FIGURE";
  figureId: string;
  figureIndex?: number;
  altText: string;
  caption: string | null;
  status?: "QUEUED" | "RENDERING" | "REPAIRING" | "SUCCEEDED" | "NEEDS_REVIEW" | "FAILED";
  previewSvg?: string;
  assetUrl?: string | null;
  lastErrorCategory?: string | null;
  displayScale?: number | null;
};

export function StemFigure({
  visual,
  displaySize = "default",
  footer,
}: {
  visual: StemFigureVisual;
  showStatus?: boolean;
  displaySize?: "default" | "textbook-source";
  footer?: ReactNode;
}) {
  const imageUrl = visual.assetUrl || toSvgDataUrl(visual.previewSvg);
  const displayPercent = getStemFigureDisplayPercent(visual.displayScale);
  if (!imageUrl) {
    const failed = visual.status === "FAILED";
    const needsReview = visual.status === "NEEDS_REVIEW";
    return (
      <figure className="my-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm">
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
          {failed || needsReview ? (
            <AlertTriangle
              className={`h-7 w-7 ${failed ? "text-rose-500" : "text-amber-500"}`}
              aria-hidden="true"
            />
          ) : visual.status === "RENDERING" ? (
            <LoaderCircle
              className="h-7 w-7 animate-spin text-sky-500 motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Clock3 className="h-7 w-7 text-amber-500" aria-hidden="true" />
          )}
          <p className="text-sm font-bold">
            {failed
              ? "Hình cần được sửa và render lại"
              : needsReview
                ? "Hình cần được kiểm tra trước khi sử dụng"
                : visual.status === "RENDERING"
                  ? "Hình đang được render"
                  : visual.status === "REPAIRING"
                    ? "AI đang sửa hình"
                    : visual.status === "QUEUED"
                      ? "Hình đang chờ xử lý"
                      : "Hình đang được xử lý"}
          </p>
        </div>
      </figure>
    );
  }

  return (
    <figure
      className="mx-auto my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
      style={displayPercent === null ? undefined : { width: `${displayPercent}%` }}
    >
      <img
        alt={visual.altText}
        className={
          displayPercent !== null
            ? displaySize === "textbook-source"
              ? "mx-auto block h-auto max-h-64 w-full object-contain"
              : "mx-auto block h-auto max-h-[34rem] w-full object-contain"
            : displaySize === "textbook-source"
              ? "mx-auto block h-auto w-fit max-h-64 max-w-full object-contain"
              : "mx-auto block h-auto max-h-[34rem] w-auto max-w-full object-contain"
        }
        decoding="async"
        loading="lazy"
        src={imageUrl}
      />
      {visual.caption ? (
        <figcaption className="learning-content-text mt-3 text-center font-medium leading-relaxed text-slate-600">
          <StemFigureMathText value={visual.caption} />
        </figcaption>
      ) : null}
      {footer}
    </figure>
  );
}

export function StemFigureMathText({
  value,
  displayMathAsInline = false,
  inheritMathWeight = false,
}: {
  value: string;
  displayMathAsInline?: boolean;
  inheritMathWeight?: boolean;
}) {
  return tokenizeMathText(normalizeMathTextLatexCommands(value)).map((token, index) => {
    if (token.type === "text") {
      return <span key={`text-${index}`}>{token.value}</span>;
    }

    const displayMode = token.display && !displayMathAsInline;
    return (
      <span
        key={`math-${index}`}
        className={
          displayMode
            ? `math-content-typography my-2 block overflow-x-auto py-1 ${
                inheritMathWeight ? "math-content-typography--inherit-math-weight" : ""
              }`
            : `math-content-typography inline ${
                inheritMathWeight ? "math-content-typography--inherit-math-weight" : ""
              }`
        }
        dangerouslySetInnerHTML={{
          __html: renderMath(token.latex, displayMode),
        }}
      />
    );
  });
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

function toSvgDataUrl(svg: string | undefined) {
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
