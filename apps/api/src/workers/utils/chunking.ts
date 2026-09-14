import { createHash } from "node:crypto";

/** A single text chunk with metadata. */
export interface TextChunk {
  /** The chunk text content. */
  content: string;
  /** Zero-based index within the document. */
  chunkIndex: number;
  /** Estimated token count (chars / 4 for Vietnamese/mixed). */
  tokenCount: number;
  /** Estimated prefix tokens copied from the previous chunk. */
  overlapTokenCount: number;
  /** SHA-256 truncated hash for deduplication. */
  contentHash: string;
}

export interface ChunkingOptions {
  /** Soft target tokens per chunk (default: 700). */
  targetTokens?: number;
  /** Maximum tokens per chunk unless one protected unit is larger (default: 1000). */
  maxTokens?: number;
  /** Minimum tokens per chunk before merging with next (default: 100). */
  minTokens?: number;
  /** Safe trailing context copied into the next chunk (default: 100). */
  overlapTokens?: number;
}

export const DOCUMENT_CHUNKING_PROFILE = {
  version: "semantic-overlap-v2",
  targetTokens: 700,
  maxTokens: 1_000,
  minTokens: 100,
  overlapTokens: 100,
} as const;

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  targetTokens: DOCUMENT_CHUNKING_PROFILE.targetTokens,
  maxTokens: DOCUMENT_CHUNKING_PROFILE.maxTokens,
  minTokens: DOCUMENT_CHUNKING_PROFILE.minTokens,
  overlapTokens: DOCUMENT_CHUNKING_PROFILE.overlapTokens,
};

/**
 * Chunk text by heading markers (##, ###, \section, etc.).
 * Falls back to paragraph-based chunking if no headings found.
 */
export function chunkText(text: string, options?: ChunkingOptions): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const opts = resolveOptions(options);
  let sections = splitByHeadings(text);

  // If no headings found, fall back to paragraph-based splitting
  if (sections.length <= 1) {
    sections = splitByParagraphs(text);
  }

  // Merge small sections, split large ones
  const balanced = addSafeOverlap(balanceSections(sections, opts), opts);

  return balanced.map((chunk, index) => ({
    content: chunk.content,
    chunkIndex: index,
    tokenCount: estimateTokens(chunk.content),
    overlapTokenCount: chunk.overlapTokenCount,
    contentHash: computeChunkHash(chunk.content),
  }));
}

function resolveOptions(options?: ChunkingOptions): Required<ChunkingOptions> {
  const targetTokens = positiveInteger(
    options?.targetTokens,
    DEFAULT_OPTIONS.targetTokens,
  );
  const maxTokens = Math.max(
    targetTokens,
    positiveInteger(options?.maxTokens, DEFAULT_OPTIONS.maxTokens),
  );
  const minTokens = Math.min(
    targetTokens,
    positiveInteger(options?.minTokens, DEFAULT_OPTIONS.minTokens),
  );
  const overlapTokens = Math.min(
    Math.floor(targetTokens / 2),
    nonNegativeInteger(options?.overlapTokens, DEFAULT_OPTIONS.overlapTokens),
  );

  return { targetTokens, maxTokens, minTokens, overlapTokens };
}

function positiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : fallback;
}

/**
 * Split text by heading markers: ## / ### / #### / \section / \subsection.
 * Mathpix emits both starred and unstarred LaTeX section commands.
 * Each heading starts a new section, with the heading included in its section.
 */
function splitByHeadings(text: string): string[] {
  const headingPattern = new RegExp(`^(?:${STRUCTURAL_HEADING_SOURCE})$`, "gmu");

  const sections: string[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(headingPattern)) {
    if (match.index !== undefined && match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before.length > 0) {
        sections.push(before);
      }
      lastIndex = match.index;
    }
  }

  // Last section (from last heading to end)
  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 0) {
    sections.push(remaining);
  }

  return sections;
}

/**
 * Split text by paragraph boundaries (double newlines).
 */
function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Balance section sizes: merge too-small sections, split too-large ones.
 */
