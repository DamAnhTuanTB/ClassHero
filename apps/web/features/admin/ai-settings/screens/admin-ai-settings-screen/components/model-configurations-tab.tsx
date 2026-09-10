"use client";

import {
  BookOpenText,
  ClipboardCheck,
  Layers3,
  ListChecks,
  Loader2,
  Save,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FieldLabel } from "@/components/common/forms/field-label";
import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";
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
  type AdminAiConfigurationCapability,
  supportsTemperature,
  supportsReasoningEffort,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type Props = {
  data: AiConfigurationsResponse;
  isSaving: boolean;
  onSave: (configurations: AiFeatureConfiguration[]) => void;
};

const aiFeatureOrder: AiFeatureConfiguration["feature"][] = [
  "SUMMARY",
  "VIDEO_SUMMARY",
  "QUIZ",
  "FLASHCARD",
  "TEST",
];

const aiFeatureIcons = {
  SUMMARY: BookOpenText,
  VIDEO_SUMMARY: Video,
  QUIZ: ListChecks,
  FLASHCARD: Layers3,
  TEST: ClipboardCheck,
} satisfies Record<AiFeatureConfiguration["feature"], typeof BookOpenText>;

export function ModelConfigurationsTab({ data, isSaving, onSave }: Props) {
  const [configurations, setConfigurations] = useState(data.configurations);

  const stableDataJson = JSON.stringify(
    data.configurations.map(({ updatedAt: _updatedAt, ...rest }) => rest),
  );
  useEffect(() => {
    setConfigurations(data.configurations);
  }, [stableDataJson]);

  const update = (
    feature: AiFeatureConfiguration["feature"],
    purpose: AiFeatureConfiguration["purpose"],
    patch: Partial<AiFeatureConfiguration>,
  ) => {
    setConfigurations((current) =>
      current.map((item) =>
        item.feature === feature && item.purpose === purpose
          ? { ...item, ...patch }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-7">
        {aiFeatureOrder.map((feature) => {
          const FeatureIcon = aiFeatureIcons[feature];
          const featureConfigurations = configurations.filter(
            (configuration) => configuration.feature === feature,
          );

          return (
            <section key={feature} aria-labelledby={`ai-feature-${feature}`}>
              <div className="mb-3 flex items-center gap-3 border-b border-[var(--theme-border)] pb-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
                  <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                    Thiết lập model
                  </p>
                  <h2
                    id={`ai-feature-${feature}`}
                    className="mt-0.5 text-lg font-extrabold text-[var(--theme-text-strong)]"
                  >
                    {aiFeatureLabels[feature]}
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {featureConfigurations.map((configuration) => (
                  <article
                    key={`${configuration.feature}-${configuration.purpose}`}
                    className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5"
                  >
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--theme-text-strong)]">
                        {configuration.feature === "VIDEO_SUMMARY"
                          ? "Tạo nội dung tóm tắt"
                          : configuration.purpose === "TEXT"
                            ? "Phase 1 · Tạo nội dung"
                            : "Phase 2 · Tạo hình"}
                      </h3>
                    </div>

                    <div className="mt-5 grid gap-6 sm:grid-cols-2">
                      {/* Cột 1: Mô hình chính */}
                      <div className="flex flex-col gap-4">
                        <ModelSelect
                          id={`${configurationKey(configuration)}-primary-model`}
                          label="Mô hình chính"
                          allowEmpty
                          value={configuration.primaryCatalogItemId ?? ""}
                          models={data.models}
                          onChange={(value) => {
                            const updateData: Partial<AiFeatureConfiguration> = {
                              primaryCatalogItemId: value || null,
                            };
                            if (!value) {
                              updateData.temperature = null;
                              updateData.reasoningEffort = null;
                              updateData.maxInputTokens = null;
                              updateData.maxOutputTokens = null;
                            } else {
                              updateData.maxInputTokens =
                                configuration.maxInputTokens ?? 200000;
                              updateData.maxOutputTokens =
                                configuration.maxOutputTokens ?? 4096;
                            }
                            update(
                              configuration.feature,
                              configuration.purpose,
                              updateData,
                            );
                          }}
                        />

                        {(() => {
                          const primaryModel = data.models.find(
                            (m) => m.id === configuration.primaryCatalogItemId,
                          );
                          if (!primaryModel) return null;
                          const capabilities = readModelCapabilities(
                            primaryModel.capabilities,
                          );

                          const supportsTemp = supportsTemperature(
                            primaryModel.externalKey,
                            capabilities.aiConfiguration,
                          );
                          const supportsReasoning = supportsReasoningEffort(
                            primaryModel.externalKey,
                            capabilities.aiConfiguration,
                          );

                          return (
                            <>
                              {supportsReasoning && (
                                <div className="flex flex-col gap-2">
                                  <FieldLabel
                                    id={`${configurationKey(configuration)}-reasoning-effort`}
                                    label="Reasoning Effort"
                                  />
                                  <Select
                                    value={configuration.reasoningEffort ?? "__default__"}
                                    onValueChange={(value) =>
                                      update(
                                        configuration.feature,
                                        configuration.purpose,
                                        {
                                          reasoningEffort:
                                            value === "__default__" ? null : value,
                                        },
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      id={`${configurationKey(configuration)}-reasoning-effort`}
                                    >
                                      <SelectValue placeholder="Mặc định của model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__default__">
                                        Mặc định của model
                                      </SelectItem>
                                      {buildAiReasoningEffortOptions(
                                        capabilities.reasoningEffortLevels,
                                        configuration.reasoningEffort,
                                      )
                                        .slice(1)
                                        .map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {supportsTemp && (
                                <NumericSettingsField
                                  id={`${configurationKey(configuration)}-temperature`}
                                  label="Mức sáng tạo (Temperature)"
                                  value={configuration.temperature ?? 0.2}
                                  min={0}
                                  max={2}
                                  allowDecimal
                                  onChange={(value) =>
                                    update(configuration.feature, configuration.purpose, {
                                      temperature: value,
                                    })
                                  }
                                />
                              )}
                            </>
                          );
                        })()}

                        {configuration.primaryCatalogItemId ? (
                          <>
                            <NumericSettingsField
                              id={`${configurationKey(configuration)}-max-input-tokens`}
                              label="Giới hạn token đầu vào"
                              value={configuration.maxInputTokens ?? 200000}
                              min={128}
                              max={2000000}
                              onChange={(value) =>
                                update(configuration.feature, configuration.purpose, {
                                  maxInputTokens: value,
                                })
                              }
                            />
                            <NumericSettingsField
                              id={`${configurationKey(configuration)}-max-output-tokens`}
                              label="Giới hạn token đầu ra"
                              value={configuration.maxOutputTokens ?? 4096}
                              min={128}
                              max={100000}
                              onChange={(value) =>
                                update(configuration.feature, configuration.purpose, {
                                  maxOutputTokens: value,
                                })
                              }
                            />
                          </>
                        ) : null}
                      </div>

                      {/* Cột 2: Mô hình thay thế */}
                      {configuration.primaryCatalogItemId && (
                        <div className="flex flex-col gap-4">
                          <ModelSelect
                            id={`${configurationKey(configuration)}-fallback-model`}
                            label="Mô hình thay thế"
                            allowEmpty
                            value={configuration.fallbackCatalogItemId ?? ""}
                            models={data.models.filter(
                              (model) => model.id !== configuration.primaryCatalogItemId,
                            )}
                            onChange={(value) => {
                              const updateData: Partial<AiFeatureConfiguration> = {
                                fallbackCatalogItemId: value || null,
                              };
                              if (!value) {
                                updateData.fallbackTemperature = null;
                                updateData.fallbackReasoningEffort = null;
                                updateData.fallbackMaxOutputTokens = null;
                              }
                              update(
                                configuration.feature,
                                configuration.purpose,
                                updateData,
                              );
                            }}
                          />

                          {(() => {
                            const fallbackModel = data.models.find(
                              (m) => m.id === configuration.fallbackCatalogItemId,
                            );
                            if (!fallbackModel) return null;
                            const capabilities = readModelCapabilities(
                              fallbackModel.capabilities,
                            );

                            const supportsTemp = supportsTemperature(
                              fallbackModel.externalKey,
                              capabilities.aiConfiguration,
                            );
                            const supportsReasoning = supportsReasoningEffort(
                              fallbackModel.externalKey,
                              capabilities.aiConfiguration,
                            );

                            return (
                              <>
                                {supportsReasoning && (
                                  <div className="flex flex-col gap-2">
                                    <FieldLabel
                                      id={`${configurationKey(configuration)}-fallback-reasoning-effort`}
                                      label="Reasoning Effort"
                                    />
                                    <Select
                                      value={
                                        configuration.fallbackReasoningEffort ??
                                        "__default__"
                                      }
                                      onValueChange={(value) =>
                                        update(
                                          configuration.feature,
                                          configuration.purpose,
                                          {
                                            fallbackReasoningEffort:
                                              value === "__default__" ? null : value,
                                          },
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        id={`${configurationKey(configuration)}-fallback-reasoning-effort`}
                                      >
                                        <SelectValue placeholder="Mặc định của model" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__default__">
                                          Mặc định của model
                                        </SelectItem>
                                        {buildAiReasoningEffortOptions(
                                          capabilities.reasoningEffortLevels,
                                          configuration.fallbackReasoningEffort,
                                        )
                                          .slice(1)
                                          .map((option) => (
                                            <SelectItem
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {supportsTemp && (
                                  <NumericSettingsField
                                    id={`${configurationKey(configuration)}-fallback-temperature`}
                                    label="Mức sáng tạo (Temperature)"
                                    value={configuration.fallbackTemperature ?? 0.2}
                                    min={0}
                                    max={2}
                                    allowDecimal
                                    onChange={(value) =>
                                      update(
                                        configuration.feature,
                                        configuration.purpose,
                                        {
                                          fallbackTemperature: value,
                                        },
                                      )
                                    }
                                  />
                                )}
                              </>
                            );
                          })()}

                          {configuration.fallbackCatalogItemId && (
                            <NumericSettingsField
                              id={`${configurationKey(configuration)}-fallback-max-output-tokens`}
                              label="Giới hạn token đầu ra"
                              value={configuration.fallbackMaxOutputTokens ?? 4096}
                              min={128}
                              max={100000}
                              onChange={(value) =>
                                update(configuration.feature, configuration.purpose, {
                                  fallbackMaxOutputTokens: value,
                                })
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isSaving || configurations.length === 0}
          onClick={() =>
            onSave(
              configurations.map((configuration) =>
                configuration.primaryCatalogItemId
                  ? {
                      ...configuration,
                      maxInputTokens: configuration.maxInputTokens ?? 200000,
                      maxOutputTokens: configuration.maxOutputTokens ?? 4096,
                    }
                  : configuration,
              ),
            )
          }
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

function configurationKey(configuration: AiFeatureConfiguration) {
  return `${configuration.feature.toLocaleLowerCase()}-${configuration.purpose.toLocaleLowerCase()}`;
}

function readModelCapabilities(value: unknown): {
  aiConfiguration?: AdminAiConfigurationCapability;
  reasoningEffortLevels?: string[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const aiConfiguration =
    record.aiConfiguration === "TEMPERATURE" ||
    record.aiConfiguration === "REASONING_EFFORT" ||
    record.aiConfiguration === "NONE" ||
    record.aiConfiguration === null
      ? record.aiConfiguration
      : undefined;
  return {
    aiConfiguration,
    reasoningEffortLevels: Array.isArray(record.reasoningEffortLevels)
      ? record.reasoningEffortLevels.filter(
          (level): level is string => typeof level === "string",
        )
      : undefined,
  };
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
                    {!model.credentialConfigured ? " · Chưa có credential" : ""}
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
