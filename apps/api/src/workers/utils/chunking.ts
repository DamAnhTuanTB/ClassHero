import { createHash } from "node:crypto";

/** A single text chunk with metadata. */
export interface TextChunk {
  /** The chunk text content. */
  content: string;
  /** Zero-based index within the document. */
  chunkIndex: number;
  /** Estimated token count (chars / 4 for Vietnamese/mixed). */
  tokenCount: number;
  /** SHA-256 truncated hash for deduplication. */
  contentHash: string;
}

export interface ChunkingOptions {
  /** Target tokens per chunk (default: 1000). */
  targetTokens?: number;
  /** Maximum tokens per chunk (default: 1500). */
  maxTokens?: number;
  /** Minimum tokens per chunk before merging with next (default: 100). */
  minTokens?: number;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  targetTokens: 1000,
  maxTokens: 1500,
  minTokens: 100,
};

/**
 * Chunk text by heading markers (##, ###, \section, etc.).
 * Falls back to paragraph-based chunking if no headings found.
 */
export function chunkText(text: string, options?: ChunkingOptions): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  let sections = splitByHeadings(text);

  // If no headings found, fall back to paragraph-based splitting
  if (sections.length <= 1) {
    sections = splitByParagraphs(text);
  }

  // Merge small sections, split large ones
  const balanced = balanceSections(sections, opts);

  return balanced.map((content, index) => ({
    content,
    chunkIndex: index,
    tokenCount: estimateTokens(content),
    contentHash: computeChunkHash(content),
  }));
}

/**
 * Split text by heading markers: ## / ### / #### / \section / \subsection.
 * Each heading starts a new section, with the heading included in its section.
 */
function splitByHeadings(text: string): string[] {
  // Match markdown headings (## ...) or LaTeX section commands
  const headingPattern = /^(?:#{2,4}\s+.+|\\(?:sub)?section\{.+\})$/gm;

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

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);
    const bufferTokens = estimateTokens(buffer);

    if (bufferTokens + sectionTokens <= opts.maxTokens) {
      // Accumulate into buffer
      buffer = buffer ? `${buffer}\n\n${section}` : section;
    } else {
      // Flush buffer if it has enough content
      if (buffer && bufferTokens >= opts.minTokens) {
        result.push(buffer);
        buffer = "";
      } else if (buffer) {
        // Buffer is too small but adding section would exceed max
        // Try to merge anyway if combined is reasonable
        buffer = buffer ? `${buffer}\n\n${section}` : section;
        if (estimateTokens(buffer) > opts.maxTokens) {
          // Split the oversized buffer
          result.push(...splitOversized(buffer, opts));
          buffer = "";
        }
        continue;
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
    if (bufferTokens < opts.minTokens && result.length > 0) {
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
 * Split an oversized section into chunks at sentence/paragraph boundaries.
 */
function splitOversized(text: string, opts: Required<ChunkingOptions>): string[] {
  const sentences = text.split(/(?<=[.!?。])\s+|\n/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const combined = current ? `${current} ${trimmed}` : trimmed;
    if (estimateTokens(combined) <= opts.targetTokens) {
      current = combined;
    } else {
      if (current) {
        chunks.push(current);
      }
      current = trimmed;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

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
