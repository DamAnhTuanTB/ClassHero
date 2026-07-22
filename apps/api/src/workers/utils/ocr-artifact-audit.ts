import type { NormalizedOcrPage } from "#api/workers/utils/ocr-artifact-normalizer";
import {
  OCR_ARTIFACT_AUDIT_SCHEMA_VERSION,
  OCR_DERIVED_ARTIFACT_VERSION,
} from "#api/workers/utils/ocr-artifact-versions";
import type { OcrImageManifest } from "#api/workers/utils/ocr-image-manifest";
import {
  resolveOcrVisualReference,
  type ResolvedOcrVisualReference,
} from "#api/workers/utils/ocr-visual-resolver";

export type OcrArtifactAuditSeverity = "info" | "warning" | "error";
export type OcrArtifactAuditStatus = "passed" | "warning" | "failed";

export interface OcrArtifactAuditIssue {
  severity: OcrArtifactAuditSeverity;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OcrArtifactAuditVisualSmokeTest {
  id: string;
  printedPageNumber?: number;
  printedPageLabel?: string;
  pdfPageNumber?: number;
  query?: string;
}

export interface OcrArtifactAudit {
  schemaVersion: typeof OCR_ARTIFACT_AUDIT_SCHEMA_VERSION;
  derivedArtifactVersion: typeof OCR_DERIVED_ARTIFACT_VERSION;
  createdAt: string;
  status: OcrArtifactAuditStatus;
  contentHash: string;
  provider: string;
  modelVersion: string;
  optionsHash: string;
  artifactBaseKey: string;
  artifactKeys: Record<string, string>;
  summary: {
    expectedPageCount: number;
    normalizedPageCount: number;
    nonEmptyPageCount: number;
    emptyPageCount: number;
    printedPageKnownCount: number;
    printedPageMissingCount: number;
    printedPageAmbiguousCount: number;
    printedPageDuplicateCount: number;
    providerImageCount: number;
    usableProviderImageCount: number;
    pagesWithProviderImages: number[];
    imagesWithoutPrintedPageCount: number;
    imagesWithInvalidNormalizedBoxCount: number;
    imagesWithBadVisualTextCount: number;
    imageQualityFlagCounts: Record<string, number>;
    visualSmokeTests: Array<{
      id: string;
      status: ResolvedOcrVisualReference["status"];
      candidateCount: number;
      pageFallbackCount: number;
      warnings: string[];
      topCandidate: {
        imageId: string;
        pageNumber: number;
        printedPageNumber: number | null;
        objectKey: string;
        kind: string;
        isUsableForAi: boolean;
      } | null;
    }>;
  };
  issues: OcrArtifactAuditIssue[];
}

export interface BuildOcrArtifactAuditInput {
  contentHash: string;
  provider: string;
  modelVersion: string;
  optionsHash: string;
  artifactBaseKey: string;
  artifactKeys: Record<string, string>;
  expectedPageCount: number;
  pages: NormalizedOcrPage[];
  imageManifest: OcrImageManifest;
  visualSmokeTests?: OcrArtifactAuditVisualSmokeTest[];
}

const DEFAULT_VISUAL_SMOKE_TESTS: OcrArtifactAuditVisualSmokeTest[] = [
  {
    id: "printed-page-35",
    printedPageNumber: 35,
    query: "hinh figure image",
  },
];

export function buildOcrArtifactAudit(
  input: BuildOcrArtifactAuditInput,
): OcrArtifactAudit {
  const issues: OcrArtifactAuditIssue[] = [];
  const emptyPages = input.pages.filter((page) => page.text.trim().length === 0);
  const missingPrintedPages = input.pages.filter(
    (page) => page.printedPage.warning === "missing",
  );
  const ambiguousPrintedPages = input.pages.filter(
    (page) => page.printedPage.warning === "ambiguous",
  );
  const duplicatePrintedPages = collectDuplicatePrintedPages(input.pages);
  const imagesWithoutPrintedPage = input.imageManifest.images.filter(
    (image) =>
      !image.printedPage ||
      (image.printedPage.printedPageNumber === null &&
        image.printedPage.printedPageLabel === null),
  );
  const imagesWithInvalidNormalizedBox = input.imageManifest.images.filter((image) =>
    hasInvalidNormalizedBox(image.normalizedBoundingBox),
  );
  const imagesWithBadVisualText = input.imageManifest.images.filter((image) =>
    hasBadVisualText(`${image.captionCandidate ?? ""}\n${image.nearbyText ?? ""}`),
  );
  const imagesWithInvalidPage = input.imageManifest.images.filter(
    (image) => image.pageNumber < 1 || image.pageNumber > input.expectedPageCount,
  );
  const imagesWithoutObjectKey = input.imageManifest.images.filter(
    (image) => image.objectKey.trim().length === 0,
  );

  if (input.pages.length !== input.expectedPageCount) {
    issues.push({
      severity: "error",
      code: "page_count_mismatch",
      message: "Normalized OCR page count does not match PDF metadata page count.",
      details: {
        expectedPageCount: input.expectedPageCount,
        normalizedPageCount: input.pages.length,
      },
    });
  }

  if (emptyPages.length > 0) {
    issues.push({
      severity: "warning",
      code: "empty_ocr_pages",
      message: "Some OCR pages have no extracted text.",
      details: { pageNumbers: samplePageNumbers(emptyPages) },
    });
  }

  if (missingPrintedPages.length > 0) {
    issues.push({
      severity: "info",
      code: "printed_page_missing",
      message: "Some pages do not have an inferred printed page number.",
      details: { pageNumbers: samplePageNumbers(missingPrintedPages) },
    });
  }

  if (ambiguousPrintedPages.length > 0) {
    issues.push({
      severity: "warning",
      code: "printed_page_ambiguous",
      message: "Some printed page numbers are ambiguous and may need review.",
      details: { pageNumbers: samplePageNumbers(ambiguousPrintedPages) },
    });
  }

  if (duplicatePrintedPages.length > 0) {
    issues.push({
      severity: "warning",
      code: "printed_page_duplicate",
      message: "One printed page number maps to multiple PDF pages.",
      details: { duplicates: duplicatePrintedPages.slice(0, 20) },
    });
  }

  if (imagesWithInvalidPage.length > 0) {
    issues.push({
      severity: "error",
      code: "image_page_out_of_range",
      message: "Some provider images point to pages outside the PDF range.",
      details: { imageIds: sampleImageIds(imagesWithInvalidPage) },
    });
  }

  if (imagesWithoutObjectKey.length > 0) {
    issues.push({
      severity: "error",
      code: "image_missing_object_key",
      message: "Some provider images are missing object storage keys.",
      details: { imageIds: sampleImageIds(imagesWithoutObjectKey) },
    });
  }

  if (imagesWithoutPrintedPage.length > 0) {
    issues.push({
      severity: "info",
      code: "image_missing_printed_page",
      message: "Some provider images are on pages without printed page mapping.",
      details: { imageIds: sampleImageIds(imagesWithoutPrintedPage) },
    });
  }

  if (imagesWithInvalidNormalizedBox.length > 0) {
    issues.push({
      severity: "error",
      code: "image_invalid_normalized_bbox",
      message: "Some provider image bounding boxes are outside normalized page bounds.",
      details: { imageIds: sampleImageIds(imagesWithInvalidNormalizedBox) },
    });
  }

  if (imagesWithBadVisualText.length > 0) {
    issues.push({
      severity: "error",
      code: "image_bad_visual_text",
      message: "Some provider image captions still contain raw CDN/includegraphics text.",
      details: { imageIds: sampleImageIds(imagesWithBadVisualText) },
    });
  }

  const visualSmokeTests = buildVisualSmokeTests(input);
  const status = resolveAuditStatus(issues);

  return {
    schemaVersion: OCR_ARTIFACT_AUDIT_SCHEMA_VERSION,
    derivedArtifactVersion: OCR_DERIVED_ARTIFACT_VERSION,
    createdAt: new Date().toISOString(),
    status,
    contentHash: input.contentHash,
    provider: input.provider,
    modelVersion: input.modelVersion,
    optionsHash: input.optionsHash,
    artifactBaseKey: input.artifactBaseKey,
    artifactKeys: input.artifactKeys,
    summary: {
      expectedPageCount: input.expectedPageCount,
      normalizedPageCount: input.pages.length,
      nonEmptyPageCount: input.pages.length - emptyPages.length,
      emptyPageCount: emptyPages.length,
      printedPageKnownCount: input.pages.filter(
        (page) =>
          page.printedPage.printedPageNumber !== null ||
          page.printedPage.printedPageLabel !== null,
      ).length,
      printedPageMissingCount: missingPrintedPages.length,
      printedPageAmbiguousCount: ambiguousPrintedPages.length,
      printedPageDuplicateCount: duplicatePrintedPages.length,
      providerImageCount: input.imageManifest.summary.totalImages,
      usableProviderImageCount: input.imageManifest.summary.usableImageCount,
      pagesWithProviderImages: input.imageManifest.summary.pagesWithImages,
      imagesWithoutPrintedPageCount: imagesWithoutPrintedPage.length,
      imagesWithInvalidNormalizedBoxCount: imagesWithInvalidNormalizedBox.length,
      imagesWithBadVisualTextCount: imagesWithBadVisualText.length,
      imageQualityFlagCounts: input.imageManifest.summary.qualityFlagCounts,
      visualSmokeTests,
    },
    issues,
  };
}

function collectDuplicatePrintedPages(pages: NormalizedOcrPage[]) {
  const byPrintedPage = new Map<number, number[]>();

  for (const page of pages) {
    const printedPageNumber = page.printedPage.printedPageNumber;
    if (printedPageNumber === null) continue;

    const pdfPages = byPrintedPage.get(printedPageNumber) ?? [];
    pdfPages.push(page.pageNumber);
    byPrintedPage.set(printedPageNumber, pdfPages);
  }

  return [...byPrintedPage.entries()]
    .filter(([, pdfPageNumbers]) => pdfPageNumbers.length > 1)
    .map(([printedPageNumber, pdfPageNumbers]) => ({
      printedPageNumber,
      pdfPageNumbers,
    }));
}

function buildVisualSmokeTests(input: BuildOcrArtifactAuditInput) {
  const smokeTests = input.visualSmokeTests ?? DEFAULT_VISUAL_SMOKE_TESTS;

  return smokeTests.map((smokeTest) => {
    const resolved = resolveOcrVisualReference({
      manifest: input.imageManifest,
      printedPageNumber: smokeTest.printedPageNumber,
      printedPageLabel: smokeTest.printedPageLabel,
      pdfPageNumber: smokeTest.pdfPageNumber,
      query: smokeTest.query,
      kind: "visual",
      maxCandidates: 5,
    });
    const topCandidate = resolved.candidates[0] ?? null;

    return {
      id: smokeTest.id,
      status: resolved.status,
      candidateCount: resolved.candidates.length,
      pageFallbackCount: resolved.pageFallbacks.length,
      warnings: resolved.warnings,
      topCandidate: topCandidate
        ? {
            imageId: topCandidate.imageId,
            pageNumber: topCandidate.pageNumber,
            printedPageNumber: topCandidate.printedPage?.printedPageNumber ?? null,
            objectKey: topCandidate.objectKey,
            kind: topCandidate.kind,
            isUsableForAi: topCandidate.isUsableForAi,
          }
        : null,
    };
  });
}

function resolveAuditStatus(issues: OcrArtifactAuditIssue[]): OcrArtifactAuditStatus {
  if (issues.some((issue) => issue.severity === "error")) {
    return "failed";
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }

  return "passed";
}

function hasInvalidNormalizedBox(
  box: { x: number; y: number; w: number; h: number } | null,
): boolean {
  if (!box) {
    return false;
  }

  return (
    box.x < -0.001 ||
    box.y < -0.001 ||
    box.w <= 0 ||
    box.h <= 0 ||
    box.x + box.w > 1.001 ||
    box.y + box.h > 1.001
  );
}

function hasBadVisualText(value: string): boolean {
  return /(cdn\.mathpix\.com|includegraphics|https?:\/\/)/i.test(value);
}

function samplePageNumbers(pages: NormalizedOcrPage[]): number[] {
  return pages.slice(0, 20).map((page) => page.pageNumber);
}

function sampleImageIds(images: Array<{ imageId: string }>): string[] {
  return images.slice(0, 20).map((image) => image.imageId);
}
