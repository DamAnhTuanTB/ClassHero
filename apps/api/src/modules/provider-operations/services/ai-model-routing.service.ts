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
import type { EnvConfig } from "#api/config/env.validation";
import type {
  AiFeatureRoute,
  ProviderRouteCandidate,
} from "#api/modules/provider-operations/types/provider-operations.types";

const EDITABLE_FEATURES = new Set<AiGenerationType>([
  AiGenerationType.SUMMARY,
  AiGenerationType.QUIZ,
  AiGenerationType.FLASHCARD,
  AiGenerationType.TEST,
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

  private getEnvironmentFallback(
    feature: AiGenerationType,
    purpose: AiModelPurpose,
  ): AiFeatureRoute {
    const model = this.configService.get("OPENAI_STRUCTURED_MODEL", { infer: true });
    return {
      feature,
      purpose,
      version: 0,
      model: "default-model",
      temperature: null,
      reasoningEffort: null,
      maxInputTokens: null,
      maxOutputTokens: null,
      candidates: [
        {
          catalogItemId: null,
          priceVersionId: null,
          category: ProviderCatalogCategory.AI_MODEL,
          provider: AiProviderName.OPENAI,
          model,
          maxInputTokens: null,
          available: this.isCredentialConfigured(AiProviderName.OPENAI),
          rates: [],
        },
      ],
      hasConfiguration: false,
    };
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
