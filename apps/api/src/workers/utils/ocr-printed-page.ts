export type PrintedPageReferenceSource =
  | "ocr_inferred"
  | "offset_rule"
  | "admin_verified"
  | "unknown";

export type PrintedPageReferenceWarning = "missing" | "ambiguous" | null;

export interface PrintedPageReference {
  pdfPageNumber: number;
  printedPageNumber: number | null;
  printedPageLabel: string | null;
  source: PrintedPageReferenceSource;
  confidence: number | null;
  evidenceLineIds: string[];
  evidenceText: string | null;
  warning: PrintedPageReferenceWarning;
}

export interface InferPrintedPageLine {
  lineIndex: number;
  lineId: string;
  text: string;
  type: string | null;
  confidence: number | null;
}

export interface InferPrintedPageInput {
  pdfPageNumber: number;
  text: string;
  lines: InferPrintedPageLine[];
}

interface PrintedPageCandidate {
  printedPageNumber: number | null;
  printedPageLabel: string;
  score: number;
  lineId: string;
  text: string;
}

const BOUNDARY_LINE_LIMIT = 6;
const AMBIGUITY_SCORE_DELTA = 0.08;
const OFFSET_RULE_MIN_ANCHORS = 3;
const OFFSET_RULE_STRONG_ANCHORS = 20;
const OFFSET_RULE_OUTLIER_MIN_DELTA = 5;
const OFFSET_RULE_CONFIDENCE = 0.82;

export function inferPrintedPageReference(
  input: InferPrintedPageInput,
): PrintedPageReference {
  const candidates = collectBoundaryLines(input.lines)
    .flatMap(readPrintedPageCandidates)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return buildUnknownPrintedPageReference(input.pdfPageNumber);
  }

  const top = candidates[0]!;
  const competingCandidates = candidates.filter(
    (candidate) =>
      !isSamePrintedPageCandidate(top, candidate) &&
      top.score - candidate.score <= AMBIGUITY_SCORE_DELTA,
  );
  const evidenceCandidates = candidates.filter((candidate) =>
    isSamePrintedPageCandidate(top, candidate),
  );

  return {
    pdfPageNumber: input.pdfPageNumber,
    printedPageNumber: top.printedPageNumber,
    printedPageLabel: top.printedPageLabel,
    source: "ocr_inferred",
    confidence: competingCandidates.length > 0 ? 0.62 : roundConfidence(top.score),
    evidenceLineIds: [
      ...new Set([
        ...evidenceCandidates.map((candidate) => candidate.lineId),
        ...competingCandidates.map((candidate) => candidate.lineId),
      ]),
    ],
    evidenceText: top.text,
    warning: top.printedPageNumber === null || competingCandidates.length > 0 ? "ambiguous" : null,
  };
}

export function applyPrintedPageSequenceMapping(
  references: PrintedPageReference[],
): PrintedPageReference[] {
  const reliableAnchors = references.filter(isReliableNumericReference);
  const dominantOffset = findDominantOffset(reliableAnchors);

  if (!dominantOffset) {
    return references;
  }

  return references.map((reference) => {
    if (reference.source === "admin_verified") {
      return reference;
    }

    const candidatePrintedPageNumber =
      reference.pdfPageNumber + dominantOffset.offset;
    if (candidatePrintedPageNumber <= 0) {
      return reference;
    }

    if (reference.warning === "missing") {
      return buildOffsetRuleReference(
        reference,
        candidatePrintedPageNumber,
        dominantOffset,
      );
    }

    if (
      reference.warning === "ambiguous" &&
      reference.printedPageNumber === candidatePrintedPageNumber
    ) {
      return buildOffsetRuleReference(
        reference,
        candidatePrintedPageNumber,
        dominantOffset,
      );
    }

    if (
      shouldRewriteLargeOffsetOutlier(
        reference,
        candidatePrintedPageNumber,
        dominantOffset.anchorCount,
      )
    ) {
      return buildOffsetRuleReference(
        reference,
        candidatePrintedPageNumber,
        dominantOffset,
      );
    }

    return reference;
  });
}

function buildUnknownPrintedPageReference(pdfPageNumber: number): PrintedPageReference {
  return {
    pdfPageNumber,
    printedPageNumber: null,
    printedPageLabel: null,
    source: "unknown",
    confidence: null,
    evidenceLineIds: [],
    evidenceText: null,
    warning: "missing",
  };
}

