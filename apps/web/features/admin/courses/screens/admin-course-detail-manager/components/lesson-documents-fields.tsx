"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { LessonHomeworkDocumentSection } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-homework-document-section";
import { LessonSourceRangeSection } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-source-range-section";
import { LessonSupplementDocumentsSection } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-supplement-documents-section";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export function LessonDocumentsFields({
  disabled,
  form,
  isSaving,
  sourceDocuments,
  sourcePagesByDocumentId,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
  sourceDocuments: AdminSourceDocumentApi[];
  sourcePagesByDocumentId: Record<string, AdminSourceDocumentPageApi[]>;
}) {
  const documentFieldArray = useFieldArray({
    control: form.control,
    name: "referenceDocuments",
  });
  const extractionFieldArray = useFieldArray({
    control: form.control,
    name: "sourceDocumentExtractions",
  });

  return (
    <>
      <LessonSourceRangeSection
        disabled={disabled}
        form={form}
        isSaving={isSaving}
        sourceDocuments={sourceDocuments}
        sourcePagesByDocumentId={sourcePagesByDocumentId}
        extractionFieldArray={extractionFieldArray}
        documentFieldArray={documentFieldArray}
      />
      <LessonSupplementDocumentsSection
        disabled={disabled}
        form={form}
        isSaving={isSaving}
        documentFieldArray={documentFieldArray}
      />
      <LessonHomeworkDocumentSection
        disabled={disabled}
        form={form}
        isSaving={isSaving}
        documentFieldArray={documentFieldArray}
      />
    </>
  );
}
