"use client";

import {
  BookOpen,
  Bot,
  CircleDollarSign,
  Clock3,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import type { AiChatMessage } from "@/features/ai-chat/types/ai-chat-types";
import { cn } from "@/lib/utils";

export function AiChatMessageBubble({
  message,
  onInspect,
  showAllPolicyLabels = false,
}: {
  message: AiChatMessage;
  onInspect?: (assistantMessageId: string) => void;
  showAllPolicyLabels?: boolean;
}) {
  const isUser = message.role === "USER";
  const shouldShowPolicyLabel =
    !isUser && (message.responsePolicy === "HINT_ONLY" || showAllPolicyLabels);
  const policyLabel =
    message.responsePolicy === "HINT_ONLY"
      ? showAllPolicyLabels
        ? "HINT_ONLY · AI chỉ gợi ý, không nêu hoặc xác nhận đáp án"
        : "Chế độ gợi ý · Không tiết lộ đáp án"
      : message.responsePolicy === "FULL_ANSWER"
        ? "FULL_ANSWER · AI được phép nêu đáp án và giải thích đầy đủ"
        : "BLOCKED · AI không nhận câu hỏi và không trả lời";
  return (
    <article className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
          <Bot className="h-4 w-4" />
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[84%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "rounded-br-md bg-blue-600 font-semibold text-white"
            : message.status === "FAILED"
              ? "rounded-bl-md border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              : "rounded-bl-md border border-sky-100 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
        )}
        data-message-role={message.role.toLowerCase()}
        data-message-status={message.status}
      >
        {message.attachments.length > 0 ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {message.attachments.map((attachment) =>
              attachment.url ? (
                <img
                  key={attachment.id}
                  src={attachment.url}
                  alt={attachment.name}
                  className="max-h-44 w-full rounded-xl object-cover"
                />
              ) : null,
            )}
          </div>
        ) : null}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : message.text ? (
          <MathpixMarkdownRenderer content={message.text} className="text-sm leading-6" />
        ) : (
          <span className="inline-flex items-center gap-2 font-bold text-blue-600 dark:text-sky-300">
            <Loader2 className="h-4 w-4 animate-spin" /> AI đang suy nghĩ...
          </span>
        )}
        {shouldShowPolicyLabel ? (
          <p
            className={cn(
              "mt-2 border-t border-sky-100 pt-2 text-[10px] font-black uppercase tracking-wide dark:border-slate-700",
              message.responsePolicy === "HINT_ONLY"
                ? "text-amber-700 dark:text-amber-300"
                : message.responsePolicy === "FULL_ANSWER"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300",
            )}
          >
            {policyLabel}
          </p>
        ) : null}
        {!isUser && (message.sources.length > 0 || message.turnMetrics) ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-sky-100 pt-2 dark:border-slate-700">
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((source) => (
                <span
                  key={`${source.learningPathId}:${source.lessonId}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-800 dark:bg-slate-900 dark:text-sky-300"
                  title={source.learningPathTitle}
                >
                  <BookOpen className="h-3 w-3" />
                  {source.lessonTitle}
                </span>
              ))}
            </div>
            {message.turnMetrics ? (
              <dl
                aria-label="Số liệu lượt phản hồi"
                className="ml-auto flex flex-wrap items-center justify-end gap-1.5"
              >
                <TurnMetric
                  label="Chi phí"
                  value={formatVnd(message.turnMetrics.totalCostVnd)}
                  icon={CircleDollarSign}
                />
                <TurnMetric
                  label="TTFT"
                  value={formatMilliseconds(message.turnMetrics.timeToFirstTokenMs)}
                  icon={Sparkles}
                />
                <TurnMetric
                  label="Tổng thời gian"
                  value={formatMilliseconds(message.turnMetrics.responseLatencyMs)}
                  icon={Clock3}
                />
              </dl>
            ) : null}
          </div>
        ) : null}
        {!isUser && onInspect && message.status !== "GENERATING" ? (
          <button
            type="button"
            onClick={() => onInspect(message.id)}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-bold text-[var(--theme-text-strong)] hover:bg-[var(--theme-surface-soft)]"
          >
            <Eye className="h-3.5 w-3.5" />
            Xem input &amp; chi phí
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TurnMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      <Icon className="h-3 w-3 text-sky-600 dark:text-sky-300" />
      <dt>{label}</dt>
      <dd className="font-extrabold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")} VNĐ`;
}

function formatMilliseconds(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("vi-VN")} ms`;
}
