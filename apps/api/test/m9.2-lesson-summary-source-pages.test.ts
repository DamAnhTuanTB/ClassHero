import { describe, expect, it } from "vitest";
import { readAdminLessonSummarySourcePages } from "#api/modules/learning-paths/services/lesson-summaries.service";

describe("M9.2 admin lesson summary source pages", () => {
  it("maps packet pages back to their original PDF files and page numbers", () => {
    expect(
      readAdminLessonSummarySourcePages({
        version: 1,
        lessonId: "00000000-0000-4000-8000-000000000001",
        packetHash: "packet-hash",
        pageCount: 2,
        pages: [
          {
            packetPageNumber: 1,
            sourceKey: "document-a:4",
            lessonDocumentId: "00000000-0000-4000-8000-000000000002",
            sourceDocumentId: "00000000-0000-4000-8000-000000000003",
            sourceFileId: "00000000-0000-4000-8000-000000000004",
            sourcePdfPageNumber: 4,
            printedPageLabel: "2",
            pageRangeId: "00000000-0000-4000-8000-000000000005",
            documentTitle: "Toán 7",
            segmentOrder: 0,
          },
          {
            packetPageNumber: 2,
            sourceKey: "document-b:9",
            lessonDocumentId: "00000000-0000-4000-8000-000000000006",
            sourceDocumentId: null,
            sourceFileId: "00000000-0000-4000-8000-000000000007",
            sourcePdfPageNumber: 9,
            printedPageLabel: null,
            pageRangeId: null,
            documentTitle: "Phiếu bổ sung",
            segmentOrder: 1,
          },
        ],
      }),
    ).toEqual([
      {
        packetPageNumber: 1,
        sourceFileId: "00000000-0000-4000-8000-000000000004",
        sourcePdfPageNumber: 4,
        printedPageLabel: "2",
        documentTitle: "Toán 7",
      },
      {
        packetPageNumber: 2,
        sourceFileId: "00000000-0000-4000-8000-000000000007",
        sourcePdfPageNumber: 9,
        printedPageLabel: null,
        documentTitle: "Phiếu bổ sung",
      },
    ]);
  });

  it("returns no source pages for an invalid or legacy manifest", () => {
    expect(readAdminLessonSummarySourcePages({ version: 0 })).toEqual([]);
    expect(readAdminLessonSummarySourcePages(null)).toEqual([]);
  });
});
