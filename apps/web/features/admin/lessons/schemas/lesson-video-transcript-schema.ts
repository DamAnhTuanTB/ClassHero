import { z } from "zod";

export const transcriptTimestampPattern = /^(?:(?:\d+):)?(?:[0-5]?\d):(?:[0-5]\d)$/;

export const transcriptSegmentSchema = z.object({
  endTime: z.number().nonnegative().optional(),
  sourceEndTime: z.number().nonnegative().optional(),
  sourceTime: z.number().nonnegative().optional(),
  sourceTimeString: z
    .string()
    .min(1, "Vui lòng nhập thời gian gốc")
    .regex(transcriptTimestampPattern, "Dùng định dạng MM:SS hoặc H:MM:SS"),
  time: z.number().nonnegative().optional(),
  timeString: z.string(),
  text: z
    .string()
    .trim()
    .min(1, "Nội dung không được để trống")
    .max(2000, "Mỗi đoạn tối đa 2.000 ký tự"),
});

export const transcriptFormSchema = z.object({
  segments: z
    .array(transcriptSegmentSchema)
    .min(1, "Cần ít nhất một đoạn bản chép lời")
    .max(10_000, "Bản chép lời không được vượt quá 10.000 đoạn"),
});

export type TranscriptFormValues = z.infer<typeof transcriptFormSchema>;

export function validateTranscriptField(schema: z.ZodType<string>, value: string) {
  const result = schema.safeParse(value);
  return result.success || result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
}
