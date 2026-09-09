"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { FieldLabel } from "@/components/common/forms/field-label";
import { OptionField } from "@/components/common/forms/option-field";
import type {
  AdminFlashcard,
  AdminFlashcardPayload,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import { useAdminFlashcardMutations } from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { FlashcardSolutionFigureUploadField } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-solution-figure-upload-field";
import {
  flashcardFormSchema,
  type FlashcardFormValues,
} from "@/features/admin/flashcards/schemas/flashcard-form-schemas";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import {
  createEmptyTiptapDocument,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const difficultyOptions = [
  { value: "EASY", label: "Dễ" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HARD", label: "Khó" },
];

export function FlashcardEditorDialog({
  card,
  isOpen,
  lessonId,
  setId,
  onClose,
}: {
  card: AdminFlashcard | null;
  isOpen: boolean;
  lessonId: string;
  setId: string;
  onClose: () => void;
}) {
  const {
    createCard,
    deleteSolutionFigure,
    updateCard,
    uploadSolutionFigure,
  } = useAdminFlashcardMutations(setId, lessonId);
  const [draftSolutionFigureFile, setDraftSolutionFigureFile] = useState<File>();
  const [isSolutionFigureMarkedForDeletion, setIsSolutionFigureMarkedForDeletion] =
    useState(false);
  const isSaving =
    createCard.isPending ||
    updateCard.isPending ||
    uploadSolutionFigure.isPending ||
    deleteSolutionFigure.isPending;
  const form = useForm<FlashcardFormValues>({
    resolver: zodResolver(flashcardFormSchema) as Resolver<FlashcardFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: createDefaults(),
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset(
      card
        ? {
            frontJson: card.frontJson,
            backJson: card.backJson,
            solutionJson: card.solutionJson ?? createEmptyTiptapDocument(),
            difficulty: card.difficulty,
          }
        : createDefaults(),
    );
    setDraftSolutionFigureFile(undefined);
    setIsSolutionFigureMarkedForDeletion(false);
  }, [card, form, isOpen]);

  const submit = form.handleSubmit(async (values) => {
    const payload: AdminFlashcardPayload = {
      frontJson: values.frontJson,
      backJson: values.backJson,
      solutionJson: hasTiptapDocumentContent(values.solutionJson)
        ? values.solutionJson
        : null,
      difficulty: values.difficulty,
    };
    try {
      const savedCard = card
        ? await updateCard.mutateAsync({ flashcardId: card.id, payload })
        : await createCard.mutateAsync(payload);
      const currentSolutionFigure = card?.figures?.find(
        (figure) => figure.role === "SOLUTION",
      );

      let imageUpdateFailed = false;
      try {
        if (isSolutionFigureMarkedForDeletion && currentSolutionFigure) {
          await deleteSolutionFigure.mutateAsync({
            flashcardId: savedCard.id,
            figureId: currentSolutionFigure.id,
          });
        }
        if (draftSolutionFigureFile) {
          await uploadSolutionFigure.mutateAsync({
            flashcardId: savedCard.id,
            file: draftSolutionFigureFile,
            altText: "Hình minh họa lời giải Flashcard",
          });
        }
      } catch (imageError) {
        imageUpdateFailed = true;
        toast.warning(
          getUserFacingErrorMessage(
            imageError,
            "Đã lưu flashcard nhưng chưa cập nhật được hình lời giải. Bạn có thể thử lại.",
          ),
        );
      }
      if (!imageUpdateFailed) {
        toast.success(card ? "Đã cập nhật flashcard" : "Đã thêm flashcard");
      }
      onClose();
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa lưu được thẻ ghi nhớ. Vui lòng thử lại.",
        ),
      );
    }
  });

  return (
    <EditorDialogShell
      ariaLabel={card ? "Chỉnh sửa flashcard" : "Thêm flashcard"}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {card ? "Chỉnh sửa flashcard" : "Thêm flashcard"}
          </h2>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <OptionField
            id="flashcard-difficulty"
            label="Mức độ"
            value={form.watch("difficulty")}
            options={difficultyOptions}
            icon={<Layers className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.difficulty}
            onChange={(value) =>
              form.setValue("difficulty", value as FlashcardFormValues["difficulty"], {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />
          <div>
            <FieldLabel id="flashcard-front" label="Mặt trước" />
            <div className="mt-2">
              <Controller
                control={form.control}
                name="frontJson"
                render={({ field, fieldState }) => (
                  <QuizRichContentEditor
                    ariaLabel="Nội dung mặt trước"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Nhập câu hỏi, khái niệm hoặc công thức cần ghi nhớ..."
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>
          <div>
            <FieldLabel id="flashcard-back" label="Mặt sau" />
            <div className="mt-2">
              <Controller
                control={form.control}
                name="backJson"
                render={({ field, fieldState }) => (
                  <QuizRichContentEditor
                    ariaLabel="Nội dung mặt sau"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Nhập câu trả lời trực tiếp, ngắn gọn và chính xác..."
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>
          <div>
            <FieldLabel id="flashcard-solution" label="Lời giải chi tiết" isOptional />
            <div className="mt-2">
              <Controller
                control={form.control}
                name="solutionJson"
                render={({ field }) => (
                  <QuizRichContentEditor
                    ariaLabel="Lời giải chi tiết"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Diễn giải đầy đủ cho câu hỏi ở mặt trước: căn cứ, lập luận, công thức, điều kiện áp dụng và kết luận khi cần..."
                  />
                )}
              />
            </div>
          </div>
          <FlashcardSolutionFigureUploadField
            deleted={isSolutionFigureMarkedForDeletion}
            disabled={isSaving}
            figure={card?.figures?.find((figure) => figure.role === "SOLUTION")}
            isDeleting={deleteSolutionFigure.isPending}
            isUploading={uploadSolutionFigure.isPending}
            selectedFile={draftSolutionFigureFile}
            onDelete={() => {
              setDraftSolutionFigureFile(undefined);
              setIsSolutionFigureMarkedForDeletion(true);
            }}
            onFileSelect={(file) => {
              setDraftSolutionFigureFile(file);
              setIsSolutionFigureMarkedForDeletion(false);
            }}
          />
        </div>
        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : "Lưu"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function createDefaults(): FlashcardFormValues {
  return {
    frontJson: createEmptyTiptapDocument(),
    backJson: createEmptyTiptapDocument(),
    solutionJson: createEmptyTiptapDocument(),
    difficulty: "MEDIUM",
  };
}
