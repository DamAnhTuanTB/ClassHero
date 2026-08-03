import { z } from "zod";

export const LESSON_SUMMARY_PROMPT_VERSION = "lesson-summary-prompt-v1";
export const LESSON_SUMMARY_SCHEMA_VERSION = "lesson-summary-schema-v1";
export const LESSON_SUMMARY_MAX_CONTEXT_TOKENS = 12_000;
export const LESSON_SUMMARY_MAX_OUTPUT_TOKENS = 2_000;

const nonEmptyText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

export const lessonSummaryOutputSchema = z
  .object({
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).min(1).max(10),
    sections: z
      .array(
        z
          .object({
            heading: nonEmptyText(240),
            content: nonEmptyText(4_000),
            keyFormulas: z.array(nonEmptyText(500)).max(12),
            examples: z.array(nonEmptyText(1_500)).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    commonMistakes: z.array(nonEmptyText(1_000)).max(10),
    reviewQuestions: z.array(nonEmptyText(1_000)).min(1).max(10),
  })
  .strict();

export const lessonSummaryJobInputSchema = z
  .object({
    documentIds: z.array(z.uuid()).min(1).max(20),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    style: z.literal("student_friendly"),
  })
  .strict();

export type LessonSummaryOutput = z.infer<typeof lessonSummaryOutputSchema>;
export type LessonSummaryJobInput = z.infer<typeof lessonSummaryJobInputSchema>;
