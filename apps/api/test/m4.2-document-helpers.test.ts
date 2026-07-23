import { BadRequestException } from "@nestjs/common";
import {
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertNoDuplicateLessonRanges,
  assertNoOverlappingSourceExtractions,
  assertPageRangeOrder,
  buildPageRangeWarnings,
  normalizeOptionalTitle,
} from "#api/modules/learning-paths/utils/document.helpers";
import {
  serializeDocumentFile,
  serializeSourceDocumentPage,
} from "#api/modules/learning-paths/serializers/document.serializers";
import type {
  DocumentFileRecord,
  SourceDocumentPageRecord,
} from "#api/modules/learning-paths/types/document.types";

describe("M4.2 document range helpers", () => {
  it("normalizes optional titles without converting undefined to null", () => {
    expect(normalizeOptionalTitle(undefined)).toBeUndefined();
    expect(normalizeOptionalTitle(null)).toBeNull();
    expect(normalizeOptionalTitle("  Phiếu   luyện tập  ")).toBe("Phiếu luyện tập");
    expect(normalizeOptionalTitle("   ")).toBeNull();
  });

  it("rejects inverted page ranges", () => {
    expect(() => assertPageRangeOrder(2, 2)).not.toThrow();
    expect(() => assertPageRangeOrder(5, 3)).toThrow(BadRequestException);
  });

  it("rejects duplicate lesson ranges in one source document payload", () => {
    const duplicateLessonId = "00000000-0000-0000-0000-000000000001";

    expect(() =>
      assertNoDuplicateLessonRanges([
        { lessonId: duplicateLessonId, pageStart: 1, pageEnd: 2 },
        { lessonId: duplicateLessonId, pageStart: 3, pageEnd: 4 },
      ]),
    ).toThrow(BadRequestException);
  });

  it("rejects inclusive overlap only when extraction blocks use the same source", () => {
    expect(() =>
      assertNoOverlappingSourceExtractions([
        {
          sourceDocumentId: "source-a",
          pageStart: 1,
          pageEnd: 5,
        },
        {
          sourceDocumentId: "source-a",
          pageStart: 5,
          pageEnd: 8,
        },
      ]),
    ).toThrow(BadRequestException);

    expect(() =>
      assertNoOverlappingSourceExtractions([
        {
          sourceDocumentId: "source-a",
          pageStart: 1,
          pageEnd: 5,
        },
        {
          sourceDocumentId: "source-b",
          pageStart: 5,
          pageEnd: 8,
        },
      ]),
    ).not.toThrow();
  });

  it("returns overlap and gap warnings without blocking save", () => {
    const warnings = buildPageRangeWarnings(
      [
        { lessonId: "lesson-a", pageStart: 1, pageEnd: 3 },
        { lessonId: "lesson-b", pageStart: 3, pageEnd: 4 },
        { lessonId: "lesson-c", pageStart: 7, pageEnd: 8 },
      ],
      10,
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      "PAGE_RANGE_OVERLAP",
      "PAGE_RANGE_GAP",
    ]);
    expect(warnings[1]?.details).toEqual([
      { pageStart: 5, pageEnd: 6 },
      { pageStart: 9, pageEnd: 10 },
    ]);
  });
});

describe("M4.2 document serializers", () => {
  it("serializes file size from bigint for API responses", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    const file: DocumentFileRecord = {
      id: "file-1",
      provider: FileProvider.MINIO_LOCAL,
      purpose: FilePurpose.LESSON_DOCUMENT,
      originalName: "source.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234n,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.UPLOADED,
      uploadedById: "admin-1",
      publicUrl: null,
      checksum: "checksum",
      createdAt: now,
      updatedAt: now,
    };

    expect(serializeDocumentFile(file)).toEqual({
      id: "file-1",
      provider: FileProvider.MINIO_LOCAL,
      purpose: FilePurpose.LESSON_DOCUMENT,
      originalName: "source.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.UPLOADED,
      uploadedById: "admin-1",
      publicUrl: null,
      checksum: "checksum",
      createdAt: now,
      updatedAt: now,
    });
  });

  it("only returns source page text preview, not full page text", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    const page: SourceDocumentPageRecord = {
      id: "page-1",
      sourceDocumentId: "source-1",
      pageNumber: 1,
      status: DocumentStatus.READY,
      text: "a".repeat(260),
      textSource: "text_layer",
      qualityScore: 0.92,
      thumbnailFileId: null,
      thumbnailFile: null,
      extractError: null,
      metadataJson: null,
      createdAt: now,
      updatedAt: now,
    };

    const response = serializeSourceDocumentPage(page);

    expect(response.textPreview?.length).toBe(240);
    expect("text" in response).toBe(false);
  });
});
