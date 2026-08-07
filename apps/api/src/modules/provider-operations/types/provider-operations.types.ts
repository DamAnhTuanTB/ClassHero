import type {
  AiGenerationType,
  AiProviderName,
  ProviderCatalogCategory,
  ProviderUsageMetric,
} from "@prisma/client";

export type PriceRateSnapshot = {
  metric: ProviderUsageMetric;
  unitSize: number;
  unitPriceUsd: number;
  tierFrom: number | null;
  tierTo: number | null;
};

export type ProviderRouteCandidate = {
  catalogItemId: string | null;
  priceVersionId: string | null;
  category: ProviderCatalogCategory;
  provider: AiProviderName;
  model: string;
  maxInputTokens: number | null;
  available: boolean;
  capabilitiesJson?: any;
  rates: PriceRateSnapshot[];
};

export type AiFeatureRoute = {
  feature: AiGenerationType;
  version: number;
  model: string;
  temperature: number | null;
  reasoningEffort: string | null;
  maxOutputTokens: number | null;
  candidates: ProviderRouteCandidate[];
};

export type ProviderUsageAmounts = {
  promptTokens?: number;
  cachedInputTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  pages?: number;
  requestCount?: number;
};
