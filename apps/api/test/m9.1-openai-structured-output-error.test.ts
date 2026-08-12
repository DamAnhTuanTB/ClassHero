import { AiProviderName } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildOpenAiStructuredOutputError } from "#api/modules/ai/providers/openai.provider";
import { AiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";

describe("M9.1 OpenAI structured output diagnostics", () => {
  it("classifies a token-limited response and keeps safe provider metadata", () => {
    const error = buildOpenAiStructuredOutputError({
      responseStatus: "incomplete",
      incompleteReason: "max_output_tokens",
      hasRefusal: false,
      providerRequestId: "resp-incomplete",
      model: "gpt-5.1-2025-11-13",
      usage: {
        promptTokens: 20_636,
        cachedInputTokens: 10_000,
        completionTokens: 16_000,
        reasoningTokens: 12_500,
        totalTokens: 36_636,
      },
      latencyMs: 216_303,
      maxOutputTokens: 16_000,
    });

    expect(error).toBeInstanceOf(AiProviderOutputError);
    expect(error).toMatchObject({
      code: "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
      details: {
        provider: AiProviderName.OPENAI,
        responseStatus: "incomplete",
        incompleteReason: "max_output_tokens",
        providerRequestId: "resp-incomplete",
        maxOutputTokens: 16_000,
        usage: { reasoningTokens: 12_500 },
      },
    });
    expect(error.message).toContain("16.000 token");
    expect(error.message).toContain("token suy luận");
  });

  it.each([
    {
      responseStatus: "incomplete",
      incompleteReason: "content_filter",
      hasRefusal: false,
      expectedCode: "OPENAI_INCOMPLETE_CONTENT_FILTER",
    },
    {
      responseStatus: "completed",
      incompleteReason: null,
      hasRefusal: true,
      expectedCode: "OPENAI_REFUSED",
    },
    {
      responseStatus: "completed",
      incompleteReason: null,
      hasRefusal: false,
      expectedCode: "OPENAI_STRUCTURED_OUTPUT_MISSING",
    },
  ])("classifies $expectedCode without exposing raw output", (testCase) => {
    const error = buildOpenAiStructuredOutputError({
      responseStatus: testCase.responseStatus,
      incompleteReason: testCase.incompleteReason,
      hasRefusal: testCase.hasRefusal,
      model: "gpt-5.1",
    });

    expect(error.code).toBe(testCase.expectedCode);
    expect(error.details).toMatchObject({
      responseStatus: testCase.responseStatus,
      incompleteReason: testCase.incompleteReason,
      hasRefusal: testCase.hasRefusal,
    });
  });
});
