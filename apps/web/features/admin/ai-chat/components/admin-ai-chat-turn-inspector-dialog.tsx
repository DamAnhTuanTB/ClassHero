"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  CircleDollarSign,
  Clock3,
  Eye,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { AdminAiChatProviderInputPreview } from "@/features/admin/ai-chat/components/admin-ai-chat-provider-input-preview";
import type { AdminAiChatTurnTrace } from "@/features/admin/ai-chat/types/admin-ai-chat-types";
import { formatVnd } from "@/features/admin/ai-settings/utils/provider-operations-formatters";

export function AdminAiChatTurnInspectorDialog({
  trace,
  isOpen,
  isLoading,
  isError,
  onClose,
  onRetry,
}: {
  trace?: AdminAiChatTurnTrace;
  isOpen: boolean;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
  onRetry: () => unknown;
}) {
  const responseTokenUsage = trace ? getResponseTokenUsage(trace) : null;

  return (
    <EditorDialogShell
      ariaLabel="Chi tiết input và chi phí lượt chat"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-6xl"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
        <h2 className="flex items-center gap-2 truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
          <Eye className="h-5 w-5 shrink-0 text-[var(--theme-primary)]" />
          Chi tiết input &amp; chi phí
        </h2>
      </header>

      <div
        id="admin-ai-chat-turn-inspector"
        className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"
      >
        {isLoading && !trace ? (
          <div className="grid min-h-72 place-items-center text-[var(--theme-primary)]">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : isError ? (
          <div className="grid min-h-72 place-content-center text-center">
            <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
              Chưa tải được dữ liệu input và chi phí của lượt chat này.
            </p>
            <button
              type="button"
              onClick={() => void onRetry()}
              className="theme-button-neutral mx-auto mt-4 min-h-10 rounded-lg px-4 text-sm font-bold"
            >
              Thử tải lại
            </button>
          </div>
        ) : trace ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
              <Metric
                label="Tổng chi phí"
                value={formatVnd(trace.aggregate.totalCostVnd)}
                icon={CircleDollarSign}
              />
              <Metric
                label="Độ trễ phản hồi"
                value={
                  trace.generation.latencyMs == null
                    ? "—"
                    : `${trace.generation.latencyMs.toLocaleString("vi-VN")} ms`
                }
                icon={Clock3}
              />
              <Metric
                label="TTFT"
                value={
                  trace.aggregate.timeToFirstTokenMs == null
                    ? "—"
                    : `${trace.aggregate.timeToFirstTokenMs.toLocaleString("vi-VN")} ms`
                }
                icon={Sparkles}
              />
              <Metric
                label="Token đầu vào"
                value={(responseTokenUsage?.input ?? 0).toLocaleString("vi-VN")}
                icon={ArrowDownToLine}
              />
              <Metric
                label="Token đầu ra"
                value={(responseTokenUsage?.output ?? 0).toLocaleString("vi-VN")}
                icon={ArrowUpFromLine}
              />
              <Metric
                label="Tổng token"
                value={trace.aggregate.totalTokens.toLocaleString("vi-VN")}
                icon={SlidersHorizontal}
              />
              <Metric
                label="Provider calls"
                value={String(trace.aggregate.callCount)}
                icon={Bot}
              />
            </div>

            <AdminAiChatProviderInputPreview
              provider={trace.generation.provider}
              providerRequest={trace.providerRequest}
            />

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.85fr)]">
              <TraceSection
                title="Input gửi provider"
                value={trace.providerRequest}
                defaultOpen
                tall
              />
              <div className="min-w-0 space-y-4">
                <TraceSection
                  title="Cấu hình hiệu lực"
                  value={trace.effectiveConfiguration}
                  defaultOpen
                />
                <TraceSection
                  title="Phạm vi snapshot"
                  value={trace.scopeSnapshot}
                  defaultOpen
                />
              </div>
            </div>

            <section>
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                Usage theo operation
              </h3>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                {trace.usageEvents.map((event) => (
                  <div
                    key={event.id}
                    className="min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong className="break-words text-[var(--theme-text-strong)]">
                        {event.operation ?? "PROVIDER_CALL"}
                      </strong>
                      <span className="shrink-0 font-extrabold text-[var(--theme-primary)]">
                        {formatVnd(event.costVnd)}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-[var(--theme-text-muted)]">
                      {event.provider} · {event.model ?? "—"} ·{" "}
                      {event.totalTokens.toLocaleString("vi-VN")} token ·{" "}
                      {event.latencyMs == null
                        ? "—"
                        : `${event.latencyMs.toLocaleString("vi-VN")} ms`}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-[var(--theme-text-muted)]">
                      Request ID: {event.providerRequestId ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
        <button
          type="button"
          onClick={onClose}
          className="theme-button-primary min-h-11 rounded-lg px-6 font-extrabold"
        >
          Đóng
        </button>
      </footer>
    </EditorDialogShell>
  );
}

function TraceSection({
  title,
  value,
  defaultOpen = false,
  tall = false,
}: {
  title: string;
  value: unknown;
  defaultOpen?: boolean;
  tall?: boolean;
}) {
  return (
    <details
      className="min-w-0 overflow-hidden rounded-lg border border-[var(--theme-border)]"
      open={defaultOpen}
    >
      <summary className="cursor-pointer bg-[var(--theme-surface-soft)] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-strong)]">
        {title}
      </summary>
      <pre
        className={`${tall ? "max-h-[34rem]" : "max-h-64"} overflow-auto border-t border-[var(--theme-border)] bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100`}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Bot;
}) {
  return (
    <div
      aria-label={label}
      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4"
      role="group"
    >
      <Icon className="h-4 w-4 text-[var(--theme-primary)]" />
      <p className="mt-2 text-[10px] font-extrabold uppercase text-[var(--theme-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-base font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}

function getResponseTokenUsage(trace: AdminAiChatTurnTrace) {
  const responseEvent = trace.usageEvents.find(
    (event) => event.operation === "CHAT_RESPONSE_GENERATION",
  );
  return {
    input: trace.generation.promptTokens ?? responseEvent?.promptTokens ?? 0,
    output: trace.generation.completionTokens ?? responseEvent?.completionTokens ?? 0,
  };
}
