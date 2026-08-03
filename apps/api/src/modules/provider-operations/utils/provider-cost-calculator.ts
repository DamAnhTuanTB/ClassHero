import { ProviderUsageMetric } from "@prisma/client";

import type {
  PriceRateSnapshot,
  ProviderUsageAmounts,
} from "#api/modules/provider-operations/types/provider-operations.types";

export type ProviderCostResult = {
  costUsd: number;
  costVnd: number;
};

export function calculateProviderCost(
  usage: ProviderUsageAmounts,
  rates: PriceRateSnapshot[],
  fxRateVndPerUsd: number,
): ProviderCostResult {
  const cachedTokens = Math.max(0, usage.cachedInputTokens ?? 0);
  const billableInputTokens = Math.max(0, (usage.promptTokens ?? 0) - cachedTokens);
  const amounts: Record<ProviderUsageMetric, number> = {
    [ProviderUsageMetric.INPUT_TOKEN]: billableInputTokens,
    [ProviderUsageMetric.CACHED_INPUT_TOKEN]: cachedTokens,
    [ProviderUsageMetric.OUTPUT_TOKEN]: Math.max(0, usage.completionTokens ?? 0),
    [ProviderUsageMetric.PAGE]: Math.max(0, usage.pages ?? 0),
    [ProviderUsageMetric.REQUEST]: Math.max(0, usage.requestCount ?? 1),
  };

  const costUsd = rates.reduce((sum, rate) => {
    const amount = amounts[rate.metric];
    if (amount <= 0 || rate.unitSize <= 0) {
      return sum;
    }

    const tierStart = Math.max(0, rate.tierFrom ?? 0);
    const tierEnd = rate.tierTo ?? Number.POSITIVE_INFINITY;
    const amountInTier = Math.max(0, Math.min(amount, tierEnd) - tierStart);
    return sum + (amountInTier / rate.unitSize) * rate.unitPriceUsd;
  }, 0);

  return {
    costUsd: roundUsd(costUsd),
    costVnd: Math.max(0, Math.round(costUsd * fxRateVndPerUsd)),
  };
}

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000_000_000) / 10_000_000_000;
}
