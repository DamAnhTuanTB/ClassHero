import { zodTextFormat } from "openai/helpers/zod";

import type { AiOutputSchema } from "#api/modules/ai/types/ai-text.types";

export function buildAiStructuredTextFormat<TOutput>(
  schema: AiOutputSchema<TOutput>,
  outputName: string,
) {
  return zodTextFormat(schema, outputName);
}

export function estimateAiStructuredInputTokens(input: {
  systemPrompt: string;
  inputPrompt: string;
  structuredTextFormat: unknown;
  minimumPromptTokens?: number;
}) {
  const promptTokens = Math.max(
    input.minimumPromptTokens ?? 0,
    Math.ceil((input.systemPrompt.length + input.inputPrompt.length) / 4),
  );
  const schemaTokens = Math.ceil(
    // JSON Schema is punctuation- and identifier-heavy. Live Responses usage for
    // this contract is about 1.2 characters/token, unlike prose at about 4.
    JSON.stringify(input.structuredTextFormat).length / 1.2,
  );
  return {
    promptTokens,
    schemaTokens,
    estimatedTokens: promptTokens + schemaTokens,
  };
}
