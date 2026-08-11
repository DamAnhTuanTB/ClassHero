import {
  AI_REASONING_EFFORT_LEVELS,
  LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
  lessonSummaryDiagramStructuralVisualSchema,
  lessonSummaryGeometryStatementSchema,
} from "@learning-path/shared";
import { z } from "zod";

import {
  lessonSummaryProviderDiagramInputSchema,
  lessonSummaryProviderDiagramTransportSchema,
} from "#api/modules/ai/types/lesson-summary-provider-diagram.types";

export const LESSON_SUMMARY_PROMPT_VERSION = "lesson-summary-prompt-v58";
export const LESSON_SUMMARY_SCHEMA_VERSION = "lesson-summary-schema-v42";
export const LESSON_SUMMARY_MAX_CONTEXT_TOKENS = 12_000;
export const LESSON_SUMMARY_MAX_OUTPUT_TOKENS = 8_000;
export const LESSON_SUMMARY_MIN_OUTPUT_TOKENS = 8_000;
export const LESSON_SUMMARY_MAX_CONFIGURED_OUTPUT_TOKENS = 32_000;

export const lessonSummaryStyleSchema = z.enum([
  "student_friendly",
  "concise",
  "academic",
]);
export const lessonSummaryLengthSchema = z.enum(["short", "standard", "detailed"]);

const nonEmptyText = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const sourceChunkIdsSchema = z.array(z.uuid()).min(1).max(20);

const baseBlockSchema = z.object({
  sourceChunkIds: sourceChunkIdsSchema,
  visual: lessonSummaryDiagramStructuralVisualSchema.optional(),
});

export const lessonSummaryExampleOriginSchema = z.enum([
  "SOURCE_EXACT",
  "SOURCE_ADAPTED",
  "AI_AUTHORED",
]);

export const lessonSummarySourceAssessmentSchema = z
  .object({
    status: z.enum(["CONFIRMED", "CORRECTED", "UNCERTAIN"]),
    reason: nonEmptyText(1_000),
    correctedKindHint: z
      .enum(["ILLUSTRATION", "STANDARD_EXERCISE", "REAL_WORLD_EXERCISE", "UNKNOWN"])
      .nullable(),
    correctedRelatedTopicId: nonEmptyText(300).nullable(),
  })
  .strict();

const knowledgeBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("knowledge"),
    title: nonEmptyText(240),
    content: nonEmptyText(2_000).describe(
      "Chỉ trình bày lý thuyết; không chứa ví dụ/bài tập. Nếu có nhiều ý, mỗi ý phải thành một dòng/đoạn hoặc bullet riêng, không dồn thành paragraph dài.",
    ),
  })
  .strict();

const propertyBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("property"),
    title: nonEmptyText(240),
    content: nonEmptyText(2_000).describe(
      "Chỉ trình bày tính chất; không chứa ví dụ/bài tập. Nếu có nhiều ý, mỗi ý phải thành một dòng/đoạn hoặc bullet riêng, không dồn thành paragraph dài.",
    ),
  })
  .strict();

const procedureBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("procedure"),
    title: nonEmptyText(240),
    purpose: nonEmptyText(2_000)
      .describe("Chỉ nêu mục đích; không chứa ví dụ hoặc đề bài.")
      .nullable(),
    steps: z
      .array(
        z
          .object({
            order: z.number().int().positive(),
            content: nonEmptyText(2_000).describe(
              "Chỉ nêu thao tác; không chứa ví dụ, chẳng hạn hoặc đề bài.",
            ),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

const exampleBlockSchema = z
  .object({
    type: z.literal("example"),
    problem: nonEmptyText(2_000),
    solution: nonEmptyText(5_000).nullable(),
    answer: nonEmptyText(2_000),
    geometryStatement: lessonSummaryGeometryStatementSchema.optional(),
    visual: lessonSummaryDiagramStructuralVisualSchema.optional(),
    sourceChunkIds: sourceChunkIdsSchema.optional(),
    origin: lessonSummaryExampleOriginSchema.optional(),
    sourceCandidateIds: z.array(nonEmptyText(300)).max(20).optional(),
    sourceAssessment: lessonSummarySourceAssessmentSchema.optional(),
  })
  .strict();

const noteBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("note"),
    content: nonEmptyText(2_000).describe(
      "Ghi chú phải chứa một ví dụ ngắn được mở đầu bằng Ví dụ: hoặc Chẳng hạn:. Không bắt đầu content bằng Chú ý:, Lưu ý: hoặc Nhận xét: vì giao diện đã hiển thị nhãn khối.",
    ),
  })
  .strict();

const theoremBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("theorem"),
    title: nonEmptyText(240),
    content: nonEmptyText(2_000).describe(
      "Chỉ trình bày định lí; không chứa ví dụ/bài tập. Nếu có nhiều ý, mỗi ý phải thành một dòng/đoạn hoặc bullet riêng, không dồn thành paragraph dài.",
    ),
  })
  .strict();

const comparisonBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("comparison"),
    title: nonEmptyText(240),
    columns: z.array(nonEmptyText(240)).min(1),
    rows: z.array(z.array(z.string().trim().max(2_000))).min(1),
  })
  .strict();

const dataTableBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("data_table"),
    title: nonEmptyText(240),
    columns: z.array(nonEmptyText(240)).min(1),
    rows: z.array(z.array(z.string().trim().max(2_000))).min(1),
    note: z.string().nullable(),
  })
  .strict();

const applicationBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("application"),
    title: nonEmptyText(240),
    context: nonEmptyText(2_000),
    knowledgeUsed: z.array(nonEmptyText(240)).nullable(),
    content: nonEmptyText(2_000),
  })
  .strict();

const sectionRecapBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("section_recap"),
    title: nonEmptyText(240),
    points: z.array(nonEmptyText(2_000)).min(1),
  })
  .strict();

export const lessonSummaryReviewIssueResolutionSchema = z.enum([
  "ACCEPT_OR_FIX",
  "FIX_ONLY",
]);

export type LessonSummaryReviewIssueResolution = z.infer<
  typeof lessonSummaryReviewIssueResolutionSchema
>;

const FIX_ONLY_LESSON_SUMMARY_ISSUE_CODES = new Set([
  "BLOCK_CANNOT_PROCESS",
  "BLOCK_SCHEMA_INVALID",
  "DIAGRAM_CANNOT_RENDER",
  "MISSING_REQUIRED_FIELD",
  "MISSING_SUMMARY_TITLE",
  "MISSING_THEORY_SECTION",
  "MISSING_THEORY_UNIT",
]);

export function resolveLessonSummaryReviewIssueResolution(
  code: string,
): LessonSummaryReviewIssueResolution {
  if (
    FIX_ONLY_LESSON_SUMMARY_ISSUE_CODES.has(code) ||
    code.endsWith("_CANNOT_RENDER") ||
    code.endsWith("_CANNOT_PROCESS")
  ) {
    return "FIX_ONLY";
  }
  return "ACCEPT_OR_FIX";
}

