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
import { StemFigureCodeEditor } from "@/features/admin/ai-generation/components/stem-figure-code-editor";
import type { AdminQuizFigure } from "@/features/admin/quiz/api/admin-quiz-api";
import { useAdminQuizFigureMutations } from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { useStableImageUrl } from "@/hooks/use-stable-image-url";
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
import {
  applyStemFigureQuickAction,
  setStemFigureScalePercentage,
  type StemFigureQuickAction,
  type StemFigureScaleTarget,
  type StemFigureTextAdjustmentTarget,
  updateStemFigureTextSlot,
  updateStemFigureTextSlotAdjustment,
} from "@/lib/stem-figure-source-actions";

export function AdminQuizFigureCodeDialog({
  figure,
  isOpen,
  mode,
  onClose,
  questionId,
  setId,
}: {
  figure: AdminQuizFigure;
  isOpen: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  questionId: string;
  setId: string;
}) {
  const mutations = useAdminQuizFigureMutations(setId);
  const [source, setSource] = useState("");
  const [caption, setCaption] = useState("");
  const [result, setResult] = useState<{
    previewSvg: string;
    revisionId: string;
    sourceVersion: number;
  } | null>(null);
  const [quickHistory, setQuickHistory] = useState<string[]>([]);
  const sourceActionsRef = useRef<StemFigureSourceActionsHandle>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSource(
      mode === "edit" && figure.currentRevision?.latexSource
        ? figure.currentRevision.latexSource
        : createQuizFigureStarterSource(),
    );
    setCaption(figure.currentRevision?.caption ?? "");
    setResult(null);
    setQuickHistory([]);
  }, [
    figure.currentRevision?.caption,
    figure.currentRevision?.latexSource,
    isOpen,
    mode,
  ]);

  const pending = mutations.compileDraft.isPending || mutations.applyDraft.isPending;
  const previewDisplayPercent = getStemFigureDraftDisplayPercent(
    readStemFigureDisplayScale(source) ?? 1,
  );

  const stablePublicUrl = useStableImageUrl(figure.currentRevision?.deliveryFile?.publicUrl);
  const previewUrl = result
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.previewSvg)}`
    : mode === "edit"
      ? stablePublicUrl
      : null;

  async function compile(
    sourceOverride = source,
    successMessage = "Biên dịch hình thành công.",
  ) {
    try {
      const compiled = await mutations.compileDraft.mutateAsync({
        questionId,
        figure,
        latexSource: sourceOverride,
        altText: figure.currentRevision?.altText ?? roleLabel(figure.role),
        caption: caption.trim() || null,
      });
      setResult(compiled);
      toast.success(successMessage);
      return compiled;
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Mã hình chưa biên dịch thành công."));
      return null;
    }
  }

  async function compileLatestDraft() {
    const textSlotWasCommitted =
      (await sourceActionsRef.current?.flushPendingChange()) ?? false;
    if (!textSlotWasCommitted) await compile();
  }

  async function runQuickAction(action: StemFigureQuickAction) {
    const previousSource = source;
    const transformed = applyStemFigureQuickAction(previousSource, action);
    if (transformed.changedCount === 0) {
      toast.info("Không tìm thấy chi tiết phù hợp để chỉnh trong hình này.");
      return;
    }
    setSource(transformed.source);
    setResult(null);
    const compiled = await compile(
      transformed.source,
      `Đã chỉnh ${transformed.changedCount} chi tiết và cập nhật hình xem trước.`,
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const segmentMessage =
      transformed.addedSegments.length > 0
        ? `, tự nối ${transformed.addedSegments.join(", ")}`
        : "";
    const compiled = await compile(
      transformed.source,
      `Đã ${transformed.replacedExisting ? "cập nhật" : "thêm"} ∠${transformed.canonicalAngle} = ${transformed.degrees}°${segmentMessage} và cập nhật hình xem trước.`,
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const compiled = await compile(
      transformed.source,
      transformed.replacedCenterName
        ? `Đã đổi tên tâm ${transformed.replacedCenterName} thành ${transformed.centerName} và cập nhật hình xem trước.`
        : `Đã thêm tên ${transformed.centerName} cho tâm đường tròn và cập nhật hình xem trước.`,
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const compiled = await compile(
      transformed.source,
      `Đã bỏ ∠${transformed.canonicalAngle}, xóa số đo và ký hiệu cung; giữ nguyên hai cạnh.`,
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const actionLabel = action === "CONNECT" ? "nối" : "bỏ nối";
    const compiled = await compile(
      transformed.source,
      `Đã ${actionLabel} đoạn ${transformed.canonicalSegment} và cập nhật hình xem trước.`,
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const successMessage =
      action === "ADD"
        ? transformed.replacedMidpointName
          ? `Đã thay trung điểm ${transformed.replacedMidpointName} bằng ${transformed.midpointName} trên ${transformed.canonicalSegment}; giữ nguyên cạnh và marker bằng nhau.`
          : `Đã thêm trung điểm ${transformed.midpointName} trên ${transformed.canonicalSegment}${transformed.addedSegment ? `, tự nối ${transformed.canonicalSegment}` : ""} và cập nhật marker bằng nhau.`
        : `Đã xóa trung điểm ${transformed.midpointName} và marker trên ${transformed.canonicalSegment}; giữ nguyên đoạn thẳng.`;
    const compiled = await compile(transformed.source, successMessage);
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const compiled = await compile(
      transformed.source,
      `Đã cập nhật kích thước ${percentage}% và hình xem trước.`,
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const compiled = await compile(
      transformed.source,
      value.trim()
        ? "Đã cập nhật nội dung và hình xem trước."
        : "Đã xóa nội dung và cập nhật hình xem trước.",
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const compiled = await compile(
      transformed.source,
      "Đã tinh chỉnh nhãn và cập nhật hình xem trước.",
    );
    if (!compiled) {
      setSource(previousSource);
      setResult(null);
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
    setResult(null);
    const compiled = await compile(
      previousSource,
      "Đã hoàn tác và cập nhật hình xem trước.",
    );
    if (!compiled) {
      setSource(currentSource);
      setResult(null);
      toast.warning("Chưa thể hoàn tác vì bản trước không biên dịch được.");
      return;
    }
    setQuickHistory((history) => history.slice(0, -1));
  }

  async function apply() {
    const compiled = result ?? (await compile());
    if (!compiled) return;
    try {
      await mutations.applyDraft.mutateAsync({
        questionId,
        figure,
        revisionId: compiled.revisionId,
        sourceVersion: compiled.sourceVersion,
      });
      toast.success(
        mode === "create" ? "Đã tạo hình bằng mã code." : "Đã áp dụng bản sửa hình.",
      );
      onClose();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa áp dụng được mã hình."));
    }
  }

  return (
    <EditorDialogShell
      ariaLabel={
        mode === "create" ? "Tạo mới hình bằng mã code" : "Chỉnh sửa hình bằng mã code"
      }
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="h-[calc(100dvh-2rem)] max-w-[96rem]"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 pr-20 sm:px-5">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          {mode === "create" ? "Tạo mới hình bằng mã code" : "Chỉnh sửa bằng mã code"}
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
            focusLine={null}
            issues={[]}
            value={source}
            onChange={(value) => {
              setSource(value);
              setResult(null);
              setQuickHistory([]);
            }}
          />
          <label className="border-t border-[var(--theme-border)] p-3 text-xs font-bold text-[var(--theme-text)]">
            Caption
            <input
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm"
              maxLength={500}
              value={caption}
              onChange={(event) => {
                setCaption(event.target.value);
                setResult(null);
              }}
            />
          </label>
        </section>

        <section className="flex min-h-0 flex-col bg-[var(--theme-surface-soft)]">
          <div className="border-b border-[var(--theme-border)] px-4 py-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
            Xem trước hình
          </div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-white p-5">
            {mutations.compileDraft.isPending ? (
              <div role="status" className="text-center text-slate-700">
                <LoaderCircle
                  className="mx-auto h-9 w-9 animate-spin text-sky-600"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-extrabold">Đang biên dịch…</p>
              </div>
            ) : previewUrl ? (
              <img
                alt={caption.trim() || roleLabel(figure.role)}
                className="object-contain transition-[width,height] duration-200 motion-reduce:transition-none"
                data-testid="stem-figure-draft-preview-image"
                src={previewUrl}
                style={{
                  height: `${previewDisplayPercent}%`,
                  width: `${previewDisplayPercent}%`,
                }}
              />
            ) : (
              <div className="text-center text-slate-600">
                <FileImage
                  className="mx-auto h-8 w-8 text-amber-500"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-bold">Bấm Biên dịch để xem hình</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="theme-dialog-footer grid shrink-0 grid-cols-3 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={pending}
          onClick={onClose}
          type="button"
        >
          Hủy
        </button>
        <button
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          data-stem-figure-quick-actions-keep-open
          disabled={pending}
          onClick={() => void compileLatestDraft()}
          type="button"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Biên dịch
        </button>
        <button
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          disabled={pending}
          onClick={() => void apply()}
          type="button"
        >
          <Save className="h-4 w-4" aria-hidden="true" /> Áp dụng
        </button>
      </footer>
    </EditorDialogShell>
  );
}

function createQuizFigureStarterSource() {
  return [
    "\\begin{tikzpicture}[line cap=round,line join=round]",
    "  \\draw[thick] (0,0) -- (4,0) -- (2,2.6) -- cycle;",
    "\\end{tikzpicture}",
  ].join("\n");
}

function roleLabel(role: AdminQuizFigure["role"]) {
  return role === "QUESTION" ? "Hình minh họa đề Quiz" : "Hình lời giải Quiz";
}
