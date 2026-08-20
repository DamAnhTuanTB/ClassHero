"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminLesson } from "../../hooks/use-admin-lesson";
import {
  BookOpen,
  Bot,
  FileText,
  Layers,
  ChevronRight,
  ArrowLeft,
  Layers3,
  Pencil,
} from "lucide-react";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { cn } from "@/lib/utils";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/components/admin/courses/admin-courses-sidebar";
import { statusLabels, statusStyles } from "@/features/admin/courses/admin-courses-data";
import type { AdminLesson } from "@/features/admin/courses/admin-courses-data";
import type { AdminQuizInitialData } from "@/features/admin/quiz/api/admin-quiz-api";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import {
  CustomYoutubePlayer,
  type CustomYoutubePlayerHandle,
  type CustomVideoSettings,
} from "@/components/shared/custom-youtube-player";
import { LessonVideoSettingsForm } from "../../components/lesson-video-settings-form";
import { LessonVideoChaptersForm } from "../../components/lesson-video-chapters-form";
import { LessonVideoTranscriptPanel } from "@/features/admin/lessons/components/lesson-video-transcript-panel";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import {
  LessonContentTabs,
  type LessonContentTabKey,
} from "@/features/admin/lessons/screens/admin-lesson-detail/components/lesson-content-tabs";
import { useAdminLessonContentPrefetch } from "@/features/admin/lessons/hooks/use-admin-lesson-content-prefetch";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getQueryRenderState } from "@/lib/query-render-state";
import type {
  AdminAiGenerationDialogRequest,
  AdminAiGenerationType,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

const LessonDetailEditorDialog = dynamic(() =>
  import("@/features/admin/lessons/components/lesson-detail-editor-dialog").then(
    (module) => module.LessonDetailEditorDialog,
  ),
);
const loadLessonDocumentsTab = () =>
  import("@/features/admin/lessons/components/lesson-documents-tab");
const LessonDocumentsTab = dynamic(
  () => loadLessonDocumentsTab().then((module) => module.LessonDocumentsTab),
  {
    loading: () => <AdminLessonDocumentsTabSkeleton />,
  },
);
const loadAdminAssessmentTab = () =>
  import("@/features/admin/assessments/components/admin-assessment-tab");
const loadAdminFlashcardsTab = () =>
  import("@/features/admin/flashcards/screens/admin-flashcards-tab");
const loadAdminTestsTab = () => import("@/features/admin/tests/screens/admin-tests-tab");
const AdminQuizTab = dynamic(() =>
  loadAdminAssessmentTab().then((module) => module.AdminAssessmentTab),
);
const AdminFlashcardsTab = dynamic(() =>
  loadAdminFlashcardsTab().then((module) => module.AdminFlashcardsTab),
);
const AdminTestsTab = dynamic(() =>
  loadAdminTestsTab().then((module) => module.AdminTestsTab),
);
const loadAdminAiGenerationPanel = () =>
  import("@/features/admin/ai-generation/components/admin-ai-generation-panel");
const AdminAiGenerationPanel = dynamic(() =>
  loadAdminAiGenerationPanel().then((module) => module.AdminAiGenerationPanel),
);
const loadAdminLessonSummaryTab = () =>
  import("@/features/admin/ai-generation/components/admin-lesson-summary-tab");
const AdminLessonSummaryTab = dynamic(() =>
  loadAdminLessonSummaryTab().then((module) => module.AdminLessonSummaryTab),
);

interface AdminLessonDetailManagerProps {
  initialLesson?: AdminLesson | null;
  initialQuizData?: AdminQuizInitialData;
  initialThemeMode?: AppThemeMode;
  lessonId: string;
}

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Khóa học", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: false },
  { label: "Tài liệu", icon: FileText, active: false },
  { label: "Cài đặt AI", icon: Bot, active: false, href: "/admin/ai-settings" },
];

