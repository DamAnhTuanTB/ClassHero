"use client";

import {
  BookOpenText,
  BrainCircuit,
  CircleAlert,
  ClipboardCheck,
  FileQuestion,
  Layers3,
  Loader2,
  RefreshCw,
  Sparkles,
  Video,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AiJobTimer } from "@/features/admin/ai-generation/components/ai-job-timer";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { AdminJobErrorAlert } from "@/components/admin/admin-job-error-alert";
import {
  adminAiGenerationQueryKeys,
  useAdminAiGenerationPanel,
  useAdminAiJob,
  useGenerateAdminLessonContent,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminAiGenerationDialogRequest,
  AdminAiGenerationType,
  AdminAiPanelJob,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { useAdminFlashcardSets } from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { useAdminQuizSets } from "@/features/admin/quiz/hooks/use-admin-quiz";
import {
  adminAssessmentQueryKeys,
  useAdminAssessmentSets,
} from "@/features/admin/assessments/hooks/use-admin-assessment";
import {
  getUserFacingErrorMessage,
  sanitizeUserFacingMessage,
} from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

const AiGenerationConfigDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/ai-generation-config-dialog").then(
      (module) => module.AiGenerationConfigDialog,
    ),
  { ssr: false },
);

const AdminQuizGenerationDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-generation-dialog").then(
      (module) => module.AdminQuizGenerationDialog,
    ),
  { ssr: false },
);

const AdminFlashcardGenerationDialog = dynamic(
  () =>
    import("@/features/admin/flashcards/screens/admin-flashcards-tab/components/admin-flashcard-generation-dialog").then(
      (module) => module.AdminFlashcardGenerationDialog,
    ),
  { ssr: false },
);

type AdminAiCardType = AdminAiGenerationType | "VIDEO_SUMMARY";

const cards = [
  {
    type: "VIDEO_SUMMARY",
    label: "Video",
    description: "Tạo Tổng quan video từ bản chép lời đã lưu.",
    icon: Video,
  },
  {
    type: "SUMMARY",
    label: "Kiến thức",
    description: "Tổng hợp nội dung trọng tâm từ tài liệu đã chọn.",
    icon: BookOpenText,
  },
  {
    type: "QUIZ",
    label: "Quiz",
    description: "Tạo bộ câu hỏi luyện nhanh với nhiều dạng đáp án.",
    icon: FileQuestion,
  },
  {
    type: "FLASHCARD",
    label: "Flashcard",
    description:
      "Tạo thẻ ghi nhớ có đáp án trực tiếp, lời giải chi tiết và nguồn tham chiếu.",
    icon: Layers3,
  },
  {
    type: "TEST",
    label: "Test",
    description: "Tạo bộ đề có thời gian với cùng cấu hình và luồng Quiz.",
    icon: ClipboardCheck,
  },
] as const;

