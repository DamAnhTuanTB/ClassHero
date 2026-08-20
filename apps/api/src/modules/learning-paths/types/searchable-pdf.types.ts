export type PdfPageGeometry = {
  pageNumber: number;
  mediaBox: { x: number; y: number; width: number; height: number };
  cropBox: { x: number; y: number; width: number; height: number };
  rotation: number;
};

export type PdfPageVisualComparison = {
  pageNumber: number;
  perceptualSimilarity: number;
  centroidShift: number;
  scaleDelta: number;
  layoutEquivalent: boolean;
};

export type SearchablePdfEquivalenceReport = {
  version: 1;
  originalChecksum: string;
  candidateChecksum: string;
  pageCount: number;
  geometryEquivalent: boolean;
  layoutEquivalent: boolean;
  searchablePageCount: number;
  searchablePageRatio: number;
  emptyTextPageNumbers: number[];
  pageGeometry: PdfPageGeometry[];
  visualComparisons: PdfPageVisualComparison[];
  cropAudit: {
    checked: number;
    passed: number;
    failedImageIds: string[];
  };
  hardFailures: string[];
  warnings: string[];
};
