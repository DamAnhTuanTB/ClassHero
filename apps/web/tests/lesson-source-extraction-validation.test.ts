import assert from "node:assert/strict";
import test from "node:test";
import {
  createLessonSchema,
  emptyLessonValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";

test("báo lỗi khi Đến trang vượt trang in lớn nhất", () => {
  const schema = createLessonSchema([], {
    "source-1": [createPage(1, 1), createPage(16, 16)],
  });
  const result = schema.safeParse({
    ...emptyLessonValues,
    title: "Bài 1",
    sourceDocumentExtractions: [
      {
        clientKey: "extraction-1",
        sourceDocumentId: "source-1",
        pageStart: "1",
        pageEnd: "17",
        hasInteracted: true,
      },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.error.issues.find(
        (issue) => issue.path.join(".") === "sourceDocumentExtractions.0.pageEnd",
      )?.message,
      "Trang kết thúc tối đa là 16",
    );
  }
});

test("báo lỗi khi Từ trang vượt trang in lớn nhất", () => {
  const schema = createLessonSchema([], {
    "source-1": [createPage(1, 1), createPage(16, 16)],
  });
  const result = schema.safeParse({
    ...emptyLessonValues,
    title: "Bài 1",
    sourceDocumentExtractions: [
      {
        clientKey: "extraction-1",
        sourceDocumentId: "source-1",
        pageStart: "17",
        pageEnd: "17",
        hasInteracted: true,
      },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.error.issues.find(
        (issue) => issue.path.join(".") === "sourceDocumentExtractions.0.pageStart",
      )?.message,
      "Trang bắt đầu tối đa là 16",
    );
  }
});

test("chấp nhận Đến trang bằng trang in lớn nhất", () => {
  const schema = createLessonSchema([], {
    "source-1": [createPage(1, 1), createPage(16, 16)],
  });
  const result = schema.safeParse({
    ...emptyLessonValues,
    title: "Bài 1",
    sourceDocumentExtractions: [
      {
        clientKey: "extraction-1",
        sourceDocumentId: "source-1",
        pageStart: "1",
        pageEnd: "16",
        hasInteracted: true,
      },
    ],
  });

  assert.equal(result.success, true);
});

function createPage(
  pageNumber: number,
  printedPageNumber: number,
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
    textPreview: null,
    fullText: null,
    mathpixMarkdown: null,
    extractError: null,
    metadataJson: {
      printedPage: {
        pdfPageNumber: pageNumber,
        printedPageLabel: String(printedPageNumber),
        printedPageNumber,
        warning: null,
      },
    },
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
}
