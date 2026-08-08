"use client";

import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldLabel } from "@/components/common/forms/field-label";
import { SelectContent } from "@/components/common/ui/select/content";
import { SelectGroup } from "@/components/common/ui/select/group";
import { SelectItem } from "@/components/common/ui/select/item";
import { SelectLabel } from "@/components/common/ui/select/label";
import { Select } from "@/components/common/ui/select/root";
import { SelectSeparator } from "@/components/common/ui/select/separator";
import { SelectTrigger } from "@/components/common/ui/select/trigger";
import { SelectValue } from "@/components/common/ui/select/value";
import { NumericSettingsField } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/numeric-settings-field";
import type {
  AiConfigurationsResponse,
  AiFeatureConfiguration,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import { aiFeatureLabels } from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import {
  supportsTemperature,
  supportsReasoningEffort,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type Props = {
  data: AiConfigurationsResponse;
  isSaving: boolean;
  onSave: (configurations: AiFeatureConfiguration[]) => void;
};

export function ModelConfigurationsTab({ data, isSaving, onSave }: Props) {
  const [configurations, setConfigurations] = useState(data.configurations);

  const stableDataJson = JSON.stringify(
    data.configurations.map(({ updatedAt, ...rest }) => rest)
  );
  useEffect(() => {
    setConfigurations(data.configurations);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableDataJson]);

  const update = (
    feature: AiFeatureConfiguration["feature"],
    patch: Partial<AiFeatureConfiguration>,
  ) => {
    setConfigurations((current) =>
      current.map((item) => (item.feature === feature ? { ...item, ...patch } : item)),
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        {configurations.map((configuration) => (
          <article
            key={configuration.feature}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5"
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                Tính năng
              </p>
              <h3 className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">
                {aiFeatureLabels[configuration.feature]}
              </h3>
            </div>

            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              {/* Cột 1: Mô hình chính */}
              <div className="flex flex-col gap-4">
                <ModelSelect
                  id={`${configuration.feature.toLocaleLowerCase()}-primary-model`}
                  label="Mô hình chính"
                  allowEmpty
                  value={configuration.primaryCatalogItemId ?? ""}
                  models={data.models}
                  onChange={(value) =>
                    update(configuration.feature, { primaryCatalogItemId: value || null })
                  }
                />
                
                {(() => {
                  const primaryModel = data.models.find(
                    (m) => m.id === configuration.primaryCatalogItemId,
                  );
                  if (!primaryModel) return null;

                  const supportsTemp = supportsTemperature(
                    primaryModel.externalKey,
                    (primaryModel.capabilities as any)?.aiConfiguration
                  );
                  const supportsReasoning = supportsReasoningEffort(
                    primaryModel.externalKey,
                    (primaryModel.capabilities as any)?.aiConfiguration
                  );

                  return (
                    <>
                      {supportsReasoning && (
                        <div className="flex flex-col gap-2">
                          <FieldLabel
                            id={`${configuration.feature.toLocaleLowerCase()}-reasoning-effort`}
                            label="Reasoning Effort"
                          />
                          <Select
                            value={configuration.reasoningEffort ?? "__default__"}
                            onValueChange={(value) =>
                              update(configuration.feature, {
                                reasoningEffort: value === "__default__" ? null : value,
                              })
                            }
                          >
                            <SelectTrigger
                              id={`${configuration.feature.toLocaleLowerCase()}-reasoning-effort`}
                            >
                              <SelectValue placeholder="Mặc định của model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default__">
                                Mặc định của model
                              </SelectItem>
                              {(() => {
                                const levels = (primaryModel.capabilities as any)?.reasoningEffortLevels as string[] | undefined;
                                const labels: Record<string, string> = {
                                  minimal: "Tối thiểu (Minimal)",
                                  low: "Thấp (Low)",
                                  medium: "Trung bình (Medium)",
                                  high: "Cao (High)",
                                  none: "Không (None)",
                                  xhigh: "Rất cao (Extra High)",
                                  max: "Tối đa (Max)",
                                };
                                const options = levels?.length
                                  ? [...levels].sort((a, b) => {
                                      const order = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
                                      return (order.indexOf(a) > -1 ? order.indexOf(a) : 99) - (order.indexOf(b) > -1 ? order.indexOf(b) : 99);
                                    })
                                  : [];
                                return options.map((level) => (
                                  <SelectItem key={level} value={level}>
                                    {labels[level] || level}
                                  </SelectItem>
                                ));
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {supportsTemp && (
                        <NumericSettingsField
                          id={`${configuration.feature.toLocaleLowerCase()}-temperature`}
                          label="Mức sáng tạo (Temperature)"
                          value={configuration.temperature ?? 0.2}
                          min={0}
                          max={2}
                          allowDecimal
                          onChange={(value) =>
                            update(configuration.feature, { temperature: value })
                          }
                        />
                      )}
                    </>
                  );
                })()}
                
                {configuration.primaryCatalogItemId && (
                  <NumericSettingsField
                    id={`${configuration.feature.toLocaleLowerCase()}-max-output-tokens`}
                    label="Độ dài tối đa"
                    value={configuration.maxOutputTokens ?? 4096}
                    min={128}
                    max={128000}
                    onChange={(value) =>
                      update(configuration.feature, { maxOutputTokens: value })
                    }
                  />
                )}
              </div>

              {/* Cột 2: Mô hình thay thế */}
              {configuration.primaryCatalogItemId && (
                <div className="flex flex-col gap-4">
                  <ModelSelect
                    id={`${configuration.feature.toLocaleLowerCase()}-fallback-model`}
                    label="Mô hình thay thế"
                    allowEmpty
                    value={configuration.fallbackCatalogItemId ?? ""}
                    models={data.models.filter(
                      (model) => model.id !== configuration.primaryCatalogItemId,
                    )}
                    onChange={(value) =>
                      update(configuration.feature, {
                        fallbackCatalogItemId: value || null,
                      })
                    }
                  />

                  {(() => {
                    const fallbackModel = data.models.find(
                      (m) => m.id === configuration.fallbackCatalogItemId,
                    );
                    if (!fallbackModel) return null;

                    const supportsTemp = supportsTemperature(
                      fallbackModel.externalKey,
                      (fallbackModel.capabilities as any)?.aiConfiguration
                    );
                    const supportsReasoning = supportsReasoningEffort(
                      fallbackModel.externalKey,
                      (fallbackModel.capabilities as any)?.aiConfiguration
                    );

                    return (
                      <>
                        {supportsReasoning && (
                          <div className="flex flex-col gap-2">
                            <FieldLabel
                              id={`${configuration.feature.toLocaleLowerCase()}-fallback-reasoning-effort`}
                              label="Reasoning Effort"
                            />
                            <Select
                              value={configuration.fallbackReasoningEffort ?? "__default__"}
                              onValueChange={(value) =>
                                update(configuration.feature, {
                                  fallbackReasoningEffort: value === "__default__" ? null : value,
                                })
                              }
                            >
                              <SelectTrigger
                                id={`${configuration.feature.toLocaleLowerCase()}-fallback-reasoning-effort`}
                              >
                                <SelectValue placeholder="Mặc định của model" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__default__">
                                  Mặc định của model
                                </SelectItem>
                                {(() => {
                                  const levels = (fallbackModel.capabilities as any)?.reasoningEffortLevels as string[] | undefined;
                                  const labels: Record<string, string> = {
                                    minimal: "Tối thiểu (Minimal)",
                                    low: "Thấp (Low)",
                                    medium: "Trung bình (Medium)",
                                    high: "Cao (High)",
                                    none: "Không (None)",
                                    xhigh: "Rất cao (Extra High)",
                                    max: "Tối đa (Max)",
                                  };
                                  const options = levels?.length
                                    ? [...levels].sort((a, b) => {
                                        const order = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
                                        return (order.indexOf(a) > -1 ? order.indexOf(a) : 99) - (order.indexOf(b) > -1 ? order.indexOf(b) : 99);
                                      })
                                    : [];
                                  return options.map((level) => (
                                    <SelectItem key={level} value={level}>
                                      {labels[level] || level}
                                    </SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {supportsTemp && (
                          <NumericSettingsField
                            id={`${configuration.feature.toLocaleLowerCase()}-fallback-temperature`}
                            label="Mức sáng tạo (Temperature)"
                            value={configuration.fallbackTemperature ?? 0.2}
                            min={0}
                            max={2}
                            allowDecimal
                            onChange={(value) =>
                              update(configuration.feature, { fallbackTemperature: value })
                            }
                          />
                        )}
                      </>
                    );
                  })()}

                  {configuration.fallbackCatalogItemId && (
                    <NumericSettingsField
                      id={`${configuration.feature.toLocaleLowerCase()}-fallback-max-output-tokens`}
                      label="Độ dài tối đa"
                      value={configuration.fallbackMaxOutputTokens ?? 4096}
                      min={128}
                      max={128000}
                      onChange={(value) =>
                        update(configuration.feature, { fallbackMaxOutputTokens: value })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isSaving || configurations.length === 0}
          onClick={() => onSave(configurations)}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold transition disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu" : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}

function ModelSelect({
  id,
  label,
  value,
  models,
  allowEmpty = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  models: AiConfigurationsResponse["models"];
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}) {
  const selected = models.find((model) => model.id === value);
  const providerGroups = ["OPENAI", "GEMINI"]
    .map((provider) => ({
      provider,
      models: models.filter((model) => model.provider === provider),
    }))
    .filter((group) => group.models.length > 0);
  const selectValue = value || "__none__";
  return (
    <div>
      <FieldLabel id={id} label={label} />
      <div className="mt-2">
        <Select
          value={selectValue}
          onValueChange={(nextValue) =>
            onChange(nextValue === "__none__" ? "" : nextValue)
          }
        >
          <SelectTrigger id={id} aria-label={label}>
            <SelectValue>
              {selected
                ? `${selected.displayName} · ${selected.provider}`
                : allowEmpty
                  ? "Không dùng"
                  : "Chưa chọn mô hình"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allowEmpty ? (
              <>
                <SelectItem value="__none__">Không dùng</SelectItem>
                <SelectSeparator />
              </>
            ) : null}
            {providerGroups.map((group, groupIndex) => (
              <SelectGroup key={group.provider}>
                <SelectLabel>{group.provider}</SelectLabel>
                {group.models.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={model.id}
                    disabled={model.status === "DISABLED" || !model.credentialConfigured}
                  >
                    {model.displayName}
                    {!model.credentialConfigured ? " · Chưa sẵn sàng" : ""}
                  </SelectItem>
                ))}
                {groupIndex < providerGroups.length - 1 ? <SelectSeparator /> : null}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
}
