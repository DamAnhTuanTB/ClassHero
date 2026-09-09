"use client";

import { isAiReasoningEffort } from "@learning-path/shared";
import { Bot, Eye, EyeOff, Loader2, Pencil, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { OptionField } from "@/components/common/forms/option-field";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { TextField } from "@/components/common/forms/text-field";
import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";
import { StemFigureMathText } from "@/components/common/content/stem-figure";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import type {
  AdminAiConfigurationCapability,
  AdminAiModelConfiguration,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type {
  AdminQuizAssessmentKind,
  AdminQuizFigure,
  AdminQuizFigureAiTargetMode,
  AdminQuizFigureCreateAiInput,
  AdminQuizFigureCreateAiPreview,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { useAdminQuizFigureMutations } from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { useStableImageUrl } from "@/hooks/use-stable-image-url";

type AiMode = AdminQuizFigureCreateAiInput["mode"];
type RequestPreviewTab = "system" | "user" | "input";
type PromptDisplayMode = "PREVIEW" | "MARKDOWN";

const MODE_OPTIONS: Array<{ value: AiMode; label: string; description: string }> = [
  {
    value: "REGENERATE",
    label: "Tạo mới lại",
    description: "Tạo lại từ nội dung và kế hoạch hình của câu Quiz hiện tại.",
  },
  {
    value: "EDIT_CURRENT",
    label: "Chỉnh sửa hình hiện tại",
    description:
      "Sửa tối thiểu code TikZ hiện tại theo yêu cầu và giữ nguyên phần không cần đổi.",
  },
];

const REQUEST_PREVIEW_TABS: Array<{ value: RequestPreviewTab; label: string }> = [
  { value: "system", label: "Quy tắc hệ thống" },
  { value: "user", label: "Câu lệnh người dùng" },
  { value: "input", label: "Dữ liệu gửi đi" },
];

export function AdminQuizFigureAiDialog({
  assessmentKind,
  figure: providedFigure,
  isOpen,
  onClose,
  questionId,
  questionFigure = null,
  setId,
  targetMode,
}: {
  assessmentKind: AdminQuizAssessmentKind;
  figure: AdminQuizFigure | null;
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionFigure?: AdminQuizFigure | null;
  setId: string;
  targetMode?: AdminQuizFigureAiTargetMode;
}) {
  const emptyFigure = useMemo(
    () => createEmptyFigure(targetMode ?? "QUESTION"),
    [targetMode],
  );
  const figure = providedFigure ?? emptyFigure;
  const mutations = useAdminQuizFigureMutations(setId, assessmentKind);
  const createMutation = targetMode
    ? mutations.createForQuestionWithAi
    : mutations.createWithAi;
  const previewMutation = targetMode
    ? mutations.previewForQuestionWithAi
    : mutations.previewWithAi;
  const previewForQuestionWithAi = mutations.previewForQuestionWithAi.mutateAsync;
  const previewWithAi = mutations.previewWithAi.mutateAsync;
  const mutatePreview = useCallback(
    (input: AdminQuizFigureCreateAiInput) =>
      targetMode
        ? previewForQuestionWithAi({
            questionId,
            targetMode,
            targetFigure: providedFigure,
            questionFigure,
            ...input,
          })
        : previewWithAi({
            questionId,
            figure,
            ...input,
          }),
    [
      figure,
      previewForQuestionWithAi,
      previewWithAi,
      providedFigure,
      questionFigure,
      questionId,
      targetMode,
    ],
  );

  const currentImageUrl = useStableImageUrl(
    providedFigure?.currentRevision?.deliveryFile?.publicUrl,
  );

  const resetPreview = previewMutation.reset;
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<AiMode>("REGENERATE");
  const [adminInstructions, setAdminInstructions] = useState("");
  const [modelConfiguration, setModelConfiguration] =
    useState<AdminAiModelConfiguration>();
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [systemPromptOverride, setSystemPromptOverride] = useState<string | null>(null);
  const [userPromptOverride, setUserPromptOverride] = useState<string | null>(null);
  const [isDataVisible, setIsDataVisible] = useState(false);
  const [requestPreviewTab, setRequestPreviewTab] = useState<RequestPreviewTab>("system");
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const [promptDisplayMode, setPromptDisplayMode] =
    useState<PromptDisplayMode>("PREVIEW");
  const [previewData, setPreviewData] = useState<AdminQuizFigureCreateAiPreview | null>(
    null,
  );
  const [previewInputKey, setPreviewInputKey] = useState<string | null>(null);
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const dataSectionRef = useRef<HTMLElement>(null);
  const previewSequenceRef = useRef(0);
  const initializedFigureRef = useRef<string | null>(null);

  const refreshPreview = useCallback(
    async (input: AdminQuizFigureCreateAiInput, revealData: boolean) => {
      const sequence = ++previewSequenceRef.current;
      setIsPreviewPending(true);
      try {
        const data = await mutatePreview(input);
        if (sequence !== previewSequenceRef.current) return null;
        setPreviewData(data);
        setPreviewInputKey(createPreviewInputKey(input));
        setModelConfiguration(data.configuration);
        if (initializedFigureRef.current !== figure.id) {
          initializedFigureRef.current = figure.id;
          const initialModel = resolveInitialModel(data.configuration);
          setModel(initialModel);
          setTemperature(resolveInitialTemperature(data.configuration, initialModel));
          setReasoningEffort(
            resolveInitialReasoningEffort(data.configuration, initialModel),
          );
        }
        if (revealData) setIsDataVisible(true);
        return data;
      } catch (error) {
        if (revealData) {
          toast.error(
            getUserFacingErrorMessage(error, "Không tải được dữ liệu xem trước."),
          );
        }
        return null;
      } finally {
        if (sequence === previewSequenceRef.current) setIsPreviewPending(false);
      }
    },
    [figure.id, mutatePreview],
  );

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    if (!isOpen) {
      initializedFigureRef.current = null;
      return;
    }
    setMode("REGENERATE");
    setAdminInstructions("");
    setModelConfiguration(undefined);
    setModel("");
    setTemperature("");
    setReasoningEffort("");
    setSystemPromptOverride(null);
    setUserPromptOverride(null);
    setIsDataVisible(false);
    setRequestPreviewTab("system");
    setPromptDisplayMode("PREVIEW");
    setPreviewData(null);
    setPreviewInputKey(null);
    resetPreview();
    void refreshPreview(emptyPreviewInput("REGENERATE"), false);
  }, [figure.id, isOpen, resetPreview]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !createMutation.isPending) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [createMutation.isPending, isOpen, onClose]);
  useEffect(() => {
    if (isDataVisible) {
      dataSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isDataVisible]);

  const selectedModelInfo = modelConfiguration?.modelOptions.find(
    (option) => option.model === model,
  );
  const capability = selectedModelInfo?.capabilities?.aiConfiguration;
  const showTemperature = model !== "" && supportsTemperature(model, capability);
  const showReasoningEffort = model !== "" && supportsReasoningEffort(model, capability);
  const temperatureNumber = parseTemperature(temperature);
  const hasTemperatureError = showTemperature && temperatureNumber === null;
  const hasSystemPromptError =
    systemPromptOverride !== null && systemPromptOverride.trim().length === 0;
  const hasUserPromptError =
    userPromptOverride !== null && userPromptOverride.trim().length === 0;
  const currentInput: AdminQuizFigureCreateAiInput = {
    mode,
    adminInstructions: adminInstructions.trim() || null,
    model: model || null,
    temperature: model && showTemperature ? temperatureNumber : null,
    reasoningEffort:
      model && showReasoningEffort && isAiReasoningEffort(reasoningEffort)
        ? reasoningEffort
        : null,
    systemPrompt: systemPromptOverride?.trim() || null,
    userPrompt: userPromptOverride?.trim() || null,
  };
  const isDataStale = previewInputKey !== createPreviewInputKey(currentInput);
  const displayedSystemPrompt = systemPromptOverride ?? previewData?.systemPrompt ?? "";
  const displayedUserPrompt = userPromptOverride ?? previewData?.userPrompt ?? "";
  const displayedProviderInput = previewData
    ? buildDisplayedProviderInput(
        previewData.providerInput,
        previewData.userPrompt,
        displayedSystemPrompt,
        displayedUserPrompt,
      )
    : null;
  const canEditCurrent = Boolean(
    providedFigure?.currentRevision?.sourceKind === "AI_TEX" &&
    providedFigure.currentRevision.latexSource?.trim() &&
    (!targetMode || targetMode === "QUESTION" || targetMode === "SOLUTION"),
  );

  async function handleDataAction() {
    if (isDataVisible && !isDataStale) {
      setIsDataVisible(false);
      return;
    }
    if (hasTemperatureError || hasSystemPromptError || hasUserPromptError) return;
    setIsDataVisible(true);
    await refreshPreview(currentInput, true);
  }

  async function create() {
    try {
      if (targetMode) {
        await mutations.createForQuestionWithAi.mutateAsync({
          questionId,
          targetMode,
          targetFigure: providedFigure,
          questionFigure,
          ...currentInput,
        });
      } else {
        await mutations.createWithAi.mutateAsync({
          questionId,
          figure,
          ...currentInput,
        });
      }
      toast.success(
        mode === "EDIT_CURRENT"
          ? "Đã bắt đầu chỉnh sửa hình Quiz hiện tại bằng AI."
          : `Đã bắt đầu ${targetMode ? targetModeLabel(targetMode).toLowerCase() : "tạo mới lại hình Quiz"} bằng AI.`,
      );
      onClose();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa tạo được hình mới bằng AI."));
    }
  }

  function changeMode(nextMode: AiMode) {
    if (nextMode === mode) return;
    previewSequenceRef.current += 1;
    setMode(nextMode);
    setAdminInstructions("");
    setSystemPromptOverride(null);
    setUserPromptOverride(null);
    setIsDataVisible(false);
    setPreviewData(null);
    setPreviewInputKey(null);
    resetPreview();
  }

  if (!isMounted || !isOpen) return null;

  return createPortal(
    <div className="theme-dialog-overlay fixed inset-0 z-[80] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6">
      <button
        aria-label="Đóng modal tạo hình bằng AI"
        className="absolute inset-0 cursor-default"
        disabled={createMutation.isPending}
        onClick={onClose}
        type="button"
      />
      <section
        aria-label="Tạo mới hình bằng AI"
        aria-modal="true"
        className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
        role="dialog"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
              {targetMode ? targetModeLabel(targetMode) : "Tạo mới hình bằng AI"}
            </h2>
            <p className="line-clamp-1 text-xs text-[var(--theme-text-muted)]">
              <StemFigureMathText
                value={
                  providedFigure?.currentRevision?.caption ??
                  (targetMode
                    ? targetModeDescription(targetMode)
                    : "Tạo một phiên bản hình mới cho câu Quiz")
                }
              />
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            disabled={createMutation.isPending}
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
              {MODE_OPTIONS.filter(
                (option) => option.value !== "EDIT_CURRENT" || canEditCurrent,
              ).map((option) => (
                <label
                  className={cn(
                    "cursor-pointer rounded-xl border p-4",
                    mode === option.value
                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                      : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)]",
                  )}
                  key={option.value}
                >
                  <span className="flex items-start gap-3">
                    <input
                      checked={mode === option.value}
                      className="mt-1"
                      disabled={createMutation.isPending}
                      name="quiz-figure-ai-mode"
                      onChange={() => changeMode(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span>
                      <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                        {option.description}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {mode === "EDIT_CURRENT" && currentImageUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white p-3">
                <img
                  alt={providedFigure!.currentRevision!.altText}
                  className="mx-auto max-h-72 w-full object-contain"
                  src={currentImageUrl}
                />
              </div>
            ) : null}
          </fieldset>

          <section>
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              2. Cấu hình AI
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <OptionField
                id="quiz-figure-create-model"
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
                disabled={createMutation.isPending || !modelConfiguration}
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
                  id="quiz-figure-create-temperature"
                  label="Temperature"
                  value={temperature}
                  inputMode="decimal"
                  icon={null}
                  disabled={createMutation.isPending}
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
                  id="quiz-figure-create-reasoning-effort"
                  label="Reasoning Effort"
                  value={reasoningEffort}
                  options={buildReasoningOptions(selectedModelInfo)}
                  icon={null}
                  disabled={createMutation.isPending}
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
              id={`quiz-figure-ai-instructions-${figure.id}`}
              label="3. Yêu cầu cho hình mới"
              isOptional
              optionalLabel="Không bắt buộc"
              className="min-h-28"
              disabled={createMutation.isPending}
              maxLength={2_000}
              onChange={(event) => setAdminInstructions(event.target.value)}
              placeholder="Ví dụ: Giữ nguyên bố cục, sửa vị trí nhãn để không chồng nét và bảo đảm cung góc nằm đúng miền."
              value={adminInstructions}
            />
            <p className="mt-1 text-right text-xs text-[var(--theme-text-muted)]">
              {adminInstructions.length.toLocaleString("vi-VN")}/2.000 ký tự
            </p>
          </section>

          {isDataVisible ? (
            <section ref={dataSectionRef}>
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                4. Thống kê và dữ liệu gửi đi
              </h3>
              <div className="mt-3 space-y-3">
                {isPreviewPending && isDataStale ? (
                  <LoadingPreview />
                ) : previewMutation.error && isDataStale ? (
                  <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                    {getUserFacingErrorMessage(
                      previewMutation.error,
                      "Không tải được dữ liệu xem trước.",
                    )}
                  </p>
                ) : displayedProviderInput && previewData ? (
                  <>
                    <AdminAiRequestStatistics
                      details={buildRequestStatistics(previewData, () =>
                        setIsInputBreakdownDialogOpen(true),
                      )}
                      estimatedCost={previewData.estimatedCost}
                      note="Usage provider sau khi xử lý mới là số thực tế."
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
                            className={cn(
                              "min-h-10 rounded-lg px-2 text-xs font-extrabold transition sm:text-sm",
                              requestPreviewTab === tab.value
                                ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                            )}
                            key={tab.value}
                            onClick={() => setRequestPreviewTab(tab.value)}
                            role="tab"
                            type="button"
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <div role="tabpanel">
                        {requestPreviewTab === "input" ? (
                          <div aria-label="Dữ liệu gửi đến OpenAI" role="region">
                            <p className="border-b border-[var(--theme-border)] px-4 py-3 text-xs font-bold text-[var(--theme-text-muted)]">
                              Request Responses API theo đúng field thực tế.
                            </p>
                            <AdminAiJsonInputViewer data={displayedProviderInput} />
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
                                <PromptModeButton
                                  active={promptDisplayMode === "PREVIEW"}
                                  icon={
                                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                  }
                                  label="Xem trước"
                                  onClick={() => setPromptDisplayMode("PREVIEW")}
                                />
                                <PromptModeButton
                                  active={promptDisplayMode === "MARKDOWN"}
                                  icon={
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  }
                                  label="Chỉnh sửa"
                                  onClick={() => setPromptDisplayMode("MARKDOWN")}
                                />
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
                                id={`quiz-figure-${requestPreviewTab}-prompt`}
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
                  <LoadingPreview />
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
              createMutation.isPending ||
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
              disabled={createMutation.isPending}
              onClick={onClose}
              type="button"
            >
              Hủy
            </button>
            <button
              className="theme-button-primary flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
              disabled={
                createMutation.isPending ||
                hasTemperatureError ||
                hasSystemPromptError ||
                hasUserPromptError
              }
              onClick={() => void create()}
              type="button"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Bot className="h-4 w-4" aria-hidden="true" />
              )}
              Tạo mới
            </button>
          </div>
        </footer>
      </section>

      {previewData?.context.tokenBreakdown ? (
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

function LoadingPreview() {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Đang tải dữ liệu...
    </div>
  );
}

function PromptModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold transition",
        active
          ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
          : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function emptyPreviewInput(mode: AiMode): AdminQuizFigureCreateAiInput {
  return {
    mode,
    adminInstructions: null,
    model: null,
    temperature: null,
    reasoningEffort: null,
    systemPrompt: null,
    userPrompt: null,
  };
}

function createEmptyFigure(targetMode: AdminQuizFigureAiTargetMode): AdminQuizFigure {
  return {
    id: `new-${targetMode.toLowerCase()}`,
    role: targetMode === "QUESTION" ? "QUESTION" : "SOLUTION",
    status: "QUEUED",
    lastErrorCode: null,
    lastErrorMessage: null,
    currentRevision: null,
  };
}

function targetModeLabel(targetMode: AdminQuizFigureAiTargetMode) {
  switch (targetMode) {
    case "QUESTION":
      return "Tạo hình AI cho đề bài";
    case "SOLUTION":
      return "Tạo hình AI cho lời giải";
  }
}

function targetModeDescription(targetMode: AdminQuizFigureAiTargetMode) {
  switch (targetMode) {
    case "QUESTION":
      return "Tạo hình minh họa mới từ nội dung đề bài hiện tại.";
    case "SOLUTION":
      return "Tạo một hình lời giải hoàn chỉnh mới từ đề bài và lời giải, không phụ thuộc hình đề.";
  }
}

function createPreviewInputKey(input: AdminQuizFigureCreateAiInput) {
  return JSON.stringify(input);
}

function buildDisplayedProviderInput(
  providerInput: Record<string, unknown>,
  previewUserPrompt: string,
  systemPrompt: string,
  userPrompt: string,
) {
  return {
    ...providerInput,
    instructions: systemPrompt,
    input: replaceUserPrompt(providerInput.input, previewUserPrompt, userPrompt),
  };
}

function replaceUserPrompt(value: unknown, preview: string, current: string): unknown {
  if (typeof value === "string") return value === preview ? current : value;
  if (!Array.isArray(value)) return value;
  return value.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) return message;
    const record = message as Record<string, unknown>;
    if (!Array.isArray(record.content)) return message;
    return {
      ...record,
      content: record.content.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const content = item as Record<string, unknown>;
        return content.type === "input_text" && content.text === preview
          ? { ...content, text: current }
          : item;
      }),
    };
  });
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
  model:
    | {
        capabilities?: {
          aiConfiguration?: AdminAiConfigurationCapability;
          reasoningEffortLevels?: string[];
        };
      }
    | undefined,
) {
  return buildAiReasoningEffortOptions(model?.capabilities?.reasoningEffortLevels);
}

function buildRequestStatistics(
  preview: AdminQuizFigureCreateAiPreview,
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
      ? [{ label: "Reasoning Effort", value: preview.configuration.reasoningEffort }]
      : preview.configuration.temperature !== null
        ? [{ label: "Temperature", value: preview.configuration.temperature.toString() }]
        : []),
    {
      label: "Giới hạn đầu ra",
      value: `${(preview.configuration.maxOutputTokens ?? 0).toLocaleString("vi-VN")} token`,
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
