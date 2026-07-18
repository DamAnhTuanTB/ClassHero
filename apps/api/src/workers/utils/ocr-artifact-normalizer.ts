import type { OcrArtifactBundle } from "#api/workers/services/mathpix-ocr.service";
import {
  OCR_DERIVED_ARTIFACT_VERSION,
  OCR_NORMALIZED_PAGES_SCHEMA_VERSION,
} from "#api/workers/utils/ocr-artifact-versions";
import {
  applyPrintedPageSequenceMapping,
  inferPrintedPageReference,
  type PrintedPageReference,
} from "#api/workers/utils/ocr-printed-page";

export interface NormalizedOcrLine {
  lineIndex: number;
  lineId: string;
  text: string;
  type: string | null;
  confidence: number | null;
  region: unknown;
}

export interface NormalizedOcrPage {
  pageNumber: number;
  printedPage: PrintedPageReference;
  text: string;
  mathpixMarkdown: string | null;
  markdown: string | null;
  lineCount: number;
  confidence: number | null;
  qualityFlags: string[];
  layoutRef: {
    artifact: "lines.json";
    pageIndex: number;
    pageNumber: number;
    lineCount: number;
    lineRefs: string[];
  };
  lines: NormalizedOcrLine[];
}

export interface NormalizedOcrPagesArtifact {
  schemaVersion: typeof OCR_NORMALIZED_PAGES_SCHEMA_VERSION;
  derivedArtifactVersion: typeof OCR_DERIVED_ARTIFACT_VERSION;
  createdAt: string;
  pages: NormalizedOcrPage[];
}

export function normalizeOcrPages(
  bundle: Pick<OcrArtifactBundle, "mmd" | "md" | "linesJson">,
  expectedPages: number,
): NormalizedOcrPage[] {
  const linePages = extractLinePages(bundle.linesJson, expectedPages);
  const mmdPages = splitPageArtifact(bundle.mmd, expectedPages);
  const mdPages = splitPageArtifact(bundle.md, expectedPages);

  const pages = Array.from({ length: expectedPages }, (_, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const lines = linePages[pageIndex] ?? [];
    const textFromLines = lines
      .map((line) => line.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    const mathpixMarkdown = normalizeText(mmdPages[pageIndex]);
    const markdown = normalizeText(mdPages[pageIndex]);
    const text = textFromLines || mathpixMarkdown || markdown || "";
    const confidence = averageConfidence(lines);
    const qualityFlags = buildQualityFlags({
      confidence,
      lineCount: lines.length,
      text,
    });
    const printedPage = inferPrintedPageReference({
      pdfPageNumber: pageNumber,
      text,
      lines,
    });

    return {
      pageNumber,
      printedPage,
      text,
      mathpixMarkdown,
      markdown,
      lineCount: lines.length,
      confidence,
      qualityFlags,
      layoutRef: {
        artifact: "lines.json" as const,
        pageIndex,
        pageNumber,
        lineCount: lines.length,
        lineRefs: lines.map((line) => line.lineId),
      },
      lines,
    };
  });
  const mappedPrintedPages = applyPrintedPageSequenceMapping(
    pages.map((page) => page.printedPage),
  );

  return pages.map((page, index) => ({
    ...page,
    printedPage: mappedPrintedPages[index] ?? page.printedPage,
  }));
}

export function buildNormalizedOcrPagesArtifact(
  pages: NormalizedOcrPage[],
): NormalizedOcrPagesArtifact {
  return {
    schemaVersion: OCR_NORMALIZED_PAGES_SCHEMA_VERSION,
    derivedArtifactVersion: OCR_DERIVED_ARTIFACT_VERSION,
    createdAt: new Date().toISOString(),
    pages,
  };
}

export function summarizeOcrPage(page: NormalizedOcrPage) {
  return {
    pageNumber: page.pageNumber,
    printedPage: page.printedPage,
    textLength: page.text.length,
    markdownLength: page.markdown?.length ?? 0,
    mathpixMarkdownLength: page.mathpixMarkdown?.length ?? 0,
    lineCount: page.lineCount,
    confidence: page.confidence,
    qualityFlags: page.qualityFlags,
    layoutRef: page.layoutRef,
  };
}

function extractLinePages(
  linesJsonBuffer: Buffer,
  expectedPages: number,
): NormalizedOcrLine[][] {
  const pages = Array.from({ length: expectedPages }, () => [] as NormalizedOcrLine[]);

  try {
    const parsed = JSON.parse(linesJsonBuffer.toString("utf8")) as unknown;
    const pageRecords = extractPageRecords(parsed);

    if (pageRecords.length > 0) {
      for (let pageIndex = 0; pageIndex < expectedPages; pageIndex += 1) {
        const page = pageRecords[pageIndex];
        if (!isRecord(page)) continue;
        const rawLines = page.lines;
        if (!Array.isArray(rawLines)) continue;

        pages[pageIndex] = rawLines
          .filter(isRecord)
          .map((line, lineIndex) =>
            normalizeLine(line, pageIndex + 1, lineIndex),
          );
      }

      return pages;
    }

    const flatLines = extractFlatLines(parsed);
    for (const line of flatLines) {
      const pageIndex = resolvePageIndex(line, expectedPages);
      if (pageIndex === null) continue;
      pages[pageIndex]!.push(
        normalizeLine(line, pageIndex + 1, pages[pageIndex]!.length),
      );
    }
  } catch {
    return pages;
  }

  return pages;
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

function extractFlatLines(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.lines)) {
    return value.lines.filter(isRecord);
  }

  return [];
}

