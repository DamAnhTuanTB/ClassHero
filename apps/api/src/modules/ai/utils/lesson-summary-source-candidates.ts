import { createHash } from "node:crypto";

import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";

export type LessonSummarySourceCandidate = {
  id: string;
  sourceChunkId: string;
  relatedTopicIdHint: string | null;
  kindHint: "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE" | "UNKNOWN";
  formatHint: "SINGLE" | "MULTI_PART";
  pedagogyHint: "DISCOVERY" | "WORKED_EXAMPLE" | "PRACTICE" | "APPLICATION" | "UNKNOWN";
  completenessHint: "COMPLETE" | "INCOMPLETE" | "REQUIRES_FIGURE";
  visualDependencyHint: "NONE" | "SOURCE_IMAGE";
  problem: string;
};

export type LessonSummarySourceTopic = {
  id: string;
  sourceChunkId: string;
  sourceHeadingRaw: string;
  headingQualityHint: "CLEAN" | "POSSIBLY_BROKEN";
};

const CANDIDATE_START_PATTERN =
  /^(?:\\item(?:\[[^\]]+\])?|(?:ví\s*dụ|vi\s*du|vidu|luy\S*n\s*t\S*p|v\S*n\s*d\S*ng|th\S*c\s*h\S*nh|hd\s*\d+|thử\s*thách|tranh\s*luận|bài\s*\d+(?:\.\d+)?)(?=\s|[.:]|$)|\\section\*?\{(?:luy\S*n\s*t\S*p|v\S*n\s*d\S*ng|th\S*c\s*h\S*nh|bài\s*tập|thử\s*thách)[^}]*\})/iu;
const TASK_PATTERN =
  /(?:\?|(?:^|[^\p{L}])(?:tính|tìm|hãy|chứng\s*minh|so\s*sánh|sắp\s*xếp|viết|vẽ|cho\s+tam\s+giác|giải\s+thích|xác\s*định|biểu\s*diễn)(?=$|[^\p{L}]))/iu;
const SOLUTION_BOUNDARY_PATTERN =
  /(?:\n|[.!?]\s+)(?:giải|lời\s*giải|đáp\s*án|chú\s*ý|nhận\s*xét)\s*(?=[:.(]|\\begin|\n|$)/iu;
const REAL_WORLD_SIGNAL_PATTERN =
  /(?:^|[^\p{L}])(?:thực\s*tế|đời\s*sống|người|cửa\s*hàng|thư\s*viện|khoai\s*tây|khinh\s*khí\s*cầu|chiếc\s*thang|chiếc\s*áo|giảm\s*giá|bức\s*tường|bánh\s*chưng|quả\s*cân|mảnh\s*sân|sàn\s*thi\s*đấu|kim\s*tự\s*tháp|giá\s*sách|tấm\s*ảnh|viên\s*gạch|dân\s*số|nhiệt\s*độ|vận\s*tốc|quãng\s*đường|trái\s*đất|mặt\s*trời|mộc\s*tinh|lượng\s*nước|công\s*trình|mái\s*nhà|biển\s*báo|cổng\s*trang\s*trí|khung\s*kim\s*loại|xưởng|bể\s*chứa|bể\s*hình\s*lập\s*phương)(?=$|[^\p{L}])/iu;

export function buildLessonSummarySourceCandidates(
  chunks: RetrievedChunk[],
): LessonSummarySourceCandidate[] {
  const candidates: LessonSummarySourceCandidate[] = [];
  const seen = new Set<string>();
  const topicsWithOffsets = buildTopicsWithOffsets(chunks);

  chunks.forEach((chunk, chunkIndex) => {
    const blocks = splitCandidateBlocks(chunk.content);
    blocks.forEach((block, index) => {
      const nextBlock = blocks[index + 1] ?? "";
      const joined = shouldJoinNextBlock(block) ? `${block}\n${nextBlock}`.trim() : block;
      const rawProblem = truncateSolution(joined).trim();
      if (!isCandidate(rawProblem)) return;
      const problem = sanitizeCandidateProblem(rawProblem);

      const normalized = normalizeCandidate(problem);
      if (
        normalized.length < 8 ||
        isObviouslyIncompleteCandidate(problem) ||
        seen.has(`${chunk.id}:${normalized}`)
      ) {
        return;
      }
      seen.add(`${chunk.id}:${normalized}`);
      candidates.push({
        id: `C${String(candidates.length + 1).padStart(3, "0")}`,
        sourceChunkId: chunk.id,
        relatedTopicIdHint: findRelatedTopicId({
          chunks,
          chunkIndex,
          chunk,
          problem: rawProblem,
          topicsWithOffsets,
        }),
        kindHint: classifyCandidate(problem),
        formatHint: classifyCandidateFormat(problem),
        pedagogyHint: classifyCandidatePedagogy(problem),
        completenessHint: classifyCandidateCompleteness(rawProblem),
        visualDependencyHint: hasSourceVisualDependency(rawProblem)
          ? "SOURCE_IMAGE"
          : "NONE",
        problem,
      });
    });
  });

  return candidates;
}

export function buildLessonSummarySourceTopics(
  chunks: RetrievedChunk[],
): LessonSummarySourceTopic[] {
  return buildTopicsWithOffsets(chunks).map(
    ({ offset: _offset, chunkId: _chunkId, ...topic }) => topic,
  );
}

export function attachLessonSummarySourceCandidates(chunks: RetrievedChunk[]) {
  const candidatesByChunk = new Map<string, LessonSummarySourceCandidate[]>();
  const topicsByChunk = new Map<string, LessonSummarySourceTopic[]>();
  const candidates = buildLessonSummarySourceCandidates(chunks);
  candidates.forEach((candidate) => {
    const values = candidatesByChunk.get(candidate.sourceChunkId) ?? [];
    values.push(candidate);
    candidatesByChunk.set(candidate.sourceChunkId, values);
  });
  buildLessonSummarySourceTopics(chunks).forEach((topic) => {
    const values = topicsByChunk.get(topic.sourceChunkId) ?? [];
    values.push(topic);
    topicsByChunk.set(topic.sourceChunkId, values);
  });

  return chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...(chunk.metadata ?? {}),
      sourceTopics: (topicsByChunk.get(chunk.id) ?? []).map((topic) => {
        const relatedCandidates = candidates.filter(
          (candidate) => candidate.relatedTopicIdHint === topic.id,
        );
        return {
          ...topic,
          relatedCandidateIds: relatedCandidates.map((candidate) => candidate.id),
          recommendedIllustrationCandidateIds: relatedCandidates
            .filter(
              (candidate) =>
                candidate.completenessHint !== "INCOMPLETE" &&
                (candidate.kindHint === "ILLUSTRATION" ||
                  candidate.kindHint === "STANDARD_EXERCISE"),
            )
            .map((candidate) => candidate.id),
        };
      }),
      sourceCandidates: candidatesByChunk.get(chunk.id) ?? [],
    },
  }));
}

