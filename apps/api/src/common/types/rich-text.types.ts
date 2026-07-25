import { z } from "zod";
import { tiptapContentSchema, tiptapNodeSchema } from "../validation/zod-schemas/tiptap.schema";

/**
 * Kiểu dữ liệu TypeScript suy luận từ Zod schema cho một node trong Tiptap
 */
export type TiptapNode = z.infer<typeof tiptapNodeSchema>;

/**
 * Kiểu dữ liệu TypeScript suy luận từ Zod schema cho toàn bộ root document của Tiptap
 */
export type TiptapContent = z.infer<typeof tiptapContentSchema>;