function balanceSections(sections: string[], opts: Required<ChunkingOptions>): string[] {
  const result: string[] = [];
  let buffer = "";

  for (const section of coalescePageHeadingPrefixes(sections)) {
    // A semantic heading is a hard content boundary. Keeping a short new topic
    // separate is more valuable for retrieval than filling the previous chunk.
    if (buffer && startsAtStructuralBoundary(section)) {
      result.push(buffer);
      buffer = "";
    }

    const sectionTokens = estimateTokens(section);
    const bufferTokens = estimateTokens(buffer);

    if (bufferTokens + sectionTokens <= opts.targetTokens) {
      // Accumulate into buffer
      buffer = buffer ? `${buffer}\n\n${section}` : section;
    } else {
      // Flush buffer if it has enough content
      if (buffer && bufferTokens >= opts.minTokens) {
        result.push(buffer);
        buffer = "";
      } else if (buffer && bufferTokens + sectionTokens <= opts.maxTokens) {
        // Avoid emitting a fragment that is too small even if it crosses target.
        buffer = buffer ? `${buffer}\n\n${section}` : section;
        continue;
      } else if (buffer) {
        result.push(buffer);
        buffer = "";
      }

      // Handle the section itself
      if (sectionTokens > opts.maxTokens) {
        result.push(...splitOversized(section, opts));
      } else {
        buffer = section;
      }
    }
  }

  // Flush remaining buffer
  if (buffer) {
    const bufferTokens = estimateTokens(buffer);
    // If buffer is too small and we have previous chunks, merge with last
    if (
      bufferTokens < opts.minTokens &&
      result.length > 0 &&
      !startsAtStructuralBoundary(buffer)
    ) {
      const last = result.pop()!;
      const merged = `${last}\n\n${buffer}`;
      if (estimateTokens(merged) <= opts.maxTokens) {
        result.push(merged);
      } else {
        result.push(last, buffer);
      }
    } else {
      result.push(buffer);
    }
  }

  return result;
}

/**
 * splitByHeadings can emit a physical page marker as a tiny standalone section
 * when the first meaningful line on that page is a semantic heading. Attach the
 * marker to that heading before balancing so provenance stays with the new topic.
 */
function coalescePageHeadingPrefixes(sections: string[]) {
  const result: string[] = [];
  const pendingPageHeadings: string[] = [];

  for (const section of sections) {
    if (containsOnlyPageHeadings(section)) {
      pendingPageHeadings.push(section.trim());
      continue;
    }

    result.push(
      pendingPageHeadings.length > 0
        ? `${pendingPageHeadings.join("\n")}\n${section}`
        : section,
    );
    pendingPageHeadings.length = 0;
  }

  if (pendingPageHeadings.length > 0) {
    result.push(pendingPageHeadings.join("\n"));
  }

  return result;
}

function containsOnlyPageHeadings(content: string) {
  const pageHeading = new RegExp(`^(?:${PAGE_HEADING_SOURCE})$`, "u");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every((line) => pageHeading.test(line));
}

type OverlappedChunk = {
  content: string;
  overlapTokenCount: number;
};

/**
 * Copy a small suffix into the next chunk without crossing a new semantic
 * section or cutting through a protected Mathpix structure. Physical page
 * boundaries may overlap because an explanation can continue on the next page.
 */
function addSafeOverlap(
  chunks: string[],
  opts: Required<ChunkingOptions>,
): OverlappedChunk[] {
  if (chunks.length === 0) return [];

  const result: OverlappedChunk[] = [{ content: chunks[0]!, overlapTokenCount: 0 }];

  for (let index = 1; index < chunks.length; index += 1) {
    const content = chunks[index]!;
    if (opts.overlapTokens === 0 || startsAtStructuralBoundary(content)) {
      result.push({ content, overlapTokenCount: 0 });
      continue;
    }

    const availableTokens = Math.max(0, opts.maxTokens - estimateTokens(content));
    const overlapBudget = Math.min(opts.overlapTokens, availableTokens);
    const previous = result[result.length - 1]!.content;
    const overlap = takeSafeSuffix(previous, overlapBudget);

    if (!overlap || content.startsWith(overlap)) {
      result.push({ content, overlapTokenCount: 0 });
      continue;
    }

    const overlappedContent = `${overlap}\n\n${content}`;
    result.push({
      content: overlappedContent,
      overlapTokenCount: estimateTokens(overlap),
    });
  }

  return result;
}

