"use client";

import { CloudDownload, Loader2, Trash2, Copy, Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextField } from "@/components/common/forms/text-field";
import { SelectContent } from "@/components/common/ui/select/content";
import { SelectItem } from "@/components/common/ui/select/item";
import { Select } from "@/components/common/ui/select/root";
import { SelectTrigger } from "@/components/common/ui/select/trigger";
import { SelectValue } from "@/components/common/ui/select/value";
import { FieldLabel } from "@/components/common/forms/field-label";
import { sanitizeNumericInput } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
import type { createProviderCatalogItem } from "@/features/admin/ai-settings/api/provider-operations-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type FetchedModel = {
  provider: string;
  externalKey: string;
  displayName: string;
  createdAt: string | null;
};

type FetchModelsDialogProps = {
  provider: string;
  isSaving: boolean;
  onClose: () => void;
  onFetchModels: (provider: string) => Promise<FetchedModel[]>;
  onSubmit: (items: Parameters<typeof createProviderCatalogItem>[0][]) => Promise<void>;
};

type FormValues = {
  models: Array<{
    selected: boolean;
    provider: string;
    externalKey: string;
    displayName: string;
    createdAt: string | null;
    inputPrice: string;
    cachedInputPrice: string;
    outputPrice: string;
    aiConfiguration: "TEMPERATURE" | "REASONING_EFFORT" | "";
    reasoningEffortLevels: string[];
  }>;
};

