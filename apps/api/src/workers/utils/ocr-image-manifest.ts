import { createHash } from "node:crypto";
import type { NormalizedOcrPage } from "#api/workers/utils/ocr-artifact-normalizer";
import {
  OCR_DERIVED_ARTIFACT_VERSION,
  OCR_IMAGE_MANIFEST_SCHEMA_VERSION,
} from "#api/workers/utils/ocr-artifact-versions";
import type { PrintedPageReference } from "#api/workers/utils/ocr-printed-page";

export type OcrVisualAssetKind =
  "figure" | "diagram" | "table" | "equation" | "image" | "unknown";

export interface OcrImageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrNormalizedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrPageDimensions {
  width: number;
  height: number;
  source: "lines.json" | "inferred_bounds";
  coordinateSystem: "mathpix_page_pixels";
}

export interface OcrImageManifestInputImage {
  pageNumber: number;
  objectKey: string;
  filename: string;
  boundingBox: OcrImageBox;
  size: number;
  mimeType: string;
}

export interface OcrImageManifestNearbyLine {
  lineId: string;
  lineIndex: number;
  text: string;
  type: string | null;
  confidence: number | null;
  boundingBox: OcrImageBox | null;
  normalizedBoundingBox: OcrNormalizedBox | null;
  relation: "above" | "below" | "overlap" | "unknown";
  distance: number | null;
}

export interface OcrImageManifestImage {
  imageId: string;
  pageNumber: number;
  printedPage: PrintedPageReference | null;
  orderInPage: number;
  objectKey: string;
  filename: string;
  mimeType: string;
  size: number;
  sourceArtifact: "mmd.zip";
  sourceArtifactPath: string;
  htmlAssetPath: string;
  boundingBox: OcrImageBox;
  normalizedBoundingBox: OcrNormalizedBox | null;
  pageDimensions: OcrPageDimensions | null;
  center: { x: number; y: number };
  normalizedCenter: { x: number; y: number } | null;
  areaRatio: number | null;
  qualityFlags: string[];
  isUsableForAi: boolean;
  position: {
    horizontal: "left" | "center" | "right" | "unknown";
    vertical: "top" | "middle" | "bottom" | "unknown";
  };
  nearbyLineIds: string[];
  nearbyLines: OcrImageManifestNearbyLine[];
  nearbyText: string | null;
  captionCandidate: string | null;
  kind: OcrVisualAssetKind;
  kindSource: "caption_heuristic" | "nearby_text_heuristic" | "unknown";
}

export interface OcrImageManifestPage {
  pageNumber: number;
  printedPage: PrintedPageReference | null;
  pageDimensions: OcrPageDimensions | null;
  imageCount: number;
  imageIds: string[];
}

export interface OcrImageManifestSummary {
  totalImages: number;
  usableImageCount: number;
  pagesWithImages: number[];
  imagesByKind: Record<OcrVisualAssetKind, number>;
  qualityFlagCounts: Record<string, number>;
}

export interface OcrImageManifest {
  schemaVersion: typeof OCR_IMAGE_MANIFEST_SCHEMA_VERSION;
  derivedArtifactVersion: typeof OCR_DERIVED_ARTIFACT_VERSION;
  contentHash: string;
  provider: string;
  modelVersion: string;
  optionsHash: string;
  artifactBaseKey: string;
  artifactKeys: {
    mmdZip: string;
    htmlZip: string;
    linesJson: string;
    pagesJson: string;
    imageManifestJson: string;
    artifactAuditJson?: string;
  };
  pdfId: string;
  pageCount: number;
  ownerId: string;
  extractionStatus: "succeeded" | "failed";
  extractionError: string | null;
  createdAt: string;
  summary: OcrImageManifestSummary;
  pages: OcrImageManifestPage[];
  images: OcrImageManifestImage[];
}

export interface BuildOcrImageManifestInput {
  contentHash: string;
  provider: string;
  modelVersion: string;
  optionsHash: string;
  artifactBaseKey: string;
  artifactKeys: {
    mmdZip: string;
    htmlZip: string;
    linesJson: string;
    pagesJson: string;
    imageManifestJson: string;
    artifactAuditJson?: string;
  };
  pdfId: string;
  pageCount: number;
  ownerId: string;
  linesJson: Buffer;
  pages: NormalizedOcrPage[];
  images: OcrImageManifestInputImage[];
  extractionStatus?: "succeeded" | "failed";
  extractionError?: string | null;
}

