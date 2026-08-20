import {
  Prisma,
  ProviderBillingMode,
  ProviderUsageMetric,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ProviderOperationsAdminService } from "#api/modules/provider-operations/services/provider-operations-admin.service";

describe("ProviderOperationsAdminService price condition inheritance", () => {
  it("keeps maxInputTokens when admin creates a replacement price version", async () => {
    const createPrice = vi.fn(async (args: { data: { rates: { create: unknown[] } } }) => ({
      id: "new-price-version",
      billingMode: ProviderBillingMode.TOKEN,
      currency: "USD",
      sourceUrl: null,
      effectiveFrom: new Date("2026-08-17T00:00:00.000Z"),
      effectiveTo: null,
      createdAt: new Date("2026-08-17T00:00:00.000Z"),
      rates: [
        {
          id: "new-rate",
          metric: ProviderUsageMetric.INPUT_TOKEN,
          unitSize: new Prisma.Decimal(1_000_000),
          unitPriceUsd: new Prisma.Decimal(0.2),
          tierFrom: null,
          tierTo: null,
        },
      ],
    }));
    const transaction = {
      providerPriceVersion: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: createPrice,
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      providerCatalogItem: {
        findUnique: vi.fn(async () => ({
          id: "catalog-item",
          priceVersions: [
            {
              rates: [
                {
                  metric: ProviderUsageMetric.INPUT_TOKEN,
                  tierFrom: null,
                  tierTo: null,
                  conditionsJson: {
                    contextTier: "SHORT",
                    maxInputTokens: 30_000,
                    serviceTier: "STANDARD",
                  },
                },
              ],
            },
          ],
        })),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new ProviderOperationsAdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.createPriceVersion("catalog-item", "admin-user", {
      billingMode: ProviderBillingMode.TOKEN,
      rates: [
        {
          metric: ProviderUsageMetric.INPUT_TOKEN,
          unitSize: 1_000_000,
          unitPriceUsd: 0.2,
        },
      ],
    });

    expect(createPrice).toHaveBeenCalledOnce();
    expect(createPrice.mock.calls[0]?.[0].data.rates.create).toEqual([
      expect.objectContaining({
        conditionsJson: {
          contextTier: "SHORT",
          maxInputTokens: 30_000,
          serviceTier: "STANDARD",
        },
      }),
    ]);
  });
});
