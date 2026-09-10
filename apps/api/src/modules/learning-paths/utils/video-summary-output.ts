import { z } from "zod";

import {
  LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
  LESSON_SUMMARY_PROVIDER_SOLUTION_DESCRIPTION,
  LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION,
  LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION,
} from "#api/modules/ai/types/lesson-summary.types";

const nonEmptyText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

const unresolvedVisualReferencePattern =
  /(?:\b(?:hình|ảnh|bảng|biểu đồ|đồ thị|sơ đồ)\s+(?:bên|dưới|trên|sau|kèm|minh họa|\d+(?:\.\d+)*)\b|\b(?:quan sát|dựa vào|theo)\s+(?:hình|ảnh|bảng|biểu đồ|đồ thị|sơ đồ)\b)/iu;
const summaryBulletPattern = /^-\s+\S/u;

export function isVideoSummaryExampleSelfContained(input: {
  problem: string;
  solution: string;
}) {
  return !unresolvedVisualReferencePattern.test(`${input.problem}\n${input.solution}`);
}

export function normalizeVideoSummaryTextLayout(value: string) {
  return value.replace(
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
  .strict()
  .superRefine((block, context) => {
    if (!isVideoSummaryExampleSelfContained(block)) {
      context.addIssue({
        code: "custom",
        path: ["problem"],
        message:
          "Không trả khối ví dụ phụ thuộc vào hình/ảnh/bảng/biểu đồ không có trong output.",
      });
    }
  });

const videoFinalSummaryBlockSchema = z
  .object({
    type: z.literal("summary"),
    content: nonEmptyText(4_000).describe(
      `Tổng kết ngắn gọn kiến thức, phương pháp và khả năng vận dụng sau khi xem video. Giữ cùng văn phong và quy tắc trình bày với khối kiến thức. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} ${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION}`,
    ),
  })
  .strict()
  .superRefine((block, context) => {
    const lines = block.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0 || !lines.every((line) => summaryBulletPattern.test(line))) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message:
          "Khối tổng kết phải chỉ gồm các bullet bắt đầu bằng '- ' về dạng bài/nhiệm vụ có thể giải quyết.",
      });
    }
  });

const videoSummaryBlockSchema = z.discriminatedUnion("type", [
  videoKnowledgeBlockSchema,
  videoExampleBlockSchema,
  videoFinalSummaryBlockSchema,
]);

export const videoSummaryOutputSchema = z
  .object({
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).min(1).max(10),
    sections: z
      .array(
        z
          .object({
            order: z.number().int().positive(),
            displayHeading: nonEmptyText(240),
            startSeconds: z.number().min(0),
            blocks: z.array(videoSummaryBlockSchema).min(1).max(30),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((output, context) => {
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

      const firstTimedBlock = section.blocks.find((block) => block.type !== "summary");
      if (firstTimedBlock && section.startSeconds > firstTimedBlock.startSeconds) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "startSeconds"],
          message:
            "Section phải bắt đầu không muộn hơn khối nội dung đầu tiên của section.",
        });
      }
    });

    const blocks = output.sections.flatMap((section) => section.blocks);
    if (blocks.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Cần ít nhất một khối nội dung trước khối tổng kết.",
      });
      return;
    }

    let previousStartSeconds = -1;
    blocks.forEach((block, index) => {
      const isLast = index === blocks.length - 1;
      if (block.type === "summary" && !isLast) {
        context.addIssue({
          code: "custom",
          path: ["sections"],
          message: "Khối summary chỉ được xuất hiện một lần ở cuối.",
        });
      }
      if (isLast && block.type !== "summary") {
        context.addIssue({
          code: "custom",
          path: ["sections"],
          message: "Khối cuối cùng phải là summary.",
        });
      }
      if (block.type !== "summary") {
        if (block.startSeconds < previousStartSeconds) {
          context.addIssue({
            code: "custom",
            path: ["sections"],
            message:
              "Các khối knowledge/example phải tăng theo thời gian xuất hiện trong video.",
          });
        }
        previousStartSeconds = block.startSeconds;
      }
    });
  });

export type VideoSummaryOutput = z.infer<typeof videoSummaryOutputSchema>;

export function hasValidVideoSummaryCueStartTimes(
  output: VideoSummaryOutput,
  cueStartSeconds: readonly number[],
) {
  const tolerance = 0.001;
  return output.sections
    .flatMap((section) => [
      section.startSeconds,
      ...section.blocks
        .filter((block) => block.type !== "summary")
        .map((block) => block.startSeconds),
    ])
    .every((startSeconds) =>
      cueStartSeconds.some(
        (cueStart) => Math.abs(cueStart - startSeconds) <= tolerance,
      ),
    );
}

export function toVideoSummaryBlocksDocument(output: VideoSummaryOutput) {
  return {
    type: "lesson_summary_blocks" as const,
    version: 5,
    data: {
      title: output.title,
      objectives: output.objectives,
      sections: output.sections.map((section) => ({
        order: section.order,
        displayHeading: section.displayHeading,
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
            : block.type === "knowledge"
              ? {
                  ...block,
                  title: normalizeVideoSummaryTextLayout(block.title),
                  content: normalizeVideoSummaryTextLayout(block.content),
                  figures: [],
                }
              : {
                  ...block,
                  content: normalizeVideoSummaryTextLayout(block.content),
                  figures: [],
                },
        ),
      })),
    },
  };
}