interface LayoutLine {
  lineIndex: number;
  lineId: string;
  text: string;
  type: string | null;
  confidence: number | null;
  boundingBox: OcrImageBox | null;
}

interface PageLayout {
  pageNumber: number;
  dimensions: OcrPageDimensions | null;
  lines: LayoutLine[];
}

export function buildOcrImageManifest(
  input: BuildOcrImageManifestInput,
): OcrImageManifest {
  const layouts = extractPageLayouts(input.linesJson, input.pageCount);
  const printedPages = new Map(
    input.pages.map((page) => [page.pageNumber, page.printedPage] as const),
  );
  const sortedImages = [...input.images].sort(compareImages);
  const orderByPage = new Map<number, number>();

  const images = sortedImages.map((image) => {
    const orderInPage = (orderByPage.get(image.pageNumber) ?? 0) + 1;
    orderByPage.set(image.pageNumber, orderInPage);

    const layout = layouts.get(image.pageNumber) ?? {
      pageNumber: image.pageNumber,
      dimensions: null,
      lines: [],
    };
    const pageDimensions = layout.dimensions ?? inferPageDimensions(image, layout.lines);
    const normalizedBoundingBox = normalizeBox(image.boundingBox, pageDimensions);
    const nearbyLines = findNearbyLines(image.boundingBox, layout.lines, pageDimensions);
    const nearbyText = buildNearbyText(nearbyLines);
    const captionCandidate = findCaptionCandidate(nearbyLines);
    const kind = inferImageKind(captionCandidate, nearbyText);
    const areaRatio = computeAreaRatio(image.boundingBox, pageDimensions);
    const qualityFlags = buildImageQualityFlags({
      normalizedBoundingBox,
      pageDimensions,
      areaRatio,
      nearbyText,
      captionCandidate,
    });

    return {
      imageId: buildImageId(input.contentHash, image),
      pageNumber: image.pageNumber,
      printedPage: printedPages.get(image.pageNumber) ?? null,
      orderInPage,
      objectKey: image.objectKey,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      sourceArtifact: "mmd.zip" as const,
      sourceArtifactPath: `images/${image.filename}`,
      htmlAssetPath: `images/${image.filename}`,
      boundingBox: image.boundingBox,
      normalizedBoundingBox,
      pageDimensions,
      center: {
        x: image.boundingBox.x + image.boundingBox.w / 2,
        y: image.boundingBox.y + image.boundingBox.h / 2,
      },
      normalizedCenter: normalizePoint(
        {
          x: image.boundingBox.x + image.boundingBox.w / 2,
          y: image.boundingBox.y + image.boundingBox.h / 2,
        },
        pageDimensions,
      ),
      areaRatio,
      qualityFlags,
      isUsableForAi: isUsableForAi(qualityFlags),
      position: resolvePosition(image.boundingBox, pageDimensions),
      nearbyLineIds: nearbyLines.map((line) => line.lineId),
      nearbyLines,
      nearbyText,
      captionCandidate,
      kind: kind.kind,
      kindSource: kind.source,
    };
  });

  const imagesByPage = groupImagesByPage(images);
  const pages = Array.from({ length: input.pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const pageImages = imagesByPage.get(pageNumber) ?? [];
    const layout = layouts.get(pageNumber);

    return {
      pageNumber,
      printedPage: printedPages.get(pageNumber) ?? null,
      pageDimensions:
        layout?.dimensions ??
        pageImages[0]?.pageDimensions ??
        inferPageDimensionsFromLines(layout?.lines ?? []),
      imageCount: pageImages.length,
      imageIds: pageImages.map((image) => image.imageId),
    };
  });
  const pagesWithImages = pages
    .filter((page) => page.imageCount > 0)
    .map((page) => page.pageNumber);

  return {
    schemaVersion: OCR_IMAGE_MANIFEST_SCHEMA_VERSION,
    derivedArtifactVersion: OCR_DERIVED_ARTIFACT_VERSION,
    contentHash: input.contentHash,
    provider: input.provider,
    modelVersion: input.modelVersion,
    optionsHash: input.optionsHash,
    artifactBaseKey: input.artifactBaseKey,
    artifactKeys: input.artifactKeys,
    pdfId: input.pdfId,
    pageCount: input.pageCount,
    ownerId: input.ownerId,
    extractionStatus: input.extractionStatus ?? "succeeded",
    extractionError: input.extractionError ?? null,
    createdAt: new Date().toISOString(),
    summary: {
      totalImages: images.length,
      usableImageCount: images.filter((image) => image.isUsableForAi).length,
      pagesWithImages,
      imagesByKind: summarizeByKind(images),
      qualityFlagCounts: summarizeQualityFlags(images),
    },
    pages,
    images,
  };
}