export function FetchModelsDialog({
  provider,
  isSaving,
  onClose,
  onFetchModels,
  onSubmit,
}: FetchModelsDialogProps) {
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery);

  const form = useForm<FormValues>({
    defaultValues: {
      models: [],
    },
  });

  const { fields, remove } = useFieldArray({
    control: form.control,
    name: "models",
  });

  const hasSelectedModels = form.watch("models")?.some(m => m.selected) ?? false;

  useEffect(() => {
    async function loadModels() {
      try {
        setIsFetching(true);
        setFetchError(null);
        const models = await onFetchModels(provider);
        form.reset({
          models: models.map((m) => {
            const externalKeyLow = m.externalKey.toLowerCase();
            let aiConfiguration: "TEMPERATURE" | "REASONING_EFFORT" | "" = "TEMPERATURE";
            if (/^(o[1-9]|gpt-5)/.test(externalKeyLow) || externalKeyLow.includes("thinking") || externalKeyLow.includes("gemini-3")) {
              aiConfiguration = "REASONING_EFFORT";
            }
            return {
              selected: false,
              provider: m.provider,
              externalKey: m.externalKey,
              displayName: m.displayName,
              createdAt: m.createdAt,
              inputPrice: "",
              cachedInputPrice: "",
              outputPrice: "",
              aiConfiguration,
              reasoningEffortLevels: [],
            };
          }),
        });
      } catch (error) {
        setFetchError(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
      } finally {
        setIsFetching(false);
      }
    }
    loadModels();
  }, [provider, onFetchModels, form]);

  const handleClose = () => {
    if (!isSaving) onClose();
  };

  const handleSubmitAction = async (values: FormValues, onlySelected: boolean) => {
    let hasError = false;
    const targetModels = onlySelected ? values.models.filter(m => m.selected) : values.models;
    if (targetModels.length === 0) return;

    values.models.forEach((m, index) => {
      const isTarget = onlySelected ? m.selected : true;
      if (isTarget && !m.aiConfiguration) {
        form.setError(`models.${index}.aiConfiguration`, { type: "manual", message: "Vui lòng chọn Cấu hình AI" });
        hasError = true;
      } else {
        form.clearErrors(`models.${index}.aiConfiguration`);
      }
    });

    if (hasError) return;

    const itemsToSync = targetModels.map((m) => {
      let initialPrice;
      if (m.inputPrice || m.cachedInputPrice || m.outputPrice) {
        initialPrice = {
          billingMode: "TOKEN" as const,
          sourceUrl: "",
          rates: [
            {
              metric: "INPUT_TOKEN" as const,
              unitSize: 1_000_000,
              unitPriceUsd: Number(m.inputPrice.replace(",", ".") || 0),
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: "CACHED_INPUT_TOKEN" as const,
              unitSize: 1_000_000,
              unitPriceUsd: Number(m.cachedInputPrice.replace(",", ".") || 0),
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: "OUTPUT_TOKEN" as const,
              unitSize: 1_000_000,
              unitPriceUsd: Number(m.outputPrice.replace(",", ".") || 0),
              tierFrom: null,
              tierTo: null,
            },
          ],
        };
      }

      return {
        category: "AI_MODEL" as const,
        provider: m.provider,
        externalKey: m.externalKey,
        displayName: m.displayName,
        createdAt: m.createdAt || undefined,
        aiConfiguration: m.aiConfiguration as "TEMPERATURE" | "REASONING_EFFORT",
        reasoningEffortLevels: m.aiConfiguration === "REASONING_EFFORT" ? m.reasoningEffortLevels : undefined,
        initialPrice,
      };
    });

    await onSubmit(itemsToSync);
  };

  return (
    <EditorDialogShell
      ariaLabel={`Lấy lại các model - ${provider}`}
      isOpen
      onClose={handleClose}
      panelClassName="max-w-4xl"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => { e.preventDefault(); }}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)] flex items-center gap-2">
            <CloudDownload className="h-5 w-5" />
            Lấy lại các model · {provider === "OPENAI" ? "OpenAI" : "Gemini"}
          </h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {isFetching ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-text-muted)]">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              <p className="mt-4 text-sm font-semibold">Đang lấy danh sách model...</p>
            </div>
          ) : fetchError ? (
            <div className="rounded-lg bg-[var(--theme-danger-subtle)] p-4 text-sm text-[var(--theme-danger-text-strong)] border border-[var(--theme-danger-border)]">
              <p className="font-bold">Lỗi lấy dữ liệu</p>
              <p className="mt-1">{fetchError}</p>
            </div>
          ) : fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--theme-border)] p-8 text-center text-sm font-semibold text-[var(--theme-text-muted)]">
              Không tìm thấy model nào từ nhà cung cấp.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--theme-text-muted)]">
                  Đã tìm thấy <strong className="text-[var(--theme-text-strong)]">{fields.length}</strong> model
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const modelNames = form.getValues().models.map(m => m.externalKey).join('\n');
                    navigator.clipboard.writeText(modelNames);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-bg-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--theme-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Đã copy" : "Copy tên"}
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--theme-text-muted)]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm model theo tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-shadow"
                />
              </div>
              
              <div className="grid gap-4">
                {fields.map((field, index) => {
                  const matchSearch = !debouncedSearchQuery || 
                    field.externalKey.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
                    field.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
                    
                  if (!matchSearch) return null;

                  const inputPriceField = form.register(`models.${index}.inputPrice`);
                  const cachedInputPriceField = form.register(`models.${index}.cachedInputPrice`);
                  const outputPriceField = form.register(`models.${index}.outputPrice`);
                  
                  return (
                    <div
                      key={field.id}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 shadow-sm flex items-start gap-4"
                    >
                      <input
                        type="checkbox"
                        {...form.register(`models.${index}.selected`)}
                        className="mt-1 h-5 w-5 rounded border-[var(--theme-border)] text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                      />
                      <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between w-full">
                        <div className="flex-1 space-y-3">
                          {field.createdAt && (
                            <div className="text-xs font-semibold text-[var(--theme-text-muted)]">
                              Phát hành: {new Date(field.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                          <div className="grid sm:grid-cols-2 gap-3">
                            <TextField
                              id={`model-${index}-display`}
                              label="Tên hiển thị"
                              icon={null}
                              {...form.register(`models.${index}.displayName`)}
                            />
                            <TextField
                              id={`model-${index}-external-key`}
                              label="Tên model"
                              icon={null}
                              value={field.externalKey}
                              readOnly
                              disabled
                              className="font-mono text-sm"
                            />
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <FieldLabel id={`model-${index}-ai-config`} label="Cấu hình AI" />
                              <Select
                                value={form.watch(`models.${index}.aiConfiguration`)}
                                onValueChange={(value: "TEMPERATURE" | "REASONING_EFFORT") => 
                                  form.setValue(`models.${index}.aiConfiguration`, value, { shouldDirty: true, shouldValidate: true })
                                }
                              >
                                <SelectTrigger id={`model-${index}-ai-config`}>
                                  <SelectValue placeholder="Chọn cấu hình AI..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TEMPERATURE">Hỗ trợ Temperature</SelectItem>
                                  <SelectItem value="REASONING_EFFORT">Hỗ trợ Reasoning Effort</SelectItem>
                                </SelectContent>
                              </Select>
                              {form.formState.errors.models?.[index]?.aiConfiguration && (
                                <div className="text-xs font-semibold text-[var(--theme-danger-text-strong)] mt-0.5">
                                  {form.formState.errors.models[index]?.aiConfiguration?.message}
                                </div>
                              )}
                            </div>
                          </div>

                          {form.watch(`models.${index}.aiConfiguration`) === "REASONING_EFFORT" && (
                            <div className="mt-1 rounded-lg bg-[var(--theme-surface)] p-3 border border-[var(--theme-border)] space-y-2">
                              <label className="text-sm font-semibold text-[var(--theme-text-strong)] block mb-1">
                                Các mức Reasoning Effort hỗ trợ
                              </label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {["none", "minimal", "low", "medium", "high", "xhigh", "max"].map((level) => {
                                  const reasoningEffortLevels = form.watch(`models.${index}.reasoningEffortLevels`) || [];
                                  return (
                                    <label key={level} className="flex items-center gap-2 text-sm font-medium">
                                      <input
                                        type="checkbox"
                                        value={level}
                                        checked={reasoningEffortLevels.includes(level)}
                                        onChange={(e) => {
                                          const newLevels = e.target.checked
                                            ? [...reasoningEffortLevels, level]
                                            : reasoningEffortLevels.filter((l) => l !== level);
                                          form.setValue(`models.${index}.reasoningEffortLevels`, newLevels, { shouldDirty: true });
                                        }}
                                        className="h-4 w-4 text-[var(--theme-primary)] rounded border-[var(--theme-border)] focus:ring-[var(--theme-primary)]"
                                      />
                                      <span className="capitalize">{level}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-xs font-bold text-[var(--theme-text-strong)] mb-1.5 block">
                              Giá cho mỗi 1M token (USD) - Tuỳ chọn
                            </label>
                            <div className="grid sm:grid-cols-3 gap-3">
                              <TextField
                                id={`model-${index}-price-input`}
                                label="Input Token"
                                placeholder="0.00"
                                icon={null}
                                inputMode="decimal"
                                {...inputPriceField}
                                onChange={(e) => {
                                  e.currentTarget.value = sanitizeNumericInput(e.currentTarget.value, true);
                                  inputPriceField.onChange(e);
                                }}
                              />
                              <TextField
                                id={`model-${index}-price-cached`}
                                label="Cached Input"
                                placeholder="0.00"
                                icon={null}
                                inputMode="decimal"
                                {...cachedInputPriceField}
                                onChange={(e) => {
                                  e.currentTarget.value = sanitizeNumericInput(e.currentTarget.value, true);
                                  cachedInputPriceField.onChange(e);
                                }}
                              />
                              <TextField
                                id={`model-${index}-price-output`}
                                label="Output Token"
                                placeholder="0.00"
                                icon={null}
                                inputMode="decimal"
                                {...outputPriceField}
                                onChange={(e) => {
                                  e.currentTarget.value = sanitizeNumericInput(e.currentTarget.value, true);
                                  outputPriceField.onChange(e);
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="mt-6 sm:mt-0 theme-button-neutral inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition text-[var(--theme-danger)] hover:bg-[var(--theme-danger-subtle)] border border-transparent hover:border-[var(--theme-danger-border)]"
                          title="Xoá model khỏi danh sách"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          <span className="sm:hidden">Xóa model này</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="theme-dialog-footer flex shrink-0 flex-wrap justify-end gap-2 p-3 sm:p-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving || isFetching}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={form.handleSubmit(async (values) => handleSubmitAction(values, true))}
            disabled={isSaving || isFetching || fields.length === 0 || !hasSelectedModels}
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold transition disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto border-2 border-[var(--theme-primary)] text-[var(--theme-primary)] bg-transparent hover:bg-[var(--theme-primary-subtle)] focus:ring-2 focus:ring-[var(--theme-primary)] focus:ring-offset-2"
          >
            Áp dụng cho các model đã chọn
          </button>
          <button
            type="button"
            onClick={form.handleSubmit(async (values) => handleSubmitAction(values, false))}
            disabled={isSaving || isFetching || fields.length === 0}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold transition disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CloudDownload className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang xử lý" : "Áp dụng tất cả"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}
