import { zodTextFormat } from "openai/helpers/zod";

import type { AiOutputSchema } from "#api/modules/ai/types/ai-text.types";

export function buildAiStructuredTextFormat<TOutput>(
  schema: AiOutputSchema<TOutput>,
  outputName: string,
) {
  return zodTextFormat(schema, outputName);
}
