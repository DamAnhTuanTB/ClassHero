"use client";

import { ChevronDown, Copy, Eye, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import type { FieldError } from "react-hook-form";
import { toast } from "sonner";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import type { AdminFlashcardPromptPreview as PreviewData } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { cn } from "@/lib/utils";

type PromptTab = "system" | "user" | "input";
type PacketManifest = PreviewData["context"]["packet"]["manifest"];

export function AdminFlashcardPromptPreview({
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
  preview: PreviewData;
  reasoningEffort: string;
  systemInstructions: string;
  systemInstructionsError?: FieldError;
  temperature: string;
  userPrompt: string;
  userPromptError?: FieldError;
}) {
  const [editMode, setEditMode] = useState<Record<"system" | "user", boolean>>({ system: false, user: false });
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const effectiveModel = model || preview.openAiRequest.model || "";
  const capability = preview.configuration.modelOptions.find(
    (option) => option.model === effectiveModel,
  )?.capabilities?.aiConfiguration;
  const usesReasoningEffort = supportsReasoningEffort(effectiveModel, capability);
  const usesTemperature = supportsTemperature(effectiveModel, capability);
  const effectiveReasoningEffort = usesReasoningEffort
    ? reasoningEffort || preview.configuration.reasoningEffort || "Mặc định"
    : null;
  const effectiveTemperature = usesTemperature
    ? resolveTemperature(temperature, preview.configuration.temperature)
    : null;
  const content = activeTab === "system"
    ? systemInstructions || preview.systemPrompt
    : activeTab === "user"
      ? userPrompt || preview.userPrompt
      : JSON.stringify(preview.openAiRequest, null, 2);
  const tabs = [
    { value: "system", label: "Quy tắc hệ thống" },
    { value: "user", label: "Câu lệnh người dùng" },
    { value: "input", label: "Dữ liệu gửi đi" },
  ] as const;
  const editing = activeTab !== "input" && editMode[activeTab];
  const requestStatistics = [
    {
      label: "Model thực tế",
      value: preview.configuration.resolvedModel
        ? `${formatProvider(preview.configuration.resolvedProvider)} · ${preview.configuration.resolvedModel}`
        : model || "Chưa có model khả dụng",
    },
    ...(usesReasoningEffort
      ? [{ label: "Reasoning Effort", value: effectiveReasoningEffort ?? "Mặc định" }]
      : []),
    ...(usesTemperature
      ? [
          {
            label: "Temperature",
            value:
              effectiveTemperature === null ? "Mặc định" : String(effectiveTemperature),
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
        maxOutputTokens || preview.configuration.maxOutputTokens || 0,
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
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"><FileText className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">Nguồn PDF sẽ gửi AI</p>
            <p className="mt-0.5 text-sm font-bold text-[var(--theme-text-muted)]">
              {preview.context.documentCount.toLocaleString("vi-VN")} tài liệu · {preview.context.packet.pageCount.toLocaleString("vi-VN")} trang · {formatBytes(preview.context.packet.sizeBytes)}
            </p>
          </div>
        </div>
        {packetDocuments.length > 0 ? (
          <details className="group mt-3 border-t border-[var(--theme-border)] pt-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-extrabold text-[var(--theme-primary)] hover:bg-[var(--theme-primary-soft)] [&::-webkit-details-marker]:hidden">
              Chi tiết theo tài liệu
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
              {packetDocuments.map((document) => (
                <li key={document.id} className="flex items-start justify-between gap-3 rounded-lg bg-[var(--theme-bg-subtle)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]" title={document.title}>{document.title}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-[var(--theme-text-muted)]">Trang PDF gốc: {document.sourcePageRanges}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">{document.pageCount.toLocaleString("vi-VN")} trang</span>
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
        <div role="tablist" className="grid grid-cols-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1">
          {tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => onTabChange(tab.value)} className={cn("min-h-10 rounded-lg px-2 text-xs font-extrabold sm:text-sm", activeTab === tab.value ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm" : "text-[var(--theme-text-muted)]")}>{tab.label}</button>)}
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
          <div className="flex justify-end gap-2 border-b border-[var(--theme-border)] px-3 py-2">
            {activeTab !== "input" ? <button type="button" onClick={() => setEditMode((current) => ({ ...current, [activeTab]: !current[activeTab] }))} className="theme-button-primary-subtle inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-extrabold">{editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}{editing ? "Xem trước" : "Chỉnh sửa"}</button> : null}
            <button type="button" onClick={() => void navigator.clipboard.writeText(content).then(() => toast.success("Đã sao chép câu lệnh"))} className="theme-button-primary-subtle inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-extrabold"><Copy className="h-3.5 w-3.5" />Sao chép</button>
          </div>
          {activeTab === "input" ? <AdminAiJsonInputViewer data={preview.openAiRequest} /> : editing ? (
            <div className="p-3"><TextareaField id={`ai-flashcard-${activeTab}-prompt`} label={activeTab === "system" ? "Quy tắc hệ thống" : "Câu lệnh người dùng"} className="min-h-72 font-mono text-xs" value={activeTab === "system" ? systemInstructions : userPrompt} error={activeTab === "system" ? systemInstructionsError : userPromptError} onChange={(event) => activeTab === "system" ? onSystemInstructionsChange(event.currentTarget.value) : onUserPromptChange(event.currentTarget.value)} /></div>
          ) : <AdminAiPromptContentPreview kind={activeTab} content={content} />}
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

function resolveTemperature(selected: string, preview: number | null) {
  const value = selected.trim() ? Number(selected) : preview;
  return value !== null && Number.isFinite(value) ? value : null;
}

function estimateTextTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function formatProvider(provider: string | null) {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider ?? "Provider chưa xác định";
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
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
  const sorted = [...new Set(pageNumbers)].sort((left, right) => left - right);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const page of sorted.slice(1)) {
    if (previous !== undefined && page === previous + 1) {
      previous = page;
      continue;
    }
    if (start !== undefined && previous !== undefined) {
      ranges.push(start === previous ? String(start) : `${start}–${previous}`);
    }
    start = page;
    previous = page;
  }
  if (start !== undefined && previous !== undefined) {
    ranges.push(start === previous ? String(start) : `${start}–${previous}`);
  }
  return ranges.join(", ");
}