export function AdminAiGenerationPanel({
  lessonId,
  flashcardTargetSetId,
  quizTargetSetId,
  testTargetSetId,
  onGenerateVideoSummary,
  onOpenResult,
  onRequestedGenerationHandled,
  requestedGeneration,
  videoSummaryDisabledReason,
  videoSummaryReady,
}: {
  lessonId: string;
  flashcardTargetSetId?: string;
  quizTargetSetId?: string;
  testTargetSetId?: string;
  onGenerateVideoSummary: () => void;
  onOpenResult: (type: AdminAiGenerationType, resourceId: string | null) => void;
  onRequestedGenerationHandled: () => void;
  requestedGeneration: AdminAiGenerationDialogRequest | null;
  videoSummaryDisabledReason: string;
  videoSummaryReady: boolean;
}) {
  const panelQuery = useAdminAiGenerationPanel(lessonId);
  const flashcardSetsQuery = useAdminFlashcardSets(lessonId);
  const quizSetsQuery = useAdminQuizSets(lessonId);
  const testSetsQuery = useAdminAssessmentSets("test", lessonId);
  const generateMutation = useGenerateAdminLessonContent(lessonId);
  const [dialogRequest, setDialogRequest] =
    useState<AdminAiGenerationDialogRequest | null>(null);
  const [refreshingSetType, setRefreshingSetType] = useState<
    "QUIZ" | "FLASHCARD" | "TEST" | null
  >(null);

  async function handleOpenGenerationDialog(type: AdminAiGenerationType) {
    if (type !== "QUIZ" && type !== "FLASHCARD" && type !== "TEST") {
      setDialogRequest({ type, mode: "CREATE" });
      return;
    }
    if (refreshingSetType) return;

    setRefreshingSetType(type);
    try {
      const result = await (type === "QUIZ"
        ? quizSetsQuery.refetch()
        : type === "TEST"
          ? testSetsQuery.refetch()
          : flashcardSetsQuery.refetch());
      if (result.isError) {
        toast.error(
          getUserFacingErrorMessage(
            result.error,
            `Chưa tải được danh sách bộ ${type === "QUIZ" ? "Quiz" : type === "TEST" ? "đề Test" : "Flashcard"}. Vui lòng thử lại.`,
          ),
        );
        return;
      }
      setDialogRequest({ type, mode: "CREATE" });
    } finally {
      setRefreshingSetType(null);
    }
  }

  useEffect(() => {
    if (!requestedGeneration) {
      return;
    }
    setDialogRequest(requestedGeneration);
    onRequestedGenerationHandled();
  }, [onRequestedGenerationHandled, requestedGeneration]);

  if (panelQuery.isPending) {
    return <PanelSkeleton />;
  }
  if (panelQuery.isError || !panelQuery.data) {
    return (
      <AdminDataErrorState
        description="Kiểm tra kết nối rồi thử lại để tiếp tục tạo nội dung."
        headingLevel={3}
        isRetrying={panelQuery.isFetching}
        onRetry={() => panelQuery.refetch()}
        title="Không tải được công cụ tạo nội dung AI"
        variant="section"
      />
    );
  }

  const panel = panelQuery.data;
  return (
    <section
      aria-labelledby="admin-ai-generation-heading"
      className="rounded-xl border border-[var(--theme-border)] bg-slate-50/50 dark:bg-slate-900/40 p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit
              className="h-5 w-5 text-[var(--theme-primary)]"
              aria-hidden="true"
            />
            <h2
              id="admin-ai-generation-heading"
              className="text-base font-extrabold text-[var(--theme-text-strong)]"
            >
              Tạo nội dung bằng AI
            </h2>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            Tạo bản nháp từ video hoặc tài liệu buổi học, sau đó kiểm tra và hoàn thiện
            nội dung.
          </p>
        </div>
        <ReadinessBadge
          ready={panel.readiness.generationReady || videoSummaryReady}
          summaryReady={panel.readiness.summaryReady}
        />
      </div>

      {panel.readiness.reason && !videoSummaryReady ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-3 text-sm font-semibold text-[var(--theme-warning-text)]">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {sanitizeUserFacingMessage(
              panel.readiness.reason,
              "Chưa đủ dữ liệu để tạo nội dung. Hãy kiểm tra lại tài liệu của buổi học.",
            )}
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const job =
            card.type === "VIDEO_SUMMARY" ? panel.videoSummaryJob : panel.jobs[card.type];
          const isActive = job?.status === "QUEUED" || job?.status === "RUNNING";
          const isReady =
            card.type === "VIDEO_SUMMARY"
              ? videoSummaryReady
              : card.type === "SUMMARY"
                ? panel.readiness.summaryReady
                : card.type === "QUIZ"
                  ? panel.readiness.quizReady
                  : panel.readiness.generationReady;
          return (
            <GenerationCard
              key={card.type}
              {...card}
              disabledReason={
                card.type === "VIDEO_SUMMARY"
                  ? videoSummaryDisabledReason
                  : card.type === "QUIZ"
                    ? panel.readiness.quizReason
                    : panel.readiness.reason
              }
              isActive={isActive}
              isPreparing={
                card.type !== "VIDEO_SUMMARY" && card.type === refreshingSetType
              }
              isReady={isReady}
              job={job}
              onGenerate={() => {
                if (card.type === "VIDEO_SUMMARY") {
                  onGenerateVideoSummary();
                  return;
                }
                void handleOpenGenerationDialog(card.type);
              }}
            />
          );
        })}
      </div>

      {cards.map((card) => {
        const job =
          card.type === "VIDEO_SUMMARY" ? panel.videoSummaryJob : panel.jobs[card.type];
        return job?.jobId && (job.status === "QUEUED" || job.status === "RUNNING") ? (
          <AdminAiJobWatcher
            key={job.jobId}
            jobId={job.jobId}
            lessonId={lessonId}
            type={card.type}
            onCompleted={onOpenResult}
          />
        ) : null;
      })}

      {dialogRequest ? (
        dialogRequest.type === "QUIZ" || dialogRequest.type === "TEST" ? (
          <AdminQuizGenerationDialog
            key={`${dialogRequest.type}-${dialogRequest.mode}`}
            assessmentKind={dialogRequest.type === "TEST" ? "test" : "quiz"}
            documents={panel.documents}
            initialGenerationConfiguration={
              dialogRequest.mode === "EDIT"
                ? panel.jobs[dialogRequest.type]?.inputMetaJson
                : null
            }
            initialModelConfiguration={
              dialogRequest.type === "TEST"
                ? panel.testConfiguration
                : panel.quizConfiguration
            }
            initialFigureModelConfiguration={
              dialogRequest.type === "TEST"
                ? panel.testFigureConfiguration
                : panel.quizFigureConfiguration
            }
            isOpen
            isSubmitting={generateMutation.isPending}
            lessonId={lessonId}
            quizSets={
              dialogRequest.type === "TEST"
                ? (testSetsQuery.data ?? [])
                : (quizSetsQuery.data ?? [])
            }
            quizTargetSetId={
              dialogRequest.type === "TEST" ? testTargetSetId : quizTargetSetId
            }
            onClose={() => !generateMutation.isPending && setDialogRequest(null)}
            onSubmit={async (payload) => {
              try {
                await generateMutation.mutateAsync(payload);
                toast.success(
                  `Hệ thống đã tiếp nhận yêu cầu tạo ${dialogRequest.type === "TEST" ? "Test" : "Quiz"}`,
                );
                setDialogRequest(null);
              } catch (error) {
                toast.error(
                  getUserFacingErrorMessage(
                    error,
                    `Chưa thể bắt đầu tạo ${dialogRequest.type === "TEST" ? "Test" : "Quiz"}. Vui lòng thử lại.`,
                  ),
                );
              }
            }}
          />
        ) : dialogRequest.type === "FLASHCARD" ? (
          <AdminFlashcardGenerationDialog
            key={`FLASHCARD-${dialogRequest.mode}`}
            documents={panel.documents}
            initialGenerationConfiguration={
              dialogRequest.mode === "EDIT" ? panel.jobs.FLASHCARD?.inputMetaJson : null
            }
            initialModelConfiguration={panel.flashcardConfiguration}
            initialFigureModelConfiguration={panel.flashcardFigureConfiguration}
            isOpen
            isSubmitting={generateMutation.isPending}
            lessonId={lessonId}
            flashcardSets={flashcardSetsQuery.data ?? []}
            flashcardTargetSetId={flashcardTargetSetId}
            onClose={() => !generateMutation.isPending && setDialogRequest(null)}
            onSubmit={async (payload) => {
              try {
                await generateMutation.mutateAsync(payload);
                toast.success("Hệ thống đã tiếp nhận yêu cầu tạo Flashcard");
                setDialogRequest(null);
              } catch (error) {
                toast.error(
                  getUserFacingErrorMessage(
                    error,
                    "Chưa thể bắt đầu tạo Flashcard. Vui lòng thử lại.",
                  ),
                );
              }
            }}
          />
        ) : (
          <AiGenerationConfigDialog
            key={`${dialogRequest.type}-${dialogRequest.mode}`}
            documents={panel.documents}
            initialGenerationConfiguration={
              dialogRequest.mode === "EDIT"
                ? panel.jobs[dialogRequest.type]?.inputMetaJson
                : null
            }
            isOpen
            isSubmitting={generateMutation.isPending}
            lessonId={lessonId}
            initialModelConfiguration={panel.summaryConfiguration}
            initialFigureModelConfiguration={panel.summaryFigureConfiguration}
            targetGrade={panel.lesson.targetGrade}
            type={dialogRequest.type}
            onClose={() => !generateMutation.isPending && setDialogRequest(null)}
            onSubmit={async (payload) => {
              try {
                await generateMutation.mutateAsync(payload);
                toast.success("Hệ thống đã tiếp nhận yêu cầu tạo nội dung");
                setDialogRequest(null);
              } catch (error) {
                toast.error(
                  getUserFacingErrorMessage(
                    error,
                    "Chưa thể bắt đầu tạo nội dung. Vui lòng thử lại.",
                  ),
                );
              }
            }}
          />
        )
      ) : null}
    </section>
  );
}

