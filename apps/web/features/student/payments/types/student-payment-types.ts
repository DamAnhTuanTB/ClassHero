export type PaymentStatusApi = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";

export type PaymentEnrollmentApi = {
  id: string;
  status: string;
  startsAt: string;
  expiresAt: string;
};

export type PaymentLearningPathApi = {
  id: string;
  title: string;
  slug: string;
};

export type CreatePaymentResult = {
  id: string;
  provider: string;
  status: PaymentStatusApi;
  learningPathId: string;
  referenceCode: string | null;
  learningPath: PaymentLearningPathApi;
  checkoutUrl: string | null;
  qrCode: string | null;
  amountVnd: number;
  originalAmountVnd: number;
  discountAmountVnd: number;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  enrollment: PaymentEnrollmentApi | null;
};

export type PaymentStatusResult = CreatePaymentResult;
