"use client";

import { AlertTriangle, CheckCircle2, Coins, Loader2, Save, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CheckboxField } from "@/components/common/forms/checkbox-field";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { NumericSettingsField } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
import type {
  ProviderBudget,
  TimelineResponse,
  UsageBreakdownItem,
  UsageEvent,
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
  onEventsPageChange,
  onGranularityChange,
  onSaveBudgets,
}: {
  budgets: ProviderBudget[];
  timeline?: TimelineResponse;
  breakdown?: UsageBreakdownItem[];
  events?: UsageEventsResponse;
  eventsPage: number;
  granularity: UsageGranularity;
  isLoading: boolean;
  isSavingBudgets: boolean;
  onEventsPageChange: (page: number) => void;
  onGranularityChange: (value: UsageGranularity) => void;
  onSaveBudgets: (budgets: ProviderBudget[]) => void;
}) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [selectedEvent, setSelectedEvent] = useState<UsageEvent | null>(null);

  useEffect(() => setBudgets(initialBudgets), [initialBudgets]);

  const maxCost = useMemo(
    () => Math.max(1, ...(timeline?.points.map((point) => point.costVnd) ?? [1])),
    [timeline],
  );

  const breakdownGroups = useMemo(() => {
    type ModelAgg = { name: string, calls: number, costVnd: number };
    const groups: Record<string, { provider: string, displayName: string, totalCostVnd: number, totalCalls: number, models: Record<string, ModelAgg> }> = {
      OPENAI: { provider: "OPENAI", displayName: "OPENAI", totalCostVnd: 0, totalCalls: 0, models: {} },
      MATHPIX: { provider: "MATHPIX", displayName: "Mathpix PDF OCR", totalCostVnd: 0, totalCalls: 0, models: {} },
      GEMINI: { provider: "GEMINI", displayName: "GEMINI", totalCostVnd: 0, totalCalls: 0, models: {} },
    };
    
    breakdown?.forEach(item => {
      const p = item.provider;
      if (!groups[p]) {
        groups[p] = { provider: p, displayName: p, totalCostVnd: 0, totalCalls: 0, models: {} };
      }
      
      groups[p].totalCostVnd += item.costVnd;
      groups[p].totalCalls += item.calls;
      
      if (p !== "MATHPIX") {
        const modelName = item.model?.displayName;
        if (modelName) {
           if (!groups[p].models[modelName]) {
             groups[p].models[modelName] = { name: modelName, calls: 0, costVnd: 0 };
           }
           groups[p].models[modelName].calls += item.calls;
           groups[p].models[modelName].costVnd += item.costVnd;
        }
      }
    });
    
    return [groups.OPENAI, groups.MATHPIX, groups.GEMINI, ...Object.values(groups).filter(g => !["OPENAI", "GEMINI", "MATHPIX"].includes(g.provider))].filter((g): g is NonNullable<typeof g> => Boolean(g)).map(g => ({
       ...g,
       modelsList: Object.values(g.models).sort((a, b) => b.costVnd - a.costVnd)
    }));
  }, [breakdown]);

  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

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
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60"
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
            Chi phí theo Nhà cung cấp & Model
          </h3>
          <div className="mt-3 space-y-3">
            {breakdownGroups.length ? (
              breakdownGroups.map((group) => {
                const isExpandable = group.provider !== "MATHPIX" && group.modelsList.length > 0;
                const isExpanded = !!expandedProviders[group.provider];
                
                return (
                  <div key={group.provider} className="rounded-lg bg-[var(--theme-surface-soft)] p-3 space-y-2">
                    <div 
                      className={`flex items-center justify-between gap-3 ${isExpandable ? "cursor-pointer select-none" : ""}`}
                      onClick={() => isExpandable && toggleProvider(group.provider)}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 font-extrabold text-[var(--theme-text-strong)] text-sm">
                          {group.displayName}
                          {isExpandable && (
                            isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                        {!isExpandable && group.totalCalls > 0 && (
                          <div className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                             {group.totalCalls} lượt
                          </div>
                        )}
                      </div>
                      <div className="font-extrabold text-[var(--theme-text)] text-sm">
                        {formatVnd(group.totalCostVnd)}
                      </div>
                    </div>
                    
                    {isExpandable && isExpanded && group.modelsList.map((model) => (
                      <div
                        key={model.name}
                        className="flex items-center justify-between gap-3 pt-2 mt-2 border-t border-[var(--theme-border)] text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-[var(--theme-text-strong)]">
                            {model.name}
                          </p>
                          <p className="truncate text-xs text-[var(--theme-text-muted)] mt-0.5">
                            {model.calls} lượt
                          </p>
                        </div>
                        <div className="shrink-0 font-extrabold text-[var(--theme-text)]">
                          {formatVnd(model.costVnd)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
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
              Tất cả lượt sử dụng
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
                  events.items.map((event) => (
                    <tr 
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="cursor-pointer hover:bg-[var(--theme-surface-soft)] transition-colors"
                    >
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
          
          {events?.pagination && events.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--theme-border)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--theme-text-muted)]">
                Trang {events.pagination.page} / {events.pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={events.pagination.page <= 1 || isLoading}
                  onClick={() => onEventsPageChange(events.pagination.page - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={events.pagination.page >= events.pagination.totalPages || isLoading}
                  onClick={() => onEventsPageChange(events.pagination.page + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedEvent && (
        <EditorDialogShell
          ariaLabel="Chi tiết lượt sử dụng"
          isOpen
          onClose={() => setSelectedEvent(null)}
          panelClassName="max-w-3xl"
        >
          <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
            <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
              Chi tiết chi phí
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[var(--theme-text-muted)]">Dịch vụ</p>
                <p className="font-extrabold text-[var(--theme-text-strong)]">
                  {selectedEvent.catalogItem?.displayName ?? selectedEvent.provider}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--theme-text-muted)] mb-2">Công thức tính chi phí</p>
                <div className="rounded-lg border border-[var(--theme-border)] overflow-x-auto">
                  <table className="min-w-[500px] w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[var(--theme-surface-soft)] text-xs text-[var(--theme-text-muted)] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Hạng mục</th>
                        <th className="px-4 py-3 font-semibold text-right">Số lượng</th>
                        <th className="px-4 py-3 font-semibold text-right">Đơn giá</th>
                        <th className="px-4 py-3 font-semibold text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-border)] bg-[var(--theme-surface)]">
                      {selectedEvent.category === "OCR_SERVICE" ? (
                        <tr>
                          <td className="px-4 py-3 text-[var(--theme-text-strong)]">Số trang</td>
                          <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">{new Intl.NumberFormat("vi-VN").format(selectedEvent.pages ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-[var(--theme-text-muted)]">
                            {selectedEvent.priceVersion?.rates?.find(r => r.metric === "PAGE") ? `$${selectedEvent.priceVersion.rates.find(r => r.metric === "PAGE")?.unitPriceUsd} / ${new Intl.NumberFormat("vi-VN").format(selectedEvent.priceVersion.rates.find(r => r.metric === "PAGE")?.unitSize ?? 1)}` : "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">
                            ${((selectedEvent.pages ?? 0) * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "PAGE")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "PAGE")?.unitSize ?? 1)).toFixed(6)}
                          </td>
                        </tr>
                      ) : (() => {
                        const cachedTokens = Math.max(0, selectedEvent.cachedInputTokens ?? 0);
                        const uncachedPromptTokens = Math.max(0, (selectedEvent.promptTokens ?? 0) - cachedTokens);
                        return (
                        <>
                          <tr>
                            <td className="px-4 py-3 text-[var(--theme-text-strong)]">Uncached Prompt Tokens</td>
                            <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">{new Intl.NumberFormat("vi-VN").format(uncachedPromptTokens)}</td>
                            <td className="px-4 py-3 text-right text-[var(--theme-text-muted)]">
                              {selectedEvent.priceVersion?.rates?.find(r => r.metric === "INPUT_TOKEN") ? `$${selectedEvent.priceVersion.rates.find(r => r.metric === "INPUT_TOKEN")?.unitPriceUsd} / ${new Intl.NumberFormat("vi-VN").format(selectedEvent.priceVersion.rates.find(r => r.metric === "INPUT_TOKEN")?.unitSize ?? 1)}` : "-"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">
                              ${(uncachedPromptTokens * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "INPUT_TOKEN")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "INPUT_TOKEN")?.unitSize ?? 1)).toFixed(6)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-[var(--theme-text-strong)]">Cached Tokens</td>
                            <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">{new Intl.NumberFormat("vi-VN").format(cachedTokens)}</td>
                            <td className="px-4 py-3 text-right text-[var(--theme-text-muted)]">
                              {selectedEvent.priceVersion?.rates?.find(r => r.metric === "CACHED_INPUT_TOKEN") ? `$${selectedEvent.priceVersion.rates.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitPriceUsd} / ${new Intl.NumberFormat("vi-VN").format(selectedEvent.priceVersion.rates.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitSize ?? 1)}` : "-"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">
                              ${(cachedTokens * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitSize ?? 1)).toFixed(6)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-[var(--theme-text-strong)]">Completion Tokens</td>
                            <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">{new Intl.NumberFormat("vi-VN").format(selectedEvent.completionTokens ?? 0)}</td>
                            <td className="px-4 py-3 text-right text-[var(--theme-text-muted)]">
                              {selectedEvent.priceVersion?.rates?.find(r => r.metric === "OUTPUT_TOKEN") ? `$${selectedEvent.priceVersion.rates.find(r => r.metric === "OUTPUT_TOKEN")?.unitPriceUsd} / ${new Intl.NumberFormat("vi-VN").format(selectedEvent.priceVersion.rates.find(r => r.metric === "OUTPUT_TOKEN")?.unitSize ?? 1)}` : "-"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-right text-[var(--theme-text-strong)]">
                              ${((selectedEvent.completionTokens ?? 0) * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "OUTPUT_TOKEN")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "OUTPUT_TOKEN")?.unitSize ?? 1)).toFixed(6)}
                            </td>
                          </tr>
                          <tr className="bg-[var(--theme-surface-soft)]">
                            <td className="px-4 py-3 font-bold text-[var(--theme-text-strong)]">Tổng Token</td>
                            <td className="px-4 py-3 font-bold text-right text-[var(--theme-text-strong)]">{new Intl.NumberFormat("vi-VN").format(selectedEvent.totalTokens ?? 0)}</td>
                            <td className="px-4 py-3 text-right text-[var(--theme-text-muted)]"></td>
                            <td className="px-4 py-3 font-bold text-right text-[var(--theme-text-strong)]">
                              {(() => {
                                const pRateUsd = (uncachedPromptTokens * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "INPUT_TOKEN")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "INPUT_TOKEN")?.unitSize ?? 1));
                                const cRateUsd = (cachedTokens * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitSize ?? 1));
                                const oRateUsd = ((selectedEvent.completionTokens ?? 0) * (selectedEvent.priceVersion?.rates?.find(r => r.metric === "OUTPUT_TOKEN")?.unitPriceUsd ?? 0) / (selectedEvent.priceVersion?.rates?.find(r => r.metric === "OUTPUT_TOKEN")?.unitSize ?? 1));
                                
                                return (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <div className="text-xs font-normal text-[var(--theme-text-muted)] tracking-tight">
                                      = ${pRateUsd.toFixed(6)} + ${cRateUsd.toFixed(6)} + ${oRateUsd.toFixed(6)}
                                    </div>
                                    <div className="text-base text-[var(--theme-primary)] mt-0.5">
                                      ${selectedEvent.estimatedCostUsd?.toFixed(6) ?? "0.000000"}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        </>
                        );
                      })()}
                      {selectedEvent.category === "OCR_SERVICE" && (
                        <tr className="bg-[var(--theme-surface-soft)]">
                          <td colSpan={3} className="px-4 py-3 font-bold text-[var(--theme-text-strong)] text-right">Chi phí ước tính (USD)</td>
                          <td className="px-4 py-3 font-bold text-right text-[var(--theme-text-strong)]">
                            ${selectedEvent.estimatedCostUsd?.toFixed(6) ?? "0.000000"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-lg bg-[var(--theme-surface-soft)] p-4 border border-[var(--theme-border)] text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--theme-text-muted)] font-medium">Chi phí ước tính (USD):</span>
                    <span className="font-semibold text-[var(--theme-text-strong)]">${selectedEvent.estimatedCostUsd?.toFixed(6) ?? "0.000000"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--theme-text-muted)] font-medium">Tỷ giá (VNĐ/USD):</span>
                    <span className="font-semibold text-[var(--theme-text-strong)]">{new Intl.NumberFormat("vi-VN").format(selectedEvent.fxRateVndPerUsd ?? 25000)} VNĐ / 1 USD</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-[var(--theme-border)] text-[var(--theme-primary)]">
                    <span className="font-bold">Tổng chi phí (VNĐ):</span>
                    <span className="font-extrabold text-lg">{formatVnd(selectedEvent.costVnd ?? 0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--theme-text-muted)] mb-2">Dữ liệu trả về từ AI (raw usage)</p>
                <pre className="text-xs font-mono bg-[var(--theme-surface-soft)] p-4 rounded-lg overflow-auto max-h-96 border border-[var(--theme-border)]">
                  {selectedEvent.rawUsageJson ? JSON.stringify(selectedEvent.rawUsageJson, null, 2) : "Không có dữ liệu"}
                </pre>
              </div>
            </div>
          </div>
          <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="theme-button-primary min-h-11 rounded-lg px-6 font-extrabold"
            >
              Đóng
            </button>
          </footer>
        </EditorDialogShell>
      )}
    </div>
  );
}
