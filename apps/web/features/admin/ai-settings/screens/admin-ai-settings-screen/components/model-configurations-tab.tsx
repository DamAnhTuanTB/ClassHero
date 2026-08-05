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

type Props = {
  data: AiConfigurationsResponse;
  isSaving: boolean;
  onSave: (configurations: AiFeatureConfiguration[]) => void;
};

export function ModelConfigurationsTab({ data, isSaving, onSave }: Props) {
  const [configurations, setConfigurations] = useState(data.configurations);

  useEffect(() => setConfigurations(data.configurations), [data.configurations]);

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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ModelSelect
                id={`${configuration.feature.toLocaleLowerCase()}-primary-model`}
                label="Mô hình chính"
                value={configuration.primaryCatalogItemId}
                models={data.models}
                onChange={(value) =>
                  update(configuration.feature, { primaryCatalogItemId: value })
                }
              />
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
              <NumericSettingsField
                id={`${configuration.feature.toLocaleLowerCase()}-temperature`}
                label="Mức sáng tạo"
                value={configuration.temperature ?? 0.2}
                min={0}
                max={2}
                allowDecimal
                onChange={(value) =>
                  update(configuration.feature, { temperature: value })
                }
              />
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
                : "Không dùng mô hình thay thế"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allowEmpty ? (
              <>
                <SelectItem value="__none__">Không dùng mô hình thay thế</SelectItem>
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
      <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--theme-text-muted)]">
        {selected?.credentialConfigured ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--theme-success-text)]" />
        ) : selected ? (
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--theme-warning-text)]" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        {selected
          ? selected.credentialConfigured
            ? "Sẵn sàng sử dụng"
            : "Chưa thể sử dụng"
          : "Chưa chọn mô hình"}
      </span>
    </div>
  );
}
