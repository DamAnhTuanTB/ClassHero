import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PayOS, type PaymentLink } from "@payos/node";
import type { EnvConfig } from "#api/config/env.validation";
import { throwServiceUnavailable } from "#api/common/errors/api-exception";

export type CreatePaymentLinkParams = {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl: string;
  returnUrl: string;
  /** Optional expiration timestamp (seconds since epoch) */
  expiredAt?: number;
};

export type PaymentLinkResult = {
  checkoutUrl: string;
  qrCode: string;
  paymentLinkId: string;
};

@Injectable()
export class PayosService {
  private readonly logger = new Logger(PayosService.name);
  private client: PayOS | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    const clientId = this.configService.get("PAYOS_CLIENT_ID", { infer: true });
    const apiKey = this.configService.get("PAYOS_API_KEY", { infer: true });
    const checksumKey = this.configService.get("PAYOS_CHECKSUM_KEY", { infer: true });

    if (clientId && apiKey && checksumKey) {
      this.client = new PayOS({ clientId, apiKey, checksumKey });
      this.logger.log("PayOS client initialized successfully");
    } else {
      this.logger.warn(
        "PayOS credentials not configured. Payment creation will be unavailable.",
      );
    }
  }

  private ensureClient(): PayOS {
    if (!this.client) {
      throwServiceUnavailable(
        "PAYOS_NOT_CONFIGURED",
        "Hệ thống thanh toán chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
      );
    }
    return this.client;
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
    const client = this.ensureClient();

    const requestData: {
      orderCode: number;
      amount: number;
      description: string;
      cancelUrl: string;
      returnUrl: string;
      expiredAt?: number;
    } = {
      orderCode: params.orderCode,
      amount: params.amount,
      description: params.description.slice(0, 25),
      cancelUrl: params.cancelUrl,
      returnUrl: params.returnUrl,
    };

    if (params.expiredAt) {
      requestData.expiredAt = params.expiredAt;
    }

    this.logger.debug(
      `Creating payOS payment link: orderCode=${params.orderCode}, amount=${params.amount}`,
    );

    const response = await client.paymentRequests.create(requestData);

    return {
      checkoutUrl: response.checkoutUrl,
      qrCode: response.qrCode,
      paymentLinkId: response.paymentLinkId,
    };
  }

  async verifyWebhookData(
    webhookBody: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const client = this.ensureClient();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verifiedData = await client.webhooks.verify(webhookBody as any);
      return verifiedData as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(`Webhook verification failed: ${String(error)}`);
      return null;
    }
  }

  async getPaymentInfo(orderCode: number | string): Promise<PaymentLink> {
    const client = this.ensureClient();
    return client.paymentRequests.get(String(orderCode));
  }
}
