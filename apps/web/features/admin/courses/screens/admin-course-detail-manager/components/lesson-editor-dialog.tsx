import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { LessonEditor } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-editor";
import type {
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import {
  emptyLessonValues,
  lessonSchema,
  type LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";
import {
  getLessonSourceRangeFormValues,
  getPdfPageFromPrintedPage,
} from "@/features/admin/courses/admin-course-documents-utils";
import { toLessonFormValues } from "@/features/admin/courses/admin-courses-utils";
import { useAdminCourseDocumentsManager } from "@/features/admin/courses/hooks/use-admin-course-documents-manager";

export function LessonEditorDialog({
  defaultOrderIndex,
  disabled,
  isOpen,
  isSaving,
  learningPath,
  mode,
  selectedLesson,
  onClose,
  onSubmit,
}: {
  defaultOrderIndex: number;
  disabled: boolean;
  isOpen: boolean;
  isSaving: boolean;
  learningPath: AdminLearningPath | null;
  mode: EditorMode;
  selectedLesson: AdminLesson | null;
  onClose: () => void;
  onSubmit: (values: LessonFormValues) => void | Promise<void>;
}) {
  const documentsManager = useAdminCourseDocumentsManager(learningPath);
  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema) as Resolver<LessonFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: emptyLessonValues,
  });
  const resetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      resetKeyRef.current = null;
      return;
    }

    const sourceDocumentPageRange = getLessonSourceRangeFormValues(
      mode === "edit" ? selectedLesson?.id : null,
      documentsManager.documentsByLessonId,
      documentsManager.selectedSourceDocument?.id,
      documentsManager.sourcePages
    );
    const editorKey = [
      mode,
      selectedLesson?.id ?? "new",
      defaultOrderIndex,
      sourceDocumentPageRange.sourceDocumentId,
      sourceDocumentPageRange.pageStart,
      sourceDocumentPageRange.pageEnd,
    ].join(":");

    if (resetKeyRef.current === editorKey) {
      return;
    }

    if (resetKeyRef.current && form.formState.isDirty) {
      return;
    }

    form.reset(
      mode === "edit" && selectedLesson
        ? {
            ...toLessonFormValues(selectedLesson),
            sourceDocumentPageRange,
          }
        : {
            ...emptyLessonValues,
            orderIndex: defaultOrderIndex,
            sourceDocumentPageRange,
          },
    );
    resetKeyRef.current = editorKey;

    if (sourceDocumentPageRange.sourceDocumentId) {
      documentsManager.actions.selectSourceDocument(
        sourceDocumentPageRange.sourceDocumentId,
      );
    }
  }, [
    defaultOrderIndex,
    documentsManager.actions,
    documentsManager.documentsByLessonId,
    documentsManager.selectedSourceDocument?.id,
    documentsManager.sourcePages,
    form,
    form.formState.isDirty,
    isOpen,
    mode,
    selectedLesson,
  ]);

  async function submit(values: LessonFormValues) {
    try {
      if (values.sourceDocumentPageRange?.sourceDocumentId) {
        const { pageStart, pageEnd } = values.sourceDocumentPageRange;
        const pdfPageStart = pageStart
          ? getPdfPageFromPrintedPage(pageStart, documentsManager.sourcePages)
          : null;
        const pdfPageEnd = pageEnd
          ? getPdfPageFromPrintedPage(pageEnd, documentsManager.sourcePages)
          : null;

        if (pageStart && !pdfPageStart) {
          form.setError("sourceDocumentPageRange.pageStart", {
            type: "manual",
            message: "Trang bắt đầu không hợp lệ",
          });
          return;
        }

        if (pageEnd && !pdfPageEnd) {
          form.setError("sourceDocumentPageRange.pageEnd", {
            type: "manual",
            message: "Trang kết thúc không hợp lệ",
          });
          return;
        }
        
        if (pdfPageStart && pdfPageEnd && pdfPageStart > pdfPageEnd) {
          form.setError("sourceDocumentPageRange.pageStart", {
            type: "manual",
            message: "Trang bắt đầu không được lớn hơn trang kết thúc",
          });
          return;
        }

        values.sourceDocumentPageRange.pageStart = pdfPageStart ? String(pdfPageStart) : "";
        values.sourceDocumentPageRange.pageEnd = pdfPageEnd ? String(pdfPageEnd) : "";
      }
      await onSubmit(values);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATED_LESSON_ORDER") {
        form.setError("orderIndex", {
          type: "manual",
          message: "Thứ tự này đã có trong chương",
        });
        return;
      }

      throw error;
    }
  }

  return (
    <EditorDialogShell
      ariaLabel={mode === "create" ? "Thêm bài học" : "Sửa bài học"}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <LessonEditor
        mode={mode}
        form={form}
        isSaving={isSaving}
        disabled={disabled}
        isRangeReady={documentsManager.rangeReadiness.isReady}
        pageLimit={documentsManager.pageLimit}
        pages={documentsManager.sourcePages}
        rangeDisabledReason={documentsManager.rangeReadiness.reason}
        selectedSourceDocument={documentsManager.selectedSourceDocument}
        sourceDocuments={documentsManager.sourceDocuments}
        onClose={onClose}
        onSelectSourceDocument={documentsManager.actions.selectSourceDocument}
        onSubmit={submit}
      />
    </EditorDialogShell>
  );
}
