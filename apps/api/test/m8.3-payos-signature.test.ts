import { createHmac } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { EnvConfig } from "#api/config/env.validation";
import { PayosService } from "#api/modules/payments/services/payos.service";

const CHECKSUM_KEY = "local-test-checksum-key";

function createPayosService() {
  const values = {
    PAYOS_CLIENT_ID: "local-test-client-id",
    PAYOS_API_KEY: "local-test-api-key",
    PAYOS_CHECKSUM_KEY: CHECKSUM_KEY,
  };
  const configService = {
    get: (key: keyof typeof values) => values[key],
  } as unknown as ConfigService<EnvConfig, true>;

  return new PayosService(configService);
}

function signWebhookData(data: Record<string, unknown>) {
  const query = Object.keys(data)
    .sort()
    .map((key) => `${key}=${String(data[key] ?? "")}`)
    .join("&");
  return createHmac("sha256", CHECKSUM_KEY).update(query).digest("hex");
}

describe("M8.3 payOS webhook signature verification", () => {
  it("should await and return verified webhook data", async () => {
    const service = createPayosService();
    const data = {
      amount: 2000,
      code: "00",
      currency: "VND",
      description: "signed webhook test",
      orderCode: 123456789,
    };

    await expect(
      service.verifyWebhookData({
        code: "00",
        desc: "success",
        success: true,
        data,
        signature: signWebhookData(data),
      }),
    ).resolves.toEqual(data);
  });

  it("should return null and never expose invalid webhook data", async () => {
    const service = createPayosService();

    await expect(
      service.verifyWebhookData({
        code: "00",
        desc: "success",
        success: true,
        data: { amount: 2000, code: "00", orderCode: 123456789 },
        signature: "invalid-signature",
      }),
    ).resolves.toBeNull();
  });
});
