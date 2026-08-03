import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PaymentLinkStatus } from "@payos/node";
import { EnrollmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";

/** Enrollment duration: 12 months from paid date */
const ENROLLMENT_MONTHS = 12;

@Injectable()
export class WebhookPaymentsService {
  private readonly logger = new Logger(WebhookPaymentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Process a verified payOS webhook event.
   * Idempotent: if payment is already PAID, skips processing.
   */
  async processVerifiedWebhook(
    verifiedData: Record<string, unknown>,
    webhookLogId: string,
  ): Promise<{ processed: boolean; paymentId?: string }> {
    const orderCode = String(verifiedData.orderCode ?? "");
    const payosCode = String(verifiedData.code ?? "");

    this.logger.log(
      `Processing webhook: orderCode=${orderCode}, code=${payosCode}`,
    );

    // payOS sends code "00" for successful payment
    if (payosCode !== "00") {
      this.logger.debug(`Webhook code=${payosCode} is not a success event, skipping enrollment.`);

      // Still update the log as processed
      await this.prisma.paymentWebhookLog.update({
        where: { id: webhookLogId },
        data: { processed: true, processedAt: new Date() },
      });

      return { processed: true };
    }

    // Process successful payment in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const settlement = await this.markPaymentPaid(
        tx,
        orderCode,
        toJsonValue(verifiedData),
      );

      if (!settlement) {
        this.logger.warn(`Payment not found for orderCode=${orderCode}`);
        await tx.paymentWebhookLog.update({
          where: { id: webhookLogId },
          data: {
            processed: true,
            processedAt: new Date(),
            processingError: "Payment not found",
          },
        });
        return { processed: false };
      }

      await tx.paymentWebhookLog.update({
        where: { id: webhookLogId },
        data: { processed: true, processedAt: new Date() },
      });

      // TODO M10: trigger notification (in-app + email) for successful payment
      // TODO M10: trigger notification for parent if parent paid

      return { processed: true, paymentId: settlement.paymentId };
    });

    return result;
  }

  async reconcileProviderPaymentStatus(
    providerOrderCode: string,
    providerStatus: PaymentLinkStatus,
    providerPayload: unknown,
  ): Promise<{ processed: boolean; paymentId?: string }> {
    const rawResponseJson = toJsonValue(providerPayload);

    if (providerStatus === "PAID") {
      const settlement = await this.prisma.$transaction((tx) =>
        this.markPaymentPaid(tx, providerOrderCode, rawResponseJson),
      );
      return settlement
        ? { processed: true, paymentId: settlement.paymentId }
        : { processed: false };
    }

    const terminalStatus = mapTerminalPaymentStatus(providerStatus);
    if (!terminalStatus) {
      return { processed: false };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerOrderCode },
      select: { id: true, status: true },
    });

    if (!payment) {
      return { processed: false };
    }

    if (payment.status === PaymentStatus.PENDING) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: terminalStatus,
          rawResponseJson,
        },
      });
    }

    return { processed: true, paymentId: payment.id };
  }

  private async markPaymentPaid(
    tx: Prisma.TransactionClient,
    providerOrderCode: string,
    rawResponseJson: Prisma.InputJsonValue,
  ): Promise<{ paymentId: string } | null> {
    const payment = await tx.payment.findUnique({
      where: { providerOrderCode },
      select: {
        id: true,
        status: true,
        paidAt: true,
        studentUserId: true,
        learningPathId: true,
        payerUserId: true,
      },
    });

    if (!payment) {
      return null;
    }

    const paidAt = payment.paidAt ?? new Date();
    await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: { not: PaymentStatus.PAID },
      },
      data: {
        status: PaymentStatus.PAID,
        paidAt,
        rawResponseJson,
      },
    });

    if (payment.status === PaymentStatus.PAID) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { rawResponseJson },
      });
    }

    await tx.enrollment.updateMany({
      where: {
        studentUserId: payment.studentUserId,
        learningPathId: payment.learningPathId,
        status: EnrollmentStatus.ACTIVE,
        expiresAt: { lte: paidAt },
      },
      data: { status: EnrollmentStatus.EXPIRED },
    });

    const existingEnrollment = await tx.enrollment.findFirst({
      where: {
        studentUserId: payment.studentUserId,
        learningPathId: payment.learningPathId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: paidAt },
        expiresAt: { gt: paidAt },
      },
      select: { id: true },
    });

    if (!existingEnrollment) {
      const expiresAt = addMonths(paidAt, ENROLLMENT_MONTHS);
      await tx.enrollment.create({
        data: {
          studentUserId: payment.studentUserId,
          learningPathId: payment.learningPathId,
          paidByUserId: payment.payerUserId,
          paymentId: payment.id,
          status: EnrollmentStatus.ACTIVE,
          startsAt: paidAt,
          expiresAt,
        },
      });

      this.logger.log(
        `Created enrollment for student ${payment.studentUserId}, ` +
          `learningPath ${payment.learningPathId}, expires ${expiresAt.toISOString()}`,
      );
    }

    return { paymentId: payment.id };
  }
}

function mapTerminalPaymentStatus(
  providerStatus: PaymentLinkStatus,
): PaymentStatus | null {
  switch (providerStatus) {
    case "CANCELLED":
      return PaymentStatus.CANCELLED;
    case "EXPIRED":
      return PaymentStatus.EXPIRED;
    case "FAILED":
    case "UNDERPAID":
      return PaymentStatus.FAILED;
    default:
      return null;
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function addMonths(date: Date, monthCount: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + monthCount);
  return result;
}
