import { AI_REASONING_EFFORT_LEVELS } from "@learning-path/shared";
import { z } from "zod";

const numericText = (label: string, min: number, max: number) =>
  z
    .string()
    .min(1, `Nhập ${label.toLowerCase()}`)
    .regex(/^\d+$/, `${label} phải là số nguyên`)
    .refine((value) => Number(value) >= min && Number(value) <= max, {
      message: `${label} phải từ ${min} đến ${max}`,
    });

const optionalNumber = (label: string, min: number, max: number, allowDecimal = false) =>
  z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (allowDecimal ? /^\d+(?:\.\d{0,2})?$/.test(value) : /^\d+$/.test(value)),
      `${label} phải là ${allowDecimal ? "số" : "số nguyên"}`,
    )
    .refine(
      (value) => value === "" || (Number(value) >= min && Number(value) <= max),
      `${label} phải từ ${min} đến ${max}`,
    );

export const adminQuizGenerationSchema = z
  .object({
    targetQuizSetId: z.union([
      z.literal(""),
      z.string().uuid("Bộ câu hỏi đã chọn không hợp lệ"),
    ]),
    documentIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất một tài liệu").max(20),
    questionCount: numericText("Số câu hỏi", 1, 50),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]),
    easyCount: numericText("Số câu dễ", 0, 50),
    mediumCount: numericText("Số câu trung bình", 0, 50),
    hardCount: numericText("Số câu khó", 0, 50),
    questionTypes: z
      .array(
        z.enum([
          "MULTIPLE_CHOICE",
          "TRUE_FALSE",
          "MULTI_STATEMENT_TRUE_FALSE",
          "TEXT_INPUT",
        ]),
      )
      .min(1, "Chọn ít nhất một loại câu hỏi")
      .max(4),
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
    figureReasoningEffort: z.union([
      z.literal(""),
      z.enum(AI_REASONING_EFFORT_LEVELS),
    ]),
    figureMaxOutputTokens: optionalNumber("Số token đầu ra tạo hình", 128, 32_000),
  })
  .superRefine((values, context) => {
    if (values.model && !values.maxOutputTokens) {
      context.addIssue({
        code: "custom",
        path: ["maxOutputTokens"],
        message: "Vui lòng nhập số token đầu ra",
      });
    }
    if (values.figureModel && !values.figureMaxOutputTokens) {
      context.addIssue({
        code: "custom",
        path: ["figureMaxOutputTokens"],
        message: "Vui lòng nhập số token đầu ra tạo hình",
      });
    }
    if (values.difficulty === "MIXED") {
      const total =
        Number(values.easyCount) + Number(values.mediumCount) + Number(values.hardCount);
      if (total !== Number(values.questionCount)) {
        context.addIssue({
          code: "custom",
          path: ["hardCount"],
          message: `Tổng Dễ, Trung bình, Khó phải bằng ${values.questionCount} câu`,
        });
      }
    }
  });

export type AdminQuizGenerationFormValues = z.infer<typeof adminQuizGenerationSchema>;