function extractPageLayouts(
  linesJson: Buffer,
  expectedPages: number,
): Map<number, PageLayout> {
  const layouts = new Map<number, PageLayout>();

  try {
    const parsed = JSON.parse(linesJson.toString("utf8")) as unknown;
    const pageRecords = extractPageRecords(parsed);

    for (
      let pageIndex = 0;
      pageIndex < Math.max(expectedPages, pageRecords.length);
      pageIndex += 1
    ) {
      const pageRecord = pageRecords[pageIndex];
      const pageNumber = resolvePageNumber(pageRecord, pageIndex);
      const record = isRecord(pageRecord) ? pageRecord : {};
      const lines = Array.isArray(record.lines) ? record.lines : [];
      layouts.set(pageNumber, {
        pageNumber,
        dimensions: readPageDimensions(record),
        lines: lines
          .filter(isRecord)
          .map((line, lineIndex) => normalizeLayoutLine(line, pageNumber, lineIndex)),
      });
    }
  } catch {
    return layouts;
  }

  return layouts;
}

function extractPageRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.pages)) {
    return value.pages;
  }

  return [];
}

function resolvePageNumber(value: unknown, pageIndex: number): number {
  const record = isRecord(value) ? value : {};
  const raw =
    readNumber(record, "page") ??
    readNumber(record, "pageNumber") ??
    readNumber(record, "page_number") ??
    readNumber(record, "page_index");

  if (raw === null) {
    return pageIndex + 1;
  }

  return raw <= 0 ? pageIndex + 1 : Math.round(raw);
}

function readPageDimensions(record: Record<string, unknown>): OcrPageDimensions | null {
  const width =
    readNumber(record, "page_width") ??
    readNumber(record, "pageWidth") ??
    readNumber(record, "width");
  const height =
    readNumber(record, "page_height") ??
    readNumber(record, "pageHeight") ??
    readNumber(record, "height");

  if (isPositive(width) && isPositive(height)) {
    return {
      width,
      height,
      source: "lines.json",
      coordinateSystem: "mathpix_page_pixels",
    };
  }

  const dimensions = isRecord(record.dimensions) ? record.dimensions : null;
  const nestedWidth = dimensions ? readNumber(dimensions, "width") : null;
  const nestedHeight = dimensions ? readNumber(dimensions, "height") : null;

  if (isPositive(nestedWidth) && isPositive(nestedHeight)) {
    return {
      width: nestedWidth,
      height: nestedHeight,
      source: "lines.json",
      coordinateSystem: "mathpix_page_pixels",
    };
  }

  return null;
}

function normalizeLayoutLine(
  line: Record<string, unknown>,
  pageNumber: number,
  lineIndex: number,
): LayoutLine {
  const rawText =
    readString(line, "text") ??
    readString(line, "text_display") ??
    readString(line, "html") ??
    "";

  return {
    lineIndex,
    lineId:
      readString(line, "id") ??
      readString(line, "line_id") ??
      `p${pageNumber}:line${lineIndex + 1}`,
    text: sanitizeVisualText(rawText),
    type: readString(line, "type"),
    confidence: readNumber(line, "confidence") ?? readNumber(line, "confidence_rate"),
    boundingBox: readLineBox(line),
  };
}

function sanitizeVisualText(value: string): string {
  const caption = extractLatexCaption(value);
  const text = caption ?? value;

  return text
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\captionsetup\{[^}]*\}/g, "")
    .replace(/\\(?:begin|end)\{[^}]+\}/g, "")
    .replace(/\\(?:begin|end)\{?[A-Za-z*]+}?/g, "")
    .replace(/https?:\/\/[^\s}]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLatexCaption(value: string): string | null {
  const match = /\\caption\{([\s\S]*?)\}(?:\s*\\end\{figure\})?/i.exec(value);
  if (!match) {
    return null;
  }

  return match[1] ?? null;
}

