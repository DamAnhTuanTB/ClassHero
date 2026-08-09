import { z } from "zod";

export const LESSON_SUMMARY_PROMPT_VERSION = "lesson-summary-prompt-v22";
export const LESSON_SUMMARY_SCHEMA_VERSION = "lesson-summary-schema-v19";
export const LESSON_SUMMARY_MAX_CONTEXT_TOKENS = 12_000;
export const LESSON_SUMMARY_MAX_OUTPUT_TOKENS = 6_000;
export const LESSON_SUMMARY_MIN_OUTPUT_TOKENS = 6_000;
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
});

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

const exampleBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("example"),
    problem: nonEmptyText(2_000),
    solution: nonEmptyText(5_000).nullable(),
    answer: nonEmptyText(2_000),
  })
  .strict();

const noteBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("note"),
    content: nonEmptyText(2_000).describe(
      "Ghi chú phải chứa một ví dụ ngắn được mở đầu bằng Ví dụ: hoặc Chẳng hạn:.",
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

export const lessonSummaryMvpBlockSchema = z.discriminatedUnion("type", [
  knowledgeBlockSchema,
  propertyBlockSchema,
  procedureBlockSchema,
  exampleBlockSchema,
  noteBlockSchema,
  theoremBlockSchema,
]);

export const lessonSummaryExtendedBlockSchema = z.discriminatedUnion("type", [
  knowledgeBlockSchema,
  propertyBlockSchema,
  procedureBlockSchema,
  exampleBlockSchema,
  noteBlockSchema,
  theoremBlockSchema,
  comparisonBlockSchema,
  dataTableBlockSchema,
  applicationBlockSchema,
  sectionRecapBlockSchema,
]);

export type LessonSummaryMvpBlock = z.infer<typeof lessonSummaryMvpBlockSchema>;
export type LessonSummaryExtendedBlock = z.infer<typeof lessonSummaryExtendedBlockSchema>;

/**
 * Provider-only contract. Its shape makes every theory/example pair and the final
 * two application exercises required by JSON Schema before semantic review.
 */
const lessonSummaryTheoryBlockSchema = z.discriminatedUnion("type", [
  knowledgeBlockSchema,
  propertyBlockSchema,
  procedureBlockSchema,
  theoremBlockSchema,
]);

const lessonSummaryIllustrationSchema = z
  .object({
    type: z.literal("example"),
    exampleKind: z.literal("ILLUSTRATION"),
    sourceCandidateId: nonEmptyText(300).describe(
      "ID duy nhất của source candidate minh họa trực tiếp cho theory; không được trùng bất kỳ candidate nào khác trong output.",
    ),
    alignment: nonEmptyText(500).describe(
      "Một câu giải thích candidate liên hệ trực tiếp với kiến thức nào trong theory cùng unit; chỉ dùng để backend/validator kiểm tra và không hiển thị cho học sinh.",
    ),
    verification: nonEmptyText(1_000).describe(
      "Kiểm tra độc lập rằng lời giải đã giải xong đúng đề, không dùng kiến thức chưa xuất hiện ở vị trí BEFORE và không mâu thuẫn với theory cùng unit; backend không hiển thị field này.",
    ),
    solution: nonEmptyText(5_000).nullable(),
    answer: nonEmptyText(2_000),
  })
  .strict();

const lessonSummaryStandardExerciseSchema = z
  .object({
    type: z.literal("example"),
    exampleKind: z.literal("STANDARD_EXERCISE"),
    sourceCandidateId: nonEmptyText(300).describe(
      "ID duy nhất của source candidate là bài tập thông thường; không dùng candidate có kindHint REAL_WORLD_EXERCISE và không trùng candidate khác.",
    ),
    solution: nonEmptyText(5_000).nullable(),
    answer: nonEmptyText(2_000),
    verification: nonEmptyText(1_000).describe(
      "Kiểm tra độc lập rằng solution giữ nguyên dữ kiện và answer đúng; backend không hiển thị field này.",
    ),
  })
  .strict();

const lessonSummaryRealWorldExerciseSchema = z
  .object({
    type: z.literal("example"),
    exampleKind: z.literal("REAL_WORLD_EXERCISE"),
    sourceCandidateId: nonEmptyText(300).describe(
      "ID duy nhất của source candidate có kindHint REAL_WORLD_EXERCISE; không trùng candidate khác.",
    ),
    solution: nonEmptyText(5_000).nullable(),
    answer: nonEmptyText(2_000),
    verification: nonEmptyText(1_000).describe(
      "Kiểm tra độc lập rằng solution giữ nguyên dữ kiện và answer đúng; backend không hiển thị field này.",
    ),
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
              "ID duy nhất trong metadata.sourceTopics; mỗi source topic bắt buộc xuất hiện đúng một lần và số units không vượt relatedCandidateIds của topic.",
            ),
            displayHeading: nonEmptyText(240),
            sourceChunkIds: sourceChunkIdsSchema,
            units: z
              .array(
                z
                  .object({
                    theory: lessonSummaryTheoryBlockSchema,
                    illustration: lessonSummaryIllustrationSchema,
                    illustrationPlacement: z
                      .enum(["BEFORE_THEORY", "AFTER_THEORY"])
                      .describe(
                        "Đặt BEFORE_THEORY khi candidate là hoạt động khám phá dẫn tới theory; dùng AFTER_THEORY khi candidate áp dụng theory đã nêu. Hai block luôn phải liền kề.",
                      ),
                    notes: z.array(noteBlockSchema).max(5),
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
        sourceHeading: nonEmptyText(500),
        displayHeading: z.literal("Bài tập vận dụng"),
        sourceChunkIds: sourceChunkIdsSchema,
        standardExercise: lessonSummaryStandardExerciseSchema,
        realWorldExercise: lessonSummaryRealWorldExerciseSchema,
      })
      .strict(),
    warnings: z.array(nonEmptyText(1_000)).max(10).nullable(),
  })
  .strict();

export type LessonSummaryProviderOutput = z.infer<
  typeof lessonSummaryProviderOutputSchema
>;

/** Persisted/API-compatible flat section/block contract. */
export const lessonSummaryOutputSchema = z
  .object({
    lessonId: nonEmptyText(240),
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).min(1).max(10).nullable(),
    sections: z
      .array(
        z
          .object({
            order: z.number().int().positive(),
            sourceHeading: nonEmptyText(500),
            displayHeading: nonEmptyText(240),
            sourceChunkIds: sourceChunkIdsSchema,
            blocks: z.array(lessonSummaryMvpBlockSchema).min(1),
          })
          .strict(),
      )
      .min(2)
      .max(20),
    warnings: z.array(nonEmptyText(1_000)).nullable(),
  })
  .strict();

export const lessonSummaryJobInputSchema = z
  .object({
    documentIds: z.array(z.uuid()).min(1).max(20),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    style: lessonSummaryStyleSchema,
    styleInstructions: z.string().trim().max(1_000).default(""),
    length: lessonSummaryLengthSchema.default("standard"),
    targetWordCount: z.number().int().min(50).max(5_000).nullable().default(null),
    extraInstructions: z.string().trim().max(2_000).default(""),
    systemInstructions: z.string().trim().max(12_000).default(""),
    userPrompt: z.string().trim().max(16_000).default(""),
    model: z.string().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
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
