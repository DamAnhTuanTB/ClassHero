"use client";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Files,
  MessageSquareText,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useState } from "react";

import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { cn } from "@/lib/utils";

type PreviewTab = "system" | "user" | "chunks";

type RagContextChunk = {
  order: number;
  chunkId: string;
  sourceType: string;
  learningPathTitle: string;
  lessonTitle: string;
  score: number | null;
  content: string;
  startSeconds: number | null;
  endSeconds: number | null;
};

export function AdminAiChatProviderInputPreview({
  provider,
  providerRequest,
}: {
  provider: string | null;
  providerRequest: unknown;
}) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("system");
  const preview = readProviderRequestPreview(providerRequest);
  const targetLabel = provider === "OPENAI" ? "OpenAI" : "model";
  const tabs: Array<{
    value: PreviewTab;
    label: string;
    icon: typeof ShieldCheck;
  }> = [
    { value: "system", label: "System prompt", icon: ShieldCheck },
    { value: "user", label: "User prompt", icon: MessageSquareText },
    {
      value: "chunks",
      label: `Context chunks (${preview.ragContext.length})`,
      icon: Files,
    },
  ];
  const activeLabel = tabs.find((tab) => tab.value === activeTab)?.label;

  return (
    <section
      aria-label={`Nội dung prompt và context gửi ${targetLabel}`}
      className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]"
      role="region"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
            Nội dung gửi {targetLabel}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
            Snapshot thực tế của lượt chat, đã định dạng để đọc và đối chiếu dễ hơn.
          </p>
        </div>
        <span className="inline-flex w-max shrink-0 items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-primary)]">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Chế độ xem trước
        </span>
      </div>

      <div
        aria-label={`Các phần nội dung gửi ${targetLabel}`}
        className="grid grid-cols-3 gap-1 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
        role="tablist"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              aria-controls="admin-ai-chat-provider-input-panel"
              aria-selected={activeTab === tab.value}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-extrabold transition sm:text-sm",
                activeTab === tab.value
                  ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
              )}
              id={`admin-ai-chat-provider-input-tab-${tab.value}`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              role="tab"
              type="button"
            >
              <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        aria-label={activeLabel}
        aria-labelledby={`admin-ai-chat-provider-input-tab-${activeTab}`}
        id="admin-ai-chat-provider-input-panel"
        role="tabpanel"
      >
        {activeTab === "system" ? (
          <PromptPreview
            content={preview.systemPrompt}
            emptyMessage="Không có system prompt trong snapshot của lượt chat này."
            kind="system"
          />
        ) : activeTab === "user" ? (
          <PromptPreview
            content={preview.userPrompt}
            emptyMessage="Không có user prompt trong snapshot của lượt chat này."
            kind="user"
          />
        ) : (
          <ContextChunksPreview chunks={preview.ragContext} />
        )}
      </div>
    </section>
  );
}

function PromptPreview({
  content,
  emptyMessage,
  kind,
}: {
  content: string;
  emptyMessage: string;
  kind: "system" | "user";
}) {
  if (!content) return <PreviewEmptyState message={emptyMessage} />;

  return <AdminAiPromptContentPreview content={content} kind={kind} />;
}

function ContextChunksPreview({ chunks }: { chunks: RagContextChunk[] }) {
  const [collapsedChunkKeys, setCollapsedChunkKeys] = useState<Set<string>>(
    () => new Set(),
  );

  if (chunks.length === 0) {
    return (
      <PreviewEmptyState message="Lượt chat này không gửi context chunk nào tới model." />
    );
  }

  return (
    <div className="max-h-[34rem] overflow-y-auto p-3 sm:p-4">
      <div className="space-y-3">
        {chunks.map((chunk, index) => {
          const isVideo = chunk.sourceType === "VIDEO_SUMMARY";
          const SourceIcon = isVideo ? Video : FileText;
          const videoRange = formatVideoRange(chunk);
          const chunkKey = `${chunk.chunkId}:${chunk.order}:${index}`;
          const isCollapsed = collapsedChunkKeys.has(chunkKey);
          return (
            <article
              className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]"
              key={chunkKey}
            >
              <header className="flex flex-col gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <SourceIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                        Chunk {index + 1}
                      </h4>
                      <button
                        aria-expanded={!isCollapsed}
                        aria-label={
                          isCollapsed
                            ? `Mở rộng Chunk ${index + 1}`
                            : `Thu gọn Chunk ${index + 1}`
                        }
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                        onClick={() =>
                          setCollapsedChunkKeys((current) => {
                            const next = new Set(current);
                            if (next.has(chunkKey)) next.delete(chunkKey);
                            else next.add(chunkKey);
                            return next;
                          })
                        }
                        type="button"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="mt-0.5 break-words text-xs leading-5 text-[var(--theme-text-muted)]">
                      {[chunk.learningPathTitle, chunk.lessonTitle]
                        .filter(Boolean)
                        .join(" · ") || "Không có nhãn nguồn"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--theme-text-muted)]">
                  <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                    {isVideo ? "Tóm tắt video" : "Tài liệu bài học"}
                  </span>
                  {videoRange ? (
                    <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                      {videoRange}
                    </span>
                  ) : null}
                  {chunk.score == null ? null : (
                    <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1">
                      Liên quan{" "}
                      {chunk.score.toLocaleString("vi-VN", {
                        maximumFractionDigits: 3,
                      })}
                    </span>
                  )}
                </div>
              </header>
              {isCollapsed ? null : (
                <div className="p-4">
                  <MathpixMarkdownRenderer content={chunk.content} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PreviewEmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-40 place-items-center px-4 py-8 text-center text-sm font-semibold text-[var(--theme-text-muted)]">
      {message}
    </div>
  );
}

function readProviderRequestPreview(value: unknown) {
  const request = isRecord(value) ? value : {};
  return {
    systemPrompt: readContent(request.systemPrompt),
    userPrompt: readContent(request.userPrompt),
    ragContext: Array.isArray(request.ragContext)
      ? request.ragContext.flatMap(readRagContextChunk)
      : [],
  };
}

function readRagContextChunk(value: unknown, index: number): RagContextChunk[] {
  if (!isRecord(value)) return [];
  const content = readContent(value.content);
  if (!content) return [];

  return [
    {
      order: readNumber(value.order) ?? index,
      chunkId: readString(value.chunkId) || `chunk-${index}`,
      sourceType: readString(value.sourceType),
      learningPathTitle: readString(value.learningPathTitle),
      lessonTitle: readString(value.lessonTitle),
      score: readNumber(value.score),
      content,
      startSeconds: readNumber(value.startSeconds),
      endSeconds: readNumber(value.endSeconds),
    },
  ];
}

function formatVideoRange(chunk: RagContextChunk) {
  const { startSeconds, endSeconds } = chunk;
  if (startSeconds == null && endSeconds == null) return null;
  if (startSeconds == null && endSeconds != null) {
    return `Đến ${formatDuration(endSeconds)}`;
  }
  if (endSeconds == null && startSeconds != null) {
    return `Từ ${formatDuration(startSeconds)}`;
  }
  if (startSeconds == null || endSeconds == null) return null;
  return `${formatDuration(startSeconds)}–${formatDuration(endSeconds)}`;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readContent(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
