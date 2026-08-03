import type { Prisma } from "@prisma/client";

export const paymentBaseSelect = {
  id: true,
  provider: true,
  status: true,
  payerUserId: true,
  studentUserId: true,
  learningPathId: true,
  referenceCode: true,
  providerOrderCode: true,
  checkoutUrl: true,
  qrCode: true,
  amountVnd: true,
  originalAmountVnd: true,
  discountAmountVnd: true,
  paidAt: true,
  expiredAt: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

export const paymentWithEnrollmentSelect = {
  ...paymentBaseSelect,
  enrollments: {
    select: {
      id: true,
      status: true,
      startsAt: true,
      expiresAt: true,
    },
    take: 1,
  },
  learningPath: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
} satisfies Prisma.PaymentSelect;

export const paymentSummarySelect = {
  id: true,
  status: true,
  amountVnd: true,
  paidAt: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;