function extractTopicMatches(chunk: RetrievedChunk) {
  const matches: Array<LessonSummarySourceTopic & { offset: number }> = [];
  const patterns = [
    { pattern: /\\section\*?\{([^}]+)\}/giu, requireUppercase: false },
    {
      pattern: /^\s*(?:\\textbf\{)?(\d{1,2}\s+[^\n}]+)\}?\s*$/gmu,
      requireUppercase: true,
    },
  ];

  patterns.forEach(({ pattern, requireUppercase }) => {
    for (const match of chunk.content.matchAll(pattern)) {
      const sourceHeadingRaw = (match[1] ?? "").replace(/\\\\/gu, " ").trim();
      if (!isTheoryTopicHeading(sourceHeadingRaw, requireUppercase)) continue;
      const offset = match.index ?? 0;
      const normalized = normalizeCandidate(sourceHeadingRaw);
      if (
        matches.some((value) => normalizeCandidate(value.sourceHeadingRaw) === normalized)
      ) {
        continue;
      }
      matches.push({
        id: `${chunk.id}#topic-${createHash("sha256").update(`${offset}:${sourceHeadingRaw}`).digest("hex").slice(0, 12)}`,
        sourceChunkId: chunk.id,
        sourceHeadingRaw,
        headingQualityHint: classifyHeadingQuality(sourceHeadingRaw),
        offset,
      });
    }
  });

  return matches.sort((left, right) => left.offset - right.offset);
}

