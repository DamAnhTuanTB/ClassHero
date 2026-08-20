"use client";

import { Braces, ImageIcon, ScrollText, Settings2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import type { AdminStemFigureProviderRequestSnapshotCollection } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { formatAiModelDisplayName } from "@/features/admin/ai-generation/utils/format-ai-model-display-name";

export function AdminStemFigureRequestDetailsDialog({
  caption,
  isOpen,
  onClose,
  snapshots,
}: {
  caption: string | null;
  isOpen: boolean;
  onClose: () => void;
  snapshots: AdminStemFigureProviderRequestSnapshotCollection | null;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => setIsMounted(true), []);
  useEffect(
    () => setActiveIndex(Math.max(0, (snapshots?.calls.length ?? 1) - 1)),
    [snapshots],
  );
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);
  if (!isMounted || !isOpen) return null;

  const calls = snapshots?.calls ?? [];
  const call = calls[activeIndex] ?? null;
  return createPortal(
    <div className="theme-dialog-overlay fixed inset-0 z-[80] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6">
      <button
        aria-label="Đóng thông tin input hình"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label="Thông tin chi tiết gửi lên OpenAI"
        aria-modal="true"
        className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
        role="dialog"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
              Thông tin chi tiết gửi lên OpenAI
            </h2>
            <p className="truncate text-xs text-[var(--theme-text-muted)]">
              {caption ?? "Hình STEM"} · snapshot bất biến theo từng lần gọi
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {call ? (
            <div className="space-y-5">
              {calls.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
                  {calls.map((item, index) => (
                    <button
                      aria-selected={index === activeIndex}
                      className={
                        index === activeIndex
                          ? "theme-button-primary min-h-10 shrink-0 rounded-lg px-3 text-xs font-extrabold"
                          : "theme-button-neutral min-h-10 shrink-0 rounded-lg px-3 text-xs font-extrabold"
                      }
                      key={item.idempotencyKey}
                      onClick={() => setActiveIndex(index)}
                      role="tab"
                      type="button"
                    >
                      Lần {index + 1} · {callKindLabel(item.callKind)}
                    </button>
                  ))}
                </div>
              ) : null}

              <section>
                <SectionTitle icon={Settings2} title="Cấu hình request thực tế" />
                <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Meta label="Provider" value={call.request.provider} />
                  <Meta
                    label="Model"
                    value={formatAiModelDisplayName(call.request.model)}
                  />
                  <Meta label="Loại gọi" value={callKindLabel(call.callKind)} />
                  <Meta label="Thứ tự gọi" value={String(call.callSequence)} />
                  <Meta label="Prompt version" value={call.request.promptVersion} />
                  <Meta label="Schema version" value={call.request.schemaVersion} />
                  <Meta
                    label="Reasoning effort"
                    value={call.request.reasoningEffort ?? "Không gửi"}
                  />
                  <Meta
                    label="Temperature"
                    value={call.request.temperature?.toString() ?? "Không gửi"}
                  />
                  <Meta
                    label="Max output tokens"
                    value={
                      call.request.maxOutputTokens?.toLocaleString("vi-VN") ?? "Không gửi"
                    }
                  />
                  <Meta label="Output name" value={call.request.outputName} />
                  <Meta label="Thời điểm lưu" value={formatDate(call.createdAt)} />
                  <Meta label="Idempotency key" value={call.idempotencyKey} />
                </dl>
              </section>

              <section>
                <SectionTitle icon={ImageIcon} title="Ảnh nguồn gửi kèm đúng thứ tự" />
                {call.referenceImages.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {call.referenceImages.map((image) => (
                      <article
                        className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
                        key={`${image.order}:${image.objectKey}`}
                      >
                        <div className="flex min-h-52 items-center justify-center bg-white p-3">
                          {image.accessUrl ? (
                            <img
                              alt={`Ảnh nguồn ${image.order + 1}: ${image.label}`}
                              className="max-h-72 w-auto max-w-full object-contain"
                              decoding="async"
                              loading="lazy"
                              src={image.accessUrl}
                            />
                          ) : (
                            <span className="text-sm text-slate-500">
                              Không tải được preview
                            </span>
                          )}
                        </div>
                        <dl className="space-y-1 border-t border-[var(--theme-border)] p-3 text-xs">
                          <ImageMeta label="Thứ tự" value={String(image.order + 1)} />
                          <ImageMeta label="Nhãn" value={image.label} />
                          <ImageMeta label="Nguồn" value={image.source} />
                          <ImageMeta
                            label="Trang packet"
                            value={String(image.packetPageNumber)}
                          />
                          <ImageMeta label="Detail" value={image.detail} />
                          <ImageMeta label="MIME" value={image.mimeType} />
                          <ImageMeta
                            label="Dung lượng"
                            value={
                              image.byteLength === null
                                ? "Không rõ"
                                : `${image.byteLength.toLocaleString("vi-VN")} byte`
                            }
                          />
                          <ImageMeta label="SHA-256 request" value={image.sha256} />
                          <ImageMeta label="Object key" value={image.objectKey} />
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4 text-sm text-[var(--theme-text-muted)]">
                    Lần gọi này không gửi ảnh nguồn.
                  </p>
                )}
              </section>

              <section>
                <SectionTitle icon={ScrollText} title="Prompt và dữ liệu chuyên môn" />
                <JsonPanel label="System prompt" value={call.request.systemPrompt} />
                <JsonPanel label="User prompt" value={call.request.userPrompt} />
                <JsonPanel label="Generation brief đầy đủ" value={call.generationBrief} />
                {call.latexSource ? (
                  <JsonPanel label="Mã TikZ trước khi sửa" value={call.latexSource} />
                ) : null}
                {call.diagnosticBatch ? (
                  <JsonPanel
                    label="Toàn bộ compiler/validator diagnostics gửi lên"
                    value={call.diagnosticBatch}
                  />
                ) : null}
              </section>

              <section>
                <SectionTitle icon={Braces} title="Output schema và request JSON" />
                <JsonPanel label="JSON Schema thực tế" value={call.request.textFormat} />
                <JsonPanel label="Toàn bộ request trace" value={call.request} />
              </section>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--theme-border)] p-8 text-center">
              <p className="font-extrabold text-[var(--theme-text-strong)]">
                Chưa có snapshot request
              </p>
              <p className="mt-2 text-sm text-[var(--theme-text-muted)]">
                Hình chưa thực hiện lần gọi OpenAI nào sau khi cơ chế truy vết được bật.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Braces; title: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
      <Icon className="h-4 w-4 text-[var(--theme-primary)]" aria-hidden="true" />
      {title}
    </h3>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
      <dt className="text-xs font-bold text-[var(--theme-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </dd>
    </div>
  );
}

function ImageMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <dt className="font-bold text-[var(--theme-text-muted)]">{label}</dt>
      <dd className="break-all text-[var(--theme-text-strong)]">{value}</dd>
    </div>
  );
}

function JsonPanel({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="mb-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
        {label}
      </summary>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--theme-border)] bg-slate-950 p-3 text-xs leading-5 text-slate-100">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function callKindLabel(value: "CREATE_NEW" | "COMPILER_REPAIR" | "VALIDATOR_REPAIR") {
  return {
    CREATE_NEW: "Tạo hình mới",
    COMPILER_REPAIR: "Sửa lỗi compiler",
    VALIDATOR_REPAIR: "Sửa lỗi validator",
  }[value];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}
