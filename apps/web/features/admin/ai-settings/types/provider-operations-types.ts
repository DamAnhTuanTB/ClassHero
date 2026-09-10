import type {
  ProviderUsageOperation,
  ProviderUsageTargetContext,
} from "@learning-path/shared";

export type { ProviderUsageOperation } from "@learning-path/shared";

export type ProviderCategory = "AI_MODEL" | "OCR_SERVICE";
export type AiFeature = "SUMMARY" | "VIDEO_SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST";
export type AiModelPurpose = "TEXT" | "IMAGE";
export type UsageGranularity = "DAY" | "WEEK" | "MONTH";

export type PriceRate = {
  id?: string;
  metric: "INPUT_TOKEN" | "CACHED_INPUT_TOKEN" | "OUTPUT_TOKEN" | "PAGE" | "REQUEST";
  unitSize: number;
  unitPriceUsd: number;
  tierFrom: number | null;
  tierTo: number | null;
};

export type PriceVersion = {
  id: string;
  billingMode: "TOKEN" | "PAGE" | "REQUEST";
  currency: string;
  sourceUrl: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  rates: PriceRate[];
};

export type ProviderCatalogItem = {
  id: string;
  category: ProviderCategory;
  provider: string;
  externalKey: string;
  displayName: string;
  capabilities: unknown;
  status: "ACTIVE" | "DEPRECATED" | "DISABLED";
  deprecationNote: string | null;
  credentialConfigured: boolean;
  createdAt: string | null;
  updatedAt: string;
  priceVersions: PriceVersion[];
};

export type AiModelOption = {
  id: string;
  provider: string;
  externalKey: string;
  displayName: string;
  capabilities: unknown;
  status: "ACTIVE" | "DEPRECATED" | "DISABLED";
  credentialConfigured: boolean;
};

export type AiFeatureConfiguration = {
  feature: AiFeature;
  purpose: AiModelPurpose;
  primaryCatalogItemId: string | null;
  fallbackCatalogItemId: string | null;
  temperature: number | null;
  reasoningEffort: string | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  fallbackTemperature: number | null;
  fallbackReasoningEffort: string | null;
  fallbackMaxOutputTokens: number | null;
  version: number;
  updatedAt: string;
};

export type AiConfigurationsResponse = {
  configurations: AiFeatureConfiguration[];
  models: AiModelOption[];
};

export type ProviderBudget = {
  scope: "ALL" | "AI" | "OCR";
  monthlyLimitVnd: number;
  warningThresholds: number[];
  hardStop: boolean;
  version: number;
  usedVnd: number;
  reservedVnd: number;
  availableVnd: number;
  enforcementState: "BLOCKED" | "ENFORCED" | "MONITORING";
  usedPercent: number;
  updatedAt: string;
};

export type ProviderOverview = {
  period: { from: string; to: string };
  totalCostVnd: number;
  savedCostVnd: number;
  calls: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  budgets: ProviderBudget[];
  accounting: AccountingSettings;
  latestUsageAt: string | null;
};

export type AccountingSettings = {
  timezone: string;
  weekStartsOn: number;
  fxRateVndPerUsd: number;
  priceFreshnessDays: number;
  version: number;
  updatedAt: string;
};

export type OcrSettings = {
  provider: string;
  paidEnabled: boolean;
  cacheEnabled: boolean;
  credentialConfigured: boolean;
  monthlyBudgetVnd: number;
  hardStop: boolean;
  accounting: AccountingSettings;
  services: Array<{
    id: string;
    provider: string;
    displayName: string;
    externalKey: string;
    status: string;
    latestPrice: PriceVersion | null;
  }>;
};

export type TimelineResponse = {
  from: string;
  to: string;
  granularity: UsageGranularity;
  points: Array<{
    bucket: string;
    costVnd: number;
    savedCostVnd: number;
    calls: number;
    failed: number;
    totalTokens: number;
    pages: number;
  }>;
};

export type UsageBreakdownItem = {
  category: ProviderCategory;
  provider: string;
  catalogItemId: string | null;
  model: { displayName: string; externalKey: string } | null;
  feature: AiFeature | null;
  calls: number;
  costVnd: number;
  savedCostVnd: number;
  totalTokens: number;
  pages: number;
};

export type UsageEvent = {
  id: string;
  category: ProviderCategory;
  provider: string;
  feature: AiFeature | null;
  purpose: AiModelPurpose | null;
  operation: ProviderUsageOperation | null;
  targetContext?: ProviderUsageTargetContext | null;
  targetLabel?: string;
  reasoningEffort: string | null;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  cacheStatus: string | null;
  totalTokens: number;
  pages: number;
  promptTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  fxRateVndPerUsd: number;
  costVnd: number;
  estimatedSavedCostVnd: number;
  latencyMs: number | null;
  createdAt: string;
  catalogItem: { displayName: string; externalKey: string } | null;
  backgroundJob: {
    queue: string;
    resourceType: string | null;
  } | null;
  aiGeneration: {
    id: string;
    type: AiFeature;
    totalCostVnd: number | null;
    usageEventCount: number;
  } | null;
  priceVersion?: {
    rates: Array<{
      metric: "INPUT_TOKEN" | "CACHED_INPUT_TOKEN" | "OUTPUT_TOKEN" | "PAGE" | "REQUEST";
      unitSize: number;
      unitPriceUsd: number;
    }>;
  } | null;
  rawUsageJson?: unknown;
};

export type UsageEventsResponse = {
  items: UsageEvent[];
  summary: { totalCostVnd: number; totalCalls: number };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  actorUserId: string | null;
  createdAt: string;
};
