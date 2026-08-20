import { z } from "zod";

export const STEM_FIGURE_MAX_SOURCE_CHARACTERS = 30_000;
export const STEM_FIGURE_MAX_ALT_TEXT_CHARACTERS = 500;
export const STEM_FIGURE_MAX_CAPTION_CHARACTERS = 500;

export const stemFigureLatexSourceSchema = z
  .string()
  .trim()
  .min(20)
  .max(STEM_FIGURE_MAX_SOURCE_CHARACTERS)
  .refine(
    (source) =>
      !/\\(?:documentclass|usepackage|RequirePackage|setmainfont)\b/u.test(source) &&
      !/\\(?:begin|end)\s*\{\s*document\s*\}/u.test(source),
    "latexSource chỉ được là LaTeX figure snippet; compiler preamble và document wrapper do backend sở hữu.",
  )
  .refine(
    (source) => /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u.test(source),
    "latexSource phải chứa đúng một root tikzpicture hoặc circuitikz theo profile môn.",
  );

export const stemFigureDraftSchema = z
  .object({
    latexSource: stemFigureLatexSourceSchema.describe(
      "Một LaTeX figure snippet gồm optional local header trong allowlist rồi đúng một root tikzpicture hoặc circuitikz theo môn. Không trả documentclass, usepackage, document wrapper, file, URL hoặc asset bên ngoài.",
    ),
    altText: z.string().trim().min(1).max(STEM_FIGURE_MAX_ALT_TEXT_CHARACTERS),
    caption: z.string().trim().max(STEM_FIGURE_MAX_CAPTION_CHARACTERS).nullable(),
  })
  .strict();

export const stemFigureStatusSchema = z.enum([
  "QUEUED",
  "RENDERING",
  "REPAIRING",
  "SUCCEEDED",
  "NEEDS_REVIEW",
  "FAILED",
]);

export const stemFigureOriginSchema = z.enum(["TEXTBOOK_SOURCE", "GENERATED_FROM_BRIEF"]);

export const stemFigureErrorCategorySchema = z.enum([
  "COMPILER",
  "SOURCE_POLICY",
  "VALIDATOR",
  "INFRASTRUCTURE",
]);

export const stemFigureDiagnosticIssueSchema = z
  .object({
    code: z.string().trim().min(1).max(160),
    severity: z.enum(["ERROR", "WARNING"]),
    message: z.string().trim().min(1).max(4_000),
    file: z.string().trim().max(500).nullable(),
    line: z.number().int().positive().nullable(),
    column: z.number().int().nonnegative().nullable(),
    element: z.string().trim().max(200).nullable(),
    path: z.string().trim().max(500).nullable(),
  })
  .strict();

export const stemFigureDiagnosticBatchSchema = z
  .object({
    attemptId: z.uuid(),
    sourceVersion: z.number().int().positive(),
    sourceHash: z.string().trim().min(16).max(128),
    category: stemFigureErrorCategorySchema,
    issues: z.array(stemFigureDiagnosticIssueSchema).min(1),
    rawLogExcerpt: z.string().max(80_000),
    collectionComplete: z.boolean(),
    batchHash: z.string().trim().min(16).max(128),
    createdAt: z.string().datetime(),
  })
  .strict();

export const stemFigureReferenceSchema = z
  .object({
    kind: z.literal("TEX_FIGURE"),
    figureId: z.uuid(),
    figureOrigin: stemFigureOriginSchema,
    altText: z.string().trim().min(1).max(STEM_FIGURE_MAX_ALT_TEXT_CHARACTERS),
    caption: z.string().trim().max(STEM_FIGURE_MAX_CAPTION_CHARACTERS).nullable(),
    status: stemFigureStatusSchema.optional(),
    previewSvg: z.string().optional(),
    assetUrl: z.string().url().nullable().optional(),
  })
  .strict();

export const stemFigureVisualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  stemFigureReferenceSchema,
]);

export type StemFigureDraft = z.infer<typeof stemFigureDraftSchema>;
export type StemFigureReference = z.infer<typeof stemFigureReferenceSchema>;
export type StemFigureOrigin = z.infer<typeof stemFigureOriginSchema>;
export type StemFigureStatusValue = z.infer<typeof stemFigureStatusSchema>;
export type StemFigureDiagnosticBatch = z.infer<typeof stemFigureDiagnosticBatchSchema>;
