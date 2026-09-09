import { z } from "zod";

export const providerUsageTargetContextSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum([
      "LESSON_SUMMARY",
      "SUMMARY_BLOCK",
      "QUIZ_SET",
      "QUIZ_QUESTION",
      "FLASHCARD_SET",
      "FLASHCARD_CARD",
      "TEST_SET",
      "TEST_QUESTION",
      "EXPLANATION",
      "CHAT_THREAD",
      "EMBEDDING_SOURCE",
      "SOURCE_DOCUMENT",
      "DIAGRAM",
    ]),
    entityId: z.string().uuid().nullable().optional(),
    itemOrdinal: z.number().int().positive().nullable().optional(),
    sectionOrdinal: z.number().int().positive().nullable().optional(),
    blockOrdinal: z.number().int().positive().nullable().optional(),
    blockKind: z
      .enum(["THEORY", "NOTE", "EXAMPLE", "EXERCISE", "OTHER"])
      .nullable()
      .optional(),
    figureRole: z.enum(["QUESTION", "SOLUTION", "ILLUSTRATION"]).nullable().optional(),
  })
  .strict();

export type ProviderUsageTargetContext = z.infer<
  typeof providerUsageTargetContextSchema
>;
