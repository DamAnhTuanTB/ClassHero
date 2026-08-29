import { z } from "zod";

export const tiptapMarkSchema = z
  .object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type TiptapJsonMark = z.infer<typeof tiptapMarkSchema>;

export interface TiptapJsonNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJsonNode[];
  marks?: TiptapJsonMark[];
  text?: string;
  [key: string]: unknown;
}

export const tiptapNodeSchema: z.ZodType<TiptapJsonNode> = z.lazy(() =>
  z
    .object({
      type: z.string(),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(tiptapNodeSchema).optional(),
      marks: z.array(tiptapMarkSchema).optional(),
      text: z.string().optional(),
    })
    .passthrough(),
);

export const tiptapTextDocumentSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(tiptapNodeSchema).optional(),
  })
  .passthrough();

export const lessonSummaryBlocksDocumentSchema = z
  .object({
    type: z.literal("lesson_summary_blocks"),
    data: z.unknown().optional(),
  })
  .passthrough();

export const tiptapContentSchema = z.union([
  tiptapTextDocumentSchema,
  lessonSummaryBlocksDocumentSchema,
]);

export type TiptapNode = TiptapJsonNode;
export type TiptapTextDocument = z.infer<typeof tiptapTextDocumentSchema>;
export type TiptapContent = z.infer<typeof tiptapContentSchema>;
