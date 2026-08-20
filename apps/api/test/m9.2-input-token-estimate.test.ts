import { describe, expect, it } from "vitest";

import { estimateAiStructuredInputTokens } from "#api/modules/ai/utils/ai-structured-output-format";

describe("M9.2 input token estimate", () => {
  it("keeps text and PDF estimates separate and adds both into total input", () => {
    const estimate = estimateAiStructuredInputTokens({
      systemPrompt: "abcd",
      inputPrompt: "efgh",
      structuredTextFormat: {},
      additionalInputTokens: 3_000,
    });

    expect(estimate).toEqual({
      textPromptTokens: 2,
      textInputTokens: 4,
      additionalInputTokens: 3_000,
      promptTokens: 3_002,
      schemaTokens: 2,
      estimatedTokens: 3_004,
    });
  });

  it("preserves the minimum text-context estimate for non-PDF generation", () => {
    const estimate = estimateAiStructuredInputTokens({
      systemPrompt: "abcd",
      inputPrompt: "efgh",
      structuredTextFormat: {},
      minimumPromptTokens: 500,
    });

    expect(estimate.textInputTokens).toBe(4);
    expect(estimate.additionalInputTokens).toBe(0);
    expect(estimate.estimatedTokens).toBe(502);
  });
});
