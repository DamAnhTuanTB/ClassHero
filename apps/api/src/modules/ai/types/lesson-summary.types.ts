import { z } from "zod";

export const LESSON_SUMMARY_PROMPT_VERSION = "lesson-summary-prompt-v10";
export const LESSON_SUMMARY_SCHEMA_VERSION = "lesson-summary-schema-v8";
export const LESSON_SUMMARY_MAX_CONTEXT_TOKENS = 12_000;
export const LESSON_SUMMARY_MAX_OUTPUT_TOKENS = 2_000;
export const LESSON_SUMMARY_MIN_OUTPUT_TOKENS = 500;
export const LESSON_SUMMARY_MAX_CONFIGURED_OUTPUT_TOKENS = 32_000;

export const lessonSummaryStyleSchema = z.enum([
  "student_friendly",
  "concise",
  "academic",
]);
export const lessonSummaryLengthSchema = z.enum(["short", "standard", "detailed"]);
// Removed lessonSummaryContentSectionSchema

const nonEmptyText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

// --- BLOCK SCHEMAS ---
const baseBlockSchema = z.object({
  sourceChunkIds: z.array(z.string()).min(1),
});

const knowledgeBlockSchema = baseBlockSchema.extend({
  type: z.literal("knowledge"),
  title: nonEmptyText(240),
  content: nonEmptyText(2000),
}).strict();



const propertyBlockSchema = baseBlockSchema.extend({
  type: z.literal("property"),
  title: nonEmptyText(240),
  content: nonEmptyText(2000),
}).strict();

const procedureBlockSchema = baseBlockSchema.extend({
  type: z.literal("procedure"),
  title: nonEmptyText(240),
  purpose: nonEmptyText(2000).nullable(),
  steps: z.array(z.object({
    order: z.number().int(),
    content: nonEmptyText(2000),
  }).strict()).min(1),
}).strict();

const exampleBlockSchema = baseBlockSchema.extend({
  type: z.literal("example"),
  problem: nonEmptyText(2000),
  solution: nonEmptyText(5000).nullable(),
  answer: nonEmptyText(2000),
}).strict();

const noteBlockSchema = baseBlockSchema.extend({
  type: z.literal("note"),
  content: nonEmptyText(2000),
}).strict();

const theoremBlockSchema = baseBlockSchema.extend({
  type: z.literal("theorem"),
  title: nonEmptyText(240),
  content: nonEmptyText(2000),
}).strict();




const comparisonBlockSchema = baseBlockSchema.extend({
  type: z.literal("comparison"),
  title: nonEmptyText(240),
  columns: z.array(nonEmptyText(240)).min(1),
  rows: z.array(z.array(z.string().trim().max(2000))).min(1),
}).strict();

const dataTableBlockSchema = baseBlockSchema.extend({
  type: z.literal("data_table"),
  title: nonEmptyText(240),
  columns: z.array(nonEmptyText(240)).min(1),
  rows: z.array(z.array(z.string().trim().max(2000))).min(1),
  note: z.string().nullable(),
}).strict();

const applicationBlockSchema = baseBlockSchema.extend({
  type: z.literal("application"),
  title: nonEmptyText(240),
  context: nonEmptyText(2000),
  knowledgeUsed: z.array(nonEmptyText(240)).nullable(),
  content: nonEmptyText(2000),
}).strict();

const sectionRecapBlockSchema = baseBlockSchema.extend({
  type: z.literal("section_recap"),
  title: nonEmptyText(240),
  points: z.array(nonEmptyText(2000)).min(1),
}).strict();

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

// --- MAIN OUTPUT SCHEMA ---
export const lessonSummaryOutputSchema = z
  .object({
    lessonId: z.string().nullable(),
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).max(10).nullable(),
    sections: z
      .array(
        z
          .object({
            order: z.number().int(),
            sourceHeading: nonEmptyText(500),
            displayHeading: nonEmptyText(240),
            sourceChunkIds: z.array(z.string()).min(1),
            blocks: z.array(lessonSummaryMvpBlockSchema),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    warnings: z.array(nonEmptyText(1000)).nullable(),
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
    maxOutputTokens: z.number().int().min(500).max(32_000).optional(),
  })
  .strict();

export type LessonSummaryOutput = z.infer<typeof lessonSummaryOutputSchema>;
export type LessonSummaryJobInput = z.infer<typeof lessonSummaryJobInputSchema>;
