import { z } from "zod";
import { requiredTrimmedText } from "@/lib/form-validation";

export const testSetFormSchema = z.object({
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên bộ đề",
    maxLength: 180,
    maxMessage: "Tên bộ đề tối đa 180 ký tự",
  }),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]),
  durationMinutes: z
    .string()
    .trim()
    .min(1, "Nhập thời gian làm bài")
    .refine((value) => /^\d+$/u.test(value), "Thời gian phải là số phút")
    .refine((value) => Number(value) >= 1, "Thời gian tối thiểu 1 phút")
    .refine((value) => Number(value) <= 240, "Thời gian tối đa 240 phút"),
});

export type TestSetFormValues = z.infer<typeof testSetFormSchema>;