function buildTopicsWithOffsets(chunks: RetrievedChunk[]) {
  const extracted = chunks.flatMap((chunk) =>
    extractTopicMatches(chunk).map((topic) => ({ ...topic, chunkId: chunk.id })),
  );
  if (extracted.length > 0) return assignCompactTopicIds(extracted);

  for (const chunk of chunks) {
    const nestedLessonHeading =
      /\\section\*?\{\\section\*?\{\d+\}\s*\\\\\s*\\section\*?\{([^}]+)\}\}/iu.exec(
        chunk.content,
      );
    const sourceHeadingRaw = nestedLessonHeading?.[1]?.trim();
    if (!sourceHeadingRaw) continue;
    const offset = nestedLessonHeading?.index ?? 0;
    return assignCompactTopicIds([
      {
        id: `${chunk.id}#topic-${createHash("sha256").update(`${offset}:${sourceHeadingRaw}`).digest("hex").slice(0, 12)}`,
        sourceChunkId: chunk.id,
        sourceHeadingRaw,
        headingQualityHint: classifyHeadingQuality(sourceHeadingRaw),
        offset,
        chunkId: chunk.id,
      },
    ]);
  }

  const fallbackChunk = chunks.find((chunk) => chunk.content.trim().length > 0);
  if (!fallbackChunk) return [];
  const sourceHeadingRaw =
    fallbackChunk.content
      .split(/\r?\n/gu)
      .map((line) => line.replace(/^#+\s*/u, "").trim())
      .find(Boolean)
      ?.slice(0, 240) ?? "Nội dung bài học";
  return assignCompactTopicIds([
    {
      id: `${fallbackChunk.id}#topic-${createHash("sha256").update(`0:${sourceHeadingRaw}`).digest("hex").slice(0, 12)}`,
      sourceChunkId: fallbackChunk.id,
      sourceHeadingRaw,
      headingQualityHint: classifyHeadingQuality(sourceHeadingRaw),
      offset: 0,
      chunkId: fallbackChunk.id,
    },
  ]);
}

function assignCompactTopicIds<
  T extends LessonSummarySourceTopic & { offset: number; chunkId: string },
>(topics: T[]) {
  return topics.map((topic, index) => ({
    ...topic,
    id: `T${String(index + 1).padStart(2, "0")}`,
  }));
}

function isTheoryTopicHeading(value: string, requireUppercase: boolean) {
  if (!/^\d{1,2}\s+\S/u.test(value)) return false;
  if (/^\d{1,2}\s+(?:bài\s*tập|luyện\s*tập|vận\s*dụng|em\s+có\s+biết)/iu.test(value)) {
    return false;
  }
  const text = value.replace(/^\d{1,2}\s+/u, "").trim();
  const letters = [...text].filter((character) => /\p{L}/u.test(character));
  if (!requireUppercase) return letters.length >= 4;
  const uppercase = letters.filter(
    (character) => character === character.toLocaleUpperCase("vi"),
  );
  return letters.length >= 4 && uppercase.length / letters.length >= 0.65;
}

function classifyHeadingQuality(
  value: string,
): LessonSummarySourceTopic["headingQualityHint"] {
  if (
    value.includes("�") ||
    /(?:\\[A-Za-z]+\{|[_]{2,}|\?{2,}|\b\p{L}\s+\p{L}\s+\p{L}\b)/u.test(value) ||
    value.replace(/[^\p{L}\p{N}]/gu, "").length < 4
  ) {
    return "POSSIBLY_BROKEN";
  }
  return "CLEAN";
}

function findRelatedTopicId(input: {
  chunks: RetrievedChunk[];
  chunkIndex: number;
  chunk: RetrievedChunk;
  problem: string;
  topicsWithOffsets: Array<
    LessonSummarySourceTopic & { offset: number; chunkId: string }
  >;
}) {
  const problemOffset = input.chunk.content.indexOf(input.problem.slice(0, 80));
  const localTopics = input.topicsWithOffsets.filter(
    (topic) =>
      topic.chunkId === input.chunk.id && topic.offset <= Math.max(problemOffset, 0),
  );
  if (localTopics.length > 0) return localTopics.at(-1)?.id ?? null;

  for (let index = input.chunkIndex - 1; index >= 0; index -= 1) {
    const previousChunkId = input.chunks[index]?.id;
    const previousTopics = input.topicsWithOffsets.filter(
      (topic) => topic.chunkId === previousChunkId,
    );
    if (previousTopics.length > 0) return previousTopics.at(-1)?.id ?? null;
  }
  return null;
}

function splitCandidateBlocks(content: string) {
  return content
    .replace(/\r\n?/gu, "\n")
    .replace(/\n(?=\\item(?:\[[^\]]+\])?)/gu, "\n\n")
    .replace(
      /\n(?=(?:ví\s*dụ|vi\s*du|vidu|luy\S*n\s*t\S*p|v\S*n\s*d\S*ng|th\S*c\s*h\S*nh|hd\s*\d+|thử\s*thách|tranh\s*luận)(?=\s|[.:]|$))/giu,
      "\n\n",
    )
    .split(/\n{2,}/gu)
    .map((block) => block.trim())
    .filter(Boolean);
}

function shouldJoinNextBlock(block: string) {
  return (
    block.length < 100 && CANDIDATE_START_PATTERN.test(block) && !TASK_PATTERN.test(block)
  );
}

function truncateSolution(value: string) {
  const boundary = value.search(SOLUTION_BOUNDARY_PATTERN);
  return boundary >= 0 ? value.slice(0, boundary) : value;
}

function sanitizeCandidateProblem(value: string) {
  return value
    .replace(
      /\\begin\{figure\}[\s\S]*?\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}[\s\S]*?\\end\{figure\}/gu,
      "",
    )
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/gu, "")
    .replace(/\\(?:begin|end)\{itemize\}/gu, "")
    .replace(
      /^\\item\[\(?(\d+(?:\.\d+)*\.?)\)?\]\s*/u,
      (_match, number: string) => `Bài ${number.replace(/\.$/u, "")}. `,
    )
    .replace(/^(?:vi\s*du|vidu)(?=\s|[.:]|$)/iu, "Ví dụ")
    .replace(/^luy\S*n\s*t\S*p(?=\s|[.:]|$)/iu, "Luyện tập")
    .replace(/^v\S*n\s*d\S*ng(?=\s|[.:]|$)/iu, "Vận dụng")
    .replace(/^th\S*c\s*h\S*nh(?=\s|[.:]|$)/iu, "Thực hành")
    .replace(/\s+(?=[a-z]\)\s)/giu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function isCandidate(value: string) {
  if (/^\\item\[(?:-|\*|\(?[a-z]\)?)\]/iu.test(value)) return false;
  const visibleText = value
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/gu, "")
    .trim();
  if (visibleText.length > 2_000 || !TASK_PATTERN.test(visibleText)) return false;
  return CANDIDATE_START_PATTERN.test(visibleText) || visibleText.includes("?");
}

