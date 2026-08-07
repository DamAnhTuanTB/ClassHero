"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BrainCircuit,
  Cpu,
  ExternalLink,
  History,
  Link2,
  Loader2,
  PencilLine,
  Plus,
  Thermometer,
  Trash2,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextField } from "@/components/common/forms/text-field";

import {
  providerPriceVersionSchema,
  createProviderCatalogItemSchema,
  providerCatalogItemSchema,
  type ProviderPriceVersionFormValues,
  type CreateProviderCatalogItemFormValues,
  type ProviderCatalogItemFormValues,
} from "@/features/admin/ai-settings/schemas/provider-price-version-schema";
import { sanitizeNumericInput } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
import type {
  AiFeatureConfiguration,
  AuditItem,
  PriceRate,
  ProviderCatalogItem,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  aiFeatureLabels,
  formatDate,
  formatDateTime,
  formatVnd,
  priceMetricLabels,
  providerStatusLabels,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { createProviderCatalogItem, updateProviderCatalogItem } from "@/features/admin/ai-settings/api/provider-operations-api";

type PriceInput = {
  billingMode: "TOKEN" | "PAGE" | "REQUEST";
  sourceUrl: string;
  effectiveFrom: string;
  rates: Array<Omit<PriceRate, "id">>;
};

export function ProviderCatalogTab({
  catalog,
  audit,
  configurations,
  fxRateVndPerUsd,
  isSaving,
  isMutatingModel,
  onCreatePrice,
  onCreateModel,
  onUpdateModel,
  onDeleteModel,
}: {
  catalog: ProviderCatalogItem[];
  audit?: AuditItem[];
  configurations?: AiFeatureConfiguration[];
  fxRateVndPerUsd?: number;
  isSaving: boolean;
  isMutatingModel?: boolean;
  onCreatePrice: (catalogItemId: string, input: PriceInput) => Promise<void>;
  onCreateModel?: (input: Parameters<typeof createProviderCatalogItem>[0]) => Promise<void>;
  onUpdateModel?: (id: string, input: Parameters<typeof updateProviderCatalogItem>[1]) => Promise<void>;
  onDeleteModel?: (id: string) => Promise<void>;
}) {
  const [editingPriceItem, setEditingPriceItem] = useState<ProviderCatalogItem | null>(null);
  const [editingModelItem, setEditingModelItem] = useState<{ item?: ProviderCatalogItem, provider?: string } | null>(null);

  const aiFeatureBadgeStyles: Record<string, string> = {
    SUMMARY: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    QUIZ: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    FLASHCARD: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
    TEST: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
  };

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
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1 text-xs font-extrabold text-[var(--theme-text)] shadow-sm">
                  {group.items.length} dịch vụ
                </span>
                <button
                  type="button"
                  onClick={() => setEditingModelItem({ provider: group.provider })}
                  className="theme-button-primary inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold transition"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  Thêm Model
                </button>
              </div>
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
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
                              {item.displayName}
                            </h3>
                            <span className="text-xs font-semibold text-[var(--theme-text-muted)] bg-[var(--theme-bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--theme-border)]">
                              {item.externalKey}
                            </span>
                          </div>
                          
                          <div className="mt-3 flex flex-col gap-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wide min-w-24">
                                {item.status === "ACTIVE" ? "Đang dùng:" : "Trạng thái:"}
                              </span>
                              {item.status === "ACTIVE" ? (() => {
                                if (!configurations) return <span className="text-sm font-medium text-[var(--theme-text-strong)]">Đang tải...</span>;
                                const usedBy = configurations.filter(
                                  (c) => c.primaryCatalogItemId === item.id || c.fallbackCatalogItemId === item.id
                                );
                                if (usedBy.length === 0) return (
                                  <span className="inline-flex items-center rounded-md bg-[var(--theme-bg-subtle)] px-2 py-0.5 text-[13px] font-medium text-[var(--theme-text-muted)] ring-1 ring-inset ring-[var(--theme-border)]">
                                    Chưa phân bổ
                                  </span>
                                );
                                return usedBy.map((c, i) => {
                                  const style = aiFeatureBadgeStyles[c.feature] || "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] ring-[var(--theme-primary-border)]";
                                  return (
                                    <span key={i} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset ${style}`}>
                                      {aiFeatureLabels[c.feature] ?? c.feature}
                                    </span>
                                  );
                                });
                              })() : (
                                <span className="inline-flex items-center rounded-md bg-[var(--theme-warning-bg)] px-2 py-0.5 text-[13px] font-semibold text-[var(--theme-warning-text)] ring-1 ring-inset ring-[var(--theme-warning-text)]/20">
                                  {providerStatusLabels[item.status]}
                                </span>
                              )}
                            </div>

                            {(item.capabilities && (String((item.capabilities as any).aiConfiguration) === "REASONING_EFFORT" || String((item.capabilities as any).aiConfiguration) === "TEMPERATURE")) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wide min-w-24">
                                  Hỗ trợ thêm:
                                </span>
                                {String((item.capabilities as any).aiConfiguration) === "REASONING_EFFORT" && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--theme-info-bg)] px-2 py-0.5 text-[13px] font-semibold text-[var(--theme-info-text)] ring-1 ring-inset ring-[var(--theme-info-text)]/20">
                                      <BrainCircuit className="h-3.5 w-3.5" />
                                      Reasoning Effort
                                    </span>
                                    {Array.isArray((item.capabilities as any).reasoningEffortLevels) && ((item.capabilities as any).reasoningEffortLevels as string[]).length > 0 && (
                                      <span className="text-xs text-[var(--theme-text-muted)] font-medium">
                                        ({((item.capabilities as any).reasoningEffortLevels as string[]).join(", ")})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {String((item.capabilities as any).aiConfiguration) === "TEMPERATURE" && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--theme-warning-bg)] px-2 py-0.5 text-[13px] font-semibold text-[var(--theme-warning-text)] ring-1 ring-inset ring-[var(--theme-warning-text)]/20">
                                    <Thermometer className="h-3.5 w-3.5" />
                                    Temperature
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn xoá ${item.displayName}?`)) {
                              onDeleteModel?.(item.id);
                            }
                          }}
                          disabled={isMutatingModel}
                          className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition text-[var(--theme-danger)] hover:border-[var(--theme-danger-border)] hover:bg-[var(--theme-danger-subtle)] hover:text-[var(--theme-danger-text-strong)]"
                          title="Xoá model"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingModelItem({ item })}
                          className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition text-[var(--theme-primary)] hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-subtle)] hover:text-[var(--theme-primary-strong)]"
                          title="Sửa model"
                        >
                          <PencilLine className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPriceItem(item)}
                          className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition"
                        >
                          <Tag className="h-4 w-4" aria-hidden="true" />
                          Cập nhật giá
                        </button>
                      </div>
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
                          {(item.category === "OCR_SERVICE" ? ["PAGE"] : ["INPUT_TOKEN", "CACHED_INPUT_TOKEN", "OUTPUT_TOKEN"]).map((metricStr) => {
                            const metric = metricStr as PriceRate["metric"];
                            const rate = price.rates.find((r) => r.metric === metric) ?? {
                              id: metric,
                              metric,
                              unitPriceUsd: 0,
                              unitSize: item.category === "OCR_SERVICE" ? 1 : 1_000_000,
                            };
                            return (
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
                            );
                          })}
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

      {editingPriceItem ? (
        <PriceVersionDialog
          item={editingPriceItem}
          isSaving={isSaving}
          onClose={() => setEditingPriceItem(null)}
          onSubmit={async (input) => {
            await onCreatePrice(editingPriceItem.id, input);
            setEditingPriceItem(null);
          }}
        />
      ) : null}

      {editingModelItem ? (
        <CatalogItemDialog
          item={editingModelItem.item}
          provider={editingModelItem.provider}
          isSaving={isMutatingModel ?? false}
          onClose={() => setEditingModelItem(null)}
          onSubmit={async (input) => {
            if (editingModelItem.item) {
              await onUpdateModel?.(editingModelItem.item.id, input);
            } else {
              await onCreateModel?.(input as Parameters<typeof createProviderCatalogItem>[0]);
            }
            setEditingModelItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CatalogItemDialog({
  item,
  provider,
  isSaving,
  onClose,
  onSubmit,
}: {
  item?: ProviderCatalogItem;
  provider?: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: any) => Promise<void>;
}) {
  const isEditing = !!item;
  const isOcr = false; // Always AI_MODEL for now, according to UI
  
  const defaultRates = useMemo<ProviderPriceVersionFormValues["rates"]>(
    () =>
      isOcr
        ? [
            {
              metric: "PAGE",
              unitSize: 1,
              unitPriceUsd: "0",
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
    [isOcr],
  );

  const initialAiConfig = item?.capabilities
    ? (item.capabilities as any).aiConfiguration
    : "NONE";

  const initialReasoningEffortLevels = item?.capabilities
    ? ((item.capabilities as any).reasoningEffortLevels as string[] | undefined)
    : undefined;

  const form = useForm<CreateProviderCatalogItemFormValues>({
    resolver: zodResolver(
      isEditing ? providerCatalogItemSchema : createProviderCatalogItemSchema
    ),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      displayName: item?.displayName ?? "",
      externalKey: item?.externalKey ?? "",
      aiConfiguration: initialAiConfig ?? "NONE",
      reasoningEffortLevels: initialReasoningEffortLevels,
      ...(!isEditing && {
        effectiveFrom: new Date().toISOString().slice(0, 10),
        sourceUrl: "",
        rates: defaultRates,
      })
    },
  });
  
  const rates = form.watch("rates");
  const aiConfiguration = form.watch("aiConfiguration");
  const reasoningEffortLevels = form.watch("reasoningEffortLevels") || [];
  
  const handleClose = () => {
    if (!isSaving) onClose();
  };

  return (
    <EditorDialogShell
      ariaLabel={isEditing ? "Cập nhật model" : "Thêm model mới"}
      isOpen
      onClose={handleClose}
      panelClassName="max-w-2xl"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            if (isEditing) {
              await onSubmit({
                displayName: values.displayName,
                externalKey: values.externalKey,
                aiConfiguration: values.aiConfiguration === "NONE" ? null : values.aiConfiguration,
                reasoningEffortLevels: values.aiConfiguration === "REASONING_EFFORT" ? values.reasoningEffortLevels : null,
              });
            } else {
              await onSubmit({
                category: "AI_MODEL",
                provider: provider!,
                displayName: values.displayName,
                externalKey: values.externalKey,
                aiConfiguration: values.aiConfiguration === "NONE" ? undefined : values.aiConfiguration,
                reasoningEffortLevels: values.aiConfiguration === "REASONING_EFFORT" ? values.reasoningEffortLevels : undefined,
                initialPrice: values.rates ? {
                  billingMode: "TOKEN",
                  sourceUrl: values.sourceUrl?.trim() ?? "",
                  effectiveFrom: new Date(
                    `${values.effectiveFrom}T00:00:00+07:00`,
                  ).toISOString(),
                  rates: values.rates.map((rate) => ({
                    ...rate,
                    unitPriceUsd: Number(rate.unitPriceUsd.replace(",", ".")),
                  })),
                } : undefined,
              });
            }
          } catch {
            // Mutation toast owns the server error
          }
        })}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
            {isEditing ? `Cập nhật model · ${item.displayName}` : `Thêm model mới · ${formatProviderName(provider ?? "")}`}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
          <div className="space-y-4">
            <h3 className="font-bold text-[var(--theme-text-strong)] border-b border-[var(--theme-border)] pb-2">Thông tin Model</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="model-display-name"
                label="Tên hiển thị"
                placeholder="Ví dụ: GPT-4o Mini"
                icon={null}
                error={form.formState.errors.displayName}
                {...form.register("displayName")}
              />
              <TextField
                id="model-external-key"
                label="Tên Model (External Key)"
                placeholder="Ví dụ: gpt-4o-mini"
                icon={null}
                error={form.formState.errors.externalKey}
                {...form.register("externalKey")}
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Tuỳ chọn Tham số AI
              </label>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    value="NONE"
                    {...form.register("aiConfiguration")}
                    className="h-4 w-4 text-[var(--theme-primary)] border-[var(--theme-border)]"
                  />
                  Mặc định
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    value="TEMPERATURE"
                    {...form.register("aiConfiguration")}
                    className="h-4 w-4 text-[var(--theme-primary)] border-[var(--theme-border)]"
                  />
                  Hỗ trợ Temperature
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    value="REASONING_EFFORT"
                    {...form.register("aiConfiguration")}
                    className="h-4 w-4 text-[var(--theme-primary)] border-[var(--theme-border)]"
                  />
                  Hỗ trợ Reasoning Effort
                </label>
              </div>
              
              {aiConfiguration === "REASONING_EFFORT" && (
                <div className="mt-4 rounded-lg bg-[var(--theme-surface)] p-3 border border-[var(--theme-border)] space-y-2">
                  <label className="text-sm font-semibold text-[var(--theme-text-strong)] block mb-1">
                    Các mức Reasoning Effort hỗ trợ
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {["none", "low", "medium", "high", "xhigh", "max"].map((level) => (
                      <label key={level} className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          value={level}
                          checked={reasoningEffortLevels.includes(level)}
                          onChange={(e) => {
                            const newLevels = e.target.checked
                              ? [...reasoningEffortLevels, level]
                              : reasoningEffortLevels.filter((l) => l !== level);
                            form.setValue("reasoningEffortLevels", newLevels, { shouldDirty: true });
                          }}
                          className="h-4 w-4 text-[var(--theme-primary)] rounded border-[var(--theme-border)] focus:ring-[var(--theme-primary)]"
                        />
                        <span className="capitalize">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-4 pt-4">
              <h3 className="font-bold text-[var(--theme-text-strong)] border-b border-[var(--theme-border)] pb-2">Thiết lập Bảng giá đầu tiên</h3>
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
                {rates?.map((rate, index) => {
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
          )}
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
            {isSaving ? "Đang lưu" : "Lưu thay đổi"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
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
              unitPriceUsd: String(item.priceVersions[0]?.rates.find(r => r.metric === "INPUT_TOKEN")?.unitPriceUsd ?? 0),
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: "CACHED_INPUT_TOKEN",
              unitSize: 1_000_000,
              unitPriceUsd: String(item.priceVersions[0]?.rates.find(r => r.metric === "CACHED_INPUT_TOKEN")?.unitPriceUsd ?? 0),
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: "OUTPUT_TOKEN",
              unitSize: 1_000_000,
              unitPriceUsd: String(item.priceVersions[0]?.rates.find(r => r.metric === "OUTPUT_TOKEN")?.unitPriceUsd ?? 0),
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

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    AI_FEATURE_MODEL_CONFIGURATION_UPDATED: "Đã đổi mô hình AI",
    PROVIDER_BUDGET_UPDATED: "Đã đổi ngân sách",
    PROVIDER_ACCOUNTING_SETTINGS_UPDATED: "Đã đổi quy đổi chi phí",
    PROVIDER_PRICE_VERSION_CREATED: "Đã cập nhật bảng giá",
    PROVIDER_CATALOG_ITEM_CREATED: "Đã thêm mô hình",
    PROVIDER_CATALOG_ITEM_UPDATED: "Đã cập nhật mô hình",
    PROVIDER_CATALOG_ITEM_DELETED: "Đã xoá mô hình",
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
