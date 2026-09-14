"use client";

import {
  BookOpenText,
  ClipboardCheck,
  Layers3,
  ListChecks,
  Loader2,
  MessageCircleMore,
  Save,
  Search,
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
  AiChatRuntimeSettings,
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
  onSave: (
    configurations: AiFeatureConfiguration[],
    chatSettings?: AiChatRuntimeSettings,
  ) => void;
  featureFilter?: AiFeatureConfiguration["feature"][];
};

const aiFeatureOrder: AiFeatureConfiguration["feature"][] = [
  "VIDEO_SUMMARY",
  "SUMMARY",
  "QUIZ",
  "FLASHCARD",
  "TEST",
  "CHAT",
];

const aiFeatureIcons = {
  SUMMARY: BookOpenText,
  VIDEO_SUMMARY: Video,
  QUIZ: ListChecks,
  FLASHCARD: Layers3,
  TEST: ClipboardCheck,
  CHAT: MessageCircleMore,
} satisfies Record<AiFeatureConfiguration["feature"], typeof BookOpenText>;

const aiFeatureDescriptions = {
  SUMMARY: "Cấu hình model tạo nội dung kiến thức và hình minh họa.",
  VIDEO_SUMMARY: "Cấu hình model tạo bản tóm tắt từ nội dung video.",
  QUIZ: "Cấu hình model tạo câu hỏi ôn tập và hình minh họa.",
  FLASHCARD: "Cấu hình model tạo thẻ ghi nhớ và hình minh họa.",
  TEST: "Cấu hình model tạo bài kiểm tra và hình minh họa.",
  CHAT: "Cấu hình model trả lời học sinh trong tính năng Chat với AI.",
} satisfies Record<AiFeatureConfiguration["feature"], string>;

