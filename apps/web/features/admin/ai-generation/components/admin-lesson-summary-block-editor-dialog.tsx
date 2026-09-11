"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { tiptapTextDocumentSchema } from "@learning-path/shared";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { FieldLabel } from "@/components/common/forms/field-label";
import { TextField } from "@/components/common/forms/text-field";
import { AdminLessonSummaryGeometryStatementFields } from "@/features/admin/ai-generation/components/admin-lesson-summary-geometry-statement-fields";
import {
  AdminLessonSummaryBlockFigureFields,
  type AdminLessonSummaryFigureDraft,
  type AdminLessonSummaryFigureDrafts,
} from "@/features/admin/ai-generation/components/admin-lesson-summary-block-figure-fields";
import {
  useDeleteAdminStemFigure,
  useEnsureAdminStemFigureForBlock,
  useReplaceAdminStemFigure,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type { AdminStemFigure } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import {
  applyLessonSummaryBlockEditorValues,
  createLessonSummaryBlockEditorValues,
  getLessonSummaryBlockEditableFields,
  getLessonSummaryBlockLabel,
  formatLessonSummaryStartTime,
  LESSON_SUMMARY_START_TIME_PATTERN,
  parseLessonSummaryStartTime,
  type LessonSummaryBlockEditorValues,
  type LessonSummaryEditableBlockType,
  type LessonSummaryEditableField,
} from "@/features/admin/ai-generation/utils/lesson-summary-block-editor";
import {
  createEmptyTiptapDocument,
  getTiptapDocumentText,
  hasTiptapDocumentContent,
  serializeTiptapDocumentToMathMarkdown,
} from "@/lib/tiptap-rich-content";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const FIELD_CONFIG: Record<
  LessonSummaryEditableField,
  { label: string; maxLength: number; placeholder: string }
> = {
  title: {
    label: "Tiêu đề",
    maxLength: 240,
    placeholder: "Nhập tiêu đề của khối...",
  },
  content: {
    label: "Nội dung",
    maxLength: 6_000,
    placeholder: "Nhập nội dung kiến thức...",
  },
  problem: {
    label: "Đề bài",
    maxLength: 4_000,
    placeholder: "Nhập đề bài...",
  },
  solution: {
    label: "Lời giải",
    maxLength: 10_000,
    placeholder: "Nhập lời giải...",
  },
  answer: {
    label: "Đáp án",
    maxLength: 3_000,
    placeholder: "Nhập đáp án ngắn gọn...",
  },
};

const editorDocumentSchema = tiptapTextDocumentSchema;
const lessonSummaryBlockFormSchema = z
  .object({
    blockType: z.enum([
      "knowledge",
      "property",
      "theorem",
      "note",
      "example",
      "exercise",
      "summary",
    ]),
    isVideoTimelineHidden: z.boolean(),
    startTimeEnabled: z.boolean(),
    startTime: z.string().optional().default(""),
    originalStartTime: z.string().optional().default(""),
    title: editorDocumentSchema,
    content: editorDocumentSchema,
    problem: editorDocumentSchema,
    solution: editorDocumentSchema,
    answer: editorDocumentSchema,
    geometryStatementEnabled: z.boolean(),
    hypotheses: editorDocumentSchema,
    conclusions: editorDocumentSchema,
  })
  .superRefine((values, context) => {
    if (values.startTimeEnabled) {
      for (const field of ["startTime", "originalStartTime"] as const) {
        if (!LESSON_SUMMARY_START_TIME_PATTERN.test(values[field])) {
          context.addIssue({
            code: "custom",
            message: "Dùng định dạng MM:SS hoặc H:MM:SS",
            path: [field],
          });
        }
      }
    }
    for (const field of getLessonSummaryBlockEditableFields(values.blockType)) {
      const value = values[field];
      if (!hasTiptapDocumentContent(value)) {
        context.addIssue({
          code: "custom",
          message: `Hãy nhập ${FIELD_CONFIG[field].label.toLocaleLowerCase("vi")}`,
          path: [field],
        });
        continue;
      }
      const maxLength = getFieldMaxLength(values.blockType, field);
      if (serializeTiptapDocumentToMathMarkdown(value).length > maxLength) {
        context.addIssue({
          code: "custom",
          message: `${FIELD_CONFIG[field].label} không được vượt quá ${maxLength.toLocaleString("vi-VN")} ký tự`,
          path: [field],
        });
      }
    }
    if (values.geometryStatementEnabled) {
      for (const field of ["hypotheses", "conclusions"] as const) {
        const label = field === "hypotheses" ? "giả thiết" : "kết luận";
        if (!hasTiptapDocumentContent(values[field])) {
          context.addIssue({
            code: "custom",
            message: `Hãy nhập ${label}`,
            path: [field],
          });
          continue;
        }
        if (serializeTiptapDocumentToMathMarkdown(values[field]).length > 1_000) {
          context.addIssue({
            code: "custom",
            message: `${label[0]?.toLocaleUpperCase("vi")}${label.slice(1)} không được vượt quá 1.000 ký tự`,
            path: [field],
          });
        }
      }
    }
  });

export function AdminLessonSummaryBlockEditorDialog({
  block,
  blockPath,
  figures,
  isOpen,
  isVideoTimelineEditor = false,
  isVideoTimelineHidden = false,
  lessonId,
  subjectKey,
  videoEndTimeSeconds,
  videoStartTimeOffsetSeconds = 0,
  onClose,
  onSave,
}: {
  block: Record<string, unknown> & { type: LessonSummaryEditableBlockType };
  blockPath: string;
  figures: AdminStemFigure[];
  isOpen: boolean;
  isVideoTimelineEditor?: boolean;
  isVideoTimelineHidden?: boolean;
  lessonId: string;
  subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL" | null;
  videoEndTimeSeconds?: number;
  videoStartTimeOffsetSeconds?: number;
  onClose: () => void;
  onSave: (block: Record<string, unknown>) => void;
}) {
  const form = useForm<LessonSummaryBlockEditorValues>({
    resolver: zodResolver(
      lessonSummaryBlockFormSchema,
    ) as Resolver<LessonSummaryBlockEditorValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: createLessonSummaryBlockEditorValues(block, {
      isVideoTimelineHidden,
      startTimeOffsetSeconds: videoStartTimeOffsetSeconds,
    }),
  });
  const editableFields = getLessonSummaryBlockEditableFields(block.type);
  const blockLabel = getLessonSummaryBlockLabel(block.type);
  const supportsGeometryStatement =
    subjectKey === "MATH" && (block.type === "example" || block.type === "exercise");
  const [figureDrafts, setFigureDrafts] = useState<AdminLessonSummaryFigureDrafts>({});
  const ensureFigureMutation = useEnsureAdminStemFigureForBlock(lessonId);
  const replaceFigureMutation = useReplaceAdminStemFigure(lessonId);
  const deleteFigureMutation = useDeleteAdminStemFigure(lessonId);
  const isSavingFigures =
    ensureFigureMutation.isPending ||
    replaceFigureMutation.isPending ||
    deleteFigureMutation.isPending;
  const hasVideoStartCut =
    Number.isFinite(videoStartTimeOffsetSeconds) && videoStartTimeOffsetSeconds > 0;
  const originalStartTime = form.watch("originalStartTime");
  const originalStartSeconds = parseLessonSummaryStartTime(originalStartTime);
  const isOriginalTimeOutsidePlayback =
    originalStartSeconds !== null &&
    ((isVideoTimelineHidden && originalStartSeconds < videoStartTimeOffsetSeconds) ||
      (Number.isFinite(videoEndTimeSeconds) &&
        originalStartSeconds >= (videoEndTimeSeconds ?? Number.MAX_SAFE_INTEGER)));
  const playbackStartTime =
    originalStartSeconds === null || isOriginalTimeOutsidePlayback
      ? ""
      : formatLessonSummaryStartTime(
          Math.max(0, originalStartSeconds - videoStartTimeOffsetSeconds),
        );

  useEffect(() => {
    if (!isOpen) return;
    form.reset(
      createLessonSummaryBlockEditorValues(block, {
        isVideoTimelineHidden,
        startTimeOffsetSeconds: videoStartTimeOffsetSeconds,
      }),
    );
    setFigureDrafts({});
  }, [
    block,
    blockPath,
    form,
    isOpen,
    isVideoTimelineHidden,
    videoStartTimeOffsetSeconds,
  ]);

  const submit = form.handleSubmit(async (values) => {
    try {
      for (const [index, draft] of Object.entries(figureDrafts).sort(
        ([left], [right]) => Number(left) - Number(right),
      )) {
        const figureIndex = Number(index);
        const existingFigure = figures.find(
          (figure) => figure.figureIndex === figureIndex,
        );
        if (draft?.kind === "delete") {
          if (existingFigure) {
            await deleteFigureMutation.mutateAsync(existingFigure);
          }
          continue;
        }
        if (draft?.kind === "replace") {
          const figure =
            existingFigure ??
            (await ensureFigureMutation.mutateAsync({ blockPath, figureIndex }));
          await replaceFigureMutation.mutateAsync({ figure, file: draft.file });
        }
      }
      onSave(
        applyLessonSummaryBlockEditorValues(block, values, {
          isVideoTimelineHidden,
          preferOriginalStartTime: isVideoTimelineEditor,
          startTimeOffsetSeconds: videoStartTimeOffsetSeconds,
          updateGeometryStatement: supportsGeometryStatement,
        }),
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa thể lưu thay đổi hình ảnh. Vui lòng thử lại.",
        ),
      );
    }
  });

  function closeDialog() {
    if (isSavingFigures) return;
    setFigureDrafts({});
    onClose();
  }

  function updateFigureDraft(
    figureIndex: number,
    draft: AdminLessonSummaryFigureDraft | undefined,
  ) {
    setFigureDrafts((current) => {
      const next = { ...current };
      if (draft) next[figureIndex] = draft;
      else delete next[figureIndex];
      return next;
    });
  }

  return (
    <EditorDialogShell
      ariaLabel={`Chỉnh sửa khối ${blockLabel}`}
      isOpen={isOpen}
      onClose={closeDialog}
      panelClassName="max-w-4xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <header className="theme-dialog-header shrink-0 px-5 py-5 pr-16 sm:px-6">
          <h2 className="text-xl font-extrabold text-[var(--theme-text-strong)]">
            Chỉnh sửa khối {blockLabel}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {form.watch("startTimeEnabled") ? (
            <div
              className={
                hasVideoStartCut || isVideoTimelineEditor || isVideoTimelineHidden
                  ? "grid max-w-2xl gap-4 sm:grid-cols-2"
                  : "max-w-sm"
              }
            >
              {isVideoTimelineEditor ? (
                <TextField
                  id="lesson-summary-block-start-time"
                  inputMode="numeric"
                  label="Thời gian bắt đầu"
                  value={playbackStartTime || "—"}
                  helperText={
                    isOriginalTimeOutsidePlayback
                      ? "Khối đang nằm ngoài khoảng phát."
                      : "Tự động tính từ thời gian gốc, chỉ để đối chiếu."
                  }
                  icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
                  disabled
                />
              ) : (
                <TextField
                  id="lesson-summary-block-start-time"
                  inputMode="numeric"
                  label="Thời gian bắt đầu"
                  placeholder="VD: 12:30 hoặc 1:02:30"
                  helperText="Dùng định dạng MM:SS hoặc H:MM:SS."
                  icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
                  disabled={isVideoTimelineHidden}
                  error={form.formState.errors.startTime}
                  {...form.register("startTime")}
                />
              )}
              {hasVideoStartCut || isVideoTimelineEditor || isVideoTimelineHidden ? (
                <Controller
                  control={form.control}
                  name="originalStartTime"
                  render={({ field, fieldState }) => (
                    <TextField
                      id="lesson-summary-block-original-start-time"
                      inputMode="numeric"
                      label="Thời gian gốc"
                      helperText={
                        isVideoTimelineEditor
                          ? "Mốc trên video gốc; thời gian sau cắt sẽ tự cập nhật."
                          : "Tự động tính từ mốc sau cắt, chỉ để đối chiếu."
                      }
                      icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
                      disabled={!isVideoTimelineEditor && !isVideoTimelineHidden}
                      error={
                        isVideoTimelineEditor || isVideoTimelineHidden
                          ? fieldState.error
                          : undefined
                      }
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                  )}
                />
              ) : null}
            </div>
          ) : null}

          {editableFields.map((fieldName) => {
            const config = FIELD_CONFIG[fieldName];
            const maxLength = getFieldMaxLength(block.type, fieldName);
            return (
              <div key={fieldName}>
                <FieldLabel
                  id={`lesson-summary-block-${fieldName}`}
                  label={config.label}
                />
                <div className="mt-2">
                  <Controller
                    control={form.control}
                    name={fieldName}
                    render={({ field, fieldState }) => (
                      <QuizRichContentEditor
                        ariaLabel={`${config.label} của khối ${blockLabel}`}
                        compact={fieldName === "title" || fieldName === "answer"}
                        error={fieldState.error?.message}
                        placeholder={config.placeholder}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <p className="mt-1.5 text-right text-xs font-medium text-[var(--theme-text-muted)]">
                  {getTiptapDocumentText(form.watch(fieldName)).length.toLocaleString(
                    "vi-VN",
                  )}
                  /{maxLength.toLocaleString("vi-VN")} ký tự
                </p>
              </div>
            );
          })}

          {supportsGeometryStatement ? (
            <Controller
              control={form.control}
              name="hypotheses"
              render={({ field: hypothesesField, fieldState: hypothesesState }) => (
                <Controller
                  control={form.control}
                  name="conclusions"
                  render={({ field: conclusionsField, fieldState: conclusionsState }) => (
                    <AdminLessonSummaryGeometryStatementFields
                      conclusions={conclusionsField.value}
                      conclusionsError={conclusionsState.error?.message}
                      disabled={isSavingFigures}
                      enabled={form.watch("geometryStatementEnabled")}
                      hypotheses={hypothesesField.value}
                      hypothesesError={hypothesesState.error?.message}
                      onAdd={() =>
                        form.setValue("geometryStatementEnabled", true, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      onConclusionsBlur={conclusionsField.onBlur}
                      onConclusionsChange={conclusionsField.onChange}
                      onHypothesesBlur={hypothesesField.onBlur}
                      onHypothesesChange={hypothesesField.onChange}
                      onRemove={() => {
                        form.setValue("geometryStatementEnabled", false, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        form.setValue("hypotheses", createEmptyTiptapDocument(), {
                          shouldDirty: true,
                          shouldValidate: false,
                        });
                        form.setValue("conclusions", createEmptyTiptapDocument(), {
                          shouldDirty: true,
                          shouldValidate: false,
                        });
                        form.clearErrors(["hypotheses", "conclusions"]);
                      }}
                    />
                  )}
                />
              )}
            />
          ) : null}

          <AdminLessonSummaryBlockFigureFields
            blockType={block.type}
            disabled={isSavingFigures}
            drafts={figureDrafts}
            figures={figures}
            onDraftChange={updateFigureDraft}
          />
        </div>

        <footer className="theme-dialog-footer flex shrink-0 flex-row justify-end gap-2 px-5 py-4 sm:px-6">
          <button
            className="theme-button-neutral min-h-11 rounded-lg px-5 text-sm font-extrabold"
            disabled={isSavingFigures}
            onClick={closeDialog}
            type="button"
          >
            Hủy
          </button>
          <button
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSavingFigures}
            type="submit"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Lưu thay đổi
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function getFieldMaxLength(
  blockType: LessonSummaryEditableBlockType,
  field: LessonSummaryEditableField,
) {
  return blockType === "note" && field === "content"
    ? 3_000
    : FIELD_CONFIG[field].maxLength;
}
