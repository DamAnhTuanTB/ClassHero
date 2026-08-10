"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { FieldError } from "react-hook-form";
import { toast } from "sonner";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { JsonViewer } from "@/components/common/ui/json-viewer";
import type { AdminLessonSummaryPromptPreview } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { cn } from "@/lib/utils";

type PromptTab = "system" | "user" | "input";

const promptTabs: Array<{ value: PromptTab; label: string }> = [
  { value: "system", label: "System instructions" },
  { value: "user", label: "User prompt" },
  { value: "input", label: "Input đầy đủ" },
];

export function AdminSummaryPromptPreview({
  maxOutputTokens,
  model,
  onSystemInstructionsChange,
  onUserPromptChange,
  preview,
  systemInstructions,
  systemInstructionsError,
  temperature,
  reasoningEffort,
  userPrompt,
  userPromptError,
  activeTab,
  onTabChange,
}: {
  preview: AdminLessonSummaryPromptPreview;
  systemInstructions: string;
  userPrompt: string;
  model: string;
  temperature: string;
  reasoningEffort?: string;
  maxOutputTokens: string;
  systemInstructionsError?: FieldError;
  userPromptError?: FieldError;
  onSystemInstructionsChange: (value: string) => void;
  onUserPromptChange: (value: string) => void;
  activeTab: PromptTab;
  onTabChange: (tab: PromptTab) => void;
}) {
  const [copiedTab, setCopiedTab] = useState<PromptTab | null>(null);
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);
  const inputWithEditedPrompt = preview.inputPrompt.startsWith(preview.userPrompt)
    ? `${userPrompt}${preview.inputPrompt.slice(preview.userPrompt.length)}`
    : preview.inputPrompt;
  const {
    reasoning_effort: previewReasoningEffort,
    temperature: previewTemperature,
    ...baseOpenAiRequest
  } = preview.openAiRequest;
  const effectiveModel = model || preview.openAiRequest.model;
  const effectiveModelCapability = preview.configuration.modelOptions?.find(
    (option) => option.model === effectiveModel,
  )?.capabilities?.aiConfiguration;
  const usesReasoningEffort = supportsReasoningEffort(
    effectiveModel,
    effectiveModelCapability,
  );
  const effectiveReasoningEffort = usesReasoningEffort
    ? reasoningEffort || previewReasoningEffort
    : undefined;
  const fullInputData = {
    ...baseOpenAiRequest,
    model: effectiveModel,
    instructions: systemInstructions,
    input: inputWithEditedPrompt,
    ...(effectiveReasoningEffort
      ? { reasoning_effort: effectiveReasoningEffort }
      : { temperature: Number(temperature || previewTemperature) }),
    max_output_tokens: Number(maxOutputTokens || preview.openAiRequest.max_output_tokens),
  };
  const fullInputJson = JSON.stringify(fullInputData, null, 2);
  const promptValue =
    activeTab === "system"
      ? systemInstructions
      : activeTab === "user"
        ? userPrompt
        : fullInputJson;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptValue);
      setCopiedTab(activeTab);
      window.setTimeout(() => setCopiedTab(null), 1_500);
      toast.success("Đã sao chép prompt");
    } catch {
      toast.error("Chưa thể sao chép prompt");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <PreviewMetric label="Tài liệu" value={preview.context.documentCount} />
        <PreviewMetric label="Phần nội dung" value={preview.context.chunkCount} />
        <PreviewMetric
          label="Dung lượng ước tính"
          value={preview.context.estimatedTokens.toLocaleString("vi-VN")}
        />
      </div>

      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] p-3 text-sm">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <PreviewDetail
            label="Model thực tế"
            value={
              preview.configuration.resolvedModel
                ? `${formatProvider(preview.configuration.resolvedProvider)} · ${preview.configuration.resolvedModel}`
                : "Chưa có model khả dụng"
            }
          />
          {(() => {
            const resolvedModelCapabilities = preview.configuration.modelOptions?.find(
              (o) => o.model === preview.configuration.resolvedModel,
            )?.capabilities;
            const aiConfiguration = resolvedModelCapabilities?.aiConfiguration;

            const showReasoning = supportsReasoningEffort(
              preview.configuration.resolvedModel,
              aiConfiguration,
            );
            const showTemp = supportsTemperature(
              preview.configuration.resolvedModel,
              aiConfiguration,
            );

            return (
              <>
                {showReasoning && (
                  <PreviewDetail
                    label="Reasoning Effort"
                    value={reasoningEffort || "Mặc định"}
                  />
                )}
                {showTemp && (
                  <PreviewDetail
                    label="Temperature"
                    value={temperature || preview.configuration.temperature.toString()}
                  />
                )}
              </>
            );
          })()}
          <PreviewDetail
            label="Giới hạn đầu ra"
            value={`${Number(
              maxOutputTokens || preview.configuration.maxOutputTokens,
            ).toLocaleString("vi-VN")} token`}
          />
          <PreviewDetail
            label="Chi phí tối đa ước tính"
            value={
              preview.estimatedCost.available &&
              preview.estimatedCost.upperBoundVnd !== null
                ? `≈ ${preview.estimatedCost.upperBoundVnd.toLocaleString("vi-VN")} ₫`
                : "Chưa đủ bảng giá để tính"
            }
          />
        </dl>
      </div>

      <div>
        <div
          role="tablist"
          aria-label="Dữ liệu gửi đến model"
          className="grid grid-cols-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
        >
          {promptTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(
                "min-h-10 rounded-lg px-2 text-xs font-extrabold transition sm:text-sm",
                activeTab === tab.value
                  ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          className="mt-2 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2">
            <p className="text-xs font-bold text-[var(--theme-text-muted)]">
              {activeTab === "system"
                ? "Quy tắc AI cần tuân theo"
                : activeTab === "user"
                  ? "Nội dung AI sẽ thực hiện"
                  : "Dữ liệu hoàn chỉnh trước khi tạo"}
            </p>
            <button
              type="button"
              onClick={copyPrompt}
              className="theme-button-primary-subtle inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold"
            >
              {copiedTab === activeTab ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copiedTab === activeTab ? "Đã chép" : "Sao chép"}
            </button>
          </div>
          {activeTab === "system" ? (
            <TextareaField
              id="ai-summary-system-instructions"
              label="System instructions"
              wrapperClassName="p-3"
              className="min-h-64 font-mono text-xs leading-5"
              value={systemInstructions}
              error={systemInstructionsError}
              onChange={(event) => onSystemInstructionsChange(event.currentTarget.value)}
            />
          ) : activeTab === "user" ? (
            <TextareaField
              id="ai-summary-user-prompt"
              label="User prompt"
              wrapperClassName="p-3"
              className="min-h-64 font-mono text-xs leading-5"
              value={userPrompt}
              error={userPromptError}
              onChange={(event) => onUserPromptChange(event.currentTarget.value)}
            />
          ) : (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--theme-border)] bg-[var(--theme-surface)]">
                <button
                  type="button"
                  onClick={() => setIsJsonExpanded(true)}
                  className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Xổ toàn bộ
                </button>
                <button
                  type="button"
                  onClick={() => setIsJsonExpanded(false)}
                  className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Thu lại toàn bộ
                </button>
              </div>
              <div className="max-h-96 overflow-auto p-4 bg-white dark:bg-slate-950">
                <JsonViewer
                  key={isJsonExpanded ? "expanded" : "collapsed"}
                  collapseAtDepth={isJsonExpanded ? 999 : 1}
                  data={fullInputData}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
      <p className="text-xs font-bold text-[var(--theme-text-muted)]">{label}</p>
      <p className="mt-1 text-base font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}

function PreviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-[var(--theme-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </dd>
    </div>
  );
}

function formatProvider(provider: string | null) {
  if (!provider) return "Provider chưa xác định";
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider;
}
