"use client";

import { Loader2, WandSparkles, X } from "lucide-react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { TextareaField } from "@/components/common/forms/textarea-field";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import { AdminPromptInputBreakdownDialog } from "@/features/admin/ai-generation/components/admin-prompt-input-breakdown-dialog";
import type {
  AdminQuizAssessmentKind,
  AdminQuizFigure,
  AdminQuizFigureRefinementPreview,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { useAdminQuizFigureMutations } from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

type RequestPreviewTab = "system" | "user" | "input";

const MAX_ADMIN_INSTRUCTIONS_LENGTH = 2_000;

function normalizeAdminInstructions(value: string) {
  return value.trim() || null;
}

const REQUEST_PREVIEW_TABS: Array<{ value: RequestPreviewTab; label: string }> = [
  { value: "system", label: "Quy tắc hệ thống" },
  { value: "user", label: "Dữ kiện hình vẽ" },
  { value: "input", label: "Request OpenAI" },
];

export function AdminQuizFigureRefinementDialog({
  assessmentKind,
  figure,
  isOpen,
  onClose,
  questionId,
  setId,
}: {
  assessmentKind: AdminQuizAssessmentKind;
  figure: AdminQuizFigure;
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  setId: string;
}) {
  const mutations = useAdminQuizFigureMutations(setId, assessmentKind);
  const previewMutation = mutations.previewRefinement;
  const mutatePreview = previewMutation.mutateAsync;
  const resetPreview = previewMutation.reset;
  const [isMounted, setIsMounted] = useState(false);
  const [isInputBreakdownDialogOpen, setIsInputBreakdownDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AdminQuizFigureRefinementPreview | null>(
    null,
  );
  const [adminInstructions, setAdminInstructions] = useState("");
  const [previewedAdminInstructions, setPreviewedAdminInstructions] = useState<
    string | null
  >(null);
  const [requestPreviewTab, setRequestPreviewTab] = useState<RequestPreviewTab>("user");

  const normalizedAdminInstructions = normalizeAdminInstructions(adminInstructions);
  const isPreviewStale =
    previewData !== null && previewedAdminInstructions !== normalizedAdminInstructions;

  const loadPreview = useCallback(
    async (instructions: string) => {
      const normalizedInstructions = normalizeAdminInstructions(instructions);
      try {
        const data = await mutatePreview({
          questionId,
          figure,
          adminInstructions: normalizedInstructions,
        });
        setPreviewData(data);
        setPreviewedAdminInstructions(normalizedInstructions);
      } catch (error) {
        toast.error(
          getUserFacingErrorMessage(error, "Không tải được dữ liệu tinh chỉnh."),
        );
      }
    },
    [figure, mutatePreview, questionId],
  );

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    if (!isOpen) return;
    setPreviewData(null);
    setAdminInstructions("");
    setPreviewedAdminInstructions(null);
    setRequestPreviewTab("user");
    resetPreview();
    void loadPreview("");
  }, [figure.id, isOpen, resetPreview]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mutations.refineWithAi.isPending) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, mutations.refineWithAi.isPending, onClose]);

  async function execute() {
    if (isPreviewStale) {
      toast.warning(
        "Yêu cầu bổ sung đã thay đổi. Hãy cập nhật dữ liệu trước khi thực hiện.",
      );
      return;
    }
    try {
      await mutations.refineWithAi.mutateAsync({
        questionId,
        figure,
        adminInstructions: normalizedAdminInstructions,
      });
      toast.success("Đã bắt đầu tinh chỉnh hình bằng AI.");
      onClose();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa thể tinh chỉnh hình bằng AI."));
    }
  }

  if (!isMounted || !isOpen) return null;

  return createPortal(
    <div className="theme-dialog-overlay fixed inset-0 z-[80] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6">
      <button
        aria-label="Đóng modal tinh chỉnh hình"
        className="absolute inset-0 cursor-default"
        disabled={mutations.refineWithAi.isPending}
        onClick={onClose}
        type="button"
      />
      <section
        aria-label="Tinh chỉnh hình bằng AI"
        aria-modal="true"
        className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
        role="dialog"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--theme-text-strong)]">
              <WandSparkles className="h-5 w-5 text-[var(--theme-primary)]" />
              Tinh chỉnh hình bằng AI
            </h2>
            <p className="line-clamp-1 text-xs text-[var(--theme-text-muted)]">
              Kiểm tra dữ kiện và chi phí trước khi gọi model.
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            disabled={mutations.refineWithAi.isPending}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
            AI sẽ đối chiếu yêu cầu vẽ ban đầu với source TikZ và ảnh hiện tại. Nếu hình
            sai hoặc vô lý, AI có thể dựng lại toàn bộ source; kết quả chỉ thay ảnh hiện
            hành sau khi biên dịch và kiểm tra thành công.
          </div>

          <section>
            <TextareaField
              disabled={mutations.refineWithAi.isPending}
              helperText={`${adminInstructions.length.toLocaleString("vi-VN")}/${MAX_ADMIN_INSTRUCTIONS_LENGTH.toLocaleString("vi-VN")} ký tự. Nội dung này ưu tiên phần cần kiểm tra nhưng không thay đổi dữ kiện gốc.`}
              id={`quiz-figure-refinement-admin-instructions-${figure.id}`}
              isOptional
              label="1. Yêu cầu bổ sung của admin"
              maxLength={MAX_ADMIN_INSTRUCTIONS_LENGTH}
              onChange={(event) => setAdminInstructions(event.target.value)}
              placeholder="Ví dụ: Sửa vị trí nhãn để không chồng nét, giữ nguyên các phần đang đúng."
              value={adminInstructions}
            />
            {isPreviewStale ? (
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
                <p>Dữ liệu xem trước chưa bao gồm yêu cầu bổ sung mới nhất.</p>
                <button
                  className="theme-button-neutral min-h-10 shrink-0 rounded-lg px-4 font-extrabold"
                  disabled={previewMutation.isPending || mutations.refineWithAi.isPending}
                  onClick={() => void loadPreview(adminInstructions)}
                  type="button"
                >
                  Cập nhật dữ liệu
                </button>
              </div>
            ) : null}
          </section>

          {previewMutation.isPending ? (
            <div className="grid min-h-72 place-items-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--theme-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Đang chuẩn bị dữ liệu và ước tính chi phí…
              </div>
            </div>
          ) : previewMutation.error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-bold">
                {getUserFacingErrorMessage(
                  previewMutation.error,
                  "Không tải được dữ liệu tinh chỉnh.",
                )}
              </p>
              <button
                className="theme-button-neutral mt-3 min-h-10 rounded-lg px-4 font-extrabold"
                onClick={() => void loadPreview(adminInstructions)}
                type="button"
              >
                Thử lại
              </button>
            </div>
          ) : previewData ? (
            <>
              <section>
                <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  2. Ảnh render hiện tại gửi cho AI
                </h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white p-3">
                  <Image
                    alt={figure.currentRevision?.altText ?? "Ảnh hiện tại"}
                    className="mx-auto max-h-80 w-auto object-contain"
                    height={800}
                    src={previewData.currentImageDataUrl}
                    unoptimized
                    width={1200}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  3. Model và chi phí dự tính
                </h3>
                <div className="mt-3">
                  <AdminAiRequestStatistics
                    details={buildRequestStatistics(previewData, () =>
                      setIsInputBreakdownDialogOpen(true),
                    )}
                    estimatedCost={previewData.estimatedCost}
                    note="Mở modal và xem trước không gọi provider trả phí. Chi phí thực tế chỉ phát sinh sau khi bấm Thực hiện và có thể thấp hơn mức tối đa."
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                  4. Dữ liệu gửi đến OpenAI
                </h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
                  <div
                    aria-label="Dữ liệu gửi đến model"
                    className="grid grid-cols-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
                    role="tablist"
                  >
                    {REQUEST_PREVIEW_TABS.map((tab) => (
                      <button
                        aria-selected={requestPreviewTab === tab.value}
                        className={cn(
                          "min-h-10 rounded-lg px-2 text-xs font-extrabold transition sm:text-sm",
                          requestPreviewTab === tab.value
                            ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                            : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                        )}
                        key={tab.value}
                        onClick={() => setRequestPreviewTab(tab.value)}
                        role="tab"
                        type="button"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div role="tabpanel">
                    {requestPreviewTab === "input" ? (
                      <AdminAiJsonInputViewer data={previewData.providerInput} />
                    ) : (
                      <AdminAiPromptContentPreview
                        content={
                          requestPreviewTab === "system"
                            ? previewData.systemPrompt
                            : previewData.userPrompt
                        }
                        kind={requestPreviewTab}
                      />
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>

        <footer className="theme-dialog-footer flex shrink-0 flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            className="theme-button-neutral min-h-11 rounded-lg px-5 text-sm font-extrabold"
            disabled={mutations.refineWithAi.isPending}
            onClick={onClose}
            type="button"
          >
            Hủy
          </button>
          <button
            className="theme-button-primary flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
            disabled={
              !previewData ||
              isPreviewStale ||
              previewMutation.isPending ||
              mutations.refineWithAi.isPending
            }
            onClick={() => void execute()}
            type="button"
          >
            {mutations.refineWithAi.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
            )}
            Thực hiện
          </button>
        </footer>
      </section>

      {previewData?.context.tokenBreakdown ? (
        <AdminPromptInputBreakdownDialog
          breakdown={previewData.context.tokenBreakdown}
          isOpen={isInputBreakdownDialogOpen}
          onClose={() => setIsInputBreakdownDialogOpen(false)}
        />
      ) : null}
    </div>,
    document.body,
  );
}

function buildRequestStatistics(
  preview: AdminQuizFigureRefinementPreview,
  onTokenBreakdownClick?: () => void,
) {
  return [
    {
      label: "Model thực tế",
      value: preview.configuration.resolvedModel
        ? `${formatProvider(preview.configuration.resolvedProvider)} · ${preview.configuration.resolvedModel}`
        : "Chưa có model khả dụng",
    },
    ...(preview.configuration.reasoningEffort
      ? [
          {
            label: "Reasoning Effort",
            value: preview.configuration.reasoningEffort,
          },
        ]
      : preview.configuration.temperature !== null
        ? [
            {
              label: "Temperature",
              value: preview.configuration.temperature.toString(),
            },
          ]
        : []),
    {
      label: "Giới hạn đầu ra",
      value: `${(preview.configuration.maxOutputTokens ?? 0).toLocaleString("vi-VN")} token`,
    },
    {
      label: "Text input ước tính",
      value: `${preview.context.textInputTokens.toLocaleString("vi-VN")} token`,
      onClick: preview.context.tokenBreakdown ? onTokenBreakdownClick : undefined,
    },
    {
      label: "Ảnh input ước tính",
      value: `${preview.context.imageInputTokens.toLocaleString("vi-VN")} token`,
    },
    {
      label: "Tổng input ước tính",
      value: `${preview.context.estimatedTokens.toLocaleString("vi-VN")} token`,
    },
  ];
}

function formatProvider(provider: string | null) {
  if (!provider) return "Provider chưa xác định";
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  return provider;
}
