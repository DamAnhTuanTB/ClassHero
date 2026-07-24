"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPersonalLearningPath } from "@/features/admin/courses/api/admin-personal-learning-paths-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

function useEnrollmentInfo(enrollmentId: string | null) {
  const session = useAuthSessionStore((state) => state.session);
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const token = session?.accessToken ?? "";

  return useQuery({
    queryKey: ["personal-path-enrollment-detail", enrollmentId],
    queryFn: () => getPersonalLearningPath(enrollmentId!, token),
    enabled: isAuthHydrated && Boolean(token) && Boolean(enrollmentId),
    staleTime: 60_000,
  });
}

export function PersonalPathBanner({
  enrollmentId,
  basePathId,
}: {
  /** enrollmentId truyền qua URL query param ?enrollmentId=xxx */
  enrollmentId: string | null;
  /** ID của khóa catalog gốc (= path.sourceLearningPathId) để link quay lại */
  basePathId: string | null;
}) {
  const { data, isLoading } = useEnrollmentInfo(enrollmentId);

  const studentName = data?.student?.name ?? "Học sinh";
  const basePathTitle = data?.baseLearningPath?.title ?? "Khóa gốc";
  const backUrl = basePathId ? `/admin/courses/${basePathId}` : "/admin/courses";

  return (
    <div
      role="banner"
      aria-label="Bản lộ trình cá nhân"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 px-5 py-4 dark:border-purple-800 dark:from-purple-950 dark:to-violet-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
          <User className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400">
            Bản lộ trình cá nhân
          </p>
          <p className="mt-0.5 font-bold text-purple-800 dark:text-purple-200">
            {isLoading ? (
              <span
                className="inline-block h-4 w-32 animate-pulse rounded bg-purple-200 dark:bg-purple-800"
                aria-label="Đang tải tên học sinh"
              />
            ) : (
              studentName
            )}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400">
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Khóa nguồn:{" "}
              {isLoading ? (
                <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-purple-200 dark:bg-purple-800" />
              ) : (
                <span className="font-semibold">{basePathTitle}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {basePathId && (
        <Link
          href={backUrl}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2 text-sm font-bold text-purple-700 transition hover:bg-purple-50 dark:border-purple-700 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Quay lại danh sách học sinh
        </Link>
      )}
    </div>
  );
}
