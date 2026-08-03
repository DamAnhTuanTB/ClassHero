import type { Prisma } from "@prisma/client";
import type { paymentWithEnrollmentSelect } from "#api/modules/payments/selectors/payment.selectors";

type PaymentWithEnrollment = Prisma.PaymentGetPayload<{
  select: typeof paymentWithEnrollmentSelect;
}>;

export function serializePaymentForStudent(payment: PaymentWithEnrollment) {
  const enrollment = payment.enrollments[0] ?? null;

  return {
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    learningPathId: payment.learningPathId,
    referenceCode: payment.referenceCode,
    learningPath: payment.learningPath,
    checkoutUrl: payment.checkoutUrl,
    qrCode: payment.qrCode,
    amountVnd: payment.amountVnd,
    originalAmountVnd: payment.originalAmountVnd,
    discountAmountVnd: payment.discountAmountVnd,
    paidAt: payment.paidAt,
    expiredAt: payment.expiredAt,
    createdAt: payment.createdAt,
    enrollment: enrollment
      ? {
          id: enrollment.id,
          status: enrollment.status,
          startsAt: enrollment.startsAt,
          expiresAt: enrollment.expiresAt,
        }
      : null,
  };
}

export type SerializedPaymentForStudent = ReturnType<typeof serializePaymentForStudent>;
