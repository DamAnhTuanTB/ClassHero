import { zodTextFormat } from "openai/helpers/zod";
import {
  makeParseableTextFormat,
  type AutoParseableTextFormat,
} from "openai/lib/parser";
import { toStrictJsonSchema } from "openai/lib/transform";
import { z } from "zod";

import type {
  AiOutputSchema,
  AiStructuredSchemaReferenceStrategy,
} from "#api/modules/ai/types/ai-text.types";

export function buildAiStructuredTextFormat<TOutput>(
  schema: AiOutputSchema<TOutput>,
  outputName: string,
  referenceStrategy: AiStructuredSchemaReferenceStrategy = "inline",
): AutoParseableTextFormat<TOutput> {
  if (referenceStrategy === "inline") {
    return zodTextFormat(schema, outputName);
  }

  const jsonSchema = toStrictJsonSchema(
    z.toJSONSchema(schema, {
      reused: "ref",
      override: ({ zodSchema, jsonSchema: generatedSchema }) => {
        const definition = zodSchema._zod.def;
        if (
          definition.type === "union" &&
          "discriminator" in definition &&
          Array.isArray(generatedSchema.oneOf)
        ) {
          if (generatedSchema.anyOf !== undefined) {
            throw new Error(
              "Zod discriminated union generated both anyOf and oneOf.",
            );
          }
          generatedSchema.anyOf = generatedSchema.oneOf;
          delete generatedSchema.oneOf;
        }
      },
    }) as Parameters<typeof toStrictJsonSchema>[0],
  );

  return makeParseableTextFormat<TOutput>(
    {
      type: "json_schema",
      name: outputName,
      strict: true,
      schema: jsonSchema as unknown as Record<string, unknown>,
    },
    (content) => schema.parse(JSON.parse(content)),
  );
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
