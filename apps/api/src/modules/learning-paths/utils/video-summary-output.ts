import {
  hasMalformedMathText,
  LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION,
  normalizeLearnerMathTextSyntax,
  normalizeThreePointAngleNotation,
} from "@learning-path/shared";
import { z } from "zod";

import {
  LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
  LESSON_SUMMARY_PROVIDER_SOLUTION_DESCRIPTION,
  LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION,
  LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION,
} from "#api/modules/ai/types/lesson-summary.types";
import { normalizeVideoSummaryChapterTitle } from "#api/modules/learning-paths/utils/video-summary-source";

const nonEmptyText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

const unresolvedVisualReferencePattern =
  /(?:\b(?:hình|ảnh|bảng|biểu đồ|đồ thị|sơ đồ)\s+(?:bên|dưới|trên|sau|kèm|minh họa|\d+(?:\.\d+)*)\b|\b(?:quan sát|dựa vào|theo)\s+(?:hình|ảnh|bảng|biểu đồ|đồ thị|sơ đồ)\b)/iu;
export const VIDEO_SUMMARY_DOCUMENT_VERSION = 6;

export function isVideoSummaryExampleSelfContained(input: {
  problem: string;
  solution: string;
}) {
  return !unresolvedVisualReferencePattern.test(`${input.problem}\n${input.solution}`);
}

export type VideoSummaryOutputWarning = {
  code: "UNRESOLVED_VISUAL_REFERENCE" | "MALFORMED_LATEX";
  path: string;
  message: string;
  severity: "WARNING";
};

export function normalizeVideoSummaryTextLayout(value: string) {
  return normalizeLearnerMathTextSyntax(normalizeThreePointAngleNotation(value)).replace(
    /(Khẳng định|Đáp án|Kết quả|Mệnh đề)\s*\n+\s*([a-zđ]\))/giu,
    "$1 $2",
  );
}

const videoKnowledgeBlockSchema = z
  .object({
    type: z.literal("knowledge"),
    title: nonEmptyText(240),
    startSeconds: z.number().min(0),
    content: nonEmptyText(6_000).describe(
      `Chỉ trình bày lý thuyết, khái niệm, công thức, quy tắc hoặc phương pháp thực sự có trong video; không chứa ví dụ/bài tập. Bảo toàn ký hiệu, hệ điều kiện, dấu ngoặc nhóm, bullet và dấu câu dẫn; không văn xuôi hóa công thức. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} ${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION}`,
    ),
  })
  .strict();

const videoExampleTextRules = `${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION} ${LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION}`;
const videoExampleBlockSchema = z
  .object({
    type: z.literal("example"),
    startSeconds: z.number().min(0),
    problem: nonEmptyText(4_000).describe(
      `Đề bài hoặc tình huống đầy đủ dữ kiện và yêu cầu đúng như nội dung video. ${videoExampleTextRules}`,
    ),
    solution: nonEmptyText(10_000).describe(
      `${LESSON_SUMMARY_PROVIDER_SOLUTION_DESCRIPTION} ${videoExampleTextRules}`,
    ),
    answer: nonEmptyText(3_000).describe(
      `Đáp án hoặc kết luận cuối của ví dụ; không lặp lại toàn bộ lời giải. ${videoExampleTextRules}`,
    ),
  })
  .strict();

const videoSummaryBlockSchema = z.discriminatedUnion("type", [
  videoKnowledgeBlockSchema,
  videoExampleBlockSchema,
]);

export type VideoSummaryChapter = { time: number; title: string };

const videoSummarySectionSchema = z
  .object({
    order: z.number().int().positive(),
    displayHeading: nonEmptyText(240).describe(
      "Tiêu đề section. Khi source có chapter, phải chép nguyên văn title của chapter cùng vị trí.",
    ),
    startSeconds: z
      .number()
      .min(0)
      .describe(
        "Thời điểm bắt đầu section. Khi source có chapter, phải bằng chính xác time của chapter cùng vị trí.",
      ),
    blocks: z.array(videoSummaryBlockSchema).min(1).max(30),
  })
  .strict();

