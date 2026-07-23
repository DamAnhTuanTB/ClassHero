import assert from "node:assert/strict";
import test from "node:test";
import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";
import { suggestLessonPageRange } from "@/features/admin/courses/utils/suggest-lesson-page-range";

test("gợi ý khoảng trang khi tên chỉ gồm số bài học", () => {
  const pages = [
    createPage(1, "Mục lục\nBài 1 .... Bài 2 ....", "4"),
    createPage(2, String.raw`\section{Bài 1} Nội dung mở đầu`, "5"),
    createPage(3, "Nội dung tiếp theo", "6"),
    createPage(4, String.raw`\section{Bài 2} Bài học tiếp theo`, "7"),
  ];

  assert.deepEqual(suggestLessonPageRange("Bài 1", pages), {
    start: "5",
    end: "6",
    label: "Trang 5 - 6",
  });
});

test("gợi ý được cập nhật theo phần tên bài học cụ thể", () => {
  const pages = [
    createPage(1, "Giới thiệu", "8"),
    createPage(2, "Bài 3: Tỉ lệ thức", "9"),
    createPage(3, "Tỉ lệ thức và các tính chất", "10"),
  ];

  assert.deepEqual(suggestLessonPageRange("Bài 3: Tỉ lệ thức", pages), {
    start: "9",
    end: "10",
    label: "Trang 9 - 10",
  });
});

test("không gợi ý khi chưa nhập tên bài học", () => {
  assert.equal(suggestLessonPageRange("", [createPage(1, "Bài 1", "1")]), null);
});

function createPage(
  pageNumber: number,
  fullText: string,
  printedPageLabel: string,
): AdminSourceDocumentPageApi {
  return {
    id: `page-${pageNumber}`,
    sourceDocumentId: "source-1",
    pageNumber,
    status: "READY",
    textSource: "MATHPIX",
    qualityScore: 1,
    thumbnailFileId: null,
    thumbnailFile: null,
    textPreview: fullText,
    fullText,
    mathpixMarkdown: fullText,
    extractError: null,
    metadataJson: {
      printedPage: {
        pdfPageNumber: pageNumber,
        printedPageLabel,
        printedPageNumber: Number.parseInt(printedPageLabel, 10),
        warning: null,
      },
    },
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
}
