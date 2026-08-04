"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, type ChangeEvent } from "react";
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
  AdminAiPanelDocument,
  AdminAiQuestionType,
  AdminSummaryContentSection,
  AdminSummaryGenerationPayload,
  AdminSummaryLength,
  AdminSummaryStyle,
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
const summaryContentOptions: Array<{
  value: AdminSummaryContentSection;
  label: string;
}> = [
  { value: "KEY_CONCEPTS", label: "Kiến thức trọng tâm" },
  { value: "FORMULAS", label: "Công thức quan trọng" },
  { value: "SOLUTION_METHODS", label: "Cách giải" },
  { value: "EXAMPLES", label: "Ví dụ minh họa" },
  { value: "COMMON_MISTAKES", label: "Lỗi thường gặp" },
  { value: "MEMORY_TIPS", label: "Mẹo ghi nhớ" },
  { value: "SPECIAL_CASES", label: "Trường hợp đặc biệt" },
];

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
  const form = useForm<AdminAiGenerationFormValues>({
    resolver: zodResolver(adminAiGenerationFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: getDefaultValues(type, documents, targetGrade),
  });

  useEffect(() => {
    if (isOpen) {
      const defaults = getDefaultValues(type, documents, targetGrade);
      form.reset(defaults);
      resetPreview();
      if (type === "SUMMARY" && defaults.documentIds.length > 0) {
        void previewPrompt(toSummaryPayload(defaults))
          .then((preview) => {
            form.setValue(
              "summaryTemperature",
              String(preview.configuration.temperature),
            );
            form.setValue(
              "summaryMaxOutputTokens",
              String(preview.configuration.maxOutputTokens),
            );
            form.setValue("systemInstructions", preview.systemPrompt);
            form.setValue("userPrompt", preview.userPrompt);
          })
          .catch(() => {
            // Mutation state renders the recoverable preview error in the dialog.
          });
      }
    }
  }, [documents, form, isOpen, previewPrompt, resetPreview, targetGrade, type]);

  const title = {
    SUMMARY: "Tạo tóm tắt bằng AI",
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

  async function refreshSummaryPreview() {
    const isValid = await form.trigger([
      "documentIds",
      "styleInstructions",
      "summaryLength",
      "summaryTargetWordCount",
      "summaryFocus",
      "extraInstructions",
      "systemInstructions",
      "summaryTemperature",
      "summaryMaxOutputTokens",
    ]);
    if (!isValid || form.getValues("type") !== "SUMMARY") {
      return;
    }
    try {
      const preview = await previewMutation.mutateAsync(
        toSummaryPayload(form.getValues(), { includeUserPrompt: false }),
      );
      form.setValue("userPrompt", preview.userPrompt, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch {
      // React Query exposes the error state directly in the dialog.
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
        onSubmit={form.handleSubmit(async (values) => onSubmit(toPayload(values)))}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {title}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
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
                  label="Độ dài tóm tắt"
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
                id="ai-summary-focus"
                label="Trọng tâm cần ưu tiên"
                placeholder="Ví dụ: tập trung vào định nghĩa và cách biểu diễn số hữu tỉ"
                isOptional
                optionalLabel="Không bắt buộc"
                className="min-h-24"
                error={form.formState.errors.summaryFocus}
                {...form.register("summaryFocus")}
              />
              <fieldset className="space-y-2">
                <legend className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  Nội dung cần có
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {summaryContentOptions.map((option) => (
                    <CheckboxField
                      key={option.value}
                      id={`ai-summary-content-${option.value}`}
                      label={option.label}
                      checked={form.watch("contentSections").includes(option.value)}
                      onChange={(event) =>
                        updateSummaryContentSections(
                          form,
                          option.value,
                          event.currentTarget.checked,
                        )
                      }
                    />
                  ))}
                </div>
              </fieldset>
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
                    { value: "", label: "Tự động theo Cài đặt AI" },
                    ...(previewMutation.data?.configuration.modelOptions ?? []).map(
                      (option) => ({
                        value: option.model,
                        label: `${formatProviderLabel(option.provider)} · ${option.model}${
                          option.available ? "" : " · Chưa khả dụng"
                        }`,
                        disabled: !option.available,
                      }),
                    ),
                  ]}
                  icon={null}
                  error={form.formState.errors.summaryModel}
                  onChange={(value) =>
                    form.setValue("summaryModel", value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                />
                <TextField
                  id="ai-summary-temperature"
                  label="Temperature"
                  inputMode="decimal"
                  icon={null}
                  helperText="Mặc định lấy từ Cài đặt AI."
                  error={form.formState.errors.summaryTemperature}
                  {...temperatureField}
                  onChange={decimalChange(temperatureField.onChange)}
                />
              </div>
              <TextField
                id="ai-summary-max-output-tokens"
                label="Giới hạn token đầu ra"
                inputMode="numeric"
                pattern="[0-9]*"
                icon={null}
                helperText="Mặc định lấy từ Cài đặt AI."
                error={form.formState.errors.summaryMaxOutputTokens}
                {...maxOutputTokensField}
                onChange={numericChange(maxOutputTokensField.onChange)}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
                  Xem lại dữ liệu theo các lựa chọn hiện tại.
                </p>
                <button
                  type="button"
                  disabled={previewMutation.isPending}
                  onClick={() => void refreshSummaryPreview()}
                  className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", previewMutation.isPending && "animate-spin")}
                    aria-hidden="true"
                  />
                  {previewMutation.isPending
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
              {previewMutation.isPending && !previewMutation.data ? (
                <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Đang tải dữ liệu...
                </div>
              ) : null}
              {previewMutation.data ? (
                <AdminSummaryPromptPreview
                  preview={previewMutation.data}
                  systemInstructions={form.watch("systemInstructions")}
                  userPrompt={form.watch("userPrompt")}
                  model={form.watch("summaryModel")}
                  temperature={form.watch("summaryTemperature")}
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
                />
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
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:cursor-wait disabled:opacity-60 sm:w-auto"
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
          document.canUseForSummary &&
          document.kind === "PRIMARY_FROM_SOURCE",
      )
      .map((document) => document.id),
    style: "student_friendly",
    styleInstructions: getPresentationPreset("student_friendly", targetGrade),
    summaryLength: "standard",
    summaryTargetWordCount: "",
    summaryFocus: "",
    includeFormulas: true,
    includeExamples: true,
    includeCommonMistakes: true,
    contentSections: [
      "KEY_CONCEPTS",
      "FORMULAS",
      "SOLUTION_METHODS",
      "EXAMPLES",
      "COMMON_MISTAKES",
    ],
    reviewQuestionCount: "0",
    extraInstructions: "",
    systemInstructions: "",
    userPrompt: "",
    summaryModel: "",
    summaryTemperature: "",
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

function toPayload(values: AdminAiGenerationFormValues): AdminAiGenerationPayload {
  if (values.type === "SUMMARY") {
    return toSummaryPayload(values);
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
  options: { includeUserPrompt?: boolean } = {},
): AdminSummaryGenerationPayload {
  const focus = values.summaryFocus.trim();
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
    ...(focus ? { focus } : {}),
    includeFormulas: values.includeFormulas,
    includeExamples: values.includeExamples,
    includeCommonMistakes: values.includeCommonMistakes,
    contentSections: values.contentSections,
    reviewQuestionCount: 0,
    ...(extraInstructions ? { extraInstructions } : {}),
    ...(systemInstructions ? { systemInstructions } : {}),
    ...(userPrompt ? { userPrompt } : {}),
    ...(values.summaryModel ? { model: values.summaryModel } : {}),
    ...(values.summaryTemperature
      ? { temperature: Number(values.summaryTemperature) }
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

function updateSummaryContentSections(
  form: ReturnType<typeof useForm<AdminAiGenerationFormValues>>,
  section: AdminSummaryContentSection,
  checked: boolean,
) {
  const current = form.getValues("contentSections");
  form.setValue(
    "contentSections",
    checked ? [...current, section] : current.filter((item) => item !== section),
    { shouldDirty: true, shouldTouch: true, shouldValidate: true },
  );
  if (section === "FORMULAS") {
    form.setValue("includeFormulas", checked, { shouldDirty: true });
  }
  if (section === "EXAMPLES") {
    form.setValue("includeExamples", checked, { shouldDirty: true });
  }
  if (section === "COMMON_MISTAKES") {
    form.setValue("includeCommonMistakes", checked, { shouldDirty: true });
  }
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
