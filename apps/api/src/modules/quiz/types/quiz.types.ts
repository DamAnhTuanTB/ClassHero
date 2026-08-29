import { z } from "zod";
import { tiptapContentSchema } from "@learning-path/shared";

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
export const multipleChoiceOptionsSchema = z
  .array(quizOptionSchema)
  .min(2, "Phải có ít nhất 2 options");

/**
 * Mệnh đề của câu Đúng/Sai nhiều mệnh đề dùng cùng shape rich content với
 * phương án trắc nghiệm, nhưng giữ semantic và validation riêng.
 */
export const multiStatementOptionsSchema = z
  .array(quizOptionSchema)
  .min(2, "Phải có ít nhất 2 mệnh đề");

export const multiStatementAnswerSchema = z.object({
  statementId: z.string().min(1, "Mã mệnh đề không được để trống"),
  value: z.boolean(),
});

export const multiStatementCorrectAnswerSchema = z
  .array(multiStatementAnswerSchema)
  .min(2, "Phải có đáp án cho ít nhất 2 mệnh đề");

/**
 * Cấu hình legacy cho TEXT_INPUT. Bộ chấm hiện tại không dùng các cờ này;
 * schema chỉ giữ để tương thích payload/dữ liệu cũ.
 */
export const textInputGradingSchema = z.object({
  caseSensitive: z.boolean().default(false),
  exactMatch: z.boolean().default(true),
  numericComparison: z.boolean().default(false),
  // Nếu không exactMatch thì có thể kiểm tra chứa danh sách keywords nào đó
  keywords: z.array(z.string()).optional(),
});

export const textInputCorrectAnswerSchema = z
  .array(z.string().trim().min(1, "Đáp án chuẩn không được để trống"))
  .length(1, "Câu nhập đáp án phải có đúng một đáp án chuẩn");

/**
 * Cấu trúc chung cho Correct Answer tùy theo loại câu hỏi
 * - MULTIPLE_CHOICE: mảng chứa đúng một ID phương án đúng (service enforce length=1).
 * - TRUE_FALSE: boolean.
 * - MULTI_STATEMENT_TRUE_FALSE: mảng ánh xạ statementId -> boolean.
 * - TEXT_INPUT: mảng chứa đúng một đáp án canonical (service enforce bằng
 *   textInputCorrectAnswerSchema).
 */
export const correctAnswerSchema = z.union([
  z.array(z.string()).min(1, "Cần chọn ít nhất 1 đáp án đúng cho Multiple Choice"), // For MULTIPLE_CHOICE & TEXT_INPUT
  z.boolean(), // For TRUE_FALSE
  multiStatementCorrectAnswerSchema,
]);

export type QuizOption = z.infer<typeof quizOptionSchema>;
export type MultiStatementAnswer = z.infer<typeof multiStatementAnswerSchema>;
export type TextInputGradingConfig = z.infer<typeof textInputGradingSchema>;
export type QuizCorrectAnswer = z.infer<typeof correctAnswerSchema>;
