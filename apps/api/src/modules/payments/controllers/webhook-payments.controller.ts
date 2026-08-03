import { Body, Controller, Headers, HttpCode, Inject, Logger, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { PayosService } from "#api/modules/payments/services/payos.service";
import { WebhookPaymentsService } from "#api/modules/payments/services/webhook-payments.service";

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhookPaymentsController {
  private readonly logger = new Logger(WebhookPaymentsController.name);

  constructor(
    @Inject(PayosService) private readonly payosService: PayosService,
    @Inject(WebhookPaymentsService)
    private readonly webhookPaymentsService: WebhookPaymentsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post("payos")
  @HttpCode(200)
  @ApiOperation({ summary: "payOS webhook endpoint — verify and process payment events" })
  async handlePayosWebhook(
    @Body() body: Record<string, unknown>,
    @Headers("x-payos-signature") signature?: string,
  ) {
    this.logger.log("Received payOS webhook");

    // Extract orderCode from nested body.data if present
    const bodyData = body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : null;
    const providerOrderCode = bodyData
      ? String(bodyData.orderCode ?? "")
      : null;

    // 1. Save webhook log immediately (before verification)
    const bodySignature = typeof body.signature === "string" ? body.signature : null;
    const webhookLog = await this.prisma.paymentWebhookLog.create({
      data: {
        rawPayloadJson: body as object,
        signature: signature ?? bodySignature,
        providerOrderCode,
        verified: false,
        processed: false,
      },
    });

    // 2. Verify webhook signature
    const verifiedData = await this.payosService.verifyWebhookData(body);

    if (!verifiedData) {
      this.logger.warn(`Webhook ${webhookLog.id} verification failed`);
      await this.prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          verified: false,
          processed: true,
          processedAt: new Date(),
          processingError: "Webhook signature verification failed",
        },
      });
      // payOS recommends always returning 200 to prevent retries
      return { success: false, message: "Verification failed" };
    }

    // 3. Mark as verified
    const verifiedOrderCode = String(verifiedData.orderCode ?? "");
    await this.prisma.paymentWebhookLog.update({
      where: { id: webhookLog.id },
      data: {
        verified: true,
        providerOrderCode: verifiedOrderCode || providerOrderCode,
      },
    });

    // 4. Process the webhook
    try {
      const result = await this.webhookPaymentsService.processVerifiedWebhook(
        verifiedData,
        webhookLog.id,
      );
      return { success: true, processed: result.processed };
    } catch (error) {
      this.logger.error(`Webhook processing error: ${String(error)}`);
      await this.prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processedAt: new Date(),
          processingError: String(error),
        },
      });
      // Still return 200 to prevent payOS from retrying
      return { success: false, message: "Processing error" };
    }
  }
}
