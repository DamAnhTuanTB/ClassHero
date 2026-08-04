"use client";

import {
  CheckCircle2,
  DatabaseZap,
  KeyRound,
  Loader2,
  Save,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AccountingSettings,
  OcrSettings,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import { NumericSettingsField } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
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
          label="Dịch vụ đọc tài liệu"
          value={data.credentialConfigured ? "Sẵn sàng" : "Chưa cấu hình"}
          ok={data.credentialConfigured}
        />
        <StatusCard
          icon={DatabaseZap}
          label="Dùng lại kết quả đã có"
          value={data.cacheEnabled ? "Đang bật" : "Đang tắt"}
          ok={data.cacheEnabled}
        />
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <p className="text-sm font-bold text-[var(--theme-text-muted)]">
            Giá đọc tài liệu hiện tại
          </p>
          <p className="mt-2 text-xl font-extrabold text-[var(--theme-text-strong)]">
            {pageRate ? `$${pageRate.unitPriceUsd}/trang` : "Chưa nhập giá"}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--theme-text-muted)]">
            Kết quả đã có không phát sinh thêm chi phí
          </p>
        </div>
      </div>

      {!data.paidEnabled ? (
        <div className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-4 text-sm text-[var(--theme-warning-text)]">
          <p className="font-extrabold">Tính năng đọc tài liệu mới đang tạm tắt</p>
          <p className="mt-1 leading-6">
            Hệ thống vẫn dùng được kết quả đã có nhưng chưa thể xử lý tài liệu mới.
          </p>
        </div>
      ) : null}

      <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Thiết lập chi phí
            </h3>
          </div>
          <span className="text-sm font-bold text-[var(--theme-text-muted)]">
            Ngân sách đọc tài liệu {formatVnd(data.monthlyBudgetVnd)}/tháng
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NumericSettingsField
            id="ocr-fx-rate"
            label="Tỷ giá VNĐ cho 1 USD"
            value={accounting.fxRateVndPerUsd}
            min={1}
            formatThousands
            suffix="VNĐ"
            onChange={(value) =>
              setAccounting((current) => ({ ...current, fxRateVndPerUsd: value }))
            }
          />
          <NumericSettingsField
            id="ocr-price-freshness-days"
            label="Nhắc cập nhật giá sau (ngày)"
            value={accounting.priceFreshnessDays}
            min={1}
            max={365}
            onChange={(value) =>
              setAccounting((current) => ({ ...current, priceFreshnessDays: value }))
            }
          />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSave(accounting)}
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Đang lưu" : "Lưu thiết lập"}
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
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-[var(--theme-primary)]" aria-hidden="true" />
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--theme-success-text)]" />
        ) : (
          <XCircle className="h-4 w-4 text-[var(--theme-danger-text)]" />
        )}
      </div>
      <p className="mt-3 text-sm font-bold text-[var(--theme-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}
