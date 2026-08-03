import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EnrollmentStatus,
  LearningPathKind,
  PaymentStatus,
  PublishStatus,
} from "@prisma/client";
import type { EnvConfig } from "#api/config/env.validation";
import {
  throwConflict,
  throwNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { CreatePaymentDto } from "#api/modules/payments/dto/create-payment.dto";
import { paymentWithEnrollmentSelect } from "#api/modules/payments/selectors/payment.selectors";
import { serializePaymentForStudent } from "#api/modules/payments/serializers/payment.serializers";
import { PayosService } from "#api/modules/payments/services/payos.service";
import { WebhookPaymentsService } from "#api/modules/payments/services/webhook-payments.service";
import { createPaymentReference } from "#api/modules/payments/utils/payment-reference";

/** Temporary expiry for testing the expired-payment flow. Restore before production. */
const PAYMENT_EXPIRY_SECONDS = 30;

@Injectable()
export class StudentPaymentsService {
  private readonly logger = new Logger(StudentPaymentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PayosService) private readonly payosService: PayosService,
    @Inject(WebhookPaymentsService)
    private readonly webhookPaymentsService: WebhookPaymentsService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async createPaymentOrder(studentUserId: string, dto: CreatePaymentDto) {
    const now = new Date();
    const webUrl = this.configService.get("WEB_URL", { infer: true });

    // 1. Check active enrollment
    const activeEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentUserId,
        learningPathId: dto.learningPathId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: { id: true },
    });

    if (activeEnrollment) {
      throwConflict(
        "ALREADY_ENROLLED",
        "Bạn đã có quyền học khóa này. Không cần mua lại.",
      );
    }

    // 2. Check learning path
    const learningPath = await this.prisma.learningPath.findFirst({
      where: {
        id: dto.learningPathId,
        kind: LearningPathKind.CATALOG,
        deletedAt: null,
        status: PublishStatus.PUBLISHED,
      },
      select: {
        id: true,
        domain: { select: { name: true } },
        targetAudiences: {
          select: { targetAudience: { select: { grade: true } } },
          orderBy: { targetAudience: { sortOrder: "asc" } },
        },
        slug: true,
        originalPriceVnd: true,
        salePriceVnd: true,
      },
    });

    if (!learningPath) {
      throwNotFound(
        "LEARNING_PATH_NOT_FOUND",
        "Không tìm thấy khóa học để mua.",
      );
    }

    // 3. Check for existing PENDING payment (reuse if not expired)
    const existingPending = await this.prisma.payment.findFirst({
      where: {
        studentUserId,
        learningPathId: dto.learningPathId,
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      select: paymentWithEnrollmentSelect,
    });

    if (existingPending) {
      await this.reconcilePendingPayment(existingPending);
      const reconciledPayment = await this.prisma.payment.findUnique({
        where: { id: existingPending.id },
        select: paymentWithEnrollmentSelect,
      });

      if (
        reconciledPayment?.status === PaymentStatus.PENDING &&
        reconciledPayment.expiredAt &&
        reconciledPayment.expiredAt.getTime() > now.getTime()
      ) {
        this.logger.debug(
          `Reusing existing PENDING payment ${existingPending.id} for student ${studentUserId}`,
        );
        return serializePaymentForStudent(reconciledPayment);
      }
    }

    // 4. Calculate price (no discount in this version)
    const amountVnd = learningPath.salePriceVnd ?? learningPath.originalPriceVnd;
    const originalAmountVnd = learningPath.originalPriceVnd;
    const discountAmountVnd = Math.max(originalAmountVnd - amountVnd, 0);

    // 5. Generate unique order code (payOS requires a positive integer)
    const orderCode = generateOrderCode();
    const paymentId = randomUUID();
    const referenceCode = await this.createUniquePaymentReference(
      learningPath.domain.name,
      learningPath.targetAudiences.find(
        ({ targetAudience }) => targetAudience.grade !== null,
      )?.targetAudience.grade ?? null,
    );

    // 6. Build URLs
    const resultUrl = `${webUrl}/student/payments/${paymentId}/result`;
    const cancelUrl = resultUrl;
    const returnUrl = resultUrl;
    const expiredAt = new Date(now.getTime() + PAYMENT_EXPIRY_SECONDS * 1000);
    const expiredAtEpoch = Math.floor(expiredAt.getTime() / 1000);

    // 7. Call payOS to create payment link
    const payosResult = await this.payosService.createPaymentLink({
      orderCode,
      amount: amountVnd,
      description: referenceCode,
      cancelUrl,
      returnUrl,
      expiredAt: expiredAtEpoch,
    });

    // 8. Save payment to DB
    const payment = await this.prisma.payment.create({
      data: {
        id: paymentId,
        status: PaymentStatus.PENDING,
        payerUserId: studentUserId,
        studentUserId,
        learningPathId: learningPath.id,
        referenceCode,
        providerOrderCode: String(orderCode),
        providerPaymentLinkId: payosResult.paymentLinkId,
        checkoutUrl: payosResult.checkoutUrl,
        qrCode: payosResult.qrCode,
        amountVnd,
        originalAmountVnd,
        discountAmountVnd,
        expiredAt,
      },
      select: paymentWithEnrollmentSelect,
    });
    this.logger.log(
      `Created payment ${payment.id} (orderCode=${orderCode}) for student ${studentUserId}, amount=${amountVnd} VND`,
    );

    return serializePaymentForStudent(payment);
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    let payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        OR: [{ payerUserId: userId }, { studentUserId: userId }],
      },
      select: paymentWithEnrollmentSelect,
    });

    if (!payment) {
      throwNotFound("PAYMENT_NOT_FOUND", "Không tìm thấy thông tin thanh toán.");
    }

    if (payment.status === PaymentStatus.PENDING) {
      await this.reconcilePendingPayment(payment);
      payment = await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          OR: [{ payerUserId: userId }, { studentUserId: userId }],
        },
        select: paymentWithEnrollmentSelect,
      });
    }

    if (!payment) {
      throwNotFound("PAYMENT_NOT_FOUND", "Không tìm thấy thông tin thanh toán.");
    }

    return serializePaymentForStudent(payment);
  }

  private async reconcilePendingPayment(
    payment: {
      providerOrderCode: string;
      expiredAt: Date | null;
    },
  ): Promise<void> {
    try {
      const providerPayment = await this.payosService.getPaymentInfo(
        payment.providerOrderCode,
      );
      await this.webhookPaymentsService.reconcileProviderPaymentStatus(
        payment.providerOrderCode,
        providerPayment.status,
        providerPayment,
      );

      if (
        providerPayment.status === "PENDING" &&
        payment.expiredAt &&
        payment.expiredAt.getTime() <= Date.now()
      ) {
        await this.webhookPaymentsService.reconcileProviderPaymentStatus(
          payment.providerOrderCode,
          "EXPIRED",
          {
            ...providerPayment,
            status: "EXPIRED",
            reconciliationSource: "LOCAL_EXPIRY",
          },
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not reconcile payOS payment orderCode=${payment.providerOrderCode}: ${String(error)}`,
      );
    }
  }

  private async createUniquePaymentReference(
    domainName: string,
    grade: number | null,
  ): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const referenceCode = createPaymentReference(domainName, grade);
      const existingPayment = await this.prisma.payment.findUnique({
        where: { referenceCode },
        select: { id: true },
      });

      if (!existingPayment) {
        return referenceCode;
      }
    }

    throw new Error("Could not generate a unique payment reference code.");
  }
}

/**
 * Generate a unique positive integer order code for payOS.
 * Uses timestamp suffix + random to avoid collisions.
 * payOS requires orderCode to be a positive integer, max ~9007199254740991.
 */
function generateOrderCode(): number {
  const timestampPart = Date.now() % 1_000_000_000;
  const randomPart = Math.floor(Math.random() * 1000);
  return timestampPart * 1000 + randomPart;
}
