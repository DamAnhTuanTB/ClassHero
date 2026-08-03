import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  EnrollmentStatus,
  LearningPathKind,
  PaymentStatus,
  PublishStatus,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { WebhookPaymentsService } from "#api/modules/payments/services/webhook-payments.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

describe("M8.3 Webhook Payments Service Integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let webhookPaymentsService: WebhookPaymentsService;

  let studentUserId = "";
  let learningPathId = "";
  let paymentId = "";
  let paymentId2 = "";
  let webhookLogId = "";
  let webhookLogId2 = "";
  let webhookLogId3 = "";

  const suffix = randomUUID().slice(0, 8);
  const orderCode1 = 11111111;
  const orderCode2 = 22222222;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    webhookPaymentsService = moduleRef.get(WebhookPaymentsService);

    // Seed data
    const courseCatalog = await createTestCourseCatalogRelation(prisma, 10);
    const [student, lp] = await Promise.all([
      prisma.user.create({
        data: {
          role: UserRole.STUDENT,
          username: `m8-wh-student-${suffix}`,
          passwordHash: "hash",
          studentProfile: { create: { grade: 10, childCode: `child-wh-${suffix}` } },
        },
      }),
      prisma.learningPath.create({
        data: {
          title: "Course for Webhook",
          slug: `course-webhook-${suffix}`,
          kind: LearningPathKind.CATALOG,
          status: PublishStatus.PUBLISHED,
          originalPriceVnd: 500000,
          salePriceVnd: 299000,
          ...courseCatalog,
          publishedAt: new Date(),
        },
      }),
    ]);

    studentUserId = student.id;
    learningPathId = lp.id;

    // Create payments
    const [p1, p2] = await Promise.all([
      prisma.payment.create({
        data: {
          status: PaymentStatus.PENDING,
          payerUserId: studentUserId,
          studentUserId,
          learningPathId,
          providerOrderCode: String(orderCode1),
          checkoutUrl: "url",
          qrCode: "qr",
          amountVnd: 299000,
          originalAmountVnd: 500000,
          discountAmountVnd: 0,
          expiredAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      }),
      prisma.payment.create({
        data: {
          status: PaymentStatus.PENDING,
          payerUserId: studentUserId,
          studentUserId,
          learningPathId,
          providerOrderCode: String(orderCode2),
          checkoutUrl: "url",
          qrCode: "qr",
          amountVnd: 299000,
          originalAmountVnd: 500000,
          discountAmountVnd: 0,
          expiredAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      }),
    ]);
    paymentId = p1.id;
    paymentId2 = p2.id;

    // Create webhook logs
    const [w1, w2, w3] = await Promise.all([
      prisma.paymentWebhookLog.create({
        data: {
          rawPayloadJson: {},
          providerOrderCode: String(orderCode1),
          verified: true,
          processed: false,
        },
      }),
      prisma.paymentWebhookLog.create({
        data: {
          rawPayloadJson: {},
          providerOrderCode: String(orderCode2),
          verified: true,
          processed: false,
        },
      }),
      prisma.paymentWebhookLog.create({
        data: {
          rawPayloadJson: {},
          providerOrderCode: "99999999", // Not exist
          verified: true,
          processed: false,
        },
      }),
    ]);
    webhookLogId = w1.id;
    webhookLogId2 = w2.id;
    webhookLogId3 = w3.id;
  });

  afterAll(async () => {
    if (!learningPathId) return;
    // Cleanup
    await prisma.enrollment.deleteMany({ where: { learningPathId } });
    await prisma.paymentWebhookLog.deleteMany({
      where: { id: { in: [webhookLogId, webhookLogId2, webhookLogId3] } },
    });
    await prisma.payment.deleteMany({ where: { learningPathId } });
    await prisma.learningPath.deleteMany({ where: { id: learningPathId } });
    await prisma.studentProfile.deleteMany({ where: { userId: studentUserId } });
    await prisma.user.deleteMany({ where: { id: studentUserId } });
    await moduleRef.close();
  });

  it("should handle payment not found gracefully", async () => {
    const data = { orderCode: 99999999, code: "00" };
    const result = await webhookPaymentsService.processVerifiedWebhook(
      data,
      webhookLogId3,
    );

    expect(result.processed).toBe(false);

    const log = await prisma.paymentWebhookLog.findUnique({
      where: { id: webhookLogId3 },
    });
    expect(log?.processed).toBe(true);
    expect(log?.processingError).toBe("Payment not found");
  });

  it("should ignore a non-paid webhook and reconcile cancellation from provider status", async () => {
    const data = { orderCode: orderCode2, code: "01" };
    const result = await webhookPaymentsService.processVerifiedWebhook(
      data,
      webhookLogId2,
    );

    expect(result.processed).toBe(true);

    const pendingPayment = await prisma.payment.findUnique({ where: { id: paymentId2 } });
    expect(pendingPayment?.status).toBe(PaymentStatus.PENDING);

    const log = await prisma.paymentWebhookLog.findUnique({
      where: { id: webhookLogId2 },
    });
    expect(log?.processed).toBe(true);

    await webhookPaymentsService.reconcileProviderPaymentStatus(
      String(orderCode2),
      "CANCELLED",
      { orderCode: orderCode2, status: "CANCELLED" },
    );
    const cancelledPayment = await prisma.payment.findUnique({
      where: { id: paymentId2 },
    });
    expect(cancelledPayment?.status).toBe(PaymentStatus.CANCELLED);
  });

  it("should process successful webhook and create enrollment", async () => {
    const data = { orderCode: orderCode1, code: "00" };
    const result = await webhookPaymentsService.processVerifiedWebhook(
      data,
      webhookLogId,
    );

    expect(result.processed).toBe(true);
    expect(result.paymentId).toBe(paymentId);

    // Verify payment updated
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe(PaymentStatus.PAID);
    expect(payment?.paidAt).not.toBeNull();
    expect(payment?.rawResponseJson).toEqual(data);

    // Verify enrollment created
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentUserId, learningPathId, status: EnrollmentStatus.ACTIVE },
    });
    expect(enrollment).not.toBeNull();
    expect(enrollment?.paymentId).toBe(paymentId);
    expect(enrollment?.startsAt.getTime()).toBe(payment?.paidAt?.getTime());
    // Expires at + 12 months
    const expectedExpires = new Date(payment!.paidAt!);
    expectedExpires.setMonth(expectedExpires.getMonth() + 12);
    expect(enrollment?.expiresAt.getTime()).toBe(expectedExpires.getTime());

    const log = await prisma.paymentWebhookLog.findUnique({
      where: { id: webhookLogId },
    });
    expect(log?.processed).toBe(true);
  });

  it("should skip processing if already PAID (idempotency)", async () => {
    // create a new webhook log for the same order
    const dupLog = await prisma.paymentWebhookLog.create({
      data: {
        rawPayloadJson: {},
        providerOrderCode: String(orderCode1),
        verified: true,
        processed: false,
      },
    });

    const data = { orderCode: orderCode1, code: "00" };
    const result = await webhookPaymentsService.processVerifiedWebhook(data, dupLog.id);

    expect(result.processed).toBe(true); // skips gracefully
    expect(result.paymentId).toBe(paymentId);

    // Verify only 1 enrollment exists
    const enrollments = await prisma.enrollment.count({
      where: { studentUserId, learningPathId },
    });
    expect(enrollments).toBe(1);

    const log = await prisma.paymentWebhookLog.findUnique({ where: { id: dupLog.id } });
    expect(log?.processed).toBe(true);

    // Cleanup
    await prisma.paymentWebhookLog.delete({ where: { id: dupLog.id } });
  });

  it.each([
    ["EXPIRED", PaymentStatus.EXPIRED],
    ["FAILED", PaymentStatus.FAILED],
    ["UNDERPAID", PaymentStatus.FAILED],
  ] as const)(
    "should map provider status %s to %s",
    async (providerStatus, expectedStatus) => {
      const payment = await prisma.payment.create({
        data: {
          status: PaymentStatus.PENDING,
          payerUserId: studentUserId,
          studentUserId,
          learningPathId,
          providerOrderCode: `${providerStatus}-${suffix}`,
          amountVnd: 299000,
          originalAmountVnd: 500000,
          expiredAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      });

      await webhookPaymentsService.reconcileProviderPaymentStatus(
        payment.providerOrderCode,
        providerStatus,
        { orderCode: payment.providerOrderCode, status: providerStatus },
      );

      const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.status).toBe(expectedStatus);
    },
  );
});
