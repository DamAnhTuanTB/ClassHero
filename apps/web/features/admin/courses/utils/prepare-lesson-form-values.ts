import type { UseFormReturn } from "react-hook-form";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { getPdfPageFromPrintedPage } from "@/features/admin/courses/admin-course-documents-utils";
import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";

export function prepareLessonFormValuesForSubmit(
  form: UseFormReturn<LessonFormValues>,
  values: LessonFormValues,
  sourcePagesByDocumentId: Record<string, AdminSourceDocumentPageApi[]>,
) {
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
    return null;
  }

  const sourceDocumentExtractions = values.sourceDocumentExtractions.map(
    (extraction, index) => {
      const pageStart = extraction.pageStart ?? "";
      const pageEnd = extraction.pageEnd ?? "";
      const sourcePages = sourcePagesByDocumentId[extraction.sourceDocumentId] ?? [];
      const pdfPageStart = pageStart
        ? getPdfPageFromPrintedPage(pageStart, sourcePages)
        : null;
      const pdfPageEnd = pageEnd ? getPdfPageFromPrintedPage(pageEnd, sourcePages) : null;

      if (pageStart && !pdfPageStart) {
        form.setError(`sourceDocumentExtractions.${index}.pageStart`, {
          type: "manual",
          message: "Trang bắt đầu không hợp lệ",
        });
        hasInvalidExtraction = true;
      }

      if (pageEnd && !pdfPageEnd) {
        form.setError(`sourceDocumentExtractions.${index}.pageEnd`, {
          type: "manual",
          message: "Trang kết thúc không hợp lệ",
        });
        hasInvalidExtraction = true;
      }

      if (pdfPageStart && pdfPageEnd && pdfPageStart > pdfPageEnd) {
        form.setError(`sourceDocumentExtractions.${index}.pageStart`, {
          type: "manual",
          message: "Trang bắt đầu không được lớn hơn trang kết thúc",
        });
        hasInvalidExtraction = true;
      }

      return {
        ...extraction,
        pageStart: pdfPageStart ? String(pdfPageStart) : "",
        pageEnd: pdfPageEnd ? String(pdfPageEnd) : "",
      };
    },
  );

  if (hasInvalidExtraction) {
    return null;
  }

  return {
    ...values,
    sourceDocumentExtractions,
  };
}