function readLineBox(line: Record<string, unknown>): OcrImageBox | null {
  const region = isRecord(line.region) ? line.region : null;
  if (region) {
    const x = readNumber(region, "top_left_x") ?? readNumber(region, "x");
    const y = readNumber(region, "top_left_y") ?? readNumber(region, "y");
    const w = readNumber(region, "width") ?? readNumber(region, "w");
    const h = readNumber(region, "height") ?? readNumber(region, "h");

    if (isNumber(x) && isNumber(y) && isPositive(w) && isPositive(h)) {
      return { x, y, w, h };
    }
  }

  const box =
    (isRecord(line.bbox) && line.bbox) ||
    (isRecord(line.boundingBox) && line.boundingBox) ||
    (isRecord(line.bounding_box) && line.bounding_box) ||
    null;

  if (box) {
    const x = readNumber(box, "x") ?? readNumber(box, "left");
    const y = readNumber(box, "y") ?? readNumber(box, "top");
    const w = readNumber(box, "w") ?? readNumber(box, "width");
    const h = readNumber(box, "h") ?? readNumber(box, "height");

    if (isNumber(x) && isNumber(y) && isPositive(w) && isPositive(h)) {
      return { x, y, w, h };
    }
  }

  if (Array.isArray(line.cnt)) {
    return boxFromPolygon(line.cnt);
  }

  return null;
}

function boxFromPolygon(value: unknown[]): OcrImageBox | null {
  const points = value
    .filter(Array.isArray)
    .map((point) => ({
      x: typeof point[0] === "number" ? point[0] : null,
      y: typeof point[1] === "number" ? point[1] : null,
    }))
    .filter(
      (point): point is { x: number; y: number } => point.x !== null && point.y !== null,
    );

  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;

  return { x, y, w, h };
}

function findNearbyLines(
  imageBox: OcrImageBox,
  lines: LayoutLine[],
  pageDimensions: OcrPageDimensions | null,
): OcrImageManifestNearbyLine[] {
  const pageHeight = pageDimensions?.height ?? inferPageHeight(imageBox, lines);
  const maxDistance = Math.max(160, pageHeight * 0.08);
  const ranked = lines
    .map((line) => {
      const relation = resolveRelation(imageBox, line.boundingBox);
      const distance = line.boundingBox
        ? verticalDistance(imageBox, line.boundingBox)
        : null;
      const horizontalOverlap = line.boundingBox
        ? overlapRatio(
            imageBox.x,
            imageBox.x + imageBox.w,
            line.boundingBox.x,
            line.boundingBox.x + line.boundingBox.w,
          )
        : 0;
      const score =
        (distance ?? Number.MAX_SAFE_INTEGER) -
        horizontalOverlap * 40 +
        (relation === "below" ? -8 : 0);

      return { line, relation, distance, score };
    })
    .filter(
      ({ line, distance }) =>
        line.text.trim().length > 0 && (distance === null || distance <= maxDistance),
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);

  return ranked.map(({ line, relation, distance }) => ({
    lineId: line.lineId,
    lineIndex: line.lineIndex,
    text: line.text,
    type: line.type,
    confidence: line.confidence,
    boundingBox: line.boundingBox,
    normalizedBoundingBox: line.boundingBox
      ? normalizeBox(line.boundingBox, pageDimensions)
      : null,
    relation,
    distance,
  }));
}

function buildNearbyText(lines: OcrImageManifestNearbyLine[]): string | null {
  const text = lines
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200)
    .trim();

  return text.length > 0 ? text : null;
}

function findCaptionCandidate(lines: OcrImageManifestNearbyLine[]): string | null {
  const captionPattern =
    /\b(h[iì]nh|figure|fig\.?|bi[eể]u\s*[dđ][oồ]|s[oơ]\s*[dđ][oồ]|b[aả]ng|table|diagram)\b/i;
  const explicit = lines.find((line) => captionPattern.test(line.text));
  if (explicit) {
    return explicit.text;
  }

  const below = lines.find(
    (line) => line.relation === "below" && line.text.length <= 180,
  );
  if (below) {
    return below.text;
  }

  const above = lines.find(
    (line) => line.relation === "above" && line.text.length <= 180,
  );
  return above?.text ?? null;
}

