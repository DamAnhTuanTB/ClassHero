import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiGenerationType,
  AiModelPurpose,
  Prisma,
  ProviderBudgetReservationStatus,
  ProviderBudgetScope,
  ProviderCatalogCategory,
  ProviderUsageStatus,
  ProviderUsageMetric,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  isAiProviderOutputError,
  type AiProviderOutputFailureDetails,
} from "#api/modules/ai/utils/ai-output-validation";
import type {
  PriceRateSnapshot,
  ProviderUsageAmounts,
  ProviderUsageOperation,
} from "#api/modules/provider-operations/types/provider-operations.types";
import {
  calculateProviderCost,
  estimateProviderReservation,
} from "#api/modules/provider-operations/utils/provider-cost-calculator";
import {
  ProviderBudgetError,
  providerBudgetErrorCodes,
} from "#api/modules/provider-operations/utils/provider-budget-error";
import { lockProviderBudgetScopes } from "#api/modules/provider-operations/utils/provider-budget-lock";
import { getProviderBudgetPeriod } from "#api/modules/provider-operations/utils/provider-budget-period";

type StartUsageInput = {
  category: ProviderCatalogCategory;
  provider: string;
  catalogItemId?: string | null;
  priceVersionId?: string | null;
  aiGenerationId?: string | null;
  backgroundJobId?: string | null;
  sourceDocumentId?: string | null;
  feature?: AiGenerationType | null;
  purpose?: AiModelPurpose | null;
  operation?: ProviderUsageOperation | null;
  reasoningEffort?: string | null;
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

type FailUsageInput = {
  rates?: PriceRateSnapshot[];
};

export type ProviderReservationInput = {
  idempotencyKey: string;
  usageUpperBound: ProviderUsageAmounts;
  rates: PriceRateSnapshot[];
  requiredMetrics: ProviderUsageMetric[];
  estimateUnavailableReason?: string;
};

const ACTIVE_RESERVATION_STATUSES = [
  ProviderBudgetReservationStatus.RESERVED,
  ProviderBudgetReservationStatus.UNCERTAIN,
] as const;

const RESERVATION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ProviderUsageService {
  private readonly logger = new Logger(ProviderUsageService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async start(input: StartUsageInput) {
    const settings = await this.getAccountingSettings();
    return this.createUsageEvent(this.prisma, input, settings.fxRateVndPerUsd);
  }

  async reserveAndStart(input: StartUsageInput, reservation: ProviderReservationInput) {
    return this.reserveUsage(input, reservation);
  }

  async ensureReservation(usageEventId: string, reservation: ProviderReservationInput) {
    const event = await this.prisma.providerUsageEvent.findUniqueOrThrow({
      where: { id: usageEventId },
      select: {
        id: true,
        category: true,
        provider: true,
        catalogItemId: true,
        priceVersionId: true,
        aiGenerationId: true,
        backgroundJobId: true,
        sourceDocumentId: true,
        feature: true,
        purpose: true,
        operation: true,
        reasoningEffort: true,
        attempt: true,
        cacheStatus: true,
        createdAt: true,
        fxRateVndPerUsd: true,
      },
    });
    return this.reserveUsage(
      {
        category: event.category,
        provider: event.provider,
        catalogItemId: event.catalogItemId,
        priceVersionId: event.priceVersionId,
        aiGenerationId: event.aiGenerationId,
        backgroundJobId: event.backgroundJobId,
        sourceDocumentId: event.sourceDocumentId,
        feature: event.feature,
        purpose: event.purpose,
        operation: event.operation as ProviderUsageOperation | null,
        reasoningEffort: event.reasoningEffort,
        attempt: event.attempt,
        cacheStatus: event.cacheStatus,
      },
      reservation,
      { id: event.id, createdAt: event.createdAt },
    );
  }

  async succeed(eventId: string, input: FinishUsageInput) {
    const event = await this.prisma.providerUsageEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: {
        fxRateVndPerUsd: true,
        budgetReservation: {
          select: { id: true, reservedVnd: true, status: true },
        },
      },
    });
    const fxRate = event.fxRateVndPerUsd.toNumber();
    const cost = calculateProviderCost(input, input.rates ?? [], fxRate);
    const isSaving = input.savedCost === true;

    const settledVnd = isSaving ? 0 : cost.costVnd;
    if (event.budgetReservation && settledVnd > event.budgetReservation.reservedVnd) {
      this.logger.error(
        `Provider usage ${eventId} settled at ${settledVnd} VND above reservation ${event.budgetReservation.reservedVnd} VND.`,
      );
    }
    const finishedAt = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.providerUsageEvent.update({
        where: { id: eventId },
        data: {
          status: ProviderUsageStatus.SUCCEEDED,
          providerRequestId: input.providerRequestId,
          promptTokens: Math.max(0, input.promptTokens ?? 0),
          cachedInputTokens: Math.max(0, input.cachedInputTokens ?? 0),
          cacheWriteInputTokens: Math.max(0, input.cacheWriteInputTokens ?? 0),
          completionTokens: Math.max(0, input.completionTokens ?? 0),
          totalTokens: Math.max(0, input.totalTokens ?? 0),
          pages: Math.max(0, input.pages ?? 0),
          requestCount: Math.max(0, input.requestCount ?? 1),
          rawUsageJson:
            input.rawUsage === undefined
              ? undefined
              : (JSON.parse(JSON.stringify(input.rawUsage)) as Prisma.InputJsonValue),
          estimatedCostUsd: isSaving ? 0 : cost.costUsd,
          costVnd: settledVnd,
          estimatedSavedCostUsd: isSaving ? cost.costUsd : 0,
          estimatedSavedCostVnd: isSaving ? cost.costVnd : 0,
          latencyMs: input.latencyMs,
          finishedAt,
        },
        select: { id: true, costVnd: true, estimatedCostUsd: true },
      });
      if (event.budgetReservation) {
        await transaction.providerBudgetReservation.update({
          where: { id: event.budgetReservation.id },
          data: {
            status: ProviderBudgetReservationStatus.SETTLED,
            settledVnd,
            settledAt: finishedAt,
            heartbeatAt: finishedAt,
          },
        });
      }
      return updated;
    });
  }

  async fail(eventId: string, error: unknown, input: FailUsageInput = {}) {
    const event = await this.prisma.providerUsageEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: {
        fxRateVndPerUsd: true,
        budgetReservation: {
          select: { id: true, reservedVnd: true, status: true },
        },
      },
    });
    const finishedAt = new Date();
    const providerFailure = isAiProviderOutputError(error) ? error.details : null;
    const measuredUsage = providerFailure?.usage;
    const measuredCost =
      measuredUsage && (input.rates?.length ?? 0) > 0
        ? calculateProviderCost(
            { ...measuredUsage, requestCount: 1 },
            input.rates ?? [],
            event.fxRateVndPerUsd.toNumber(),
          )
        : null;
    const reservationStatus = measuredCost
      ? ProviderBudgetReservationStatus.SETTLED
      : providerFailure || isBillingUncertain(error)
        ? ProviderBudgetReservationStatus.UNCERTAIN
        : ProviderBudgetReservationStatus.RELEASED;
    const settledVnd = measuredCost?.costVnd ?? 0;
    if (
      measuredCost &&
      event.budgetReservation &&
      settledVnd > event.budgetReservation.reservedVnd
    ) {
      this.logger.error(
        `Failed provider usage ${eventId} settled at ${settledVnd} VND above reservation ${event.budgetReservation.reservedVnd} VND.`,
      );
    }
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.providerUsageEvent.update({
        where: { id: eventId },
        data: {
          status: ProviderUsageStatus.FAILED,
          errorCode: getSafeErrorCode(error),
          ...(providerFailure?.providerRequestId
            ? { providerRequestId: providerFailure.providerRequestId }
            : {}),
          ...(measuredUsage
            ? {
                promptTokens: Math.max(0, measuredUsage.promptTokens ?? 0),
                cachedInputTokens: Math.max(0, measuredUsage.cachedInputTokens ?? 0),
                cacheWriteInputTokens: Math.max(
                  0,
                  measuredUsage.cacheWriteInputTokens ?? 0,
                ),
                completionTokens: Math.max(0, measuredUsage.completionTokens ?? 0),
                totalTokens: Math.max(0, measuredUsage.totalTokens ?? 0),
                requestCount: 1,
                estimatedCostUsd: measuredCost?.costUsd ?? 0,
                costVnd: settledVnd,
              }
            : {}),
          ...(providerFailure
            ? { rawUsageJson: toProviderFailureJson(providerFailure) }
            : {}),
          ...(providerFailure?.latencyMs === undefined
            ? {}
            : { latencyMs: providerFailure.latencyMs }),
          finishedAt,
        },
        select: { id: true, costVnd: true, estimatedCostUsd: true },
      });
      if (
        event.budgetReservation &&
        event.budgetReservation.status !== ProviderBudgetReservationStatus.SETTLED
      ) {
        await transaction.providerBudgetReservation.update({
          where: { id: event.budgetReservation.id },
          data: {
            status: reservationStatus,
            heartbeatAt: finishedAt,
            ...(reservationStatus === ProviderBudgetReservationStatus.SETTLED
              ? { settledVnd, settledAt: finishedAt }
              : reservationStatus === ProviderBudgetReservationStatus.RELEASED
                ? { settledAt: finishedAt }
                : {}),
          },
        });
      }
      return { ...updated, costMeasured: measuredCost !== null };
    });
  }

  async getCurrentBudgetCommitments(date = new Date()) {
    const settings = await this.getAccountingSettings();
    const period = getProviderBudgetPeriod(date, settings.timezone);
    const [costs, reservations] = await Promise.all([
      this.prisma.providerUsageEvent.groupBy({
        by: ["category"],
        where: { createdAt: { gte: period.start, lt: period.end } },
        _sum: { costVnd: true },
      }),
      this.prisma.providerBudgetReservation.groupBy({
        by: ["category"],
        where: {
          periodKey: period.key,
          status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        },
        _sum: { reservedVnd: true },
      }),
    ]);
    const valueFor = (
      rows: Array<{
        category: ProviderCatalogCategory;
        _sum: Record<string, number | null>;
      }>,
      category: ProviderCatalogCategory,
      field: string,
    ) => rows.find((row) => row.category === category)?._sum[field] ?? 0;
    const aiUsedVnd = valueFor(
      costs as Array<{
        category: ProviderCatalogCategory;
        _sum: Record<string, number | null>;
      }>,
      ProviderCatalogCategory.AI_MODEL,
      "costVnd",
    );
    const ocrUsedVnd = valueFor(
      costs as Array<{
        category: ProviderCatalogCategory;
        _sum: Record<string, number | null>;
      }>,
      ProviderCatalogCategory.OCR_SERVICE,
      "costVnd",
    );
    const aiReservedVnd = valueFor(
      reservations as Array<{
        category: ProviderCatalogCategory;
        _sum: Record<string, number | null>;
      }>,
      ProviderCatalogCategory.AI_MODEL,
      "reservedVnd",
    );
    const ocrReservedVnd = valueFor(
      reservations as Array<{
        category: ProviderCatalogCategory;
        _sum: Record<string, number | null>;
      }>,
      ProviderCatalogCategory.OCR_SERVICE,
      "reservedVnd",
    );
    return {
      period,
      aiUsedVnd,
      ocrUsedVnd,
      aiReservedVnd,
      ocrReservedVnd,
    };
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
      select: { fxRateVndPerUsd: true, timezone: true },
    });
  }

  private async reserveUsage(
    input: StartUsageInput,
    reservation: ProviderReservationInput,
    existingEvent?: { id: string; createdAt: Date },
  ) {
    const settings = await this.getAccountingSettings();
    const referenceDate = existingEvent?.createdAt ?? new Date();
    const period = getProviderBudgetPeriod(referenceDate, settings.timezone);
    const scopes = getBudgetScopes(input.category);
    return this.prisma.$transaction(
      async (transaction) => {
        // This must be the first statement in the transaction. Under READ COMMITTED,
        // a waiter then sees reservations committed by the previous lock holder.
        await lockProviderBudgetScopes(transaction, period.key, scopes);

        const duplicate = await transaction.providerBudgetReservation.findUnique({
          where: { idempotencyKey: reservation.idempotencyKey },
          select: {
            usageEvent: { select: { id: true, fxRateVndPerUsd: true } },
          },
        });
        if (duplicate) return duplicate.usageEvent;

        const policies = await transaction.providerBudgetPolicy.findMany({
          where: { scope: { in: scopes }, hardStop: true },
        });
        const event = existingEvent
          ? await transaction.providerUsageEvent.findUniqueOrThrow({
              where: { id: existingEvent.id },
              select: { id: true, fxRateVndPerUsd: true },
            })
          : null;
        if (policies.length === 0) {
          return (
            event ??
            (await this.createUsageEvent(transaction, input, settings.fxRateVndPerUsd))
          );
        }

        const estimate = estimateProviderReservation(
          reservation.usageUpperBound,
          reservation.rates,
          settings.fxRateVndPerUsd.toNumber(),
          reservation.requiredMetrics,
        );
        if (
          reservation.estimateUnavailableReason ||
          !input.priceVersionId ||
          reservation.rates.length === 0 ||
          estimate.missingMetrics.length > 0
        ) {
          throw new ProviderBudgetError(
            providerBudgetErrorCodes.ESTIMATE_UNAVAILABLE,
            reservation.estimateUnavailableReason ??
              "Không thể xác định chi phí tối đa nên yêu cầu đã được dừng trước khi gọi dịch vụ.",
            {
              category: input.category,
              missingMetrics: estimate.missingMetrics,
            },
          );
        }

        const [costs, activeReservations] = await Promise.all([
          transaction.providerUsageEvent.groupBy({
            by: ["category"],
            where: { createdAt: { gte: period.start, lt: period.end } },
            _sum: { costVnd: true },
          }),
          transaction.providerBudgetReservation.groupBy({
            by: ["category"],
            where: {
              periodKey: period.key,
              status: { in: [...ACTIVE_RESERVATION_STATUSES] },
            },
            _sum: { reservedVnd: true },
          }),
        ]);
        for (const policy of policies) {
          const usedVnd = sumForScope(costs, policy.scope, "costVnd");
          const reservedVnd = sumForScope(
            activeReservations,
            policy.scope,
            "reservedVnd",
          );
          const availableVnd = Math.max(
            0,
            policy.monthlyLimitVnd - usedVnd - reservedVnd,
          );
          if (estimate.costVnd > availableVnd) {
            throw new ProviderBudgetError(
              providerBudgetErrorCodes.HARD_LIMIT,
              `Đã đạt giới hạn ngân sách ${budgetScopeLabel(policy.scope)} trong tháng này.`,
              {
                scope: policy.scope,
                period: period.key,
                limitVnd: policy.monthlyLimitVnd,
                usedVnd,
                reservedVnd,
                requestedVnd: estimate.costVnd,
                availableVnd,
              },
            );
          }
        }

        const usageEvent =
          event ??
          (await this.createUsageEvent(transaction, input, settings.fxRateVndPerUsd));
        await transaction.providerBudgetReservation.create({
          data: {
            idempotencyKey: reservation.idempotencyKey,
            periodKey: period.key,
            category: input.category,
            reservedVnd: estimate.costVnd,
            usageEventId: usageEvent.id,
            backgroundJobId: input.backgroundJobId ?? null,
            aiGenerationId: input.aiGenerationId ?? null,
            sourceDocumentId: input.sourceDocumentId ?? null,
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
        });
        return usageEvent;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private createUsageEvent(
    client: PrismaService | Prisma.TransactionClient,
    input: StartUsageInput,
    fxRateVndPerUsd: Prisma.Decimal,
  ) {
    return client.providerUsageEvent.create({
      data: {
        category: input.category,
        provider: input.provider,
        catalogItemId: input.catalogItemId ?? null,
        priceVersionId: input.priceVersionId ?? null,
        aiGenerationId: input.aiGenerationId ?? null,
        backgroundJobId: input.backgroundJobId ?? null,
        sourceDocumentId: input.sourceDocumentId ?? null,
        feature: input.feature ?? null,
        purpose: input.purpose ?? null,
        operation: input.operation ?? null,
        reasoningEffort: input.reasoningEffort ?? null,
        attempt: Math.max(1, input.attempt ?? 1),
        cacheStatus: input.cacheStatus ?? null,
        fxRateVndPerUsd,
      },
      select: { id: true, fxRateVndPerUsd: true },
    });
  }
}

function getSafeErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 160);
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 160);
}

