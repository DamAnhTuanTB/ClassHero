"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { tiptapTextDocumentSchema, type TiptapTextDocument } from "@learning-path/shared";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { FieldLabel } from "@/components/common/forms/field-label";
import { OptionField } from "@/components/common/forms/option-field";
import { ImmediateTooltip } from "@/components/common/ui/immediate-tooltip";
import type {
  AdminMultiStatementAnswer,
  AdminQuizQuestion,
  AdminQuizQuestionPayload,
} from "@/features/admin/quiz/api/admin-quiz-api";
import {
  QuizRichContentEditor,
  ScientificAnswerField,
} from "@/features/admin/quiz/components/quiz-rich-content-editor";
import {
  ADMIN_QUIZ_FIGURE_ROLES,
  AdminQuizFigureUploadFields,
  type AdminQuizDraftFigureFiles,
  type AdminQuizFigureRole,
} from "@/features/admin/quiz/components/admin-quiz-figure-upload-fields";
import {
  useAdminQuizFigureUpload,
  useAdminQuizQuestionMutations,
} from "@/features/admin/quiz/hooks/use-admin-quiz";
import type { AdminTestQuestion } from "@/features/admin/tests/api/admin-tests-api";
import { useAdminTestQuestionMutations } from "@/features/admin/tests/hooks/use-admin-tests";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import {
  createEmptyTiptapDocument,
  getTiptapDocumentText,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import { cn } from "@/lib/utils";

const requiredQuestionContentSchema = tiptapTextDocumentSchema.refine(
  hasTiptapDocumentContent,
  "Hãy nhập nội dung câu hỏi",
);

const optionSchema = z.object({
  optionId: z.string().min(1),
  content: tiptapTextDocumentSchema,
});

const statementSchema = z.object({
  statementId: z.string().min(1),
  content: tiptapTextDocumentSchema,
  answer: z.enum(["true", "false"]),
});

const TRUE_FALSE_OPTIONS = [
  { value: "true", label: "Đúng" },
  { value: "false", label: "Sai" },
] as const;

const questionFormSchema = z
  .object({
    questionType: z.enum([
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "MULTI_STATEMENT_TRUE_FALSE",
      "TEXT_INPUT",
    ]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    questionContent: requiredQuestionContentSchema,
    options: z.array(optionSchema),
    correctOptionId: z.string(),
    trueFalseAnswer: z.enum(["true", "false"]),
    statements: z.array(statementSchema),
    acceptedAnswer: z.string(),
    hintContent: tiptapTextDocumentSchema,
    explanationContent: tiptapTextDocumentSchema,
  })
  .superRefine((value, context) => {
    if (value.questionType === "MULTIPLE_CHOICE") {
      if (value.options.length < 2) {
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: "Cần ít nhất 2 phương án",
        });
      }

      value.options.forEach((option, index) => {
        if (!hasTiptapDocumentContent(option.content)) {
          context.addIssue({
            code: "custom",
            path: ["options", index, "content"],
            message: "Hãy nhập nội dung phương án",
          });
        }
      });

      const normalizedOptions = value.options
        .filter((option) => hasTiptapDocumentContent(option.content))
        .map((option) => getTiptapDocumentText(option.content).toLocaleLowerCase("vi"));
      if (new Set(normalizedOptions).size !== normalizedOptions.length) {
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: "Các phương án không được trùng nhau",
        });
      }

      if (
        !value.correctOptionId ||
        !value.options.some((option) => option.optionId === value.correctOptionId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["correctOptionId"],
          message: "Hãy chọn một phương án đúng",
        });
      }
    }

    if (value.questionType === "MULTI_STATEMENT_TRUE_FALSE") {
      if (value.statements.length < 2) {
        context.addIssue({
          code: "custom",
          path: ["statements"],
          message: "Cần ít nhất 2 mệnh đề",
        });
      }

      const statementIds = value.statements.map((statement) => statement.statementId);
      if (new Set(statementIds).size !== statementIds.length) {
        context.addIssue({
          code: "custom",
          path: ["statements"],
          message: "Mã mệnh đề không được trùng nhau",
        });
      }

      value.statements.forEach((statement, index) => {
        if (!hasTiptapDocumentContent(statement.content)) {
          context.addIssue({
            code: "custom",
            path: ["statements", index, "content"],
            message: "Hãy nhập nội dung mệnh đề",
          });
        }
      });
    }

    if (value.questionType === "TEXT_INPUT" && !value.acceptedAnswer.trim()) {
      context.addIssue({
        code: "custom",
        path: ["acceptedAnswer"],
        message: "Hãy nhập đáp án đúng",
      });
    }
  });