export function AdminLessonDetailManager({
  initialLesson,
  initialQuizData,
  initialThemeMode = "light",
  lessonId,
}: AdminLessonDetailManagerProps) {
  const router = useRouter();
  const lessonQuery = useAdminLesson(lessonId, initialLesson);
  const { data: lesson, refetch } = lessonQuery;
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const queryRenderState = getQueryRenderState({
    ...lessonQuery,
    isPrerequisitePending: !isAuthHydrated && initialLesson === undefined,
  });
  useAdminLessonContentPrefetch(lessonId, Boolean(lesson));
  const [activeTab, setActiveTab] = useState<LessonContentTabKey>("documents");
  const [preferredSetIds, setPreferredSetIds] = useState<
    Partial<Record<"QUIZ" | "FLASHCARD" | "TEST", string>>
  >({});
  const [activeQuizSetId, setActiveQuizSetId] = useState(
    initialQuizData?.questionSetId ?? undefined,
  );
  const [requestedGeneration, setRequestedGeneration] =
    useState<AdminAiGenerationDialogRequest | null>(null);
  const lessonContentPanelId = `admin-lesson-tab-panel-${lessonId}`;
  const [tabPanelMinHeight, setTabPanelMinHeight] = useState(400);
  const [isLessonEditorOpen, setIsLessonEditorOpen] = useState(false);
  const [previewSettings, setPreviewSettings] = useState<CustomVideoSettings | null>(
    null,
  );
  const videoPlayerRef = useRef<CustomYoutubePlayerHandle>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const tabPanelRef = useRef<HTMLDivElement>(null);
  const latestPlaybackTimeRef = useRef(0);
  const hasPlaybackTimeRef = useRef(false);
  const transcriptPlaybackListenerRef = useRef<((timeInSeconds: number) => void) | null>(
    null,
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get("tab") as LessonContentTabKey;
      if (tab && ["documents", "summary", "quiz", "flashcard", "test"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  useEffect(() => {
    const resetTabPanelMinHeight = () => setTabPanelMinHeight(400);
    window.addEventListener("resize", resetTabPanelMinHeight);

    return () => window.removeEventListener("resize", resetTabPanelMinHeight);
  }, []);

  useEffect(() => {
    if (!lesson) {
      return;
    }

    const preloadContentTabs = () => {
      void loadLessonDocumentsTab();
      void loadAdminAssessmentTab();
      void loadAdminFlashcardsTab();
      void loadAdminTestsTab();
      void loadAdminAiGenerationPanel();
      void loadAdminLessonSummaryTab();
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleCallbackId = window.requestIdleCallback(preloadContentTabs, {
        timeout: 1_000,
      });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = globalThis.setTimeout(preloadContentTabs, 250);
    return () => globalThis.clearTimeout(timeoutId);
  }, [lesson]);

  const handleTabChange = useCallback(
    (nextTab: LessonContentTabKey) => {
      if (nextTab === activeTab) {
        return;
      }

      const currentPanelHeight = tabPanelRef.current?.getBoundingClientRect().height;
      if (currentPanelHeight) {
        setTabPanelMinHeight((currentMinHeight) =>
          Math.max(currentMinHeight, Math.ceil(currentPanelHeight)),
        );
      }
      setActiveTab(nextTab);

      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set("tab", nextTab);
        const newUrl = `${window.location.pathname}?${searchParams.toString()}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", newUrl);
      }
    },
    [activeTab],
  );

  const handlePlaybackTimeChange = useCallback((timeInSeconds: number) => {
    hasPlaybackTimeRef.current = true;
    latestPlaybackTimeRef.current = timeInSeconds;
    transcriptPlaybackListenerRef.current?.(timeInSeconds);
  }, []);

  const subscribeToPlaybackTime = useCallback(
    (listener: (timeInSeconds: number) => void) => {
      transcriptPlaybackListenerRef.current = listener;
      if (hasPlaybackTimeRef.current) {
        listener(latestPlaybackTimeRef.current);
      }

      return () => {
        if (transcriptPlaybackListenerRef.current === listener) {
          transcriptPlaybackListenerRef.current = null;
        }
      };
    },
    [],
  );

  const handlePlayTranscriptSegment = useCallback((timeInSeconds: number) => {
    const didStart = videoPlayerRef.current?.playFromPlaybackTime(timeInSeconds) ?? false;
    if (didStart) {
      videoContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    return didStart;
  }, []);

  const handleLessonSaved = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleOpenAiResult = useCallback(
    (type: AdminAiGenerationType, resourceId: string | null) => {
      const tab: LessonContentTabKey = {
        SUMMARY: "summary",
        QUIZ: "quiz",
        FLASHCARD: "flashcard",
        TEST: "test",
      }[type] as LessonContentTabKey;
      if (resourceId && type !== "SUMMARY") {
        setPreferredSetIds((current) => ({ ...current, [type]: resourceId }));
      }
      handleTabChange(tab);
      window.requestAnimationFrame(() => {
        document
          .getElementById(lessonContentPanelId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [handleTabChange, lessonContentPanelId],
  );

  const handleRequestedGenerationHandled = useCallback(
    () => setRequestedGeneration(null),
    [],
  );

  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";

  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );

  if (queryRenderState === "loading") {
    return (
      <main data-admin-theme="true" className="theme-page">
        <div
          className={cn(
            "admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200",
            isSidebarCollapsed
              ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
              : "lg:grid-cols-[17rem_minmax(0,1fr)]",
          )}
        >
          <AdminCoursesSidebar
            subtitle="Quản lý nội dung học"
            items={adminNavItems}
            isDarkTheme={isDarkTheme}
            isCollapsed={isSidebarCollapsed}
            showAdminProfileTools
            onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onToggleDarkTheme={toggleTheme}
          />
          <div className="min-h-[calc(100svh-4rem)] p-5 sm:p-8">
            <AdminLessonDetailSkeleton />
          </div>
        </div>
      </main>
    );
  }

  if (queryRenderState === "error" || !lesson) {
    return (
      <main data-admin-theme="true" className="theme-page">
        <div
          className={cn(
            "admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200",
            isSidebarCollapsed
              ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
              : "lg:grid-cols-[17rem_minmax(0,1fr)]",
          )}
        >
          <AdminCoursesSidebar
            subtitle="Quản lý nội dung học"
            items={adminNavItems}
            isDarkTheme={isDarkTheme}
            isCollapsed={isSidebarCollapsed}
            showAdminProfileTools
            onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onToggleDarkTheme={toggleTheme}
          />
          <div className="min-h-[calc(100svh-4rem)] p-5 sm:p-8">
            <AdminDataErrorState
              description="Vui lòng thử lại để tiếp tục quản lý nội dung buổi học."
              isRetrying={lessonQuery.isFetching}
              onRetry={() => refetch()}
              title="Không tải được thông tin buổi học"
              variant="page"
            />
          </div>
        </div>
      </main>
    );
  }

  const lessonVideoSettings = lesson.customVideoSettings as
    CustomVideoSettings | null | undefined;

  return (
    <main data-admin-theme="true" className="theme-page">
      <div
        className={cn(
          "admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200",
          isSidebarCollapsed
            ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
            : "lg:grid-cols-[17rem_minmax(0,1fr)]",
        )}
      >
        <AdminCoursesSidebar
          subtitle="Quản lý nội dung học"
          items={adminNavItems}
          isDarkTheme={isDarkTheme}
          isCollapsed={isSidebarCollapsed}
          showAdminProfileTools
          onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onToggleDarkTheme={toggleTheme}
        />

        <section className="min-w-0 flex flex-col h-full bg-[var(--theme-bg)] min-h-screen">
          <div className="border-b border-[var(--theme-border)] px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 bg-[var(--theme-bg-subtle)]">
            <button
              onClick={() => router.back()}
              className="theme-button-neutral inline-flex min-h-10 w-fit items-center gap-2 rounded-lg px-3 text-sm font-bold transition"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Chi tiết khóa học
            </button>

            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 text-[var(--theme-text-strong)] text-sm font-medium w-fit">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex items-center gap-1.5 text-[var(--theme-primary)] hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-primary)] transition"
                >
                  <Layers3 className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">
                    {lesson.courseTitle || "Khóa học"}
                  </span>
                </button>
                <ChevronRight className="h-4 w-4 text-[var(--theme-text-disabled)]" />
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-[var(--theme-text-muted)]" />
                  <span className="truncate max-w-[200px]">
                    {lesson.chapterTitle || "Chương"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--theme-text-strong)]">
                    {lesson.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                    {/* Bỏ nhãn loại buổi học ở đây vì đã có trong phần thông tin chi tiết */}
                    {lesson.trialEnabled && (
                      <span className="rounded-full bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)] px-2 py-0.5">
                        Cho phép học thử
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLessonEditorOpen(true)}
                  disabled={!lesson.learningPathId}
                  className="theme-button-primary-subtle inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Chỉnh sửa buổi học
                </button>
              </div>
            </div>
            <div className="w-full flex flex-col gap-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Video Section */}
                  <div className="sm:rounded-xl sm:border border-[var(--theme-border)] bg-white dark:bg-slate-950 sm:overflow-hidden sm:shadow-sm w-screen relative left-1/2 -ml-[50vw] sm:w-auto sm:static sm:left-auto sm:ml-0">
                    <div className="px-4 py-3 sm:border-b border-[var(--theme-border)] sm:bg-[var(--theme-bg-subtle)] font-bold text-sm text-[var(--theme-text-strong)] hidden sm:block">
                      Video bài giảng
                    </div>
                    <div className="p-0 sm:p-4 sm:bg-[var(--theme-bg-subtle)]/30 flex justify-center items-center">
                      {lesson.videoUrl ? (
                        <div className="w-full">
                          <div
                            ref={videoContainerRef}
                            className="w-full aspect-video sm:rounded-lg sm:border border-[var(--theme-border)] bg-black flex items-center justify-center relative group"
                          >
                            {lesson.videoUrl.includes("youtube.com") ||
                            lesson.videoUrl.includes("youtu.be") ? (
                              <CustomYoutubePlayer
                                ref={videoPlayerRef}
                                videoUrl={lesson.videoUrl}
                                settings={previewSettings || lessonVideoSettings}
                                title={lesson.title}
                                onPlaybackTimeChange={handlePlaybackTimeChange}
                              />
                            ) : (
                              <a
                                href={lesson.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-white hover:text-white/80 hover:underline flex flex-col items-center gap-3"
                              >
                                <div className="p-4 rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
                                  <BookOpen className="h-8 w-8" />
                                </div>
                                <span className="font-medium text-sm">
                                  Mở video bài giảng
                                </span>
                              </a>
                            )}
                          </div>

                          {/* Cài đặt Video */}
                          {lesson.videoUrl &&
                            (lesson.videoUrl.includes("youtube.com") ||
                              lesson.videoUrl.includes("youtu.be")) && (
                              <div className="px-4 sm:px-0">
                                <LessonVideoSettingsForm
                                  lessonId={lessonId}
                                  initialSettings={lessonVideoSettings}
                                />
                                <LessonVideoChaptersForm
                                  lessonId={lessonId}
                                  videoUrl={lesson.videoUrl}
                                  initialSettings={lessonVideoSettings}
                                  onPreviewSettingsChange={setPreviewSettings}
                                />
                                <LessonVideoTranscriptPanel
                                  lessonId={lessonId}
                                  initialSettings={lessonVideoSettings}
                                  onPlayFromTime={handlePlayTranscriptSegment}
                                  subscribeToPlaybackTime={subscribeToPlaybackTime}
                                />
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded-lg border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] flex flex-col items-center justify-center text-[var(--theme-text-muted)] p-6 text-center">
                          <div className="p-4 rounded-full bg-[var(--theme-bg-hover)] mb-3">
                            <Layers className="h-8 w-8" />
                          </div>
                          <p className="font-medium text-[var(--theme-text-strong)]">
                            Chưa có video
                          </p>
                          <p className="text-xs mt-1">
                            Buổi học này chưa được cấu hình video
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description Section */}
                  <div className="rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] font-bold text-sm text-[var(--theme-text-strong)]">
                      Mô tả buổi học
                    </div>
                    <div className="p-4 text-sm text-[var(--theme-text)] whitespace-pre-wrap leading-relaxed">
                      {lesson.shortDescription || "-"}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Info Section */}
                  <div className="rounded-xl border border-[var(--theme-border)] bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] font-bold text-sm text-[var(--theme-text-strong)]">
                      Thông tin chi tiết
                    </div>
                    <div className="p-4 space-y-5">
                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">
                          Loại buổi học
                        </p>
                        <p className="text-sm font-semibold text-[var(--theme-text-strong)]">
                          {lesson.lessonType === "BASIC"
                            ? "Cơ bản"
                            : "Học trực tuyến (Live)"}
                        </p>
                      </div>

                      {lesson.lessonType === "LIVE" && (
                        <div>
                          <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">
                            Link học trực tuyến
                          </p>
                          {lesson.liveUrl ? (
                            <a
                              href={lesson.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-[var(--theme-primary)] hover:underline break-all"
                            >
                              {lesson.liveUrl}
                            </a>
                          ) : (
                            <p className="text-sm text-[var(--theme-text-strong)]">-</p>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">
                          Thời gian bắt đầu
                        </p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          {lesson.scheduledAt
                            ? new Intl.DateTimeFormat("vi-VN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(lesson.scheduledAt))
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">
                          Thời gian mở bài tập
                        </p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          {lesson.examOpenAt
                            ? new Intl.DateTimeFormat("vi-VN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(lesson.examOpenAt))
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">
                          Điểm hoàn thành tối thiểu
                        </p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          {lesson.completionMinScore}/10
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">
                          Trạng thái
                        </p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                              statusStyles[lesson.status],
                            )}
                          >
                            {statusLabels[lesson.status]}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <AdminAiGenerationPanel
                lessonId={lessonId}
                quizTargetSetId={activeQuizSetId}
                requestedGeneration={requestedGeneration}
                onOpenResult={handleOpenAiResult}
                onRequestedGenerationHandled={handleRequestedGenerationHandled}
              />

              <LessonContentTabs
                activeTab={activeTab}
                panelId={lessonContentPanelId}
                onChange={handleTabChange}
              />

              <div
                ref={tabPanelRef}
                id={lessonContentPanelId}
                role="tabpanel"
                className="min-h-[400px] overflow-hidden bg-transparent sm:rounded-xl sm:border sm:border-[var(--theme-border)] sm:bg-[var(--theme-bg-subtle)]"
                style={{ minHeight: tabPanelMinHeight }}
              >
                {activeTab === "documents" &&
                !isLessonEditorOpen &&
                lesson.learningPathId ? (
                  <LessonDocumentsTab
                    lessonId={lessonId}
                    learningPathId={lesson.learningPathId}
                    onSaved={handleLessonSaved}
                  />
                ) : null}

                {activeTab === "quiz" && (
                  <div className="h-full sm:p-6">
                    <AdminQuizTab
                      initialQuizData={initialQuizData}
                      lessonId={lessonId}
                      onSelectedSetIdChange={setActiveQuizSetId}
                      preferredSetId={preferredSetIds.QUIZ}
                    />
                  </div>
                )}

                {activeTab === "flashcard" && (
                  <div className="h-full sm:p-6">
                    <AdminFlashcardsTab
                      lessonId={lessonId}
                      preferredSetId={preferredSetIds.FLASHCARD}
                    />
                  </div>
                )}

                {activeTab === "test" && (
                  <div className="h-full sm:p-6">
                    <AdminTestsTab
                      lessonId={lessonId}
                      preferredSetId={preferredSetIds.TEST}
                    />
                  </div>
                )}

                {activeTab === "summary" && (
                  <AdminLessonSummaryTab
                    lessonId={lessonId}
                    lessonTitle={lesson?.title}
                    onEdit={() => {
                      setRequestedGeneration({ type: "SUMMARY", mode: "EDIT" });
                    }}
                    onRegenerate={() => {
                      setRequestedGeneration({ type: "SUMMARY", mode: "CREATE" });
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {isLessonEditorOpen && lesson.learningPathId ? (
        <LessonDetailEditorDialog
          isOpen={isLessonEditorOpen}
          lessonId={lessonId}
          learningPathId={lesson.learningPathId}
          onClose={() => setIsLessonEditorOpen(false)}
          onSaved={handleLessonSaved}
        />
      ) : null}
    </main>
  );
}

function AdminLessonDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải chi tiết buổi học"
      className="min-h-[calc(100svh-4rem)] animate-pulse space-y-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-40 rounded-full" />
          <SkeletonBlock className="h-8 w-72 max-w-full rounded-full" />
        </div>
        <SkeletonBlock className="h-11 w-32 rounded-lg" />
      </div>
      <SkeletonBlock className="aspect-video rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className="h-11 w-32 shrink-0 rounded-lg" />
        ))}
      </div>
      <SkeletonBlock className="h-80 rounded-xl" />
    </div>
  );
}

function AdminLessonDocumentsTabSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải tab tài liệu buổi học"
      className="min-h-72 animate-pulse space-y-4 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-11 rounded-lg" />
        <SkeletonBlock className="h-11 rounded-lg" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg border border-[var(--theme-border)] p-4 sm:grid-cols-[minmax(0,1fr)_6rem]"
        >
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-1/2 rounded-full" />
            <SkeletonBlock className="h-3.5 w-1/3 rounded-full opacity-70" />
          </div>
          <SkeletonBlock className="h-9 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
