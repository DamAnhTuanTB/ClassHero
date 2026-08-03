"use client";

import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
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
      <div className="rounded-xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] p-4 text-sm text-[var(--theme-text)]">
        <p className="font-extrabold text-[var(--theme-text-strong)]">
          Model được chụp lại khi job được tạo
        </p>
        <p className="mt-1 leading-6">
          Job đang chạy không bị đổi model giữa chừng. Fallback chỉ dùng khi model chính
          timeout, bị giới hạn tốc độ hoặc lỗi provider tạm thời.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {configurations.map((configuration) => (
          <article
            key={configuration.feature}
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                  Chức năng AI
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">
                  {aiFeatureLabels[configuration.feature]}
                </h3>
              </div>
              <span className="rounded-full bg-[var(--theme-surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--theme-text-muted)]">
                v{configuration.version}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ModelSelect
                label="Model chính"
                value={configuration.primaryCatalogItemId}
                models={data.models}
                onChange={(value) =>
                  update(configuration.feature, { primaryCatalogItemId: value })
                }
              />
              <ModelSelect
                label="Model dự phòng"
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
              <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">
                Temperature
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={configuration.temperature ?? 0.2}
                  onChange={(event) =>
                    update(configuration.feature, {
                      temperature: Number(event.target.value),
                    })
                  }
                  className="min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">
                Giới hạn output token
                <input
                  type="number"
                  min="128"
                  step="128"
                  value={configuration.maxOutputTokens ?? 4096}
                  onChange={(event) =>
                    update(configuration.feature, {
                      maxOutputTokens: Number(event.target.value),
                    })
                  }
                  className="min-h-11 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]"
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isSaving || configurations.length === 0}
          onClick={() => onSave(configurations)}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 font-extrabold disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu" : "Lưu cấu hình model"}
        </button>
      </div>
    </div>
  );
}

function ModelSelect({
  label,
  value,
  models,
  allowEmpty = false,
  onChange,
}: {
  label: string;
  value: string;
  models: AiConfigurationsResponse["models"];
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}) {
  const selected = models.find((model) => model.id === value);
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[var(--theme-text)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]"
      >
        {allowEmpty ? <option value="">Không dùng fallback</option> : null}
        {models.map((model) => (
          <option
            key={model.id}
            value={model.id}
            disabled={model.status === "DISABLED" || !model.credentialConfigured}
          >
            {model.displayName} · {model.provider}
            {!model.credentialConfigured ? " · Thiếu credential" : ""}
          </option>
        ))}
      </select>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--theme-text-muted)]">
        {selected?.credentialConfigured ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--theme-success-text)]" />
        ) : selected ? (
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--theme-warning-text)]" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        {selected
          ? selected.credentialConfigured
            ? `${selected.externalKey} · credential sẵn sàng`
            : `${selected.externalKey} · cần cấu hình credential ở môi trường chạy`
          : "Chưa chọn model"}
      </span>
    </label>
  );
}
