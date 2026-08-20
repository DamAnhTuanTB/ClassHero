export interface ChunkPageRange {
  pageStart: number;
  pageEnd: number;
}

/**
 * OCR text is prefixed per source page by the document worker, for example
 * `Trang sách 29 (PDF page 30)` or `PDF page 30`. A chunk may span pages.
 */
export function extractChunkPdfPageRange(content: string): ChunkPageRange | null {
  const pageNumbers = Array.from(content.matchAll(/\bPDF page\s+(\d+)\b/giu), (match) =>
    Number(match[1]),
  ).filter((pageNumber) => Number.isSafeInteger(pageNumber) && pageNumber > 0);

  if (pageNumbers.length === 0) {
    return null;
  }

  return {
    pageStart: Math.min(...pageNumbers),
    pageEnd: Math.max(...pageNumbers),
  };
}

export function readStoredChunkPageRange(metadata: unknown): ChunkPageRange | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const pageStart = readPositiveInteger(metadata.chunkPageStart);
  const pageEnd = readPositiveInteger(metadata.chunkPageEnd);
  if (pageStart === null || pageEnd === null || pageStart > pageEnd) {
    return null;
  }

  return { pageStart, pageEnd };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