function GenerationCard({
  description,
  disabledReason,
  icon: Icon,
  isActive,
  isPreparing,
  isReady,
  job,
  label,
  onGenerate,
  type,
}: {
  description: string;
  disabledReason?: string | null;
  icon: typeof BookOpenText;
  isActive: boolean;
  isPreparing: boolean;
  isReady: boolean;
  job: AdminAiPanelJob | null;
  label: string;
  type: AdminAiCardType;
  onGenerate: () => void;
}) {
  const hasCurrentSummary =
    (type !== "SUMMARY" && type !== "VIDEO_SUMMARY") || job?.reviewStatus !== null;
  const hasSucceededContent = job?.status === "SUCCEEDED" && hasCurrentSummary;
  const status = getJobStatus(job, isReady, type);
  return (
    <article className="flex min-h-56 flex-col rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          className={cn(
            "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold",
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>
      <h3 className="mt-3 font-extrabold text-[var(--theme-text-strong)]">{label}</h3>
      {job?.status === "FAILED" ? (
        <AdminJobErrorAlert
          className="mt-2 flex-1"
          details={job.errorDetails}
          fallbackMessage={job.error}
        />
      ) : (
        <p className="mt-1 flex-1 text-sm font-medium leading-5 text-[var(--theme-text-muted)]">
          {description}
        </p>
      )}
      {hasSucceededContent ? (
        <button
          type="button"
          onClick={onGenerate}
          className="theme-button-primary mt-4 inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Tạo mới
        </button>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!isReady || isActive || isPreparing}
          title={!isReady ? (disabledReason ?? undefined) : undefined}
          className="theme-button-primary mt-4 inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isActive || isPreparing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : job?.status === "FAILED" ? (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {isPreparing ? (
            type === "FLASHCARD" ? (
              "Đang tải bộ Flashcard"
            ) : type === "TEST" ? (
              "Đang tải bộ đề Test"
            ) : (
              "Đang tải bộ Quiz"
            )
          ) : isActive ? (
            <AiJobTimer createdAt={job!.createdAt} prefix="Đang xử lý (" suffix=")" />
          ) : job?.status === "FAILED" ? (
            "Thử lại"
          ) : (
            "Tạo mới"
          )}
        </button>
      )}
    </article>
  );
}