function collectBoundaryLines(
  lines: InferPrintedPageLine[],
): InferPrintedPageLine[] {
  const nonEmpty = lines.filter((line) => line.text.trim().length > 0);
  const boundaryLines = [
    ...nonEmpty.slice(0, BOUNDARY_LINE_LIMIT),
    ...nonEmpty.slice(-BOUNDARY_LINE_LIMIT),
  ];
  const seen = new Set<string>();

  return boundaryLines.filter((line) => {
    const key = `${line.lineId}:${line.lineIndex}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function readPrintedPageCandidates(
  line: InferPrintedPageLine,
): PrintedPageCandidate[] {
  if (shouldIgnorePageMarkerLine(line)) {
    return [];
  }

  const normalized = normalizePageMarkerText(line.text);
  const candidates: PrintedPageCandidate[] = [];
  const explicit = /^(?:trang|page|p\.?|tr\.)\s*[:.]?\s*(\d{1,4})$/i.exec(
    normalized,
  );
  if (explicit) {
    candidates.push(buildNumberCandidate(line, Number(explicit[1]), scoreLine(line, 0.93)));
  }

  const trailing = /(?:^|[|/-]\s*)(?:trang|page|p\.?|tr\.)\s*[:.]?\s*(\d{1,4})$/i.exec(
    normalized,
  );
  if (trailing && !explicit && normalized.length <= 48) {
    candidates.push(buildNumberCandidate(line, Number(trailing[1]), scoreLine(line, 0.78)));
  }

  const exactNumber = /^-?\s*(\d{1,4})\s*-?$/.exec(normalized);
  if (exactNumber) {
    candidates.push(buildNumberCandidate(line, Number(exactNumber[1]), scoreLine(line, 0.86)));
  }

  if (isRomanPageLabel(normalized)) {
    candidates.push({
      printedPageNumber: null,
      printedPageLabel: normalized.toLowerCase(),
      score: scoreLine(line, 0.62),
      lineId: line.lineId,
      text: line.text,
    });
  }

  return candidates.filter(
    (candidate) =>
      candidate.printedPageNumber === null || candidate.printedPageNumber > 0,
  );
}

function buildNumberCandidate(
  line: InferPrintedPageLine,
  value: number,
  score: number,
): PrintedPageCandidate {
  const lineConfidence =
    typeof line.confidence === "number" && line.confidence >= 0 && line.confidence <= 1
      ? line.confidence
      : null;

  return {
    printedPageNumber: value,
    printedPageLabel: String(value),
    score: lineConfidence === null ? score : score * (0.7 + lineConfidence * 0.3),
    lineId: line.lineId,
    text: line.text,
  };
}

function shouldIgnorePageMarkerLine(line: InferPrintedPageLine): boolean {
  const type = line.type?.toLowerCase() ?? "";
  return [
    "cell",
    "chart",
    "column",
    "diagram",
    "equation",
    "figure",
    "table",
  ].some((ignoredType) => type.includes(ignoredType));
}

function scoreLine(line: InferPrintedPageLine, baseScore: number): number {
  return line.type?.toLowerCase() === "page_info"
    ? Math.min(baseScore + 0.12, 0.99)
    : baseScore;
}

function normalizePageMarkerText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[([{\s]+|[)\]}\s]+$/g, "")
    .trim();
}

function isRomanPageLabel(value: string): boolean {
  if (!/^[ivxlcdm]{1,8}$/i.test(value)) {
    return false;
  }

  return /[ivxlcdm]/i.test(value);
}

function isSamePrintedPageCandidate(
  left: PrintedPageCandidate,
  right: PrintedPageCandidate,
): boolean {
  return (
    left.printedPageNumber === right.printedPageNumber &&
    left.printedPageLabel === right.printedPageLabel
  );
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function isReliableNumericReference(
  reference: PrintedPageReference,
): reference is PrintedPageReference & { printedPageNumber: number } {
  return (
    reference.printedPageNumber !== null &&
    reference.printedPageNumber > 0 &&
    reference.warning === null &&
    (reference.source === "ocr_inferred" || reference.source === "admin_verified") &&
    (reference.confidence === null || reference.confidence >= 0.85)
  );
}

function findDominantOffset(
  references: Array<PrintedPageReference & { printedPageNumber: number }>,
): { offset: number; anchorCount: number } | null {
  const counts = new Map<number, number>();

  for (const reference of references) {
    const offset = reference.printedPageNumber - reference.pdfPageNumber;
    counts.set(offset, (counts.get(offset) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [offset, anchorCount] = ranked[0] ?? [];

  if (
    typeof offset !== "number" ||
    typeof anchorCount !== "number" ||
    anchorCount < OFFSET_RULE_MIN_ANCHORS
  ) {
    return null;
  }

  return { offset, anchorCount };
}

function buildOffsetRuleReference(
  reference: PrintedPageReference,
  printedPageNumber: number,
  offsetRule: { offset: number; anchorCount: number },
): PrintedPageReference {
  return {
    ...reference,
    printedPageNumber,
    printedPageLabel: String(printedPageNumber),
    source: "offset_rule",
    confidence: OFFSET_RULE_CONFIDENCE,
    evidenceLineIds: reference.evidenceLineIds,
    evidenceText: [
      `offset=${offsetRule.offset}`,
      `anchors=${offsetRule.anchorCount}`,
      reference.evidenceText ? `ocr=${reference.evidenceText}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join("; "),
    warning: null,
  };
}

function shouldRewriteLargeOffsetOutlier(
  reference: PrintedPageReference,
  candidatePrintedPageNumber: number,
  anchorCount: number,
): boolean {
  if (
    anchorCount < OFFSET_RULE_STRONG_ANCHORS ||
    reference.source !== "ocr_inferred" ||
    reference.warning !== null ||
    reference.printedPageNumber === null
  ) {
    return false;
  }

  return (
    Math.abs(reference.printedPageNumber - candidatePrintedPageNumber) >=
    OFFSET_RULE_OUTLIER_MIN_DELTA
  );
}
