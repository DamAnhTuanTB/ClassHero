"use client";

import { isAiReasoningEffort } from "@learning-path/shared";
import { Bot, Eye, EyeOff, ImageIcon, Loader2, Pencil, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { OptionField } from "@/components/common/forms/option-field";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { TextField } from "@/components/common/forms/text-field";
import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";
import { StemFigureMathText } from "@/components/common/content/stem-figure";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminStemFigureCurrentImagePreview } from "@/features/admin/ai-generation/components/admin-stem-figure-current-image-preview";
import { AdminStemFigureReferenceImagePreview } from "@/features/admin/ai-generation/components/admin-stem-figure-reference-image-preview";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import { usePreviewCreateNewAdminStemFigure } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminAiModelConfiguration,
  AdminStemFigure,
  AdminStemFigureAiTargetMode,
  AdminStemFigureCreateAiInput,
  AdminStemFigureCreateAiPreview,
  AdminStemFigureReferenceImageMode,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { replaceOpenAiRequestPrompts } from "@/features/admin/ai-generation/utils/openai-request-preview";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{
  value: AdminStemFigureReferenceImageMode;
  label: string;
  description: string;
}> = [
  {
    value: "SOURCE_CROP_ONLY",
    label: "Tạo mới lại",
    description: "Tạo lại từ ảnh gốc sách giáo khoa như lúc sinh kiến thức.",
  },
  {
    value: "CURRENT_ONLY",
    label: "Chỉnh sửa hình hiện tại",
    description:
      "Sửa tối thiểu code TikZ hiện tại theo yêu cầu và đối chiếu ảnh gốc sách giáo khoa.",
  },
];

const TARGET_MODE_OPTIONS: Array<{
  value: AdminStemFigureReferenceImageMode;
  label: string;
  description: string;
}> = [
  {
    value: "NONE",
    label: "Tạo mới lại",
    description: "Tạo lại từ nội dung của đúng phần đề bài hoặc lời giải hiện tại.",
  },
  {
    value: "CURRENT_ONLY",
    label: "Chỉnh sửa hình hiện tại",
    description:
      "Sửa tối thiểu code TikZ hiện tại theo yêu cầu và giữ nguyên phần không cần đổi.",
  },
];

type RequestPreviewTab = "system" | "user" | "input";
type PromptDisplayMode = "PREVIEW" | "MARKDOWN";

const REQUEST_PREVIEW_TABS: Array<{ value: RequestPreviewTab; label: string }> = [
  { value: "system", label: "Quy tắc hệ thống" },
  { value: "user", label: "Câu lệnh người dùng" },
  { value: "input", label: "Dữ liệu gửi đi" },
];