export function buildVideoSummaryProviderOutputSchema(
  chapters: readonly VideoSummaryChapter[],
) {
  const objectives = z.array(nonEmptyText(500));
  const sections = z.array(videoSummarySectionSchema);
  return z
    .object({
      title: nonEmptyText(240),
      objectives:
        chapters.length > 0
          ? objectives.length(chapters.length)
          : objectives.min(1).max(20),
      sections:
        chapters.length > 0 ? sections.length(chapters.length) : sections.min(1).max(20),
    })
    .strict()
    .describe(
      `Tóm tắt video và mọi nội dung học sinh nhìn thấy. Khi source có chapter, objectives và sections phải có đúng số phần tương ứng; metadata section phải khớp chapter cùng vị trí. Chỉ khi source không có chapter, model mới tự chia section. ${LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION}`,
    );
}

export const videoSummaryProviderOutputSchema = buildVideoSummaryProviderOutputSchema([]);

export const videoSummaryOutputSchema = videoSummaryProviderOutputSchema.superRefine(
  (output, context) => {
    if (output.objectives.length !== output.sections.length) {
      context.addIssue({
        code: "custom",
        path: ["objectives"],
        message: "Mỗi section chính phải có đúng một kiến thức chính tương ứng.",
      });
    }

    let previousSectionStartSeconds = -1;
    output.sections.forEach((section, index) => {
      if (section.order !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "order"],
          message: "Thứ tự section phải liên tục và bắt đầu từ 1.",
        });
      }
      if (section.startSeconds < previousSectionStartSeconds) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "startSeconds"],
          message: "Thời gian bắt đầu của section phải tăng theo trình tự video.",
        });
      }
      previousSectionStartSeconds = section.startSeconds;

      const firstTimedBlock = section.blocks[0];
      if (firstTimedBlock && section.startSeconds > firstTimedBlock.startSeconds) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "startSeconds"],
          message:
            "Section phải bắt đầu không muộn hơn khối nội dung đầu tiên của section.",
        });
      }
    });

    let previousStartSeconds = -1;
    output.sections
      .flatMap((section) => section.blocks)
      .forEach((block) => {
        if (block.startSeconds < previousStartSeconds) {
          context.addIssue({
            code: "custom",
            path: ["sections"],
            message:
              "Các khối knowledge/example phải tăng theo thời gian xuất hiện trong video.",
          });
        }
        previousStartSeconds = block.startSeconds;
      });
  },
);

export type VideoSummaryOutput = z.infer<typeof videoSummaryOutputSchema>;

export function alignVideoSummaryOutputToChapters(
  output: VideoSummaryOutput,
  chapters: readonly VideoSummaryChapter[],
): VideoSummaryOutput {
  if (chapters.length === 0 || output.sections.length !== chapters.length) {
    return output;
  }
  const blocks = output.sections
    .flatMap((section) => section.blocks)
    .sort((left, right) => left.startSeconds - right.startSeconds);
  return {
    ...output,
    sections: output.sections.map((section, index) => ({
      ...section,
      order: index + 1,
      displayHeading: chapters[index]!.title,
      startSeconds: chapters[index]!.time,
      blocks: blocks.filter(
        (block) =>
          block.startSeconds >= chapters[index]!.time &&
          (!chapters[index + 1] || block.startSeconds < chapters[index + 1]!.time),
      ),
    })),
  };
}

export function videoSummarySectionsToChapters(
  output: VideoSummaryOutput,
): VideoSummaryChapter[] {
  return output.sections.map((section) => ({
    time: section.startSeconds,
    title: normalizeVideoSummaryTextLayout(section.displayHeading),
  }));
}

