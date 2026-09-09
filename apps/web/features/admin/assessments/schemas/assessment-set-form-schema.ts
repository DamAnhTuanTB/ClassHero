import { z } from "zod";
import { requiredTrimmedText } from "@/lib/form-validation";

export const assessmentSetFormSchema = z.object({
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên bộ câu hỏi",
    maxLength: 180,
    maxMessage: "Tên bộ câu hỏi tối đa 180 ký tự",
  }),
  durationMinutes: z.string().optional(),
});

export type AssessmentSetFormValues = z.infer<typeof assessmentSetFormSchema>;

export function createAssessmentSetFormSchema(kind: "quiz" | "test") {
  return kind === "test"
    ? assessmentSetFormSchema.extend({
        durationMinutes: z
          .string()
          .trim()
          .min(1, "Nhập thời gian làm bài")
          .refine((value) => /^\d+$/u.test(value), "Thời gian phải là số phút")
          .refine((value) => Number(value) >= 1, "Thời gian tối thiểu 1 phút")
          .refine((value) => Number(value) <= 240, "Thời gian tối đa 240 phút"),
      })
    : assessmentSetFormSchema;
}
