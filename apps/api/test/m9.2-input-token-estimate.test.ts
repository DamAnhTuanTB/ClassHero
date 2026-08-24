import { describe, expect, it } from "vitest";

import { getLessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import {
  estimateAiStructuredInputTokens,
  resolveAiStructuredTextFormat,
} from "#api/modules/ai/utils/ai-structured-output-format";

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

  it("keeps compact Summary schemas within subject and grade byte budgets", () => {
    const cases = [
      ...[7, 8, 9].map((targetGrade) => ({
        subjectKey: "MATH" as const,
        targetGrade,
        maxSchemaBytes: 22_000,
      })),
      ...[10, 11, 12].map((targetGrade) => ({
        subjectKey: "MATH" as const,
        targetGrade,
        maxSchemaBytes: 18_500,
      })),
      ...(["PHYSICS", "CHEMISTRY", "GENERAL"] as const).map((subjectKey) => ({
        subjectKey,
        targetGrade: 9,
        maxSchemaBytes: 17_500,
      })),
    ];

    for (const testCase of cases) {
      const resolution = resolveAiStructuredTextFormat(
        getLessonSummaryProviderTransportOutputSchema(
          testCase.subjectKey,
          "CONTEXTUAL",
          testCase.targetGrade,
        ),
        "lesson_summary_provider_contract",
        "ref_v2",
      );

      expect(resolution.resolvedReferenceStrategy).toBe("ref_v2");
      expect(resolution.schemaBytes).toBeLessThanOrEqual(testCase.maxSchemaBytes);
    }
  });
});
