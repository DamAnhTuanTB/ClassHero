"use client";

import { ExternalLink, History, Loader2, PencilLine, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  AuditItem,
  PriceRate,
  ProviderCatalogItem,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import { formatDateTime } from "@/features/admin/ai-settings/utils/provider-operations-formatters";

type PriceInput = {
  billingMode: "TOKEN" | "PAGE" | "REQUEST";
  sourceUrl: string;
  effectiveFrom: string;
  rates: Array<Omit<PriceRate, "id">>;
};

export function ProviderCatalogTab({
  catalog,
  audit,
  isSaving,
  onCreatePrice,
}: {
  catalog: ProviderCatalogItem[];
  audit?: AuditItem[];
  isSaving: boolean;
  onCreatePrice: (catalogItemId: string, input: PriceInput) => Promise<void>;
}) {
  const [editingItem, setEditingItem] = useState<ProviderCatalogItem | null>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <section className="space-y-4">
        {catalog.map((item) => {
          const price = item.priceVersions[0];
          return (
            <article key={item.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">{item.displayName}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${item.status === "ACTIVE" ? "bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]" : "bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"}`}>{item.status}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${item.credentialConfigured ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" : "bg-[var(--theme-danger-bg)] text-[var(--theme-danger-text)]"}`}>{item.credentialConfigured ? "Credential OK" : "Thiếu credential"}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--theme-text-muted)]">{item.provider} · {item.externalKey}</p>
                </div>
                <button type="button" onClick={() => setEditingItem(item)} className="theme-button-neutral inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold">
                  <Plus className="h-4 w-4" /> Thêm phiên bản giá
                </button>
              </div>

              {price ? (
                <div className="mt-5 overflow-hidden rounded-lg border border-[var(--theme-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--theme-text-muted)]">
                    <span>Hiệu lực từ {new Date(price.effectiveFrom).toLocaleDateString("vi-VN")}</span>
                    {price.sourceUrl ? <a href={price.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--theme-primary)] hover:underline">Nguồn giá chính thức <ExternalLink className="h-3 w-3" /></a> : null}
                  </div>
                  <div className="grid gap-px bg-[var(--theme-border)] sm:grid-cols-3">
                    {price.rates.map((rate) => (
                      <div key={rate.id ?? rate.metric} className="bg-[var(--theme-surface)] p-3">
                        <p className="text-xs font-bold text-[var(--theme-text-muted)]">{rate.metric.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">${rate.unitPriceUsd}</p>
                        <p className="text-xs text-[var(--theme-text-muted)]">mỗi {new Intl.NumberFormat("vi-VN").format(rate.unitSize)} đơn vị</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="mt-5 rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm font-semibold text-[var(--theme-text-muted)]">Chưa có bảng giá. Chi phí usage sẽ được đánh dấu thiếu price snapshot.</div>}
            </article>
          );
        })}
      </section>

      <aside className="h-fit rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 xl:sticky xl:top-5">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--theme-primary)]" /><h3 className="font-extrabold text-[var(--theme-text-strong)]">Lịch sử thay đổi</h3></div>
        <div className="mt-4 space-y-3">
          {audit?.length ? audit.map((item) => (
            <div key={item.id} className="border-l-2 border-[var(--theme-primary-border)] pl-3">
              <p className="text-xs font-extrabold text-[var(--theme-text-strong)]">{auditLabel(item.action)}</p>
              <p className="mt-1 text-[11px] font-semibold text-[var(--theme-text-muted)]">{formatDateTime(item.createdAt)}</p>
            </div>
          )) : <p className="py-6 text-center text-sm text-[var(--theme-text-muted)]">Chưa có thay đổi.</p>}
        </div>
      </aside>

      {editingItem ? (
        <PriceVersionDialog
          item={editingItem}
          isSaving={isSaving}
          onClose={() => setEditingItem(null)}
          onSubmit={async (input) => {
            await onCreatePrice(editingItem.id, input);
            setEditingItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PriceVersionDialog({ item, isSaving, onClose, onSubmit }: { item: ProviderCatalogItem; isSaving: boolean; onClose: () => void; onSubmit: (input: PriceInput) => Promise<void> }) {
  const isOcr = item.category === "OCR_SERVICE";
  const defaultRates = useMemo<Array<Omit<PriceRate, "id">>>(() => isOcr ? [{ metric: "PAGE", unitSize: 1, unitPriceUsd: item.priceVersions[0]?.rates[0]?.unitPriceUsd ?? 0, tierFrom: 0, tierTo: null }] : [
    { metric: "INPUT_TOKEN", unitSize: 1_000_000, unitPriceUsd: 0, tierFrom: null, tierTo: null },
    { metric: "CACHED_INPUT_TOKEN", unitSize: 1_000_000, unitPriceUsd: 0, tierFrom: null, tierTo: null },
    { metric: "OUTPUT_TOKEN", unitSize: 1_000_000, unitPriceUsd: 0, tierFrom: null, tierTo: null },
  ], [isOcr, item.priceVersions]);
  const [sourceUrl, setSourceUrl] = useState(item.priceVersions[0]?.sourceUrl ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [rates, setRates] = useState(defaultRates);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="price-dialog-title">
      <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ billingMode: isOcr ? "PAGE" : "TOKEN", sourceUrl, effectiveFrom: new Date(`${effectiveFrom}T00:00:00+07:00`).toISOString(), rates }).catch(() => undefined); }} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">Bảng giá mới</p><h2 id="price-dialog-title" className="mt-1 text-xl font-extrabold text-[var(--theme-text-strong)]">{item.displayName}</h2></div><button type="button" onClick={onClose} className="theme-button-neutral grid h-10 w-10 place-items-center rounded-lg" aria-label="Đóng"><X className="h-4 w-4" /></button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">Ngày hiệu lực<input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3" /></label>
          <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">Link nguồn chính thức<input required type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." className="min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3" /></label>
        </div>
        <div className="mt-5 space-y-3">
          {rates.map((rate, index) => (
            <div key={rate.metric} className="grid gap-3 rounded-lg border border-[var(--theme-border)] p-3 sm:grid-cols-[1fr_10rem] sm:items-end"><div><p className="text-sm font-extrabold text-[var(--theme-text-strong)]">{rate.metric.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--theme-text-muted)]">Đơn vị: {new Intl.NumberFormat("vi-VN").format(rate.unitSize)}</p></div><label className="grid gap-1 text-xs font-bold text-[var(--theme-text-muted)]">USD / đơn vị<input required type="number" min="0" step="0.0000000001" value={rate.unitPriceUsd} onChange={(event) => setRates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPriceUsd: Number(event.target.value) } : item))} className="min-h-10 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 text-[var(--theme-text)]" /></label></div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="theme-button-neutral min-h-11 rounded-lg px-4 font-extrabold">Hủy</button><button type="submit" disabled={isSaving} className="theme-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-5 font-extrabold disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}Lưu phiên bản giá</button></div>
      </form>
    </div>
  );
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    AI_FEATURE_MODEL_CONFIGURATION_UPDATED: "Đã đổi cấu hình model",
    PROVIDER_BUDGET_UPDATED: "Đã đổi ngân sách",
    PROVIDER_ACCOUNTING_SETTINGS_UPDATED: "Đã đổi quy đổi chi phí",
    PROVIDER_PRICE_VERSION_CREATED: "Đã thêm phiên bản giá",
  };
  return labels[action] ?? action;
}
