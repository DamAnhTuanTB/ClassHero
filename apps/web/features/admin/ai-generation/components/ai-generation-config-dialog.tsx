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
import {
  usePreviewAdminLessonSummaryPrompt,
  usePreviewAdminQuizPrompt,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import {
  adminAiGenerationFormSchema,
  type AdminAiGenerationFormValues,
} from "@/features/admin/ai-generation/schemas/admin-ai-generation-schemas";
import type {
  AdminAiGenerationPayload,
  AdminAiGenerationType,
  AdminAiConfigurationCapability,
  AdminAiModelConfiguration,
  AdminAiPanelDocument,
  AdminAiQuestionType,
  AdminSummaryGenerationPayload,
  AdminQuizGenerationPayload,
  AdminSummaryLength,
  AdminSummaryStyle,
  AdminLessonSummaryPromptPreview,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
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
  initialGenerationConfiguration,
  initialModelConfiguration,
  quizTargetSetId,
  targetGrade,
  type,
  onClose,
  onSubmit,
}: {
  documents: AdminAiPanelDocument[];
  isOpen: boolean;
  isSubmitting: boolean;
  lessonId: string;
  initialGenerationConfiguration?: Record<string, unknown> | null;
  initialModelConfiguration?: AdminAiModelConfiguration;
  quizTargetSetId?: string;
  targetGrade: number | null;
  type: AdminAiGenerationType;
  onClose: () => void;
  onSubmit: (payload: AdminAiGenerationPayload) => Promise<void>;
}) {
  const summaryPreviewMutation = usePreviewAdminLessonSummaryPrompt(lessonId);
  const quizPreviewMutation = usePreviewAdminQuizPrompt(lessonId);
  const previewMutation = type === "QUIZ" ? quizPreviewMutation : summaryPreviewMutation;
  const resetPreview = previewMutation.reset;
  const previewPrompt = previewMutation.mutateAsync as (
    payload: AdminSummaryGenerationPayload | AdminQuizGenerationPayload,
  ) => Promise<AdminLessonSummaryPromptPreview>;
  const [summaryPreviewTab, setSummaryPreviewTab] = useState<"system" | "user" | "input">(
    "system",
  );
  const [summaryPreviewData, setSummaryPreviewData] =
    useState<AdminLessonSummaryPromptPreview | null>(null);
  const [isPreviewRequestPending, setIsPreviewRequestPending] = useState(false);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [isPreparingSubmission, setIsPreparingSubmission] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const previewRequestInFlightRef = useRef(false);
  const previewRequestSequenceRef = useRef(0);
  const submitRequestInFlightRef = useRef(false);
  const hasAdminEditedSystemPromptRef = useRef(false);
  const hasAdminEditedUserPromptRef = useRef(false);

  const form = useForm<AdminAiGenerationFormValues>({
    resolver: zodResolver(adminAiGenerationFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: getInitialValues(
      type,
      documents,
      targetGrade,
      initialGenerationConfiguration,
    ),
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
    const values = getInitialValues(
      type,
      documents,
      targetGrade,
      initialGenerationConfiguration,
    );
    hasAdminEditedSystemPromptRef.current =
      initialGenerationConfiguration !== null &&
      initialGenerationConfiguration !== undefined &&
      values.systemInstructions.trim().length > 0;
    hasAdminEditedUserPromptRef.current =
      initialGenerationConfiguration !== null &&
      initialGenerationConfiguration !== undefined &&
      values.userPrompt.trim().length > 0;
    form.reset(values);
    resetPreview();
    setPreviewErrorMessage(null);
    setSummaryPreviewTab("system");
    setSummaryPreviewData(null);
    if ((type === "SUMMARY" || type === "QUIZ") && values.documentIds.length > 0) {
      previewRequestInFlightRef.current = true;
      setIsPreviewRequestPending(true);
      void previewPrompt(
        toPromptPreviewPayload(values, {
          aiConfigurationCapability: getModelConfigurationCapability(
            initialModelConfiguration,
            values.summaryModel,
          ),
          quizTargetSetId,
        }),
      )
        .then((data) => {
          if (requestSequence !== previewRequestSequenceRef.current) return;
          setSummaryPreviewData(data);
          if (!hasAdminEditedSystemPromptRef.current) {
            form.setValue("systemInstructions", data.systemPrompt, {
              shouldValidate: true,
            });
          }
          if (!hasAdminEditedUserPromptRef.current) {
            form.setValue("userPrompt", data.userPrompt, {
              shouldValidate: true,
            });
          }
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
        .catch((error: unknown) => {
          if (requestSequence !== previewRequestSequenceRef.current) return;
          setPreviewErrorMessage(
            getUserFacingErrorMessage(
              error,
              "Chưa thể chuẩn bị dữ liệu tạo nội dung. Vui lòng thử lại.",
            ),
          );
        })
        .finally(() => {
          if (requestSequence === previewRequestSequenceRef.current) {
            previewRequestInFlightRef.current = false;
            setIsPreviewRequestPending(false);
          }
        });
    }
  }, [
    documents,
    form,
    initialGenerationConfiguration,
    isOpen,
    initialModelConfiguration,
    previewPrompt,
    quizTargetSetId,
    resetPreview,
    targetGrade,
    type,
  ]);

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
  const easyCountField = form.register("easyCount");
  const mediumCountField = form.register("mediumCount");
  const hardCountField = form.register("hardCount");
  const targetWordCountField = form.register("summaryTargetWordCount");
  const temperatureField = form.register("summaryTemperature");
  const maxOutputTokensField = form.register("summaryMaxOutputTokens");

  const selectedModelId = form.watch("summaryModel");
  const previewConfiguration = summaryPreviewData?.configuration;
  const modelConfiguration =
    previewConfiguration ?? (type === "SUMMARY" ? initialModelConfiguration : undefined);
  const selectedModelInfo = modelConfiguration?.modelOptions?.find(
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
  const isDialogBusy = isSubmitting || isPreparingSubmission;

  async function refreshSummaryPreview() {
    if (previewRequestInFlightRef.current || isDialogBusy) return;
    if (!validateModelSelection()) return;
    previewRequestInFlightRef.current = true;
    setIsPreviewRequestPending(true);
    setPreviewErrorMessage(null);
    const requestSequence = ++previewRequestSequenceRef.current;
    try {
      const previewFields: Array<keyof AdminAiGenerationFormValues> = [
        "documentIds",
        "useTextbookSourceImages",
        "autoEnhanceTextbookSourceImages",
        "styleInstructions",
        "summaryLength",
        "summaryTargetWordCount",
        "extraInstructions",
        "systemInstructions",
        "userPrompt",
        "summaryModel",
        "summaryTemperature",
        "summaryReasoningEffort",
        "summaryMaxOutputTokens",
      ];
      if (type === "QUIZ") {
        previewFields.push(
          "count",
          "difficulty",
          "easyCount",
          "mediumCount",
          "hardCount",
          "questionTypes",
        );
      }
      const isValid = await form.trigger(previewFields);
      if (
        !isValid ||
        (form.getValues("type") !== "SUMMARY" && form.getValues("type") !== "QUIZ")
      )
        return;
      const previewValues = form.getValues();
      const promptPreviewValues = preparePromptPreviewValues(previewValues, {
        preserveSystemPrompt: hasAdminEditedSystemPromptRef.current,
        preserveUserPrompt: hasAdminEditedUserPromptRef.current,
      });
      const preview = await previewPrompt(
        toPromptPreviewPayload(promptPreviewValues, {
          aiConfigurationCapability,
          quizTargetSetId,
        }),
      );
      if (requestSequence !== previewRequestSequenceRef.current) return;
      setSummaryPreviewData(preview);
      if (!hasAdminEditedSystemPromptRef.current) {
        form.setValue("systemInstructions", preview.systemPrompt, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (!hasAdminEditedUserPromptRef.current) {
        form.setValue("userPrompt", preview.userPrompt, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setTimeout(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTo({
            top: scrollViewportRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 50);
    } catch (error) {
      if (requestSequence !== previewRequestSequenceRef.current) return;
      setPreviewErrorMessage(
        getUserFacingErrorMessage(
          error,
          "Chưa thể chuẩn bị dữ liệu tạo nội dung. Vui lòng thử lại.",
        ),
      );
    } finally {
      if (requestSequence === previewRequestSequenceRef.current) {
        previewRequestInFlightRef.current = false;
        setIsPreviewRequestPending(false);
      }
    }
  }

  function validateModelSelection() {
    if (
      (type === "SUMMARY" || type === "QUIZ") &&
      !form.getValues("summaryModel") &&
      !modelConfiguration?.isDefaultConfigured
    ) {
      form.setError("summaryModel", { message: "Vui lòng chọn model" });
      window.requestAnimationFrame(() => {
        document.getElementById("ai-summary-model")?.focus();
      });
      return false;
    }
    form.clearErrors("summaryModel");
    return true;
  }

  return (
    <EditorDialogShell
      ariaLabel={title}
      isOpen={isOpen}
      onClose={() => !isDialogBusy && onClose()}
      panelClassName={type === "SUMMARY" || type === "QUIZ" ? "max-w-3xl" : "max-w-xl"}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(async (values) => {
          if (
            submitRequestInFlightRef.current ||
            isDialogBusy ||
            isPreviewRequestPending
          ) {
            return;
          }
          if (
            (type === "SUMMARY" || type === "QUIZ") &&
            !values.summaryModel &&
            !modelConfiguration?.isDefaultConfigured
          ) {
            validateModelSelection();
            return;
          }
          if (
            (type === "SUMMARY" || type === "QUIZ") &&
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
            let submissionValues = values;
            let currentPreviewForSubmission: AdminLessonSummaryPromptPreview | null =
              null;
            if (type === "SUMMARY" || type === "QUIZ") {
              setIsPreparingSubmission(true);
              setPreviewErrorMessage(null);
              const promptsAreVerbatim = type === "SUMMARY";
              const hasCustomSystemInstructions = hasAdminEditedSystemPromptRef.current;
              const hasCustomUserPrompt = hasAdminEditedUserPromptRef.current;
              const promptPreviewValues = preparePromptPreviewValues(values, {
                preserveSystemPrompt: promptsAreVerbatim || hasCustomSystemInstructions,
                preserveUserPrompt: promptsAreVerbatim || hasCustomUserPrompt,
              });

              let currentPreview: AdminLessonSummaryPromptPreview;
              try {
                currentPreview = await previewPrompt(
                  toPromptPreviewPayload(promptPreviewValues, {
                    aiConfigurationCapability,
                    quizTargetSetId,
                  }),
                );
              } catch (error) {
                setPreviewErrorMessage(
                  getUserFacingErrorMessage(
                    error,
                    "Chưa thể chuẩn bị dữ liệu tạo nội dung. Vui lòng thử lại.",
                  ),
                );
                return;
              }

              setSummaryPreviewData(currentPreview);
              currentPreviewForSubmission = currentPreview;
              submissionValues = {
                ...values,
                systemInstructions: promptsAreVerbatim
                  ? values.systemInstructions
                  : hasCustomSystemInstructions
                    ? values.systemInstructions
                    : currentPreview.systemPrompt,
                userPrompt: promptsAreVerbatim
                  ? values.userPrompt
                  : hasCustomUserPrompt
                    ? values.userPrompt
                    : currentPreview.userPrompt,
              };
              if (!promptsAreVerbatim && !hasCustomSystemInstructions) {
                form.setValue("systemInstructions", currentPreview.systemPrompt, {
                  shouldValidate: true,
                });
              }
              if (!promptsAreVerbatim && !hasCustomUserPrompt) {
                form.setValue("userPrompt", currentPreview.userPrompt, {
                  shouldValidate: true,
                });
              }
            }
            const payload = toPayload(submissionValues, {
              aiConfigurationCapability,
              quizTargetSetId,
            });
            await onSubmit(
              payload.type === "SUMMARY" && currentPreviewForSubmission
                ? {
                    ...payload,
                    requestDraftId: currentPreviewForSubmission.requestDraftId,
                    requestHash: currentPreviewForSubmission.requestHash,
                  }
                : payload,
            );
          } finally {
            setIsPreparingSubmission(false);
            submitRequestInFlightRef.current = false;
          }
        }, validateModelSelection)}
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
          {type === "SUMMARY" || type === "QUIZ" ? (
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

              {type === "SUMMARY" ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)]">
                    <CheckboxField
                      id="ai-summary-use-textbook-source-images"
                      label="Dùng ảnh gốc sách giáo khoa"
                      labelClassName="border-0"
                      checked={form.watch("useTextbookSourceImages")}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        form.setValue("useTextbookSourceImages", checked, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        if (!checked) {
                          form.setValue("autoEnhanceTextbookSourceImages", false, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                    />
                  </div>
                  {form.watch("useTextbookSourceImages") ? (
                    <div className="ml-3 rounded-xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/20">
                      <CheckboxField
                        id="ai-summary-auto-enhance-textbook-source-images"
                        label="Tự động làm nét ảnh"
                        labelClassName="border-0"
                        checked={form.watch("autoEnhanceTextbookSourceImages")}
                        error={form.formState.errors.autoEnhanceTextbookSourceImages}
                        onChange={(event) =>
                          form.setValue(
                            "autoEnhanceTextbookSourceImages",
                            event.currentTarget.checked,
                            {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            },
                          )
                        }
                      />
                      <p className="-mt-1 px-4 pb-3 text-xs font-semibold leading-5 text-[var(--theme-text-muted)]">
                        Giảm nhiễu và làm nét toàn bộ ảnh sách giáo khoa trước khi lưu.
                        Không tăng số lượt gọi AI.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {type === "QUIZ" ? (
                <>
                  <div className="rounded-xl border border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] p-3 text-sm font-semibold text-[var(--theme-info-text)]">
                    Các câu AI sẽ được thêm vào “
                    {summaryPreviewData?.configuration.targetQuizSet?.title ??
                      "Bộ câu hỏi 1"}
                    ” và hiển thị trong danh sách câu hỏi bên dưới, không tạo tab mới.
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="ai-generation-count"
                      label="Số câu hỏi"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      icon={null}
                      error={form.formState.errors.count}
                      {...countField}
                      onChange={numericChange(countField.onChange)}
                    />
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
                  </div>
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Chọn nhanh số câu Quiz"
                  >
                    {[1, 5, 10].map((questionCount) => (
                      <button
                        key={questionCount}
                        type="button"
                        onClick={() => {
                          const counts = getBalancedDifficultyCounts(questionCount);
                          form.setValue("count", String(questionCount), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          form.setValue("easyCount", String(counts.easy), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          form.setValue("mediumCount", String(counts.medium), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          form.setValue("hardCount", String(counts.hard), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        className={cn(
                          "min-h-9 rounded-lg border px-3 text-xs font-extrabold transition",
                          form.watch("count") === String(questionCount)
                            ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
                            : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]",
                        )}
                      >
                        {questionCount} câu
                      </button>
                    ))}
                  </div>
                  {form.watch("difficulty") === "MIXED" ? (
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                        Số câu theo độ khó
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <TextField
                          id="ai-quiz-easy-count"
                          label="Dễ"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          icon={null}
                          error={form.formState.errors.easyCount}
                          {...easyCountField}
                          onChange={numericChange(easyCountField.onChange, () =>
                            form.trigger(["easyCount", "mediumCount", "hardCount"]),
                          )}
                        />
                        <TextField
                          id="ai-quiz-medium-count"
                          label="Trung bình"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          icon={null}
                          error={form.formState.errors.mediumCount}
                          {...mediumCountField}
                          onChange={numericChange(mediumCountField.onChange, () =>
                            form.trigger(["easyCount", "mediumCount", "hardCount"]),
                          )}
                        />
                        <TextField
                          id="ai-quiz-hard-count"
                          label="Khó"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          icon={null}
                          error={form.formState.errors.hardCount}
                          {...hardCountField}
                          onChange={numericChange(hardCountField.onChange, () =>
                            form.trigger(["easyCount", "mediumCount", "hardCount"]),
                          )}
                        />
                      </div>
                    </fieldset>
                  ) : null}
                </>
              ) : null}

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

              {type === "SUMMARY" ? (
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
              ) : null}
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
                    ...(modelConfiguration?.isDefaultConfigured
                      ? [{ value: "", label: "Tự động theo Cài đặt AI" }]
                      : []),
                    ...(modelConfiguration?.modelOptions ?? []).map((option) => ({
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
                    if (value || modelConfiguration?.isDefaultConfigured) {
                      form.clearErrors("summaryModel");
                    } else {
                      form.setError("summaryModel", { message: "Vui lòng chọn model" });
                    }
                    const nextModel = modelConfiguration?.modelOptions.find(
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
                    isDialogBusy ||
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

              {previewErrorMessage ? (
                <div
                  role="alert"
                  className="rounded-xl border border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] p-3 text-sm font-semibold text-[var(--theme-error-text)]"
                >
                  {previewErrorMessage}
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
                    promptsAreVerbatim={type === "SUMMARY"}
                    systemInstructions={form.watch("systemInstructions")}
                    userPrompt={form.watch("userPrompt")}
                    model={form.watch("summaryModel")}
                    temperature={form.watch("summaryTemperature")}
                    reasoningEffort={form.watch("summaryReasoningEffort")}
                    maxOutputTokens={form.watch("summaryMaxOutputTokens")}
                    systemInstructionsError={form.formState.errors.systemInstructions}
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
    useTextbookSourceImages: false,
    autoEnhanceTextbookSourceImages: false,
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
    easyCount: "3",
    mediumCount: "3",
    hardCount: "2",
  };
}

function getInitialValues(
  type: AdminAiGenerationType,
  documents: AdminAiPanelDocument[],
  targetGrade: number | null,
  initialConfiguration?: Record<string, unknown> | null,
): AdminAiGenerationFormValues {
  const defaults = getDefaultValues(type, documents, targetGrade);
  if (type !== "SUMMARY" || !initialConfiguration) return defaults;

  const availableDocumentIds = new Set(
    documents.filter((document) => document.canUseForSummary).map((document) => document.id),
  );
  const restoredDocumentIds = readStringArray(initialConfiguration.documentIds).filter(
    (documentId) => availableDocumentIds.has(documentId),
  );
  const restoredStyle = isSummaryStyle(initialConfiguration.style)
    ? initialConfiguration.style
    : defaults.style;
  const useTextbookSourceImages = readBoolean(
    initialConfiguration.useTextbookSourceImages,
    defaults.useTextbookSourceImages,
  );

  return {
    ...defaults,
    documentIds:
      restoredDocumentIds.length > 0 ? restoredDocumentIds : defaults.documentIds,
    useTextbookSourceImages,
    autoEnhanceTextbookSourceImages:
      useTextbookSourceImages &&
      readBoolean(
        initialConfiguration.autoEnhanceTextbookSourceImages,
        defaults.autoEnhanceTextbookSourceImages,
      ),
    style: restoredStyle,
    styleInstructions: readString(
      initialConfiguration.styleInstructions,
      getPresentationPreset(restoredStyle, targetGrade),
    ),
    summaryLength: isSummaryLength(initialConfiguration.length)
      ? initialConfiguration.length
      : defaults.summaryLength,
    summaryTargetWordCount: readNumericText(initialConfiguration.targetWordCount),
    extraInstructions: readString(
      initialConfiguration.extraInstructions,
      defaults.extraInstructions,
    ),
    systemInstructions: readString(
      initialConfiguration.systemInstructions,
      defaults.systemInstructions,
    ),
    userPrompt: readString(initialConfiguration.userPrompt, defaults.userPrompt),
    summaryModel: readString(initialConfiguration.model, defaults.summaryModel),
    summaryTemperature: readNumericText(initialConfiguration.temperature),
    summaryReasoningEffort: isAiReasoningEffort(initialConfiguration.reasoningEffort)
      ? initialConfiguration.reasoningEffort
      : defaults.summaryReasoningEffort,
    summaryMaxOutputTokens: readNumericText(initialConfiguration.maxOutputTokens),
  };
}

function getModelConfigurationCapability(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  return configuration?.modelOptions.find((option) => option.model === model)?.capabilities
    ?.aiConfiguration;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumericText(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isSummaryStyle(value: unknown): value is AdminSummaryStyle {
  return value === "student_friendly" || value === "concise" || value === "academic";
}

function isSummaryLength(value: unknown): value is AdminSummaryLength {
  return value === "short" || value === "standard" || value === "detailed";
}

function toPayload(
  values: AdminAiGenerationFormValues,
  options?: {
    aiConfigurationCapability?: AdminAiConfigurationCapability;
    quizTargetSetId?: string;
  },
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
    return toQuizPayload(values, {
      aiConfigurationCapability: options?.aiConfigurationCapability,
      quizTargetSetId: options?.quizTargetSetId,
    });
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

function toPromptPreviewPayload(
  values: AdminAiGenerationFormValues,
  options: {
    aiConfigurationCapability?: AdminAiConfigurationCapability;
    quizTargetSetId?: string;
  } = {},
) {
  return values.type === "QUIZ"
    ? toQuizPayload(values, options)
    : toSummaryPayload(values, options);
}

function preparePromptPreviewValues(
  values: AdminAiGenerationFormValues,
  options: {
    preserveSystemPrompt: boolean;
    preserveUserPrompt: boolean;
  },
): AdminAiGenerationFormValues {
  return {
    ...values,
    systemInstructions: options.preserveSystemPrompt ? values.systemInstructions : "",
    userPrompt: options.preserveUserPrompt ? values.userPrompt : "",
  };
}

function toQuizPayload(
  values: AdminAiGenerationFormValues,
  options: {
    aiConfigurationCapability?: AdminAiConfigurationCapability;
    quizTargetSetId?: string;
  } = {},
): AdminQuizGenerationPayload {
  const extraInstructions = values.extraInstructions.trim();
  const styleInstructions = values.styleInstructions.trim();
  const systemInstructions = values.systemInstructions.trim();
  const userPrompt = values.userPrompt.trim();
  return {
    type: "QUIZ",
    ...(options.quizTargetSetId ? { targetQuizSetId: options.quizTargetSetId } : {}),
    documentIds: values.documentIds,
    questionCount: Number(values.count),
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
    questionTypes: values.questionTypes,
    style: values.style,
    ...(styleInstructions ? { styleInstructions } : {}),
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

function toSummaryPayload(
  values: AdminAiGenerationFormValues,
  options: {
    aiConfigurationCapability?: AdminAiConfigurationCapability;
  } = {},
): AdminSummaryGenerationPayload {
  const extraInstructions = values.extraInstructions.trim();
  const styleInstructions = values.styleInstructions.trim();
  const systemInstructions = values.systemInstructions;
  const userPrompt = values.userPrompt;
  return {
    type: "SUMMARY",
    documentIds: values.documentIds,
    ...(values.useTextbookSourceImages ? { useTextbookSourceImages: true } : {}),
    ...(values.useTextbookSourceImages && values.autoEnhanceTextbookSourceImages
      ? { autoEnhanceTextbookSourceImages: true }
      : {}),
    style: values.style,
    ...(styleInstructions ? { styleInstructions } : {}),
    length: values.summaryLength,
    ...(values.summaryTargetWordCount
      ? { targetWordCount: Number(values.summaryTargetWordCount) }
      : {}),
    ...(extraInstructions ? { extraInstructions } : {}),
    ...(systemInstructions.trim() ? { systemInstructions } : {}),
    ...(userPrompt.trim() ? { userPrompt } : {}),
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
    ? "Dễ hiểu, gần gũi, sử dụng cách diễn đạt và mức độ chi tiết phù hợp lứa tuổi."
    : "Dễ hiểu, gần gũi và phù hợp với người học của khóa học.";
}

function getBalancedDifficultyCounts(questionCount: number) {
  const medium = Math.ceil(questionCount / 3);
  const easy = Math.ceil((questionCount - medium) / 2);
  return {
    easy,
    medium,
    hard: questionCount - easy - medium,
  };
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
