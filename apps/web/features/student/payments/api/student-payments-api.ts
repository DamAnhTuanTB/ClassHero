import { apiRequest } from "@/lib/api-client";
import type {
  CreatePaymentResult,
  PaymentStatusResult,
} from "@/features/student/payments/types/student-payment-types";

export function createPaymentOrder(
  learningPathId: string,
  token?: string,
) {
  return apiRequest<CreatePaymentResult>("/student/payments", {
    method: "POST",
    body: { learningPathId },
    token,
  });
}

export function getPaymentStatus(
  paymentId: string,
  token?: string,
) {
  return apiRequest<PaymentStatusResult>(`/student/payments/${paymentId}`, {
    token,
  });
}
