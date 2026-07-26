"use client";

import { Check, Crop, Maximize2, RotateCcw, X } from "lucide-react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

type CropEdges = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type CropHandle = "e" | "move" | "n" | "ne" | "nw" | "s" | "se" | "sw" | "w";

const defaultCrop: CropEdges = {
  bottom: 0,
  left: 0,
  right: 0,
  top: 0,
};

const minImageWidthPercent = 20;
const maxImageWidthPercent = 100;
const minVisibleCropPercent = 10;
const cropHandles: Exclude<CropHandle, "move">[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export function QuizRichImageNodeView({
  deleteNode,
  editor,
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [naturalSize, setNaturalSize] = useState(() => ({
    height: readPositiveNumber(node.attrs.sourceHeight, 9),
    width: readPositiveNumber(node.attrs.sourceWidth, 16),
  }));
  const baseWidthPercent = readBoundedNumber(
    node.attrs.baseWidthPercent,
    minImageWidthPercent,
    maxImageWidthPercent,
    100,
  );
  const persistedWidth = readBoundedNumber(
    node.attrs.widthPercent,
    minImageWidthPercent,
    maxImageWidthPercent,
    100,
  );
  const [previewWidth, setPreviewWidth] = useState(persistedWidth);
  const persistedCrop = useMemo(
    () => readCropEdges(node.attrs),
    [
      node.attrs.cropBottom,
      node.attrs.cropLeft,
      node.attrs.cropRight,
      node.attrs.cropTop,
    ],
  );
  const [cropDraft, setCropDraft] = useState<CropEdges>(persistedCrop);
  const alignment = readImageAlignment(node.attrs.alignment);

  useEffect(() => {
    setPreviewWidth(persistedWidth);
  }, [persistedWidth]);

  useEffect(() => {
    if (!isCropping) {
      setCropDraft(persistedCrop);
    }
  }, [isCropping, persistedCrop]);

  const visibleWidth = Math.max(
    100 - persistedCrop.left - persistedCrop.right,
    minVisibleCropPercent,
  );
  const visibleHeight = Math.max(
    100 - persistedCrop.top - persistedCrop.bottom,
    minVisibleCropPercent,
  );
  const cropAspectRatio =
    (naturalSize.width * visibleWidth) / (naturalSize.height * visibleHeight);
  const imageStyle = isCropping
    ? ({
        height: "100%",
        inset: 0,
        width: "100%",
      } satisfies CSSProperties)
    : ({
        height: `${10000 / visibleHeight}%`,
        left: `${(-persistedCrop.left * 100) / visibleWidth}%`,
        top: `${(-persistedCrop.top * 100) / visibleHeight}%`,
        width: `${10000 / visibleWidth}%`,
      } satisfies CSSProperties);

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editor.isEditable) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const editorElement = viewportRef.current?.closest(".quiz-rich-content-prosemirror");
    if (!(editorElement instanceof HTMLElement)) {
      return;
    }

    const editorWidth = Math.max(editorElement.getBoundingClientRect().width, 1);
    const startX = event.clientX;
    const startWidth = previewWidth;
    const listeners = new AbortController();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaPercent =
        (((moveEvent.clientX - startX) / editorWidth) * 10_000) / baseWidthPercent;
      setPreviewWidth(
        readBoundedNumber(
          startWidth + deltaPercent,
          minImageWidthPercent,
          maxImageWidthPercent,
          startWidth,
        ),
      );
    };

    const finishResize = (upEvent: PointerEvent) => {
      const deltaPercent =
        (((upEvent.clientX - startX) / editorWidth) * 10_000) / baseWidthPercent;
      const nextWidth = readBoundedNumber(
        startWidth + deltaPercent,
        minImageWidthPercent,
        maxImageWidthPercent,
        startWidth,
      );
      setPreviewWidth(nextWidth);
      updateAttributes({ widthPercent: roundToSingleDecimal(nextWidth) });
      listeners.abort();
    };

    window.addEventListener("pointermove", handlePointerMove, {
      signal: listeners.signal,
    });
    window.addEventListener("pointerup", finishResize, {
      once: true,
      signal: listeners.signal,
    });
    window.addEventListener("pointercancel", () => listeners.abort(), {
      once: true,
      signal: listeners.signal,
    });
  };

  const beginCropInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    handle: CropHandle,
  ) => {
    if (!editor.isEditable || !viewportRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const bounds = viewportRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startCrop = { ...cropDraft };
    const listeners = new AbortController();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = ((moveEvent.clientX - startX) / Math.max(bounds.width, 1)) * 100;
      const deltaY = ((moveEvent.clientY - startY) / Math.max(bounds.height, 1)) * 100;

      setCropDraft(calculateCropFromPointer(startCrop, handle, deltaX, deltaY));
    };

    const finishInteraction = () => listeners.abort();

    window.addEventListener("pointermove", handlePointerMove, {
      signal: listeners.signal,
    });
    window.addEventListener("pointerup", finishInteraction, {
      once: true,
      signal: listeners.signal,
    });
    window.addEventListener("pointercancel", finishInteraction, {
      once: true,
      signal: listeners.signal,
    });
  };

  const saveCrop = () => {
    updateAttributes({
      cropBottom: roundToSingleDecimal(cropDraft.bottom),
      cropLeft: roundToSingleDecimal(cropDraft.left),
      cropRight: roundToSingleDecimal(cropDraft.right),
      cropTop: roundToSingleDecimal(cropDraft.top),
    });
    setIsCropping(false);
  };

  const resetCrop = () => {
    setCropDraft(defaultCrop);
  };

  const cancelCrop = () => {
    setCropDraft(persistedCrop);
    setIsCropping(false);
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={cn("quiz-rich-image-node", selected && "quiz-rich-image-node--selected")}
      contentEditable={false}
      data-alignment={alignment}
    >
      <div
        ref={viewportRef}
        className="quiz-rich-image-viewport"
        style={{
          aspectRatio: isCropping
            ? naturalSize.width / naturalSize.height
            : Number.isFinite(cropAspectRatio)
              ? cropAspectRatio
              : 16 / 9,
          width: `${(baseWidthPercent * previewWidth) / 100}%`,
        }}
      >
        {/* The editor stores arbitrary signed/public R2 URLs and needs natural dimensions for cropping. */}
        <img
          data-drag-handle={isCropping ? undefined : ""}
          src={typeof node.attrs.src === "string" ? node.attrs.src : ""}
          alt={typeof node.attrs.alt === "string" ? node.attrs.alt : ""}
          draggable={false}
          className="quiz-rich-image-media"
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
        {editor.isEditable && !isCropping ? (
          <>
            <div className="quiz-rich-image-actions">
              <button
                type="button"
                aria-label="Cắt xén ảnh"
                title="Cắt xén ảnh"
                onClick={() => {
                  setCropDraft(persistedCrop);
                  setIsCropping((current) => !current);
                }}
              >
                <Crop />
              </button>
              <button
                type="button"
                aria-label="Xóa ảnh"
                title="Xóa ảnh"
                onClick={deleteNode}
              >
                <X />
              </button>
            </div>
            <button
              type="button"
              aria-label="Kéo để đổi kích thước ảnh"
              title="Kéo để đổi kích thước ảnh"
              className="quiz-rich-image-resize-handle"
              onPointerDown={beginResize}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                  return;
                }
                event.preventDefault();
                const nextWidth = readBoundedNumber(
                  previewWidth + (event.key === "ArrowRight" ? 5 : -5),
                  minImageWidthPercent,
                  maxImageWidthPercent,
                  previewWidth,
                );
                setPreviewWidth(nextWidth);
                updateAttributes({ widthPercent: nextWidth });
              }}
            >
              <Maximize2 />
            </button>
            <span className="quiz-rich-image-size-label">
              {Math.round(previewWidth)}%
            </span>
          </>
        ) : null}
        {isCropping && editor.isEditable ? (
          <div className="quiz-rich-image-crop-overlay">
            <div
              className="quiz-rich-image-crop-frame"
              role="button"
              tabIndex={0}
              aria-label="Kéo để di chuyển vùng cắt ảnh"
              style={{
                bottom: `${cropDraft.bottom}%`,
                left: `${cropDraft.left}%`,
                right: `${cropDraft.right}%`,
                top: `${cropDraft.top}%`,
              }}
              onPointerDown={(event) => beginCropInteraction(event, "move")}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 5 : 1;
                const deltaX =
                  event.key === "ArrowLeft"
                    ? -step
                    : event.key === "ArrowRight"
                      ? step
                      : 0;
                const deltaY =
                  event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                if (deltaX === 0 && deltaY === 0) {
                  return;
                }
                event.preventDefault();
                setCropDraft((current) =>
                  calculateCropFromPointer(current, "move", deltaX, deltaY),
                );
              }}
            >
              <span className="quiz-rich-image-crop-grid-line quiz-rich-image-crop-grid-line--vertical-start" />
              <span className="quiz-rich-image-crop-grid-line quiz-rich-image-crop-grid-line--vertical-end" />
              <span className="quiz-rich-image-crop-grid-line quiz-rich-image-crop-grid-line--horizontal-start" />
              <span className="quiz-rich-image-crop-grid-line quiz-rich-image-crop-grid-line--horizontal-end" />
              {cropHandles.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  data-crop-handle={handle}
                  className="quiz-rich-image-crop-handle"
                  aria-label={cropHandleLabels[handle]}
                  title={cropHandleLabels[handle]}
                  onPointerDown={(event) => beginCropInteraction(event, handle)}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 5 : 1;
                    const deltaX =
                      event.key === "ArrowLeft"
                        ? -step
                        : event.key === "ArrowRight"
                          ? step
                          : 0;
                    const deltaY =
                      event.key === "ArrowUp"
                        ? -step
                        : event.key === "ArrowDown"
                          ? step
                          : 0;
                    if (deltaX === 0 && deltaY === 0) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    setCropDraft((current) =>
                      calculateCropFromPointer(current, handle, deltaX, deltaY),
                    );
                  }}
                />
              ))}
            </div>
            <div
              className="quiz-rich-image-crop-actions"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Hủy cắt ảnh"
                title="Hủy"
                onClick={cancelCrop}
              >
                <X />
              </button>
              <button
                type="button"
                aria-label="Đặt lại vùng cắt ảnh"
                title="Đặt lại"
                onClick={resetCrop}
              >
                <RotateCcw />
              </button>
              <button
                type="button"
                aria-label="Áp dụng vùng cắt ảnh"
                title="Áp dụng"
                className="quiz-rich-image-crop-action--primary"
                onClick={saveCrop}
              >
                <Check />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

