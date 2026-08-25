import { apiRequest } from "@/lib/api-client";
import type {
  AccountingSettings,
  AiConfigurationsResponse,
  AiFeatureConfiguration,
  AuditItem,
  OcrSettings,
  PriceRate,
  PriceVersion,
  ProviderBudget,
  ProviderCatalogItem,
  ProviderOverview,
  TimelineResponse,
  UsageBreakdownItem,
  UsageEventsResponse,
  UsageGranularity,
} from "@/features/admin/ai-settings/types/provider-operations-types";

const basePath = "/admin/provider-operations";

export const getProviderOverview = (token: string) =>
  apiRequest<ProviderOverview>(`${basePath}/overview`, { token });

export const getProviderCatalog = (token: string) =>
  apiRequest<ProviderCatalogItem[]>(`${basePath}/catalog`, { token });

export const getAiConfigurations = (token: string) =>
  apiRequest<AiConfigurationsResponse>(`${basePath}/ai-configurations`, { token });

export const updateAiConfigurations = (
  configurations: AiFeatureConfiguration[],
  token: string,
) =>
  apiRequest<AiConfigurationsResponse>(`${basePath}/ai-configurations`, {
    method: "PUT",
    token,
    body: {
      configurations: configurations.map((configuration) => ({
        feature: configuration.feature,
        purpose: configuration.purpose,
        primaryCatalogItemId: configuration.primaryCatalogItemId,
        fallbackCatalogItemId: configuration.fallbackCatalogItemId,
        temperature: configuration.temperature,
        reasoningEffort: configuration.reasoningEffort,
        maxInputTokens: configuration.maxInputTokens,
        maxOutputTokens: configuration.maxOutputTokens,
        fallbackTemperature: configuration.fallbackTemperature,
        fallbackReasoningEffort: configuration.fallbackReasoningEffort,
        fallbackMaxOutputTokens: configuration.fallbackMaxOutputTokens,
        expectedVersion: configuration.version,
      })),
    },
  });

export const getOcrSettings = (token: string) =>
  apiRequest<OcrSettings>(`${basePath}/ocr-settings`, { token });

export const updateOcrSettings = (
  settings: Pick<AccountingSettings, "fxRateVndPerUsd" | "priceFreshnessDays" | "version">,
  token: string,
) =>
  apiRequest<OcrSettings>(`${basePath}/ocr-settings`, {
    method: "PUT",
    token,
    body: {
      fxRateVndPerUsd: settings.fxRateVndPerUsd,
      priceFreshnessDays: settings.priceFreshnessDays,
      expectedVersion: settings.version,
    },
  });

export const getProviderBudgets = (token: string) =>
  apiRequest<ProviderBudget[]>(`${basePath}/budgets`, { token });

export const updateProviderBudgets = (budgets: ProviderBudget[], token: string) =>
  apiRequest<ProviderBudget[]>(`${basePath}/budgets`, {
    method: "PUT",
    token,
    body: {
      budgets: budgets.map((budget) => ({
        scope: budget.scope,
        monthlyLimitVnd: budget.monthlyLimitVnd,
        hardStop: budget.hardStop,
        warningThresholds: budget.warningThresholds,
        expectedVersion: budget.version,
      })),
    },
  });

export const getUsageTimeline = (
  granularity: UsageGranularity,
  token: string,
) =>
  apiRequest<TimelineResponse>(
    `${basePath}/usage/timeline?granularity=${granularity}`,
    { token },
  );

export const getUsageBreakdown = (token: string) =>
  apiRequest<UsageBreakdownItem[]>(`${basePath}/usage/breakdown`, { token });

export const getUsageEvents = (
  token: string,
  page = 1,
  options?: { aiGenerationId?: string; pageSize?: number },
) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(options?.pageSize ?? 20),
  });
  if (options?.aiGenerationId) {
    searchParams.set("aiGenerationId", options.aiGenerationId);
  }
  return apiRequest<UsageEventsResponse>(
    `${basePath}/usage/events?${searchParams.toString()}`,
    { token },
  );
};

export const getProviderAuditHistory = (token: string) =>
  apiRequest<AuditItem[]>(`${basePath}/audit-history?limit=20`, { token });

export const createProviderPriceVersion = (
  catalogItemId: string,
  input: {
    billingMode: "TOKEN" | "PAGE" | "REQUEST";
    sourceUrl: string;
    rates: Array<Omit<PriceRate, "id">>;
  },
  token: string,
) =>
  apiRequest<PriceVersion>(`${basePath}/catalog/${catalogItemId}/price-versions`, {
    method: "POST",
    token,
    body: input,
  });

export const createProviderCatalogItem = (
  input: {
    category: "AI_MODEL" | "OCR_SERVICE";
    provider: string;
    externalKey: string;
    displayName: string;
    aiConfiguration?: "TEMPERATURE" | "REASONING_EFFORT";
    reasoningEffortLevels?: string[];
    initialPrice?: {
      billingMode: "TOKEN" | "PAGE" | "REQUEST";
      sourceUrl: string;
      rates: Array<Omit<PriceRate, "id">>;
    };
  },
  token: string,
) =>
  apiRequest<ProviderCatalogItem>(`${basePath}/catalog`, {
    method: "POST",
    token,
    body: input,
  });

export const updateProviderCatalogItem = (
  catalogItemId: string,
  input: {
    displayName?: string;
    externalKey?: string;
    aiConfiguration?: "TEMPERATURE" | "REASONING_EFFORT" | null;
    reasoningEffortLevels?: string[] | null;
    status?: "ACTIVE" | "DEPRECATED" | "DISABLED";
  },
  token: string,
) =>
  apiRequest<ProviderCatalogItem>(`${basePath}/catalog/${catalogItemId}`, {
    method: "PUT",
    token,
    body: input,
  });

export const deleteProviderCatalogItem = (catalogItemId: string, token: string) =>
  apiRequest<{ success: boolean }>(`${basePath}/catalog/${catalogItemId}`, {
    method: "DELETE",
    token,
  });

export const fetchExternalModels = (provider: "OPENAI" | "GEMINI", token: string) =>
  apiRequest<{ provider: string; externalKey: string; displayName: string; createdAt: string | null }[]>(
    `${basePath}/catalog/external-models?provider=${provider}`,
    { token }
  );

export const bulkSyncProviderModels = (
  items: Parameters<typeof createProviderCatalogItem>[0][],
  token: string
) =>
  apiRequest<{ success: boolean }>(`${basePath}/catalog/bulk-sync`, {
    method: "POST",
    token,
    body: { items },
  });
