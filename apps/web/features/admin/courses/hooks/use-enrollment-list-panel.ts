"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  backgroundJobStatusChangedEventSchema,
  realtimeSocketEvents,
} from "@learning-path/shared";
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
import { getQueryRenderState } from "@/lib/query-render-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { useAuthenticatedRealtime } from "@/components/common/realtime/authenticated-realtime-provider";

export const enrollmentListQueryKeys = {
  all: ["admin", "course-enrollments"] as const,
  list: (
    learningPathId: string,
    userId: string | undefined,
    query: PersonalLearningPathEnrollmentsQuery,
  ) =>
    [...enrollmentListQueryKeys.all, learningPathId, userId ?? "guest", query] as const,
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
  const { socket: realtimeSocket, status: realtimeStatus } = useAuthenticatedRealtime();
  const session = useAuthSessionStore((state) => state.session);
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const token = session?.accessToken ?? "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<PersonalizationStatus | "ALL">("ALL");

  const [confirmingEnrollment, setConfirmingEnrollment] =
    useState<PersonalLearningPathEnrollmentApi | null>(null);

  const queryParams: PersonalLearningPathEnrollmentsQuery = {
    search: debouncedSearch || undefined,
    personalizationStatus: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  };

  const enrollmentsQuery = useQuery({
    queryKey: enrollmentListQueryKeys.list(learningPathId, session?.user.id, queryParams),
    queryFn: () => listCourseEnrollments(learningPathId, queryParams, token),
    enabled: isAuthHydrated && Boolean(token),
    placeholderData: keepPreviousData,
    refetchInterval: (data) => {
      const items = data?.state?.data?.items ?? [];
      const hasCloning = items.some((item) => item.personalizationStatus === "CLONING");
      return hasCloning ? (realtimeStatus === "connected" ? 60_000 : 4_000) : false;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!realtimeSocket || realtimeStatus !== "connected") return;

    const handleCloneJobStatus = (rawEvent: unknown) => {
      const parsed = backgroundJobStatusChangedEventSchema.safeParse(rawEvent);
      if (
        !parsed.success ||
        parsed.data.queue !== "PERSONAL_LEARNING_PATH_CLONE"
      ) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: enrollmentListQueryKeys.all });
    };

    realtimeSocket.on(
      realtimeSocketEvents.backgroundJobStatusChanged,
      handleCloneJobStatus,
    );
    return () => {
      realtimeSocket.off(
        realtimeSocketEvents.backgroundJobStatusChanged,
        handleCloneJobStatus,
      );
    };
  }, [queryClient, realtimeSocket, realtimeStatus]);

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
      const msg = getUserFacingErrorMessage(
        error,
        "Không thể tạo bản học cá nhân. Vui lòng thử lại.",
        {
          PERSONAL_LEARNING_PATH_EXISTS: "Học sinh này đã có bản học cá nhân.",
        },
      );
      toast.error(msg);
    },
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: PersonalizationStatus | "ALL") => {
    setStatusFilter(value);
    setPage(1);
  }, []);

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
  const queryRenderState = getQueryRenderState({
    ...enrollmentsQuery,
    isPrerequisitePending: !isAuthHydrated,
  });

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
    queryRenderState,
    isFetching: enrollmentsQuery.isFetching,
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
