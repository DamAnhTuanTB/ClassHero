"use client";

import { isAiReasoningEffort } from "@learning-path/shared";
import { Bot, Eye, EyeOff, Loader2, Pencil, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { OptionField } from "@/components/common/forms/option-field";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { TextField } from "@/components/common/forms/text-field";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import type { AdminAiModelConfiguration } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type {
  AdminFlashcard,
  AdminFlashcardSolutionFigureMode,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import {
  useAdminFlashcardFigureCreate,
  useAdminFlashcardFigurePreview,
} from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";
import { cn } from "@/lib/utils";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

type PreviewTab = "system" | "user" | "input";
type PromptMode = "PREVIEW" | "MARKDOWN";

const PREVIEW_TABS = [
  ["system", "Quy tắc hệ thống"],
  ["user", "Câu lệnh người dùng"],
  ["input", "Dữ liệu gửi đi"],
] as const;

export function FlashcardFigureAiDialog({
  card,
  onClose,
}: {
  card: AdminFlashcard;
  onClose: () => void;
}) {
  const previewMutation = useAdminFlashcardFigurePreview(card.id);
  const createMutation = useAdminFlashcardFigureCreate(card.id, card.flashcardSetId);
  const [instructions, setInstructions] = useState("");
  const [isDataVisible, setIsDataVisible] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("system");
  const [promptMode, setPromptMode] = useState<PromptMode>("PREVIEW");
  const [configuration, setConfiguration] = useState<AdminAiModelConfiguration>();
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState<string | null>(null);
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const [mode, setMode] = useState<AdminFlashcardSolutionFigureMode>("REGENERATE");
  const solutionFigure = card.figures?.find((figure) => figure.role === "SOLUTION");
  const canEditCurrent = Boolean(
    solutionFigure?.currentRevision?.sourceKind === "AI_TEX" &&
    solutionFigure.currentRevision.latexSource?.trim(),
  );
  const preview = previewMutation.data;
  const selectedModel = configuration?.modelOptions.find(
    (option) => option.model === model,
  );
  const capability = selectedModel?.capabilities?.aiConfiguration;
  const showTemperature = Boolean(model && supportsTemperature(model, capability));
  const showReasoning = Boolean(model && supportsReasoningEffort(model, capability));
  const currentInput = {
    mode,
    adminInstructions: instructions.trim() || null,
    model: model || null,
    temperature: showTemperature ? parseTemperature(temperature) : null,
    reasoningEffort:
      showReasoning && isAiReasoningEffort(reasoningEffort) ? reasoningEffort : null,
    systemPrompt: systemPrompt?.trim() || null,
    userPrompt: userPrompt?.trim() || null,
  } as const;

  const refreshPreview = useCallback(
    async (reveal: boolean) => {
      try {
        const data = await previewMutation.mutateAsync({
          mode,
          adminInstructions: instructions.trim() || null,
          model: model || null,
          temperature: showTemperature ? parseTemperature(temperature) : null,
          reasoningEffort:
            showReasoning && isAiReasoningEffort(reasoningEffort)
              ? reasoningEffort
              : null,
          systemPrompt: systemPrompt?.trim() || null,
          userPrompt: userPrompt?.trim() || null,
        });
        setConfiguration(data.configuration);
        if (!model) {
          const initialModel = data.configuration.resolvedModel ?? "";
          setModel(initialModel);
          setTemperature(
            data.configuration.temperature == null
              ? ""
              : String(data.configuration.temperature),
          );
          setReasoningEffort(data.configuration.reasoningEffort ?? "");
        }
        if (reveal) setIsDataVisible(true);
      } catch {
        toast.error("Không tải được dữ liệu tạo hình Flashcard.");
      }
    },
    [
      instructions,
      model,
      previewMutation,
      reasoningEffort,
      showReasoning,
      showTemperature,
      mode,
      systemPrompt,
      temperature,
      userPrompt,
    ],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);
  useEffect(() => {
    void refreshPreview(false);
  }, [card.id, mode]);

  async function create() {
    try {
      await createMutation.mutateAsync(currentInput);
      toast.success("Đã bắt đầu tạo hình minh họa cho lời giải Flashcard.");
      onClose();
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa tạo được hình Flashcard bằng AI."),
      );
    }
  }

  if (typeof document === "undefined") return null;
  const displayedSystem = systemPrompt ?? preview?.systemPrompt ?? "";
  const displayedUser = userPrompt ?? preview?.userPrompt ?? "";

  return createPortal(
    <div className="theme-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        aria-label="Đóng modal tạo hình"
        className="absolute inset-0 cursor-default"
        disabled={createMutation.isPending}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Tạo hình AI cho lời giải"
        className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
              Tạo hình AI cho lời giải
            </h2>
            <p className="line-clamp-1 text-xs text-[var(--theme-text-muted)]">
              Tạo một hình lời giải hoàn chỉnh mới từ đề bài và lời giải, không phụ thuộc
              hình đề.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={createMutation.isPending}
            onClick={onClose}
            className="theme-button-primary-subtle grid size-10 shrink-0 place-items-center rounded-lg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <fieldset>
            <legend className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              1. Cách tạo hình
            </legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label
                className={cn(
                  "block cursor-pointer rounded-xl border p-4",
                  mode === "REGENERATE"
                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                    : "border-[var(--theme-border)] bg-white dark:bg-slate-950",
                )}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="flashcard-figure-mode"
                    checked={mode === "REGENERATE"}
                    onChange={() => {
                      setMode("REGENERATE");
                      setUserPrompt(null);
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                      Tạo mới lại
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                      Dựng một hình lời giải hoàn chỉnh mới từ câu hỏi và solution hiện
                      tại.
                    </span>
                  </span>
                </span>
              </label>
              {canEditCurrent ? (
                <label
                  className={cn(
                    "block cursor-pointer rounded-xl border p-4",
                    mode === "EDIT_CURRENT"
                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                      : "border-[var(--theme-border)] bg-white dark:bg-slate-950",
                  )}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="flashcard-figure-mode"
                      checked={mode === "EDIT_CURRENT"}
                      onChange={() => {
                        setMode("EDIT_CURRENT");
                        setUserPrompt(null);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                        Chỉnh sửa hình hiện tại
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                        Dùng source TeX hiện tại làm candidate và chỉnh theo yêu cầu mới.
                      </span>
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
            <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-white p-3 dark:bg-slate-950">
              <p className="mb-1 text-xs font-bold text-[var(--theme-text-muted)]">
                Câu hỏi ở mặt trước
              </p>
              <TiptapContentView
                content={card.frontJson}
                contentAlignment="left"
                className="text-sm font-normal text-[var(--theme-text-strong)]"
              />
              <p className="mb-1 mt-3 text-xs font-bold text-[var(--theme-text-muted)]">
                Lời giải chi tiết
              </p>
              {card.solutionJson ? (
                <TiptapContentView
                  ariaLabel="Lời giải Flashcard trong yêu cầu tạo hình"
                  content={card.solutionJson}
                  className="text-sm text-[var(--theme-text-strong)]"
                />
              ) : (
                <p className="text-sm text-[var(--theme-text-muted)]">
                  Chưa có lời giải chi tiết.
                </p>
              )}
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--theme-text-muted)]">
                Request SOLUTION dùng solution làm nguồn ưu tiên và front làm bối cảnh;
                không gửi mặt sau.
              </p>
            </div>
          </fieldset>

          <section>
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              2. Cấu hình AI
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <OptionField
                id="flashcard-figure-create-model"
                label="Model"
                value={model}
                icon={null}
                disabled={!configuration || previewMutation.isPending}
                options={[
                  ...(configuration?.isDefaultConfigured
                    ? [{ value: "", label: "Tự động theo Cài đặt AI" }]
                    : []),
                  ...(configuration?.modelOptions ?? []).map((option) => ({
                    value: option.model,
                    label: `${formatProvider(option.provider)} · ${option.model}${option.available ? "" : " · Chưa khả dụng"}`,
                    disabled: !option.available,
                  })),
                ]}
                onChange={(value) => setModel(value)}
              />
              {showTemperature ? (
                <TextField
                  id="flashcard-figure-create-temperature"
                  label="Temperature"
                  value={temperature}
                  icon={null}
                  inputMode="decimal"
                  onChange={(event) => setTemperature(event.currentTarget.value)}
                />
              ) : showReasoning ? (
                <OptionField
                  id="flashcard-figure-create-reasoning"
                  label="Reasoning Effort"
                  value={reasoningEffort}
                  icon={null}
                  options={buildAiReasoningEffortOptions(
                    selectedModel?.capabilities?.reasoningEffortLevels,
                  )}
                  onChange={setReasoningEffort}
                />
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>
          </section>

          <section>
            <TextareaField
              id="flashcard-figure-ai-instructions"
              label="3. Yêu cầu cho hình mới"
              isOptional
              optionalLabel="Không bắt buộc"
              className="min-h-28"
              maxLength={2_000}
              value={instructions}
              onChange={(event) => setInstructions(event.currentTarget.value)}
              placeholder="Ví dụ: Giữ bố cục gọn, nhãn rõ ràng và không thêm chi tiết trang trí."
            />
            <p className="mt-1 text-right text-xs text-[var(--theme-text-muted)]">
              {instructions.length.toLocaleString("vi-VN")}/2.000 ký tự
            </p>
          </section>

          {isDataVisible ? (
            <section>
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                4. Thống kê và dữ liệu gửi đi
              </h3>
              <div className="mt-3 space-y-3">
                {previewMutation.isPending ? (
                  <LoadingPreview />
                ) : preview ? (
                  <>
                    <AdminAiRequestStatistics
                      details={buildStatistics(preview, () =>
                        setIsInputBreakdownDialogOpen(true),
                      )}
                      estimatedCost={preview.estimatedCost}
                      note="Usage provider sau khi xử lý mới là số thực tế."
                    />
                    <div className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
                      <div
                        role="tablist"
                        aria-label="Dữ liệu gửi đến model"
                        className="grid grid-cols-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
                      >
                        {PREVIEW_TABS.map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            onClick={() => setTab(value)}
                            className={cn(
                              "min-h-10 rounded-lg px-2 text-xs font-extrabold sm:text-sm",
                              tab === value
                                ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                                : "text-[var(--theme-text-muted)]",
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {tab === "input" ? (
                        <AdminAiJsonInputViewer data={preview.providerInput} />
                      ) : (
                        <div>
                          <div className="flex justify-end gap-2 border-b border-[var(--theme-border)] px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setPromptMode("PREVIEW")}
                              className={cn(
                                "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold",
                                promptMode === "PREVIEW"
                                  ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                                  : "text-[var(--theme-text-muted)]",
                              )}
                            >
                              <Eye className="size-3.5" aria-hidden="true" />
                              Xem trước
                            </button>
                            <button
                              type="button"
                              onClick={() => setPromptMode("MARKDOWN")}
                              className={cn(
                                "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold",
                                promptMode === "MARKDOWN"
                                  ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                                  : "text-[var(--theme-text-muted)]",
                              )}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              Chỉnh sửa
                            </button>
                          </div>
                          {promptMode === "PREVIEW" ? (
                            <AdminAiPromptContentPreview
                              kind={tab}
                              content={tab === "system" ? displayedSystem : displayedUser}
                            />
                          ) : (
                            <TextareaField
                              id={`flashcard-figure-${tab}-prompt`}
                              label={
                                tab === "system"
                                  ? "Markdown gốc — Quy tắc hệ thống"
                                  : "Markdown gốc — Câu lệnh người dùng"
                              }
                              wrapperClassName="p-3"
                              className="min-h-64 font-mono text-xs"
                              maxLength={30_000}
                              value={tab === "system" ? displayedSystem : displayedUser}
                              onChange={(event) =>
                                tab === "system"
                                  ? setSystemPrompt(event.currentTarget.value)
                                  : setUserPrompt(event.currentTarget.value)
                              }
                            />
                          )}
                        </div>
                      )}
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
            type="button"
            aria-expanded={isDataVisible}
            disabled={previewMutation.isPending || createMutation.isPending}
            onClick={() =>
              isDataVisible ? setIsDataVisible(false) : void refreshPreview(true)
            }
            className="theme-button-primary-subtle flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
          >
            {previewMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : isDataVisible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            {isDataVisible ? "Ẩn dữ liệu" : "Xem dữ liệu"}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={onClose}
              className="theme-button-neutral min-h-11 rounded-lg px-5 text-sm font-extrabold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={createMutation.isPending || previewMutation.isPending}
              onClick={() => void create()}
              className="theme-button-primary flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Bot className="size-4" aria-hidden="true" />
              )}
              {mode === "EDIT_CURRENT" ? "Chỉnh sửa hình" : "Tạo mới"}
            </button>
          </div>
        </footer>
        {preview?.context.tokenBreakdown ? (
          <AdminPromptInputBreakdownDialog
            breakdown={preview.context.tokenBreakdown}
            isOpen={isInputBreakdownDialogOpen}
            onClose={() => setIsInputBreakdownDialogOpen(false)}
          />
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

function LoadingPreview() {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-[var(--theme-border)] text-sm font-bold text-[var(--theme-text-muted)]">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Đang cập nhật dữ liệu...
    </div>
  );
}

function buildStatistics(
  preview: NonNullable<ReturnType<typeof useAdminFlashcardFigurePreview>["data"]>,
  onBreakdown: () => void,
) {
  return [
    {
      label: "Model thực tế",
      value: `${formatProvider(preview.configuration.resolvedProvider)} · ${preview.configuration.resolvedModel ?? "Chưa xác định"}`,
    },
    ...(preview.configuration.reasoningEffort
      ? [{ label: "Reasoning Effort", value: preview.configuration.reasoningEffort }]
      : preview.configuration.temperature !== null
        ? [{ label: "Temperature", value: preview.configuration.temperature.toString() }]
        : []),
    {
      label: "Giới hạn đầu ra",
      value: `${Number(preview.configuration.maxOutputTokens ?? 0).toLocaleString("vi-VN")} token`,
    },
    {
      label: "Text input ước tính",
      value: `${preview.context.textInputTokens.toLocaleString("vi-VN")} token`,
      onClick: preview.context.tokenBreakdown ? onBreakdown : undefined,
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

function parseTemperature(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function formatProvider(provider: string | null) {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider ?? "Provider";
}