function inferImageKind(
  captionCandidate: string | null,
  nearbyText: string | null,
): { kind: OcrVisualAssetKind; source: OcrImageManifestImage["kindSource"] } {
  const caption = captionCandidate?.toLowerCase() ?? "";
  const nearby = nearbyText?.toLowerCase() ?? "";
  const text = `${caption}\n${nearby}`;

  if (/\b(bảng|table)\b/i.test(text)) {
    return {
      kind: "table",
      source: caption ? "caption_heuristic" : "nearby_text_heuristic",
    };
  }

  if (/\b(phương trình|công thức|equation|formula)\b/i.test(text)) {
    return {
      kind: "equation",
      source: caption ? "caption_heuristic" : "nearby_text_heuristic",
    };
  }

  if (/\b(đồ thị|biểu đồ|sơ đồ|graph|chart|diagram)\b/i.test(text)) {
    return {
      kind: "diagram",
      source: caption ? "caption_heuristic" : "nearby_text_heuristic",
    };
  }

  if (/\b(hình|figure|fig\.?|tam giác|đường tròn|hình học)\b/i.test(text)) {
    return {
      kind: "figure",
      source: caption ? "caption_heuristic" : "nearby_text_heuristic",
    };
  }

  return { kind: "unknown", source: "unknown" };
}

function groupImagesByPage(
  images: OcrImageManifestImage[],
): Map<number, OcrImageManifestImage[]> {
  const map = new Map<number, OcrImageManifestImage[]>();
  for (const image of images) {
    const pageImages = map.get(image.pageNumber) ?? [];
    pageImages.push(image);
    map.set(image.pageNumber, pageImages);
  }
  return map;
}

function summarizeByKind(
  images: OcrImageManifestImage[],
): Record<OcrVisualAssetKind, number> {
  const summary: Record<OcrVisualAssetKind, number> = {
    figure: 0,
    diagram: 0,
    table: 0,
    equation: 0,
    image: 0,
    unknown: 0,
  };

  for (const image of images) {
    summary[image.kind] += 1;
  }

  return summary;
}

function summarizeQualityFlags(images: OcrImageManifestImage[]): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const image of images) {
    for (const flag of image.qualityFlags) {
      summary[flag] = (summary[flag] ?? 0) + 1;
    }
  }

  return summary;
}

function buildImageQualityFlags({
  normalizedBoundingBox,
  pageDimensions,
  areaRatio,
  nearbyText,
  captionCandidate,
}: {
  normalizedBoundingBox: OcrNormalizedBox | null;
  pageDimensions: OcrPageDimensions | null;
  areaRatio: number | null;
  nearbyText: string | null;
  captionCandidate: string | null;
}): string[] {
  const flags: string[] = [];

  if (!pageDimensions) {
    flags.push("missing_page_dimensions");
  }

  if (!normalizedBoundingBox) {
    flags.push("missing_normalized_bbox");
  } else {
    if (
      normalizedBoundingBox.x < -0.001 ||
      normalizedBoundingBox.y < -0.001 ||
      normalizedBoundingBox.x + normalizedBoundingBox.w > 1.001 ||
      normalizedBoundingBox.y + normalizedBoundingBox.h > 1.001
    ) {
      flags.push("out_of_page_bounds");
    }

    if (normalizedBoundingBox.w < 0.01 || normalizedBoundingBox.h < 0.01) {
      flags.push("thin_crop");
    }
  }

  if (areaRatio !== null && areaRatio < 0.002) {
    flags.push("tiny_area");
  }

  if (!nearbyText && !captionCandidate) {
    flags.push("missing_context");
  }

  return flags;
}

function isUsableForAi(qualityFlags: string[]): boolean {
  return !qualityFlags.some((flag) =>
    [
      "missing_page_dimensions",
      "missing_normalized_bbox",
      "out_of_page_bounds",
      "thin_crop",
      "tiny_area",
    ].includes(flag),
  );
}

function normalizeBox(
  box: OcrImageBox,
  pageDimensions: OcrPageDimensions | null,
): OcrNormalizedBox | null {
  if (!pageDimensions) {
    return null;
  }

  return {
    x: roundRatio(box.x / pageDimensions.width),
    y: roundRatio(box.y / pageDimensions.height),
    w: roundRatio(box.w / pageDimensions.width),
    h: roundRatio(box.h / pageDimensions.height),
  };
}

function normalizePoint(
  point: { x: number; y: number },
  pageDimensions: OcrPageDimensions | null,
): { x: number; y: number } | null {
  if (!pageDimensions) {
    return null;
  }

  return {
    x: roundRatio(point.x / pageDimensions.width),
    y: roundRatio(point.y / pageDimensions.height),
  };
}

function computeAreaRatio(
  box: OcrImageBox,
  pageDimensions: OcrPageDimensions | null,
): number | null {
  if (!pageDimensions) {
    return null;
  }

  return roundRatio((box.w * box.h) / (pageDimensions.width * pageDimensions.height));
}

