export type AdminFigureStatus =
  "QUEUED" | "RENDERING" | "REPAIRING" | "SUCCEEDED" | "NEEDS_REVIEW" | "FAILED";

export type AdminFigureStatusCounts = {
  total: number;
  queued: number;
  processing: number;
  succeeded: number;
  needsReview: number;
  failed: number;
};

const ACTIVE_ADMIN_FIGURE_STATUSES = new Set<AdminFigureStatus>([
  "QUEUED",
  "RENDERING",
  "REPAIRING",
]);

export function hasActiveAdminFigure(
  figures: ReadonlyArray<{ status: AdminFigureStatus }>,
) {
  return figures.some((figure) => ACTIVE_ADMIN_FIGURE_STATUSES.has(figure.status));
}

export function countAdminFigureStatuses(
  figures: ReadonlyArray<{ status: AdminFigureStatus }>,
): AdminFigureStatusCounts {
  const counts: AdminFigureStatusCounts = {
    total: figures.length,
    queued: 0,
    processing: 0,
    succeeded: 0,
    needsReview: 0,
    failed: 0,
  };

  for (const figure of figures) {
    if (figure.status === "QUEUED") counts.queued += 1;
    if (figure.status === "RENDERING" || figure.status === "REPAIRING") {
      counts.processing += 1;
    }
    if (figure.status === "SUCCEEDED") counts.succeeded += 1;
    if (figure.status === "NEEDS_REVIEW") counts.needsReview += 1;
    if (figure.status === "FAILED") counts.failed += 1;
  }

  return counts;
}

export function getAdminFigureStatusPresentation(status: AdminFigureStatus) {
  return {
    QUEUED: {
      label: "Chờ xử lý",
      icon: "clock" as const,
      spins: false,
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    },
    RENDERING: {
      label: "Đang render",
      icon: "loader" as const,
      spins: true,
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    },
    REPAIRING: {
      label: "Đang sửa",
      icon: "loader" as const,
      spins: true,
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    },
    SUCCEEDED: {
      label: "Thành công",
      icon: "succeeded" as const,
      spins: false,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    },
    NEEDS_REVIEW: {
      label: "Cần xem lại",
      icon: "review" as const,
      spins: false,
      className:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    },
    FAILED: {
      label: "Lỗi",
      icon: "failed" as const,
      spins: false,
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
    },
  }[status];
}
