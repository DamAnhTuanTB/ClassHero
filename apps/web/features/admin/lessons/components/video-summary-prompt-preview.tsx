"use client";

import { Check, Copy, Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import type { VideoSummaryPreview } from "@/features/admin/lessons/api/admin-video-summary-api";
import { cn } from "@/lib/utils";

type PreviewTab = "system" | "user" | "source";
type PromptDisplayMode = "PREVIEW" | "MARKDOWN";

const previewTabs: Array<{ value: PreviewTab; label: string }> = [
  { value: "system", label: "Quy tắc hệ thống" },
  { value: "user", label: "Câu lệnh người dùng" },
  { value: "source", label: "Dữ liệu gửi đi" },
];

export function VideoSummaryPromptPreview({
  onSystemInstructionsChange,
  onUserPromptChange,
  preview,
  systemInstructions,
  userPrompt,
}: {
  preview: VideoSummaryPreview;
  systemInstructions: string;
  userPrompt: string;
  onSystemInstructionsChange: (value: string) => void;
  onUserPromptChange: (value: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("system");
  const [copiedTab, setCopiedTab] = useState<PreviewTab | null>(null);
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const [promptDisplayModes, setPromptDisplayModes] = useState<
    Record<Exclude<PreviewTab, "source">, PromptDisplayMode>
  >({ system: "PREVIEW", user: "PREVIEW" });
  const transcript = preview.sourcePacket.transcript
    .map((segment) => segment.text)
    .join(" ");
  const chapters =
    preview.sourcePacket.chapters
      .map((chapter) => `[${formatTime(chapter.time)}] ${chapter.title}`)
      .join("\n") || "Không có mốc chương.";
  const sourceText = `MỐC THỜI GIAN:\n${chapters}\n\nBẢN CHÉP LỜI:\n${transcript}`;
  const requestPayload = buildRequestPayload({
    preview,
    sourceText,
    systemInstructions,
    userPrompt,
  });
  const visibleContent =
    activeTab === "system"
      ? systemInstructions
      : activeTab === "user"
        ? userPrompt
        : JSON.stringify(requestPayload, null, 2);
  const activePromptDisplayMode =
    activeTab === "source" ? null : promptDisplayModes[activeTab];
  const isPromptPreview = activePromptDisplayMode === "PREVIEW";
  const tokenBreakdown = resolveTokenBreakdown(preview, {
    sourceText,
    systemInstructions,
    userPrompt,
  });
  const statistics = [
    {
      label: "Model thực tế",
      value: `${formatProvider(preview.model.provider)} · ${preview.model.model}`,
    },
    ...(preview.model.reasoningEffort
      ? [{ label: "Reasoning Effort", value: preview.model.reasoningEffort }]
      : preview.model.temperature !== null
        ? [{ label: "Temperature", value: String(preview.model.temperature) }]
        : []),
    {
      label: "Giới hạn đầu ra",
      value: preview.model.maxOutputTokens
        ? `${preview.model.maxOutputTokens.toLocaleString("vi-VN")} token`
        : "Theo cấu hình model",
    },
    {
      label: "Text input ước tính",
      value: `${preview.model.inputTokenEstimate.textInputTokens.toLocaleString("vi-VN")} token`,
      onClick: () => setIsInputBreakdownDialogOpen(true),
    },
    {
      label: "Tổng input ước tính",
      value: `${preview.model.inputTokenEstimate.estimatedTokens.toLocaleString("vi-VN")} token`,
    },
    {
      label: "Mốc thời gian gửi đi",
      value: `${preview.sourcePacket.chapters.length.toLocaleString("vi-VN")} mốc`,
    },
  ];

  async function copyVisibleContent() {
    try {
      await navigator.clipboard.writeText(visibleContent);
      setCopiedTab(activeTab);
      window.setTimeout(() => setCopiedTab(null), 1_500);
      toast.success("Đã sao chép dữ liệu");
    } catch {
      toast.error("Chưa thể sao chép dữ liệu");
    }
  }

  function setPromptDisplayMode(mode: PromptDisplayMode) {
    if (activeTab === "source") return;
    setPromptDisplayModes((current) => ({ ...current, [activeTab]: mode }));
  }

  return (
    <section className="mt-4 space-y-4">
      <AdminAiRequestStatistics
        details={statistics}
        estimatedCost={preview.estimatedCost}
      />

      <div>
        <div
          role="tablist"
          aria-label="Dữ liệu gửi đến model"
          className="grid grid-cols-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
        >
          {previewTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "min-h-10 rounded-lg px-2 text-xs font-extrabold whitespace-nowrap transition sm:text-sm",
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
          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-[var(--theme-border)] px-3 py-2">
            <div className="ml-auto flex items-center gap-2">
              {activeTab !== "source" ? (
                <div
                  aria-label="Chế độ hiển thị prompt"
                  className="flex items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1"
                >
                  <button
                    type="button"
                    aria-pressed={isPromptPreview}
                    onClick={() => setPromptDisplayMode("PREVIEW")}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold whitespace-nowrap transition-colors",
                      isPromptPreview
                        ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                        : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Xem trước
                  </button>
                  <button
                    type="button"
                    aria-pressed={!isPromptPreview}
                    onClick={() => setPromptDisplayMode("MARKDOWN")}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-extrabold whitespace-nowrap transition-colors",
                      !isPromptPreview
                        ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                        : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Chỉnh sửa
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={copyVisibleContent}
                className="theme-button-primary-subtle inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold whitespace-nowrap"
              >
                {copiedTab === activeTab ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copiedTab === activeTab ? "Đã chép" : "Sao chép"}
              </button>
            </div>
          </div>

          {activeTab === "system" ? (
            isPromptPreview ? (
              <PromptMarkdownPreview content={systemInstructions} />
            ) : (
              <TextareaField
                id="video-summary-system-instructions"
                label="Markdown gốc — Quy tắc hệ thống"
                wrapperClassName="p-3"
                className="min-h-64 font-mono text-xs leading-5"
                value={systemInstructions}
                onChange={(event) =>
                  onSystemInstructionsChange(event.currentTarget.value)
                }
              />
            )
          ) : activeTab === "user" ? (
            isPromptPreview ? (
              <PromptMarkdownPreview content={userPrompt} />
            ) : (
              <TextareaField
                id="video-summary-user-prompt"
                label="Markdown gốc — Câu lệnh người dùng"
                wrapperClassName="p-3"
                className="min-h-64 font-mono text-xs leading-5"
                value={userPrompt}
                onChange={(event) => onUserPromptChange(event.currentTarget.value)}
              />
            )
          ) : (
            <AdminAiJsonInputViewer data={requestPayload} />
          )}
        </div>
      </div>

      <AdminPromptInputBreakdownDialog
        breakdown={tokenBreakdown}
        isOpen={isInputBreakdownDialogOpen}
        onClose={() => setIsInputBreakdownDialogOpen(false)}
      />
    </section>
  );
}

function PromptMarkdownPreview({ content }: { content: string }) {
  return (
    <div className="max-h-96 overflow-y-auto p-4">
      <MathpixMarkdownRenderer content={content} />
    </div>
  );
}

function buildRequestPayload({
  preview,
  sourceText,
  systemInstructions,
  userPrompt,
}: {
  preview: VideoSummaryPreview;
  sourceText: string;
  systemInstructions: string;
  userPrompt: string;
}) {
  return {
    model: preview.model.model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: sourceText },
          { type: "input_text", text: userPrompt },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: preview.schema.name,
        strict: true,
        schema: preview.schema.json,
      },
    },
    instructions: systemInstructions,
    ...(preview.model.reasoningEffort
      ? { reasoning: { effort: preview.model.reasoningEffort } }
      : preview.model.temperature === null
        ? {}
        : { temperature: preview.model.temperature }),
    ...(preview.model.maxOutputTokens === null
      ? {}
      : { max_output_tokens: preview.model.maxOutputTokens }),
  };
}

function resolveTokenBreakdown(
  preview: VideoSummaryPreview,
  values: {
    sourceText: string;
    systemInstructions: string;
    userPrompt: string;
  },
) {
  const existing = preview.model.inputTokenEstimate.tokenBreakdown;
  return {
    systemInstructionsTokens: estimateTextTokens(values.systemInstructions),
    userPromptTokens: estimateTextTokens(values.userPrompt),
    contextTokens: estimateTextTokens(values.sourceText),
    schemaTokens:
      existing?.schemaTokens ?? estimateTextTokens(JSON.stringify(preview.schema.json)),
    textInputTokens: preview.model.inputTokenEstimate.textInputTokens,
    pdfInputTokens: 0,
    estimatedTokens: preview.model.inputTokenEstimate.estimatedTokens,
  };
}

function estimateTextTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatProvider(value: string) {
  if (value.toUpperCase() === "OPENAI") return "OpenAI";
  if (value.toUpperCase() === "GEMINI") return "Gemini";
  return value;
}
