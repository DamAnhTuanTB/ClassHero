"use client";

import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import { CloneStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/clone-status-badge";
import { useEnrollmentListPanel } from "@/features/admin/courses/hooks/use-enrollment-list-panel";
import type { PersonalizationStatus } from "@/features/admin/courses/types/admin-course-api-types";

const CreatePersonalPathConfirmDialog = dynamic(() =>
  import("@/features/admin/courses/screens/admin-course-detail-manager/components/create-personal-path-confirm-dialog").then(
    (m) => m.CreatePersonalPathConfirmDialog,
  ),
);

const STATUS_FILTER_OPTIONS: { value: PersonalizationStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "BASE", label: "Đang học khóa gốc" },
  { value: "CLONING", label: "Đang tạo bản cá nhân" },
  { value: "PERSONALIZED", label: "Đang học bản cá nhân" },
  { value: "FAILED", label: "Lỗi" },
];

export function EnrollmentListPanel({ learningPathId }: { learningPathId: string }) {
  const {
    enrollments,
    total,
    page,
    totalPages,
    search,
    statusFilter,
    confirmingEnrollment,
    queryRenderState,
    isSubmitting,
    handleSearchChange,
    handleStatusFilterChange,
    handleRequestCreate,
    handleCancelCreate,
    handleConfirmCreate,
    handleOpenPersonalPath,
    handlePageChange,
    refetch,
  } = useEnrollmentListPanel(learningPathId);
  const isInitialPending = queryRenderState === "loading";
  const isBlockingError = queryRenderState === "error";

  return (
    <section
      id="enrollment-list-panel"
      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--theme-border)] py-4 pl-5 pr-14 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0 sm:pr-20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
            <Users
              className="h-5 w-5 text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--theme-text-strong)]">
              Học sinh đã mua
            </h2>
            {!isInitialPending && (
              <p className="text-sm text-[var(--theme-text-muted)]">{total} học sinh</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-5 py-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="flex-1">
          <TextField
            id="enrollment-search-input"
            label="Tìm học sinh"
            hideLabel
            value={search}
            icon={
              <Search
                className="h-5 w-5 text-[var(--theme-text-muted)]"
                aria-hidden="true"
              />
            }
            placeholder="Tìm học sinh (tên, email, SĐT)..."
            onChange={(e) => handleSearchChange(e.target.value)}
            trailingAction={
              search ? (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => handleSearchChange("")}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)] dark:focus:ring-1 dark:focus:ring-sky-500/15"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null
            }
          />
        </div>

        {/* Status filter */}
        <div className="shrink-0 sm:w-56">
          <OptionField
            id="enrollment-status-filter"
            label="Trạng thái"
            hideLabel
            value={statusFilter}
            icon={null}
            onChange={(value) =>
              handleStatusFilterChange(value as PersonalizationStatus | "ALL")
            }
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {isInitialPending ? (
          <EnrollmentTableSkeleton />
        ) : isBlockingError ? (
          <AdminDataErrorState
            className="border-0 shadow-none"
            description="Vui lòng thử lại để tiếp tục quản lý danh sách học sinh."
            headingLevel={3}
            onRetry={() => refetch()}
            title="Không tải được danh sách học sinh"
            variant="section"
          />
        ) : enrollments.length === 0 ? (
          <div className="py-12 text-center">
            <Users
              className="mx-auto h-10 w-10 text-[var(--theme-text-muted)] opacity-40"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-[var(--theme-text-muted)]">
              {search || statusFilter !== "ALL"
                ? "Không có kết quả phù hợp với bộ lọc."
                : "Chưa có học sinh nào mua khóa học này."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--theme-border)]">
                  <th className="pb-3 pr-4 text-left text-xs font-bold uppercase tracking-wide text-[var(--theme-text-muted)]">
                    Học sinh
                  </th>
                  <th className="pb-3 pr-4 text-left text-xs font-bold uppercase tracking-wide text-[var(--theme-text-muted)]">
                    Trạng thái
                  </th>
                  <th className="pb-3 pr-4 text-left text-xs font-bold uppercase tracking-wide text-[var(--theme-text-muted)]">
                    Hạn học
                  </th>
                  <th className="pb-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--theme-text-muted)]">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.enrollmentId} className="group">
                    {/* Student info */}
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[var(--theme-text-strong)]">
                        {enrollment.student.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--theme-text-muted)]">
                        {enrollment.student.email ?? enrollment.student.phone ?? "—"}
                      </p>
                    </td>

                    {/* Personalization status */}
                    <td className="py-3 pr-4">
                      <CloneStatusBadge status={enrollment.personalizationStatus} />
                    </td>

                    {/* Expiry */}
                    <td className="py-3 pr-4 text-[var(--theme-text-muted)]">
                      {enrollment.expiresAt
                        ? new Date(enrollment.expiresAt).toLocaleDateString("vi-VN")
                        : "Không giới hạn"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right">
                      {enrollment.personalizationStatus === "BASE" && (
                        <button
                          type="button"
                          id={`create-personal-path-${enrollment.enrollmentId}`}
                          onClick={() => handleRequestCreate(enrollment)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-purple-600 px-3 text-xs font-bold text-white transition hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          Tạo bản cá nhân
                        </button>
                      )}
                      {enrollment.personalizationStatus === "CLONING" && (
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[var(--theme-text-muted)] opacity-60">
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          Đang xử lý...
                        </span>
                      )}
                      {enrollment.personalizationStatus === "FAILED" && (
                        <button
                          type="button"
                          id={`retry-personal-path-${enrollment.enrollmentId}`}
                          onClick={() => handleRequestCreate(enrollment)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-bg)] px-3 text-xs font-bold text-[var(--theme-danger-text)] transition hover:opacity-80"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Thử lại
                        </button>
                      )}
                      {enrollment.personalizationStatus === "PERSONALIZED" &&
                        enrollment.personalLearningPath && (
                          <button
                            type="button"
                            id={`open-personal-path-${enrollment.enrollmentId}`}
                            onClick={() =>
                              handleOpenPersonalPath(
                                enrollment.personalLearningPath!.id,
                                enrollment.enrollmentId,
                              )
                            }
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 text-xs font-bold text-purple-700 transition hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Mở bản cá nhân
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isInitialPending && !isBlockingError && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-[var(--theme-border)] pt-4">
            <p className="text-sm text-[var(--theme-text-muted)]">
              Trang {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="theme-button-neutral inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Trước
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="theme-button-neutral inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang sau"
              >
                Sau
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmingEnrollment ? (
        <CreatePersonalPathConfirmDialog
          isOpen={Boolean(confirmingEnrollment)}
          isSubmitting={isSubmitting}
          studentName={confirmingEnrollment.student.name}
          basePathTitle={confirmingEnrollment.baseLearningPath.title}
          onCancel={handleCancelCreate}
          onConfirm={handleConfirmCreate}
        />
      ) : null}
    </section>
  );
}

function EnrollmentTableSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải danh sách học sinh"
      className="min-h-48 animate-pulse overflow-x-auto"
    >
      <div className="min-w-[600px]">
        <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_6rem] gap-4 border-b border-[var(--theme-border)] pb-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-3.5 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_6rem] items-center gap-4 border-b border-[var(--theme-border)] py-3 last:border-b-0"
          >
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-1/2 rounded-full" />
              <SkeletonBlock className="h-3 w-2/3 rounded-full opacity-70" />
            </div>
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <SkeletonBlock className="h-9 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
