import { describe, expect, it } from "vitest";

import { lessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import { buildOpenAiPromptCacheFields } from "#api/modules/ai/utils/ai-prompt-cache";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";

const outputSchema = lessonSummaryProviderTransportOutputSchema;

function createRequest(overrides: Partial<AiStructuredInput> = {}): AiStructuredInput {
  return {
    systemPrompt: "SYSTEM CONTRACT",
    userPrompt: "USER REQUEST A",
    contextChunks: [{ id: "chunk-a", content: "SOURCE A" }],
    outputName: "lesson_summary_provider_contract",
    promptVersion: "summary-prompt-v1",
    schemaVersion: "summary-schema-v1",
    schemaReferenceStrategy: "ref_v2",
    promptCache: {
      namespace: "lesson-summary",
      keyEnabled: true,
      retention: "24h",
    },
    ...overrides,
  };
}

describe("M9.2 OpenAI prompt cache routing", () => {
  it("keeps the routing key stable when only the user request or chunks change", () => {
    const request = createRequest();
    const textFormat = buildAiStructuredTextFormat(
      outputSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );
    const first = buildOpenAiPromptCacheFields({
      request,
      model: "gpt-5.4-2026-03-05",
      structuredTextFormat: textFormat,
    });
    const second = buildOpenAiPromptCacheFields({
      request: createRequest({
        userPrompt: "USER REQUEST B",
        contextChunks: [{ id: "chunk-b", content: "SOURCE B" }],
      }),
      model: "gpt-5.4-2026-03-05",
      structuredTextFormat: textFormat,
    });

    expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
    expect(first.prompt_cache_retention).toBe("24h");
  });

  it("changes the routing key when a stable cache-prefix component changes", () => {
    const request = createRequest();
    const textFormat = buildAiStructuredTextFormat(
      outputSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );
    const keyFor = (candidate: AiStructuredInput, model = "gpt-5.4") =>
      buildOpenAiPromptCacheFields({
        request: candidate,
        model,
        structuredTextFormat: textFormat,
      }).prompt_cache_key;
    const baseline = keyFor(request);

    expect(keyFor(createRequest({ systemPrompt: "UPDATED CONTRACT" }))).not.toBe(
      baseline,
    );
    expect(keyFor(createRequest({ schemaReferenceStrategy: "ref" }))).not.toBe(baseline);
    expect(keyFor(request, "gpt-5.4-2026-03-05")).not.toBe(baseline);
  });

  it("does not send unsupported extended-retention fields to another model", () => {
    const request = createRequest();
    const textFormat = buildAiStructuredTextFormat(
      outputSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );

    expect(
      buildOpenAiPromptCacheFields({
        request,
        model: "gpt-4.1",
        structuredTextFormat: textFormat,
      }),
    ).toMatchObject({
      prompt_cache_key: expect.any(String),
    });
    expect(
      buildOpenAiPromptCacheFields({
        request,
        model: "gpt-4.1",
        structuredTextFormat: textFormat,
      }),
    ).not.toHaveProperty("prompt_cache_retention");
  });

  it("uses an explicit 30-minute breakpoint contract for GPT-5.6+", () => {
    const request = createRequest();
    const textFormat = buildAiStructuredTextFormat(
      outputSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );

    const fields = buildOpenAiPromptCacheFields({
      request,
      model: "gpt-5.6-luna",
      structuredTextFormat: textFormat,
    });

    expect(fields).toMatchObject({
      prompt_cache_key: expect.any(String),
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
    });
    expect(fields).not.toHaveProperty("prompt_cache_retention");
  });
});