function AdminAiJobWatcher({
  jobId,
  lessonId,
  onCompleted,
  type,
}: {
  jobId: string;
  lessonId: string;
  onCompleted: (type: AdminAiGenerationType, resourceId: string | null) => void;
  type: AdminAiCardType;
}) {
  const queryClient = useQueryClient();
  const jobQuery = useAdminAiJob(jobId, true);
  const handledJobIds = useRef(new Set<string>());

  useEffect(() => {
    const job = jobQuery.data;
    if (!job || (job.status !== "SUCCEEDED" && job.status !== "FAILED")) {
      return;
    }
    if (handledJobIds.current.has(job.jobId)) {
      return;
    }
    handledJobIds.current.add(job.jobId);
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.summary(lessonId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
      }),
      queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "flashcards"] }),
      queryClient.invalidateQueries({ queryKey: adminAssessmentQueryKeys.all }),
      queryClient.invalidateQueries({
        queryKey: ["admin-video-summary", lessonId],
      }),
    ]);
    if (job.status === "SUCCEEDED") {
      toast.success(
        type === "VIDEO_SUMMARY"
          ? "AI đã tạo xong Tổng quan video. Hãy kiểm tra và phát hành."
          : type === "SUMMARY"
            ? "AI đã tạo xong bản kiến thức. Hãy kiểm tra và lưu nội dung."
            : "AI đã tạo xong nội dung. Hãy kiểm tra trước khi duyệt.",
      );
      if (type !== "VIDEO_SUMMARY") {
        onCompleted(type, job.resourceId);
      }
    } else {
      toast.error(
        sanitizeUserFacingMessage(
          job.errorDetails?.message ?? job.error,
          "Chưa tạo được nội dung. Bạn có thể thử lại.",
        ),
      );
    }
  }, [jobQuery.data, lessonId, onCompleted, queryClient, type]);

  return null;
}

