import { z } from "zod";

const geometryStatementLineSchema = z.string().trim().min(1).max(1_000);

/**
 * A textbook-style hypothesis/conclusion table for formal geometry proofs.
 * The field stays optional on persisted example blocks so legacy summaries
 * continue to parse and render unchanged.
 */
export const lessonSummaryGeometryStatementSchema = z
  .object({
    hypotheses: z.array(geometryStatementLineSchema).min(1).max(20),
    conclusions: z.array(geometryStatementLineSchema).min(1).max(20),
  })
  .strict();

export type LessonSummaryGeometryStatement = z.infer<
  typeof lessonSummaryGeometryStatementSchema
>;
