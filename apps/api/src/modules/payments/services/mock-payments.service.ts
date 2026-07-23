import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  EnrollmentStatus,
  LearningPathKind,
  PaymentStatus,
  Prisma,
  PublishStatus,
} from "@prisma/client";
import { throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { MockPurchaseDto } from "#api/modules/payments/dto/mock-purchase.dto";
import { serializeMockPurchase } from "#api/modules/payments/serializers/mock-purchase.serializers";

@Injectable()
export class MockPaymentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async purchaseForStudent(studentUserId: string, dto: MockPurchaseDto) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const activeEnrollment = await tx.enrollment.findFirst({
        where: {
          studentUserId,
          learningPathId: dto.learningPathId,
          status: EnrollmentStatus.ACTIVE,
          startsAt: {
            lte: now,
          },
          expiresAt: {
            gt: now,
          },
        },
        select: enrollmentSelect,
      });

      if (activeEnrollment) {
        return {
          mode: "ALREADY_ENROLLED" as const,
          learningPathId: dto.learningPathId,
          payment: null,
          enrollment: activeEnrollment,
        };
      }

      const learningPath = await tx.learningPath.findFirst({
        where: {
          id: dto.learningPathId,
          kind: LearningPathKind.CATALOG,
          deletedAt: null,
          status: PublishStatus.PUBLISHED,
        },
        select: {
          id: true,
          originalPriceVnd: true,
          salePriceVnd: true,
        },
      });

      if (!learningPath) {
        throwNotFound("LEARNING_PATH_NOT_FOUND", "Không tìm thấy khóa học để mua");
      }

      const paidAt = now;
      const expiresAt = addMonths(paidAt, 12);
      const amountVnd = learningPath.salePriceVnd ?? learningPath.originalPriceVnd;
      const payment = await tx.payment.create({
        data: {
          status: PaymentStatus.PAID,
          payerUserId: studentUserId,
          studentUserId,
          learningPathId: learningPath.id,
          idempotencyKey: `mock-buy-now-${randomUUID()}`,
          providerOrderCode: `MOCK-${Date.now()}-${randomUUID()}`,
          amountVnd,
          originalAmountVnd: learningPath.originalPriceVnd,
          discountAmountVnd: Math.max(learningPath.originalPriceVnd - amountVnd, 0),
          paidAt,
          rawResponseJson: {
            mode: "MOCK_SUCCESS",
            source: "student-buy-now",
          },
        },
        select: paymentSelect,
      });

      const enrollment = await tx.enrollment.create({
        data: {
          studentUserId,
          learningPathId: learningPath.id,
          paidByUserId: studentUserId,
          paymentId: payment.id,
          status: EnrollmentStatus.ACTIVE,
          startsAt: paidAt,
          expiresAt,
        },
        select: enrollmentSelect,
      });

      return {
        mode: "MOCK_SUCCESS" as const,
        learningPathId: learningPath.id,
        payment,
        enrollment,
      };
    });

    return serializeMockPurchase(result);
  }
}

const paymentSelect = {
  id: true,
  status: true,
  amountVnd: true,
  paidAt: true,
} satisfies Prisma.PaymentSelect;

const enrollmentSelect = {
  id: true,
  status: true,
  startsAt: true,
  expiresAt: true,
} satisfies Prisma.EnrollmentSelect;

function addMonths(date: Date, monthCount: number) {
  const result = new Date(date);

  result.setMonth(result.getMonth() + monthCount);

  return result;
}
