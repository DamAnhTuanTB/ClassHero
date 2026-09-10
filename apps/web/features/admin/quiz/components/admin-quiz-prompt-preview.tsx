"use client";

import { Check, ChevronDown, Copy, Eye, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import type { FieldError } from "react-hook-form";
import { toast } from "sonner";

import { TextareaField } from "@/components/common/forms/textarea-field";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import type { AdminQuizPromptPreview } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { replaceOpenAiRequestPrompts } from "@/features/admin/ai-generation/utils/openai-request-preview";
import { cn } from "@/lib/utils";

type PromptTab = "system" | "user" | "input";
type PromptDisplayMode = "PREVIEW" | "MARKDOWN";
type PacketManifest = AdminQuizPromptPreview["context"]["packet"]["manifest"];

const promptTabs: Array<{ value: PromptTab; label: string }> = [
  { value: "system", label: "Quy tắc hệ thống" },
  { value: "user", label: "Câu lệnh người dùng" },
  { value: "input", label: "Dữ liệu gửi đi" },
];

export function AdminQuizPromptPreview({
  activeTab,
  maxOutputTokens,
  model,
  onSystemInstructionsChange,
  onTabChange,
  onUserPromptChange,
  preview,
  reasoningEffort,
  systemInstructions,
  systemInstructionsError,
  temperature,
  userPrompt,
  userPromptError,
}: {
  activeTab: PromptTab;
  maxOutputTokens: string;
  model: string;
  onSystemInstructionsChange: (value: string) => void;
  onTabChange: (tab: PromptTab) => void;
  onUserPromptChange: (value: string) => void;
  preview: AdminQuizPromptPreview;
  reasoningEffort: string;
  systemInstructions: string;
  systemInstructionsError?: FieldError;
  temperature: string;
  userPrompt: string;
  userPromptError?: FieldError;
}) {
  const [copiedTab, setCopiedTab] = useState<PromptTab | null>(null);
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const [promptDisplayModes, setPromptDisplayModes] = useState<
    Record<Exclude<PromptTab, "input">, PromptDisplayMode>
  >({ system: "PREVIEW", user: "PREVIEW" });
  const effectiveSystemInstructions = systemInstructions || preview.systemPrompt;
  const effectiveUserPrompt = userPrompt || preview.userPrompt;
  const {
    reasoning: previewReasoning,
    temperature: previewTemperature,
    ...baseRequest
  } = preview.openAiRequest;
  const effectiveModel = model || preview.openAiRequest.model || "";
  const capability = preview.configuration.modelOptions.find(
    (option) => option.model === effectiveModel,
  )?.capabilities?.aiConfiguration;
  const usesReasoningEffort = supportsReasoningEffort(effectiveModel, capability);
  const usesTemperature = supportsTemperature(effectiveModel, capability);
  const effectiveReasoningEffort = usesReasoningEffort
    ? reasoningEffort || previewReasoning?.effort
    : undefined;
  const effectiveTemperature = usesTemperature
    ? resolveRequestTemperature(temperature, previewTemperature)
    : undefined;
  const responseRequest = {
    ...replaceOpenAiRequestPrompts(baseRequest, {
      previewSystemPrompt: preview.systemPrompt,
      previewUserPrompt: preview.userPrompt,
      systemPrompt: effectiveSystemInstructions,
      userPrompt: effectiveUserPrompt,
    }),
    model: effectiveModel || null,
    ...(effectiveReasoningEffort
      ? { reasoning: { effort: effectiveReasoningEffort } }
      : effectiveTemperature === undefined
        ? {}
        : { temperature: effectiveTemperature }),
    max_output_tokens: Number(maxOutputTokens || preview.openAiRequest.max_output_tokens),
  };
  const promptValue =
    activeTab === "system"
      ? effectiveSystemInstructions
      : activeTab === "user"
        ? effectiveUserPrompt
        : JSON.stringify(responseRequest, null, 2);
  const promptDisplayMode = activeTab === "input" ? null : promptDisplayModes[activeTab];
  const isPromptPreview = promptDisplayMode === "PREVIEW";
  const tokenBreakdown = {
    systemInstructionsTokens: estimateTextTokens(preview.systemPrompt),
    userPromptTokens: estimateTextTokens(preview.userPrompt),
    contextTokens: preview.context.contextTokens,
    schemaTokens: preview.context.schemaTokens ?? 0,
    textInputTokens: preview.context.textInputTokens,
    pdfInputTokens: preview.context.pdfInputTokens,
    estimatedTokens: preview.context.estimatedTokens,
  };
  const packetDocuments = summarizePacketDocuments(preview.context.packet.manifest);
  const requestStatistics = [
    {
      label: "Model thực tế",
      value: preview.configuration.resolvedModel
        ? `${formatProvider(preview.configuration.resolvedProvider)} · ${preview.configuration.resolvedModel}`
        : "Chưa có model khả dụng",
    },
    ...(usesReasoningEffort
      ? [
          {
            label: "Reasoning Effort",
            value: effectiveReasoningEffort || "Mặc định",
          },
        ]
      : []),
    ...(usesTemperature
      ? [
          {
            label: "Temperature",
            value: String(
              effectiveTemperature ?? preview.configuration.temperature ?? "Mặc định",
            ),
          },
        ]
      : []),
    {
      label: "PDF vision",
      value: "detail=high · searchable",
    },
    {
      label: "Giới hạn đầu ra",
      value: `${Number(
        maxOutputTokens || preview.configuration.maxOutputTokens,
      ).toLocaleString("vi-VN")} token`,
    },
    {
      label: "Text input ước tính",
      value: `${preview.context.textInputTokens.toLocaleString("vi-VN")} token`,
      onClick: () => setIsInputBreakdownDialogOpen(true),
    },
    {
      label: "PDF input ước tính",
      value: `${preview.context.pdfInputTokens.toLocaleString("vi-VN")} token`,
    },
    {
      label: "Tổng input ước tính",
      value: `${preview.context.estimatedTokens.toLocaleString("vi-VN")} token`,
    },
  ];

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptValue);
      setCopiedTab(activeTab);
      window.setTimeout(() => setCopiedTab(null), 1_500);
      toast.success("Đã sao chép câu lệnh");
    } catch {
      toast.error("Chưa thể sao chép câu lệnh");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Nguồn PDF sẽ gửi AI
            </p>
            <p className="mt-0.5 text-sm font-bold text-[var(--theme-text-muted)]">
              {preview.context.documentCount.toLocaleString("vi-VN")} tài liệu
              <span aria-hidden="true"> · </span>
              {preview.context.packet.pageCount.toLocaleString("vi-VN")} trang
              <span aria-hidden="true"> · </span>
              {formatBytes(preview.context.packet.sizeBytes)}
            </p>
          </div>
        </div>

        {packetDocuments.length > 0 ? (
          <details className="group mt-3 border-t border-[var(--theme-border)] pt-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-extrabold text-[var(--theme-primary)] transition-colors hover:bg-[var(--theme-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] [&::-webkit-details-marker]:hidden">
              Chi tiết theo tài liệu
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
              {packetDocuments.map((document) => (
                <li
                  key={document.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-[var(--theme-bg-subtle)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]"
                      title={document.title}
                    >
                      {document.title}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs font-bold text-[var(--theme-text-muted)]"
                      title={`Trang PDF gốc: ${document.sourcePageRanges}`}
                    >
                      Trang PDF gốc: {document.sourcePageRanges}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
                    {document.pageCount.toLocaleString("vi-VN")} trang
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <AdminAiRequestStatistics
        details={requestStatistics}
        estimatedCost={preview.estimatedCost}
      />

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
          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-[var(--theme-border)] px-3 py-2">
            <div className="ml-auto flex items-center gap-2">
              {activeTab !== "input" ? (
                <div
                  aria-label="Chế độ hiển thị prompt"
                  className="flex items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1"
                >
                  <button
                    type="button"
                    aria-pressed={isPromptPreview}
                    onClick={() =>
                      setPromptDisplayModes((current) => ({
                        ...current,
                        [activeTab]: "PREVIEW",
                      }))
                    }
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-extrabold transition-colors",
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
                    onClick={() =>
                      setPromptDisplayModes((current) => ({
                        ...current,
                        [activeTab]: "MARKDOWN",
                      }))
                    }
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-extrabold transition-colors",
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
                onClick={copyPrompt}
                className="theme-button-primary-subtle inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold"
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
              <PromptMarkdownPreview content={effectiveSystemInstructions} />
            ) : (
              <TextareaField
                id="ai-quiz-system-prompt"
                label="Markdown gốc — Quy tắc hệ thống"
                wrapperClassName="p-3"
                className="min-h-64 font-mono text-xs leading-5"
                value={systemInstructions}
                error={systemInstructionsError}
                onChange={(event) =>
                  onSystemInstructionsChange(event.currentTarget.value)
                }
              />
            )
          ) : activeTab === "user" ? (
            isPromptPreview ? (
              <PromptMarkdownPreview content={effectiveUserPrompt} />
            ) : (
              <TextareaField
                id="ai-quiz-user-prompt"
                label="Markdown gốc — Câu lệnh người dùng"
                wrapperClassName="p-3"
                className="min-h-64 font-mono text-xs leading-5"
                value={userPrompt}
                error={userPromptError}
                onChange={(event) => onUserPromptChange(event.currentTarget.value)}
              />
            )
          ) : (
            <section
              aria-label="Request OpenAI Responses API"
              className="bg-[var(--theme-bg)]"
            >
              <AdminAiJsonInputViewer data={responseRequest} />
            </section>
          )}
        </div>
      </div>
      <AdminPromptInputBreakdownDialog
        breakdown={tokenBreakdown}
        isOpen={isInputBreakdownDialogOpen}
        onClose={() => setIsInputBreakdownDialogOpen(false)}
      />
    </div>
  );
}

function PromptMarkdownPreview({ content }: { content: string }) {
  return (
    <div
      data-testid="ai-prompt-markdown-preview"
      className="max-h-96 overflow-y-auto p-4"
    >
      <MathpixMarkdownRenderer content={content} />
    </div>
  );
}

function resolveRequestTemperature(
  selectedTemperature: string,
  previewTemperature: number | undefined,
) {
  const value = selectedTemperature.trim()
    ? Number(selectedTemperature)
    : previewTemperature;
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

function estimateTextTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function summarizePacketDocuments(manifest: PacketManifest) {
  const documents = new Map<
    string,
    {
      id: string;
      title: string;
      segmentOrder: number;
      sourcePageNumbers: number[];
    }
  >();

  for (const page of manifest.pages) {
    const current = documents.get(page.lessonDocumentId);
    if (current) {
      current.sourcePageNumbers.push(page.sourcePdfPageNumber);
      continue;
    }
    documents.set(page.lessonDocumentId, {
      id: page.lessonDocumentId,
      title: page.documentTitle,
      segmentOrder: page.segmentOrder,
      sourcePageNumbers: [page.sourcePdfPageNumber],
    });
  }

  return [...documents.values()]
    .sort((left, right) => left.segmentOrder - right.segmentOrder)
    .map((document) => ({
      id: document.id,
      title: document.title,
      pageCount: document.sourcePageNumbers.length,
      sourcePageRanges: formatPageRanges(document.sourcePageNumbers),
    }));
}

function formatPageRanges(pageNumbers: number[]) {
  const sortedPages = [...new Set(pageNumbers)].sort((left, right) => left - right);
  const ranges: string[] = [];
  let rangeStart = sortedPages[0];
  let previousPage = sortedPages[0];

  for (const pageNumber of sortedPages.slice(1)) {
    if (previousPage !== undefined && pageNumber === previousPage + 1) {
      previousPage = pageNumber;
      continue;
    }
    if (rangeStart !== undefined && previousPage !== undefined) {
      ranges.push(
        rangeStart === previousPage
          ? String(rangeStart)
          : `${rangeStart}–${previousPage}`,
      );
    }
    rangeStart = pageNumber;
    previousPage = pageNumber;
  }

  if (rangeStart !== undefined && previousPage !== undefined) {
    ranges.push(
      rangeStart === previousPage ? String(rangeStart) : `${rangeStart}–${previousPage}`,
    );
  }
  return ranges.join(", ");
}

function formatProvider(provider: string | null) {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider ?? "Provider chưa xác định";
}