export function AdminStemFigureCreateAiDialog({
  blockPath,
  figureIndex,
  figure,
  initialAdminInstructions,
  initialMode,
  isCreating,
  isOpen,
  lessonId,
  modelConfiguration,
  targetMode,
  onClose,
  onCreate,
}: {
  blockPath?: string;
  figureIndex?: number;
  figure?: AdminStemFigure;
  initialAdminInstructions: string;
  initialMode: AdminStemFigureReferenceImageMode;
  isCreating: boolean;
  isOpen: boolean;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  targetMode?: AdminStemFigureAiTargetMode | null;
  onClose: () => void;
  onCreate: (input: AdminStemFigureCreateAiInput) => Promise<void>;
}) {
  const previewMutation = usePreviewCreateNewAdminStemFigure(lessonId);
  const mutatePreview = previewMutation.mutateAsync;
  const resetPreview = previewMutation.reset;
  const [isMounted, setIsMounted] = useState(false);
  const [isDataVisible, setIsDataVisible] = useState(false);
  const [requestPreviewTab, setRequestPreviewTab] = useState<RequestPreviewTab>("system");
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [adminInstructions, setAdminInstructions] = useState(initialAdminInstructions);
  const [model, setModel] = useState(() => resolveInitialModel(modelConfiguration));
  const [temperature, setTemperature] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [systemPromptOverride, setSystemPromptOverride] = useState<string | null>(null);
  const [userPromptOverride, setUserPromptOverride] = useState<string | null>(null);
  const [promptDisplayMode, setPromptDisplayMode] =
    useState<PromptDisplayMode>("PREVIEW");
  const [previewData, setPreviewData] = useState<AdminStemFigureCreateAiPreview | null>(
    null,
  );
  const [previewInputKey, setPreviewInputKey] = useState<string | null>(null);
  const [previewTransportKey, setPreviewTransportKey] = useState<string | null>(null);
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const dataSectionRef = useRef<HTMLElement>(null);
  const openSessionKeyRef = useRef<string | null>(null);
  const previewRequestSequenceRef = useRef(0);

  const refreshPreview = useCallback(
    async (input: AdminStemFigureCreateAiInput) => {
      const requestSequence = ++previewRequestSequenceRef.current;
      const inputKey = createPreviewInputKey(input);
      setIsPreviewPending(true);
      try {
        const data = await mutatePreview(input);
        if (requestSequence !== previewRequestSequenceRef.current) return null;
        setPreviewData(data);
        setPreviewInputKey(inputKey);
        setPreviewTransportKey(createPreviewTransportKey(input));
        return data;
      } catch {
        return null;
      } finally {
        if (requestSequence === previewRequestSequenceRef.current) {
          setIsPreviewPending(false);
        }
      }
    },
    [mutatePreview],
  );

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    if (!isOpen) {
      openSessionKeyRef.current = null;
      previewRequestSequenceRef.current += 1;
      return;
    }
    const openSessionKey = `${
      figure?.id ?? `block:${blockPath}:${figureIndex ?? 0}`
    }:${targetMode ?? "GENERIC"}`;
    if (openSessionKeyRef.current === openSessionKey) return;
    openSessionKeyRef.current = openSessionKey;
    const resolvedMode = resolveAvailableMode(figure, initialMode, targetMode);
    const initialModel = resolveInitialModel(modelConfiguration);
    setMode(resolvedMode);
    setAdminInstructions(initialAdminInstructions);
    setModel(initialModel);
    setTemperature(resolveInitialTemperature(modelConfiguration, initialModel));
    setReasoningEffort(resolveInitialReasoningEffort(modelConfiguration, initialModel));
    setSystemPromptOverride(null);
    setUserPromptOverride(null);
    setPromptDisplayMode("PREVIEW");
    setIsDataVisible(false);
    setRequestPreviewTab("system");
    setPreviewData(null);
    setPreviewInputKey(null);
    setPreviewTransportKey(null);
    resetPreview();
  }, [
    blockPath,
    figure?.id,
    figureIndex,
    initialAdminInstructions,
    initialMode,
    isOpen,
    modelConfiguration,
    resetPreview,
    targetMode,
  ]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCreating) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isCreating, isOpen, onClose]);
  useEffect(() => {
    if (!isDataVisible) return;
    dataSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isDataVisible]);

  const selectedModelInfo = modelConfiguration?.modelOptions.find(
    (option) => option.model === model,
  );
  const aiConfigurationCapability = selectedModelInfo?.capabilities?.aiConfiguration;
  const showTemperature =
    model !== "" && supportsTemperature(model, aiConfigurationCapability);
  const showReasoningEffort =
    model !== "" && supportsReasoningEffort(model, aiConfigurationCapability);
  const temperatureNumber = parseTemperature(temperature);
  const hasTemperatureError = showTemperature && temperatureNumber === null;
  const hasSystemPromptError =
    systemPromptOverride !== null && systemPromptOverride.trim().length === 0;
  const hasUserPromptError =
    userPromptOverride !== null && userPromptOverride.trim().length === 0;
  const currentInput = buildCreateInput({
    blockPath,
    figure,
    figureIndex,
    targetMode,
    mode,
    adminInstructions,
    model,
    temperature: showTemperature ? temperatureNumber : null,
    reasoningEffort: showReasoningEffort ? reasoningEffort : "",
    systemPromptOverride,
    userPromptOverride,
  });
  const currentPreviewInputKey = createPreviewInputKey(currentInput);
  const isDataStale = previewInputKey !== currentPreviewInputKey;
  const displayedSystemPrompt = systemPromptOverride ?? previewData?.systemPrompt ?? "";
  const displayedUserPrompt = userPromptOverride ?? previewData?.userPrompt ?? "";
  const displayedProviderInput = previewData
    ? buildDisplayedFigureProviderInput({
        providerInput: previewData.providerInput,
        previewSystemPrompt: previewData.systemPrompt,
        previewUserPrompt: previewData.userPrompt,
        systemPrompt: displayedSystemPrompt,
        userPrompt: displayedUserPrompt,
      })
    : null;
  const hasUnreflectedBriefChanges =
    previewData !== null &&
    previewTransportKey !== createPreviewTransportKey(currentInput);

  async function handleDataAction() {
    if (isDataVisible && !isDataStale) {
      setIsDataVisible(false);
      return;
    }
    setIsDataVisible(true);
    if (hasTemperatureError || hasSystemPromptError || hasUserPromptError) return;
    await refreshPreview(currentInput);
  }

  function resetForReferenceMode(nextMode: AdminStemFigureReferenceImageMode) {
    previewRequestSequenceRef.current += 1;
    setMode(nextMode);
    setAdminInstructions("");
    setIsDataVisible(false);
    setRequestPreviewTab("system");
    setPromptDisplayMode("PREVIEW");
    setSystemPromptOverride(null);
    setUserPromptOverride(null);
    setPreviewData(null);
    setPreviewInputKey(null);
    setPreviewTransportKey(null);
    setIsPreviewPending(false);
    resetPreview();
  }

  if (!isMounted || !isOpen) return null;
  const sourceReferenceImages = figure?.sourceReferenceImages ?? [];
  const hasSource = sourceReferenceImages.length > 0;
  const usesFullPageFallback =
    hasSource && sourceReferenceImages.every((image) => image.source === "PDF_PAGE");
  const canEditCurrent =
    Boolean(figure?.hasCurrentAsset) && figure?.currentAssetKind === "AI_TEX";
  const visibleModeOptions = (targetMode ? TARGET_MODE_OPTIONS : MODE_OPTIONS).filter(
    (option) =>
      option.value === "NONE" ||
      (option.value === "SOURCE_CROP_ONLY" && hasSource) ||
      (option.value === "CURRENT_ONLY" && canEditCurrent),
  );
  const selectedReferenceImages =
    mode === "SOURCE_CROP_ONLY" || mode === "CURRENT_ONLY" ? sourceReferenceImages : [];
  const dialogTitle = targetMode
    ? targetMode === "QUESTION"
      ? "Tạo hình cho đề bài"
      : "Tạo hình cho lời giải"
    : mode === "CURRENT_ONLY"
      ? "Chỉnh sửa hình bằng AI"
      : "Tạo mới hình bằng AI";
  const submitLabel =
    mode === "CURRENT_ONLY"
      ? isCreating
        ? "Đang chỉnh sửa"
        : "Chỉnh sửa hình"
      : isCreating
        ? "Đang tạo"
        : "Tạo mới";

  return createPortal(
    <div className="theme-dialog-overlay fixed inset-0 z-[80] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6">
      <button
        aria-label="Đóng modal tạo hình bằng AI"
        className="absolute inset-0 cursor-default"
        disabled={isCreating}
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={dialogTitle}
        aria-modal="true"
        className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
        role="dialog"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
              {dialogTitle}
            </h2>
            <p className="line-clamp-1 text-xs text-[var(--theme-text-muted)]">
              <StemFigureMathText
                value={
                  figure?.caption ??
                  (targetMode === "QUESTION"
                    ? "Sinh một hình mới từ nội dung đề hiện tại"
                    : targetMode === "SOLUTION"
                      ? "Tạo một hình hoàn chỉnh mới từ đề bài và lời giải"
                      : "Tạo một phiên bản hình mới cho khối này")
                }
              />
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            disabled={isCreating}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <fieldset>
            <legend className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              1. Cách tạo hình
            </legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {visibleModeOptions.map((option) => {
                const isFullPageFallback =
                  option.value === "SOURCE_CROP_ONLY" && usesFullPageFallback;
                return (
                  <label
                    className={`rounded-xl border p-4 ${
                      mode === option.value
                        ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                        : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
                    } cursor-pointer`}
                    key={option.value}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        checked={mode === option.value}
                        className="mt-1"
                        disabled={isCreating}
                        name="reference-image-mode"
                        onChange={() => {
                          if (mode === option.value) return;
                          resetForReferenceMode(option.value);
                        }}
                        type="radio"
                        value={option.value}
                      />
                      <span>
                        <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                          {isFullPageFallback
                            ? "Mathpix chưa trả được crop đúng hình; dùng trang nguồn mà Phase 1 đã tham chiếu."
                            : option.description}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {mode === "NONE" ? (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
                {targetMode === "QUESTION"
                  ? "AI sẽ tạo hình đề bài chỉ từ nội dung đề hiện tại, không dùng lời giải hoặc đáp án."
                  : targetMode === "SOLUTION"
                    ? "AI sẽ tạo một hình lời giải hoàn chỉnh và độc lập, ưu tiên lời giải rồi dùng đề bài làm bối cảnh."
                    : "Khối này chưa có ảnh tham chiếu. AI sẽ tạo hình mới từ nội dung khối. Với Ví dụ/Bài tập, AI ưu tiên lời giải và dựng một hình hoàn chỉnh, độc lập."}
              </div>
            ) : null}
            {mode === "CURRENT_ONLY" && figure?.hasCurrentAsset ? (
              <AdminStemFigureCurrentImagePreview figure={figure} />
            ) : null}
          </fieldset>

          <section>
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              2. Cấu hình AI
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <OptionField
                id="stem-figure-create-model"
                label="Model"
                value={model}
                options={[
                  ...(modelConfiguration?.isDefaultConfigured
                    ? [{ value: "", label: "Tự động theo Cài đặt AI" }]
                    : []),
                  ...(modelConfiguration?.modelOptions ?? []).map((option) => ({
                    value: option.model,
                    label: `${formatProvider(option.provider)} · ${option.model}${
                      option.available ? "" : " · Chưa khả dụng"
                    }`,
                    disabled: !option.available,
                  })),
                ]}
                icon={null}
                disabled={isCreating}
                onChange={(value) => {
                  setModel(value);
                  setTemperature(resolveModelTemperature(modelConfiguration, value));
                  setReasoningEffort(
                    resolveModelReasoningEffort(modelConfiguration, value),
                  );
                }}
              />
              {showTemperature ? (
                <TextField
                  id="stem-figure-create-temperature"
                  label="Temperature"
                  value={temperature}
                  inputMode="decimal"
                  icon={null}
                  disabled={isCreating}
                  error={
                    hasTemperatureError
                      ? {
                          type: "validate",
                          message: "Nhập số từ 0 đến 1, tối đa 2 chữ số thập phân",
                        }
                      : undefined
                  }
                  onChange={(event) => setTemperature(event.currentTarget.value)}
                />
              ) : showReasoningEffort ? (
                <OptionField
                  id="stem-figure-create-reasoning-effort"
                  label="Reasoning Effort"
                  value={reasoningEffort}
                  options={buildReasoningOptions(selectedModelInfo)}
                  icon={null}
                  disabled={isCreating}
                  onChange={(value) => {
                    if (value === "" || isAiReasoningEffort(value)) {
                      setReasoningEffort(value);
                    }
                  }}
                />
              ) : (
                <div className="hidden sm:block" aria-hidden="true" />
              )}
            </div>
          </section>

          <section>
            <TextareaField
              id="stem-figure-create-admin-instructions"
              label="3. Yêu cầu cho hình mới"
              isOptional
              optionalLabel="Không bắt buộc"
              className="min-h-28"
              disabled={isCreating}
              maxLength={2000}
              onChange={(event) => setAdminInstructions(event.target.value)}
              placeholder={
                hasSource
                  ? "Ví dụ: Giữ nguyên bố cục nguồn, sửa vị trí nhãn để không chồng nét và bảo đảm đúng nét khuất."
                  : "Ví dụ: Làm nổi bật bước dựng chính, giữ nhãn ngắn gọn và dễ đọc."
              }
              value={adminInstructions}
            />
            <p className="mt-1 text-right text-xs text-[var(--theme-text-muted)]">
              {adminInstructions.length.toLocaleString("vi-VN")}/2.000 ký tự
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
              <ImageIcon
                className="h-4 w-4 text-[var(--theme-primary)]"
                aria-hidden="true"
              />
              4. Ảnh sẽ gửi kèm
            </h3>
            {selectedReferenceImages.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {selectedReferenceImages.map((image) => (
                  <article
                    className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
                    key={image.objectKey}
                  >
                    <AdminStemFigureReferenceImagePreview
                      accessUrl={image.accessUrl}
                      label={image.label}
                    />
                    <div className="border-t border-[var(--theme-border)] p-3 text-xs text-[var(--theme-text-muted)]">
                      <p className="font-extrabold text-[var(--theme-text-strong)]">
                        {image.label}
                      </p>
                      <p className="mt-1">
                        {"source" in image && image.source === "PDF_PAGE"
                          ? "Trang sách giáo khoa dự phòng"
                          : "Ảnh sách giáo khoa"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 text-center text-sm text-[var(--theme-text-muted)]">
                {targetMode === "QUESTION"
                  ? "Không gửi ảnh kèm. AI chỉ dùng nội dung đề bài để dựng hình."
                  : "Không gửi ảnh kèm. AI sẽ dựng hình độc lập dựa trên lời giải và dùng đề bài làm bối cảnh."}
              </div>
            )}
          </section>

          {isDataVisible ? (
            <section ref={dataSectionRef}>
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                5. Thống kê và dữ liệu gửi đi
              </h3>
              <div className="mt-3 space-y-3">
                {isPreviewPending && isDataStale ? (
                  <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Đang tải dữ liệu...
                  </div>
                ) : previewMutation.error && isDataStale ? (
                  <p className="m-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                    {getUserFacingErrorMessage(
                      previewMutation.error,
                      "Không tải được dữ liệu xem trước.",
                    )}
                  </p>
                ) : displayedProviderInput && previewData ? (
                  <>
                    <AdminAiRequestStatistics
                      details={buildFigureRequestStatistics(previewData, () =>
                        setIsInputBreakdownDialogOpen(true),
                      )}
                      estimatedCost={previewData.estimatedCost}
                      note="Token ảnh được ước tính theo số ảnh và mức detail trước khi gửi; usage provider sau khi xử lý mới là số thực tế."
                    />
                    <div className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
                      <div
                        aria-label="Dữ liệu gửi đến model"
                        className="grid grid-cols-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
                        role="tablist"
                      >
                        {REQUEST_PREVIEW_TABS.map((tab) => (
                          <button
                            aria-selected={requestPreviewTab === tab.value}
                            className={`min-h-10 rounded-lg px-2 text-xs font-extrabold transition sm:text-sm ${
                              requestPreviewTab === tab.value
                                ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]"
                            }`}
                            key={tab.value}
                            onClick={() => setRequestPreviewTab(tab.value)}
                            role="tab"
                            type="button"
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <div
                        aria-label={
                          REQUEST_PREVIEW_TABS.find(
                            (tab) => tab.value === requestPreviewTab,
                          )?.label
                        }
                        role="tabpanel"
                      >
                        {requestPreviewTab === "input" ? (
                          <div aria-label="Dữ liệu gửi đến OpenAI" role="region">
                            <p className="border-b border-[var(--theme-border)] px-4 py-3 text-xs font-bold text-[var(--theme-text-muted)]">
                              Request Responses API theo đúng field thực tế; chỉ dữ liệu
                              ảnh base64 được thay bằng placeholder.
                            </p>
                            {hasUnreflectedBriefChanges ? (
                              <p className="m-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                                Yêu cầu admin đã thay đổi. Bấm “Cập nhật dữ liệu” để xem
                                request chính xác mới nhất.
                              </p>
                            ) : (
                              <AdminAiJsonInputViewer data={displayedProviderInput} />
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2">
                              <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                                Nội dung này được gửi nguyên văn đến model
                              </p>
                              <div
                                aria-label="Chế độ hiển thị prompt"
                                className="ml-auto flex items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1"
                              >
                                <button
                                  aria-pressed={promptDisplayMode === "PREVIEW"}
                                  className={cn(
                                    "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold transition",
                                    promptDisplayMode === "PREVIEW"
                                      ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                                      : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                                  )}
                                  onClick={() => setPromptDisplayMode("PREVIEW")}
                                  type="button"
                                >
                                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                  Xem trước
                                </button>
                                <button
                                  aria-pressed={promptDisplayMode === "MARKDOWN"}
                                  className={cn(
                                    "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold transition",
                                    promptDisplayMode === "MARKDOWN"
                                      ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                                      : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                                  )}
                                  onClick={() => setPromptDisplayMode("MARKDOWN")}
                                  type="button"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  Chỉnh sửa
                                </button>
                              </div>
                            </div>
                            {promptDisplayMode === "PREVIEW" ? (
                              <AdminAiPromptContentPreview
                                content={
                                  requestPreviewTab === "system"
                                    ? displayedSystemPrompt
                                    : displayedUserPrompt
                                }
                                kind={requestPreviewTab}
                              />
                            ) : (
                              <TextareaField
                                id={`stem-figure-${requestPreviewTab}-prompt`}
                                label={
                                  requestPreviewTab === "system"
                                    ? "Markdown gốc — Quy tắc hệ thống"
                                    : "Markdown gốc — Câu lệnh người dùng"
                                }
                                wrapperClassName="p-3"
                                className="min-h-64 font-mono text-xs leading-5"
                                maxLength={30_000}
                                value={
                                  requestPreviewTab === "system"
                                    ? displayedSystemPrompt
                                    : displayedUserPrompt
                                }
                                error={
                                  requestPreviewTab === "system" && hasSystemPromptError
                                    ? {
                                        type: "validate",
                                        message: "Quy tắc hệ thống không được để trống",
                                      }
                                    : requestPreviewTab === "user" && hasUserPromptError
                                      ? {
                                          type: "validate",
                                          message:
                                            "Câu lệnh người dùng không được để trống",
                                        }
                                      : undefined
                                }
                                onChange={(event) => {
                                  if (requestPreviewTab === "system") {
                                    setSystemPromptOverride(event.currentTarget.value);
                                  } else {
                                    setUserPromptOverride(event.currentTarget.value);
                                  }
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Đang tải dữ liệu...
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="theme-dialog-footer flex shrink-0 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            aria-expanded={isDataVisible}
            className="theme-button-primary-subtle flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
            disabled={
              isCreating ||
              isPreviewPending ||
              hasTemperatureError ||
              hasSystemPromptError ||
              hasUserPromptError
            }
            onClick={() => void handleDataAction()}
            type="button"
          >
            {isDataVisible && !isDataStale ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {isDataVisible
              ? isDataStale
                ? "Cập nhật dữ liệu"
                : "Ẩn dữ liệu"
              : "Xem dữ liệu"}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="theme-button-neutral min-h-11 rounded-lg px-5 text-sm font-extrabold"
              disabled={isCreating}
              onClick={onClose}
              type="button"
            >
              Hủy
            </button>
            <button
              className="theme-button-primary flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
              disabled={
                isCreating ||
                hasTemperatureError ||
                hasSystemPromptError ||
                hasUserPromptError
              }
              onClick={() => void onCreate(currentInput)}
              type="button"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Bot className="h-4 w-4" aria-hidden="true" />
              )}
              {submitLabel}
            </button>
          </div>
        </footer>
      </section>

      {previewData?.context?.tokenBreakdown ? (
        <AdminPromptInputBreakdownDialog
          breakdown={previewData.context.tokenBreakdown}
          isOpen={isInputBreakdownDialogOpen}
          onClose={() => setIsInputBreakdownDialogOpen(false)}
        />
      ) : null}
    </div>,
    document.body,
  );
}

function resolveAvailableMode(
  figure: AdminStemFigure | undefined,
  requested: AdminStemFigureReferenceImageMode,
  targetMode?: AdminStemFigureAiTargetMode | null,
): AdminStemFigureReferenceImageMode {
  if (!figure) return "NONE";
  const hasSource = figure.sourceReferenceImages.length > 0;
  const canEditCurrent = figure.hasCurrentAsset && figure.currentAssetKind === "AI_TEX";
  if (targetMode) {
    return requested === "CURRENT_ONLY" && canEditCurrent ? "CURRENT_ONLY" : "NONE";
  }
  if (requested === "SOURCE_CROP_ONLY" && hasSource) return requested;
  if (requested === "CURRENT_ONLY" && canEditCurrent) return requested;
  if (canEditCurrent) return "CURRENT_ONLY";
  if (hasSource) return "SOURCE_CROP_ONLY";
  return "NONE";
}

function createPreviewInputKey(input: AdminStemFigureCreateAiInput) {
  return JSON.stringify({
    target: input.figure
      ? { figureId: input.figure.id, sourceVersion: input.figure.sourceVersion }
      : { blockPath: input.blockPath, figureIndex: input.figureIndex ?? 0 },
    mode: input.referenceImageMode,
    targetMode: input.targetMode,
    adminInstructions: input.adminInstructions,
    model: input.model,
    temperature: input.temperature,
    reasoningEffort: input.reasoningEffort,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  });
}

function createPreviewTransportKey(input: AdminStemFigureCreateAiInput) {
  return JSON.stringify({
    target: input.figure
      ? { figureId: input.figure.id, sourceVersion: input.figure.sourceVersion }
      : { blockPath: input.blockPath, figureIndex: input.figureIndex ?? 0 },
    mode: input.referenceImageMode,
    targetMode: input.targetMode,
    adminInstructions: input.adminInstructions,
    model: input.model,
    temperature: input.temperature,
    reasoningEffort: input.reasoningEffort,
  });
}

function buildDisplayedFigureProviderInput(input: {
  providerInput: Record<string, unknown>;
  previewSystemPrompt: string;
  previewUserPrompt: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  return replaceOpenAiRequestPrompts(input.providerInput, {
    previewSystemPrompt: input.previewSystemPrompt,
    previewUserPrompt: input.previewUserPrompt,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  });
}

function buildCreateInput(input: {
  blockPath?: string;
  figure?: AdminStemFigure;
  figureIndex?: number;
  targetMode?: AdminStemFigureAiTargetMode | null;
  mode: AdminStemFigureReferenceImageMode;
  adminInstructions: string;
  model: string;
  temperature: number | null;
  reasoningEffort: string;
  systemPromptOverride: string | null;
  userPromptOverride: string | null;
}): AdminStemFigureCreateAiInput {
  const options = {
    referenceImageMode: input.mode,
    targetMode: input.targetMode ?? null,
    adminInstructions: input.adminInstructions.trim() || null,
    model: input.model || null,
    temperature: input.model ? input.temperature : null,
    reasoningEffort:
      input.model && isAiReasoningEffort(input.reasoningEffort)
        ? input.reasoningEffort
        : null,
    systemPrompt: input.systemPromptOverride?.trim() || null,
    userPrompt: input.userPromptOverride?.trim() || null,
  };
  if (input.figure) return { ...options, figure: input.figure };
  if (!input.blockPath) {
    throw new Error("Missing block path for new STEM figure");
  }
  return {
    ...options,
    blockPath: input.blockPath,
    figureIndex: input.figureIndex,
  };
}

function resolveInitialModel(configuration?: AdminAiModelConfiguration) {
  if (configuration?.isDefaultConfigured) return "";
  return (
    configuration?.resolvedModel ??
    configuration?.modelOptions.find((option) => option.available)?.model ??
    ""
  );
}

function resolveInitialTemperature(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  if (!model) return "";
  const selected = configuration?.modelOptions.find((option) => option.model === model);
  return supportsTemperature(model, selected?.capabilities?.aiConfiguration)
    ? String(configuration?.temperature ?? 0.1)
    : "";
}

function resolveInitialReasoningEffort(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  if (!model) return "";
  const selected = configuration?.modelOptions.find((option) => option.model === model);
  const configured = configuration?.reasoningEffort ?? "";
  return selected?.capabilities?.reasoningEffortLevels?.includes(configured)
    ? configured
    : "";
}

function resolveModelTemperature(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  if (!model) return "";
  const selected = configuration?.modelOptions.find((option) => option.model === model);
  if (!supportsTemperature(model, selected?.capabilities?.aiConfiguration)) return "";
  return selected?.model === configuration?.resolvedModel
    ? String(configuration?.temperature ?? 0.1)
    : "0.1";
}

function resolveModelReasoningEffort(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  if (!model) return "";
  const selected = configuration?.modelOptions.find((option) => option.model === model);
  const configured = configuration?.reasoningEffort ?? "";
  return selected?.model === configuration?.resolvedModel &&
    selected?.capabilities?.reasoningEffortLevels?.includes(configured)
    ? configured
    : "";
}

function parseTemperature(value: string) {
  const normalized = value.trim();
  if (!/^\d(?:\.\d{1,2})?$/u.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function buildReasoningOptions(
  model: AdminAiModelConfiguration["modelOptions"][number] | undefined,
) {
  return buildAiReasoningEffortOptions(model?.capabilities?.reasoningEffortLevels);
}

function buildFigureRequestStatistics(
  preview: AdminStemFigureCreateAiPreview,
  onTokenBreakdownClick?: () => void,
) {
  return [
    {
      label: "Model thực tế",
      value: preview.configuration.resolvedModel
        ? `${formatProvider(preview.configuration.resolvedProvider)} · ${preview.configuration.resolvedModel}`
        : "Chưa có model khả dụng",
    },
    ...(preview.configuration.reasoningEffort
      ? [
          {
            label: "Reasoning Effort",
            value: preview.configuration.reasoningEffort,
          },
        ]
      : preview.configuration.temperature !== null
        ? [
            {
              label: "Temperature",
              value: preview.configuration.temperature.toString(),
            },
          ]
        : []),
    {
      label: "Giới hạn đầu ra",
      value: `${preview.configuration.maxOutputTokens.toLocaleString("vi-VN")} token`,
    },
    {
      label: "Text input ước tính",
      value: `${preview.context.textInputTokens.toLocaleString("vi-VN")} token`,
      onClick: preview.context.tokenBreakdown ? onTokenBreakdownClick : undefined,
    },
    {
      label: "Ảnh input ước tính",
      value: `${preview.context.imageInputTokens.toLocaleString("vi-VN")} token`,
    },
    {
      label: "Tổng input ước tính",
      value: `${preview.context.estimatedTokens.toLocaleString("vi-VN")} token`,
    },
  ];
}

function formatProvider(provider: string | null) {
  if (!provider) return "Provider chưa xác định";
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider;
}
