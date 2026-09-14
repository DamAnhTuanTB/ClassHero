import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiGenerationType,
  AiModelPurpose,
  AiProviderName,
  ProviderCatalogCategory,
  ProviderCatalogStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { throwBadRequest } from "#api/common/errors/api-exception";
import type { EnvConfig } from "#api/config/env.validation";
import type {
  AiFeatureRoute,
  AiFeatureRouteOverride,
  ProviderRouteCandidate,
} from "#api/modules/provider-operations/types/provider-operations.types";

const EDITABLE_FEATURES = new Set<AiGenerationType>([
  AiGenerationType.SUMMARY,
  AiGenerationType.VIDEO_SUMMARY,
  AiGenerationType.QUIZ,
  AiGenerationType.FLASHCARD,
  AiGenerationType.TEST,
  AiGenerationType.CHAT,
]);

@Injectable()
export class AiModelRoutingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async resolve(
    feature: AiGenerationType,
    purpose: AiModelPurpose = AiModelPurpose.TEXT,
  ): Promise<AiFeatureRoute> {
    if (!EDITABLE_FEATURES.has(feature)) {
      return this.getEnvironmentFallback(feature, purpose);
    }

    const configuration = await this.prisma.aiFeatureModelConfig.findUnique({
      where: { feature_purpose: { feature, purpose } },
      include: {
        primaryCatalogItem: {
          include: { priceVersions: priceVersionInclude() },
        },
        fallbackCatalogItem: {
          include: { priceVersions: priceVersionInclude() },
        },
      },
    });

    if (!configuration) {
      return this.getEnvironmentFallback(feature, purpose);
    }

    const candidates = [
      this.toCandidate(configuration.primaryCatalogItem),
      configuration.fallbackCatalogItem
        ? this.toCandidate(configuration.fallbackCatalogItem)
        : null,
    ].filter((candidate): candidate is ProviderRouteCandidate => candidate !== null);

    return {
      feature,
      purpose,
      version: configuration.version,
      model: configuration.primaryCatalogItem.externalKey,
      temperature: configuration.temperature?.toNumber() ?? null,
      reasoningEffort: configuration.reasoningEffort ?? null,
      maxInputTokens: configuration.maxInputTokens,
      maxOutputTokens: configuration.maxOutputTokens,
      fallbackTemperature:
        configuration.fallbackTemperature?.toNumber() ?? null,
      fallbackReasoningEffort: configuration.fallbackReasoningEffort ?? null,
      fallbackMaxInputTokens: configuration.fallbackMaxInputTokens ?? null,
      fallbackMaxOutputTokens: configuration.fallbackMaxOutputTokens ?? null,
      candidates,
      hasConfiguration: true,
    };
  }

  async getAllActiveModels(): Promise<ProviderRouteCandidate[]> {
    const items = await this.prisma.providerCatalogItem.findMany({
      where: {
        status: ProviderCatalogStatus.ACTIVE,
        category: ProviderCatalogCategory.AI_MODEL,
      },
      include: { priceVersions: priceVersionInclude() },
    });

    // Sort by provider and then by release date (effectiveFrom desc)
    items.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      const dateA = a.priceVersions[0]?.effectiveFrom?.getTime() ?? 0;
      const dateB = b.priceVersions[0]?.effectiveFrom?.getTime() ?? 0;
      if (dateA !== dateB) return dateB - dateA; // descending
      return a.externalKey.localeCompare(b.externalKey);
    });

    return items
      .map((item) => this.toCandidate(item))
      .filter((candidate) => candidate.available);
  }

  async resolveChatOverride(
    override: AiFeatureRouteOverride | null | undefined,
  ): Promise<AiFeatureRoute> {
    const base = await this.resolve(AiGenerationType.CHAT, AiModelPurpose.TEXT);
    if (!override || Object.keys(override).length === 0) return base;

    if (override.temperature != null && override.reasoningEffort != null) {
      throwBadRequest(
        "AI_CHAT_CONFIGURATION_CONFLICT",
        "Chỉ được đặt temperature hoặc reasoning effort cho một cấu hình phiên.",
      );
    }
    if (
      override.fallbackTemperature != null &&
      override.fallbackReasoningEffort != null
    ) {
      throwBadRequest(
        "AI_CHAT_FALLBACK_CONFIGURATION_CONFLICT",
        "Model dự phòng chỉ được đặt temperature hoặc reasoning effort.",
      );
    }

    const requestedIds = [
      override.primaryCatalogItemId,
      override.fallbackCatalogItemId,
    ].filter((value): value is string => typeof value === "string");
    const requestedItems = requestedIds.length
      ? await this.prisma.providerCatalogItem.findMany({
          where: {
            id: { in: requestedIds },
            category: ProviderCatalogCategory.AI_MODEL,
            status: ProviderCatalogStatus.ACTIVE,
          },
          include: { priceVersions: priceVersionInclude() },
        })
      : [];
    if (requestedItems.length !== new Set(requestedIds).size) {
      throwBadRequest(
        "AI_CHAT_CONFIGURATION_MODEL_INVALID",
        "Model được chọn cho phiên Chat AI không còn khả dụng.",
      );
    }
    if (
      requestedItems.some(
        (item) => !hasFeatureCapability(item.capabilitiesJson, AiGenerationType.CHAT),
      )
    ) {
      throwBadRequest(
        "AI_CHAT_CONFIGURATION_MODEL_UNSUPPORTED",
        "Model được chọn không hỗ trợ tính năng Chat AI.",
      );
    }
    const requestedCandidates = new Map(
      requestedItems.map((item) => [item.id, this.toCandidate(item)]),
    );
    const primary = override.primaryCatalogItemId
      ? requestedCandidates.get(override.primaryCatalogItemId)
      : base.candidates[0];
    const fallback = Object.prototype.hasOwnProperty.call(
      override,
      "fallbackCatalogItemId",
    )
      ? override.fallbackCatalogItemId
        ? requestedCandidates.get(override.fallbackCatalogItemId)
        : null
      : base.candidates[1] ?? null;
    if (!primary?.available) {
      throwBadRequest(
        "AI_CHAT_CONFIGURATION_CREDENTIAL_MISSING",
        "Model chính của phiên Chat AI chưa có credential khả dụng.",
      );
    }
    if (fallback && !fallback.available) {
      throwBadRequest(
        "AI_CHAT_CONFIGURATION_FALLBACK_CREDENTIAL_MISSING",
        "Model dự phòng của phiên Chat AI chưa có credential khả dụng.",
      );
    }
    if (fallback && fallback.catalogItemId === primary.catalogItemId) {
      throwBadRequest(
        "AI_CHAT_CONFIGURATION_FALLBACK_DUPLICATE",
        "Model dự phòng phải khác model chính.",
      );
    }

    assertSupportedInferenceControl(
      primary.capabilitiesJson,
      override.temperature,
      override.reasoningEffort,
    );
    if (fallback) {
      assertSupportedInferenceControl(
        fallback.capabilitiesJson,
        override.fallbackTemperature,
        override.fallbackReasoningEffort,
      );
    } else if (
      override.fallbackTemperature !== undefined ||
      override.fallbackReasoningEffort !== undefined ||
      override.fallbackMaxOutputTokens !== undefined
    ) {
      throwBadRequest(
        "AI_CHAT_FALLBACK_CONFIGURATION_WITHOUT_MODEL",
        "Hãy chọn model dự phòng trước khi thiết lập tham số riêng.",
      );
    }
    const inheritsPrimary =
      primary.catalogItemId === base.candidates[0]?.catalogItemId;
    const inheritsFallback =
      fallback?.catalogItemId === base.candidates[1]?.catalogItemId;
    const temperature =
      override.temperature === undefined
        ? inheritsPrimary
          ? base.temperature
          : null
        : override.temperature;
    const reasoningEffort =
      override.reasoningEffort === undefined
        ? inheritsPrimary
          ? base.reasoningEffort
          : null
        : override.reasoningEffort;
    const fallbackTemperature = fallback
      ? override.fallbackTemperature === undefined
        ? inheritsFallback
          ? (base.fallbackTemperature ?? null)
          : null
        : override.fallbackTemperature
      : null;
    const fallbackReasoningEffort = fallback
      ? override.fallbackReasoningEffort === undefined
        ? inheritsFallback
          ? (base.fallbackReasoningEffort ?? null)
          : null
        : override.fallbackReasoningEffort
      : null;
    const fallbackMaxOutputTokens = fallback
      ? override.fallbackMaxOutputTokens === undefined
        ? inheritsFallback
          ? (base.fallbackMaxOutputTokens ?? null)
          : null
        : override.fallbackMaxOutputTokens
      : null;
    const fallbackMaxInputTokens = fallback
      ? inheritsFallback
        ? (base.fallbackMaxInputTokens ?? base.maxInputTokens ?? null)
        : null
      : null;
    assertSupportedInferenceControl(
      primary.capabilitiesJson,
      temperature,
      reasoningEffort,
    );
    if (fallback) {
      assertSupportedInferenceControl(
        fallback.capabilitiesJson,
        fallbackTemperature,
        fallbackReasoningEffort,
      );
    }
    return {
      ...base,
      model: primary.model,
      temperature,
      reasoningEffort,
      maxInputTokens: override.maxInputTokens ?? base.maxInputTokens,
      maxOutputTokens: override.maxOutputTokens ?? base.maxOutputTokens,
      fallbackTemperature,
      fallbackReasoningEffort,
      fallbackMaxInputTokens,
      fallbackMaxOutputTokens,
      candidates: [primary, ...(fallback ? [fallback] : [])],
    };
  }

  async resolveCandidateByModel(modelName: string): Promise<ProviderRouteCandidate | null> {
    const item = await this.prisma.providerCatalogItem.findFirst({
      where: {
        externalKey: modelName,
        status: ProviderCatalogStatus.ACTIVE,
        category: ProviderCatalogCategory.AI_MODEL,
      },
      include: { priceVersions: priceVersionInclude() },
    });
    if (!item) {
      return null;
    }
    return this.toCandidate(item);
  }

  isCredentialConfigured(provider: string): boolean {
    if (provider === AiProviderName.OPENAI) {
      return Boolean(this.configService.get("OPENAI_API_KEY", { infer: true }));
    }
    if (provider === AiProviderName.GEMINI) {
      return Boolean(this.configService.get("GEMINI_API_KEY", { infer: true }));
    }
    if (provider === "MATHPIX") {
      return Boolean(
        this.configService.get("MATHPIX_APP_ID", { infer: true }) &&
        this.configService.get("MATHPIX_APP_KEY", { infer: true }),
      );
    }
    return false;
  }

  private toCandidate(item: {
    id: string;
    category: ProviderCatalogCategory;
    provider: string;
    externalKey: string;
    status: ProviderCatalogStatus;
    capabilitiesJson?: import("@prisma/client").Prisma.JsonValue | null;
    priceVersions: Array<{
      id: string;
      rates: Array<{
        metric: import("@prisma/client").ProviderUsageMetric;
        unitSize: import("@prisma/client").Prisma.Decimal;
        unitPriceUsd: import("@prisma/client").Prisma.Decimal;
        tierFrom: number | null;
        tierTo: number | null;
        conditionsJson: import("@prisma/client").Prisma.JsonValue | null;
      }>;
    }>;
  }): ProviderRouteCandidate {
    const price = item.priceVersions[0];
    const provider = parseAiProvider(item.provider);
    const maxInputTokens = readMaxInputTokens(price?.rates ?? []);
    return {
      catalogItemId: item.id,
      priceVersionId: price?.id ?? null,
      category: item.category,
      provider,
      model: item.externalKey,
      maxInputTokens,
      available:
        item.status === ProviderCatalogStatus.ACTIVE &&
        this.isCredentialConfigured(item.provider),
      capabilitiesJson: item.capabilitiesJson,
      rates:
        price?.rates.map((rate) => ({
          metric: rate.metric,
          unitSize: rate.unitSize.toNumber(),
          unitPriceUsd: rate.unitPriceUsd.toNumber(),
          tierFrom: rate.tierFrom,
          tierTo: rate.tierTo,
        })) ?? [],
    };
  }

  private async getEnvironmentFallback(
    feature: AiGenerationType,
    purpose: AiModelPurpose,
  ): Promise<AiFeatureRoute> {
    const model = this.configService.get(
      feature === AiGenerationType.CHAT ? "OPENAI_CHAT_MODEL" : "OPENAI_STRUCTURED_MODEL",
      { infer: true },
    );
    const catalogItem = await this.prisma.providerCatalogItem.findFirst({
      where: {
        externalKey: model,
        provider: AiProviderName.OPENAI,
        status: ProviderCatalogStatus.ACTIVE,
        category: ProviderCatalogCategory.AI_MODEL,
      },
      include: { priceVersions: priceVersionInclude() },
    });
    const fallbackCandidate = catalogItem
      ? this.toCandidate(catalogItem)
      : {
          catalogItemId: null,
          priceVersionId: null,
          category: ProviderCatalogCategory.AI_MODEL,
          provider: AiProviderName.OPENAI,
          model,
          maxInputTokens:
            feature === AiGenerationType.CHAT
              ? this.configService.get("AI_CHAT_MAX_INPUT_TOKENS", { infer: true })
              : null,
          available: this.isCredentialConfigured(AiProviderName.OPENAI),
          rates: [],
        };
    return {
      feature,
      purpose,
      version: 0,
      model: "default-model",
      temperature: null,
      reasoningEffort: null,
      maxInputTokens:
        feature === AiGenerationType.CHAT
          ? this.configService.get("AI_CHAT_MAX_INPUT_TOKENS", { infer: true })
          : null,
      maxOutputTokens:
        feature === AiGenerationType.CHAT
          ? this.configService.get("AI_CHAT_MAX_OUTPUT_TOKENS", { infer: true })
          : null,
      fallbackTemperature: null,
      fallbackReasoningEffort: null,
      fallbackMaxInputTokens: null,
      fallbackMaxOutputTokens: null,
      candidates: [fallbackCandidate],
      hasConfiguration: false,
    };
  }
}