export function ModelConfigurationsTab({
  data,
  isSaving,
  onSave,
  featureFilter,
}: Props) {
  const visibleFeatureOrder = featureFilter
    ? aiFeatureOrder.filter((feature) => featureFilter.includes(feature))
    : aiFeatureOrder;
  const [configurations, setConfigurations] = useState(data.configurations);
  const [chatSettings, setChatSettings] = useState(data.chatSettings);
  const [selectedFeature, setSelectedFeature] =
    useState<AiFeatureConfiguration["feature"]>(
      visibleFeatureOrder[0] ?? "VIDEO_SUMMARY",
    );

  const stableDataJson = JSON.stringify(
    {
      configurations: data.configurations.map(
        ({ updatedAt: _updatedAt, ...rest }) => rest,
      ),
      chatSettings: data.chatSettings,
    },
  );
  useEffect(() => {
    setConfigurations(data.configurations);
    setChatSettings(data.chatSettings);
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

  const selectedConfigurations = configurations.filter(
    (configuration) => configuration.feature === selectedFeature,
  );
  const SelectedFeatureIcon = aiFeatureIcons[selectedFeature];

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-5 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          aria-label="Nhóm thiết lập AI"
          className="min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2 md:sticky md:top-4"
        >
          <p className="px-3 pb-2 pt-1 text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
            Tính năng
          </p>
          <nav
            aria-label="Chọn tính năng cần thiết lập"
            className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
          >
            {visibleFeatureOrder.map((feature) => {
              const FeatureIcon = aiFeatureIcons[feature];
              const isSelected = selectedFeature === feature;
              return (
                <button
                  key={feature}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="ai-feature-configuration-panel"
                  onClick={() => setSelectedFeature(feature)}
                  className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-bold transition md:w-full ${
                    isSelected
                      ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:border-[var(--theme-border)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]"
                  }`}
                >
                  <FeatureIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap md:whitespace-normal">
                    {aiFeatureLabels[feature]}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section
          id="ai-feature-configuration-panel"
          aria-live="polite"
          className="min-w-0"
        >
          <div className="mb-4 flex items-start gap-3 border-b border-[var(--theme-border)] pb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
              <SelectedFeatureIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                Thiết lập model
              </p>
              <h2 className="mt-0.5 text-lg font-extrabold text-[var(--theme-text-strong)]">
                {aiFeatureLabels[selectedFeature]}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
                {aiFeatureDescriptions[selectedFeature]}
              </p>
            </div>
          </div>

          {selectedConfigurations.length > 0 ? (
            <div className="grid gap-4">
              {selectedConfigurations.map((configuration) => (
                <article
                  key={`${configuration.feature}-${configuration.purpose}`}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5"
                >
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--theme-text-strong)]">
                      {configuration.feature === "VIDEO_SUMMARY"
                        ? "Tạo nội dung tóm tắt"
                        : configuration.feature === "CHAT"
                          ? "Tạo câu trả lời"
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
                        models={modelsForFeature(data.models, configuration.feature)}
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
                                    update(configuration.feature, configuration.purpose, {
                                      reasoningEffort:
                                        value === "__default__" ? null : value,
                                    })
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
                          models={modelsForFeature(
                            data.models,
                            configuration.feature,
                          ).filter(
                            (model) => model.id !== configuration.primaryCatalogItemId,
                          )}
                          onChange={(value) => {
                            const updateData: Partial<AiFeatureConfiguration> = {
                              fallbackCatalogItemId: value || null,
                            };
                            if (!value) {
                              updateData.fallbackTemperature = null;
                              updateData.fallbackReasoningEffort = null;
                              updateData.fallbackMaxInputTokens = null;
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
                                    update(configuration.feature, configuration.purpose, {
                                      fallbackTemperature: value,
                                    })
                                  }
                                />
                              )}
                            </>
                          );
                        })()}

                        {configuration.fallbackCatalogItemId && (
                          <>
                            <NumericSettingsField
                              id={`${configurationKey(configuration)}-fallback-max-input-tokens`}
                              label="Giới hạn token đầu vào"
                              value={
                                configuration.fallbackMaxInputTokens ??
                                configuration.maxInputTokens ??
                                200000
                              }
                              min={128}
                              max={2000000}
                              onChange={(value) =>
                                update(configuration.feature, configuration.purpose, {
                                  fallbackMaxInputTokens: value,
                                })
                              }
                            />
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {selectedFeature === "CHAT" ? (
                <>
                  <article className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
                        <Search className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--theme-text-strong)]">
                          Embedding truy xuất
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
                          Thiết lập riêng model biến câu hỏi thành vector để tìm nội dung bài học. Model này không dùng để tạo câu trả lời.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <ModelSelect
                        id="chat-embedding-model"
                        label="Mô hình embedding"
                        value={chatSettings.embeddingCatalogItemId ?? ""}
                        models={data.models.filter(isEmbeddingModel)}
                        onChange={(embeddingCatalogItemId) => {
                          const model = data.models.find(
                            (candidate) => candidate.id === embeddingCatalogItemId,
                          );
                          const capabilities = readModelCapabilities(
                            model?.capabilities,
                          );
                          setChatSettings((current) => ({
                            ...current,
                            embeddingCatalogItemId,
                            embeddingProvider: "OPENAI",
                            embeddingModel: model?.externalKey ?? current.embeddingModel,
                            embeddingDimensions:
                              capabilities.dimensions?.includes(
                                current.embeddingDimensions,
                              )
                                ? current.embeddingDimensions
                                : capabilities.dimensions?.[0] ??
                                  current.embeddingDimensions,
                          }));
                        }}
                      />
                      <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-3">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                          Vector dimensions
                        </p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">
                          {chatSettings.embeddingDimensions.toLocaleString("vi-VN")}
                        </p>
                        <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
                          Phải khớp vector space của tài liệu đã index.
                        </p>
                      </div>
                    </div>
                  </article>

                  <article className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--theme-text-strong)]">
                      Giới hạn sử dụng &amp; ảnh
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
                      Giới hạn ảnh áp dụng cho cả Chat AI học sinh và phiên mô phỏng admin; quota theo ngày chỉ áp dụng cho học sinh.
                    </p>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <NumericSettingsField
                        id="chat-student-daily-message-limit"
                        label="Số câu hỏi AI tối đa mỗi học sinh/ngày"
                        value={chatSettings.studentDailyMessageLimit}
                        min={1}
                        max={1000}
                        onChange={(studentDailyMessageLimit) =>
                          setChatSettings((current) => ({
                            ...current,
                            studentDailyMessageLimit,
                          }))
                        }
                      />
                      <NumericSettingsField
                        id="chat-student-daily-image-limit"
                        label="Số ảnh tối đa mỗi học sinh/ngày"
                        value={chatSettings.studentDailyImageLimit}
                        min={0}
                        max={1000}
                        onChange={(studentDailyImageLimit) =>
                          setChatSettings((current) => ({
                            ...current,
                            studentDailyImageLimit,
                          }))
                        }
                      />
                      <NumericSettingsField
                        id="chat-max-images-per-message"
                        label="Số ảnh tối đa mỗi lượt"
                        value={chatSettings.maxImagesPerMessage}
                        min={1}
                        max={10}
                        onChange={(maxImagesPerMessage) =>
                          setChatSettings((current) => ({
                            ...current,
                            maxImagesPerMessage,
                          }))
                        }
                      />
                      <NumericSettingsField
                        id="chat-max-image-size-mb"
                        label="Dung lượng tối đa mỗi ảnh"
                        value={chatSettings.maxImageBytes / 1024 / 1024}
                        min={1}
                        max={20}
                        suffix="MB"
                        onChange={(maxImageMegabytes) =>
                          setChatSettings((current) => ({
                            ...current,
                            maxImageBytes: Math.round(
                              maxImageMegabytes * 1024 * 1024,
                            ),
                          }))
                        }
                      />
                      <fieldset>
                        <legend className="text-sm font-bold text-[var(--theme-text-strong)]">
                          Định dạng ảnh được phép
                        </legend>
                        <div className="mt-2 flex min-h-11 flex-wrap items-center gap-2">
                          {chatImageFormats.map((format) => {
                            const checked = chatSettings.allowedImageMimeTypes.includes(
                              format.mimeType,
                            );
                            return (
                              <label
                                key={format.mimeType}
                                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 text-sm font-bold text-[var(--theme-text-strong)]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={
                                    checked &&
                                    chatSettings.allowedImageMimeTypes.length === 1
                                  }
                                  onChange={() =>
                                    setChatSettings((current) => ({
                                      ...current,
                                      allowedImageMimeTypes: checked
                                        ? current.allowedImageMimeTypes.filter(
                                            (mimeType) => mimeType !== format.mimeType,
                                          )
                                        : [
                                            ...current.allowedImageMimeTypes,
                                            format.mimeType,
                                          ],
                                    }))
                                  }
                                />
                                {format.label}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>
                  </article>
                </>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 text-sm text-[var(--theme-text-muted)]">
              Chưa có cấu hình model cho tính năng này.
            </div>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={
            isSaving ||
            configurations.length === 0 ||
            (visibleFeatureOrder.includes("CHAT") &&
              !chatSettings.embeddingCatalogItemId)
          }
          onClick={() =>
            onSave(
              configurations
                .filter((configuration) =>
                  visibleFeatureOrder.includes(configuration.feature),
                )
                .map((configuration) =>
                configuration.primaryCatalogItemId
                  ? {
                      ...configuration,
                      maxInputTokens: configuration.maxInputTokens ?? 200000,
                      maxOutputTokens: configuration.maxOutputTokens ?? 4096,
                    }
                  : configuration,
              ),
              visibleFeatureOrder.includes("CHAT") ? chatSettings : undefined,
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
  features?: string[];
  dimensions?: number[];
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
    features: Array.isArray(record.features)
      ? record.features.filter(
          (feature): feature is string => typeof feature === "string",
        )
      : undefined,
    dimensions: Array.isArray(record.dimensions)
      ? record.dimensions.filter(
          (dimension): dimension is number =>
            typeof dimension === "number" && Number.isInteger(dimension),
        )
      : undefined,
  };
}

const chatImageFormats = [
  { mimeType: "image/jpeg", label: "JPG / JPEG" },
  { mimeType: "image/png", label: "PNG" },
  { mimeType: "image/webp", label: "WebP" },
] as const;

function isEmbeddingModel(model: AiConfigurationsResponse["models"][number]) {
  return (
    model.provider === "OPENAI" &&
    readModelCapabilities(model.capabilities).features?.includes("EMBEDDING") ===
      true
  );
}

function modelsForFeature(
  models: AiConfigurationsResponse["models"],
  feature: AiFeatureConfiguration["feature"],
) {
  return models.filter((model) => {
    if (isEmbeddingModel(model)) return false;
    const features = readModelCapabilities(model.capabilities).features ?? [];
    return (
      features.includes(feature) ||
      (feature === "VIDEO_SUMMARY" && features.includes("SUMMARY"))
    );
  });
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