export const lessonSummaryReviewIssueSchema = z
  .object({
    id: nonEmptyText(100),
    code: nonEmptyText(100),
    path: nonEmptyText(500),
    message: nonEmptyText(1_000),
    suggestion: nonEmptyText(1_000),
    technicalDetails: nonEmptyText(2_000).nullable(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    resolution: lessonSummaryReviewIssueResolutionSchema.optional(),
    accepted: z.boolean(),
  })
  .strict();

const reviewIssuesShape = {
  reviewIssues: z.array(lessonSummaryReviewIssueSchema).max(50).optional(),
};

const reviewedKnowledgeBlockSchema = knowledgeBlockSchema.extend(reviewIssuesShape);
const reviewedPropertyBlockSchema = propertyBlockSchema.extend(reviewIssuesShape);
const reviewedProcedureBlockSchema = procedureBlockSchema.extend(reviewIssuesShape);
const reviewedExampleBlockSchema = exampleBlockSchema.extend(reviewIssuesShape);
const reviewedNoteBlockSchema = noteBlockSchema.extend(reviewIssuesShape);
const reviewedTheoremBlockSchema = theoremBlockSchema.extend(reviewIssuesShape);
const reviewedComparisonBlockSchema = comparisonBlockSchema.extend(reviewIssuesShape);
const reviewedDataTableBlockSchema = dataTableBlockSchema.extend(reviewIssuesShape);
const reviewedApplicationBlockSchema = applicationBlockSchema.extend(reviewIssuesShape);
const reviewedSectionRecapBlockSchema = sectionRecapBlockSchema.extend(reviewIssuesShape);

export const lessonSummaryMvpBlockSchema = z.discriminatedUnion("type", [
  reviewedKnowledgeBlockSchema,
  reviewedPropertyBlockSchema,
  reviewedProcedureBlockSchema,
  reviewedExampleBlockSchema,
  reviewedNoteBlockSchema,
  reviewedTheoremBlockSchema,
]);

export const lessonSummaryExtendedBlockSchema = z.discriminatedUnion("type", [
  reviewedKnowledgeBlockSchema,
  reviewedPropertyBlockSchema,
  reviewedProcedureBlockSchema,
  reviewedExampleBlockSchema,
  reviewedNoteBlockSchema,
  reviewedTheoremBlockSchema,
  reviewedComparisonBlockSchema,
  reviewedDataTableBlockSchema,
  reviewedApplicationBlockSchema,
  reviewedSectionRecapBlockSchema,
]);

export type LessonSummaryMvpBlock = z.infer<typeof lessonSummaryMvpBlockSchema>;
export type LessonSummaryExtendedBlock = z.infer<typeof lessonSummaryExtendedBlockSchema>;

/**
 * Provider-only contract. Its shape makes every theory/example pair and the final
 * two application exercises required by JSON Schema before semantic review.
 */
const theoryDiagramSpecSchema = lessonSummaryProviderDiagramInputSchema
  .describe(
    "Nếu bài học thuộc Hình học thì mọi theory block đều bắt buộc có diagramSpec khác null. Với bài không thuộc Hình học, diagramSpec vẫn bắt buộc khi nội dung cần hình để hiểu đúng; các khối về đồ thị, trục số, mặt phẳng tọa độ, bảng, biểu đồ hoặc sơ đồ không được trả null.",
  )
  .nullable();

export const lessonSummaryProviderNoteSchema = noteBlockSchema
  .omit({ visual: true })
  .strict();

export const lessonSummaryTheoryBlockSchema = z.discriminatedUnion("type", [
  knowledgeBlockSchema
    .omit({ visual: true })
    .extend({ diagramSpec: theoryDiagramSpecSchema })
    .strict(),
  propertyBlockSchema
    .omit({ visual: true })
    .extend({ diagramSpec: theoryDiagramSpecSchema })
    .strict(),
  procedureBlockSchema
    .omit({ visual: true })
    .extend({ diagramSpec: theoryDiagramSpecSchema })
    .strict(),
  theoremBlockSchema
    .omit({ visual: true })
    .extend({ diagramSpec: theoryDiagramSpecSchema })
    .strict(),
]);

export function createLessonSummaryProviderExampleSchema(
  exampleKind: "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE",
) {
  const illustrationRequirement =
    exampleKind === "ILLUSTRATION"
      ? " Đây là illustration: đề phải kiểm tra đúng kiến thức trong theory cùng unit; lời giải phải gọi tên và trực tiếp áp dụng chính quy tắc/tính chất đó. Nếu phải dùng một quy tắc khác làm lập luận chính thì đổi đề."
      : "";
  return z
    .object({
      type: z.literal("example"),
      exampleKind: z.literal(exampleKind),
      problem: nonEmptyText(2_000).describe(
        `Chỉ ghi đề bài hoàn chỉnh cuối cùng; không kể quá trình sửa đề hoặc nói kí hiệu nào sai. Không có nhãn hoặc số thứ tự từ tài liệu nguồn như Bài 1.11., Ví dụ 2, Luyện tập 3 hay Vận dụng 1; không có câu xem hình bên. Nếu đề hoặc lời giải cần hình để hiểu đúng thì diagramSpec bắt buộc phải khác null.${illustrationRequirement}`,
      ),
      solution: nonEmptyText(5_000)
        .describe(
          `Lời giải đúng, gọn và theo phong cách trình bày toán học. Riêng chứng minh/dựng hình, viết mạch lập luận liên kết bằng Xét, Ta có, Vì... nên..., Suy ra, Do đó, Vậy; không biến toàn bộ lời giải thành danh sách bullet rời rạc. Với bài tính thuần túy, giữ cách trình bày trực tiếp từng ý và chuỗi biến đổi, không chèn tiêu đề thao tác như Nhóm các số hạng thuận tiện, Đổi về phân số hoặc Áp dụng công thức. Mọi ý a), b), c) phải bắt đầu ở dòng riêng.${illustrationRequirement}`,
        )
        .nullable(),
      answer: nonEmptyText(2_000),
      geometryStatement: lessonSummaryGeometryStatementSchema
        .describe(
          "Bảng giả thiết–kết luận. Chỉ khác null cho bài Hình học lớp 7–9 yêu cầu Chứng minh/Chứng tỏ. hypotheses chỉ chứa dữ kiện có sẵn trong đề, không chứa kết quả suy ra hoặc đường phụ; conclusions ghi đúng điều phải chứng minh. Mọi bài Số học/Đại số, bài Hình học lớp nhỏ và bài Hình học không phải chứng minh chính thức phải trả null.",
        )
        .nullable(),
      diagramSpec: lessonSummaryProviderDiagramInputSchema
        .describe(
          "Một hình minh họa dùng chung cho toàn bộ ví dụ/bài tập. Nếu bài học thuộc Hình học thì mọi example và exercise đều bắt buộc có diagramSpec khác null. Với bài không thuộc Hình học, các bài yêu cầu vẽ, đọc hoặc suy luận từ đồ thị, trục số, mặt phẳng tọa độ, bảng, biểu đồ hoặc sơ đồ cũng bắt buộc khác null.",
        )
        .nullable(),
    })
    .strict();
}

const lessonSummaryIllustrationSchema =
  createLessonSummaryProviderExampleSchema("ILLUSTRATION");
const lessonSummaryStandardExerciseSchema =
  createLessonSummaryProviderExampleSchema("STANDARD_EXERCISE");
const lessonSummaryRealWorldExerciseSchema =
  createLessonSummaryProviderExampleSchema("REAL_WORLD_EXERCISE");

const transportText = (maxLength: number) => z.string().max(maxLength);
const transportSourceChunkIdsSchema = z.array(z.string().max(100)).max(20);
const transportTheoryDiagramSpecSchema =
  lessonSummaryProviderDiagramTransportSchema.nullable();
const transportTheoryBaseShape = {
  sourceChunkIds: transportSourceChunkIdsSchema,
  diagramSpec: transportTheoryDiagramSpecSchema,
};

export const lessonSummaryTheoryBlockTransportSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...transportTheoryBaseShape,
      type: z.literal("knowledge"),
      title: transportText(240),
      content: transportText(2_000),
    })
    .strict(),
  z
    .object({
      ...transportTheoryBaseShape,
      type: z.literal("property"),
      title: transportText(240),
      content: transportText(2_000),
    })
    .strict(),
  z
    .object({
      ...transportTheoryBaseShape,
      type: z.literal("theorem"),
      title: transportText(240),
      content: transportText(2_000),
    })
    .strict(),
  z
    .object({
      ...transportTheoryBaseShape,
      type: z.literal("procedure"),
      title: transportText(240),
      purpose: transportText(2_000).nullable(),
      steps: z
        .array(
          z
            .object({
              order: z.number().int(),
              content: transportText(2_000),
            })
            .strict(),
        )
        .max(20),
    })
    .strict(),
]);