function readImageAlignment(value: unknown) {
  return value === "left" || value === "right" ? value : "center";
}

function readCropEdges(attributes: Record<string, unknown>): CropEdges {
  const horizontal = normalizeCropPair(
    readBoundedNumber(attributes.cropLeft, 0, 100, 0),
    readBoundedNumber(attributes.cropRight, 0, 100, 0),
  );
  const vertical = normalizeCropPair(
    readBoundedNumber(attributes.cropTop, 0, 100, 0),
    readBoundedNumber(attributes.cropBottom, 0, 100, 0),
  );

  return {
    bottom: vertical.end,
    left: horizontal.start,
    right: horizontal.end,
    top: vertical.start,
  };
}

const cropHandleLabels: Record<Exclude<CropHandle, "move">, string> = {
  e: "Kéo cạnh phải vùng cắt",
  n: "Kéo cạnh trên vùng cắt",
  ne: "Kéo góc trên phải vùng cắt",
  nw: "Kéo góc trên trái vùng cắt",
  s: "Kéo cạnh dưới vùng cắt",
  se: "Kéo góc dưới phải vùng cắt",
  sw: "Kéo góc dưới trái vùng cắt",
  w: "Kéo cạnh trái vùng cắt",
};

function calculateCropFromPointer(
  startCrop: CropEdges,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
): CropEdges {
  if (handle === "move") {
    const width = 100 - startCrop.left - startCrop.right;
    const height = 100 - startCrop.top - startCrop.bottom;
    const left = clamp(startCrop.left + deltaX, 0, 100 - width);
    const top = clamp(startCrop.top + deltaY, 0, 100 - height);
    return {
      bottom: 100 - top - height,
      left,
      right: 100 - left - width,
      top,
    };
  }

  const nextCrop = { ...startCrop };
  if (handle.includes("w")) {
    nextCrop.left = clamp(
      startCrop.left + deltaX,
      0,
      100 - startCrop.right - minVisibleCropPercent,
    );
  }
  if (handle.includes("e")) {
    nextCrop.right = clamp(
      startCrop.right - deltaX,
      0,
      100 - startCrop.left - minVisibleCropPercent,
    );
  }
  if (handle.includes("n")) {
    nextCrop.top = clamp(
      startCrop.top + deltaY,
      0,
      100 - startCrop.bottom - minVisibleCropPercent,
    );
  }
  if (handle.includes("s")) {
    nextCrop.bottom = clamp(
      startCrop.bottom - deltaY,
      0,
      100 - startCrop.top - minVisibleCropPercent,
    );
  }
  return nextCrop;
}

function normalizeCropPair(start: number, end: number) {
  const maximumCrop = 100 - minVisibleCropPercent;
  const total = start + end;
  if (total <= maximumCrop) {
    return { end, start };
  }
  const ratio = maximumCrop / Math.max(total, 1);
  return {
    end: end * ratio,
    start: start * ratio,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function readPositiveNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
