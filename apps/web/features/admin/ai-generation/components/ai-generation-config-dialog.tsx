"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AI_REASONING_EFFORT_LEVELS, isAiReasoningEffort } from "@learning-path/shared";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { CheckboxField } from "@/components/common/forms/checkbox-field";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { AdminDocumentMultiSelectField } from "@/features/admin/ai-generation/components/admin-document-multi-select-field";
import { AdminSummaryPromptPreview } from "@/features/admin/ai-generation/components/admin-summary-prompt-preview";
import { usePreviewAdminLessonSummaryPrompt } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import {
  adminAiGenerationFormSchema,
  type AdminAiGenerationFormValues,
} from "@/features/admin/ai-generation/schemas/admin-ai-generation-schemas";
import type {
  AdminAiGenerationPayload,
  AdminAiGenerationType,
  AdminAiConfigurationCapability,
  AdminAiPanelDocument,
  AdminAiQuestionType,
  AdminSummaryGenerationPayload,
  AdminSummaryLength,
  AdminSummaryStyle,
  AdminLessonSummaryPromptPreview,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsTemperature,
  supportsReasoningEffort,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { cn } from "@/lib/utils";

const difficultyOptions = [
  { value: "MIXED", label: "Hỗn hợp" },
  { value: "EASY", label: "Dễ" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HARD", label: "Khó" },
];
const summaryStyleOptions = [
  { value: "student_friendly", label: "Dễ hiểu, gần gũi" },
  { value: "concise", label: "Cô đọng, vào trọng tâm" },
  { value: "academic", label: "Học thuật, chặt chẽ" },
];
const summaryLengthOptions = [
  { value: "short", label: "Ngắn" },
  { value: "standard", label: "Tiêu chuẩn" },
  { value: "detailed", label: "Chi tiết" },
];
const questionTypeOptions = [
  { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm một đáp án" },
  { value: "TRUE_FALSE", label: "Đúng / Sai" },
  { value: "MULTI_STATEMENT_TRUE_FALSE", label: "Nhiều mệnh đề Đúng / Sai" },
  { value: "TEXT_INPUT", label: "Nhập đáp án" },
] as const;

export function AiGenerationConfigDialog({
  documents,
  isOpen,
  isSubmitting,
  lessonId,
  targetGrade,
  type,
  onClose,
  onSubmit,
}: {
  documents: AdminAiPanelDocument[];
  isOpen: boolean;
  isSubmitting: boolean;
  lessonId: string;
  targetGrade: number | null;
  type: AdminAiGenerationType;
  onClose: () => void;
  onSubmit: (payload: AdminAiGenerationPayload) => Promise<void>;
}) {
  const previewMutation = usePreviewAdminLessonSummaryPrompt(lessonId);
  const resetPreview = previewMutation.reset;
  const previewPrompt = previewMutation.mutateAsync;
  const [summaryPreviewTab, setSummaryPreviewTab] = useState<"system" | "user" | "input">(
    "system",
  );
  const [summaryPreviewData, setSummaryPreviewData] =
    useState<AdminLessonSummaryPromptPreview | null>(null);
  const [isPreviewRequestPending, setIsPreviewRequestPending] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const previewRequestInFlightRef = useRef(false);
  const previewRequestSequenceRef = useRef(0);
  const submitRequestInFlightRef = useRef(false);

  const form = useForm<AdminAiGenerationFormValues>({
    resolver: zodResolver(adminAiGenerationFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: getDefaultValues(type, documents, targetGrade),
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
    setIsPreviewRequestPending(false);
    const values = getDefaultValues(type, documents, targetGrade);
    form.reset(values);
    resetPreview();
    setSummaryPreviewTab("system");
    setSummaryPreviewData(null);
    if (type === "SUMMARY" && values.documentIds.length > 0) {
      previewRequestInFlightRef.current = true;
      setIsPreviewRequestPending(true);
      void previewPrompt(toSummaryPayload(values))
        .then((data) => {
          if (requestSequence !== previewRequestSequenceRef.current) return;
          setSummaryPreviewData(data);
          form.setValue("systemInstructions", data.systemPrompt, {
            shouldValidate: true,
          });
          form.setValue("userPrompt", data.userPrompt, {
            shouldValidate: true,
          });
          if (
            data.configuration.isDefaultConfigured &&
            !form.getValues("summaryModel") &&
            data.configuration.resolvedModel
          ) {
            form.setValue("summaryModel", data.configuration.resolvedModel);
            if (
              data.configuration.temperature !== null &&
              data.configuration.temperature !== undefined
            ) {
              form.setValue(
                "summaryTemperature",
                data.configuration.temperature.toString(),
              );
            }
            if (isAiReasoningEffort(data.configuration.reasoningEffort)) {
              form.setValue("summaryReasoningEffort", data.configuration.reasoningEffort);
            }
            if (
              data.configuration.maxOutputTokens !== null &&
              data.configuration.maxOutputTokens !== undefined
            ) {
              form.setValue(
                "summaryMaxOutputTokens",
                data.configuration.maxOutputTokens.toString(),
              );
            }
          }
        })
        .catch(() => {
          // Mutation state renders the recoverable preview error in the dialog.
        })
        .finally(() => {
          if (requestSequence === previewRequestSequenceRef.current) {
            previewRequestInFlightRef.current = false;
            setIsPreviewRequestPending(false);
          }
        });
    }
  }, [documents, form, isOpen, previewPrompt, resetPreview, targetGrade, type]);

  const title = {
    SUMMARY: "Tạo Kiến thức bằng AI",
    QUIZ: "Tạo Quiz bằng AI",
    FLASHCARD: "Tạo Flashcard bằng AI",
    TEST: "Tạo bài Test bằng AI",
  }[type];
  const countField = form.register("count");
  const durationField = form.register("durationMinutes");
  const easyRatioField = form.register("easyRatio");
  const mediumRatioField = form.register("mediumRatio");
  const hardRatioField = form.register("hardRatio");
  const targetWordCountField = form.register("summaryTargetWordCount");
  const temperatureField = form.register("summaryTemperature");
  const maxOutputTokensField = form.register("summaryMaxOutputTokens");

  const selectedModelId = form.watch("summaryModel");
  const previewConfiguration = summaryPreviewData?.configuration;
  const selectedModelInfo = previewConfiguration?.modelOptions?.find(
    (opt) => opt.model === selectedModelId,
  );
  const aiConfigurationCapability = selectedModelInfo?.capabilities?.aiConfiguration;
  const configuredReasoningEffortLevels =
    selectedModelInfo?.capabilities?.reasoningEffortLevels;

  const reasoningOptions = [
    { value: "", label: "Mặc định của model" },
    ...(configuredReasoningEffortLevels?.length
      ? configuredReasoningEffortLevels
          .filter(isAiReasoningEffort)
          .sort((a, b) => {
            const order: readonly string[] = AI_REASONING_EFFORT_LEVELS;
            return (
              (order.indexOf(a) > -1 ? order.indexOf(a) : 99) -
              (order.indexOf(b) > -1 ? order.indexOf(b) : 99)
            );
          })
          .map((level) => ({
            value: level,
            label:
              {
                minimal: "Tối thiểu (Minimal)",
                low: "Thấp (Low)",
                medium: "Trung bình (Medium)",
                high: "Cao (High)",
                none: "Không (None)",
                xhigh: "Rất cao (Extra High)",
                max: "Tối đa (Max)",
              }[level as string] || level,
          }))
      : []),
  ];

  const showTemperature =
    selectedModelId !== "" &&
    supportsTemperature(selectedModelId, aiConfigurationCapability);
  const showReasoningEffort =
    selectedModelId !== "" &&
    supportsReasoningEffort(selectedModelId, aiConfigurationCapability);

  async function refreshSummaryPreview() {
    if (previewRequestInFlightRef.current || isSubmitting) return;
    previewRequestInFlightRef.current = true;
    setIsPreviewRequestPending(true);
    const requestSequence = ++previewRequestSequenceRef.current;
    try {
      const isValid = await form.trigger([
        "documentIds",
        "styleInstructions",
        "summaryLength",
        "summaryTargetWordCount",
        "extraInstructions",
        "systemInstructions",
        "summaryTemperature",
        "summaryReasoningEffort",
        "summaryMaxOutputTokens",
      ]);
      if (!isValid || form.getValues("type") !== "SUMMARY") return;
      const previewValues = form.getValues();
      const preview = await previewMutation.mutateAsync(
        toSummaryPayload(previewValues, {
          includeUserPrompt: false,
          aiConfigurationCapability,
        }),
      );
      if (requestSequence !== previewRequestSequenceRef.current) return;
      setSummaryPreviewData(preview);
      form.setValue("systemInstructions", preview.systemPrompt, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("userPrompt", preview.userPrompt, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setTimeout(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTo({
            top: scrollViewportRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 50);
    } catch {
      // React Query exposes the error state directly in the dialog.
    } finally {
      if (requestSequence === previewRequestSequenceRef.current) {
        previewRequestInFlightRef.current = false;
        setIsPreviewRequestPending(false);
      }
    }
  }

  return (
    <EditorDialogShell
      ariaLabel={title}
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      panelClassName={type === "SUMMARY" ? "max-w-3xl" : "max-w-xl"}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(async (values) => {
          if (
            submitRequestInFlightRef.current ||
            isSubmitting ||
            isPreviewRequestPending
          ) {
            return;
          }
          if (
            type === "SUMMARY" &&
            !values.summaryModel &&
            !previewConfiguration?.isDefaultConfigured
          ) {
            form.setError("summaryModel", {
              message: "Vui lòng chọn model",
            });
            return;
          }
          if (
            type === "SUMMARY" &&
            values.summaryModel &&
            showTemperature &&
            !values.summaryTemperature
          ) {
            form.setError("summaryTemperature", {
              message: "Vui lòng nhập mức độ sáng tạo (temperature)",
            });
            return;
          }
          submitRequestInFlightRef.current = true;
          try {
            await onSubmit(toPayload(values, { aiConfigurationCapability }));
          } finally {
            submitRequestInFlightRef.current = false;
          }
        })}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {title}
          </h2>
        </header>

        <div
          ref={scrollViewportRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
        >
          {type === "SUMMARY" ? (
            <>
              <AdminDocumentMultiSelectField
                documents={documents}
                error={form.formState.errors.documentIds}
                value={form.watch("documentIds")}
                onChange={(documentIds) =>
                  form.setValue("documentIds", documentIds, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
              />

              <fieldset className="space-y-2">
                <TextareaField
                  id="ai-summary-style"
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
                  {summaryStyleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        form.setValue("style", option.value as AdminSummaryStyle, {
                          shouldDirty: true,
                        });
                        form.setValue(
                          "styleInstructions",
                          getPresentationPreset(option.value, targetGrade),
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

              <div className="grid gap-4 sm:grid-cols-2">
                <OptionField
                  id="ai-summary-length"
                  label="Độ dài Kiến thức"
                  value={form.watch("summaryLength")}
                  options={summaryLengthOptions}
                  icon={null}
                  error={form.formState.errors.summaryLength}
                  onChange={(value) =>
                    form.setValue("summaryLength", value as AdminSummaryLength, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                />
                <TextField
                  id="ai-summary-target-word-count"
                  label="Số lượng từ"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Để trống nếu không giới hạn"
                  isOptional
                  optionalLabel="Không bắt buộc"
                  icon={null}
                  error={form.formState.errors.summaryTargetWordCount}
                  {...targetWordCountField}
                  onChange={numericChange(targetWordCountField.onChange)}
                />
              </div>
              <TextareaField
                id="ai-summary-extra-instructions"
                label="Yêu cầu bổ sung"
                placeholder="Ví dụ: Dùng câu ngắn, nhấn mạnh các bước giải và hạn chế thuật ngữ khó"
                isOptional
                optionalLabel="Không bắt buộc"
                error={form.formState.errors.extraInstructions}
                {...form.register("extraInstructions")}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <OptionField
                  id="ai-summary-model"
                  label="Model"
                  value={form.watch("summaryModel")}
                  options={[
                    ...(previewConfiguration?.isDefaultConfigured
                      ? [{ value: "", label: "Tự động theo Cài đặt AI" }]
                      : []),
                    ...(previewConfiguration?.modelOptions ?? []).map((option) => ({
                      value: option.model,
                      label: `${formatProviderLabel(option.provider)} · ${option.model}${
                        option.available ? "" : " · Chưa khả dụng"
                      }`,
                      disabled: !option.available,
                    })),
                  ]}
                  icon={null}
                  error={form.formState.errors.summaryModel}
                  onChange={(value) => {
                    form.setValue("summaryModel", value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                    const nextModel = previewConfiguration?.modelOptions.find(
                      (option) => option.model === value,
                    );
                    const nextCapability = nextModel?.capabilities?.aiConfiguration;
                    const allowedReasoningEffortLevels =
                      nextModel?.capabilities?.reasoningEffortLevels?.filter(
                        isAiReasoningEffort,
                      ) ?? [];
                    const currentReasoningEffort = form.getValues(
                      "summaryReasoningEffort",
                    );
                    if (
                      currentReasoningEffort &&
                      (value === "" ||
                        nextCapability !== "REASONING_EFFORT" ||
                        !allowedReasoningEffortLevels.includes(currentReasoningEffort))
                    ) {
                      form.setValue("summaryReasoningEffort", "", {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }
                    if (
                      form.getValues("summaryTemperature") &&
                      (value === "" || nextCapability !== "TEMPERATURE")
                    ) {
                      form.setValue("summaryTemperature", "", {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                />
                {form.watch("summaryModel") === "" ? (
                  <div className="hidden sm:block" aria-hidden="true" />
                ) : (
                  <>
                    {showReasoningEffort && (
                      <OptionField
                        id="ai-summary-reasoning-effort"
                        label="Reasoning Effort"
                        value={form.watch("summaryReasoningEffort") || ""}
                        options={reasoningOptions}
                        icon={null}
                        error={form.formState.errors.summaryReasoningEffort}
                        onChange={(value) => {
                          if (value !== "" && !isAiReasoningEffort(value)) return;
                          form.setValue("summaryReasoningEffort", value, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                      />
                    )}
                    {showTemperature && (
                      <TextField
                        id="ai-summary-temperature"
                        label="Temperature"
                        inputMode="decimal"
                        icon={null}
                        error={form.formState.errors.summaryTemperature}
                        {...temperatureField}
                        onChange={decimalChange(temperatureField.onChange)}
                      />
                    )}
                    {!showReasoningEffort && !showTemperature && (
                      <div className="hidden sm:block" aria-hidden="true" />
                    )}
                  </>
                )}
              </div>
              {form.watch("summaryModel") !== "" && (
                <TextField
                  id="ai-summary-max-output-tokens"
                  label="Giới hạn token đầu ra"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  icon={null}
                  error={form.formState.errors.summaryMaxOutputTokens}
                  {...maxOutputTokensField}
                  onChange={numericChange(maxOutputTokensField.onChange)}
                />
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
                  Xem lại dữ liệu theo các lựa chọn hiện tại.
                </p>
                <button
                  type="button"
                  disabled={
                    isPreviewRequestPending ||
                    isSubmitting ||
                    (form.watch("summaryModel") !== "" &&
                      !form.watch("summaryMaxOutputTokens")) ||
                    (showTemperature && !form.watch("summaryTemperature"))
                  }
                  onClick={() => void refreshSummaryPreview()}
                  className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isPreviewRequestPending && "animate-spin")}
                    aria-hidden="true"
                  />
                  {isPreviewRequestPending
                    ? "Đang dựng dữ liệu"
                    : "Cập nhật dữ liệu gửi AI"}
                </button>
              </div>

              {previewMutation.isError ? (
                <div className="rounded-xl border border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] p-3 text-sm font-semibold text-[var(--theme-error-text)]">
                  {previewMutation.error instanceof Error
                    ? previewMutation.error.message
                    : "Chưa thể dựng dữ liệu gửi AI."}
                </div>
              ) : null}
              {isPreviewRequestPending && !summaryPreviewData ? (
                <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Đang tải dữ liệu...
                </div>
              ) : null}
              {summaryPreviewData ? (
                <div
                  className={cn(
                    "relative transition-opacity duration-200",
                    isPreviewRequestPending && "opacity-50",
                  )}
                >
                  <AdminSummaryPromptPreview
                    preview={summaryPreviewData}
                    systemInstructions={form.watch("systemInstructions")}
                    userPrompt={form.watch("userPrompt")}
                    model={form.watch("summaryModel")}
                    temperature={form.watch("summaryTemperature")}
                    reasoningEffort={form.watch("summaryReasoningEffort")}
                    maxOutputTokens={form.watch("summaryMaxOutputTokens")}
                    systemInstructionsError={form.formState.errors.systemInstructions}
                    userPromptError={form.formState.errors.userPrompt}
                    onSystemInstructionsChange={(value) =>
                      form.setValue("systemInstructions", value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    onUserPromptChange={(value) =>
                      form.setValue("userPrompt", value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    activeTab={summaryPreviewTab}
                    onTabChange={setSummaryPreviewTab}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <TextField
                id="ai-generation-count"
                label={type === "FLASHCARD" ? "Số thẻ" : "Số câu hỏi"}
                inputMode="numeric"
                pattern="[0-9]*"
                icon={null}
                error={form.formState.errors.count}
                {...countField}
                onChange={numericChange(countField.onChange)}
              />
              {type !== "TEST" ? (
                <OptionField
                  id="ai-generation-difficulty"
                  label="Mức độ"
                  value={form.watch("difficulty")}
                  options={difficultyOptions}
                  icon={null}
                  error={form.formState.errors.difficulty}
                  onChange={(value) =>
                    form.setValue(
                      "difficulty",
                      value as AdminAiGenerationFormValues["difficulty"],
                      {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      },
                    )
                  }
                />
              ) : null}
            </>
          )}

          {type === "QUIZ" || type === "TEST" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Loại câu hỏi
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {questionTypeOptions.map((option) => (
                  <CheckboxField
                    key={option.value}
                    id={`ai-question-type-${option.value}`}
                    label={option.label}
                    checked={form.watch("questionTypes").includes(option.value)}
                    onChange={(event) =>
                      updateQuestionTypes(form, option.value, event.currentTarget.checked)
                    }
                  />
                ))}
              </div>
              {form.formState.errors.questionTypes ? (
                <p className="text-sm text-[var(--theme-error-text)]">
                  {form.formState.errors.questionTypes.message}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {type === "TEST" ? (
            <>
              <TextField
                id="ai-test-duration"
                label="Thời gian làm bài (phút)"
                inputMode="numeric"
                pattern="[0-9]*"
                icon={null}
                error={form.formState.errors.durationMinutes}
                {...durationField}
                onChange={numericChange(durationField.onChange)}
              />
              <fieldset className="space-y-3">
                <legend className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  Tỷ lệ độ khó
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField
                    id="ai-test-easy-ratio"
                    label="Dễ (%)"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    icon={null}
                    error={form.formState.errors.easyRatio}
                    {...easyRatioField}
                    onChange={numericChange(easyRatioField.onChange, () =>
                      form.trigger(["easyRatio", "mediumRatio", "hardRatio"]),
                    )}
                  />
                  <TextField
                    id="ai-test-medium-ratio"
                    label="Trung bình (%)"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    icon={null}
                    error={form.formState.errors.mediumRatio}
                    {...mediumRatioField}
                    onChange={numericChange(mediumRatioField.onChange, () =>
                      form.trigger(["easyRatio", "mediumRatio", "hardRatio"]),
                    )}
                  />
                  <TextField
                    id="ai-test-hard-ratio"
                    label="Khó (%)"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    icon={null}
                    error={form.formState.errors.hardRatio}
                    {...hardRatioField}
                    onChange={numericChange(hardRatioField.onChange, () =>
                      form.trigger(["easyRatio", "mediumRatio", "hardRatio"]),
                    )}
                  />
                </div>
              </fieldset>
            </>
          ) : null}
        </div>

        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {isSubmitting ? "Đang tạo job" : "Bắt đầu tạo"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function getDefaultValues(
  type: AdminAiGenerationType,
  documents: AdminAiPanelDocument[],
  targetGrade: number | null,
): AdminAiGenerationFormValues {
  return {
    type,
    documentIds: documents
      .filter(
        (document) =>
          document.canUseForSummary && document.kind === "PRIMARY_FROM_SOURCE",
      )
      .slice(0, 20)
      .map((document) => document.id),
    style: "student_friendly",
    styleInstructions: getPresentationPreset("student_friendly", targetGrade),
    summaryLength: "standard",
    summaryTargetWordCount: "",
    extraInstructions: "",
    systemInstructions: "",
    userPrompt: "",
    summaryModel: "",
    summaryTemperature: "",
    summaryReasoningEffort: "",
    summaryMaxOutputTokens: "",
    count: type === "FLASHCARD" ? "10" : "8",
    difficulty: "MIXED",
    questionTypes: questionTypeOptions.map((option) => option.value),
    durationMinutes: "15",
    easyRatio: "30",
    mediumRatio: "50",
    hardRatio: "20",
  };
}

function toPayload(
  values: AdminAiGenerationFormValues,
  options?: { aiConfigurationCapability?: AdminAiConfigurationCapability },
): AdminAiGenerationPayload {
  if (values.type === "SUMMARY") {
    return toSummaryPayload(values, {
      aiConfigurationCapability: options?.aiConfigurationCapability,
    });
  }
  if (values.type === "FLASHCARD") {
    return {
      type: values.type,
      cardCount: Number(values.count),
      difficulty: values.difficulty,
    };
  }
  if (values.type === "QUIZ") {
    return {
      type: values.type,
      questionCount: Number(values.count),
      difficulty: values.difficulty,
      questionTypes: values.questionTypes,
    };
  }
  return {
    type: values.type,
    questionCount: Number(values.count),
    durationSeconds: Number(values.durationMinutes) * 60,
    difficultyRatio: {
      easy: Number(values.easyRatio) / 100,
      medium: Number(values.mediumRatio) / 100,
      hard: Number(values.hardRatio) / 100,
    },
    questionTypes: values.questionTypes,
  };
}

function toSummaryPayload(
  values: AdminAiGenerationFormValues,
  options: {
    includeUserPrompt?: boolean;
    aiConfigurationCapability?: AdminAiConfigurationCapability;
  } = {},
): AdminSummaryGenerationPayload {
  const extraInstructions = values.extraInstructions.trim();
  const styleInstructions = values.styleInstructions.trim();
  const systemInstructions = values.systemInstructions.trim();
  const userPrompt = options.includeUserPrompt === false ? "" : values.userPrompt.trim();
  return {
    type: "SUMMARY",
    documentIds: values.documentIds,
    style: values.style,
    ...(styleInstructions ? { styleInstructions } : {}),
    length: values.summaryLength,
    ...(values.summaryTargetWordCount
      ? { targetWordCount: Number(values.summaryTargetWordCount) }
      : {}),
    ...(extraInstructions ? { extraInstructions } : {}),
    ...(systemInstructions ? { systemInstructions } : {}),
    ...(userPrompt ? { userPrompt } : {}),
    ...(values.summaryModel ? { model: values.summaryModel } : {}),
    ...(values.summaryModel &&
    values.summaryTemperature &&
    supportsTemperature(values.summaryModel, options.aiConfigurationCapability)
      ? { temperature: Number(values.summaryTemperature) }
      : {}),
    ...(values.summaryModel &&
    values.summaryReasoningEffort &&
    supportsReasoningEffort(values.summaryModel, options.aiConfigurationCapability)
      ? { reasoningEffort: values.summaryReasoningEffort }
      : {}),
    ...(values.summaryMaxOutputTokens
      ? { maxOutputTokens: Number(values.summaryMaxOutputTokens) }
      : {}),
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
    const sanitized = event.currentTarget.value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1");
    const [integer = "", decimals] = sanitized.split(".");
    event.currentTarget.value =
      decimals === undefined ? integer : `${integer}.${decimals.slice(0, 2)}`;
    onChange(event);
  };
}

function formatProviderLabel(provider: string) {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider;
}

function getPresentationPreset(style: string, targetGrade: number | null) {
  if (style === "concise") {
    return "Cô đọng, đi thẳng vào kiến thức trọng tâm và dễ quét nhanh.";
  }
  if (style === "academic") {
    return "Học thuật, chặt chẽ, có cấu trúc rõ ràng và dùng thuật ngữ chính xác.";
  }
  return targetGrade
    ? `Dễ hiểu cho học sinh khối ${targetGrade}.`
    : "Dễ hiểu cho học sinh theo đúng khối lớp của khóa học.";
}

function updateQuestionTypes(
  form: ReturnType<typeof useForm<AdminAiGenerationFormValues>>,
  type: AdminAiQuestionType,
  checked: boolean,
) {
  const current = form.getValues("questionTypes");
  form.setValue(
    "questionTypes",
    checked ? [...current, type] : current.filter((item) => item !== type),
    { shouldDirty: true, shouldTouch: true, shouldValidate: true },
  );
  void form.trigger(["questionTypes", "count"]);
}