function classifyCandidate(value: string): LessonSummarySourceCandidate["kindHint"] {
  if (/^(?:ví\s*dụ|vi\s*du|vidu)(?=\s|[.:]|$)/iu.test(value)) {
    return "ILLUSTRATION";
  }
  if (/^Thực\s+hành(?:\s|[.:]|$)/iu.test(value)) return "ILLUSTRATION";
  if (isLessonSummaryRealWorldCandidate(value)) return "REAL_WORLD_EXERCISE";
  if (/^(?:\\item|luy\S*n\s*t\S*p|hd\s*\d+|bài\s*\d+(?:\.\d+)?)/iu.test(value)) {
    return "STANDARD_EXERCISE";
  }
  return "UNKNOWN";
}

function classifyCandidateFormat(
  value: string,
): LessonSummarySourceCandidate["formatHint"] {
  const itemLabels = value.match(/(?:^|\n|\s)[a-z]\)\s/giu) ?? [];
  return itemLabels.length >= 2 ? "MULTI_PART" : "SINGLE";
}

function classifyCandidatePedagogy(
  value: string,
): LessonSummarySourceCandidate["pedagogyHint"] {
  if (/^HD\s*\d+/iu.test(value)) return "DISCOVERY";
  if (/^Thực\s+hành(?:\s|[.:]|$)/iu.test(value)) return "PRACTICE";
  if (/^Ví\s*dụ(?:\s|[.:]|$)/iu.test(value)) return "WORKED_EXAMPLE";
  if (/^(?:Luyện\s*tập|Bài\s*\d+(?:\.\d+)?)(?:\s|[.:]|$)/iu.test(value)) {
    return "PRACTICE";
  }
  if (
    /^(?:Vận\s*dụng|Thử\s*thách)(?:\s|[.:]|$)/iu.test(value) ||
    isLessonSummaryRealWorldCandidate(value)
  ) {
    return "APPLICATION";
  }
  return "UNKNOWN";
}

function classifyCandidateCompleteness(
  value: string,
): LessonSummarySourceCandidate["completenessHint"] {
  if (isObviouslyIncompleteCandidate(value)) return "INCOMPLETE";
  if (hasSourceVisualDependency(value)) {
    return "REQUIRES_FIGURE";
  }
  return "COMPLETE";
}

function hasSourceVisualDependency(value: string) {
  return (
    /\\includegraphics|\\begin\{figure\}|!\[[^\]]*\]\([^)]*\)/u.test(value) ||
    /\b(?:Hình|hình vẽ)\s*\d+(?:\.\d+)?\b/iu.test(value)
  );
}

function isObviouslyIncompleteCandidate(value: string) {
  return /(?:^|\s)(?:Em\s+hãy|Hãy|Quan\s+sát|Thực\s+hiện|Tính|Tìm|Chứng\s+minh)\s*[:.]?$/iu.test(
    value.trim(),
  );
}

export function isLessonSummaryRealWorldCandidate(value: string) {
  return REAL_WORLD_SIGNAL_PATTERN.test(value);
}

function normalizeCandidate(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
