"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw, WandSparkles } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { QuizExplanationCard } from "@/components/common/content/quiz-explanation-content";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { AdminAiJsonInputViewer } from "@/features/admin/ai-generation/components/admin-ai-json-input-viewer";
import { AdminAiPromptContentPreview } from "@/features/admin/ai-generation/components/admin-ai-prompt-content-preview";
import { AdminAiRequestStatistics } from "@/features/admin/ai-generation/components/admin-ai-request-statistics";
import type {
  AdminQuizSolutionMode,
  AdminQuizSolutionRefinementPreview,
} from "@/features/admin/quiz/api/admin-quiz-api";
import {
  useAdminQuizSolutionRefinement,
  useAdminQuizSolutionRefinementJob,
} from "@/features/admin/quiz/hooks/use-admin-quiz-solution-refinement";
import {
  adminQuizSolutionRefinementSchema,
  type AdminQuizSolutionRefinementFormValues,
} from "@/features/admin/quiz/schemas/admin-quiz-solution-refinement-schema";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

type RequestPreviewTab = "system" | "user" | "input";

const REQUEST_PREVIEW_TABS: Array<{ value: RequestPreviewTab; label: string }> = [
  { value: "system", label: "Quy tắc hệ thống" },
  { value: "user", label: "Dữ liệu câu Quiz" },
  { value: "input", label: "Request OpenAI" },
];

