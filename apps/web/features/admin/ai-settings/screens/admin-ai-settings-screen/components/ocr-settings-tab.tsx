"use client";

import { CheckCircle2, DatabaseZap, KeyRound, Loader2, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { AccountingSettings, OcrSettings } from "@/features/admin/ai-settings/types/provider-operations-types";
import { formatVnd } from "@/features/admin/ai-settings/utils/provider-operations-formatters";

export function OcrSettingsTab({
  data,
  isSaving,
  onSave,
}: {
  data: OcrSettings;
  isSaving: boolean;
  onSave: (settings: AccountingSettings) => void;
}) {
  const [accounting, setAccounting] = useState(data.accounting);
  useEffect(() => setAccounting(data.accounting), [data.accounting]);

  const pageRate = data.services[0]?.latestPrice?.rates.find(
    (rate) => rate.metric === "PAGE",
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          icon={KeyRound}
          label="Mathpix credential"
          value={data.credentialConfigured ? "Sẵn sàng" : "Chưa cấu hình"}
          ok={data.credentialConfigured}
        />
        <StatusCard
          icon={DatabaseZap}
          label="Artifact cache"
          value={data.cacheEnabled ? "Đang bật" : "Đang tắt"}
          ok={data.cacheEnabled}
        />
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <p className="text-sm font-bold text-[var(--theme-text-muted)]">Giá OCR hiện tại</p>
          <p className="mt-2 text-xl font-extrabold text-[var(--theme-text-strong)]">
            {pageRate ? `$${pageRate.unitPriceUsd}/trang` : "Chưa nhập giá"}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--theme-text-muted)]">
            Cache hit = 0đ và vẫn ghi nhận chi phí tiết kiệm
          </p>
        </div>
      </div>

      {!data.paidEnabled ? (
        <div className="rounded-xl border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-4 text-sm text-[var(--theme-warning-text)]">
          <p className="font-extrabold">OCR trả phí đang tắt ở môi trường chạy</p>
          <p className="mt-1 leading-6">
            Cache vẫn được dùng. Cache miss sẽ dừng an toàn cho đến khi bật
            <code className="mx-1 rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">
              OCR_PAID_ENABLED
            </code>
            và có credential.
          </p>
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Quy đổi và độ mới bảng giá
            </h3>
            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              Múi giờ {accounting.timezone}; tuần bắt đầu từ thứ Hai.
            </p>
          </div>
          <span className="text-sm font-bold text-[var(--theme-text-muted)]">
            Ngân sách OCR {formatVnd(data.monthlyBudgetVnd)}/tháng
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">
            Tỷ giá VND cho 1 USD
            <input
              type="number"
              min="1"
              value={accounting.fxRateVndPerUsd}
              onChange={(event) =>
                setAccounting((current) => ({
                  ...current,
                  fxRateVndPerUsd: Number(event.target.value),
                }))
              }
              className="min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">
            Cảnh báo giá cũ sau (ngày)
            <input
              type="number"
              min="1"
              value={accounting.priceFreshnessDays}
              onChange={(event) =>
                setAccounting((current) => ({
                  ...current,
                  priceFreshnessDays: Number(event.target.value),
                }))
              }
              className="min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSave(accounting)}
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-5 font-extrabold disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Đang lưu" : "Lưu thiết lập OCR"}
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof KeyRound;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-[var(--theme-primary)]" aria-hidden="true" />
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--theme-success-text)]" />
        ) : (
          <XCircle className="h-4 w-4 text-[var(--theme-danger-text)]" />
        )}
      </div>
      <p className="mt-3 text-sm font-bold text-[var(--theme-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">{value}</p>
    </div>
  );
}
