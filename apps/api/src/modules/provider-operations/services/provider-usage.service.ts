import { Inject, Injectable } from "@nestjs/common";
import {
  AiGenerationType,
  Prisma,
  ProviderCatalogCategory,
  ProviderUsageStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  PriceRateSnapshot,
  ProviderUsageAmounts,
} from "#api/modules/provider-operations/types/provider-operations.types";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

type StartUsageInput = {
  category: ProviderCatalogCategory;
  provider: string;
  catalogItemId?: string | null;
  priceVersionId?: string | null;
  aiGenerationId?: string | null;
  backgroundJobId?: string | null;
  sourceDocumentId?: string | null;
  feature?: AiGenerationType | null;
  attempt?: number;
  cacheStatus?: string | null;
};

type FinishUsageInput = ProviderUsageAmounts & {
  providerRequestId?: string;
  latencyMs?: number;
  rawUsage?: unknown;
  rates?: PriceRateSnapshot[];
  savedCost?: boolean;
};

@Injectable()
export class ProviderUsageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertBudgetAllows(category: ProviderCatalogCategory) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const scopes =
      category === ProviderCatalogCategory.AI_MODEL
        ? ["ALL", "AI"] as const
        : ["ALL", "OCR"] as const;
    const [policies, aggregate] = await Promise.all([
      this.prisma.providerBudgetPolicy.findMany({
        where: { scope: { in: [...scopes] }, hardStop: true },
      }),
      this.prisma.providerUsageEvent.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { costVnd: true },
      }),
    ]);
    const totalUsed = aggregate._sum.costVnd ?? 0;
    for (const policy of policies) {
      const used =
        policy.scope === "ALL"
          ? totalUsed
          : (
              await this.prisma.providerUsageEvent.aggregate({
                where: { createdAt: { gte: monthStart }, category },
                _sum: { costVnd: true },
              })
            )._sum.costVnd ?? 0;
      if (used >= policy.monthlyLimitVnd) {
        throw new Error(
          `PROVIDER_BUDGET_HARD_LIMIT: ${policy.scope} monthly budget has been reached.`,
        );
      }
    }
  }

  async start(input: StartUsageInput) {
    const settings = await this.getAccountingSettings();
    return this.prisma.providerUsageEvent.create({
      data: {
        category: input.category,
        provider: input.provider,
        catalogItemId: input.catalogItemId ?? null,
        priceVersionId: input.priceVersionId ?? null,
        aiGenerationId: input.aiGenerationId ?? null,
        backgroundJobId: input.backgroundJobId ?? null,
        sourceDocumentId: input.sourceDocumentId ?? null,
        feature: input.feature ?? null,
        attempt: Math.max(1, input.attempt ?? 1),
        cacheStatus: input.cacheStatus ?? null,
        fxRateVndPerUsd: settings.fxRateVndPerUsd,
      },
      select: { id: true, fxRateVndPerUsd: true },
    });
  }

  async succeed(eventId: string, input: FinishUsageInput) {
    const event = await this.prisma.providerUsageEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: { fxRateVndPerUsd: true },
    });
    const fxRate = event.fxRateVndPerUsd.toNumber();
    const cost = calculateProviderCost(input, input.rates ?? [], fxRate);
    const isSaving = input.savedCost === true;

    return this.prisma.providerUsageEvent.update({
      where: { id: eventId },
      data: {
        status: ProviderUsageStatus.SUCCEEDED,
        providerRequestId: input.providerRequestId,
        promptTokens: Math.max(0, input.promptTokens ?? 0),
        cachedInputTokens: Math.max(0, input.cachedInputTokens ?? 0),
        completionTokens: Math.max(0, input.completionTokens ?? 0),
        totalTokens: Math.max(0, input.totalTokens ?? 0),
        pages: Math.max(0, input.pages ?? 0),
        requestCount: Math.max(0, input.requestCount ?? 1),
        rawUsageJson:
          input.rawUsage === undefined
            ? undefined
            : (JSON.parse(JSON.stringify(input.rawUsage)) as Prisma.InputJsonValue),
        estimatedCostUsd: isSaving ? 0 : cost.costUsd,
        costVnd: isSaving ? 0 : cost.costVnd,
        estimatedSavedCostUsd: isSaving ? cost.costUsd : 0,
        estimatedSavedCostVnd: isSaving ? cost.costVnd : 0,
        latencyMs: input.latencyMs,
        finishedAt: new Date(),
      },
      select: { id: true, costVnd: true, estimatedCostUsd: true },
    });
  }

  fail(eventId: string, error: unknown) {
    return this.prisma.providerUsageEvent.update({
      where: { id: eventId },
      data: {
        status: ProviderUsageStatus.FAILED,
        errorCode: getSafeErrorCode(error),
        finishedAt: new Date(),
      },
    });
  }

  async getActiveRates(catalogItemId: string) {
    const now = new Date();
    const version = await this.prisma.providerPriceVersion.findFirst({
      where: {
        catalogItemId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: "desc" },
      include: { rates: true },
    });
    return {
      priceVersionId: version?.id ?? null,
      rates:
        version?.rates.map((rate) => ({
          metric: rate.metric,
          unitSize: rate.unitSize.toNumber(),
          unitPriceUsd: rate.unitPriceUsd.toNumber(),
          tierFrom: rate.tierFrom,
          tierTo: rate.tierTo,
        })) ?? [],
    };
  }

  private async getAccountingSettings() {
    return this.prisma.providerAccountingSetting.upsert({
      where: { singletonKey: "default" },
      create: { singletonKey: "default" },
      update: {},
      select: { fxRateVndPerUsd: true },
    });
  }
}

function getSafeErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 160);
}
