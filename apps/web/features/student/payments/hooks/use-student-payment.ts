"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  createPaymentOrder,
  getPaymentStatus,
} from "@/features/student/payments/api/student-payments-api";
import {
  studentLearningPathDetailQueryKey,
  studentLearningPathsQueryKey,
} from "@/features/student/shared/hooks/use-student-courses-query";

export const paymentStatusQueryKey = (paymentId: string) => [
  "student",
  "payment-status",
  paymentId,
];

/**
 * Mutation: create a payment order via payOS.
 * On success, returns the payment with checkoutUrl.
 */
export function useCreatePaymentMutation() {
  const session = useAuthSessionStore((state) => state.session);

  return useMutation({
    mutationFn: (learningPathId: string) => {
      if (!session?.accessToken) {
        throw new Error("Bạn cần đăng nhập để mua khóa học");
      }
      return createPaymentOrder(learningPathId, session.accessToken);
    },
  });
}

/**
 * Query: poll payment status.
 * Refetch every 4 seconds while status is PENDING.
 */
export function usePaymentStatusQuery(paymentId: string | undefined) {
  const session = useAuthSessionStore((state) => state.session);
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);

  return useQuery({
    queryKey: paymentStatusQueryKey(paymentId ?? ""),
    queryFn: () => {
      if (!paymentId) throw new Error("Missing paymentId");
      return getPaymentStatus(paymentId, session?.accessToken);
    },
    enabled: isAuthHydrated && !!paymentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Keep polling while PENDING
      if (status === "PENDING") return 4000;
      return false;
    },
    staleTime: 2000,
  });
}

/**
 * Hook to invalidate course queries after successful payment.
 */
export function useInvalidateCoursesAfterPayment() {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);

  return (slug?: string) => {
    const promises = [
      queryClient.invalidateQueries({
        queryKey: studentLearningPathsQueryKey(session?.user.id),
      }),
    ];

    if (slug) {
      promises.push(
        queryClient.invalidateQueries({
          queryKey: studentLearningPathDetailQueryKey(slug, session?.user.id),
        }),
      );
    }

    return Promise.all(promises);
  };
}
