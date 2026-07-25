import { z } from "zod";

/**
 * Tiptap Node Schema
 * Dùng lazy để hỗ trợ đệ quy cho cây JSON của Tiptap
 */
export const tiptapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.any()).optional(),
    content: z.array(tiptapNodeSchema).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.any()).optional(),
        }),
      )
      .optional(),
    text: z.string().optional(),
  }).passthrough(),
);

/**
 * Tiptap Content Schema
 * Luôn phải bắt đầu bằng node có type là "doc"
 */
export const tiptapContentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNodeSchema).optional(),
}).passthrough();