function toProviderFailureJson(details: AiProviderOutputFailureDetails) {
  return JSON.parse(
    JSON.stringify({
      providerUsage: details.providerUsageRaw ?? null,
      fileOperations: details.inputFileOperations ?? [],
      failure: {
        responseStatus: details.responseStatus,
        incompleteReason: details.incompleteReason,
        hasRefusal: details.hasRefusal,
        maxOutputTokens: details.maxOutputTokens,
        reasoningTokens: details.usage?.reasoningTokens,
      },
    }),
  ) as Prisma.InputJsonValue;
}

function getBudgetScopes(category: ProviderCatalogCategory): ProviderBudgetScope[] {
  return category === ProviderCatalogCategory.AI_MODEL
    ? [ProviderBudgetScope.ALL, ProviderBudgetScope.AI]
    : [ProviderBudgetScope.ALL, ProviderBudgetScope.OCR];
}

function sumForScope(
  rows: Array<{
    category: ProviderCatalogCategory;
    _sum: Record<string, number | null>;
  }>,
  scope: ProviderBudgetScope,
  field: string,
) {
  const valueFor = (category: ProviderCatalogCategory) =>
    rows.find((row) => row.category === category)?._sum[field] ?? 0;
  if (scope === ProviderBudgetScope.AI) {
    return valueFor(ProviderCatalogCategory.AI_MODEL);
  }
  if (scope === ProviderBudgetScope.OCR) {
    return valueFor(ProviderCatalogCategory.OCR_SERVICE);
  }
  return (
    valueFor(ProviderCatalogCategory.AI_MODEL) +
    valueFor(ProviderCatalogCategory.OCR_SERVICE)
  );
}

function budgetScopeLabel(scope: ProviderBudgetScope) {
  if (scope === ProviderBudgetScope.AI) return "tính năng AI";
  if (scope === ProviderBudgetScope.OCR) return "đọc tài liệu";
  return "tất cả dịch vụ";
}

function isBillingUncertain(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    status === 408 ||
    (typeof status === "number" && status >= 500) ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection reset") ||
    message.includes("network")
  );
}
