import { z } from "zod";

export const adminQuizSolutionRefinementSchema = z.object({
  adminInstructions: z
    .string()
    .trim()
    .max(2_000, "Yêu cầu bổ sung tối đa 2.000 ký tự"),
});

export type AdminQuizSolutionRefinementFormValues = z.infer<
  typeof adminQuizSolutionRefinementSchema
>;
