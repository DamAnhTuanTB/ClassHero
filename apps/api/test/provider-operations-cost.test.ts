import { describe, expect, it } from "vitest";
import { ProviderUsageMetric } from "@prisma/client";

import { isTransientProviderError } from "#api/modules/ai/services/ai-provider-call.service";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

describe("provider operations cost accounting", () => {
  it("separates cached input, regular input and output token prices", () => {
    const result = calculateProviderCost(
      {
        promptTokens: 1_000_000,
        cachedInputTokens: 250_000,
        completionTokens: 100_000,
      },
      [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 0.4),
        rate(ProviderUsageMetric.CACHED_INPUT_TOKEN, 1_000_000, 0.1),
        rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 1.6),
      ],
      25_000,
    );

    expect(result.costUsd).toBe(0.485);
    expect(result.costVnd).toBe(12_125);
  });

  it("calculates page pricing and keeps zero-usage events free", () => {
    const rates = [rate(ProviderUsageMetric.PAGE, 1, 0.005)];
    expect(calculateProviderCost({ pages: 20 }, rates, 25_000)).toEqual({
      costUsd: 0.1,
      costVnd: 2_500,
    });
    expect(calculateProviderCost({ pages: 0, requestCount: 0 }, rates, 25_000))
      .toEqual({ costUsd: 0, costVnd: 0 });
  });

  it("only treats provider availability failures as fallback candidates", () => {
    expect(isTransientProviderError(Object.assign(new Error("rate limit"), { status: 429 }))).toBe(true);
    expect(isTransientProviderError(Object.assign(new Error("server"), { status: 503 }))).toBe(true);
    expect(isTransientProviderError(new Error("schema validation failed"))).toBe(false);
    expect(isTransientProviderError(Object.assign(new Error("bad request"), { status: 400 }))).toBe(false);
  });
});

function rate(
  metric: ProviderUsageMetric,
  unitSize: number,
  unitPriceUsd: number,
) {
  return { metric, unitSize, unitPriceUsd, tierFrom: null, tierTo: null };
}
