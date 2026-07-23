import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { LessonEditor } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-editor";
import type {
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import {
  createLessonSchema,
  emptyLessonValues,
  type LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";
import {
  getLessonSourceExtractionFormValues,
  getPdfPageFromPrintedPage,
  getSourceDocumentRangeReadiness,
  readRecord,
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
  onSubmit: (
    values: LessonFormValues,
    documentsManager: ReturnType<typeof useAdminCourseDocumentsManager>,
  ) => void | Promise<void>;
}) {
  const documentsManager = useAdminCourseDocumentsManager(learningPath, {
    loadAllSourcePages: isOpen,
  });
  const formSchema = useMemo(
    () =>
      createLessonSchema(
        documentsManager.sourceDocuments,
        documentsManager.sourcePagesByDocumentId,
      ),
    [documentsManager.sourceDocuments, documentsManager.sourcePagesByDocumentId],
  );
  const selectableSourceDocuments = useMemo(
    () =>
      documentsManager.sourceDocuments.filter((sourceDocument) => {
        if (sourceDocument.readiness?.isEligibleForExtraction === false) {
          return false;
        }

        return getSourceDocumentRangeReadiness(
          sourceDocument,
          documentsManager.sourcePagesByDocumentId[sourceDocument.id] ?? [],
        ).isReady;
      }),
    [documentsManager.sourceDocuments, documentsManager.sourcePagesByDocumentId],
  );

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(formSchema) as Resolver<LessonFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      ...emptyLessonValues,
      sourceDocumentExtractions: [],
      foundationDocumentOrder: [],
    },
  });
  const resetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      resetKeyRef.current = null;
      return;
    }

    const selectableSourceDocumentIds = new Set(
      selectableSourceDocuments.map((document) => document.id),
    );
    const sourceDocumentExtractions = getLessonSourceExtractionFormValues(
      mode === "edit" ? selectedLesson?.id : null,
      documentsManager.documentsByLessonId,
      selectableSourceDocuments[0]?.id,
      documentsManager.sourcePagesByDocumentId,
    ).map((extraction) =>
      selectableSourceDocumentIds.has(extraction.sourceDocumentId)
        ? extraction
        : { ...extraction, sourceDocumentId: "" },
    );
    const editorKey = [
      mode,
      selectedLesson?.id ?? "new",
      defaultOrderIndex,
      ...sourceDocumentExtractions.flatMap((extraction) => [
        ("id" in extraction ? extraction.id : undefined) ?? extraction.clientKey,
        extraction.sourceDocumentId,
        extraction.pageStart,
        extraction.pageEnd,
      ]),
    ].join(":");

    if (resetKeyRef.current === editorKey) {
      return;
    }

    if (resetKeyRef.current && form.formState.isDirty) {
      return;
    }

    const existingDocuments =
      mode === "edit" && selectedLesson
        ? documentsManager.documentsByLessonId[selectedLesson.id]?.filter((doc) => {
            const isRangeDocument =
              doc.kind === "PRIMARY_FROM_SOURCE" &&
              (Boolean(doc.pageRangeId) ||
                readRecord(doc.metadataJson)?.source === "source_document_page_range");
            return !isRangeDocument;
          }) || []
        : [];
    const foundationDocuments =
      mode === "edit" && selectedLesson
        ? documentsManager.documentsByLessonId[selectedLesson.id]
            ?.filter((doc) => doc.kind === "PRIMARY_FROM_SOURCE")
            .sort(
              (left, right) =>
                left.sortOrder - right.sortOrder ||
                new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
            ) || []
        : [];
    const foundationDocumentOrder =
      mode === "edit"
        ? foundationDocuments.map((doc) =>
            doc.pageRangeId ? `EXTRACTION:${doc.pageRangeId}` : `UPLOAD:${doc.id}`,
          )
        : sourceDocumentExtractions.map(
            (extraction) => `EXTRACTION:${extraction.clientKey}`,
          );

    form.reset(
      mode === "edit" && selectedLesson
        ? {
            ...toLessonFormValues(selectedLesson, existingDocuments),
            sourceDocumentExtractions,
            foundationDocumentOrder,
          }
        : {
            ...emptyLessonValues,
            orderIndex: defaultOrderIndex,
            sourceDocumentExtractions,
            foundationDocumentOrder,
          },
    );
    resetKeyRef.current = editorKey;
  }, [
    defaultOrderIndex,
    documentsManager.documentsByLessonId,
    documentsManager.sourceDocuments,
    documentsManager.sourcePagesByDocumentId,
    form,
    form.formState.isDirty,
    isOpen,
    mode,
    selectableSourceDocuments,
    selectedLesson,
  ]);

  useEffect(() => {
    if (!isOpen || mode !== "edit" || !selectedLesson) return;

    const existingDocuments =
      documentsManager.documentsByLessonId[selectedLesson.id]?.filter(
        (doc) =>
          doc.kind !== "PRIMARY_FROM_SOURCE" ||
          (!doc.pageRangeId &&
            readRecord(doc.metadataJson)?.source !== "source_document_page_range"),
      ) || [];

    const formDocs = form.getValues("referenceDocuments") || [];

    formDocs.forEach((formDoc, index) => {
      if (formDoc.id) {
        const latestDoc = existingDocuments.find((d) => d.id === formDoc.id);
        if (latestDoc) {
          if (
            formDoc.status !== latestDoc.status ||
            formDoc.progress !== latestDoc.processingJob?.progress ||
            formDoc.extractError !== latestDoc.extractError ||
            formDoc.url !== latestDoc.file?.publicUrl
          ) {
            form.setValue(`referenceDocuments.${index}.status`, latestDoc.status);
            form.setValue(
              `referenceDocuments.${index}.progress`,
              latestDoc.processingJob?.progress,
            );
            form.setValue(
              `referenceDocuments.${index}.extractError`,
              latestDoc.extractError || undefined,
            );
            form.setValue(
              `referenceDocuments.${index}.url`,
              latestDoc.file?.publicUrl || undefined,
            );
          }
        }
      }
    });
  }, [documentsManager.documentsByLessonId, isOpen, mode, selectedLesson, form]);

  async function submit(values: LessonFormValues) {
    try {
      let hasInvalidExtraction = false;
      values.sourceDocumentExtractions.forEach((extraction, index) => {
        const pageStart = extraction.pageStart?.trim() ?? "";
        const pageEnd = extraction.pageEnd?.trim() ?? "";
        if (!extraction.sourceDocumentId) {
          form.setError(`sourceDocumentExtractions.${index}.sourceDocumentId`, {
            type: "manual",
            message: "Chọn tài liệu nguồn",
          });
          hasInvalidExtraction = true;
        }
        if (!pageStart) {
          form.setError(`sourceDocumentExtractions.${index}.pageStart`, {
            type: "manual",
            message: "Nhập trang bắt đầu",
          });
          hasInvalidExtraction = true;
        }
        if (!pageEnd) {
          form.setError(`sourceDocumentExtractions.${index}.pageEnd`, {
            type: "manual",
            message: "Nhập trang kết thúc",
          });
          hasInvalidExtraction = true;
        }
      });
      if (hasInvalidExtraction) {
        return;
      }

      for (const [index, extraction] of values.sourceDocumentExtractions.entries()) {
        const pageStart = extraction.pageStart ?? "";
        const pageEnd = extraction.pageEnd ?? "";
        const sourcePages =
          documentsManager.sourcePagesByDocumentId[extraction.sourceDocumentId] ?? [];
        const pdfPageStart = pageStart
          ? getPdfPageFromPrintedPage(pageStart, sourcePages)
          : null;
        const pdfPageEnd = pageEnd
          ? getPdfPageFromPrintedPage(pageEnd, sourcePages)
          : null;

        if (pageStart && !pdfPageStart) {
          form.setError(`sourceDocumentExtractions.${index}.pageStart`, {
            type: "manual",
            message: "Trang bắt đầu không hợp lệ",
          });
          return;
        }

        if (pageEnd && !pdfPageEnd) {
          form.setError(`sourceDocumentExtractions.${index}.pageEnd`, {
            type: "manual",
            message: "Trang kết thúc không hợp lệ",
          });
          return;
        }

        if (pdfPageStart && pdfPageEnd && pdfPageStart > pdfPageEnd) {
          form.setError(`sourceDocumentExtractions.${index}.pageStart`, {
            type: "manual",
            message: "Trang bắt đầu không được lớn hơn trang kết thúc",
          });
          return;
        }

        extraction.pageStart = pdfPageStart ? String(pdfPageStart) : "";
        extraction.pageEnd = pdfPageEnd ? String(pdfPageEnd) : "";
      }

      await onSubmit(values, documentsManager);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATED_LESSON_TITLE") {
        form.setError("title", {
          type: "manual",
          message: "Buổi học đã trùng tên",
        });
        return;
      }

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
      ariaLabel={mode === "create" ? "Thêm buổi học" : "Sửa buổi học"}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <LessonEditor
        mode={mode}
        form={form}
        isSaving={isSaving}
        disabled={disabled}
        sourceDocuments={selectableSourceDocuments}
        sourcePagesByDocumentId={documentsManager.sourcePagesByDocumentId}
        onClose={onClose}
        onSubmit={submit}
      />
    </EditorDialogShell>
  );
}
