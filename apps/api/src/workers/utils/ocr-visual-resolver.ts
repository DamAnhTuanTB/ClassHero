import type {
  OcrImageManifest,
  OcrImageManifestImage,
  OcrImageManifestPage,
  OcrVisualAssetKind,
} from "#api/workers/utils/ocr-image-manifest";

export interface ResolveOcrVisualReferenceInput {
  manifest: OcrImageManifest;
  printedPageNumber?: number;
  printedPageLabel?: string;
  pdfPageNumber?: number;
  query?: string;
  kind?: OcrVisualAssetKind | "visual";
  maxCandidates?: number;
}

export interface ResolvedOcrVisualCandidate {
  imageId: string;
  pageNumber: number;
  printedPage: OcrImageManifestImage["printedPage"];
  orderInPage: number;
  kind: OcrImageManifestImage["kind"];
  isUsableForAi: boolean;
  qualityFlags: string[];
  objectKey: string;
  filename: string;
  mimeType: string;
  size: number;
  boundingBox: OcrImageManifestImage["boundingBox"];
  normalizedBoundingBox: OcrImageManifestImage["normalizedBoundingBox"];
  pageDimensions: OcrImageManifestImage["pageDimensions"];
  captionCandidate: string | null;
  nearbyText: string | null;
  score: number;
}

export interface ResolvedOcrVisualPageFallback {
  pageNumber: number;
  printedPage: OcrImageManifestPage["printedPage"];
  pageDimensions: OcrImageManifestPage["pageDimensions"];
  imageCount: number;
}

export interface ResolvedOcrVisualReference {
  status: "resolved" | "ambiguous" | "not_found";
  candidates: ResolvedOcrVisualCandidate[];
  pageFallbacks: ResolvedOcrVisualPageFallback[];
  warnings: string[];
}

export function resolveOcrVisualReference(
  input: ResolveOcrVisualReferenceInput,
): ResolvedOcrVisualReference {
  const maxCandidates = Math.max(1, input.maxCandidates ?? 5);
  const pageFallbacks = findMatchingPages(input);
  const pageNumbers = new Set(pageFallbacks.map((page) => page.pageNumber));
  const queryTerms = tokenize(input.query);

  let images = input.manifest.images.filter((image) => pageNumbers.has(image.pageNumber));

  if (input.kind && input.kind !== "visual") {
    images = images.filter((image) => image.kind === input.kind);
  }

  const rankedCandidates = images
    .map((image) => ({
      image,
      score: scoreImage(image, input.kind, queryTerms),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.image.pageNumber !== b.image.pageNumber) {
        return a.image.pageNumber - b.image.pageNumber;
      }
      return a.image.orderInPage - b.image.orderInPage;
    })
    .slice(0, maxCandidates)
    .map(({ image, score }): ResolvedOcrVisualCandidate => ({
      imageId: image.imageId,
      pageNumber: image.pageNumber,
      printedPage: image.printedPage,
      orderInPage: image.orderInPage,
      kind: image.kind,
      isUsableForAi: image.isUsableForAi,
      qualityFlags: image.qualityFlags,
      objectKey: image.objectKey,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      boundingBox: image.boundingBox,
      normalizedBoundingBox: image.normalizedBoundingBox,
      pageDimensions: image.pageDimensions,
      captionCandidate: image.captionCandidate,
      nearbyText: image.nearbyText,
      score,
    }));

  const warnings = buildWarnings({
    pageFallbacks,
    candidates: rankedCandidates,
    input,
  });

  return {
    status: resolveStatus(rankedCandidates),
    candidates: rankedCandidates,
    pageFallbacks,
    warnings,
  };
}

function findMatchingPages(
  input: ResolveOcrVisualReferenceInput,
): ResolvedOcrVisualPageFallback[] {
  const pages = input.manifest.pages.filter((page) => {
    if (
      typeof input.pdfPageNumber === "number" &&
      page.pageNumber !== input.pdfPageNumber
    ) {
      return false;
    }

    if (
      typeof input.printedPageNumber === "number" &&
      page.printedPage?.printedPageNumber !== input.printedPageNumber
    ) {
      return false;
    }

    if (
      input.printedPageLabel &&
      page.printedPage?.printedPageLabel !== input.printedPageLabel
    ) {
      return false;
    }

    return true;
  });

  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    printedPage: page.printedPage,
    pageDimensions: page.pageDimensions,
    imageCount: page.imageCount,
  }));
}

function scoreImage(
  image: OcrImageManifestImage,
  kind: OcrVisualAssetKind | "visual" | undefined,
  queryTerms: string[],
): number {
  let score = 0;

  if (image.isUsableForAi) score += 50;
  if (kind && kind !== "visual" && image.kind === kind) score += 30;
  if (image.kind !== "unknown") score += 8;
  if (image.captionCandidate) score += 6;
  if (image.nearbyText) score += 3;

  const text = normalizeText(
    `${image.captionCandidate ?? ""}\n${image.nearbyText ?? ""}`,
  );
  const matchingTerms = queryTerms.filter((term) => text.includes(term)).length;
  score += matchingTerms * 12;

  if (image.qualityFlags.includes("missing_context")) score -= 8;
  if (!image.isUsableForAi) score -= 20;

  return score;
}

function resolveStatus(
  candidates: ResolvedOcrVisualCandidate[],
): ResolvedOcrVisualReference["status"] {
  if (candidates.length === 0) {
    return "not_found";
  }

  if (candidates.length === 1) {
    return "resolved";
  }

  const [first, second] = candidates;
  if (first && second && first.score >= second.score + 8) {
    return "resolved";
  }

  return "ambiguous";
}

function buildWarnings({
  pageFallbacks,
  candidates,
  input,
}: {
  pageFallbacks: ResolvedOcrVisualPageFallback[];
  candidates: ResolvedOcrVisualCandidate[];
  input: ResolveOcrVisualReferenceInput;
}): string[] {
  const warnings: string[] = [];

  if (pageFallbacks.length === 0) {
    warnings.push("page_not_found");
  }

  if (pageFallbacks.length > 1) {
    warnings.push("multiple_pdf_pages_match_reference");
  }

  if (pageFallbacks.length > 0 && candidates.length === 0) {
    warnings.push("no_provider_image_on_page");
  }

  if (candidates.length > 1) {
    warnings.push("multiple_visual_candidates");
  }

  if (
    input.kind &&
    input.kind !== "visual" &&
    candidates.every((candidate) => candidate.kind !== input.kind)
  ) {
    warnings.push("kind_not_found");
  }

  return warnings;
}

function tokenize(value: string | undefined): string[] {
  return normalizeText(value ?? "")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 2);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}
