import { z } from "zod";
import { requiredTrimmedText } from "@/lib/form-validation";

export const quizSetFormSchema = z.object({
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên bộ câu hỏi",
    maxLength: 180,
    maxMessage: "Tên bộ câu hỏi tối đa 180 ký tự",
  }),
});

export type QuizSetFormValues = z.infer<typeof quizSetFormSchema>;
