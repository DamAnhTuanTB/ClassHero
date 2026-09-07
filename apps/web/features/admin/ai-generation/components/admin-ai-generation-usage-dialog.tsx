"use client";

import { ChevronLeft, ChevronRight, Coins, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { ProviderUsageEventDetailsDialog } from "@/features/admin/ai-settings/components/provider-usage-event-details-dialog";
import type { UsageEvent } from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  formatCacheStatus,
  formatDateTime,
  formatNumber,
  formatReasoningEffort,
  formatUsageDuration,
  formatUsagePurpose,
  formatVnd,
  usageStatusLabels,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { useAdminAiGenerationUsageEvents } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";

export function AdminAiGenerationUsageDialog({
  aiGenerationId,
  isOpen,
  onClose,
}: {
  aiGenerationId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<UsageEvent | null>(null);
  const eventsQuery = useAdminAiGenerationUsageEvents(aiGenerationId, page, isOpen);

  useEffect(() => {
    if (isOpen) setPage(1);
    if (!isOpen) setSelectedEvent(null);
  }, [aiGenerationId, isOpen]);

  return (
    <>
      <EditorDialogShell
        ariaLabel="Chi tiết các lượt gọi AI"
        isOpen={isOpen}
        onClose={onClose}
        panelClassName="max-w-7xl"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Chi tiết các lượt gọi AI
            </h2>
            <p className="mt-0.5 text-sm font-medium text-[var(--theme-text-muted)]">
              Tác vụ, thời gian phản hồi và chi phí thực tế của lần sinh này.
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {eventsQuery.isPending ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-[var(--theme-text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Đang tải lịch sử chi phí...
            </div>
          ) : eventsQuery.isError ? (
            <AdminDataErrorState
              description="Không tải được các lượt gọi thuộc lần sinh này."
              headingLevel={3}
              isRetrying={eventsQuery.isFetching}
              onRetry={() => eventsQuery.refetch()}
              title="Không tải được lịch sử chi phí"
              variant="compact"
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  label="Tổng lượt gọi"
                  value={new Intl.NumberFormat("vi-VN").format(
                    eventsQuery.data?.summary.totalCalls ?? 0,
                  )}
                />
                <SummaryCard
                  label="Tổng chi phí thực tế"
                  value={formatVnd(eventsQuery.data?.summary.totalCostVnd ?? 0)}
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] text-left text-sm">
                    <thead className="bg-[var(--theme-surface-soft)] text-xs uppercase text-[var(--theme-text-muted)]">
                      <tr>
                        <th className="px-4 py-3">Dịch vụ / loại tác vụ</th>
                        <th className="px-4 py-3">Mức sử dụng</th>
                        <th className="px-4 py-3">Reasoning effort</th>
                        <th className="px-4 py-3">Thời gian phản hồi</th>
                        <th className="px-4 py-3">Chi phí</th>
                        <th className="px-4 py-3">Thời điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-border)]">
                      {eventsQuery.data?.items.length ? (
                        eventsQuery.data.items.map((event) => (
                          <tr
                            key={event.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Xem chi tiết ${event.catalogItem?.displayName ?? event.provider}, ${formatVnd(event.costVnd)}`}
                            className="cursor-pointer transition-colors hover:bg-[var(--theme-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-primary)]"
                            onClick={() => setSelectedEvent(event)}
                            onKeyDown={(keyboardEvent) => {
                              if (
                                keyboardEvent.key === "Enter" ||
                                keyboardEvent.key === " "
                              ) {
                                keyboardEvent.preventDefault();
                                setSelectedEvent(event);
                              }
                            }}
                          >
                            <td className="px-4 py-3">
                              <p className="font-extrabold text-[var(--theme-text-strong)]">
                                {event.catalogItem?.displayName ?? event.provider}
                              </p>
                              <p className="text-xs text-[var(--theme-text-muted)]">
                                {formatUsagePurpose(event)} ·{" "}
                                {usageStatusLabels[event.status]}
                                {formatCacheStatus(event.cacheStatus)
                                  ? ` · ${formatCacheStatus(event.cacheStatus)}`
                                  : ""}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-[var(--theme-text)]">
                              {event.category === "OCR_SERVICE"
                                ? `${event.pages} trang`
                                : `${formatNumber(event.totalTokens)} đơn vị AI`}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--theme-text)]">
                              {formatReasoningEffort(event)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--theme-text)]">
                              {formatUsageDuration(event.latencyMs, event.status)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-extrabold text-[var(--theme-text-strong)]">
                              {formatVnd(event.costVnd)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[var(--theme-text-muted)]">
                              {formatDateTime(event.createdAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-10 text-center font-medium text-[var(--theme-text-muted)]"
                          >
                            Chưa có lượt sử dụng được ghi nhận.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {eventsQuery.data?.pagination &&
                eventsQuery.data.pagination.totalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-[var(--theme-border)] px-4 py-3">
                    <span className="text-sm font-medium text-[var(--theme-text-muted)]">
                      Trang {eventsQuery.data.pagination.page} /{" "}
                      {eventsQuery.data.pagination.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <PaginationButton
                        ariaLabel="Trang trước"
                        disabled={page <= 1 || eventsQuery.isFetching}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </PaginationButton>
                      <PaginationButton
                        ariaLabel="Trang sau"
                        disabled={
                          page >= eventsQuery.data.pagination.totalPages ||
                          eventsQuery.isFetching
                        }
                        onClick={() => setPage((current) => current + 1)}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </PaginationButton>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="theme-button-primary min-h-11 rounded-lg px-6 font-extrabold"
          >
            Đóng
          </button>
        </footer>
      </EditorDialogShell>

      <ProviderUsageEventDetailsDialog
        event={selectedEvent}
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-text-muted)]">
        <Coins className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-xl font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}

function PaginationButton({
  ariaLabel,
  children,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] transition-colors hover:bg-[var(--theme-surface-soft)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