export function hasMatchingVideoSummaryChapters(
  output: VideoSummaryOutput,
  chapters: readonly VideoSummaryChapter[],
) {
  if (chapters.length === 0) return true;
  if (output.sections.length !== chapters.length) return false;
  const tolerance = 0.001;
  return output.sections.every((section, index) => {
    const chapter = chapters[index]!;
    const nextChapter = chapters[index + 1];
    return (
      section.order === index + 1 &&
      section.displayHeading === chapter.title &&
      Math.abs(section.startSeconds - chapter.time) <= tolerance &&
      section.blocks.every(
        (block) =>
          block.startSeconds >= chapter.time - tolerance &&
          (!nextChapter || block.startSeconds < nextChapter.time),
      )
    );
  });
}

export function collectVideoSummaryOutputWarnings(
  output: z.infer<typeof videoSummaryProviderOutputSchema>,
): VideoSummaryOutputWarning[] {
  const warnings: VideoSummaryOutputWarning[] = [];
  const textCandidates: Array<{ path: string; value: string }> = [
    { path: "title", value: output.title },
    ...output.objectives.map((value, index) => ({
      path: `objectives.${index}`,
      value,
    })),
  ];
  output.sections.forEach((section, sectionIndex) => {
    textCandidates.push({
      path: `sections.${sectionIndex}.displayHeading`,
      value: section.displayHeading,
    });
    section.blocks.forEach((block, blockIndex) => {
      const blockPath = `sections.${sectionIndex}.blocks.${blockIndex}`;
      if (block.type === "example") {
        if (!isVideoSummaryExampleSelfContained(block)) {
          warnings.push({
            code: "UNRESOLVED_VISUAL_REFERENCE",
            path: `${blockPath}.problem`,
            message:
              "Ví dụ có tham chiếu hình/ảnh/bảng/biểu đồ chưa được mô tả đầy đủ bằng text; cần admin kiểm tra.",
            severity: "WARNING",
          });
        }
        textCandidates.push(
          { path: `${blockPath}.problem`, value: block.problem },
          { path: `${blockPath}.solution`, value: block.solution },
          { path: `${blockPath}.answer`, value: block.answer },
        );
      } else {
        textCandidates.push(
          { path: `${blockPath}.title`, value: block.title },
          { path: `${blockPath}.content`, value: block.content },
        );
      }
    });
  });
  textCandidates.forEach(({ path, value }) => {
    if (!hasMalformedMathText(normalizeVideoSummaryTextLayout(value))) return;
    warnings.push({
      code: "MALFORMED_LATEX",
      path,
      message:
        "Công thức LaTeX vẫn chưa cân bằng sau bước chuẩn hóa; cần admin kiểm tra.",
      severity: "WARNING",
    });
  });
  return warnings;
}

export function hasValidVideoSummaryCueStartTimes(
  output: VideoSummaryOutput,
  cueStartSeconds: readonly number[],
  chapters: readonly VideoSummaryChapter[] = [],
) {
  const tolerance = 0.001;
  return output.sections
    .flatMap((section) => [
      ...(chapters.length > 0 ? [] : [section.startSeconds]),
      ...section.blocks.map((block) => block.startSeconds),
    ])
    .every((startSeconds) =>
      cueStartSeconds.some((cueStart) => Math.abs(cueStart - startSeconds) <= tolerance),
    );
}

export function toVideoSummaryBlocksDocument(
  output: VideoSummaryOutput,
  warnings: readonly VideoSummaryOutputWarning[] = [],
) {
  return {
    type: "lesson_summary_blocks" as const,
    version: VIDEO_SUMMARY_DOCUMENT_VERSION,
    data: {
      title: normalizeVideoSummaryTextLayout(output.title),
      objectives: output.objectives.map(normalizeVideoSummaryTextLayout),
      warnings,
      sections: output.sections.map((section) => ({
        order: section.order,
        displayHeading: normalizeVideoSummaryTextLayout(section.displayHeading),
        startSeconds: section.startSeconds,
        blocks: section.blocks.map((block) =>
          block.type === "example"
            ? {
                ...block,
                problem: normalizeVideoSummaryTextLayout(block.problem),
                solution: normalizeVideoSummaryTextLayout(block.solution),
                answer: normalizeVideoSummaryTextLayout(block.answer),
                figures: [],
                origin: "SOURCE_EXACT" as const,
              }
            : {
                ...block,
                title: normalizeVideoSummaryTextLayout(block.title),
                content: normalizeVideoSummaryTextLayout(block.content),
                figures: [],
              },
        ),
      })),
    },
  };
}