export function AdminQuizSolutionRefinementDialog({
  assessmentKind,
  isOpen,
  currentSolution,
  mode,
  onClose,
  questionId,
  setId,
}: {
  assessmentKind: "quiz" | "test";
  isOpen: boolean;
  currentSolution: string;
  mode: AdminQuizSolutionMode;
  onClose: () => void;
  questionId: string;
  setId: string;
}) {
  const refinement = useAdminQuizSolutionRefinement(setId, assessmentKind);
  const {
    isPending: isPreviewPending,
    mutateAsync: previewAsync,
    reset: resetPreview,
  } = refinement.preview;
  const { isPending: isQueuePending, mutateAsync: queueAsync } = refinement.queue;
  const invalidateQuestion = refinement.invalidateQuestion;
  const [preview, setPreview] = useState<AdminQuizSolutionRefinementPreview | null>(null);
  const [previewInputKey, setPreviewInputKey] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<RequestPreviewTab>("user");
  const [jobId, setJobId] = useState<string | null>(null);
  const [includeCurrentSolutionAsRejected, setIncludeCurrentSolutionAsRejected] =
    useState(false);
  const handledJobIdRef = useRef<string | null>(null);
  const previewRequestSequenceRef = useRef(0);
  const jobQuery = useAdminQuizSolutionRefinementJob(jobId);
  const form = useForm<AdminQuizSolutionRefinementFormValues>({
    resolver: zodResolver(adminQuizSolutionRefinementSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { adminInstructions: "" },
  });
  const adminInstructions = useWatch({
    control: form.control,
    name: "adminInstructions",
  });
  const currentInputKey = createInputKey(
    adminInstructions,
    includeCurrentSolutionAsRejected,
  );
  const isJobActive =
    jobQuery.data?.status === "QUEUED" || jobQuery.data?.status === "RUNNING";
  const isBusy = isQueuePending || isJobActive;
  const isPreviewStale = previewInputKey !== currentInputKey;

  const closeDialog = useCallback(() => {
    previewRequestSequenceRef.current += 1;
    onClose();
  }, [onClose]);

  const refreshPreview = useCallback(
    async (values: AdminQuizSolutionRefinementFormValues, includeRejected: boolean) => {
      const requestSequence = previewRequestSequenceRef.current + 1;
      previewRequestSequenceRef.current = requestSequence;
      try {
        const data = await previewAsync({
          questionId,
          mode,
          adminInstructions: values.adminInstructions.trim(),
          includeCurrentSolutionAsRejected: includeRejected,
        });
        if (requestSequence !== previewRequestSequenceRef.current) return;
        setPreview(data);
        setPreviewInputKey(createInputKey(values.adminInstructions, includeRejected));
      } catch (error) {
        if (requestSequence !== previewRequestSequenceRef.current) return;
        toast.error(
          getUserFacingErrorMessage(error, "Không tải được dữ liệu tinh chỉnh lời giải."),
        );
      }
    },
    [mode, previewAsync, questionId],
  );

  useEffect(() => {
    if (!isOpen) return;
    previewRequestSequenceRef.current += 1;
    form.reset({ adminInstructions: "" });
    setIncludeCurrentSolutionAsRejected(false);
    setPreview(null);
    setPreviewInputKey(null);
    setPreviewTab("user");
    resetPreview();
    void refreshPreview({ adminInstructions: "" }, false);
  }, [isOpen, resetPreview]);

  useEffect(() => {
    const job = jobQuery.data;
    if (!job || handledJobIdRef.current === job.jobId) return;
    if (job.status === "SUCCEEDED") {
      handledJobIdRef.current = job.jobId;
      void invalidateQuestion();
      toast.success(
        mode === "REFINE"
          ? "Đã tinh chỉnh lời giải bằng AI. Câu Quiz cần được duyệt lại."
          : "Đã tạo lại đáp án, gợi ý và lời giải. Câu Quiz cần được duyệt lại.",
      );
      closeDialog();
    } else if (job.status === "FAILED" || job.status === "CANCELLED") {
      handledJobIdRef.current = job.jobId;
      toast.error(job.error || "Không thể hoàn tất tinh chỉnh lời giải bằng AI.");
    }
  }, [closeDialog, invalidateQuestion, jobQuery.data, mode]);

  async function execute(values: AdminQuizSolutionRefinementFormValues) {
    if (!preview || isPreviewStale) return;
    try {
      const job = await queueAsync({
        questionId,
        mode,
        adminInstructions: values.adminInstructions.trim(),
        includeCurrentSolutionAsRejected,
        requestHash: preview.requestHash,
      });
      setJobId(job.jobId);
      toast.success(
        mode === "REFINE"
          ? "Đã bắt đầu tinh chỉnh lời giải bằng AI."
          : "Đã bắt đầu tạo lại lời giải bằng AI.",
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa thể tinh chỉnh lời giải bằng AI."),
      );
    }
  }

  return (
    <EditorDialogShell
      ariaLabel={
        mode === "REFINE" ? "Tinh chỉnh lời giải bằng AI" : "Tạo lại lời giải bằng AI"
      }
      isOpen={isOpen}
      onClose={closeDialog}
      panelClassName="max-w-6xl"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(execute)}
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--theme-text-strong)]">
              <WandSparkles className="h-5 w-5 text-[var(--theme-primary)]" />
              {mode === "REFINE"
                ? "Tinh chỉnh lời giải bằng AI"
                : "Tạo lại lời giải bằng AI"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--theme-text-muted)]">
              {mode === "REFINE"
                ? "Làm rõ các bước và trình bày lời giải phù hợp hơn."
                : "Giải lại từ đầu và tạo đồng bộ đáp án, gợi ý, lời giải mới."}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
            {mode === "REFINE"
              ? "Hệ thống gửi đề, phương án hoặc mệnh đề, đáp án và lời giải hiện tại. AI chỉ tinh chỉnh lời giải; đề, đáp án và gợi ý được giữ nguyên."
              : includeCurrentSolutionAsRejected
                ? "Hệ thống gửi đề, phương án hoặc mệnh đề, hình đề nếu có và lời giải cũ đã được đánh dấu là mẫu sai cần tránh. Đáp án và gợi ý cũ vẫn được ẩn."
                : "Hệ thống gửi đề, phương án hoặc mệnh đề và hình đề hiện tại nếu có. AI không nhìn đáp án, gợi ý hay lời giải cũ; kết quả mới sẽ thay đồng bộ ba phần sau khi admin xác nhận."}
          </div>

          {mode === "REFINE" && currentSolution.trim() ? (
            <section aria-label="Xem trước lời giải hiện tại">
              <QuizExplanationCard
                block={{
                  type: "quizExplanation",
                  problem: "",
                  solution: currentSolution,
                }}
                label="Lời giải hiện tại"
                showProblem={false}
              />
            </section>
          ) : null}

          {mode === "REGENERATE" ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
              <input
                checked={includeCurrentSolutionAsRejected}
                className="mt-1 h-4 w-4"
                disabled={isBusy}
                onChange={(event) =>
                  setIncludeCurrentSolutionAsRejected(event.currentTarget.checked)
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                  Gửi lời giải hiện tại làm mẫu sai cần tránh
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                  Mặc định tắt. Khi bật, prompt ghi rõ lời giải cũ đã sai và chỉ dùng nó
                  để tránh lặp lại lỗi; đáp án và gợi ý cũ vẫn không được gửi.
                </span>
              </span>
            </label>
          ) : null}

          {mode === "REGENERATE" && preview?.questionImageDataUrl ? (
            <section>
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Hình đề gửi kèm để giải lại
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white p-3">
                <Image
                  alt="Hình đề Quiz gửi kèm OpenAI"
                  className="mx-auto max-h-80 w-auto object-contain"
                  height={800}
                  src={preview.questionImageDataUrl}
                  unoptimized
                  width={1200}
                />
              </div>
            </section>
          ) : null}

          <section>
            <TextareaField
              id={`quiz-solution-refinement-instructions-${questionId}`}
              label="Yêu cầu bổ sung"
              isOptional
              optionalLabel="Không bắt buộc"
              maxLength={2_000}
              disabled={isBusy}
              placeholder="Ví dụ: Giải thích kỹ bước biến đổi thứ hai và ưu tiên cách trình bày phù hợp học sinh lớp 8."
              error={form.formState.errors.adminInstructions}
              {...form.register("adminInstructions")}
            />
            <p className="mt-1 text-right text-xs text-[var(--theme-text-muted)]">
              {adminInstructions.length.toLocaleString("vi-VN")}/2.000 ký tự
            </p>
          </section>

          <div className="flex justify-end">
            <button
              className="theme-button-primary-subtle inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!form.formState.isValid || isPreviewPending || isBusy}
              onClick={() =>
                void form.handleSubmit((values) =>
                  refreshPreview(values, includeCurrentSolutionAsRejected),
                )()
              }
              type="button"
            >
              {isPreviewPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Cập nhật dữ liệu gửi AI
            </button>
          </div>

          {isPreviewPending && !preview ? (
            <div className="grid min-h-72 place-items-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--theme-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Đang dựng request và ước tính chi phí…
              </div>
            </div>
          ) : preview ? (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Dữ liệu gửi đến OpenAI
              </h3>
              {isPreviewStale ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Yêu cầu hoặc tùy chọn gửi mẫu sai đã thay đổi. Hãy cập nhật dữ liệu
                  trước khi thực hiện.
                </p>
              ) : null}
              <AdminAiRequestStatistics
                details={buildRequestStatistics(preview)}
                estimatedCost={preview.estimatedCost}
                note="Xem trước không gọi provider. Chi phí chỉ phát sinh sau khi admin bấm Thực hiện trong modal."
              />
              <div className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
                <div
                  aria-label="Dữ liệu gửi đến model"
                  className="grid grid-cols-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-1"
                  role="tablist"
                >
                  {REQUEST_PREVIEW_TABS.map((tab) => (
                    <button
                      aria-selected={previewTab === tab.value}
                      className={cn(
                        "min-h-10 rounded-lg px-2 text-xs font-extrabold transition sm:text-sm",
                        previewTab === tab.value
                          ? "bg-[var(--theme-bg)] text-[var(--theme-primary)] shadow-sm"
                          : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                      )}
                      key={tab.value}
                      onClick={() => setPreviewTab(tab.value)}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div role="tabpanel">
                  {previewTab === "input" ? (
                    <AdminAiJsonInputViewer data={preview.providerInput} />
                  ) : (
                    <AdminAiPromptContentPreview
                      content={
                        previewTab === "system"
                          ? preview.systemPrompt
                          : preview.userPrompt
                      }
                      kind={previewTab}
                    />
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {jobQuery.data && isJobActive ? (
            <p className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              {mode === "REFINE"
                ? "AI đang tinh chỉnh lời giải. Modal sẽ tự cập nhật khi hoàn tất."
                : "AI đang giải lại và tạo đáp án, gợi ý, lời giải mới. Modal sẽ tự cập nhật khi hoàn tất."}
            </p>
          ) : null}
        </div>

        <footer className="theme-dialog-footer flex shrink-0 flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
            onClick={closeDialog}
            type="button"
          >
            Hủy
          </button>
          <button
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !preview ||
              isPreviewStale ||
              !form.formState.isValid ||
              isPreviewPending ||
              isBusy
            }
            type="submit"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {isBusy
              ? mode === "REFINE"
                ? "Đang tinh chỉnh"
                : "Đang tạo lại"
              : "Thực hiện"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}

function createInputKey(value: string, includeCurrentSolutionAsRejected: boolean) {
  return JSON.stringify({
    adminInstructions: value.trim(),
    includeCurrentSolutionAsRejected,
  });
}

function buildRequestStatistics(preview: AdminQuizSolutionRefinementPreview) {
  return [
    {
      label: "Model",
      value: preview.configuration.resolvedModel || "Chưa cấu hình",
    },
    {
      label: "Provider",
      value: preview.configuration.resolvedProvider || "Chưa cấu hình",
    },
    {
      label: "Input ước tính",
      value: `${preview.context.estimatedTokens.toLocaleString("vi-VN")} token`,
    },
    {
      label: "Output tối đa",
      value:
        preview.configuration.maxOutputTokens === null
          ? "Theo giới hạn model"
          : `${preview.configuration.maxOutputTokens.toLocaleString("vi-VN")} token`,
    },
  ];
}
