import {
  AI_REASONING_EFFORT_LEVELS,
  LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
} from "@learning-path/shared";
import { z } from "zod";

const generationTypeSchema = z.enum(["SUMMARY", "FLASHCARD", "TEST"]);
const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD", "MIXED"]);
const questionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "MULTI_STATEMENT_TRUE_FALSE",
  "TEXT_INPUT",
]);
const summaryStyleSchema = z.enum(["student_friendly", "concise", "academic"]);
const summaryLengthSchema = z.enum(["short", "standard", "detailed"]);
const numericTextSchema = (label: string, min: number, max: number) =>
  z
    .string()
    .min(1, `Nhập ${label.toLowerCase()}`)
    .regex(/^\d+$/, `${label} phải là số nguyên`)
    .refine((value) => Number(value) >= min && Number(value) <= max, {
      message: `${label} phải từ ${min} đến ${max}`,
    });
const optionalNumericTextSchema = (
  label: string,
  min: number,
  max: number,
  allowDecimal = false,
) =>
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

export const adminAiGenerationFormSchema = z
  .object({
    type: generationTypeSchema,
    documentIds: z.array(z.string().uuid()).max(20, "Chọn tối đa 20 tài liệu"),
    useTextbookSourceImages: z.boolean(),
    autoEnhanceTextbookSourceImages: z.boolean(),
    style: summaryStyleSchema,
    styleInstructions: z
      .string()
      .trim()
      .min(1, "Nhập cách trình bày")
      .max(1_000, "Cách trình bày tối đa 1.000 ký tự"),
    summaryLength: summaryLengthSchema,
    summaryTargetWordCount: optionalNumericTextSchema("Số lượng từ", 50, 5_000),
    standardExerciseCount: numericTextSchema("Số bài tập bình thường", 1, 10),
    realWorldExerciseCount: numericTextSchema("Số bài tập ứng dụng thực tế", 1, 10),
    extraInstructions: z.string().trim().max(2_000, "Yêu cầu bổ sung tối đa 2.000 ký tự"),
    systemInstructions: z
      .string()
      .max(
        LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
        "Quy tắc hệ thống tối đa 64.000 ký tự",
      ),
    userPrompt: z.string().max(16_000, "Câu lệnh người dùng tối đa 16.000 ký tự"),
    summaryModel: z.string().max(200),
    summaryTemperature: optionalNumericTextSchema("Temperature", 0, 1, true),
    summaryReasoningEffort: z.union([z.literal(""), z.enum(AI_REASONING_EFFORT_LEVELS)]),
    summaryMaxOutputTokens: optionalNumericTextSchema("Số token đầu ra", 8_000, 32_000),
    summaryFigureModel: z.string().max(200),
    summaryFigureTemperature: optionalNumericTextSchema(
      "Temperature tạo hình",
      0,
      1,
      true,
    ),
    summaryFigureReasoningEffort: z.union([
      z.literal(""),
      z.enum(AI_REASONING_EFFORT_LEVELS),
    ]),
    summaryFigureMaxOutputTokens: optionalNumericTextSchema(
      "Số token đầu ra tạo hình",
      128,
      32_000,
    ),
    count: numericTextSchema("Số lượng", 1, 60),
    difficulty: difficultySchema,
    questionTypes: z.array(questionTypeSchema).max(4),
    durationMinutes: numericTextSchema("Thời gian", 1, 240),
    easyRatio: numericTextSchema("Tỷ lệ dễ", 0, 100),
    mediumRatio: numericTextSchema("Tỷ lệ trung bình", 0, 100),
    hardRatio: numericTextSchema("Tỷ lệ khó", 0, 100),
    easyCount: numericTextSchema("Số câu dễ", 0, 50),
    mediumCount: numericTextSchema("Số câu trung bình", 0, 50),
    hardCount: numericTextSchema("Số câu khó", 0, 50),
  })
  .superRefine((values, context) => {
    if (values.autoEnhanceTextbookSourceImages && !values.useTextbookSourceImages) {
      context.addIssue({
        code: "custom",
        path: ["autoEnhanceTextbookSourceImages"],
        message: "Chỉ có thể làm nét khi dùng ảnh gốc của tài liệu",
      });
    }
    if (values.type === "SUMMARY" && values.documentIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["documentIds"],
        message: "Chọn ít nhất một tài liệu",
      });
    }
    if (values.type === "SUMMARY" && values.summaryModel) {
      if (!values.summaryMaxOutputTokens) {
        context.addIssue({
          code: "custom",
          path: ["summaryMaxOutputTokens"],
          message: "Vui lòng nhập số token đầu ra",
        });
      }
    }
    if (
      values.type === "SUMMARY" &&
      values.summaryFigureModel &&
      !values.summaryFigureMaxOutputTokens
    ) {
      context.addIssue({
        code: "custom",
        path: ["summaryFigureMaxOutputTokens"],
        message: "Vui lòng nhập số token đầu ra tạo hình",
      });
    }
    if (values.type === "TEST") {
      if (values.questionTypes.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["questionTypes"],
          message: "Chọn ít nhất một loại câu hỏi",
        });
      }
      if (Number(values.count) > 50) {
        context.addIssue({
          code: "custom",
          path: ["count"],
          message: "Số câu tối đa là 50",
        });
      }
    }
    if (values.type === "TEST") {
      const total =
        Number(values.easyRatio) + Number(values.mediumRatio) + Number(values.hardRatio);
      if (total !== 100) {
        context.addIssue({
          code: "custom",
          path: ["hardRatio"],
          message: `Tổng ba tỷ lệ phải bằng 100% (hiện là ${total}%)`,
        });
      }
    }
  });

export type AdminAiGenerationFormValues = z.infer<typeof adminAiGenerationFormSchema>;