type QuestionFormValues = z.infer<typeof questionFormSchema>;

export function AdminAssessmentQuestionEditorDialog({
  assessmentKind = "quiz",
  isOpen,
  lessonId,
  question,
  setId,
  onClose,
}: {
  assessmentKind?: "quiz" | "test";
  isOpen: boolean;
  lessonId: string;
  question: AdminQuizQuestion | AdminTestQuestion | null;
  setId: string;
  onClose: () => void;
}) {
  const { createQuestion, updateQuestion } = useAdminQuizQuestionMutations(
    setId,
    lessonId,
  );
  const uploadQuizFigure = useAdminQuizFigureUpload(setId);
  const quizQuestion =
    assessmentKind === "quiz" ? (question as AdminQuizQuestion | null) : null;
  const [draftFigureFiles, setDraftFigureFiles] = useState<AdminQuizDraftFigureFiles>({});
  const [isUploadingNewQuestionFigures, setIsUploadingNewQuestionFigures] =
    useState(false);
  const { createQuestion: createTestQuestion, updateQuestion: updateTestQuestion } =
    useAdminTestQuestionMutations(setId, lessonId);
  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema) as Resolver<QuestionFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: question ? toFormValues(question) : createEmptyDefaults(),
  });
  const options = useFieldArray({ control: form.control, name: "options" });
  const statements = useFieldArray({
    control: form.control,
    name: "statements",
  });
  const questionType = form.watch("questionType");
  const correctOptionId = form.watch("correctOptionId");
  const statementValues = form.watch("statements");
  const isSaving =
    isUploadingNewQuestionFigures ||
    (assessmentKind === "test"
      ? createTestQuestion.isPending || updateTestQuestion.isPending
      : createQuestion.isPending || updateQuestion.isPending);

  useEffect(() => {
    if (!isOpen) return;
    form.reset(question ? toFormValues(question) : createEmptyDefaults());
    setDraftFigureFiles({});
  }, [form, isOpen, question]);

  const selectQuizFigureFile = async (role: AdminQuizFigureRole, file: File) => {
    if (!quizQuestion) {
      setDraftFigureFiles((current) => ({ ...current, [role]: file }));
      return;
    }

    try {
      await uploadQuizFigure.mutateAsync({
        questionId: quizQuestion.id,
        role,
        file,
        altText: getQuizFigureAltText(role),
      });
      toast.success("Đã cập nhật hình Quiz");
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa thể tải hình Quiz lên."));
    }
  };

  const uploadDraftFigures = async (questionId: string) => {
    const failedRoles: AdminQuizFigureRole[] = [];
    setIsUploadingNewQuestionFigures(true);
    try {
      for (const role of ADMIN_QUIZ_FIGURE_ROLES) {
        const file = draftFigureFiles[role];
        if (!file) continue;
        try {
          await uploadQuizFigure.mutateAsync({
            questionId,
            role,
            file,
            altText: getQuizFigureAltText(role),
          });
        } catch {
          failedRoles.push(role);
        }
      }
    } finally {
      setIsUploadingNewQuestionFigures(false);
    }
    return failedRoles;
  };

  const submit = form.handleSubmit(async (values) => {
    const payload = toPayload(values);
    try {
      if (question) {
        if (assessmentKind === "test") {
          await updateTestQuestion.mutateAsync({
            questionId: question.id,
            data: payload,
          });
        } else {
          await updateQuestion.mutateAsync({
            questionId: question.id,
            data: payload,
          });
        }
        toast.success("Đã cập nhật câu hỏi");
      } else {
        if (assessmentKind === "test") {
          await createTestQuestion.mutateAsync(payload);
          toast.success("Đã thêm câu hỏi");
        } else {
          const createdQuestion = await createQuestion.mutateAsync(payload);
          const failedFigureRoles = await uploadDraftFigures(createdQuestion.id);
          if (failedFigureRoles.length > 0) {
            toast.warning(
              `Đã thêm câu hỏi nhưng chưa tải được ${failedFigureRoles
                .map(getQuizFigureRoleLabel)
                .join(" và ")}. Bạn có thể mở chỉnh sửa để tải lại.`,
            );
          } else {
            toast.success("Đã thêm câu hỏi");
          }
        }
      }
      onClose();
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa lưu được câu hỏi. Vui lòng thử lại."),
      );
    }
  });

  return (
    <EditorDialogShell
      ariaLabel={question ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi"}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <header className="theme-dialog-header shrink-0 px-5 py-5 pr-16 sm:px-6">
          <h2 className="text-xl font-extrabold text-[var(--theme-text-strong)]">
            {question ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
          </h2>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            Thiết lập nội dung, phương án, đáp án đúng, gợi ý và lời giải.
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionField
              id="quiz-question-type"
              label="Loại câu hỏi"
              value={questionType}
              options={[
                { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm" },
                { value: "TRUE_FALSE", label: "Đúng / Sai" },
                {
                  value: "MULTI_STATEMENT_TRUE_FALSE",
                  label: "Đúng / Sai nhiều mệnh đề",
                },
                { value: "TEXT_INPUT", label: "Nhập câu trả lời" },
              ]}
              onChange={(value) =>
                form.setValue(
                  "questionType",
                  value as QuestionFormValues["questionType"],
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  },
                )
              }
              icon={null}
            />
            <OptionField
              id="quiz-question-difficulty"
              label="Mức độ"
              value={form.watch("difficulty")}
              options={[
                { value: "EASY", label: "Dễ" },
                { value: "MEDIUM", label: "Trung bình" },
                { value: "HARD", label: "Khó" },
              ]}
              onChange={(value) =>
                form.setValue("difficulty", value as QuestionFormValues["difficulty"], {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
              icon={null}
            />
          </div>

          <div>
            <FieldLabel id="quiz-question-content" label="Nội dung câu hỏi" />
            <div className="mt-2">
              <Controller
                control={form.control}
                name="questionContent"
                render={({ field, fieldState }) => (
                  <QuizRichContentEditor
                    ariaLabel="Nội dung câu hỏi"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Nhập câu hỏi; có thể chèn công thức, ảnh, danh sách và định dạng văn bản..."
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>

          {assessmentKind === "quiz" ? (
            <AdminQuizFigureUploadFields
              question={quizQuestion}
              draftFiles={draftFigureFiles}
              disabled={uploadQuizFigure.isPending || isSaving}
              pendingRole={
                uploadQuizFigure.isPending ? uploadQuizFigure.variables?.role : undefined
              }
              onFileSelect={selectQuizFigureFile}
            />
          ) : null}

          {questionType === "MULTIPLE_CHOICE" ? (
            <section className="space-y-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                    Các phương án trả lời
                  </h3>
                  <p className="mt-1 text-xs font-medium text-[var(--theme-text-muted)]">
                    Tối thiểu 2 phương án, có thể thêm bao nhiêu tùy nhu cầu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    options.append({
                      optionId: createOptionId(),
                      content: createEmptyTiptapDocument(),
                    })
                  }
                  className="theme-button-primary-subtle inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-extrabold"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Thêm phương án
                </button>
              </div>

              <div className="space-y-3">
                {options.fields.map((field, index) => {
                  const isCorrect = correctOptionId === field.optionId;
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        "grid gap-2 rounded-xl border bg-[var(--theme-bg)] p-3 sm:grid-cols-[3.35rem_minmax(0,1fr)_2.5rem]",
                        isCorrect
                          ? "border-[var(--theme-primary)]"
                          : "border-[var(--theme-border)]",
                      )}
                    >
                      <input
                        type="hidden"
                        {...form.register(`options.${index}.optionId`)}
                      />
                      <button
                        type="button"
                        aria-label={`Chọn phương án ${optionLabel(index)} là đáp án đúng`}
                        aria-pressed={isCorrect}
                        onClick={() =>
                          form.setValue("correctOptionId", field.optionId, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }
                        className={cn(
                          "grid size-[3.35rem] place-items-center self-center rounded-lg border text-sm font-extrabold transition",
                          isCorrect
                            ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white dark:text-[var(--theme-primary-foreground)]"
                            : "border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]",
                        )}
                      >
                        {isCorrect ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          optionLabel(index)
                        )}
                      </button>
                      <Controller
                        control={form.control}
                        name={`options.${index}.content`}
                        render={({ field: optionField, fieldState }) => (
                          <QuizRichContentEditor
                            ariaLabel={`Phương án ${optionLabel(index)}`}
                            compact
                            value={optionField.value}
                            onChange={optionField.onChange}
                            onBlur={optionField.onBlur}
                            placeholder={`Nhập phương án ${optionLabel(index)}...`}
                            error={fieldState.error?.message}
                          />
                        )}
                      />
                      <button
                        type="button"
                        aria-label={`Xóa phương án ${optionLabel(index)}`}
                        disabled={options.fields.length <= 2}
                        onClick={() => {
                          if (correctOptionId === field.optionId) {
                            form.setValue("correctOptionId", "", {
                              shouldValidate: true,
                            });
                          }
                          options.remove(index);
                        }}
                        className="theme-button-danger-subtle grid h-10 w-10 place-items-center self-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <FormError
                message={
                  form.formState.errors.options?.root?.message ??
                  form.formState.errors.options?.message
                }
              />
              <FormError message={form.formState.errors.correctOptionId?.message} />
              <p className="text-xs font-semibold text-[var(--theme-text-muted)]">
                Bấm vào nhãn A, B, C… để chọn phương án đúng.
              </p>
            </section>
          ) : null}

          {questionType === "TRUE_FALSE" ? (
            <section className="space-y-3">
              <FieldLabel id="quiz-true-answer" label="Đáp án" />
              <div className="grid grid-cols-2 gap-3">
                {TRUE_FALSE_OPTIONS.map((option) => {
                  const selected = form.watch("trueFalseAnswer") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        form.setValue(
                          "trueFalseAnswer",
                          option.value as "true" | "false",
                          {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          },
                        )
                      }
                      className={cn(
                        "min-h-12 rounded-xl border px-4 text-sm font-extrabold transition",
                        selected
                          ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
                          : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)]",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {questionType === "MULTI_STATEMENT_TRUE_FALSE" ? (
            <section className="space-y-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                    Các mệnh đề Đúng / Sai
                  </h3>
                  <p className="mt-1 text-xs font-medium text-[var(--theme-text-muted)]">
                    Mỗi mệnh đề có một đáp án riêng và có trọng số bằng nhau.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    statements.append({
                      statementId: createStatementId(),
                      content: createEmptyTiptapDocument(),
                      answer: "true",
                    })
                  }
                  className="theme-button-primary-subtle inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-extrabold"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Thêm mệnh đề
                </button>
              </div>

              <div className="space-y-3">
                {statements.fields.map((field, index) => {
                  const selectedAnswer = statementValues[index]?.answer;
                  return (
                    <div
                      key={field.id}
                      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
                    >
                      <input
                        type="hidden"
                        {...form.register(`statements.${index}.statementId`)}
                      />
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                          Mệnh đề {index + 1}
                        </p>
                        <ImmediateTooltip
                          content={
                            statements.fields.length <= 2
                              ? "Cần giữ tối thiểu 2 mệnh đề"
                              : `Xóa mệnh đề ${index + 1}`
                          }
                        >
                          <button
                            type="button"
                            aria-label={`Xóa mệnh đề ${index + 1}`}
                            disabled={statements.fields.length <= 2}
                            onClick={() => statements.remove(index)}
                            className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </ImmediateTooltip>
                      </div>
                      <Controller
                        control={form.control}
                        name={`statements.${index}.content`}
                        render={({ field: statementField, fieldState }) => (
                          <QuizRichContentEditor
                            ariaLabel={`Nội dung mệnh đề ${index + 1}`}
                            compact
                            value={statementField.value}
                            onChange={statementField.onChange}
                            onBlur={statementField.onBlur}
                            placeholder={`Nhập mệnh đề ${index + 1}...`}
                            error={fieldState.error?.message}
                          />
                        )}
                      />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {TRUE_FALSE_OPTIONS.map((answerOption) => {
                          const selected = selectedAnswer === answerOption.value;
                          return (
                            <button
                              key={answerOption.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                form.setValue(
                                  `statements.${index}.answer`,
                                  answerOption.value as "true" | "false",
                                  {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                    shouldValidate: true,
                                  },
                                )
                              }
                              className={cn(
                                "min-h-10 rounded-lg border px-3 text-sm font-extrabold transition",
                                selected
                                  ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
                                  : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)]",
                              )}
                            >
                              {answerOption.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <FormError
                message={
                  form.formState.errors.statements?.root?.message ??
                  form.formState.errors.statements?.message
                }
              />
            </section>
          ) : null}

          {questionType === "TEXT_INPUT" ? (
            <section className="space-y-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  Đáp án đúng
                </h3>
                <p className="mt-1 text-xs font-medium text-[var(--theme-text-muted)]">
                  Nhập một đáp án chuẩn. Hệ thống tự chấp nhận các cách viết có cùng giá
                  trị.
                </p>
              </div>
              <Controller
                control={form.control}
                name="acceptedAnswer"
                render={({ field, fieldState }) => (
                  <ScientificAnswerField
                    id="text-input-correct-answer"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Nhập đáp án đúng"
                    error={fieldState.error?.message}
                  />
                )}
              />
            </section>
          ) : null}

          <div className="space-y-5">
            <div>
              <FieldLabel id="quiz-question-hint" label="Gợi ý" isOptional />
              <div className="mt-2">
                <Controller
                  control={form.control}
                  name="hintContent"
                  render={({ field }) => (
                    <QuizRichContentEditor
                      ariaLabel="Gợi ý"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Gợi ý ngắn; có thể chèn công thức, ảnh và định dạng..."
                    />
                  )}
                />
              </div>
            </div>
            <div>
              <FieldLabel
                id="quiz-question-explanation"
                label="Lời giải chi tiết"
                isOptional
              />
              <div className="mt-2">
                <Controller
                  control={form.control}
                  name="explanationContent"
                  render={({ field }) => (
                    <QuizRichContentEditor
                      ariaLabel="Lời giải chi tiết"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Giải thích cách suy luận; có thể chèn công thức, ảnh, danh sách và định dạng..."
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="theme-dialog-footer flex shrink-0 justify-end gap-2 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-extrabold"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : question ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : question ? "Lưu thay đổi" : "Thêm câu hỏi"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function FormError({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1.5 text-sm text-[var(--theme-error-text)]">
      {message}
    </p>
  ) : null;
}

function createEmptyDefaults(): QuestionFormValues {
  return {
    questionType: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    questionContent: createEmptyTiptapDocument(),
    options: [
      {
        optionId: createOptionId(),
        content: createEmptyTiptapDocument(),
      },
      {
        optionId: createOptionId(),
        content: createEmptyTiptapDocument(),
      },
      {
        optionId: createOptionId(),
        content: createEmptyTiptapDocument(),
      },
      {
        optionId: createOptionId(),
        content: createEmptyTiptapDocument(),
      },
    ],
    correctOptionId: "",
    trueFalseAnswer: "true",
    statements: [createEmptyStatement(), createEmptyStatement()],
    acceptedAnswer: "",
    hintContent: createEmptyTiptapDocument(),
    explanationContent: createEmptyTiptapDocument(),
  };
}

function toFormValues(
  question: AdminQuizQuestion | AdminTestQuestion,
): QuestionFormValues {
  const correctAnswers = getStringAnswers(question.correctAnswerJson);
  const statementAnswers = getMultiStatementAnswers(question.correctAnswerJson);
  const statementAnswerById = new Map(
    statementAnswers.map((answer) => [answer.statementId, answer.value]),
  );
  const emptyDefaults = createEmptyDefaults();
  return {
    questionType: question.questionType,
    difficulty: question.difficulty,
    questionContent: question.questionJson,
    options:
      question.questionType === "MULTIPLE_CHOICE" && question.optionsJson
        ? question.optionsJson.map((option) => ({
            optionId: option.id,
            content: option.richText,
          }))
        : emptyDefaults.options,
    correctOptionId: correctAnswers[0] ?? "",
    trueFalseAnswer: question.correctAnswerJson === false ? "false" : "true",
    statements:
      question.questionType === "MULTI_STATEMENT_TRUE_FALSE" &&
      question.optionsJson?.length
        ? question.optionsJson.map((statement) => ({
            statementId: statement.id,
            content: statement.richText,
            answer: statementAnswerById.get(statement.id) === false ? "false" : "true",
          }))
        : emptyDefaults.statements,
    acceptedAnswer:
      question.questionType === "TEXT_INPUT" ? (correctAnswers[0] ?? "") : "",
    hintContent: question.hintJson ?? createEmptyTiptapDocument(),
    explanationContent: question.explanation?.contentJson ?? createEmptyTiptapDocument(),
  };
}

function toPayload(values: QuestionFormValues): AdminQuizQuestionPayload {
  const base = {
    questionType: values.questionType,
    difficulty: values.difficulty,
    questionJson: values.questionContent,
    hintJson: toOptionalDocument(values.hintContent),
    explanationJson: toOptionalDocument(values.explanationContent),
  };

  if (values.questionType === "MULTIPLE_CHOICE") {
    const validOptions = values.options.filter((option) =>
      hasTiptapDocumentContent(option.content),
    );
    return {
      ...base,
      optionsJson: validOptions.map((option) => ({
        id: option.optionId,
        richText: option.content,
      })),
      correctAnswerJson: [values.correctOptionId],
    };
  }

  if (values.questionType === "TRUE_FALSE") {
    return {
      ...base,
      correctAnswerJson: values.trueFalseAnswer === "true",
    };
  }

  if (values.questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    return {
      ...base,
      optionsJson: values.statements.map((statement) => ({
        id: statement.statementId,
        richText: statement.content,
      })),
      correctAnswerJson: values.statements.map((statement) => ({
        statementId: statement.statementId,
        value: statement.answer === "true",
      })),
    };
  }

  return {
    ...base,
    correctAnswerJson: [values.acceptedAnswer.trim()],
  };
}

function toOptionalDocument(document: TiptapTextDocument) {
  return hasTiptapDocumentContent(document) ? document : null;
}

function createOptionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `option_${crypto.randomUUID()}`;
  }
  return `option_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createEmptyStatement() {
  return {
    statementId: createStatementId(),
    content: createEmptyTiptapDocument(),
    answer: "true" as const,
  };
}

function createStatementId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `statement_${crypto.randomUUID()}`;
  }
  return `statement_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getStringAnswers(
  correctAnswer: AdminQuizQuestion["correctAnswerJson"],
): string[] {
  return Array.isArray(correctAnswer) &&
    correctAnswer.every((answer): answer is string => typeof answer === "string")
    ? correctAnswer
    : [];
}

function getQuizFigureAltText(role: AdminQuizFigureRole) {
  return role === "QUESTION"
    ? "Hình minh họa đề bài Quiz"
    : "Hình minh họa lời giải Quiz mở rộng từ hình đề";
}

function getQuizFigureRoleLabel(role: AdminQuizFigureRole) {
  return role === "QUESTION" ? "hình đề" : "hình lời giải";
}

function getMultiStatementAnswers(
  correctAnswer: AdminQuizQuestion["correctAnswerJson"],
): AdminMultiStatementAnswer[] {
  return Array.isArray(correctAnswer) &&
    correctAnswer.every(
      (answer): answer is AdminMultiStatementAnswer =>
        typeof answer === "object" &&
        answer !== null &&
        "statementId" in answer &&
        typeof answer.statementId === "string" &&
        "value" in answer &&
        typeof answer.value === "boolean",
    )
    ? correctAnswer
    : [];
}

function optionLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
