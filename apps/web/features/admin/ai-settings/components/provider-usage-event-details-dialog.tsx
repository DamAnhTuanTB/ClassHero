"use client";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { UsageEvent } from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  formatUsagePurpose,
  formatVnd,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";

export function ProviderUsageEventDetailsDialog({
  event,
  isOpen,
  onClose,
}: {
  event: UsageEvent | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  const cachedTokens = Math.max(0, event.cachedInputTokens ?? 0);
  const cacheWriteTokens = Math.max(0, event.cacheWriteInputTokens ?? 0);
  const uncachedPromptTokens = Math.max(
    0,
    (event.promptTokens ?? 0) - cachedTokens - cacheWriteTokens,
  );
  const inputRate = findRate(event, "INPUT_TOKEN");
  const cacheWriteInputRate = inputRate
    ? { ...inputRate, unitPriceUsd: inputRate.unitPriceUsd * 1.25 }
    : undefined;
  const cachedInputRate = findRate(event, "CACHED_INPUT_TOKEN");
  const outputRate = findRate(event, "OUTPUT_TOKEN");
  const pageRate = findRate(event, "PAGE");
  const inputCost = calculateRateCost(uncachedPromptTokens, inputRate);
  const cacheWriteInputCost = calculateRateCost(cacheWriteTokens, cacheWriteInputRate);
  const cachedInputCost = calculateRateCost(cachedTokens, cachedInputRate);
  const outputCost = calculateRateCost(event.completionTokens ?? 0, outputRate);
  const pageCost = calculateRateCost(event.pages ?? 0, pageRate);

  return (
    <EditorDialogShell
      ariaLabel="Chi tiết lượt sử dụng"
      isOpen={isOpen}
      onClose={onClose}
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
            <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
              Dịch vụ
            </p>
            <p className="font-extrabold text-[var(--theme-text-strong)]">
              {event.catalogItem?.displayName ?? event.provider}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--theme-text-muted)]">
              {formatUsagePurpose(event)}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--theme-text-muted)]">
              Công thức tính chi phí
            </p>
            <div className="overflow-x-auto rounded-lg border border-[var(--theme-border)]">
              <table className="w-full min-w-[500px] whitespace-nowrap text-left text-sm">
                <thead className="bg-[var(--theme-surface-soft)] text-xs uppercase text-[var(--theme-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Hạng mục</th>
                    <th className="px-4 py-3 text-right font-semibold">Số lượng</th>
                    <th className="px-4 py-3 text-right font-semibold">Đơn giá</th>
                    <th className="px-4 py-3 text-right font-semibold">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--theme-border)] bg-[var(--theme-surface)]">
                  {event.category === "OCR_SERVICE" ? (
                    <UsageCostRow
                      amount={event.pages ?? 0}
                      cost={pageCost}
                      label="Số trang"
                      rate={pageRate}
                    />
                  ) : (
                    <>
                      <UsageCostRow
                        amount={uncachedPromptTokens}
                        cost={inputCost}
                        label="Uncached Prompt Tokens"
                        rate={inputRate}
                      />
                      <UsageCostRow
                        amount={cachedTokens}
                        cost={cachedInputCost}
                        label="Cached Tokens"
                        rate={cachedInputRate}
                      />
                      <UsageCostRow
                        amount={cacheWriteTokens}
                        cost={cacheWriteInputCost}
                        label="Cache-write Tokens"
                        rate={cacheWriteInputRate}
                      />
                      <UsageCostRow
                        amount={event.completionTokens ?? 0}
                        cost={outputCost}
                        label="Completion Tokens"
                        rate={outputRate}
                      />
                    </>
                  )}
                  <tr className="bg-[var(--theme-surface-soft)]">
                    <td className="px-4 py-3 font-bold text-[var(--theme-text-strong)]">
                      {event.category === "OCR_SERVICE" ? "Tổng" : "Tổng Token"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--theme-text-strong)]">
                      {new Intl.NumberFormat("vi-VN").format(
                        event.category === "OCR_SERVICE"
                          ? (event.pages ?? 0)
                          : (event.totalTokens ?? 0),
                      )}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-[var(--theme-text-strong)]">
                      <span className="text-base text-[var(--theme-primary)]">
                        ${event.estimatedCostUsd?.toFixed(6) ?? "0.000000"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4 text-sm">
              <CostSummaryRow
                label="Chi phí ước tính (USD):"
                value={`$${event.estimatedCostUsd?.toFixed(6) ?? "0.000000"}`}
              />
              <CostSummaryRow
                label="Tỷ giá (VNĐ/USD):"
                value={`${new Intl.NumberFormat("vi-VN").format(
                  event.fxRateVndPerUsd ?? 25_000,
                )} VNĐ / 1 USD`}
              />
              <div className="flex items-center justify-between border-t border-[var(--theme-border)] pt-3 text-[var(--theme-primary)]">
                <span className="font-bold">Chi phí lượt gọi (VNĐ):</span>
                <span className="text-lg font-extrabold">
                  {formatVnd(event.costVnd ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--theme-text-muted)]">
              Dữ liệu usage và xử lý file
            </p>
            <pre className="max-h-96 overflow-auto rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4 font-mono text-xs">
              {event.rawUsageJson
                ? JSON.stringify(event.rawUsageJson, null, 2)
                : "Không có dữ liệu"}
            </pre>
          </div>
        </div>
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
  );
}

type UsageRate = NonNullable<UsageEvent["priceVersion"]>["rates"][number];

function findRate(event: UsageEvent, metric: UsageRate["metric"]) {
  return event.priceVersion?.rates.find((rate) => rate.metric === metric);
}

function calculateRateCost(amount: number, rate: UsageRate | undefined) {
  if (!rate) return 0;
  return (amount * rate.unitPriceUsd) / rate.unitSize;
}

function UsageCostRow({
  amount,
  cost,
  label,
  rate,
}: {
  amount: number;
  cost: number;
  label: string;
  rate: UsageRate | undefined;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-[var(--theme-text-strong)]">{label}</td>
      <td className="px-4 py-3 text-right font-semibold text-[var(--theme-text-strong)]">
        {new Intl.NumberFormat("vi-VN").format(amount)}
      </td>
      <td className="px-4 py-3 text-right text-[var(--theme-text-muted)]">
        {rate
          ? `$${rate.unitPriceUsd} / ${new Intl.NumberFormat("vi-VN").format(rate.unitSize)}`
          : "-"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-[var(--theme-text-strong)]">
        ${cost.toFixed(6)}
      </td>
    </tr>
  );
}

function CostSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium text-[var(--theme-text-muted)]">{label}</span>
      <span className="font-semibold text-[var(--theme-text-strong)]">{value}</span>
    </div>
  );
}

export function hasGenerationCostSummary(event: UsageEvent): event is UsageEvent & {
  aiGeneration: NonNullable<UsageEvent["aiGeneration"]> & { totalCostVnd: number };
} {
  return (
    event.aiGeneration !== null &&
    event.aiGeneration.totalCostVnd !== null &&
    event.aiGeneration.usageEventCount > 1
  );
}