function normalizeLine(
  line: Record<string, unknown>,
  pageNumber: number,
  lineIndex: number,
): NormalizedOcrLine {
  const lineId =
    readString(line, "id") ??
    readString(line, "line_id") ??
    `p${pageNumber}:line${lineIndex + 1}`;

  return {
    lineIndex,
    lineId,
    text: readString(line, "text") ?? "",
    type: readString(line, "type"),
    confidence: readNumber(line, "confidence") ?? readNumber(line, "confidence_rate"),
    region:
      line.region ??
      line.bbox ??
      line.boundingBox ??
      line.bounding_box ??
      line.cnt ??
      null,
  };
}

function resolvePageIndex(
  line: Record<string, unknown>,
  expectedPages: number,
): number | null {
  const rawPage =
    readNumber(line, "page") ??
    readNumber(line, "page_index") ??
    readNumber(line, "pageNumber") ??
    readNumber(line, "page_number");

  if (rawPage === null) {
    return expectedPages === 1 ? 0 : null;
  }

  if (rawPage >= 0 && rawPage < expectedPages) {
    return rawPage;
  }

  if (rawPage >= 1 && rawPage <= expectedPages) {
    return rawPage - 1;
  }

  return null;
}

function splitPageArtifact(buffer: Buffer, expectedPages: number): string[] {
  const raw = buffer.toString("utf8");
  const pages = raw.split("\\newpage").map((part) => part.trim());

  if (pages.length >= expectedPages) {
    return pages.slice(0, expectedPages);
  }

  return [...pages, ...Array.from({ length: expectedPages - pages.length }, () => "")];
}

function averageConfidence(lines: NormalizedOcrLine[]): number | null {
  const values = lines
    .map((line) => line.confidence)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 100) / 100;
}

function buildQualityFlags({
  confidence,
  lineCount,
  text,
}: {
  confidence: number | null;
  lineCount: number;
  text: string;
}): string[] {
  const flags: string[] = [];

  if (text.trim().length === 0) {
    flags.push("empty_text");
  } else if (text.trim().length < 80) {
    flags.push("low_text");
  }

  if (lineCount === 0) {
    flags.push("missing_layout_lines");
  }

  if (confidence !== null && confidence < 0.75) {
    flags.push("low_confidence");
  }

  if (text.includes("\uFFFD")) {
    flags.push("replacement_characters");
  }

  return flags;
}

function normalizeText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const raw = value[key];
  return typeof raw === "string" ? raw : null;
}

function readNumber(
  value: Record<string, unknown>,
  key: string,
): number | null {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}
