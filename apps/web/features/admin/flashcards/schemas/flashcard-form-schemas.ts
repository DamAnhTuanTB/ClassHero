import { z } from "zod";
import { requiredTrimmedText } from "@/lib/form-validation";
import { hasTiptapDocumentContent } from "@/lib/tiptap-rich-content";
import type { TiptapTextDocument } from "@/types/rich-text";

const tiptapDocumentSchema = z.custom<TiptapTextDocument>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "doc",
  "Nội dung rich text chưa hợp lệ",
);

export const flashcardSetFormSchema = z.object({
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên bộ flashcard",
    maxLength: 180,
    maxMessage: "Tên bộ flashcard tối đa 180 ký tự",
  }),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]),
});

export const flashcardFormSchema = z.object({
  frontJson: tiptapDocumentSchema.refine(
    hasTiptapDocumentContent,
    "Nhập nội dung mặt trước",
  ),
  backJson: tiptapDocumentSchema.refine(
    hasTiptapDocumentContent,
    "Nhập nội dung mặt sau",
  ),
  explanationJson: tiptapDocumentSchema,
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
});

export type FlashcardSetFormValues = z.infer<typeof flashcardSetFormSchema>;
export type FlashcardFormValues = z.infer<typeof flashcardFormSchema>;