function ReadinessBadge({
  ready,
  summaryReady,
}: {
  ready: boolean;
  summaryReady: boolean;
}) {
  const label = ready
    ? "Sẵn sàng tạo"
    : summaryReady
      ? "Đang xử lý tài liệu"
      : "Chưa đủ dữ liệu";
  return (
    <span
      className={cn(
        "inline-flex min-h-8 w-fit items-center rounded-full border px-3 text-xs font-extrabold",
        ready
          ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
          : "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
      )}
    >
      {label}
    </span>
  );
}

function getJobStatus(
  job: AdminAiPanelJob | null,
  ready: boolean,
  type: AdminAiCardType,
) {
  if (!ready) {
    return {
      label: "Chưa sẵn sàng",
      className:
        "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
    };
  }
  if (!job) {
    return {
      label: "Chưa tạo",
      className:
        "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-muted)]",
    };
  }
  if (job.status === "QUEUED" || job.status === "RUNNING") {
    return {
      label: job.status === "QUEUED" ? "Đang chờ" : "Đang tạo",
      className:
        "border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] text-[var(--theme-info-text)]",
    };
  }
  if (job.status === "SUCCEEDED") {
    if (type === "SUMMARY" || type === "VIDEO_SUMMARY") {
      if (job.reviewStatus === null) {
        return {
          label: "Chưa tạo",
          className:
            "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-muted)]",
        };
      }
      const isInUse = job.reviewStatus === "APPROVED";
      const isHidden = job.reviewStatus === "HIDDEN";
      return {
        label: isInUse ? "Đã phát hành" : isHidden ? "Đã thu hồi" : "Bản nháp",
        className: isInUse
          ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
          : isHidden
            ? "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]"
            : "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
      };
    }
    return {
      label: job.reviewStatus === "APPROVED" ? "Đã duyệt" : "Cần duyệt",
      className:
        job.reviewStatus === "APPROVED"
          ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
          : "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
    };
  }
  return {
    label: "Tạo thất bại",
    className:
      "border-[var(--theme-error-border)] bg-[var(--theme-error-bg)] text-[var(--theme-error-text)]",
  };
}

function PanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải công cụ tạo nội dung AI"
      className="animate-pulse rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-5"
    >
      <SkeletonBlock className="h-6 w-52 rounded-full" />
      <SkeletonBlock className="mt-2 h-4 w-96 max-w-full rounded-full opacity-70" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="h-56 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
