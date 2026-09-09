import { AI_REASONING_EFFORT_LEVELS } from "@learning-path/shared";
import { z } from "zod";

const numericText = (label: string, min: number, max: number) =>
  z.string().min(1, `Nhập ${label.toLowerCase()}`).regex(/^\d+$/, `${label} phải là số nguyên`).refine(
    (value) => Number(value) >= min && Number(value) <= max,
    { message: `${label} phải từ ${min} đến ${max}` },
  );

const optionalNumber = (label: string, min: number, max: number, decimal = false) =>
  z.string().refine(
    (value) =>
      value === "" ||
      (decimal ? /^\d+(?:\.\d{0,2})?$/.test(value) : /^\d+$/.test(value)),
    `${label} phải là ${decimal ? "số" : "số nguyên"}`,
  ).refine(
    (value) => value === "" || (Number(value) >= min && Number(value) <= max),
    `${label} phải từ ${min} đến ${max}`,
  );

export const adminFlashcardGenerationSchema = z.object({
  targetFlashcardSetId: z.union([z.literal(""), z.string().uuid("Bộ Flashcard không hợp lệ")]),
  documentIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất một tài liệu").max(20),
  cardCount: numericText("Số thẻ ghi nhớ", 1, 60),
  realWorldCount: optionalNumber("Số thẻ thực tế", 0, 60),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]),
  easyCount: numericText("Số thẻ dễ", 0, 60),
  mediumCount: numericText("Số thẻ trung bình", 0, 60),
  hardCount: numericText("Số thẻ khó", 0, 60),
  style: z.enum(["student_friendly", "concise", "academic"]),
  styleInstructions: z.string().trim().min(1, "Nhập cách trình bày").max(1_000),
  extraInstructions: z.string().trim().max(2_000),
  systemInstructions: z.string().max(64_000),
  userPrompt: z.string().max(16_000),
  model: z.string().max(200),
  temperature: optionalNumber("Temperature", 0, 1, true),
  reasoningEffort: z.union([z.literal(""), z.enum(AI_REASONING_EFFORT_LEVELS)]),
  maxOutputTokens: optionalNumber("Số token đầu ra", 1_000, 32_000),
  figureModel: z.string().max(200),
  figureTemperature: optionalNumber("Temperature tạo hình", 0, 1, true),
  figureReasoningEffort: z.union([z.literal(""), z.enum(AI_REASONING_EFFORT_LEVELS)]),
  figureMaxOutputTokens: optionalNumber("Số token đầu ra tạo hình", 128, 32_000),
}).superRefine((values, context) => {
  if (values.model && !values.maxOutputTokens) {
    context.addIssue({ code: "custom", path: ["maxOutputTokens"], message: "Vui lòng nhập số token đầu ra" });
  }
  if (values.figureModel && !values.figureMaxOutputTokens) {
    context.addIssue({ code: "custom", path: ["figureMaxOutputTokens"], message: "Vui lòng nhập số token đầu ra tạo hình" });
  }
  if (values.difficulty === "MIXED") {
    const total = Number(values.easyCount) + Number(values.mediumCount) + Number(values.hardCount);
    if (total !== Number(values.cardCount)) {
      context.addIssue({
        code: "custom",
        path: ["hardCount"],
        message: `Tổng Dễ, Trung bình, Khó phải bằng ${values.cardCount} thẻ`,
      });
    }
  }
});

export type AdminFlashcardGenerationFormValues = z.infer<
  typeof adminFlashcardGenerationSchema
>;