function takeSafeSuffix(content: string, tokenBudget: number): string {
  if (tokenBudget <= 0) return "";

  const units = splitAtSafeBoundaries(content)
    .map((unit) => unit.trim())
    .filter(Boolean);
  const suffix: string[] = [];
  let tokens = 0;

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index]!;
    const unitTokens = estimateTokens(unit);
    if (tokens + unitTokens > tokenBudget) break;
    suffix.unshift(unit);
    tokens += unitTokens;
  }

  return suffix.join(" ");
}

function startsAtStructuralBoundary(content: string) {
  const lines = content
    .trimStart()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const semanticHeading = new RegExp(`^(?:${SEMANTIC_HEADING_SOURCE})$`, "u");
  if (semanticHeading.test(lines[0] ?? "")) return true;

  // A page marker is a physical boundary, not necessarily a topic boundary.
  // Skip it and inspect the next line before deciding whether overlap is safe.
  const pageHeading = new RegExp(`^(?:${PAGE_HEADING_SOURCE})$`, "u");
  return pageHeading.test(lines[0] ?? "") && semanticHeading.test(lines[1] ?? "");
}

/**
 * Split an oversized section into chunks at sentence/paragraph boundaries.
 */
function splitOversized(text: string, opts: Required<ChunkingOptions>): string[] {
  const sentences = splitAtSafeBoundaries(text);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const combined = current ? `${current}${sentence}` : sentence;
    if (estimateTokens(combined.trim()) <= opts.targetTokens) {
      current = combined;
    } else {
      if (current) {
        chunks.push(current.trim());
      }
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Finds sentence/newline boundaries without cutting through Mathpix block
 * structures. A balanced LaTeX environment or display-math block remains one
 * unit even when it contains punctuation and line breaks.
 */
function splitAtSafeBoundaries(text: string): string[] {
  const parts = text.split(/((?<=[.!?。])\s+|\n)/u);
  const units: string[] = [];
  const protectEnvironments =
    countMatches(text, /\\begin\{[^}]+\}/gu) === countMatches(text, /\\end\{[^}]+\}/gu);
  const protectDollarDisplay = countMatches(text, /\$\$/gu) % 2 === 0;
  const protectBracketDisplay =
    countMatches(text, /\\\[/gu) === countMatches(text, /\\\]/gu);
  let current = "";
  let environmentDepth = 0;
  let dollarDisplayOpen = false;
  let bracketDisplayDepth = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    current += part;

    if (index % 2 === 0) {
      if (protectEnvironments) {
        environmentDepth = Math.max(
          0,
          environmentDepth +
            countMatches(part, /\\begin\{[^}]+\}/gu) -
            countMatches(part, /\\end\{[^}]+\}/gu),
        );
      }
      if (protectDollarDisplay && countMatches(part, /\$\$/gu) % 2 === 1) {
        dollarDisplayOpen = !dollarDisplayOpen;
      }
      if (protectBracketDisplay) {
        bracketDisplayDepth = Math.max(
          0,
          bracketDisplayDepth +
            countMatches(part, /\\\[/gu) -
            countMatches(part, /\\\]/gu),
        );
      }
      continue;
    }

    if (environmentDepth === 0 && !dollarDisplayOpen && bracketDisplayDepth === 0) {
      units.push(current);
      current = "";
    }
  }

  if (current.trim()) {
    units.push(current);
  }

  return units;
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

const SEMANTIC_HEADING_SOURCE = "(?:#{2,4}\\s+.+|\\\\(?:sub)?section\\*?\\{.+\\})";
const PAGE_HEADING_SOURCE = "(?:Trang sách .+ \\(PDF page \\d+\\)|PDF page \\d+)";
const STRUCTURAL_HEADING_SOURCE = `(?:${SEMANTIC_HEADING_SOURCE}|${PAGE_HEADING_SOURCE})`;

/**
 * Estimate token count. Vietnamese text averages ~4 chars per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compute a truncated SHA-256 hash (first 16 hex chars = 64 bits).
 */
function computeChunkHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").substring(0, 16);
}
