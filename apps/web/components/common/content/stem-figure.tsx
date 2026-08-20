"use client";

import { AlertTriangle, Clock3, LoaderCircle } from "lucide-react";
import { tokenizeMathText } from "@learning-path/shared";
import katex from "katex";
import "katex/dist/katex.min.css";

export type StemFigureVisual = {
  kind: "TEX_FIGURE";
  figureId: string;
  altText: string;
  caption: string | null;
  status?: "QUEUED" | "RENDERING" | "REPAIRING" | "SUCCEEDED" | "NEEDS_REVIEW" | "FAILED";
  previewSvg?: string;
  assetUrl?: string | null;
  lastErrorCategory?: string | null;
};

export function StemFigure({
  visual,
  displaySize = "default",
}: {
  visual: StemFigureVisual;
  showStatus?: boolean;
  displaySize?: "default" | "textbook-source";
}) {
  const imageUrl = visual.assetUrl || toSvgDataUrl(visual.previewSvg);
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
    <figure className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <img
        alt={visual.altText}
        className={
          displaySize === "textbook-source"
            ? "mx-auto block h-auto w-fit max-h-64 max-w-full object-contain"
            : "mx-auto block h-auto max-h-[34rem] w-auto max-w-full object-contain"
        }
        decoding="async"
        loading="lazy"
        src={imageUrl}
      />
      {visual.caption ? (
        <figcaption className="mt-3 text-center text-sm font-medium leading-6 text-slate-600">
          <StemFigureMathText value={visual.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}

export function StemFigureMathText({ value }: { value: string }) {
  return tokenizeMathText(value).map((token, index) =>
    token.type === "text" ? (
      <span key={`text-${index}`}>{token.value}</span>
    ) : (
      <span
        key={`math-${index}`}
        className={token.display ? "my-2 block overflow-x-auto py-1" : "inline"}
        dangerouslySetInnerHTML={{
          __html: renderMath(token.latex, token.display),
        }}
      />
    ),
  );
}

function renderMath(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex, {
      displayMode,
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
