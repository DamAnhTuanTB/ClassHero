import { z } from "zod";
import { tiptapContentSchema } from "../../../common/validation/zod-schemas/tiptap.schema";

/**
 * Lựa chọn (Option) cho câu hỏi Multiple Choice.
 * Mỗi option bắt buộc có một `id` (e.g., "A", "B", "opt_123") và một `richText` (Tiptap Content).
 */
export const quizOptionSchema = z.object({
  id: z.string().min(1, "Option ID không được để trống"),
  richText: tiptapContentSchema,
});

/**
 * Options Json (dùng cho mảng các options của Multiple Choice)
 */
export const multipleChoiceOptionsSchema = z.array(quizOptionSchema).min(2, "Phải có ít nhất 2 options");

/**
 * Grading Config (Cấu hình chấm điểm) cho TEXT_INPUT
 */
export const textInputGradingSchema = z.object({
  caseSensitive: z.boolean().default(false),
  exactMatch: z.boolean().default(true),
  // Nếu không exactMatch thì có thể kiểm tra chứa danh sách keywords nào đó
  keywords: z.array(z.string()).optional(),
});

/**
 * Cấu trúc chung cho Correct Answer tùy theo loại câu hỏi
 * - MULTIPLE_CHOICE: mảng chứa ID của các options đúng.
 * - TRUE_FALSE: boolean.
 * - TEXT_INPUT: mảng các câu trả lời dạng text hợp lệ (e.g. ["25", "hai mươi lăm"]).
 */
export const correctAnswerSchema = z.union([
  z.array(z.string()).min(1, "Cần chọn ít nhất 1 đáp án đúng cho Multiple Choice"), // For MULTIPLE_CHOICE & TEXT_INPUT
  z.boolean(), // For TRUE_FALSE
]);

export type QuizOption = z.infer<typeof quizOptionSchema>;
export type TextInputGradingConfig = z.infer<typeof textInputGradingSchema>;
export type QuizCorrectAnswer = z.infer<typeof correctAnswerSchema>;