export const lessonSummaryProviderNoteTransportSchema = z
  .object({
    type: z.literal("note"),
    content: transportText(2_000).describe(
      "Nội dung đi thẳng vào ghi chú, không mở đầu bằng Chú ý:, Lưu ý: hoặc Nhận xét:; vẫn phải có một Ví dụ: hoặc Chẳng hạn: ngắn.",
    ),
    sourceChunkIds: transportSourceChunkIdsSchema,
  })
  .strict();

function createLessonSummaryProviderExampleTransportSchema(
  exampleKind: "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE",
) {
  return z
    .object({
      type: z.literal("example"),
      exampleKind: z.literal(exampleKind),
      problem: transportText(2_000),
      solution: transportText(5_000).nullable(),
      answer: transportText(2_000),
      geometryStatement: z
        .object({
          hypotheses: z.array(transportText(1_000)).max(20),
          conclusions: z.array(transportText(1_000)).max(20),
        })
        .strict()
        .nullable()
        .optional(),
      diagramSpec: lessonSummaryProviderDiagramTransportSchema.nullable(),
    })
    .strict();
}

export const lessonSummaryIllustrationTransportSchema =
  createLessonSummaryProviderExampleTransportSchema("ILLUSTRATION");
export const lessonSummaryStandardExerciseTransportSchema =
  createLessonSummaryProviderExampleTransportSchema("STANDARD_EXERCISE");
