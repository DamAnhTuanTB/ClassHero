"use client";

import { Code2, FileImage, LoaderCircle, Play, Save } from "lucide-react";
import { readStemFigureDisplayScale } from "@learning-path/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import {
  StemFigureSourceActions,
  type StemFigureSourceActionsHandle,
} from "@/components/admin/stem-figures/stem-figure-source-actions";
import {
  useApplyAdminStemFigureDraft,
  useCompileAdminStemFigureDraft,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import { StemFigureCompileErrorPanel } from "@/features/admin/ai-generation/components/stem-figure-compile-error-panel";
import { StemFigureCodeEditor } from "@/features/admin/ai-generation/components/stem-figure-code-editor";
import type {
  AdminStemFigure,
  AdminStemFigureCompileResult,
  AdminStemFigureDiagnosticBatch,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getStemFigureDraftDisplayPercent } from "@/lib/stem-figure-display";
import {
  addStemFigureCircleCenterLabel,
  createStemFigureQuickAngle,
  type StemFigureMidpointAction,
  type StemFigureQuickAngleInput,
  type StemFigureQuickAngleRemovalInput,
  type StemFigureQuickCircleCenterInput,
  type StemFigureQuickMidpointInput,
  type StemFigureQuickSegmentInput,
  type StemFigureSegmentAction,
  removeStemFigureQuickAngle,
  updateStemFigureMidpoint,
  updateStemFigureSegment,
} from "@/lib/stem-figure-geometry-actions";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import {
  applyStemFigureQuickAction,
  setStemFigureScalePercentage,
  type StemFigureQuickAction,
  type StemFigureScaleTarget,
  type StemFigureTextAdjustmentTarget,
  updateStemFigureTextSlot,
  updateStemFigureTextSlotAdjustment,
} from "@/lib/stem-figure-source-actions";

export function AdminStemFigureEditorDialog({
  figure,
  isOpen,
  lessonId,
  onCancel,
  onClose,
  mode = "edit",
}: {
  figure: AdminStemFigure;
  isOpen: boolean;
  lessonId: string;
  onCancel?: (latestFigure: AdminStemFigure) => void;
  onClose: () => void;
  mode?: "edit" | "create";
}) {
  const compileMutation = useCompileAdminStemFigureDraft(lessonId);
  const applyMutation = useApplyAdminStemFigureDraft(lessonId);
  const [result, setResult] = useState<AdminStemFigureCompileResult | null>(null);
  const [source, setSource] = useState(
    mode === "create" ? createStarterSource() : (figure.latexSource ?? ""),
  );
  const [caption, setCaption] = useState(figure.caption ?? "");
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [requestIssues, setRequestIssues] = useState<StemFigureCompileIssue[]>([]);
  const [quickHistory, setQuickHistory] = useState<string[]>([]);
  const openSessionKeyRef = useRef<string | null>(null);
  const sourceActionsRef = useRef<StemFigureSourceActionsHandle>(null);

  useEffect(() => {
    if (!isOpen) {
      openSessionKeyRef.current = null;
      return;
    }
    const openSessionKey = `${mode}:${figure.id}`;
    if (openSessionKeyRef.current === openSessionKey) return;
    openSessionKeyRef.current = openSessionKey;
    setSource(mode === "create" ? createStarterSource() : (figure.latexSource ?? ""));
    setCaption(figure.caption ?? "");
    setFocusLine(null);
    setRequestIssues([]);
    setResult(null);
    setQuickHistory([]);
  }, [figure.caption, figure.id, figure.latexSource, isOpen, mode]);

  const originalSource = mode === "create" ? "" : (figure.latexSource ?? "");
  const sourceChanged = source !== originalSource;
  const metadataChanged = caption !== (figure.caption ?? "");
  const previewSvg = result?.previewSvg ?? (!sourceChanged ? figure.previewSvg : null);
  const previewUrl = previewSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`
    : !sourceChanged
      ? figure.assetUrl
      : null;
  const pending = compileMutation.isPending || applyMutation.isPending;
  const previewDisplayPercent = getStemFigureDraftDisplayPercent(
    readStemFigureDisplayScale(source) ?? 1,
  );
  const compileIssues = result?.diagnosticBatch?.issues ?? requestIssues;
  const hasDraftErrors =
    (Boolean(result && result.status !== "DRAFT_READY") || requestIssues.length > 0) &&
    compileIssues.length > 0;

  function requestClose() {
    if (pending) return;
    closeNow("cancel");
  }

  function closeNow(reason: "cancel" | "commit" = "commit") {
    const latestFigure = resolveLatestDraftFigure(figure, result);
    compileMutation.reset();
    applyMutation.reset();
    setFocusLine(null);
    setRequestIssues([]);
    setResult(null);
    if (reason === "cancel" && onCancel) {
      onCancel(latestFigure);
      return;
    }
    onClose();
  }

  function invalidateCompiledDraft() {
    setFocusLine(null);
    setRequestIssues([]);
    setResult(null);
  }

  async function compileDraft(
    sourceOverride = source,
    successMessage = "Biên dịch hình thành công.",
  ) {
    if (!sourceOverride.trim()) {
      toast.error("Mã hình không được để trống.");
      return null;
    }
    setFocusLine(null);
    setRequestIssues([]);
    try {
      const compiled = await compileMutation.mutateAsync({
        figureId: figure.id,
        baseRevisionId: figure.currentRevisionId,
        sourceVersion: result?.sourceVersion ?? figure.sourceVersion,
        latexSource: sourceOverride,
        altText: figure.altText,
        caption: caption.trim() || null,
      });
      setResult(compiled);
      if (compiled.status === "DRAFT_READY") {
        toast.success(successMessage);
      } else {
        toast.warning("Mã hình chưa hợp lệ. Hãy xem các lỗi bên dưới và chỉnh lại.");
      }
      return compiled;
    } catch (error) {
      setRequestIssues(getDraftCompileIssues(error));
      toast.error("Biên dịch hình chưa thành công. Xem chi tiết ở khung bên phải.");
      return null;
    }
  }

  async function compileLatestDraft() {
    const textSlotWasCommitted =
      (await sourceActionsRef.current?.flushPendingChange()) ?? false;
    if (!textSlotWasCommitted) await compileDraft();
  }

  async function runQuickAction(action: StemFigureQuickAction) {
    const previousSource = source;
    const transformed = applyStemFigureQuickAction(previousSource, action);
    if (transformed.changedCount === 0) {
      toast.info("Không tìm thấy chi tiết phù hợp để chỉnh trong hình này.");
      return;
    }
    setSource(transformed.source);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      transformed.source,
      `Đã chỉnh ${transformed.changedCount} chi tiết và cập nhật hình xem trước.`,
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Thao tác không tạo được hình hợp lệ nên đã được hoàn tác.");
      return;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
  }

  async function addQuickAngle(input: StemFigureQuickAngleInput) {
    const previousSource = source;
    const transformed = createStemFigureQuickAngle(previousSource, input);
    if (transformed.issue) {
      toast.warning(transformed.issue.message);
      return false;
    }
    setSource(transformed.source);
    invalidateCompiledDraft();
    const segmentMessage =
      transformed.addedSegments.length > 0
        ? `, tự nối ${transformed.addedSegments.join(", ")}`
        : "";
    const compiled = await compileDraft(
      transformed.source,
      `Đã ${transformed.replacedExisting ? "cập nhật" : "thêm"} ∠${transformed.canonicalAngle} = ${transformed.degrees}°${segmentMessage} và cập nhật hình xem trước.`,
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Góc mới không tạo được hình hợp lệ nên đã được hoàn tác.");
      return false;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
    return true;
  }

  async function addQuickCircleCenter(input: StemFigureQuickCircleCenterInput) {
    const previousSource = source;
    const transformed = addStemFigureCircleCenterLabel(previousSource, input);
    if (transformed.issue) {
      toast.warning(transformed.issue.message);
      return false;
    }
    setSource(transformed.source);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      transformed.source,
      transformed.replacedCenterName
        ? `Đã đổi tên tâm ${transformed.replacedCenterName} thành ${transformed.centerName} và cập nhật hình xem trước.`
        : `Đã thêm tên ${transformed.centerName} cho tâm đường tròn và cập nhật hình xem trước.`,
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Tên tâm mới không tạo được hình hợp lệ nên đã được hoàn tác.");
      return false;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
    return true;
  }

  async function removeQuickAngle(input: StemFigureQuickAngleRemovalInput) {
    const previousSource = source;
    const transformed = removeStemFigureQuickAngle(previousSource, input);
    if (transformed.issue) {
      toast.warning(transformed.issue.message);
      return false;
    }
    setSource(transformed.source);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      transformed.source,
      `Đã bỏ ∠${transformed.canonicalAngle}, xóa số đo và ký hiệu cung; giữ nguyên hai cạnh.`,
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Không bỏ được góc an toàn nên thay đổi đã được hoàn tác.");
      return false;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
    return true;
  }

  async function updateQuickSegment(
    action: StemFigureSegmentAction,
    input: StemFigureQuickSegmentInput,
  ) {
    const previousSource = source;
    const transformed = updateStemFigureSegment(previousSource, input, action);
    if (transformed.issue) {
      toast.warning(transformed.issue.message);
      return false;
    }
    setSource(transformed.source);
    invalidateCompiledDraft();
    const actionLabel = action === "CONNECT" ? "nối" : "bỏ nối";
    const compiled = await compileDraft(
      transformed.source,
      `Đã ${actionLabel} đoạn ${transformed.canonicalSegment} và cập nhật hình xem trước.`,
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Thay đổi đoạn thẳng không hợp lệ nên đã được hoàn tác.");
      return false;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
    return true;
  }

  async function updateQuickMidpoint(
    action: StemFigureMidpointAction,
    input: StemFigureQuickMidpointInput,
  ) {
    const previousSource = source;
    const transformed = updateStemFigureMidpoint(previousSource, input, action);
    if (transformed.issue) {
      toast.warning(transformed.issue.message);
      return false;
    }
    setSource(transformed.source);
    invalidateCompiledDraft();
    const successMessage =
      action === "ADD"
        ? transformed.replacedMidpointName
          ? `Đã thay trung điểm ${transformed.replacedMidpointName} bằng ${transformed.midpointName} trên ${transformed.canonicalSegment}; giữ nguyên cạnh và marker bằng nhau.`
          : `Đã thêm trung điểm ${transformed.midpointName} trên ${transformed.canonicalSegment}${transformed.addedSegment ? `, tự nối ${transformed.canonicalSegment}` : ""} và cập nhật marker bằng nhau.`
        : `Đã xóa trung điểm ${transformed.midpointName} và marker trên ${transformed.canonicalSegment}; giữ nguyên đoạn thẳng.`;
    const compiled = await compileDraft(transformed.source, successMessage);
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Thay đổi trung điểm không hợp lệ nên đã được hoàn tác.");
      return false;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
    return true;
  }

  async function updateScale(target: StemFigureScaleTarget, percentage: number) {
    const previousSource = source;
    const transformed = setStemFigureScalePercentage(previousSource, target, percentage);
    if (transformed.changedCount === 0) return;
    setSource(transformed.source);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      transformed.source,
      `Đã cập nhật kích thước ${percentage}% và hình xem trước.`,
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Kích thước mới không tạo được hình hợp lệ nên đã được hoàn tác.");
      return;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
  }

  async function updateTextSlot(slotId: string, value: string) {
    const previousSource = source;
    const transformed = updateStemFigureTextSlot(previousSource, slotId, value);
    if (transformed.changedCount === 0) return;
    setSource(transformed.source);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      transformed.source,
      value.trim()
        ? "Đã cập nhật nội dung và hình xem trước."
        : "Đã xóa nội dung và cập nhật hình xem trước.",
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Nội dung mới không tạo được hình hợp lệ nên đã được hoàn tác.");
      return;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
  }

  async function updateTextSlotAdjustment(
    slotId: string,
    target: StemFigureTextAdjustmentTarget,
    value: number,
  ) {
    const previousSource = source;
    const transformed = updateStemFigureTextSlotAdjustment(
      previousSource,
      slotId,
      target,
      value,
    );
    if (transformed.changedCount === 0) return;
    setSource(transformed.source);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      transformed.source,
      "Đã tinh chỉnh nhãn và cập nhật hình xem trước.",
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(previousSource);
      invalidateCompiledDraft();
      toast.warning("Tinh chỉnh mới không tạo được hình hợp lệ nên đã được hoàn tác.");
      return;
    }
    setQuickHistory((history) => [...history.slice(-9), previousSource]);
  }

  async function undoQuickAction() {
    const previousSource = quickHistory.at(-1);
    if (!previousSource) return;
    const currentSource = source;
    setSource(previousSource);
    invalidateCompiledDraft();
    const compiled = await compileDraft(
      previousSource,
      "Đã hoàn tác và cập nhật hình xem trước.",
    );
    if (compiled?.status !== "DRAFT_READY") {
      setSource(currentSource);
      invalidateCompiledDraft();
      toast.warning("Chưa thể hoàn tác vì bản trước không biên dịch được.");
      return;
    }
    setQuickHistory((history) => history.slice(0, -1));
  }

  async function apply() {
    const normalizedCaption = caption.trim() || null;
    if (!sourceChanged && !result && figure.currentRevisionId) {
      if (!metadataChanged) {
        closeNow();
        return;
      }
      try {
        await applyMutation.mutateAsync({
          figureId: figure.id,
          baseRevisionId: figure.currentRevisionId,
          revisionId: figure.currentRevisionId,
          sourceVersion: figure.sourceVersion,
          altText: figure.altText,
          caption: normalizedCaption,
        });
        toast.success("Đã cập nhật thông tin hình.");
        closeNow();
      } catch (error) {
        toast.error(
          getUserFacingErrorMessage(error, "Chưa cập nhật được thông tin hình."),
        );
      }
      return;
    }
    const draft = result ?? (await compileDraft());
    if (!isApplicableDraft(draft)) {
      if (draft) {
        toast.error("Hình chưa biên dịch thành công nên chưa thể áp dụng.");
      }
      return;
    }
    try {
      await applyMutation.mutateAsync({
        figureId: figure.id,
        baseRevisionId: figure.currentRevisionId,
        revisionId: draft.revisionId,
        sourceVersion: draft.sourceVersion,
        altText: figure.altText,
        caption: normalizedCaption,
      });
      toast.success("Đã áp dụng hình mới.");
      closeNow();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa áp dụng được bản sửa."));
    }
  }

  return (
    <>
      <EditorDialogShell
        ariaLabel="Chỉnh sửa hình"
        isOpen={isOpen}
        onClose={requestClose}
        panelClassName="h-[calc(100dvh-2rem)] max-w-[96rem]"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 pr-20 sm:px-5">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {mode === "create" ? "Tạo mới hình bằng mã code" : "Chỉnh sửa hình"}
          </h2>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(22rem,1fr)_minmax(18rem,0.8fr)] overflow-hidden xl:grid-cols-2 xl:grid-rows-1">
          <section
            className="flex min-h-0 flex-col border-b border-[var(--theme-border)] xl:border-b-0 xl:border-r"
            data-testid="stem-figure-source-pane"
          >
            <div className="flex items-center border-b border-[var(--theme-border)] px-4 py-2">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
                <Code2 className="h-4 w-4" aria-hidden="true" /> Mã vẽ hình
              </h3>
            </div>
            <StemFigureSourceActions
              canUndo={quickHistory.length > 0}
              disabled={pending}
              onAction={(action) => void runQuickAction(action)}
              onQuickAngleAdd={addQuickAngle}
              onQuickAngleRemove={removeQuickAngle}
              onQuickCircleCenterAdd={addQuickCircleCenter}
              onQuickMidpointUpdate={updateQuickMidpoint}
              onQuickSegmentUpdate={updateQuickSegment}
              onScaleChange={updateScale}
              onTextSlotAdjustmentChange={updateTextSlotAdjustment}
              onTextSlotChange={updateTextSlot}
              onUndo={() => void undoQuickAction()}
              ref={sourceActionsRef}
              source={source}
            />
            <StemFigureCodeEditor
              focusLine={focusLine}
              issues={compileIssues}
              value={source}
              onChange={(value) => {
                setSource(value);
                invalidateCompiledDraft();
                setQuickHistory([]);
              }}
            />
            <div className="flex flex-col gap-3 border-t border-[var(--theme-border)] p-3">
              <label className="text-xs font-bold text-[var(--theme-text)]">
                Chú thích
                <input
                  className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-[var(--theme-surface-soft)]">
            <div className="flex items-center border-b border-[var(--theme-border)] px-4 py-2">
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Xem trước hình
              </h3>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white">
              {compileMutation.isPending ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="grid min-h-full flex-1 place-items-center bg-white p-6 text-center text-slate-700"
                >
                  <div>
                    <LoaderCircle
                      className="mx-auto h-9 w-9 animate-spin text-sky-600"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-extrabold">Đang biên dịch…</p>
                  </div>
                </div>
              ) : hasDraftErrors ? (
                <StemFigureCompileErrorPanel
                  issues={compileIssues}
                  onSelectIssue={(issue) => setFocusLine(issue.line)}
                />
              ) : previewUrl ? (
                <div className="grid min-h-full flex-1 place-items-center bg-white p-5">
                  <img
                    alt={caption.trim() || figure.altText}
                    className="object-contain transition-[width,height] duration-200 motion-reduce:transition-none"
                    data-testid="stem-figure-draft-preview-image"
                    src={previewUrl}
                    style={{
                      height: `${previewDisplayPercent}%`,
                      width: `${previewDisplayPercent}%`,
                    }}
                  />
                </div>
              ) : (
                <div className="grid min-h-full flex-1 place-items-center bg-white p-6 text-center text-slate-700">
                  <div>
                    <FileImage
                      className="mx-auto h-8 w-8 text-amber-500"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm font-bold">Chưa có bản xem trước</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Bấm Biên dịch để xem hình sau khi chỉnh sửa.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="theme-dialog-footer flex shrink-0 flex-wrap items-center justify-end gap-2 p-3 sm:p-4">
          <button
            type="button"
            className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-extrabold"
            disabled={pending}
            onClick={requestClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="theme-button-primary-subtle inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-extrabold"
            data-stem-figure-quick-actions-keep-open
            disabled={pending}
            onClick={() => void compileLatestDraft()}
          >
            <Play className="h-4 w-4" aria-hidden="true" /> Biên dịch
          </button>
          <button
            type="button"
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-extrabold"
            disabled={pending}
            onClick={apply}
          >
            <Save className="h-4 w-4" aria-hidden="true" /> Áp dụng
          </button>
        </footer>
      </EditorDialogShell>
    </>
  );
}

function isApplicableDraft(
  draft: AdminStemFigureCompileResult | null,
): draft is AdminStemFigureCompileResult & {
  sourceVersion: number;
  previewSvg: string;
} {
  return (
    draft?.status === "DRAFT_READY" &&
    typeof draft.sourceVersion === "number" &&
    Boolean(draft.previewSvg)
  );
}

function resolveLatestDraftFigure(
  figure: AdminStemFigure,
  result: AdminStemFigureCompileResult | null,
): AdminStemFigure {
  if (!result) return figure;
  return {
    ...figure,
    pendingRevisionId: result.revisionId,
    sourceVersion: result.sourceVersion ?? figure.sourceVersion,
  };
}

type StemFigureCompileIssue = AdminStemFigureDiagnosticBatch["issues"][number];

function getDraftCompileIssues(error: unknown): StemFigureCompileIssue[] {
  const fallbackIssue = createDraftCompileIssue({
    code: readStringField(error, "code") ?? "COMPILE_FAILED",
    message: getDraftCompileErrorMessage(error),
  });
  if (!isRecord(error)) return [fallbackIssue];

  if (isRecord(error.details) && Array.isArray(error.details.issues)) {
    const issues = error.details.issues
      .map((issue) => normalizeDraftCompileIssue(issue))
      .filter((issue): issue is StemFigureCompileIssue => issue !== null);
    return issues.length > 0 ? issues : [fallbackIssue];
  }

  if (Array.isArray(error.details)) {
    const issues = error.details.flatMap((detail) => {
      if (!isRecord(detail) || !Array.isArray(detail.messages)) return [];
      return detail.messages
        .filter((message): message is string => typeof message === "string")
        .map((message) => createDraftCompileIssue({ code: "VALIDATION_ERROR", message }));
    });
    return issues.length > 0 ? issues : [fallbackIssue];
  }

  return [fallbackIssue];
}

function normalizeDraftCompileIssue(value: unknown): StemFigureCompileIssue | null {
  if (!isRecord(value) || typeof value.message !== "string") return null;
  return createDraftCompileIssue({
    code: typeof value.code === "string" ? value.code : "COMPILE_FAILED",
    column: readNumberField(value, "column"),
    line: readNumberField(value, "line"),
    message: value.message,
    severity: value.severity === "WARNING" ? "WARNING" : "ERROR",
  });
}

function createDraftCompileIssue({
  code,
  column = null,
  line = null,
  message,
  severity = "ERROR",
}: {
  code: string;
  column?: number | null;
  line?: number | null;
  message: string;
  severity?: "ERROR" | "WARNING";
}): StemFigureCompileIssue {
  return {
    code,
    column,
    element: null,
    file: null,
    line,
    message,
    path: null,
    severity,
  };
}

function readStringField(value: unknown, field: string) {
  return isRecord(value) && typeof value[field] === "string" ? value[field] : null;
}

function readNumberField(value: Record<string, unknown>, field: string) {
  return typeof value[field] === "number" ? value[field] : null;
}

function getDraftCompileErrorMessage(error: unknown) {
  if (!isRecord(error) || error.code !== "VALIDATION_ERROR") {
    return getUserFacingErrorMessage(error, "Biên dịch hình chưa thành công.");
  }

  const fields = Array.isArray(error.details)
    ? error.details
        .map((detail) =>
          isRecord(detail) && typeof detail.field === "string" ? detail.field : null,
        )
        .filter((field): field is string => field !== null)
    : [];
  const labels = [
    ...new Set(fields.map((field) => DRAFT_VALIDATION_FIELD_LABELS[field])),
  ].filter((label): label is string => Boolean(label));

  return labels.length > 0
    ? `Không thể biên dịch: hãy kiểm tra ${labels.join(", ")}.`
    : "Không thể biên dịch vì dữ liệu hình chưa hợp lệ. Hãy tải lại trang rồi thử lại.";
}

const DRAFT_VALIDATION_FIELD_LABELS: Record<string, string> = {
  baseRevisionId: "phiên bản hình",
  sourceVersion: "phiên bản source",
  latexSource: "mã hình",
  caption: "chú thích",
};

function createStarterSource() {
  return [
    "\\begin{tikzpicture}[x=1cm,y=1cm,>=Latex]",
    "  % Viết mã vẽ hình tại đây",
    "\\end{tikzpicture}",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