export function normalizeVideoSummaryDocument(value: unknown) {
  if (!isRecord(value) || value.type !== "lesson_summary_blocks") {
    return value;
  }

  const data = value.data;
  if (!isRecord(data)) return value;
  const sourceSections = data.sections;
  if (!Array.isArray(sourceSections)) return value;

  const retainedSectionIndexes: number[] = [];
  const sections = sourceSections.flatMap((section, sectionIndex) => {
    if (!isRecord(section) || !Array.isArray(section.blocks)) {
      retainedSectionIndexes.push(sectionIndex);
      return [section];
    }
    const blocks = section.blocks.filter(
      (block) => !isRecord(block) || block.type !== "summary",
    );
    if (blocks.length === 0) return [];
    retainedSectionIndexes.push(sectionIndex);
    return [{ ...section, order: retainedSectionIndexes.length, blocks }];
  });
  const { summary: _legacySummary, ...dataWithoutSummary } = data;
  const objectiveItems = Array.isArray(data.objectives) ? data.objectives : null;
  const objectives = objectiveItems
    ? retainedSectionIndexes.map((index) => {
        const objective = objectiveItems[index];
        return typeof objective === "string"
          ? normalizeVideoSummaryTextLayout(objective)
          : objective;
      })
    : data.objectives;

  return {
    ...value,
    version: VIDEO_SUMMARY_DOCUMENT_VERSION,
    data: {
      ...dataWithoutSummary,
      ...(typeof data.title === "string"
        ? { title: normalizeVideoSummaryTextLayout(data.title) }
        : {}),
      objectives,
      sections: sections.map((section) => {
        if (!isRecord(section)) return section;
        return {
          ...section,
          ...(typeof section.displayHeading === "string"
            ? {
                displayHeading: normalizeVideoSummaryChapterTitle(
                  normalizeVideoSummaryTextLayout(section.displayHeading),
                ),
              }
            : {}),
          ...(Array.isArray(section.blocks)
            ? {
                blocks: section.blocks.map((block) => {
                  if (!isRecord(block)) return block;
                  if (block.type === "example") {
                    return {
                      ...block,
                      ...(typeof block.problem === "string"
                        ? {
                            problem: normalizeVideoSummaryTextLayout(block.problem),
                          }
                        : {}),
                      ...(typeof block.solution === "string"
                        ? {
                            solution: normalizeVideoSummaryTextLayout(block.solution),
                          }
                        : {}),
                      ...(typeof block.answer === "string"
                        ? { answer: normalizeVideoSummaryTextLayout(block.answer) }
                        : {}),
                    };
                  }
                  return {
                    ...block,
                    ...(typeof block.title === "string"
                      ? { title: normalizeVideoSummaryTextLayout(block.title) }
                      : {}),
                    ...(typeof block.content === "string"
                      ? { content: normalizeVideoSummaryTextLayout(block.content) }
                      : {}),
                  };
                }),
              }
            : {}),
        };
      }),
    },
  };
}

export function hasVideoSummaryBlock(value: unknown) {
  if (
    !isRecord(value) ||
    value.type !== "lesson_summary_blocks" ||
    !isRecord(value.data)
  ) {
    return false;
  }
  if ("summary" in value.data) return true;
  if (!Array.isArray(value.data.sections)) return false;
  return value.data.sections.some(
    (section) =>
      isRecord(section) &&
      Array.isArray(section.blocks) &&
      section.blocks.some((block) => isRecord(block) && block.type === "summary"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
