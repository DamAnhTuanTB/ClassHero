import { z } from "zod";

export const lessonSourcePacketManifestSchema = z.object({
  version: z.literal(1),
  lessonId: z.string().uuid(),
  packetHash: z.string().min(1),
  pageCount: z.number().int().positive(),
  pages: z.array(
    z.object({
      packetPageNumber: z.number().int().positive(),
      sourceKey: z.string().min(1),
      lessonDocumentId: z.string().uuid(),
      sourceDocumentId: z.string().uuid().nullable(),
      sourceFileId: z.string().uuid(),
      sourcePdfPageNumber: z.number().int().positive(),
      printedPageLabel: z.string().nullable(),
      pageRangeId: z.string().uuid().nullable(),
      documentTitle: z.string().min(1),
      segmentOrder: z.number().int().nonnegative(),
    }),
  ),
});
