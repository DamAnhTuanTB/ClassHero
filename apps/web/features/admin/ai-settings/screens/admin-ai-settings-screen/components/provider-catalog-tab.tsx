"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Cpu,
  ExternalLink,
  History,
  Link2,
  Loader2,
  PencilLine,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextField } from "@/components/common/forms/text-field";
import {
  providerPriceVersionSchema,
  type ProviderPriceVersionFormValues,
} from "@/features/admin/ai-settings/schemas/provider-price-version-schema";
import { sanitizeNumericInput } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
import type {
  AuditItem,
  PriceRate,
  ProviderCatalogItem,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  formatDate,
  formatDateTime,
  formatVnd,
  priceMetricLabels,
  providerStatusLabels,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";

type PriceInput = {
  billingMode: "TOKEN" | "PAGE" | "REQUEST";
  sourceUrl: string;
  effectiveFrom: string;
  rates: Array<Omit<PriceRate, "id">>;
};

export function ProviderCatalogTab({
  catalog,
  audit,
  fxRateVndPerUsd,
  isSaving,
  onCreatePrice,
}: {
  catalog: ProviderCatalogItem[];
  audit?: AuditItem[];
  fxRateVndPerUsd?: number;
  isSaving: boolean;
  onCreatePrice: (catalogItemId: string, input: PriceInput) => Promise<void>;
}) {
  const [editingItem, setEditingItem] = useState<ProviderCatalogItem | null>(null);
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ProviderCatalogItem[]>();

    for (const item of catalog) {
      const items = groups.get(item.provider) ?? [];
      items.push(item);
      groups.set(item.provider, items);
    }

    const providerOrder = new Map([
      ["OPENAI", 0],
      ["GEMINI", 1],
    ]);

    return Array.from(groups, ([provider, items]) => ({ provider, items })).sort(
      (left, right) =>
        (providerOrder.get(left.provider) ?? 99) -
          (providerOrder.get(right.provider) ?? 99) ||
        left.provider.localeCompare(right.provider),
    );
  }, [catalog]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="grid gap-6">
        {providerGroups.map((group) => (
          <section key={group.provider} className="space-y-4">
            <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-[var(--theme-primary-border)] bg-gradient-to-r from-[var(--theme-primary-soft)] to-[var(--theme-surface)] px-4 py-3 shadow-sm">
              <span
                className="absolute inset-y-0 left-0 w-1 bg-[var(--theme-primary)]"
                aria-hidden="true"
              />
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--theme-primary)] text-white shadow-sm">
                  <Cpu className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--theme-primary)]">
                    Nhà cung cấp
                  </p>
                  <h2 className="truncate text-xl font-extrabold text-[var(--theme-text-strong)]">
                    {formatProviderName(group.provider)}
                  </h2>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1 text-xs font-extrabold text-[var(--theme-text)] shadow-sm">
                {group.items.length} dịch vụ
              </span>
            </div>

            <div className="space-y-4">
              {group.items.map((item) => {
                const price = item.priceVersions[0];
                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
                            {item.displayName}
                          </h3>
                          <ProviderStatusBadge status={item.status} />
                          <CredentialBadge configured={item.credentialConfigured} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Cập nhật giá
                      </button>
                    </div>

                    {price ? (
                      <div className="mt-5 overflow-hidden rounded-lg border border-[var(--theme-border)]">
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--theme-text-muted)]">
                          <span>Áp dụng từ {formatDate(price.effectiveFrom)}</span>
                          {price.sourceUrl ? (
                            <a
                              href={price.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 whitespace-nowrap text-[var(--theme-primary)] hover:underline"
                            >
                              Nguồn giá chính thức
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                        <div className="grid gap-px bg-[var(--theme-border)] sm:grid-cols-3">
                          {price.rates.map((rate) => (
                            <div
                              key={rate.id ?? rate.metric}
                              className="bg-[var(--theme-surface)] p-3"
                            >
                              <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                                {priceMetricLabels[rate.metric]}
                              </p>
                              <p className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">
                                ${rate.unitPriceUsd}
                              </p>
                              {fxRateVndPerUsd ? (
                                <p className="mt-0.5 text-sm font-bold text-[var(--theme-success-text)]">
                                  ≈ {formatVnd(rate.unitPriceUsd * fxRateVndPerUsd)}
                                </p>
                              ) : null}
                              <p className="text-xs text-[var(--theme-text-muted)]">
                                mỗi {new Intl.NumberFormat("vi-VN").format(rate.unitSize)}{" "}
                                đơn vị
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm font-semibold text-[var(--theme-text-muted)]">
                        Chưa có bảng giá. Hãy cập nhật giá để theo dõi chi phí chính xác.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      <aside className="h-fit rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 xl:sticky xl:top-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--theme-primary)]" aria-hidden="true" />
          <h3 className="font-extrabold text-[var(--theme-text-strong)]">
            Lịch sử thay đổi
          </h3>
        </div>
        <div className="mt-4 space-y-3">
          {audit?.length ? (
            audit.map((item) => (
              <div
                key={item.id}
                className="border-l-2 border-[var(--theme-primary-border)] pl-3"
              >
                <p className="text-xs font-extrabold text-[var(--theme-text-strong)]">
                  {auditLabel(item.action)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[var(--theme-text-muted)]">
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-[var(--theme-text-muted)]">
              Chưa có thay đổi.
            </p>
          )}
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

function PriceVersionDialog({
  item,
  isSaving,
  onClose,
  onSubmit,
}: {
  item: ProviderCatalogItem;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: PriceInput) => Promise<void>;
}) {
  const isOcr = item.category === "OCR_SERVICE";
  const defaultRates = useMemo<ProviderPriceVersionFormValues["rates"]>(
    () =>
      isOcr
        ? [
            {
              metric: "PAGE",
              unitSize: 1,
              unitPriceUsd: String(item.priceVersions[0]?.rates[0]?.unitPriceUsd ?? 0),
              tierFrom: 0,
              tierTo: null,
            },
          ]
        : [
            {
              metric: "INPUT_TOKEN",
              unitSize: 1_000_000,
              unitPriceUsd: "0",
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: "CACHED_INPUT_TOKEN",
              unitSize: 1_000_000,
              unitPriceUsd: "0",
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: "OUTPUT_TOKEN",
              unitSize: 1_000_000,
              unitPriceUsd: "0",
              tierFrom: null,
              tierTo: null,
            },
          ],
    [isOcr, item.priceVersions],
  );
  const form = useForm<ProviderPriceVersionFormValues>({
    resolver: zodResolver(providerPriceVersionSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      effectiveFrom: new Date().toISOString().slice(0, 10),
      sourceUrl: item.priceVersions[0]?.sourceUrl ?? "",
      rates: defaultRates,
    },
  });
  const rates = form.watch("rates");
  const handleClose = () => {
    if (!isSaving) onClose();
  };

  return (
    <EditorDialogShell
      ariaLabel={`Cập nhật giá ${item.displayName}`}
      isOpen
      onClose={handleClose}
      panelClassName="max-w-2xl"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await onSubmit({
              billingMode: isOcr ? "PAGE" : "TOKEN",
              sourceUrl: values.sourceUrl.trim(),
              effectiveFrom: new Date(
                `${values.effectiveFrom}T00:00:00+07:00`,
              ).toISOString(),
              rates: values.rates.map((rate) => ({
                ...rate,
                unitPriceUsd: Number(rate.unitPriceUsd.replace(",", ".")),
              })),
            });
          } catch {
            // Mutation toast owns the server error; keep the dialog and draft open.
          }
        })}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
            Cập nhật giá · {item.displayName}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="provider-price-effective-from"
              label="Ngày hiệu lực"
              type="date"
              icon={null}
              suppressBrowserSuggestions={false}
              error={form.formState.errors.effectiveFrom}
              {...form.register("effectiveFrom")}
            />
            <TextField
              id="provider-price-source-url"
              label="Đường dẫn nguồn giá"
              placeholder="https://..."
              icon={<Link2 className="h-5 w-5" aria-hidden="true" />}
              error={form.formState.errors.sourceUrl}
              {...form.register("sourceUrl")}
            />
          </div>

          <div className="space-y-3">
            {rates.map((rate, index) => {
              const priceField = form.register(`rates.${index}.unitPriceUsd`);
              return (
                <div
                  key={rate.metric}
                  className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-elevated)] p-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end"
                >
                  <div>
                    <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                      {priceMetricLabels[rate.metric]}
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
                      Áp dụng cho {new Intl.NumberFormat("vi-VN").format(rate.unitSize)}{" "}
                      đơn vị
                    </p>
                  </div>
                  <TextField
                    id={`provider-price-rate-${index}`}
                    label="Giá (USD)"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    icon={null}
                    suppressBrowserSuggestions={false}
                    error={form.formState.errors.rates?.[index]?.unitPriceUsd}
                    {...priceField}
                    onChange={(event) => {
                      event.currentTarget.value = sanitizeNumericInput(
                        event.currentTarget.value,
                        true,
                      );
                      priceField.onChange(event);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold transition disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PencilLine className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : "Lưu bảng giá"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function ProviderStatusBadge({ status }: { status: ProviderCatalogItem["status"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
        status === "ACTIVE"
          ? "bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
          : "bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
      }`}
    >
      {providerStatusLabels[status]}
    </span>
  );
}

function CredentialBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
        configured
          ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
          : "bg-[var(--theme-danger-bg)] text-[var(--theme-danger-text)]"
      }`}
    >
      {configured ? "Sẵn sàng" : "Chưa kết nối"}
    </span>
  );
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    AI_FEATURE_MODEL_CONFIGURATION_UPDATED: "Đã đổi mô hình AI",
    PROVIDER_BUDGET_UPDATED: "Đã đổi ngân sách",
    PROVIDER_ACCOUNTING_SETTINGS_UPDATED: "Đã đổi quy đổi chi phí",
    PROVIDER_PRICE_VERSION_CREATED: "Đã cập nhật bảng giá",
  };
  return labels[action] ?? "Đã cập nhật cài đặt";
}

function formatProviderName(provider: string) {
  const labels: Record<string, string> = {
    OPENAI: "OpenAI",
    GEMINI: "Gemini",
    MATHPIX: "Mathpix",
  };

  return labels[provider] ?? provider;
}
