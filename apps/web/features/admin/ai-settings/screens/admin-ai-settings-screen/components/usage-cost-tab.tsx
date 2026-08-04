"use client";

import { AlertTriangle, CheckCircle2, Coins, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CheckboxField } from "@/components/common/forms/checkbox-field";
import { NumericSettingsField } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
import type {
  ProviderBudget,
  TimelineResponse,
  UsageBreakdownItem,
  UsageEventsResponse,
  UsageGranularity,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  aiFeatureLabels,
  formatCacheStatus,
  formatDateTime,
  formatNumber,
  formatVnd,
  usageStatusLabels,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";

export function UsageCostTab({
  budgets: initialBudgets,
  timeline,
  breakdown,
  events,
  granularity,
  isLoading,
  isSavingBudgets,
  onGranularityChange,
  onSaveBudgets,
}: {
  budgets: ProviderBudget[];
  timeline?: TimelineResponse;
  breakdown?: UsageBreakdownItem[];
  events?: UsageEventsResponse;
  granularity: UsageGranularity;
  isLoading: boolean;
  isSavingBudgets: boolean;
  onGranularityChange: (value: UsageGranularity) => void;
  onSaveBudgets: (budgets: ProviderBudget[]) => void;
}) {
  const [budgets, setBudgets] = useState(initialBudgets);
  useEffect(() => setBudgets(initialBudgets), [initialBudgets]);

  const maxCost = useMemo(
    () => Math.max(1, ...(timeline?.points.map((point) => point.costVnd) ?? [1])),
    [timeline],
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Chi phí theo thời gian
          </h3>
          <div className="inline-flex rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1">
            {(["DAY", "WEEK", "MONTH"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={granularity === value}
                onClick={() => onGranularityChange(value)}
                className={`min-h-9 whitespace-nowrap rounded-md px-3 text-sm font-extrabold transition ${
                  granularity === value
                    ? "bg-[var(--theme-primary)] text-white"
                    : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
                }`}
              >
                {value === "DAY" ? "Ngày" : value === "WEEK" ? "Tuần" : "Tháng"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
          {isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-bold text-[var(--theme-text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" /> Đang tải thống kê
            </div>
          ) : timeline?.points.length ? (
            <div
              className="flex min-h-56 items-end gap-2 overflow-x-auto pb-2"
              role="img"
              aria-label="Biểu đồ chi phí sử dụng"
            >
              {timeline.points.map((point) => (
                <div
                  key={point.bucket}
                  className="flex min-w-14 flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[10px] font-bold text-[var(--theme-text-muted)]">
                    {formatVnd(point.costVnd)}
                  </span>
                  <div className="flex h-40 w-full max-w-12 items-end rounded-t-lg bg-[var(--theme-surface-soft)]">
                    <div
                      className="w-full rounded-t-lg bg-sky-500 transition-[height]"
                      style={{
                        height: `${Math.max(3, (point.costVnd / maxCost) * 100)}%`,
                      }}
                      title={`${point.calls} lượt gọi, ${formatVnd(point.costVnd)}`}
                    />
                  </div>
                  <span className="whitespace-nowrap text-[10px] font-bold text-[var(--theme-text-muted)]">
                    {point.bucket}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <Coins className="h-8 w-8 text-[var(--theme-text-muted)]" />
              <p className="mt-3 font-extrabold text-[var(--theme-text-strong)]">
                Chưa có chi phí sử dụng
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Ngân sách tháng
          </h3>
          <button
            type="button"
            disabled={isSavingBudgets}
            onClick={() => onSaveBudgets(budgets)}
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-60"
          >
            {isSavingBudgets ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu ngân sách
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {budgets.map((budget) => {
            const warning = budget.usedPercent >= 90;
            const blocked = budget.enforcementState === "BLOCKED";
            return (
              <article
                key={budget.scope}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-extrabold text-[var(--theme-text-strong)]">
                    {budget.scope === "ALL"
                      ? "Tất cả dịch vụ"
                      : budget.scope === "AI"
                        ? "Tính năng AI"
                        : "Đọc tài liệu"}
                  </p>
                  {blocked ? (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-extrabold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      Đã tạm dừng
                    </span>
                  ) : warning ? (
                    <AlertTriangle className="h-4 w-4 text-[var(--theme-warning-text)]" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[var(--theme-success-text)]" />
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
                  <div>
                    <p className="text-[var(--theme-text-muted)]">Đã dùng</p>
                    <p className="mt-0.5 text-[var(--theme-text-strong)]">
                      {formatVnd(budget.usedVnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--theme-text-muted)]">Đang giữ</p>
                    <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                      {formatVnd(budget.reservedVnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--theme-text-muted)]">Còn lại</p>
                    <p
                      className={`mt-0.5 ${blocked ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
                    >
                      {formatVnd(budget.availableVnd)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--theme-surface-soft)]">
                  <div
                    className={`h-full rounded-full ${warning ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, budget.usedPercent)}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-3">
                  <NumericSettingsField
                    id={`budget-${budget.scope.toLocaleLowerCase()}-limit`}
                    label="Mức chi tối đa mỗi tháng"
                    value={budget.monthlyLimitVnd}
                    min={0}
                    formatThousands
                    suffix="VNĐ"
                    onChange={(value) =>
                      setBudgets((current) =>
                        current.map((item) =>
                          item.scope === budget.scope
                            ? { ...item, monthlyLimitVnd: value }
                            : item,
                        ),
                      )
                    }
                  />
                  <CheckboxField
                    id={`budget-${budget.scope.toLocaleLowerCase()}-hard-stop`}
                    label="Tạm dừng khi hết ngân sách"
                    checked={budget.hardStop}
                    onChange={(event) =>
                      setBudgets((current) =>
                        current.map((item) =>
                          item.scope === budget.scope
                            ? { ...item, hardStop: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.35fr]">
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <h3 className="font-extrabold text-[var(--theme-text-strong)]">
            Chi phí theo tính năng
          </h3>
          <div className="mt-3 space-y-2">
            {breakdown?.length ? (
              breakdown.slice(0, 8).map((item) => (
                <div
                  key={`${item.provider}-${item.catalogItemId}-${item.feature}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--theme-surface-soft)] px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-[var(--theme-text-strong)]">
                      {item.model?.displayName ?? item.provider}
                    </p>
                    <p className="truncate text-xs font-semibold text-[var(--theme-text-muted)]">
                      {item.feature
                        ? aiFeatureLabels[item.feature]
                        : item.category === "OCR_SERVICE"
                          ? "Đọc tài liệu"
                          : "Tính năng AI khác"}{" "}
                      · {item.calls} lượt
                    </p>
                  </div>
                  <p className="shrink-0 font-extrabold text-[var(--theme-text)]">
                    {formatVnd(item.costVnd)}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm font-semibold text-[var(--theme-text-muted)]">
                Chưa có dữ liệu phân bổ.
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
          <div className="border-b border-[var(--theme-border)] px-4 py-3">
            <h3 className="font-extrabold text-[var(--theme-text-strong)]">
              Lượt sử dụng gần đây
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--theme-surface-soft)] text-xs uppercase text-[var(--theme-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Dịch vụ</th>
                  <th className="px-4 py-3">Mức sử dụng</th>
                  <th className="px-4 py-3">Chi phí</th>
                  <th className="px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {events?.items.length ? (
                  events.items.slice(0, 10).map((event) => (
                    <tr key={event.id}>
                      <td className="px-4 py-3">
                        <p className="font-extrabold text-[var(--theme-text-strong)]">
                          {event.catalogItem?.displayName ?? event.provider}
                        </p>
                        <p className="text-xs text-[var(--theme-text-muted)]">
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
                      <td className="px-4 py-3 font-extrabold text-[var(--theme-text)]">
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
                      colSpan={4}
                      className="px-4 py-10 text-center text-[var(--theme-text-muted)]"
                    >
                      Chưa có lượt sử dụng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
