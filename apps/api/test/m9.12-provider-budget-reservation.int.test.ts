import "dotenv/config";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import {
  AiProviderName,
  Prisma,
  ProviderBillingMode,
  ProviderBudgetReservationStatus,
  ProviderBudgetScope,
  ProviderCatalogCategory,
  ProviderUsageMetric,
  ProviderUsageStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { AiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import { isProviderBudgetError } from "#api/modules/provider-operations/utils/provider-budget-error";

const runId = randomUUID();
const provider = `M9_12_TEST_${runId}`;

describe("M9.12 atomic provider budget reservation", () => {
  let prisma: PrismaService;
  let usage: ProviderUsageService;
  let catalogItemId: string;
  let priceVersionId: string;
  let ocrCatalogItemId: string;
  let ocrPriceVersionId: string;
  let originalPolicies: Array<{
    scope: ProviderBudgetScope;
    monthlyLimitVnd: number;
    warningThresholds: Prisma.JsonValue;
    hardStop: boolean;
    version: number;
    updatedByUserId: string | null;
  }> = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService() as ConfigService<EnvConfig, true>);
    await prisma.$connect();
    usage = new ProviderUsageService(prisma);
    originalPolicies = await prisma.providerBudgetPolicy.findMany({
      select: {
        scope: true,
        monthlyLimitVnd: true,
        warningThresholds: true,
        hardStop: true,
        version: true,
        updatedByUserId: true,
      },
    });
    const catalog = await prisma.providerCatalogItem.create({
      data: {
        category: ProviderCatalogCategory.AI_MODEL,
        provider,
        externalKey: "atomic-reservation",
        displayName: "Atomic reservation test",
        priceVersions: {
          create: {
            billingMode: ProviderBillingMode.REQUEST,
            currency: "USD",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            rates: {
              create: {
                metric: ProviderUsageMetric.REQUEST,
                unitSize: 1,
                unitPriceUsd: 0.004,
              },
            },
          },
        },
      },
      include: { priceVersions: true },
    });
    catalogItemId = catalog.id;
    priceVersionId = catalog.priceVersions[0]!.id;
    const ocrCatalog = await prisma.providerCatalogItem.create({
      data: {
        category: ProviderCatalogCategory.OCR_SERVICE,
        provider,
        externalKey: "atomic-reservation-ocr",
        displayName: "Atomic OCR reservation test",
        priceVersions: {
          create: {
            billingMode: ProviderBillingMode.REQUEST,
            currency: "USD",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            rates: {
              create: {
                metric: ProviderUsageMetric.REQUEST,
                unitSize: 1,
                unitPriceUsd: 0.004,
              },
            },
          },
        },
      },
      include: { priceVersions: true },
    });
    ocrCatalogItemId = ocrCatalog.id;
    ocrPriceVersionId = ocrCatalog.priceVersions[0]!.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.providerBudgetReservation.deleteMany({
      where: { usageEvent: { provider } },
    });
    await prisma.providerUsageEvent.deleteMany({ where: { provider } });
    await prisma.providerCatalogItem.deleteMany({
      where: { id: { in: [catalogItemId, ocrCatalogItemId] } },
    });
    const originalScopes = originalPolicies.map((policy) => policy.scope);
    await prisma.providerBudgetPolicy.deleteMany({
      where: { scope: { notIn: originalScopes } },
    });
    for (const policy of originalPolicies) {
      await prisma.providerBudgetPolicy.upsert({
        where: { scope: policy.scope },
        create: policy,
        update: policy,
      });
    }
    await prisma.$disconnect();
  });

  it("admits only one of two concurrent calls when only one reservation fits", async () => {
    const commitments = await usage.getCurrentBudgetCommitments();
    await Promise.all([
      setHardLimit(
        ProviderBudgetScope.ALL,
        commitments.aiUsedVnd +
          commitments.ocrUsedVnd +
          commitments.aiReservedVnd +
          commitments.ocrReservedVnd +
          100,
      ),
      setHardLimit(
        ProviderBudgetScope.AI,
        commitments.aiUsedVnd + commitments.aiReservedVnd + 100,
      ),
    ]);

    const results = await Promise.allSettled([
      reserve("concurrent-a"),
      reserve("concurrent-b"),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(isProviderBudgetError(rejected[0]!.reason)).toBe(true);
    const reservations = await prisma.providerBudgetReservation.findMany({
      where: { usageEvent: { provider } },
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      status: ProviderBudgetReservationStatus.RESERVED,
      reservedVnd: 100,
    });
  });

  it("reuses the same reservation for an idempotent retry", async () => {
    await allowAnother(100);
    const first = await reserve("idempotent");
    const second = await reserve("idempotent");
    expect(second.id).toBe(first.id);
    expect(
      await prisma.providerBudgetReservation.count({
        where: { idempotencyKey: `${provider}:idempotent` },
      }),
    ).toBe(1);
  });

  it("settles successful usage and releases a definite failure", async () => {
    await allowAnother(200);
    const succeeded = await reserve("settled");
    await usage.succeed(succeeded.id, {
      requestCount: 1,
      rates: requestRates(),
    });
    const settled = await prisma.providerBudgetReservation.findUniqueOrThrow({
      where: { idempotencyKey: `${provider}:settled` },
    });
    expect(settled).toMatchObject({
      status: ProviderBudgetReservationStatus.SETTLED,
      reservedVnd: 100,
      settledVnd: 100,
    });

    const failed = await reserve("released");
    await usage.fail(
      failed.id,
      Object.assign(new Error("invalid request"), { status: 400 }),
    );
    expect(
      await prisma.providerBudgetReservation.findUniqueOrThrow({
        where: { idempotencyKey: `${provider}:released` },
      }),
    ).toMatchObject({ status: ProviderBudgetReservationStatus.RELEASED });
  });

  it("settles measured cost and diagnostics for an incomplete provider response", async () => {
    await allowAnother(100);
    const failed = await reserve("settled-incomplete");
    await usage.fail(
      failed.id,
      new AiProviderOutputError(
        "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
        "OpenAI đã dừng vì chạm giới hạn token đầu ra.",
        {
          provider: AiProviderName.OPENAI,
          model: "gpt-5.1",
          providerRequestId: "resp-incomplete",
          responseStatus: "incomplete",
          incompleteReason: "max_output_tokens",
          hasRefusal: false,
          maxOutputTokens: 16_000,
          latencyMs: 2_000,
          usage: {
            promptTokens: 100,
            cachedInputTokens: 40,
            completionTokens: 16_000,
            reasoningTokens: 12_500,
            totalTokens: 16_100,
          },
          providerUsageRaw: {
            input_tokens: 100,
            input_tokens_details: { cached_tokens: 40 },
            output_tokens: 16_000,
            output_tokens_details: { reasoning_tokens: 12_500 },
            total_tokens: 16_100,
          },
          inputFileOperations: [
            {
              providerFileId: "file-incomplete",
              uploadLatencyMs: 25,
              cleanupStatus: "deleted",
            },
          ],
        },
      ),
      { rates: requestRates() },
    );

    const usageEvent = await prisma.providerUsageEvent.findUniqueOrThrow({
      where: { id: failed.id },
    });
    expect(usageEvent).toMatchObject({
      status: ProviderUsageStatus.FAILED,
      providerRequestId: "resp-incomplete",
      promptTokens: 100,
      cachedInputTokens: 40,
      completionTokens: 16_000,
      totalTokens: 16_100,
      errorCode: "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
      latencyMs: 2_000,
      costVnd: 100,
      rawUsageJson: {
        providerUsage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 40 },
          output_tokens: 16_000,
          output_tokens_details: { reasoning_tokens: 12_500 },
          total_tokens: 16_100,
        },
        fileOperations: [
          {
            providerFileId: "file-incomplete",
            uploadLatencyMs: 25,
            cleanupStatus: "deleted",
          },
        ],
        failure: {
          responseStatus: "incomplete",
          incompleteReason: "max_output_tokens",
          hasRefusal: false,
          maxOutputTokens: 16_000,
          reasoningTokens: 12_500,
        },
      },
    });
    expect(
      await prisma.providerBudgetReservation.findUniqueOrThrow({
        where: { idempotencyKey: `${provider}:settled-incomplete` },
      }),
    ).toMatchObject({
      status: ProviderBudgetReservationStatus.SETTLED,
      settledVnd: 100,
    });
  });

  it("keeps the reservation uncertain when a provider response has no usage", async () => {
    await allowAnother(100);
    const failed = await reserve("uncertain-missing-usage");
    await usage.fail(
      failed.id,
      new AiProviderOutputError(
        "OPENAI_STRUCTURED_OUTPUT_MISSING",
        "OpenAI không trả về dữ liệu có cấu trúc hoàn chỉnh.",
        {
          provider: AiProviderName.OPENAI,
          model: "gpt-5.1",
          providerRequestId: "resp-missing-usage",
          responseStatus: "completed",
          incompleteReason: null,
          hasRefusal: false,
          latencyMs: 1_000,
        },
      ),
      { rates: requestRates() },
    );

    expect(
      await prisma.providerBudgetReservation.findUniqueOrThrow({
        where: { idempotencyKey: `${provider}:uncertain-missing-usage` },
      }),
    ).toMatchObject({
      status: ProviderBudgetReservationStatus.UNCERTAIN,
      settledVnd: 0,
      settledAt: null,
    });
  });

  it("keeps an ambiguous timeout reserved and fails closed without a price", async () => {
    await allowAnother(100);
    const uncertain = await reserve("uncertain");
    await usage.fail(uncertain.id, new Error("provider timeout"));
    expect(
      await prisma.providerBudgetReservation.findUniqueOrThrow({
        where: { idempotencyKey: `${provider}:uncertain` },
      }),
    ).toMatchObject({ status: ProviderBudgetReservationStatus.UNCERTAIN });

    const before = await prisma.providerUsageEvent.count({ where: { provider } });
    await expect(
      usage.reserveAndStart(
        {
          category: ProviderCatalogCategory.AI_MODEL,
          provider,
          catalogItemId,
          priceVersionId,
        },
        {
          idempotencyKey: `${provider}:missing-price`,
          usageUpperBound: { requestCount: 1 },
          rates: [],
          requiredMetrics: [ProviderUsageMetric.REQUEST],
        },
      ),
    ).rejects.toSatisfy(isProviderBudgetError);
    expect(await prisma.providerUsageEvent.count({ where: { provider } })).toBe(before);
  });

  it("serializes OCR calls independently and blocks a zero OCR budget", async () => {
    const commitments = await usage.getCurrentBudgetCommitments();
    await Promise.all([
      setHardLimit(
        ProviderBudgetScope.ALL,
        commitments.aiUsedVnd +
          commitments.ocrUsedVnd +
          commitments.aiReservedVnd +
          commitments.ocrReservedVnd +
          100,
      ),
      setHardLimit(
        ProviderBudgetScope.OCR,
        commitments.ocrUsedVnd + commitments.ocrReservedVnd + 100,
      ),
    ]);
    const concurrent = await Promise.allSettled([
      reserve("ocr-concurrent-a", ProviderCatalogCategory.OCR_SERVICE),
      reserve("ocr-concurrent-b", ProviderCatalogCategory.OCR_SERVICE),
    ]);
    expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === "rejected")).toHaveLength(1);

    await setHardLimit(ProviderBudgetScope.OCR, 0);
    await expect(
      reserve("ocr-zero", ProviderCatalogCategory.OCR_SERVICE),
    ).rejects.toSatisfy(isProviderBudgetError);
  });

  async function reserve(key: string, category = ProviderCatalogCategory.AI_MODEL) {
    const isOcr = category === ProviderCatalogCategory.OCR_SERVICE;
    return usage.reserveAndStart(
      {
        category,
        provider,
        catalogItemId: isOcr ? ocrCatalogItemId : catalogItemId,
        priceVersionId: isOcr ? ocrPriceVersionId : priceVersionId,
      },
      {
        idempotencyKey: `${provider}:${key}`,
        usageUpperBound: { requestCount: 1 },
        rates: requestRates(),
        requiredMetrics: [ProviderUsageMetric.REQUEST],
      },
    );
  }

  async function setHardLimit(scope: ProviderBudgetScope, monthlyLimitVnd: number) {
    await prisma.providerBudgetPolicy.upsert({
      where: { scope },
      create: {
        scope,
        monthlyLimitVnd,
        hardStop: true,
        warningThresholds: [80, 90, 100],
      },
      update: { monthlyLimitVnd, hardStop: true },
    });
  }

  async function allowAnother(amountVnd: number) {
    const commitments = await usage.getCurrentBudgetCommitments();
    await Promise.all([
      setHardLimit(
        ProviderBudgetScope.ALL,
        commitments.aiUsedVnd +
          commitments.ocrUsedVnd +
          commitments.aiReservedVnd +
          commitments.ocrReservedVnd +
          amountVnd,
      ),
      setHardLimit(
        ProviderBudgetScope.AI,
        commitments.aiUsedVnd + commitments.aiReservedVnd + amountVnd,
      ),
    ]);
  }
});

function requestRates() {
  return [
    {
      metric: ProviderUsageMetric.REQUEST,
      unitSize: 1,
      unitPriceUsd: 0.004,
      tierFrom: null,
      tierTo: null,
    },
  ];
}
