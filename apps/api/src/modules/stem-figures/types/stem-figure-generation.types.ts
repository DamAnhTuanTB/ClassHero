import {
  stemFigureLatexSourceSchema,
  stemFigureOriginSchema,
} from "@learning-path/shared";
import { z } from "zod";

import { stemFigureSourceTargetSchema } from "#api/modules/ai/types/lesson-summary.types";

const blockRecordSchema = z.record(z.string(), z.unknown());

export const stemFigureGenerationBriefSchema = z
  .object({
    figurePlanContractVersion: z.literal(3),
    figureOrigin: stemFigureOriginSchema,
    targetGrade: z.number().int().min(1).max(12).nullable(),
    blockPath: z.string().trim().min(1).max(500),
    blockContent: blockRecordSchema,
    sourceReferences: z
      .array(
        z
          .object({
            packetPageNumber: z.number().int().positive(),
            printedPageLabel: z.string().trim().max(80).nullable(),
            figureLabel: z.string().trim().max(160).nullable(),
            sourceTarget: stemFigureSourceTargetSchema,
          })
          .strict(),
      )
      .max(5),
    referenceAssets: z
      .array(
        z
          .object({
            objectKey: z.string().trim().min(1).max(1_000),
            mimeType: z.string().trim().min(1).max(120),
            label: z.string().trim().min(1).max(300),
            packetPageNumber: z.number().int().positive().nullable(),
            source: z.enum(["OCR_CROP", "PDF_PAGE", "CURRENT_FIGURE"]),
            sourceTarget: stemFigureSourceTargetSchema.nullable().optional(),
          })
          .strict(),
      )
      .max(6)
      .default([]),
    referenceImageMode: z
      .enum(["SOURCE_CROP_ONLY", "CURRENT_ONLY", "NONE"])
      .default("SOURCE_CROP_ONLY"),
    targetMode: z.enum(["QUESTION", "SOLUTION"]).nullable().optional(),
    currentLatexSource: stemFigureLatexSourceSchema.optional(),
    adminInstructions: z.string().trim().max(2_000).nullable().default(null),
  })
  .strict();

export type StemFigureGenerationBrief = z.infer<typeof stemFigureGenerationBriefSchema>;