function hasFeatureCapability(
  value: import("@prisma/client").Prisma.JsonValue | null,
  feature: AiGenerationType,
) {
  if (Array.isArray(value)) return value.includes(feature);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const features = (value as Record<string, unknown>).features;
  return Array.isArray(features) && features.includes(feature);
}

function assertSupportedInferenceControl(
  value: import("@prisma/client").Prisma.JsonValue | null | undefined,
  temperature: number | null | undefined,
  reasoningEffort: string | null | undefined,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const configuration = (value as Record<string, unknown>).aiConfiguration;
  if (temperature != null && configuration === "REASONING_EFFORT") {
    throwBadRequest(
      "AI_CHAT_TEMPERATURE_UNSUPPORTED",
      "Model đã chọn dùng reasoning effort và không nhận temperature.",
    );
  }
  if (reasoningEffort != null && configuration !== "REASONING_EFFORT") {
    throwBadRequest(
      "AI_CHAT_REASONING_EFFORT_UNSUPPORTED",
      "Model đã chọn không hỗ trợ reasoning effort.",
    );
  }
  const levels = (value as Record<string, unknown>).reasoningEffortLevels;
  if (
    reasoningEffort != null &&
    Array.isArray(levels) &&
    !levels.includes(reasoningEffort)
  ) {
    throwBadRequest(
      "AI_CHAT_REASONING_EFFORT_INVALID",
      "Mức reasoning effort không được model đã chọn hỗ trợ.",
    );
  }
}

function priceVersionInclude() {
  const now = new Date();
  return {
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" as const },
    take: 1,
    include: { rates: true },
  };
}

function parseAiProvider(provider: string): AiProviderName {
  if (provider === AiProviderName.OPENAI || provider === AiProviderName.GEMINI) {
    return provider;
  }
  throw new Error(`Catalog provider ${provider} is not an AI provider.`);
}

function readMaxInputTokens(
  rates: Array<{ conditionsJson: import("@prisma/client").Prisma.JsonValue | null }>,
) {
  for (const rate of rates) {
    if (
      rate.conditionsJson &&
      typeof rate.conditionsJson === "object" &&
      !Array.isArray(rate.conditionsJson)
    ) {
      const value = (rate.conditionsJson as Record<string, unknown>).maxInputTokens;
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
      }
    }
  }
  return null;
}
