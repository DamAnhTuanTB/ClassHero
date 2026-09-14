import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { normalizeVideoSummaryDocument } from "#api/modules/learning-paths/utils/video-summary-output";

const MAX_CHUNK_TOKENS = 1_200;

type JsonRecord = Record<string, unknown>;

type SearchableVideoSummaryBlock = {
  text: string;
  startSeconds: number | null;
};

export type VideoSummaryIndexChunk = {
  chunkIndex: number;
  content: string;
  contentHash: string;
  summaryHash: string;
  tokenCount: number;
  startSeconds: number | null;
  endSeconds: number | null;
  metadataJson: {
    sourceType: "VIDEO_SUMMARY";
    timeline: "SOURCE";
  };
};

export type VideoSummaryIndex = {
  summaryHash: string;
  chunks: VideoSummaryIndexChunk[];
};

export function buildVideoSummaryIndex(contentJson: unknown): VideoSummaryIndex {
  const normalized = normalizeVideoSummaryDocument(contentJson);
  const summaryHash = hashAiValue(normalized);
  const sections = readStructuredSections(normalized);
  const rawChunksWithoutRanges = sections.flatMap((section) => chunkSection(section));
  const rawChunks = applyCoverageRanges(rawChunksWithoutRanges);

  return {
    summaryHash,
    chunks: rawChunks.map((chunk, chunkIndex) => ({
      chunkIndex,
      content: chunk.content,
      contentHash: hashAiValue(chunk.content),
      summaryHash,
      tokenCount: estimateTokens(chunk.content),
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      metadataJson: {
        sourceType: "VIDEO_SUMMARY",
        timeline: "SOURCE",
      },
    })),
  };
}

function readStructuredSections(value: unknown) {
  const document = asRecord(value);
  const data = asRecord(document?.data);
  if (document?.type !== "lesson_summary_blocks" || !Array.isArray(data?.sections)) {
    return [];
  }

  const objectives = Array.isArray(data.objectives) ? data.objectives : [];
  return data.sections.flatMap((rawSection, sectionIndex) => {
    const section = asRecord(rawSection);
    if (!section || !Array.isArray(section.blocks)) return [];
    const heading = readString(section.displayHeading) ?? `Phần ${sectionIndex + 1}`;
    const objective = readString(objectives[sectionIndex]);
    const sectionStart = readFiniteNumber(section.startSeconds);
    const blocks = section.blocks.flatMap((rawBlock) => {
      const block = asRecord(rawBlock);
      if (!block) return [];
      if (block.type !== "knowledge" && block.type !== "example") return [];
      const text = serializeBlock(block);
      if (!text) return [];
      return [
        {
          text,
          startSeconds: readFiniteNumber(block.startSeconds) ?? sectionStart,
        } satisfies SearchableVideoSummaryBlock,
      ];
    });
    return blocks.length > 0 ? [{ heading, objective, sectionStart, blocks }] : [];
  });
}

function chunkSection(section: {
  heading: string;
  objective: string | null;
  sectionStart: number | null;
  blocks: SearchableVideoSummaryBlock[];
}) {
  const prefix = [`## ${section.heading}`, section.objective && `Mục tiêu: ${section.objective}`]
    .filter(Boolean)
    .join("\n");
  const chunks: Array<{
    content: string;
    startSeconds: number | null;
    endSeconds: number | null;
  }> = [];

  for (const block of section.blocks) {
    const content = [prefix, block.text].join("\n\n");
    const pieces =
      estimateTokens(content) > MAX_CHUNK_TOKENS
        ? splitOversizedText(block.text, prefix)
        : [content];
    for (const piece of pieces) {
      chunks.push({
        content: piece,
        startSeconds: block.startSeconds ?? section.sectionStart,
        endSeconds: null,
      });
    }
  }
  return chunks;
}

function applyCoverageRanges<T extends {
  startSeconds: number | null;
  endSeconds: number | null;
}>(chunks: T[]) {
  return chunks.map((chunk) => {
    if (chunk.startSeconds === null) return chunk;
    const nextStart = chunks
      .map((candidate) => candidate.startSeconds)
      .find(
        (candidate): candidate is number =>
          candidate !== null && candidate > chunk.startSeconds!,
      );
    return { ...chunk, endSeconds: nextStart ?? null };
  });
}

function serializeBlock(block: JsonRecord) {
  const timestamp = readFiniteNumber(block.startSeconds);
  const prefix = timestamp === null ? "" : `[${formatTime(timestamp)}] `;
  if (block.type === "example") {
    return [
      `${prefix}Ví dụ`,
      readString(block.problem) && `Đề bài: ${readString(block.problem)}`,
      readString(block.solution) && `Lời giải: ${readString(block.solution)}`,
      readString(block.answer) && `Đáp án: ${readString(block.answer)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const title = readString(block.title);
  const content = readString(block.content);
  return [title ? `${prefix}${title}` : "", content].filter(Boolean).join("\n");
}

function splitOversizedText(text: string, prefix = "") {
  const paragraphs = text
    .split(/\n\s*\n|(?<=[.!?])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = [prefix, current, paragraph].filter(Boolean).join("\n\n");
    if (current && estimateTokens(candidate) > MAX_CHUNK_TOKENS) {
      chunks.push([prefix, current].filter(Boolean).join("\n\n"));
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push([prefix, current].filter(Boolean).join("\n\n"));
  return chunks;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}
