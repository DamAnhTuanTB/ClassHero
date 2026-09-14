import {
  LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION,
  type AiReasoningEffort,
} from "@learning-path/shared";
import { Difficulty } from "@prisma/client";
import { z } from "zod";

export const FLASHCARD_SUBJECT_KEYS = [
  "MATH",
  "PHYSICS",
  "CHEMISTRY",
  "GENERAL",
] as const;

export const flashcardSubjectKeySchema = z.enum(FLASHCARD_SUBJECT_KEYS);
export type FlashcardSubjectKey = z.infer<typeof flashcardSubjectKeySchema>;

export interface FlashcardSubjectSnapshot {
  key: FlashcardSubjectKey;
  name: string;
  slug: string;
}

export const FLASHCARD_SCHEMA_VERSION = "flashcard_v13-quiz-style-solutions";
export const FLASHCARD_PROMPT_VERSIONS: Record<FlashcardSubjectKey, string> = {
  MATH: "flashcard_math_v14-quiz-style-solutions",
  PHYSICS: "flashcard_physics_v13-quiz-style-solutions",
  CHEMISTRY: "flashcard_chemistry_v13-quiz-style-solutions",
  GENERAL: "flashcard_general_v13-quiz-style-solutions",
};
export const FLASHCARD_MIN_OUTPUT_TOKENS = 1_000;
export const FLASHCARD_MAX_OUTPUT_TOKENS = 32_000;
export const FLASHCARD_MAX_CONTEXT_TOKENS = 24_000;

const learnerText = (max: number, description: string) =>
  z.string().trim().min(1).max(max).describe(description);

export const generatedFlashcardOutputSchema = z
  .object({
    title: learnerText(180, "Tên ngắn của bộ Flashcard."),
    cards: z
      .array(
        z
          .object({
            difficulty: z.enum([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]),
            front: learnerText(
              1_500,
              "Câu hỏi ngắn, đơn nghĩa, tự đủ bằng text, không lộ đáp án và chỉ kiểm tra ghi nhớ/hiểu lý thuyết. Được hỏi trực tiếp hằng số hoặc kết quả cần nhớ của một tính chất; không cho dữ kiện riêng để tính toán, giải bài, chứng minh, dựng/vẽ, xử lý cấu hình riêng hoặc tham chiếu hình nguồn.",
            ),
            back: learnerText(
              3_000,
              "Đáp án trực tiếp, ngắn gọn và chính xác cho câu hỏi ở mặt trước.",
            ),
            solution: learnerText(
              10_000,
              "Lời giải đầy đủ, trực tiếp cho `front`: nêu căn cứ và điều kiện, trình bày đủ các mắt xích cần thiết rồi kết luận nhất quán với `back`; không lấy `back` làm tiền đề hoặc diễn giải lại `back`.",
            ),
            sourcePacketPageNumbers: z
              .array(z.number().int().positive())
              .min(1)
              .max(20)
              .describe(
                "Các số trang trong packet PDF trực tiếp chứng minh nội dung thẻ.",
              ),
            requiresSolutionFigure: z
              .boolean()
              .describe(
                "True chỉ khi sơ đồ lý thuyết thực sự giúp hiểu cấu trúc hoặc quan hệ kiến thức; không dùng hình để giải bài hay cấu hình riêng.",
              ),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict()
  .describe(
    `Bộ Flashcard và mọi nội dung học sinh nhìn thấy. ${LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION}`,
  );

export const flashcardGenerationJobInputSchema = z
  .object({
    requestDraftId: z.string().uuid(),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    documentIds: z.array(z.string().uuid()).min(1).max(20),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    targetGrade: z.number().int().min(1).max(12).nullable(),
    subjectKey: flashcardSubjectKeySchema,
    subjectName: z.string().trim().min(1).max(120),
    subjectSlug: z.string().trim().min(1).max(140),
    targetFlashcardSetId: z.string().uuid(),
    cardCount: z.number().int().min(1).max(60),
    realWorldCardCount: z.number().int().min(0).max(60).optional(),
    difficulty: z.nativeEnum(Difficulty),
    difficultyCounts: z
      .object({
        easy: z.number().int(),
        medium: z.number().int(),
        hard: z.number().int(),
      })
      .strict()
      .nullable(),
    style: z.enum(["student_friendly", "concise", "academic"]),
    styleInstructions: z.string().max(1_000),
    extraInstructions: z.string().max(2_000),
    systemInstructions: z.string().max(64_000),
    userPrompt: z.string().max(16_000),
    model: z.string().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z
      .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"])
      .optional(),
    maxOutputTokens: z.number().int().min(FLASHCARD_MIN_OUTPUT_TOKENS).max(32_000),
    schemaReferenceStrategy: z.literal("ref_v2"),
    promptCacheKeyEnabled: z.boolean(),
    promptCacheRetention: z.enum(["in_memory", "24h"]),
  })
  .strict();

export type FlashcardGenerationJobInput = z.infer<
  typeof flashcardGenerationJobInputSchema
>;
export type GeneratedFlashcardOutput = z.infer<typeof generatedFlashcardOutputSchema>;

export interface QueueFlashcardGenerationInput {
  requestDraftId?: string;
  requestHash?: string;
  targetFlashcardSetId?: string;
  documentIds?: string[];
  cardCount: number;
  realWorldCardCount?: number;
  difficulty: Difficulty;
  difficultyCounts?: { easy: number; medium: number; hard: number };
  style?: "student_friendly" | "concise" | "academic";
  styleInstructions?: string;
  extraInstructions?: string;
  systemInstructions?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  maxOutputTokens?: number;
  figureModel?: string;
  figureTemperature?: number;
  figureReasoningEffort?: AiReasoningEffort;
  figureMaxOutputTokens?: number;
}
