import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  EnrollmentStatus,
  LearningPathKind,
  PaymentStatus,
  PublishStatus,
  Subject,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { PayosService } from "#api/modules/payments/services/payos.service";
import { StudentPaymentsService } from "#api/modules/payments/services/student-payments.service";

describe("M8.2 Student Payments Service Integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let studentPaymentsService: StudentPaymentsService;

  let studentUserId = "";
  let studentUserId2 = "";
  let learningPathId = "";
  let draftLearningPathId = "";

  const suffix = randomUUID().slice(0, 8);

  const mockPayosService = {
    createPaymentLink: vi.fn().mockImplementation(async (params) => {
      return {
        checkoutUrl: "https://payos.vn/checkout/" + params.orderCode,
        qrCode: "mock-qr-code-" + params.orderCode,
        paymentLinkId: "link-" + params.orderCode,
      };
    }),
    verifyWebhookData: vi.fn(),
    getPaymentInfo: vi.fn().mockImplementation(async (orderCode) => ({
      id: `link-${orderCode}`,
      orderCode: Number(orderCode),
      amount: 299000,
      amountPaid: 0,
      amountRemaining: 299000,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    })),
  };

  beforeEach(() => {
    mockPayosService.getPaymentInfo.mockImplementation(async (orderCode) => ({
      id: `link-${orderCode}`,
      orderCode: Number(orderCode),
      amount: 299000,
      amountPaid: 0,
      amountRemaining: 299000,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    }));
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PayosService)
      .useValue(mockPayosService)
      .compile();

    prisma = moduleRef.get(PrismaService);
    studentPaymentsService = moduleRef.get(StudentPaymentsService);

    // Seed data
    const [student, student2, lp, draftLp] = await Promise.all([
      prisma.user.create({
        data: {
          role: UserRole.STUDENT,
          username: `m8-student1-${suffix}`,
          passwordHash: "hash",
          studentProfile: { create: { grade: 10, childCode: `child1-${suffix}` } },
        },
      }),
      prisma.user.create({
        data: {
          role: UserRole.STUDENT,
          username: `m8-student2-${suffix}`,
          passwordHash: "hash",
          studentProfile: { create: { grade: 10, childCode: `child2-${suffix}` } },
        },
      }),
      prisma.learningPath.create({
        data: {
          title: "Course for Payment",
          slug: `course-payment-${suffix}`,
          kind: LearningPathKind.CATALOG,
          status: PublishStatus.PUBLISHED,
          originalPriceVnd: 500000,
          salePriceVnd: 299000,
          subject: Subject.MATH,
          grade: 10,
          publishedAt: new Date(),
        },
      }),
      prisma.learningPath.create({
        data: {
          title: "Draft Course",
          slug: `draft-payment-${suffix}`,
          kind: LearningPathKind.CATALOG,
          status: PublishStatus.DRAFT,
          originalPriceVnd: 500000,
          salePriceVnd: 299000,
          subject: Subject.MATH,
          grade: 10,
        },
      }),
    ]);

    studentUserId = student.id;
    studentUserId2 = student2.id;
    learningPathId = lp.id;
    draftLearningPathId = draftLp.id;

    // Create an active enrollment for student2
    await prisma.enrollment.create({
      data: {
        studentUserId: studentUserId2,
        learningPathId: learningPathId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year later
      },
    });
  });

  afterAll(async () => {
    if (!learningPathId) return;
    // Cleanup
    await prisma.enrollment.deleteMany({
      where: { learningPathId: { in: [learningPathId, draftLearningPathId] } },
    });
    await prisma.payment.deleteMany({
      where: { learningPathId: { in: [learningPathId, draftLearningPathId] } },
    });
    await prisma.learningPath.deleteMany({
      where: { id: { in: [learningPathId, draftLearningPathId] } },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: { in: [studentUserId, studentUserId2] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [studentUserId, studentUserId2] } },
    });
    await moduleRef.close();
  });

  it("should throw error if course does not exist or not published", async () => {
    await expect(
      studentPaymentsService.createPaymentOrder(studentUserId, {
        learningPathId: randomUUID(),
      }),
    ).rejects.toThrow(/Không tìm thấy khóa học/);

    await expect(
      studentPaymentsService.createPaymentOrder(studentUserId, {
        learningPathId: draftLearningPathId,
      }),
    ).rejects.toThrow(/Không tìm thấy khóa học/);
  });

  it("should throw error if student already enrolled", async () => {
    await expect(
      studentPaymentsService.createPaymentOrder(studentUserId2, { learningPathId }),
    ).rejects.toThrow(/Bạn đã có quyền học khóa này/);
  });

  it("should create a new payment order", async () => {
    mockPayosService.createPaymentLink.mockClear();

    const result = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.amountVnd).toBe(299000); // sale price
    expect(result.checkoutUrl).toContain("https://payos.vn/checkout/");
    expect(result.qrCode).toContain("mock-qr-code-");

    expect(mockPayosService.createPaymentLink).toHaveBeenCalledTimes(1);
    const callArg = mockPayosService.createPaymentLink.mock.calls[0][0];
    expect(callArg.amount).toBe(299000);
    expect(callArg.description).toMatch(/^Toan10MS\d{8}$/);
    expect(result.referenceCode).toBe(callArg.description);
    expect(callArg.cancelUrl).toBe(callArg.returnUrl);
    expect(callArg.cancelUrl).toContain(`/student/payments/${result.id}/result`);
  });

  it("should reuse existing PENDING payment", async () => {
    mockPayosService.createPaymentLink.mockClear();

    // First call creates payment
    const result1 = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });
    expect(result1.status).toBe(PaymentStatus.PENDING);

    // Second call should return the same payment without calling payos again
    const result2 = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });
    expect(result2.status).toBe(PaymentStatus.PENDING);
    expect(result2.id).toBe(result1.id);
    expect(result2.checkoutUrl).toBe(result1.checkoutUrl);

    // No new payos call
    expect(mockPayosService.createPaymentLink).toHaveBeenCalledTimes(0);
  });

  it("should get payment status", async () => {
    // Create payment
    const created = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });

    // Get status
    const statusResult = await studentPaymentsService.getPaymentStatus(
      created.id,
      studentUserId,
    );
    expect(statusResult.id).toBe(created.id);
    expect(statusResult.status).toBe(PaymentStatus.PENDING);
    expect(statusResult.amountVnd).toBe(299000);
    expect(statusResult.enrollment).toBeNull();
  });

  it("should reconcile a cancelled payOS payment and create a fresh order", async () => {
    const pending = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });
    mockPayosService.getPaymentInfo.mockResolvedValueOnce({
      id: "cancelled-link",
      orderCode: 1,
      amount: 299000,
      amountPaid: 0,
      amountRemaining: 299000,
      status: "CANCELLED",
      createdAt: new Date().toISOString(),
      transactions: [],
      cancellationReason: "User cancelled",
      canceledAt: new Date().toISOString(),
    });

    const cancelled = await studentPaymentsService.getPaymentStatus(
      pending.id,
      studentUserId,
    );
    expect(cancelled.status).toBe(PaymentStatus.CANCELLED);

    mockPayosService.createPaymentLink.mockClear();
    const fresh = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });
    expect(fresh.id).not.toBe(pending.id);
    expect(fresh.status).toBe(PaymentStatus.PENDING);
    expect(mockPayosService.createPaymentLink).toHaveBeenCalledTimes(1);
  });

  it("should reconcile an expired payOS payment", async () => {
    const payment = await prisma.payment.create({
      data: {
        status: PaymentStatus.PENDING,
        payerUserId: studentUserId,
        studentUserId,
        learningPathId,
        providerOrderCode: `expired-${suffix}`,
        amountVnd: 299000,
        originalAmountVnd: 500000,
        expiredAt: new Date(Date.now() - 60_000),
      },
    });
    mockPayosService.getPaymentInfo.mockResolvedValueOnce({
      id: "expired-link",
      orderCode: 2,
      amount: 299000,
      amountPaid: 0,
      amountRemaining: 299000,
      status: "EXPIRED",
      createdAt: new Date().toISOString(),
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    });

    const result = await studentPaymentsService.getPaymentStatus(
      payment.id,
      studentUserId,
    );
    expect(result.status).toBe(PaymentStatus.EXPIRED);
  });

  it("should recover a paid payment from payOS status and create enrollment", async () => {
    const pending = await studentPaymentsService.createPaymentOrder(studentUserId, {
      learningPathId,
    });
    mockPayosService.getPaymentInfo.mockResolvedValueOnce({
      id: "paid-link",
      orderCode: 3,
      amount: 299000,
      amountPaid: 299000,
      amountRemaining: 0,
      status: "PAID",
      createdAt: new Date().toISOString(),
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    });

    const result = await studentPaymentsService.getPaymentStatus(
      pending.id,
      studentUserId,
    );
    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.enrollment?.status).toBe(EnrollmentStatus.ACTIVE);
  });
});
