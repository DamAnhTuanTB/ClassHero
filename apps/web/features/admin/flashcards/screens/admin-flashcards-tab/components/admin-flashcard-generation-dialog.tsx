"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isAiReasoningEffort } from "@learning-path/shared";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { OptionField } from "@/components/common/forms/option-field";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { TextField } from "@/components/common/forms/text-field";
import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";
import { usePreviewAdminFlashcardPrompt } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminAiConfigurationCapability,
  AdminAiModelConfiguration,
  AdminAiPanelDocument,
  AdminFlashcardGenerationPayload,
  AdminFlashcardPromptPreview as AdminFlashcardPromptPreviewData,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type { AdminFlashcardSet } from "@/features/admin/flashcards/api/admin-flashcards-api";
import { AdminFlashcardDocumentMultiSelectField } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/admin-flashcard-document-multi-select-field";
import { AdminFlashcardPromptPreview } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/admin-flashcard-prompt-preview";
import {
  adminFlashcardGenerationSchema,
  type AdminFlashcardGenerationFormValues,
} from "@/features/admin/flashcards/schemas/admin-flashcard-generation-schema";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

const difficultyOptions = [
  { value: "MIXED", label: "Hỗn hợp" },
  { value: "EASY", label: "Dễ" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HARD", label: "Khó" },
];

const styleOptions = [
  { value: "student_friendly", label: "Dễ hiểu, gần gũi" },
  { value: "concise", label: "Cô đọng, vào trọng tâm" },
  { value: "academic", label: "Học thuật, chặt chẽ" },
] as const;

const DEFAULT_FLASHCARD_CARD_COUNT = 10;
const DEFAULT_FLASHCARD_DIFFICULTY_COUNTS = {
  easy: 5,
  medium: 3,
  hard: 2,
} as const;

export function AdminFlashcardGenerationDialog({
  documents,
  initialGenerationConfiguration,
  initialFigureModelConfiguration,
  initialModelConfiguration,
  isOpen,
  isSubmitting,
  lessonId,
  onClose,
  onSubmit,
  flashcardSets,
  flashcardTargetSetId,
}: {
  documents: AdminAiPanelDocument[];
  initialGenerationConfiguration?: Record<string, unknown> | null;
  initialFigureModelConfiguration: AdminAiModelConfiguration;
  initialModelConfiguration: AdminAiModelConfiguration;
  isOpen: boolean;
  isSubmitting: boolean;
  lessonId: string;
  onClose: () => void;
  onSubmit: (payload: AdminFlashcardGenerationPayload) => Promise<void>;
  flashcardSets: AdminFlashcardSet[];
  flashcardTargetSetId?: string;
}) {
  const previewMutation = usePreviewAdminFlashcardPrompt(lessonId);
  const previewPrompt = previewMutation.mutateAsync;
  const resetPreviewMutation = previewMutation.reset;
  const [preview, setPreview] = useState<AdminFlashcardPromptPreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewRequestPending, setIsPreviewRequestPending] = useState(false);
  const [isPreparingSubmission, setIsPreparingSubmission] = useState(false);
  const [previewTab, setPreviewTab] = useState<"system" | "user" | "input">("system");
  const hasInitializedRef = useRef(false);
  const previewRequestInFlightRef = useRef(false);
  const previewRequestSequenceRef = useRef(0);
  const hasAdminEditedSystemPromptRef = useRef(false);
  const hasAdminEditedUserPromptRef = useRef(false);
  const defaults = useMemo(
    () =>
      getInitialValues(
        documents,
        initialGenerationConfiguration,
        initialModelConfiguration,
        initialFigureModelConfiguration,
        flashcardSets,
        flashcardTargetSetId,
      ),
    [
      documents,
      initialGenerationConfiguration,
      initialFigureModelConfiguration,
      initialModelConfiguration,
      flashcardSets,
      flashcardTargetSetId,
    ],
  );
  const form = useForm<AdminFlashcardGenerationFormValues>({
    resolver: zodResolver(adminFlashcardGenerationSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const requestSequence = ++previewRequestSequenceRef.current;
    previewRequestInFlightRef.current = false;
    hasAdminEditedSystemPromptRef.current =
      initialGenerationConfiguration !== null &&
      initialGenerationConfiguration !== undefined &&
      defaults.systemInstructions.trim().length > 0;
    hasAdminEditedUserPromptRef.current =
      initialGenerationConfiguration !== null &&
      initialGenerationConfiguration !== undefined &&
      defaults.userPrompt.trim().length > 0;
    form.reset(defaults);
    resetPreviewMutation();
    setPreview(null);
    setPreviewError(null);
    setIsPreviewRequestPending(false);
    setIsPreparingSubmission(false);
    setPreviewTab("system");

    if (defaults.documentIds.length === 0) return;

    previewRequestInFlightRef.current = true;
    setIsPreviewRequestPending(true);
    void previewPrompt(
      toPayload(
        defaults,
        getModelConfigurationCapability(initialModelConfiguration, defaults.model),
      ),
    )
      .then((result) => {
        if (requestSequence !== previewRequestSequenceRef.current) return;
        setPreview(result);
        form.setValue("systemInstructions", result.systemPrompt, {
          shouldValidate: true,
        });
        form.setValue("userPrompt", result.userPrompt, {
          shouldValidate: true,
        });
        applyResolvedDefaultConfiguration(form, result);
      })
      .catch((error: unknown) => {
        if (requestSequence !== previewRequestSequenceRef.current) return;
        setPreviewError(
          getUserFacingErrorMessage(
            error,
            "Chưa thể chuẩn bị dữ liệu tạo Flashcard. Vui lòng thử lại.",
          ),
        );
      })
      .finally(() => {
        if (requestSequence === previewRequestSequenceRef.current) {
          previewRequestInFlightRef.current = false;
          setIsPreviewRequestPending(false);
        }
      });
  }, [
    defaults,
    form,
    initialGenerationConfiguration,
    initialModelConfiguration,
    isOpen,
    previewPrompt,
    flashcardTargetSetId,
    resetPreviewMutation,
  ]);

  useEffect(() => {
    if (!isOpen || flashcardSets.length === 0) return;
    const currentTargetSetId = form.getValues("targetFlashcardSetId");
    if (flashcardSets.some((set) => set.id === currentTargetSetId)) return;

    const fallbackTargetSetId =
      flashcardSets.find((set) => set.id === flashcardTargetSetId)?.id ?? flashcardSets[0]?.id;
    if (!fallbackTargetSetId) return;
    form.setValue("targetFlashcardSetId", fallbackTargetSetId, {
      shouldValidate: true,
    });
  }, [form, isOpen, flashcardSets, flashcardTargetSetId]);

  const selectedModel = form.watch("model");
  const isDialogBusy = isSubmitting || isPreparingSubmission;
  const modelConfiguration = preview?.configuration ?? initialModelConfiguration;
  const selectedModelInfo = modelConfiguration.modelOptions.find(
    (option) => option.model === selectedModel,
  );
  const capability = selectedModelInfo?.capabilities?.aiConfiguration;
  const selectedFigureModel = form.watch("figureModel");
  const selectedFigureModelInfo = initialFigureModelConfiguration.modelOptions.find(
    (option) => option.model === selectedFigureModel,
  );
  const figureCapability = selectedFigureModelInfo?.capabilities?.aiConfiguration;
  const figureReasoningOptions = buildAiReasoningEffortOptions(
    selectedFigureModelInfo?.capabilities?.reasoningEffortLevels,
  );
  const reasoningOptions = buildAiReasoningEffortOptions(
    selectedModelInfo?.capabilities?.reasoningEffortLevels,
  );
  function validateModelSelection() {
    if (!form.getValues("model") && !modelConfiguration.isDefaultConfigured) {
      form.setError("model", { message: "Vui lòng chọn model" });
      window.requestAnimationFrame(() => {
        document.getElementById("ai-flashcard-model")?.focus();
      });
      return false;
    }
    form.clearErrors("model");
    return true;
  }

  async function handlePreview() {
    if (previewRequestInFlightRef.current || isPreviewRequestPending || isSubmitting) {
      return;
    }
    if (!validateModelSelection()) return;
    const valid = await form.trigger();
    if (!valid) return;
    const requestSequence = ++previewRequestSequenceRef.current;
    previewRequestInFlightRef.current = true;
    setIsPreviewRequestPending(true);
    setPreviewError(null);
    try {
      const result = await previewPrompt(
        toPayload(
          preparePromptPreviewValues(form.getValues(), {
            preserveSystemPrompt: hasAdminEditedSystemPromptRef.current,
            preserveUserPrompt: hasAdminEditedUserPromptRef.current,
          }),
          capability,
        ),
      );
      if (requestSequence !== previewRequestSequenceRef.current) return;
      setPreview(result);
      form.setValue("systemInstructions", result.systemPrompt, {
        shouldValidate: true,
      });
      form.setValue("userPrompt", result.userPrompt, { shouldValidate: true });
      applyResolvedDefaultConfiguration(form, result);
    } catch (error) {
      if (requestSequence !== previewRequestSequenceRef.current) return;
      setPreviewError(
        getUserFacingErrorMessage(error, "Chưa thể xem trước prompt Flashcard."),
      );
    } finally {
      if (requestSequence === previewRequestSequenceRef.current) {
        previewRequestInFlightRef.current = false;
        setIsPreviewRequestPending(false);
      }
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (isPreviewRequestPending) return;
    if (!values.model && !modelConfiguration.isDefaultConfigured) {
      validateModelSelection();
      return;
    }
    const previewValues = preparePromptPreviewValues(values, {
      preserveSystemPrompt: hasAdminEditedSystemPromptRef.current,
      preserveUserPrompt: hasAdminEditedUserPromptRef.current,
    });
    const payload = toPayload(previewValues, capability);
    setPreviewError(null);
    setIsPreparingSubmission(true);
    setIsPreviewRequestPending(true);
    try {
      const freshPreview = await previewPrompt(payload);
      setPreview(freshPreview);
      await onSubmit({
        ...payload,
        requestDraftId: freshPreview.requestDraftId,
        requestHash: freshPreview.requestHash,
      });
    } catch (error) {
      setPreviewError(
        getUserFacingErrorMessage(
          error,
          "Chưa thể chuẩn bị snapshot PDF mới nhất để tạo Flashcard.",
        ),
      );
    } finally {
      setIsPreviewRequestPending(false);
      setIsPreparingSubmission(false);
    }
  });
  const cardCountField = form.register("cardCount");
  const realWorldCountField = form.register("realWorldCount");
  const easyCountField = form.register("easyCount");
  const mediumCountField = form.register("mediumCount");
  const hardCountField = form.register("hardCount");
  const temperatureField = form.register("temperature");
  const maxOutputTokensField = form.register("maxOutputTokens");
  const figureTemperatureField = form.register("figureTemperature");
  const figureMaxOutputTokensField = form.register("figureMaxOutputTokens");
  const revalidateDifficultyCounts = () =>
    form.trigger(["cardCount", "easyCount", "mediumCount", "hardCount"]);

  return (
    <EditorDialogShell
      ariaLabel="Tạo Flashcard bằng AI"
      isOpen={isOpen}
      onClose={() => !isDialogBusy && onClose()}
      panelClassName="max-w-3xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Tạo Flashcard bằng AI
          </h2>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <OptionField
              id="ai-flashcard-target-set"
              label="Bộ flashcard được chọn"
              value={form.watch("targetFlashcardSetId")}
              options={flashcardSets.map((set) => ({
                value: set.id,
                label: set.title,
              }))}
              placeholder={
                flashcardSets.length === 0 ? "Chưa có bộ flashcard" : "Chọn bộ flashcard"
              }
              disabled={flashcardSets.length === 0}
              icon={null}
              error={form.formState.errors.targetFlashcardSetId}
              onChange={(value) =>
                form.setValue("targetFlashcardSetId", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
            />
            {flashcardSets.length === 0 ? (
              <p className="mt-1.5 text-sm leading-5 text-[var(--theme-text-muted)]">
                Hệ thống sẽ tạo “Bộ flashcard 1” khi bắt đầu sinh Flashcard.
              </p>
            ) : null}
          </div>

          <AdminFlashcardDocumentMultiSelectField
            documents={documents}
            value={form.watch("documentIds")}
            error={form.formState.errors.documentIds}
            onChange={(value) =>
              form.setValue("documentIds", value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="ai-flashcard-card-count"
              label="Số thẻ ghi nhớ"
              inputMode="numeric"
              pattern="[0-9]*"
              icon={null}
              error={form.formState.errors.cardCount}
              {...cardCountField}
              onChange={numericChange(
                cardCountField.onChange,
                revalidateDifficultyCounts,
              )}
            />
            <TextField
              id="ai-flashcard-real-world-count"
              label="Số thẻ thực tế"
              inputMode="numeric"
              pattern="[0-9]*"
              icon={null}
              isOptional
              optionalLabel="Không bắt buộc"
              error={form.formState.errors.realWorldCount}
              {...realWorldCountField}
              onChange={numericChange(realWorldCountField.onChange)}
            />
            <OptionField
              id="ai-flashcard-difficulty"
              label="Mức độ"
              value={form.watch("difficulty")}
              options={difficultyOptions}
              icon={null}
              error={form.formState.errors.difficulty}
              onChange={(value) =>
                form.setValue(
                  "difficulty",
                  value as AdminFlashcardGenerationFormValues["difficulty"],
                  { shouldDirty: true, shouldTouch: true, shouldValidate: true },
                )
              }
            />
          </div>

          {form.watch("difficulty") === "MIXED" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["easyCount", "Dễ", easyCountField],
                ["mediumCount", "Trung bình", mediumCountField],
                ["hardCount", "Khó", hardCountField],
              ].map(([name, label, field]) => (
                <TextField
                  key={name as string}
                  id={`ai-flashcard-${name}`}
                  label={label as string}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  icon={null}
                  error={
                    form.formState.errors[
                      name as "easyCount" | "mediumCount" | "hardCount"
                    ]
                  }
                  {...(field as typeof easyCountField)}
                  onChange={numericChange(
                    (field as typeof easyCountField).onChange,
                    revalidateDifficultyCounts,
                  )}
                />
              ))}
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <TextareaField
              id="ai-flashcard-style-instructions"
              label="Cách trình bày"
              className="min-h-24"
              helperText="Chọn một gợi ý để tự động điền, sau đó có thể sửa tùy ý."
              error={form.formState.errors.styleInstructions}
              {...form.register("styleInstructions")}
            />
            <div
              className="flex flex-wrap gap-2"
              aria-label="Mẫu trình bày thiết lập sẵn"
            >
              {styleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    form.setValue(
                      "style",
                      option.value as AdminFlashcardGenerationFormValues["style"],
                      { shouldDirty: true },
                    );
                    form.setValue(
                      "styleInstructions",
                      getPresentationPreset(option.value),
                      {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      },
                    );
                  }}
                  className="theme-button-primary-subtle min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <TextareaField
            id="ai-flashcard-extra-instructions"
            label="Yêu cầu bổ sung"
            placeholder="Ví dụ: Dùng câu ngắn, nhấn mạnh các bước giải và hạn chế thuật ngữ khó"
            isOptional
            optionalLabel="Không bắt buộc"
            error={form.formState.errors.extraInstructions}
            {...form.register("extraInstructions")}
          />

          <section className="space-y-4 rounded-xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] p-4">
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Phase 1 · Model tạo nội dung Flashcard
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionField
                id="ai-flashcard-model"
                label="Model"
                value={selectedModel}
                options={[
                  ...(modelConfiguration.isDefaultConfigured
                    ? [{ value: "", label: "Tự động theo Cài đặt AI" }]
                    : []),
                  ...modelConfiguration.modelOptions.map((option) => ({
                    value: option.model,
                    label: `${formatProviderLabel(option.provider)} · ${option.model}${
                      option.available ? "" : " · Chưa khả dụng"
                    }`,
                    disabled: !option.available,
                  })),
                ]}
                icon={null}
                error={form.formState.errors.model}
                onChange={(value) => {
                  form.setValue("model", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  if (value || modelConfiguration.isDefaultConfigured) {
                    form.clearErrors("model");
                  } else {
                    form.setError("model", { message: "Vui lòng chọn model" });
                  }
                  const nextModel = modelConfiguration.modelOptions.find(
                    (option) => option.model === value,
                  );
                  const nextCapability = nextModel?.capabilities?.aiConfiguration;
                  const allowedReasoningEffortLevels =
                    nextModel?.capabilities?.reasoningEffortLevels?.filter(
                      isAiReasoningEffort,
                    ) ?? [];
                  const currentReasoningEffort = form.getValues("reasoningEffort");
                  if (
                    currentReasoningEffort &&
                    (value === "" ||
                      nextCapability !== "REASONING_EFFORT" ||
                      !allowedReasoningEffortLevels.includes(currentReasoningEffort))
                  ) {
                    form.setValue("reasoningEffort", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }
                  if (
                    form.getValues("temperature") &&
                    (value === "" || nextCapability !== "TEMPERATURE")
                  ) {
                    form.setValue("temperature", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }
                }}
              />
              {selectedModel === "" ? (
                <div className="hidden sm:block" aria-hidden="true" />
              ) : (
                <>
                  {supportsReasoningEffort(selectedModel, capability) ? (
                    <OptionField
                      id="ai-flashcard-reasoning-effort"
                      label="Reasoning Effort"
                      value={form.watch("reasoningEffort")}
                      options={reasoningOptions}
                      icon={null}
                      error={form.formState.errors.reasoningEffort}
                      onChange={(value) => {
                        if (value !== "" && !isAiReasoningEffort(value)) return;
                        form.setValue("reasoningEffort", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    />
                  ) : null}
                  {supportsTemperature(selectedModel, capability) ? (
                    <TextField
                      id="ai-flashcard-temperature"
                      label="Temperature"
                      inputMode="decimal"
                      icon={null}
                      error={form.formState.errors.temperature}
                      {...temperatureField}
                      onChange={decimalChange(temperatureField.onChange)}
                    />
                  ) : null}
                  {!supportsReasoningEffort(selectedModel, capability) &&
                  !supportsTemperature(selectedModel, capability) ? (
                    <div className="hidden sm:block" aria-hidden="true" />
                  ) : null}
                </>
              )}
            </div>
            {selectedModel !== "" ? (
              <TextField
                id="ai-flashcard-max-output-tokens"
                label="Giới hạn token đầu ra"
                inputMode="numeric"
                pattern="[0-9]*"
                icon={null}
                error={form.formState.errors.maxOutputTokens}
                {...maxOutputTokensField}
                onChange={numericChange(maxOutputTokensField.onChange)}
              />
            ) : null}
          </section>

          <section className="space-y-4 rounded-xl border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-4">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Phase 2 · Model tạo hình Flashcard
              </h3>
              <p className="mt-1 text-xs font-semibold text-[var(--theme-text-muted)]">
                Cấu hình này chỉ được dùng khi câu Flashcard cần sinh hình minh họa.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionField
                id="ai-flashcard-figure-model"
                label="Model tạo hình"
                value={selectedFigureModel}
                options={[
                  ...(initialFigureModelConfiguration.isDefaultConfigured
                    ? [{ value: "", label: "Tự động theo Cài đặt AI" }]
                    : []),
                  ...initialFigureModelConfiguration.modelOptions.map((option) => ({
                    value: option.model,
                    label: `${formatProviderLabel(option.provider)} · ${option.model}${
                      option.available ? "" : " · Chưa khả dụng"
                    }`,
                    disabled: !option.available,
                  })),
                ]}
                icon={null}
                error={form.formState.errors.figureModel}
                onChange={(value) =>
                  form.setValue("figureModel", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              {selectedFigureModel &&
              supportsReasoningEffort(selectedFigureModel, figureCapability) ? (
                <OptionField
                  id="ai-flashcard-figure-reasoning-effort"
                  label="Reasoning Effort"
                  value={form.watch("figureReasoningEffort")}
                  options={figureReasoningOptions}
                  icon={null}
                  error={form.formState.errors.figureReasoningEffort}
                  onChange={(value) => {
                    if (value !== "" && !isAiReasoningEffort(value)) return;
                    form.setValue("figureReasoningEffort", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
              ) : selectedFigureModel &&
                supportsTemperature(selectedFigureModel, figureCapability) ? (
                <TextField
                  id="ai-flashcard-figure-temperature"
                  label="Temperature"
                  inputMode="decimal"
                  icon={null}
                  error={form.formState.errors.figureTemperature}
                  {...figureTemperatureField}
                  onChange={decimalChange(figureTemperatureField.onChange)}
                />
              ) : null}
            </div>
            {selectedFigureModel ? (
              <TextField
                id="ai-flashcard-figure-max-output-tokens"
                label="Giới hạn token đầu ra tạo hình"
                inputMode="numeric"
                pattern="[0-9]*"
                icon={null}
                error={form.formState.errors.figureMaxOutputTokens}
                {...figureMaxOutputTokensField}
                onChange={numericChange(figureMaxOutputTokensField.onChange)}
              />
            ) : null}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
              Xem lại dữ liệu theo các lựa chọn hiện tại.
            </p>
            <button
              type="button"
              disabled={
                isDialogBusy ||
                isPreviewRequestPending ||
                (selectedModel !== "" && !form.watch("maxOutputTokens")) ||
                (selectedModel !== "" &&
                  supportsTemperature(selectedModel, capability) &&
                  !form.watch("temperature"))
              }
              onClick={() => void handlePreview()}
              className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-4 w-4", isPreviewRequestPending && "animate-spin")}
                aria-hidden="true"
              />
              {isPreviewRequestPending ? "Đang dựng dữ liệu" : "Cập nhật dữ liệu gửi AI"}
            </button>
          </div>
          {previewError ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] p-3 text-sm font-semibold text-[var(--theme-error-text)]"
            >
              {previewError}
            </div>
          ) : null}
          {isPreviewRequestPending && !preview ? (
            <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Đang tải dữ liệu...
            </div>
          ) : null}
          {preview ? (
            <div
              data-testid="ai-prompt-preview-shell"
              className={cn(
                "relative overflow-hidden transition-opacity duration-200",
                isPreviewRequestPending && "opacity-50",
              )}
            >
              <AdminFlashcardPromptPreview
                activeTab={previewTab}
                maxOutputTokens={form.watch("maxOutputTokens")}
                model={form.watch("model")}
                onTabChange={setPreviewTab}
                preview={preview}
                reasoningEffort={form.watch("reasoningEffort")}
                systemInstructions={form.watch("systemInstructions")}
                systemInstructionsError={form.formState.errors.systemInstructions}
                temperature={form.watch("temperature")}
                userPrompt={form.watch("userPrompt")}
                userPromptError={form.formState.errors.userPrompt}
                onSystemInstructionsChange={(value) => {
                  hasAdminEditedSystemPromptRef.current = value.trim().length > 0;
                  form.setValue("systemInstructions", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
                onUserPromptChange={(value) => {
                  hasAdminEditedUserPromptRef.current = value.trim().length > 0;
                  form.setValue("userPrompt", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              />
            </div>
          ) : null}
        </div>
        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            type="button"
            disabled={isDialogBusy}
            onClick={onClose}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isDialogBusy || isPreviewRequestPending}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60 sm:w-auto"
          >
            {isDialogBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {isPreparingSubmission
              ? "Đang cập nhật dữ liệu"
              : isSubmitting
                ? "Đang gửi yêu cầu"
                : "Bắt đầu tạo"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function getInitialValues(
  documents: AdminAiPanelDocument[],
  initial?: Record<string, unknown> | null,
  initialModelConfiguration?: AdminAiModelConfiguration,
  initialFigureModelConfiguration?: AdminAiModelConfiguration,
  flashcardSets: AdminFlashcardSet[] = [],
  flashcardTargetSetId?: string,
): AdminFlashcardGenerationFormValues {
  const available = new Set(
    documents.filter((document) => document.canUseForFlashcard).map((document) => document.id),
  );
  const hasRestoredCardCount =
    typeof initial?.cardCount === "number" && Number.isFinite(initial.cardCount);
  const cardCount = readNumber(initial?.cardCount, DEFAULT_FLASHCARD_CARD_COUNT);
  const balanced = hasRestoredCardCount
    ? getBalancedDifficultyCounts(cardCount)
    : DEFAULT_FLASHCARD_DIFFICULTY_COUNTS;
  const style = isStyle(initial?.style) ? initial.style : "student_friendly";
  const configuredModel =
    initialModelConfiguration?.isDefaultConfigured &&
    initialModelConfiguration.resolvedModel
      ? initialModelConfiguration.resolvedModel
      : "";
  const restoredModel = readString(initial?.model, "");
  const model = restoredModel || configuredModel;
  const usesConfiguredDefaults = restoredModel === "" && configuredModel !== "";
  const modelCapability = initialModelConfiguration?.modelOptions.find(
    (option) => option.model === model,
  )?.capabilities?.aiConfiguration;
  const restoredTemperature = readNumericText(initial?.temperature);
  const restoredMaxOutputTokens = readNumericText(initial?.maxOutputTokens);
  const restoredReasoningEffort = isAiReasoningEffort(initial?.reasoningEffort)
    ? initial.reasoningEffort
    : "";
  const restoredTargetSetId = readString(initial?.targetFlashcardSetId, "");
  const configuredFigureModel =
    initialFigureModelConfiguration?.isDefaultConfigured &&
    initialFigureModelConfiguration.resolvedModel
      ? initialFigureModelConfiguration.resolvedModel
      : "";
  const restoredFigureModel = readString(initial?.figureModel, "");
  const figureModel = restoredFigureModel || configuredFigureModel;
  const usesConfiguredFigureDefaults =
    restoredFigureModel === "" && configuredFigureModel !== "";
  const figureModelCapability = initialFigureModelConfiguration?.modelOptions.find(
    (option) => option.model === figureModel,
  )?.capabilities?.aiConfiguration;
  const targetFlashcardSetId =
    (flashcardTargetSetId &&
    (flashcardSets.length === 0 || flashcardSets.some((set) => set.id === flashcardTargetSetId))
      ? flashcardTargetSetId
      : undefined) ??
    flashcardSets.find((set) => set.id === restoredTargetSetId)?.id ??
    flashcardSets[0]?.id ??
    "";
  return {
    targetFlashcardSetId,
    documentIds:
      readStringArray(initial?.documentIds).filter((id) => available.has(id)).length > 0
        ? readStringArray(initial?.documentIds).filter((id) => available.has(id))
        : documents
            .filter(
              (document) =>
                document.canUseForFlashcard && document.kind === "PRIMARY_FROM_SOURCE",
            )
            .slice(0, 20)
            .map((document) => document.id),
    cardCount: String(cardCount),
    realWorldCount: readNumericText(initial?.realWorldCardCount),
    difficulty: isDifficulty(initial?.difficulty) ? initial.difficulty : "MIXED",
    easyCount: String(
      readNumber(readRecord(initial?.difficultyCounts).easy, balanced.easy),
    ),
    mediumCount: String(
      readNumber(readRecord(initial?.difficultyCounts).medium, balanced.medium),
    ),
    hardCount: String(
      readNumber(readRecord(initial?.difficultyCounts).hard, balanced.hard),
    ),
    style,
    styleInstructions: readString(
      initial?.styleInstructions,
      getPresentationPreset(style),
    ),
    extraInstructions: readString(initial?.extraInstructions, ""),
    systemInstructions: readString(initial?.systemInstructions, ""),
    userPrompt: readString(initial?.userPrompt, ""),
    model,
    temperature:
      restoredTemperature ||
      (usesConfiguredDefaults &&
      supportsTemperature(model, modelCapability) &&
      initialModelConfiguration?.temperature !== null
        ? readNumericText(initialModelConfiguration?.temperature)
        : ""),
    reasoningEffort:
      restoredReasoningEffort ||
      (usesConfiguredDefaults &&
      supportsReasoningEffort(model, modelCapability) &&
      isAiReasoningEffort(initialModelConfiguration?.reasoningEffort)
        ? initialModelConfiguration.reasoningEffort
        : ""),
    maxOutputTokens:
      restoredMaxOutputTokens ||
      (usesConfiguredDefaults
        ? readNumericText(initialModelConfiguration?.maxOutputTokens)
        : ""),
    figureModel,
    figureTemperature:
      readNumericText(initial?.figureTemperature) ||
      (usesConfiguredFigureDefaults &&
      supportsTemperature(figureModel, figureModelCapability)
        ? readNumericText(initialFigureModelConfiguration?.temperature)
        : ""),
    figureReasoningEffort:
      (isAiReasoningEffort(initial?.figureReasoningEffort)
        ? initial.figureReasoningEffort
        : "") ||
      (usesConfiguredFigureDefaults &&
      supportsReasoningEffort(figureModel, figureModelCapability) &&
      isAiReasoningEffort(initialFigureModelConfiguration?.reasoningEffort)
        ? initialFigureModelConfiguration.reasoningEffort
        : ""),
    figureMaxOutputTokens:
      readNumericText(initial?.figureMaxOutputTokens) ||
      (usesConfiguredFigureDefaults
        ? readNumericText(initialFigureModelConfiguration?.maxOutputTokens)
        : ""),
  };
}

function toPayload(
  values: AdminFlashcardGenerationFormValues,
  capability: AdminAiConfigurationCapability | undefined,
): AdminFlashcardGenerationPayload {
  return {
    type: "FLASHCARD",
    ...(values.targetFlashcardSetId ? { targetFlashcardSetId: values.targetFlashcardSetId } : {}),
    documentIds: values.documentIds,
    cardCount: Number(values.cardCount),
    ...(values.realWorldCount ? { realWorldCardCount: Number(values.realWorldCount) } : {}),
    difficulty: values.difficulty,
    ...(values.difficulty === "MIXED"
      ? {
          difficultyCounts: {
            easy: Number(values.easyCount),
            medium: Number(values.mediumCount),
            hard: Number(values.hardCount),
          },
        }
      : {}),
    style: values.style,
    ...(values.styleInstructions.trim()
      ? { styleInstructions: values.styleInstructions.trim() }
      : {}),
    ...(values.extraInstructions.trim()
      ? { extraInstructions: values.extraInstructions.trim() }
      : {}),
    ...(values.systemInstructions.trim()
      ? { systemInstructions: values.systemInstructions }
      : {}),
    ...(values.userPrompt.trim() ? { userPrompt: values.userPrompt } : {}),
    ...(values.model ? { model: values.model } : {}),
    ...(values.model &&
    values.temperature &&
    supportsTemperature(values.model, capability)
      ? { temperature: Number(values.temperature) }
      : {}),
    ...(values.model &&
    values.reasoningEffort &&
    supportsReasoningEffort(values.model, capability)
      ? { reasoningEffort: values.reasoningEffort }
      : {}),
    ...(values.maxOutputTokens
      ? { maxOutputTokens: Number(values.maxOutputTokens) }
      : {}),
    ...(values.figureModel ? { figureModel: values.figureModel } : {}),
    ...(values.figureModel && values.figureTemperature
      ? { figureTemperature: Number(values.figureTemperature) }
      : {}),
    ...(values.figureModel && values.figureReasoningEffort
      ? { figureReasoningEffort: values.figureReasoningEffort }
      : {}),
    ...(values.figureMaxOutputTokens
      ? { figureMaxOutputTokens: Number(values.figureMaxOutputTokens) }
      : {}),
  };
}

function applyResolvedDefaultConfiguration(
  form: UseFormReturn<AdminFlashcardGenerationFormValues>,
  preview: AdminFlashcardPromptPreviewData,
) {
  if (
    !preview.configuration.isDefaultConfigured ||
    form.getValues("model") ||
    !preview.configuration.resolvedModel
  ) {
    return;
  }

  form.setValue("model", preview.configuration.resolvedModel);
  if (preview.configuration.temperature !== null) {
    form.setValue("temperature", String(preview.configuration.temperature));
  }
  if (isAiReasoningEffort(preview.configuration.reasoningEffort)) {
    form.setValue("reasoningEffort", preview.configuration.reasoningEffort);
  }
  if (preview.configuration.maxOutputTokens !== null) {
    form.setValue("maxOutputTokens", String(preview.configuration.maxOutputTokens));
  }
}

function getModelConfigurationCapability(
  configuration: AdminAiModelConfiguration,
  model: string,
) {
  return configuration.modelOptions.find((option) => option.model === model)?.capabilities
    ?.aiConfiguration;
}

function preparePromptPreviewValues(
  values: AdminFlashcardGenerationFormValues,
  options: {
    preserveSystemPrompt: boolean;
    preserveUserPrompt: boolean;
  },
): AdminFlashcardGenerationFormValues {
  return {
    ...values,
    systemInstructions: options.preserveSystemPrompt ? values.systemInstructions : "",
    userPrompt: options.preserveUserPrompt ? values.userPrompt : "",
  };
}

function numericChange(
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
  afterChange?: () => void,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
    onChange(event);
    afterChange?.();
  };
}

function decimalChange(onChange: (event: ChangeEvent<HTMLInputElement>) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1");
    onChange(event);
  };
}

function getBalancedDifficultyCounts(count: number) {
  const medium = Math.ceil(count / 3);
  const easy = Math.ceil((count - medium) / 2);
  return { easy, medium, hard: count - easy - medium };
}

function getPresentationPreset(style: AdminFlashcardGenerationFormValues["style"]) {
  if (style === "concise") {
    return "Cô đọng, đi thẳng vào kiến thức trọng tâm và dễ quét nhanh.";
  }
  if (style === "academic") {
    return "Học thuật, chặt chẽ, có cấu trúc rõ ràng và dùng thuật ngữ chính xác.";
  }
  return "Dễ hiểu, gần gũi, sử dụng cách diễn đạt và mức độ chi tiết phù hợp lứa tuổi.";
}

function formatProviderLabel(provider: string) {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readNumericText(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isDifficulty(
  value: unknown,
): value is AdminFlashcardGenerationFormValues["difficulty"] {
  return value === "EASY" || value === "MEDIUM" || value === "HARD" || value === "MIXED";
}

function isStyle(value: unknown): value is AdminFlashcardGenerationFormValues["style"] {
  return value === "student_friendly" || value === "concise" || value === "academic";
}
