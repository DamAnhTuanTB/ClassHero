"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAiReasoningEffort } from "@learning-path/shared";
import { toast } from "sonner";
import { LoaderCircle, Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import { TextareaField } from "@/components/common/forms/textarea-field";
import { getAdminAiJob } from "@/features/admin/ai-generation/api/admin-ai-generation-api";
import { AiJobMetadata } from "@/features/admin/ai-generation/components/ai-job-metadata";
import {
  adminAiGenerationQueryKeys,
  useAdminAiGenerationPanel,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import { buildAiReasoningEffortOptions } from "@/lib/ai-reasoning-effort";
import {
  supportsReasoningEffort,
  supportsTemperature,
  type AdminAiModelConfiguration,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import {
  deleteAdminVideoSummary,
  generateAdminVideoSummary,
  getAdminVideoSummary,
  previewAdminVideoSummary,
  updateAdminVideoSummary,
  type VideoSummary,
  type VideoSummaryPreview,
  type VideoSummaryRequest,
} from "@/features/admin/lessons/api/admin-video-summary-api";
import { VideoSummaryPromptPreview } from "@/features/admin/lessons/components/video-summary-prompt-preview";
import { VideoSummaryEditorDialog } from "@/features/admin/lessons/components/video-summary-editor-dialog";
import { prepareVideoSummaryPreviewRequest } from "@/features/admin/lessons/utils/video-summary-request";
import { createTextTiptapDocument } from "@/lib/tiptap-rich-content";

const initialRequest: VideoSummaryRequest = {
  style: "student_friendly",
  styleInstructions: "Dễ hiểu, gần gũi và phù hợp với người học của khóa học.",
  length: "standard",
};
const styleOptions = [
  { value: "student_friendly", label: "Dễ hiểu, gần gũi" },
  { value: "concise", label: "Cô đọng, vào trọng tâm" },
  { value: "academic", label: "Học thuật, chặt chẽ" },
];
const lengthOptions = [
  { value: "short", label: "Ngắn gọn" },
  { value: "standard", label: "Tiêu chuẩn" },
  { value: "detailed", label: "Chi tiết" },
];

export function VideoSummaryDialog({
  lessonId,
  disabled,
  disabledReason,
  generationRequestId,
  onVideoSeek,
  showContent,
  videoStartTimeOffsetSeconds = 0,
  videoEndTimeSeconds,
}: {
  lessonId: string;
  disabled: boolean;
  disabledReason: string;
  generationRequestId: number;
  onVideoSeek?: (seconds: number) => void;
  showContent: boolean;
  videoStartTimeOffsetSeconds?: number;
  videoEndTimeSeconds?: number;
}) {
  const [open, setOpen] = useState(false);
  const handledGenerationRequestIdRef = useRef(0);
  const [request, setRequest] = useState(initialRequest);
  const [preview, setPreview] = useState<VideoSummaryPreview | null>(null);
  const [shouldPrepareInitialPreview, setShouldPrepareInitialPreview] = useState(false);
  const [isPreparingSubmission, setIsPreparingSubmission] = useState(false);
  const hasAdminEditedSystemPromptRef = useRef(false);
  const hasAdminEditedUserPromptRef = useRef(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const summary = useQuery({
    queryKey: ["admin-video-summary", lessonId],
    queryFn: () => getAdminVideoSummary(lessonId, token),
    enabled: Boolean(token),
  });
  const modelConfigurationQuery = useAdminAiGenerationPanel(lessonId);
  const modelConfiguration =
    modelConfigurationQuery.data?.videoSummaryConfiguration ??
    modelConfigurationQuery.data?.summaryConfiguration;
  const panelJob = modelConfigurationQuery.data?.videoSummaryJob ?? null;
  const targetGrade = modelConfigurationQuery.data?.lesson.targetGrade ?? null;
  const resolvedModel = request.model ?? modelConfiguration?.resolvedModel ?? "";
  const selectedModel = modelConfiguration?.modelOptions.find(
    (option) => option.model === resolvedModel,
  );
  const aiConfiguration = selectedModel?.capabilities?.aiConfiguration;
  const showTemperature = supportsTemperature(resolvedModel, aiConfiguration);
  const showReasoningEffort = supportsReasoningEffort(resolvedModel, aiConfiguration);
  useEffect(() => {
    if (!open || request.model || !modelConfiguration?.resolvedModel) return;
    const model = modelConfiguration.resolvedModel;
    setRequest((current) =>
      current.model
        ? current
        : {
            ...current,
            model,
            temperature: resolveModelTemperature(modelConfiguration, model),
            reasoningEffort: resolveModelReasoningEffort(modelConfiguration, model),
            maxOutputTokens: modelConfiguration.maxOutputTokens ?? 1200,
          },
    );
  }, [modelConfiguration, open, request.model]);
  const job = useQuery({
    queryKey: ["admin-video-summary-job", jobId],
    queryFn: () => getAdminAiJob(jobId ?? "", token),
    enabled: Boolean(jobId && token),
    refetchInterval: (query) =>
      ["SUCCEEDED", "FAILED"].includes(query.state.data?.status ?? "") ? false : 1500,
  });
  const trackedJobId = jobId ?? panelJob?.jobId ?? null;
  const trackedJobStatus = jobId ? job.data?.status : panelJob?.status;
  const isGenerating = trackedJobStatus === "QUEUED" || trackedJobStatus === "RUNNING";
  useEffect(() => {
    if (
      !trackedJobId ||
      !["SUCCEEDED", "FAILED", "CANCELLED"].includes(trackedJobStatus ?? "")
    ) {
      return;
    }
    void Promise.all([
      queryClient.refetchQueries({
        queryKey: ["admin-video-summary", lessonId],
        type: "active",
      }),
      queryClient.refetchQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        type: "active",
      }),
      queryClient.refetchQueries({
        queryKey: ["admin-lesson", lessonId],
        type: "active",
      }),
    ]);
  }, [lessonId, queryClient, trackedJobId, trackedJobStatus]);
  const previewMutation = useMutation({
    mutationFn: (previewRequest: VideoSummaryRequest) =>
      previewAdminVideoSummary(lessonId, previewRequest, token),
    onSuccess: (data) => {
      setPreview(data);
      setRequest((current) => ({
        ...current,
        systemInstructions: hasAdminEditedSystemPromptRef.current
          ? current.systemInstructions
          : data.systemPrompt,
        userPrompt: hasAdminEditedUserPromptRef.current
          ? current.userPrompt
          : data.userPrompt,
      }));
      setShouldPrepareInitialPreview(false);
    },
    onError: () => setShouldPrepareInitialPreview(false),
  });
  useEffect(() => {
    if (
      !open ||
      !shouldPrepareInitialPreview ||
      !request.model ||
      previewMutation.isPending
    ) {
      return;
    }
    previewMutation.mutate(
      prepareVideoSummaryPreviewRequest(request, {
        preserveSystemPrompt: hasAdminEditedSystemPromptRef.current,
        preserveUserPrompt: hasAdminEditedUserPromptRef.current,
      }),
    );
  }, [open, previewMutation, request.model, shouldPrepareInitialPreview]);
  const generateMutation = useMutation({
    mutationFn: async (currentRequest: VideoSummaryRequest) => {
      const latestRequest = prepareVideoSummaryPreviewRequest(currentRequest, {
        preserveSystemPrompt: hasAdminEditedSystemPromptRef.current,
        preserveUserPrompt: hasAdminEditedUserPromptRef.current,
      });
      setIsPreparingSubmission(true);
      const latestPreview = await previewAdminVideoSummary(
        lessonId,
        latestRequest,
        token,
      );
      setPreview(latestPreview);
      setRequest((current) => ({
        ...current,
        systemInstructions: hasAdminEditedSystemPromptRef.current
          ? current.systemInstructions
          : latestPreview.systemPrompt,
        userPrompt: hasAdminEditedUserPromptRef.current
          ? current.userPrompt
          : latestPreview.userPrompt,
      }));
      setIsPreparingSubmission(false);
      return generateAdminVideoSummary(
        lessonId,
        {
          ...latestRequest,
          requestDraftId: latestPreview.requestDraftId,
          requestHash: latestPreview.requestHash,
        },
        token,
      );
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setOpen(false);
      void queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
      });
    },
    onSettled: () => setIsPreparingSubmission(false),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminVideoSummary(lessonId, token),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-video-summary", lessonId] }),
  });
  const editMutation = useMutation({
    mutationFn: ({
      action,
      contentJson,
    }: {
      action: "SAVE" | "PUBLISH" | "WITHDRAW";
      contentJson: VideoSummary["contentJson"];
    }) => {
      if (!summary.data && action === "WITHDRAW") {
        throw new Error("Chưa có tóm tắt video để thu hồi");
      }
      const reviewStatus =
        action === "PUBLISH"
          ? "APPROVED"
          : action === "WITHDRAW"
            ? "HIDDEN"
            : (summary.data?.reviewStatus ?? "NEEDS_REVIEW");
      return updateAdminVideoSummary(
        lessonId,
        {
          contentJson:
            action === "SAVE" || !summary.data ? contentJson : summary.data.contentJson,
          source: action === "SAVE" || !summary.data ? "ADMIN" : summary.data.source,
          reviewStatus,
        },
        token,
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === "SAVE"
          ? "Đã lưu nội dung chỉnh sửa"
          : variables.action === "PUBLISH"
            ? "Đã phát hành Tổng quan video"
            : "Đã thu hồi phát hành Tổng quan video",
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-video-summary", lessonId] }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        }),
      ]);
    },
  });
  const isBusy = previewMutation.isPending || generateMutation.isPending;
  const close = () => {
    if (!isBusy) setOpen(false);
  };
  const openDialog = useCallback(() => {
    if (disabled) {
      toast.error(disabledReason);
      return;
    }
    const model = modelConfiguration?.resolvedModel ?? undefined;
    setRequest({
      ...initialRequest,
      model,
      temperature: model ? resolveModelTemperature(modelConfiguration, model) : undefined,
      reasoningEffort: model
        ? resolveModelReasoningEffort(modelConfiguration, model)
        : undefined,
      maxOutputTokens: modelConfiguration?.maxOutputTokens ?? 1200,
    });
    setPreview(null);
    hasAdminEditedSystemPromptRef.current = false;
    hasAdminEditedUserPromptRef.current = false;
    previewMutation.reset();
    setShouldPrepareInitialPreview(true);
    setOpen(true);
  }, [disabled, disabledReason, modelConfiguration, previewMutation]);

  useEffect(() => {
    if (generationRequestId === handledGenerationRequestIdRef.current) return;
    handledGenerationRequestIdRef.current = generationRequestId;
    openDialog();
  }, [generationRequestId, openDialog]);

  const completedJob =
    summary.data?.aiGenerationId &&
    panelJob?.aiGenerationId === summary.data.aiGenerationId
      ? panelJob
      : null;
  const currentSummaryContent = summary.data?.contentJson;
  const hasCurrentBlocksDocument =
    currentSummaryContent?.type === "lesson_summary_blocks" &&
    currentSummaryContent.version === 6;
  const editorInitialContent = useMemo(
    () =>
      hasCurrentBlocksDocument || currentSummaryContent?.type === "doc"
        ? currentSummaryContent
        : createTextTiptapDocument(""),
    [currentSummaryContent, hasCurrentBlocksDocument],
  );

  return (
    <>
      {showContent ? (
        <section data-testid="admin-video-summary-tab">
          <VideoSummaryEditorDialog
            displayMode="inline"
            inlineHeader={
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
                    Tổng quan video
                  </h3>
                  {summary.data ? (
                    <span
                      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold ${
                        summary.data.reviewStatus === "APPROVED"
                          ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
                          : summary.data.reviewStatus === "NEEDS_REVIEW"
                            ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
                            : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]"
                      }`}
                    >
                      {summary.data.reviewStatus === "APPROVED"
                        ? "Đã phát hành"
                        : summary.data.reviewStatus === "HIDDEN"
                          ? "Đã thu hồi"
                          : "Bản nháp"}
                    </span>
                  ) : null}
                </div>
                {summary.data ? <AiJobMetadata job={completedJob} /> : null}
              </div>
            }
            inlineActions={
              summary.data ? (
                <>
                  <button
                    type="button"
                    onClick={openDialog}
                    className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Xóa bản tóm tắt video này?")) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending || editMutation.isPending}
                    className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold disabled:opacity-60"
                  >
                    {deleteMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    Xóa
                  </button>
                </>
              ) : null
            }
            initialContent={editorInitialContent}
            isOpen
            isSaving={editMutation.isPending}
            lessonId={lessonId}
            reviewStatus={summary.data?.reviewStatus}
            subjectKey={modelConfigurationQuery.data?.lesson.subjectKey ?? null}
            onClose={() => undefined}
            onSave={(action, content) =>
              editMutation.mutate({ action, contentJson: content })
            }
            onVideoSeek={onVideoSeek}
            videoStartTimeOffsetSeconds={videoStartTimeOffsetSeconds}
            videoEndTimeSeconds={videoEndTimeSeconds}
          />
        </section>
      ) : null}

      <EditorDialogShell
        isOpen={open}
        onClose={close}
        ariaLabel="Tóm tắt Video bằng AI"
        panelClassName="max-w-3xl"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5">
            <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Tóm tắt Video bằng AI
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <section className="space-y-4">
              <fieldset className="space-y-2">
                <TextareaField
                  id="video-summary-style"
                  label="Cách trình bày"
                  className="min-h-24"
                  value={request.styleInstructions ?? ""}
                  helperText="Chọn một gợi ý để tự động điền, sau đó có thể sửa tùy ý."
                  onChange={(event) => {
                    setRequest({
                      ...request,
                      styleInstructions: event.currentTarget.value,
                    });
                  }}
                />
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Mẫu trình bày thiết lập sẵn"
                >
                  {styleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setRequest({
                          ...request,
                          style: option.value as VideoSummaryRequest["style"],
                          styleInstructions: getPresentationPreset(
                            option.value,
                            targetGrade,
                          ),
                        });
                      }}
                      className="theme-button-primary-subtle min-h-9 rounded-lg px-3 text-xs font-extrabold whitespace-nowrap"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <OptionField
                  id="video-summary-length"
                  label="Độ dài Tóm tắt"
                  value={request.length}
                  options={lengthOptions}
                  icon={null}
                  onChange={(value) => {
                    setRequest({
                      ...request,
                      length: value as VideoSummaryRequest["length"],
                    });
                  }}
                />
                <TextField
                  id="video-summary-word-count"
                  label="Số lượng từ"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={request.targetWordCount ?? ""}
                  placeholder="Để trống nếu không giới hạn"
                  isOptional
                  icon={null}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "");
                    setRequest({
                      ...request,
                      targetWordCount: value ? Number(value) : undefined,
                    });
                  }}
                />
              </div>

              <TextareaField
                id="video-summary-instructions"
                label="Yêu cầu bổ sung"
                value={request.extraInstructions ?? ""}
                placeholder="Ví dụ: Dùng câu ngắn, nhấn mạnh công thức, ứng dụng thực tế hoặc lỗi thường gặp"
                isOptional
                onChange={(event) => {
                  setRequest({ ...request, extraInstructions: event.target.value });
                }}
              />

              <div className="grid gap-4 border-t border-[var(--theme-border)] pt-4 sm:grid-cols-2">
                <OptionField
                  id="video-summary-model"
                  label="Model"
                  value={request.model ?? ""}
                  placeholder="Chọn model"
                  options={(modelConfiguration?.modelOptions ?? [])
                    .filter((option) => option.available)
                    .map((option) => ({
                      value: option.model,
                      label: `${formatProviderLabel(option.provider)} · ${option.model}`,
                    }))}
                  icon={null}
                  disabled={modelConfigurationQuery.isLoading}
                  onChange={(value) => {
                    setRequest({
                      ...request,
                      model: value,
                      temperature: resolveModelTemperature(modelConfiguration, value),
                      reasoningEffort: resolveModelReasoningEffort(
                        modelConfiguration,
                        value,
                      ),
                    });
                  }}
                />
                {showTemperature ? (
                  <TextField
                    id="video-summary-temperature"
                    label="Temperature"
                    type="text"
                    inputMode="decimal"
                    value={
                      request.temperature === undefined
                        ? String(modelConfiguration?.temperature ?? 0.1)
                        : String(request.temperature)
                    }
                    icon={null}
                    onChange={(event) => {
                      const value = event.target.value;
                      const parsed = Number(value);
                      if (
                        value !== "" &&
                        (!Number.isFinite(parsed) || parsed < 0 || parsed > 1)
                      ) {
                        return;
                      }
                      setRequest({
                        ...request,
                        temperature: value === "" ? undefined : parsed,
                        reasoningEffort: undefined,
                      });
                    }}
                  />
                ) : showReasoningEffort ? (
                  <OptionField
                    id="video-summary-reasoning-effort"
                    label="Reasoning Effort"
                    value={
                      request.reasoningEffort ?? modelConfiguration?.reasoningEffort ?? ""
                    }
                    options={buildAiReasoningEffortOptions(
                      selectedModel?.capabilities?.reasoningEffortLevels,
                      modelConfiguration?.reasoningEffort,
                    )}
                    icon={null}
                    onChange={(value) => {
                      setRequest({
                        ...request,
                        temperature: undefined,
                        reasoningEffort: isAiReasoningEffort(value) ? value : undefined,
                      });
                    }}
                  />
                ) : (
                  <div className="hidden sm:block" aria-hidden="true" />
                )}
                <TextField
                  id="video-summary-max-output-tokens"
                  label="Giới hạn token đầu ra"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={request.maxOutputTokens ?? ""}
                  icon={null}
                  wrapperClassName="sm:col-span-2"
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "");
                    setRequest({
                      ...request,
                      maxOutputTokens: value ? Number(value) : undefined,
                    });
                  }}
                />
              </div>
            </section>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
                Xem lại dữ liệu theo các lựa chọn hiện tại.
              </p>
              <button
                type="button"
                disabled={previewMutation.isPending || isBusy || !request.model}
                onClick={() =>
                  previewMutation.mutate(
                    prepareVideoSummaryPreviewRequest(request, {
                      preserveSystemPrompt: hasAdminEditedSystemPromptRef.current,
                      preserveUserPrompt: hasAdminEditedUserPromptRef.current,
                    }),
                  )
                }
                className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold whitespace-nowrap disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${previewMutation.isPending ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {previewMutation.isPending
                  ? "Đang dựng dữ liệu"
                  : "Cập nhật dữ liệu gửi AI"}
              </button>
            </div>

            {previewMutation.isPending && !preview ? (
              <div className="mt-4 flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text-muted)]">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Đang tải dữ liệu...
              </div>
            ) : null}

            {preview ? (
              <div
                className={`relative overflow-hidden transition-opacity duration-200 ${
                  previewMutation.isPending ? "opacity-50" : ""
                }`}
              >
                <VideoSummaryPromptPreview
                  preview={preview}
                  systemInstructions={request.systemInstructions ?? preview.systemPrompt}
                  userPrompt={request.userPrompt ?? preview.userPrompt}
                  onSystemInstructionsChange={(value) => {
                    hasAdminEditedSystemPromptRef.current = value.trim().length > 0;
                    setRequest((current) => ({
                      ...current,
                      systemInstructions: value,
                    }));
                  }}
                  onUserPromptChange={(value) => {
                    hasAdminEditedUserPromptRef.current = value.trim().length > 0;
                    setRequest((current) => ({ ...current, userPrompt: value }));
                  }}
                />
              </div>
            ) : null}
            {previewMutation.isError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] p-3 text-sm font-semibold text-[var(--theme-error-text)]"
              >
                {getUserFacingErrorMessage(
                  previewMutation.error,
                  "Chưa thể chuẩn bị dữ liệu gửi AI. Vui lòng thử lại.",
                )}
              </div>
            ) : null}
          </div>
          <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
            <button
              type="button"
              onClick={close}
              disabled={isBusy}
              className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-extrabold whitespace-nowrap sm:w-auto"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => generateMutation.mutate(request)}
              disabled={isBusy || isGenerating || !request.model}
              className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold whitespace-nowrap disabled:opacity-60 sm:w-auto"
            >
              {generateMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {isPreparingSubmission
                ? "Đang cập nhật dữ liệu"
                : generateMutation.isPending
                  ? "Đang gửi yêu cầu"
                  : "Bắt đầu tạo"}
            </button>
          </footer>
        </div>
      </EditorDialogShell>
    </>
  );
}

function resolveModelTemperature(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  if (!model) return undefined;
  const selected = configuration?.modelOptions.find((option) => option.model === model);
  if (!supportsTemperature(model, selected?.capabilities?.aiConfiguration))
    return undefined;
  return selected?.model === configuration?.resolvedModel
    ? (configuration?.temperature ?? 0.1)
    : 0.1;
}

function formatProviderLabel(provider: string) {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "openai") return "OpenAI";
  if (normalized === "gemini") return "Gemini";
  return provider;
}

function getPresentationPreset(style: string, targetGrade: number | null) {
  if (style === "concise") {
    return "Cô đọng, đi thẳng vào kiến thức trọng tâm và dễ quét nhanh.";
  }
  if (style === "academic") {
    return "Học thuật, chặt chẽ, có cấu trúc rõ ràng và dùng thuật ngữ chính xác.";
  }
  return targetGrade
    ? "Dễ hiểu, gần gũi, sử dụng cách diễn đạt và mức độ chi tiết phù hợp lứa tuổi."
    : "Dễ hiểu, gần gũi và phù hợp với người học của khóa học.";
}

function resolveModelReasoningEffort(
  configuration: AdminAiModelConfiguration | undefined,
  model: string,
) {
  if (!model) return undefined;
  const selected = configuration?.modelOptions.find((option) => option.model === model);
  const configured = configuration?.reasoningEffort;
  return selected?.model === configuration?.resolvedModel &&
    isAiReasoningEffort(configured) &&
    selected?.capabilities?.reasoningEffortLevels?.includes(configured)
    ? configured
    : undefined;
}
