import { ProviderUsageMetric } from "@prisma/client";

import type {
  PriceRateSnapshot,
  ProviderUsageAmounts,
} from "#api/modules/provider-operations/types/provider-operations.types";

export type ProviderCostResult = {
  costUsd: number;
  costVnd: number;
};

export type ProviderReservationEstimate = ProviderCostResult & {
  missingMetrics: ProviderUsageMetric[];
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

export function estimateProviderReservation(
  usageUpperBound: ProviderUsageAmounts,
  rates: PriceRateSnapshot[],
  fxRateVndPerUsd: number,
  requiredMetrics: ProviderUsageMetric[],
): ProviderReservationEstimate {
  const amounts: Record<ProviderUsageMetric, number> = {
    [ProviderUsageMetric.INPUT_TOKEN]: Math.max(0, usageUpperBound.promptTokens ?? 0),
    [ProviderUsageMetric.CACHED_INPUT_TOKEN]: Math.max(
      0,
      usageUpperBound.cachedInputTokens ?? 0,
    ),
    [ProviderUsageMetric.OUTPUT_TOKEN]: Math.max(
      0,
      usageUpperBound.completionTokens ?? 0,
    ),
    [ProviderUsageMetric.PAGE]: Math.max(0, usageUpperBound.pages ?? 0),
    [ProviderUsageMetric.REQUEST]: Math.max(0, usageUpperBound.requestCount ?? 0),
  };
  const ratesByMetric = new Map<ProviderUsageMetric, number>();
  for (const rate of rates) {
    if (rate.unitSize <= 0 || rate.unitPriceUsd < 0) continue;
    const perUnit = rate.unitPriceUsd / rate.unitSize;
    ratesByMetric.set(
      rate.metric,
      Math.max(ratesByMetric.get(rate.metric) ?? 0, perUnit),
    );
  }

  const missingMetrics = requiredMetrics.filter(
    (metric) => amounts[metric] > 0 && !ratesByMetric.has(metric),
  );
  const costUsd = Object.values(ProviderUsageMetric).reduce(
    (sum, metric) => sum + amounts[metric] * (ratesByMetric.get(metric) ?? 0),
    0,
  );

  return {
    costUsd: roundUsd(costUsd),
    costVnd: Math.max(0, Math.ceil(costUsd * fxRateVndPerUsd)),
    missingMetrics,
  };
}
