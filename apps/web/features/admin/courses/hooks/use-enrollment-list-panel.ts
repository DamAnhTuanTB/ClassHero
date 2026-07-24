"use client";

import { useState, useCallback, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  listCourseEnrollments,
  createPersonalLearningPath,
  type PersonalLearningPathEnrollmentsQuery,
} from "@/features/admin/courses/api/admin-personal-learning-paths-api";
import type {
  PersonalizationStatus,
  PersonalLearningPathEnrollmentApi,
} from "@/features/admin/courses/types/admin-course-api-types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export const enrollmentListQueryKeys = {
  all: ["course-enrollments"] as const,
  list: (learningPathId: string, query: PersonalLearningPathEnrollmentsQuery) =>
    [...enrollmentListQueryKeys.all, learningPathId, query] as const,
};

const PAGE_SIZE = 10;

/** Generates a short unique idempotency key using crypto.randomUUID (available in modern browsers) */
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useEnrollmentListPanel(learningPathId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const token = session?.accessToken ?? "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<PersonalizationStatus | "ALL">("ALL");

  const [confirmingEnrollment, setConfirmingEnrollment] =
    useState<PersonalLearningPathEnrollmentApi | null>(null);

  const queryParams: PersonalLearningPathEnrollmentsQuery = {
    search: deferredSearch || undefined,
    personalizationStatus: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  };

  const enrollmentsQuery = useQuery({
    queryKey: enrollmentListQueryKeys.list(learningPathId, queryParams),
    queryFn: () => listCourseEnrollments(learningPathId, queryParams, token),
    enabled: isAuthHydrated && Boolean(token),
    placeholderData: keepPreviousData,
    refetchInterval: (data) => {
      const items = data?.state?.data?.items ?? [];
      const hasCloning = items.some((item) => item.personalizationStatus === "CLONING");
      return hasCloning ? 4000 : false;
    },
  });

  const createCloneMutation = useMutation({
    mutationFn: ({
      enrollmentId,
      idempotencyKey,
    }: {
      enrollmentId: string;
      idempotencyKey: string;
    }) => createPersonalLearningPath(enrollmentId, idempotencyKey, token),
    onSuccess: () => {
      toast.success("Đã xếp hàng tạo bản cá nhân. Vui lòng đợi quá trình hoàn tất.");
      setConfirmingEnrollment(null);
      void queryClient.invalidateQueries({
        queryKey: enrollmentListQueryKeys.all,
      });
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error ? error.message : "Không thể tạo bản cá nhân.";
      if (msg.includes("PERSONAL_LEARNING_PATH_EXISTS")) {
        toast.error("Enrollment này đã có bản cá nhân.");
      } else {
        toast.error(msg);
      }
    },
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback(
    (value: PersonalizationStatus | "ALL") => {
      setStatusFilter(value);
      setPage(1);
    },
    [],
  );

  const handleRequestCreate = useCallback(
    (enrollment: PersonalLearningPathEnrollmentApi) => {
      setConfirmingEnrollment(enrollment);
    },
    [],
  );

  const handleCancelCreate = useCallback(() => {
    setConfirmingEnrollment(null);
  }, []);

  const handleConfirmCreate = useCallback(() => {
    if (!confirmingEnrollment) return;
    createCloneMutation.mutate({
      enrollmentId: confirmingEnrollment.enrollmentId,
      idempotencyKey: generateIdempotencyKey(),
    });
  }, [confirmingEnrollment, createCloneMutation]);

  const handleOpenPersonalPath = useCallback(
    (personalPathId: string, enrollmentId: string) => {
      router.push(`/admin/courses/${personalPathId}?enrollmentId=${enrollmentId}`);
    },
    [router],
  );

  const enrollments = enrollmentsQuery.data?.items ?? [];
  const total = enrollmentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    // State
    enrollments,
    total,
    page,
    totalPages,
    search,
    statusFilter,
    confirmingEnrollment,
    // Query state
    isLoading: enrollmentsQuery.isLoading,
    isFetching: enrollmentsQuery.isFetching,
    isError: enrollmentsQuery.isError,
    isSubmitting: createCloneMutation.isPending,
    // Actions
    handleSearchChange,
    handleStatusFilterChange,
    handleRequestCreate,
    handleCancelCreate,
    handleConfirmCreate,
    handleOpenPersonalPath,
    handlePageChange: setPage,
    refetch: enrollmentsQuery.refetch,
  };
}
