"use client";

import {
  Brush,
  Check,
  Eraser,
  Eye,
  LoaderCircle,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import {
  useApplyAdminStemFigureRasterEdit,
  usePreviewAdminStemFigureRasterEdit,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import {
  useStemFigureRasterMask,
  type StemFigureRasterBrushSize,
} from "@/features/admin/ai-generation/hooks/use-stem-figure-raster-mask";
import type {
  AdminStemFigure,
  AdminStemFigureRasterEditOperations,
  AdminStemFigureRasterEditPreview,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const PREVIEW_MAX_EDGE = 1_600;

export function AdminStemFigureRasterEditorDialog({
  figure,
  isOpen,
  lessonId,
  onClose,
}: {
  figure: AdminStemFigure;
  isOpen: boolean;
  lessonId: string;
  onClose: () => void;
}) {
  const previewMutation = usePreviewAdminStemFigureRasterEdit(lessonId);
  const applyMutation = useApplyAdminStemFigureRasterEdit(lessonId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoRemovalPreviewRef = useRef<(() => void) | null>(null);
  const latestPreviewKeyRef = useRef<string | null>(null);
  const [workingFigure, setWorkingFigure] = useState(figure);
  const [selectedTool, setSelectedTool] = useState<"ENHANCE" | "REMOVE" | null>(null);
  const [lastAppliedTool, setLastAppliedTool] = useState<"ENHANCE" | "REMOVE" | null>(
    null,
  );
  const [hasApplied, setHasApplied] = useState(false);
  const [brushSize, setBrushSize] = useState<StemFigureRasterBrushSize>("MEDIUM");
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [maskRevision, setMaskRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<"ORIGINAL" | "PREVIEW">("ORIGINAL");
  const [preview, setPreview] = useState<{
    key: string;
    data: AdminStemFigureRasterEditPreview;
  } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const enhance = selectedTool === "ENHANCE";
  const removeSimpleDetails = selectedTool === "REMOVE";
  const mask = useStemFigureRasterMask({
    brushSize,
    canvasRef,
    enabled: removeSimpleDetails && view === "ORIGINAL",
    height: canvasSize.height,
    width: canvasSize.width,
    onChange: () => {
      setMaskRevision((current) => current + 1);
      setView("ORIGINAL");
      setInlineError(null);
    },
  });
  const editKey = `${enhance}:${removeSimpleDetails}:${maskRevision}`;
  const previewIsFresh = preview?.key === editKey;
  const pending = previewMutation.isPending || applyMutation.isPending;
  const fitScale = Math.min(
    1,
    viewportSize.width / canvasSize.width,
    viewportSize.height / canvasSize.height,
  );
  const displayWidth = Math.max(1, Math.round(canvasSize.width * fitScale * zoom));
  const displayHeight = Math.max(1, Math.round(canvasSize.height * fitScale * zoom));

  useEffect(() => {
    if (!viewportElement || !isOpen) return;

    const measureViewport = () => {
      const styles = window.getComputedStyle(viewportElement);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const nextSize = {
        width: Math.max(1, viewportElement.clientWidth - horizontalPadding - 2),
        height: Math.max(1, viewportElement.clientHeight - verticalPadding - 2),
      };

      setViewportSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize,
      );
    };

    measureViewport();
    const observer = new ResizeObserver(measureViewport);
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, [isOpen, viewportElement]);

  useEffect(() => {
    if (maskRevision === 0) return;
    const timeout = window.setTimeout(() => autoRemovalPreviewRef.current?.(), 180);
    return () => window.clearTimeout(timeout);
  }, [maskRevision]);

  function operations(
    tool: "ENHANCE" | "REMOVE" | null = selectedTool,
  ): AdminStemFigureRasterEditOperations {
    return {
      enhance: tool === "ENHANCE",
      removeSimpleDetails: tool === "REMOVE",
      pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
    };
  }

  async function requestPreview({
    key,
    maskBlob,
    tool,
  }: {
    key: string;
    maskBlob: Blob | null;
    tool: "ENHANCE" | "REMOVE";
  }) {
    latestPreviewKeyRef.current = key;
    setInlineError(null);
    try {
      const data = await previewMutation.mutateAsync({
        figure: workingFigure,
        operations: operations(tool),
        mask: maskBlob,
      });
      if (latestPreviewKeyRef.current === key) {
        setPreview({ key, data });
        setView("PREVIEW");
      }
    } catch (error) {
      if (latestPreviewKeyRef.current === key) {
        const message = getUserFacingErrorMessage(error, "Chưa tạo được bản xem trước.");
        setInlineError(message);
        setView("ORIGINAL");
      }
    }
  }

  async function toggleEnhance() {
    if (enhance) {
      setSelectedTool(null);
      setView("ORIGINAL");
      setInlineError(null);
      return;
    }
    const key = `true:false:${maskRevision}`;
    setLastAppliedTool(null);
    setSelectedTool("ENHANCE");
    setView("ORIGINAL");
    await requestPreview({ key, maskBlob: null, tool: "ENHANCE" });
  }

  async function buildMask() {
    if (!removeSimpleDetails) return null;
    const blob = await mask.getMaskBlob();
    if (!blob) {
      setInlineError("Hãy tô vùng chi tiết cần xóa trên ảnh.");
      return undefined;
    }
    return blob;
  }

  async function createAutomaticRemovalPreview() {
    if (!removeSimpleDetails) return;
    if (!mask.hasMask) {
      latestPreviewKeyRef.current = null;
      setPreview(null);
      setView("ORIGINAL");
      setInlineError(null);
      return;
    }
    const maskBlob = await mask.getMaskBlob();
    if (!maskBlob) return;
    await requestPreview({ key: editKey, maskBlob, tool: "REMOVE" });
  }

  autoRemovalPreviewRef.current = () => void createAutomaticRemovalPreview();

  async function apply() {
    if (!previewIsFresh) {
      setInlineError("Hãy xem trước lại thay đổi mới nhất trước khi áp dụng.");
      return;
    }
    const maskBlob = await buildMask();
    if (maskBlob === undefined) return;
    const appliedTool = selectedTool;
    if (!appliedTool) return;
    setInlineError(null);
    try {
      const result = await applyMutation.mutateAsync({
        figure: workingFigure,
        operations: operations(),
        mask: maskBlob,
      });
      latestPreviewKeyRef.current = null;
      setWorkingFigure(result.figure);
      setSelectedTool(null);
      setPreview(null);
      setView("ORIGINAL");
      setLastAppliedTool(appliedTool);
      setHasApplied(true);
      if (appliedTool === "REMOVE") mask.clear();
      toast.success(
        appliedTool === "ENHANCE"
          ? "Đã áp dụng lượt làm nét ảnh."
          : "Đã áp dụng lượt xóa chi tiết thừa.",
      );
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "Chưa áp dụng được bản sửa.");
      setInlineError(message);
      toast.error(message);
    }
  }

  function requestClose() {
    if (!pending) onClose();
  }

  return (
    <EditorDialogShell
      ariaLabel="Chỉnh sửa ảnh sách giáo khoa"
      isOpen={isOpen}
      onClose={requestClose}
      panelClassName="h-[calc(100dvh-2rem)] max-w-[92rem]"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 pr-20 sm:px-5">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          Chỉnh sửa ảnh sách giáo khoa
        </h2>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--theme-text-muted)]">
            Công cụ
          </p>
          <div className="mt-3 space-y-2">
            <button
              aria-pressed={enhance}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-extrabold transition ${
                enhance
                  ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200"
                  : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-strong)] hover:bg-[var(--theme-surface-soft)]"
              }`}
              disabled={pending || removeSimpleDetails}
              onClick={() => void toggleEnhance()}
              type="button"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block">Làm nét ảnh</span>
                <span className="mt-0.5 block text-xs font-medium text-[var(--theme-text-muted)]">
                  Giảm nhiễu nhẹ, làm rõ đường nét
                </span>
              </span>
              {enhance ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>

            <button
              aria-pressed={removeSimpleDetails}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-extrabold transition ${
                removeSimpleDetails
                  ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-200"
                  : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-strong)] hover:bg-[var(--theme-surface-soft)]"
              }`}
              disabled={pending || enhance}
              onClick={() => {
                setLastAppliedTool(null);
                setSelectedTool((current) => (current === "REMOVE" ? null : "REMOVE"));
                setView("ORIGINAL");
                setInlineError(null);
              }}
              type="button"
            >
              <Eraser className="h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block">Xóa chi tiết thừa</span>
                <span className="mt-0.5 block text-xs font-medium text-[var(--theme-text-muted)]">
                  Tô chi tiết nhỏ trên nền phẳng
                </span>
              </span>
              {removeSimpleDetails ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : null}
            </button>
          </div>

          {removeSimpleDetails ? (
            <div className="mt-5 border-t border-[var(--theme-border)] pt-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
                <Brush className="h-4 w-4" aria-hidden="true" /> Cỡ cọ
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["SMALL", "MEDIUM", "LARGE"] as const).map((size) => (
                  <button
                    aria-pressed={brushSize === size}
                    className={`min-h-10 rounded-lg border px-2 text-xs font-bold ${
                      brushSize === size
                        ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                        : "border-[var(--theme-border)] text-[var(--theme-text)]"
                    }`}
                    key={size}
                    onClick={() => setBrushSize(size)}
                    type="button"
                  >
                    {size === "SMALL" ? "Nhỏ" : size === "MEDIUM" ? "Vừa" : "Lớn"}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  aria-label="Hoàn tác nét tô"
                  className="theme-button-neutral grid min-h-10 place-items-center rounded-lg disabled:opacity-40"
                  disabled={!mask.canUndo || pending}
                  onClick={mask.undo}
                  title="Hoàn tác"
                  type="button"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  aria-label="Làm lại nét tô"
                  className="theme-button-neutral grid min-h-10 place-items-center rounded-lg disabled:opacity-40"
                  disabled={!mask.canRedo || pending}
                  onClick={mask.redo}
                  title="Làm lại"
                  type="button"
                >
                  <Redo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  aria-label="Xóa toàn bộ vùng chọn"
                  className="theme-button-neutral grid min-h-10 place-items-center rounded-lg disabled:opacity-40"
                  disabled={!mask.hasMask || pending}
                  onClick={mask.clear}
                  title="Xóa vùng chọn"
                  type="button"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-0 flex-col bg-[var(--theme-surface-soft)]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border)] px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2">
              <button
                aria-pressed={view === "ORIGINAL"}
                className={`min-h-9 rounded-lg px-3 text-xs font-extrabold ${
                  view === "ORIGINAL"
                    ? "theme-button-primary-subtle"
                    : "theme-button-neutral"
                }`}
                onClick={() => setView("ORIGINAL")}
                type="button"
              >
                Ảnh gốc
              </button>
              <button
                aria-pressed={view === "PREVIEW"}
                className={`min-h-9 rounded-lg px-3 text-xs font-extrabold disabled:opacity-40 ${
                  view === "PREVIEW"
                    ? "theme-button-primary-subtle"
                    : "theme-button-neutral"
                }`}
                disabled={!previewIsFresh}
                onClick={() => setView("PREVIEW")}
                type="button"
              >
                Sau chỉnh sửa
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                aria-label="Thu nhỏ ảnh"
                className="theme-button-neutral grid h-9 w-9 place-items-center rounded-lg"
                disabled={zoom <= 0.75}
                onClick={() => setZoom((current) => Math.max(0.75, current - 0.25))}
                type="button"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-12 text-center text-xs font-bold text-[var(--theme-text)]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                aria-label="Phóng to ảnh"
                className="theme-button-neutral grid h-9 w-9 place-items-center rounded-lg"
                disabled={zoom >= 2}
                onClick={() => setZoom((current) => Math.min(2, current + 0.25))}
                type="button"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            ref={setViewportElement}
            className="relative min-h-0 flex-1 overflow-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-5"
            data-raster-editor-viewport
          >
            {previewMutation.isPending ? (
              <div className="absolute inset-0 z-20 grid place-items-center bg-[var(--theme-surface)]/75 backdrop-blur-sm">
                <div
                  className="text-center text-[var(--theme-text-strong)]"
                  role="status"
                >
                  <LoaderCircle
                    className="mx-auto h-9 w-9 animate-spin text-sky-600"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-extrabold">Đang tạo bản xem trước…</p>
                </div>
              </div>
            ) : null}
            <div className="mx-auto grid min-h-full place-items-center">
              <div
                className="relative box-content overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white shadow-sm"
                style={{
                  height: `${displayHeight}px`,
                  width: `${displayWidth}px`,
                }}
              >
                <div
                  className={view === "ORIGINAL" ? "relative h-full w-full" : "hidden"}
                >
                  <img
                    alt={workingFigure.altText}
                    className="block h-full w-full select-none"
                    draggable={false}
                    onLoad={(event) => {
                      const naturalWidth = event.currentTarget.naturalWidth;
                      const naturalHeight = event.currentTarget.naturalHeight;
                      const scale = Math.min(
                        1,
                        PREVIEW_MAX_EDGE / Math.max(naturalWidth, naturalHeight),
                      );
                      setCanvasSize({
                        width: Math.max(1, Math.round(naturalWidth * scale)),
                        height: Math.max(1, Math.round(naturalHeight * scale)),
                      });
                    }}
                    src={workingFigure.assetUrl ?? ""}
                  />
                  <canvas
                    ref={canvasRef}
                    aria-label="Vùng tô chi tiết cần xóa"
                    className={`absolute inset-0 h-full w-full ${
                      removeSimpleDetails
                        ? "cursor-crosshair touch-none"
                        : "pointer-events-none"
                    }`}
                    height={canvasSize.height}
                    width={canvasSize.width}
                    {...mask.bind}
                  />
                </div>
                {preview?.data.previewDataUrl ? (
                  <img
                    alt={`Bản xem trước: ${workingFigure.altText}`}
                    className={view === "PREVIEW" ? "block h-full w-full" : "hidden"}
                    src={preview.data.previewDataUrl}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-2 text-xs text-[var(--theme-text-muted)]">
            {inlineError ? (
              <p className="font-bold text-red-600 dark:text-red-300" role="alert">
                {inlineError}
              </p>
            ) : previewIsFresh ? (
              <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Eye className="h-4 w-4" aria-hidden="true" /> Bản xem trước đã sẵn sàng.
              </p>
            ) : removeSimpleDetails ? (
              <p>Tô lên chi tiết cần xóa; kết quả tự cập nhật sau mỗi nét.</p>
            ) : lastAppliedTool ? (
              <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" aria-hidden="true" />
                {lastAppliedTool === "ENHANCE"
                  ? "Đã áp dụng lượt làm nét. Có thể chọn công cụ tiếp theo."
                  : "Đã áp dụng lượt xóa chi tiết. Có thể chọn công cụ tiếp theo."}
              </p>
            ) : (
              <p>Chọn một công cụ để bắt đầu chỉnh ảnh.</p>
            )}
          </div>
        </section>
      </div>

      <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          disabled={pending}
          onClick={requestClose}
          type="button"
        >
          {hasApplied ? "Đóng" : "Hủy"}
        </button>
        <button
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-45 sm:w-auto"
          disabled={!previewIsFresh || pending}
          onClick={apply}
          type="button"
        >
          {applyMutation.isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Áp dụng
        </button>
      </footer>
    </EditorDialogShell>
  );
}
