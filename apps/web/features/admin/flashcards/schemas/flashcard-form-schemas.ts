import { z } from "zod";
import { tiptapTextDocumentSchema } from "@learning-path/shared";
import { requiredTrimmedText } from "@/lib/form-validation";
import { hasTiptapDocumentContent } from "@/lib/tiptap-rich-content";

export const flashcardSetFormSchema = z.object({
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên bộ flashcard",
    maxLength: 180,
    maxMessage: "Tên bộ flashcard tối đa 180 ký tự",
  }),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]),
});

export const flashcardFormSchema = z.object({
  frontJson: tiptapTextDocumentSchema.refine(
    hasTiptapDocumentContent,
    "Nhập nội dung mặt trước",
  ),
  backJson: tiptapTextDocumentSchema.refine(
    hasTiptapDocumentContent,
    "Nhập nội dung mặt sau",
  ),
  explanationJson: tiptapTextDocumentSchema,
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
});

export type FlashcardSetFormValues = z.infer<typeof flashcardSetFormSchema>;
export type FlashcardFormValues = z.infer<typeof flashcardFormSchema>;
