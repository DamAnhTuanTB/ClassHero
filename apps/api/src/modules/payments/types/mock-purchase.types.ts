import type { EnrollmentStatus, PaymentStatus } from "@prisma/client";

export type MockPurchaseResponse = {
  mode: "MOCK_SUCCESS" | "ALREADY_ENROLLED";
  learningPathId: string;
  payment: {
    id: string;
    status: PaymentStatus;
    amountVnd: number;
    paidAt: Date | null;
  } | null;
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    startsAt: Date;
    expiresAt: Date;
  };
};
