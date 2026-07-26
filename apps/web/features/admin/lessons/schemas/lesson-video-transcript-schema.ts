import { z } from "zod";

export const transcriptTimestampPattern = /^(?:(?:\d+):)?(?:[0-5]?\d):(?:[0-5]\d)$/;

export const transcriptSegmentSchema = z.object({
  endTime: z.number().nonnegative().optional(),
  time: z.number().nonnegative().optional(),
  timeString: z
    .string()
    .min(1, "Vui lòng nhập thời gian")
    .regex(transcriptTimestampPattern, "Dùng định dạng MM:SS hoặc H:MM:SS"),
  text: z
    .string()
    .trim()
    .min(1, "Nội dung không được để trống")
    .max(2000, "Mỗi đoạn tối đa 2.000 ký tự"),
});

export const transcriptFormSchema = z.object({
  segments: z
    .array(transcriptSegmentSchema)
    .min(1, "Cần ít nhất một đoạn transcript")
    .max(10_000, "Transcript vượt quá 10.000 đoạn"),
});

export type TranscriptFormValues = z.infer<typeof transcriptFormSchema>;

export function validateTranscriptField(schema: z.ZodType<string>, value: string) {
  const result = schema.safeParse(value);
  return result.success || result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
}