export const lessonSummaryRealWorldExerciseTransportSchema =
  createLessonSummaryProviderExampleTransportSchema("REAL_WORLD_EXERCISE");

/**
 * Transport contract used for the single paid provider call. It keeps the root
 * ownership structure strict while deferring per-block semantic checks to the
 * recovery mapper, so one local defect cannot discard the whole lesson.
 */
export const lessonSummaryProviderTransportOutputSchema = z
  .object({
    title: transportText(240),
    objectives: z.array(transportText(500)).max(10).nullable(),
    theorySections: z
      .array(
        z
          .object({
            sourceTopicId: transportText(300),
            displayHeading: transportText(240),
            sourceChunkIds: transportSourceChunkIdsSchema,
            units: z
              .array(
                z
                  .object({
                    theory: lessonSummaryTheoryBlockTransportSchema,
                    illustration: lessonSummaryIllustrationTransportSchema,
                    notes: z.array(lessonSummaryProviderNoteTransportSchema).max(5),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .max(19),
    applicationExercises: z
      .object({
        displayHeading: z.literal("Bài tập vận dụng"),
        standardExercise: lessonSummaryStandardExerciseTransportSchema,
        realWorldExercise: lessonSummaryRealWorldExerciseTransportSchema,
      })
      .strict(),
  })
  .strict();

export const lessonSummaryProviderOutputSchema = z
  .object({
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).min(1).max(10).nullable(),
    theorySections: z
      .array(
        z
          .object({
            sourceTopicId: nonEmptyText(300).describe(
              "ID của đề mục gốc trong metadata.sourceTopics.",
            ),
            displayHeading: nonEmptyText(240).describe(
              "Phần chữ của đề mục gốc sau khi AI chủ động sửa lỗi OCR/chính tả; bỏ số thứ tự đầu heading vì UI tự hiển thị số; không đổi ý nghĩa hay tự tạo đề mục mới.",
            ),
            sourceChunkIds: sourceChunkIdsSchema,
            units: z
              .array(
                z
                  .object({
                    theory: lessonSummaryTheoryBlockSchema,
                    illustration: lessonSummaryIllustrationSchema.describe(
                      "Ví dụ phải minh họa trực tiếp đúng theory trong cùng unit. Lời giải phải gọi tên và áp dụng chính quy tắc/tính chất của theory đó; ví dụ không hợp lệ nếu lập luận chính dùng kiến thức của unit khác.",
                    ),
                    notes: z.array(lessonSummaryProviderNoteSchema).max(5),
                  })
                  .strict(),
              )
              .min(1)
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(19),
    applicationExercises: z
      .object({
        displayHeading: z.literal("Bài tập vận dụng"),
        standardExercise: lessonSummaryStandardExerciseSchema,
        realWorldExercise: lessonSummaryRealWorldExerciseSchema,
      })
      .strict(),
  })
  .strict();

export type LessonSummaryProviderOutput = z.infer<
  typeof lessonSummaryProviderOutputSchema
>;

export type LessonSummaryProviderTransportOutput = z.infer<
  typeof lessonSummaryProviderTransportOutputSchema
>;

export const lessonSummaryWarningDetailSchema = z
  .object({
    code: nonEmptyText(100),
    path: nonEmptyText(500),
    message: nonEmptyText(1_000),
    severity: z.enum(["INFO", "WARNING"]),
  })
  .strict();

export type LessonSummaryWarningDetail = z.infer<typeof lessonSummaryWarningDetailSchema>;

/** Persisted/API-compatible flat section/block contract. */
export const lessonSummaryOutputSchema = z
  .object({
    lessonId: nonEmptyText(240),
    targetGrade: z.number().int().min(1).max(12).nullable().optional(),
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).min(1).max(10).nullable(),
    sections: z
      .array(
        z
          .object({
            order: z.number().int().positive(),
            sourceHeading: nonEmptyText(500),
            displayHeading: nonEmptyText(240),
            headingDecision: z.enum(["EXACT", "OCR_REPAIRED"]).optional(),
            headingRepairReason: nonEmptyText(1_000).nullable().optional(),
            sourceAssessment: lessonSummarySourceAssessmentSchema.optional(),
            sourceChunkIds: sourceChunkIdsSchema,
            blocks: z.array(lessonSummaryMvpBlockSchema).min(1),
          })
          .strict(),
      )
      .min(2)
      .max(20),
    warnings: z.array(nonEmptyText(1_000)).nullable().optional(),
    warningDetails: z
      .array(lessonSummaryWarningDetailSchema)
      .max(100)
      .nullable()
      .optional(),
    reviewIssues: z.array(lessonSummaryReviewIssueSchema).max(100).optional(),
  })
  .strict();

export const lessonSummaryJobInputSchema = z
  .object({
    documentIds: z.array(z.uuid()).min(1).max(20),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    targetGrade: z.number().int().min(1).max(12).nullable().default(null),
    style: lessonSummaryStyleSchema,
    styleInstructions: z.string().trim().max(1_000).default(""),
    length: lessonSummaryLengthSchema.default("standard"),
    targetWordCount: z.number().int().min(50).max(5_000).nullable().default(null),
    extraInstructions: z.string().trim().max(2_000).default(""),
    systemInstructions: z
      .string()
      .trim()
      .max(LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS)
      .default(""),
    userPrompt: z.string().trim().max(16_000).default(""),
    model: z.string().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z.enum(AI_REASONING_EFFORT_LEVELS).optional(),
    schemaReferenceStrategy: z.enum(["inline", "ref"]).default("inline"),
    maxOutputTokens: z
      .number()
      .int()
      .min(500)
      .max(LESSON_SUMMARY_MAX_CONFIGURED_OUTPUT_TOKENS)
      .optional(),
  })
  .strict();

export type LessonSummaryOutput = z.infer<typeof lessonSummaryOutputSchema>;
export type LessonSummaryJobInput = z.infer<typeof lessonSummaryJobInputSchema>;