function resolvePosition(box: OcrImageBox, pageDimensions: OcrPageDimensions | null) {
  if (!pageDimensions) {
    return { horizontal: "unknown" as const, vertical: "unknown" as const };
  }

  const centerX = (box.x + box.w / 2) / pageDimensions.width;
  const centerY = (box.y + box.h / 2) / pageDimensions.height;

  return {
    horizontal:
      centerX < 0.33
        ? ("left" as const)
        : centerX > 0.66
          ? ("right" as const)
          : ("center" as const),
    vertical:
      centerY < 0.33
        ? ("top" as const)
        : centerY > 0.66
          ? ("bottom" as const)
          : ("middle" as const),
  };
}

function inferPageDimensions(
  image: OcrImageManifestInputImage,
  lines: LayoutLine[],
): OcrPageDimensions | null {
  const inferred = inferPageDimensionsFromLines(lines);
  if (inferred) {
    return {
      width: Math.max(inferred.width, image.boundingBox.x + image.boundingBox.w),
      height: Math.max(inferred.height, image.boundingBox.y + image.boundingBox.h),
      source: "inferred_bounds",
      coordinateSystem: "mathpix_page_pixels",
    };
  }

  const width = image.boundingBox.x + image.boundingBox.w;
  const height = image.boundingBox.y + image.boundingBox.h;

  if (isPositive(width) && isPositive(height)) {
    return {
      width,
      height,
      source: "inferred_bounds",
      coordinateSystem: "mathpix_page_pixels",
    };
  }

  return null;
}

function inferPageDimensionsFromLines(lines: LayoutLine[]): OcrPageDimensions | null {
  const boxes = lines
    .map((line) => line.boundingBox)
    .filter((box): box is OcrImageBox => Boolean(box));

  if (boxes.length === 0) {
    return null;
  }

  const width = Math.max(...boxes.map((box) => box.x + box.w));
  const height = Math.max(...boxes.map((box) => box.y + box.h));

  if (!isPositive(width) || !isPositive(height)) {
    return null;
  }

  return {
    width,
    height,
    source: "inferred_bounds",
    coordinateSystem: "mathpix_page_pixels",
  };
}

function inferPageHeight(imageBox: OcrImageBox, lines: LayoutLine[]): number {
  const lineMax = Math.max(
    0,
    ...lines
      .map((line) => line.boundingBox)
      .filter((box): box is OcrImageBox => Boolean(box))
      .map((box) => box.y + box.h),
  );

  return Math.max(lineMax, imageBox.y + imageBox.h);
}

function verticalDistance(a: OcrImageBox, b: OcrImageBox): number {
  if (b.y + b.h < a.y) {
    return a.y - (b.y + b.h);
  }

  if (a.y + a.h < b.y) {
    return b.y - (a.y + a.h);
  }

  return 0;
}

function resolveRelation(
  imageBox: OcrImageBox,
  lineBox: OcrImageBox | null,
): OcrImageManifestNearbyLine["relation"] {
  if (!lineBox) {
    return "unknown";
  }

  if (lineBox.y + lineBox.h < imageBox.y) {
    return "above";
  }

  if (imageBox.y + imageBox.h < lineBox.y) {
    return "below";
  }

  return "overlap";
}

function overlapRatio(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const minSize = Math.max(1, Math.min(aEnd - aStart, bEnd - bStart));
  return overlap / minSize;
}

function compareImages(
  a: OcrImageManifestInputImage,
  b: OcrImageManifestInputImage,
): number {
  if (a.pageNumber !== b.pageNumber) {
    return a.pageNumber - b.pageNumber;
  }

  if (a.boundingBox.y !== b.boundingBox.y) {
    return a.boundingBox.y - b.boundingBox.y;
  }

  return a.boundingBox.x - b.boundingBox.x;
}

function buildImageId(contentHash: string, image: OcrImageManifestInputImage): string {
  const hash = createHash("sha256")
    .update(
      [
        contentHash,
        image.pageNumber,
        image.filename,
        image.objectKey,
        image.boundingBox.x,
        image.boundingBox.y,
        image.boundingBox.w,
        image.boundingBox.h,
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 16);

  return `img_${hash}`;
}

function roundRatio(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isPositive(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const raw = value[key];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function readNumber(value: Record<string, unknown>, key: string): number | null {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}
