"use client";

import {
  ArrowLeft,
  BookOpen,
  Brain,
  ChevronRight,
  ClipboardCheck,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { StudentDetailMobileBrandBar } from "@/components/student/layout/student-detail-mobile-brand-bar";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { usePracticeTabTransition } from "@/features/student/lessons/hooks/use-practice-tab-transition";
import { LessonNavigationControl } from "@/features/student/lessons/screens/student-lesson-screen/components/lesson-navigation-control";
import { LessonSummaryPanel } from "@/features/student/lessons/screens/student-lesson-screen/components/lesson-summary-panel";
import { LessonVideoPanel } from "@/features/student/lessons/screens/student-lesson-screen/components/lesson-video-panel";
import { QuizCurtainTransition } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-curtain-transition";
import { QuizLearningPanel } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-learning-panel";
import { QuizRunnerLoadingScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-runner-screen";
import { FlashcardRunnerLoadingScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/flashcard-runner-screen";
import { useStableLoadingVisibility } from "@/lib/use-stable-loading-visibility";
import { useStudentLessonQueries } from "@/features/student/lessons/hooks/use-student-lesson-queries";
import type {
  StudentLearningSurface,
  StudentLesson,
  StudentLessonTab,
} from "@/features/student/lessons/types/student-lesson-types";
import { cn } from "@/lib/utils";
import type { AppThemeMode } from "@/lib/theme-store";

const loadFlashcardLearningPanel = () =>
  import("@/features/student/lessons/screens/student-lesson-screen/components/flashcard-learning-panel");
const loadTestLearningPanel = () =>
  import("@/features/student/lessons/screens/student-lesson-screen/components/test-learning-panel");

const FlashcardLearningPanel = dynamic(() =>
  loadFlashcardLearningPanel().then((module) => module.FlashcardLearningPanel),
);
const TestLearningPanel = dynamic(() =>
  loadTestLearningPanel().then((module) => module.TestLearningPanel),
);

const tabItems: Array<{
  id: StudentLessonTab;
  label: string;
  icon: typeof BookOpen;
  nodeClassName: string;
  activeNodeClassName: string;
  nodeBaseClassName: string;
  activeNodeBaseClassName: string;
  activeLabelClassName: string;
  focusRingClassName: string;
}> = [
  {
    id: "lesson",
    label: "Bài học",
    icon: BookOpen,
    nodeClassName:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    activeNodeClassName:
      "border-amber-600 bg-amber-400 text-white dark:border-amber-300 dark:bg-amber-500 dark:text-white",
    nodeBaseClassName: "bg-amber-300 dark:bg-amber-800",
    activeNodeBaseClassName: "bg-amber-500 dark:bg-amber-700",
    activeLabelClassName: "text-amber-700 dark:text-amber-300",
    focusRingClassName: "group-focus-visible:ring-amber-300/50",
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: HelpCircle,
    nodeClassName:
      "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    activeNodeClassName:
      "border-sky-700 bg-sky-500 text-white dark:border-sky-300 dark:bg-sky-600",
    nodeBaseClassName: "bg-sky-300 dark:bg-sky-800",
    activeNodeBaseClassName: "bg-sky-600 dark:bg-sky-700",
    activeLabelClassName: "text-sky-700 dark:text-sky-300",
    focusRingClassName: "group-focus-visible:ring-sky-300/50",
  },
  {
    id: "flashcard",
    label: "Flashcard",
    icon: Brain,
    nodeClassName:
      "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    activeNodeClassName:
      "border-violet-700 bg-violet-500 text-white dark:border-violet-300 dark:bg-violet-600",
    nodeBaseClassName: "bg-violet-300 dark:bg-violet-800",
    activeNodeBaseClassName: "bg-violet-600 dark:bg-violet-700",
    activeLabelClassName: "text-violet-700 dark:text-violet-300",
    focusRingClassName: "group-focus-visible:ring-violet-300/50",
  },
  {
    id: "test",
    label: "Bài thi",
    icon: ClipboardCheck,
    nodeClassName:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    activeNodeClassName:
      "border-emerald-700 bg-emerald-500 text-white dark:border-emerald-300 dark:bg-emerald-600",
    nodeBaseClassName: "bg-emerald-300 dark:bg-emerald-800",
    activeNodeBaseClassName: "bg-emerald-600 dark:bg-emerald-700",
    activeLabelClassName: "text-emerald-700 dark:text-emerald-300",
    focusRingClassName: "group-focus-visible:ring-emerald-300/50",
  },
];

export function StudentLessonScreen({
  initialLearningSurface,
  initialLesson,
  initialTab,
  initialThemeMode,
  lessonId,
}: {
  initialLearningSurface: StudentLearningSurface | null;
  initialLesson?: StudentLesson | null;
  initialTab: StudentLessonTab;
  initialThemeMode: AppThemeMode;
  lessonId: string;
}) {
  const [activeTab, setActiveTab] = useState<StudentLessonTab>(initialTab);
  const [learningSurface, setLearningSurface] = useState(initialLearningSurface);
  const [pendingTab, setPendingTab] = useState<StudentLessonTab | null>(null);
  const [preparedQuizSetId, setPreparedQuizSetId] = useState<string | null>(
    initialLearningSurface?.kind === "quiz-runner" ||
      initialLearningSurface?.kind === "quiz-result"
      ? initialLearningSurface.setId
      : initialLesson?.quizSets[0]?.id ?? null,
  );
  const tabRequestIdRef = useRef(0);
  const {
    flashcardsQuery,
    isAuthHydrated,
    isFlashcardsPending,
    isTestStatusPending,
    lessonQuery,
    prepareQuizTab,
    refreshLearningProgress,
    testStatusQuery,
    testHistoryQuery,
    token,
  } = useStudentLessonQueries(lessonId, initialLesson);
  const isInitialPending =
    lessonQuery.data === undefined &&
    (!isAuthHydrated || lessonQuery.isLoading);
  const shouldShowFlashcardsLoading = useStableLoadingVisibility(
    isFlashcardsPending,
  );
  const shouldShowTestLoading = useStableLoadingVisibility(isTestStatusPending);
  const isQuizSurfaceResume =
    learningSurface?.kind === "quiz-runner" ||
    learningSurface?.kind === "quiz-result";
  const isFlashcardSurfaceResume =
    learningSurface?.kind === "flashcard-runner" ||
    learningSurface?.kind === "flashcard-result";
  const isTestSurfaceResume =
    learningSurface?.kind === "test-runner" ||
    learningSurface?.kind === "test-result";

  useEffect(() => {
    if (!lessonQuery.data) return;
    void loadFlashcardLearningPanel();
    void loadTestLearningPanel();
  }, [lessonQuery.data]);

  useEffect(() => {
    let isCancelled = false;

    void prepareQuizTab()
      .then((quizSetId) => {
        if (!isCancelled && quizSetId) {
          setPreparedQuizSetId(quizSetId);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [prepareQuizTab]);

  const selectTab = useCallback((tab: StudentLessonTab) => {
    tabRequestIdRef.current += 1;
    setActiveTab(tab);
    setLearningSurface(null);
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("tab", tab);
      nextUrl.searchParams.delete("learningSurface");
      nextUrl.searchParams.delete("learningSetId");
      nextUrl.searchParams.delete("learningAttemptId");
      if (window.location.search !== nextUrl.search) {
        window.history.replaceState(window.history.state, "", nextUrl.pathname + nextUrl.search);
      }
    }
  }, []);

  const handleTabSelect = useCallback(
    (tab: StudentLessonTab) => {
      const requestId = tabRequestIdRef.current + 1;
      tabRequestIdRef.current = requestId;

      if (tab !== "quiz" || activeTab === "quiz") {
        setPendingTab(null);
        selectTab(tab);
        return;
      }

      setPendingTab("quiz");
      void prepareQuizTab()
        .then((quizSetId) => {
          if (tabRequestIdRef.current !== requestId) return;
          if (quizSetId) setPreparedQuizSetId(quizSetId);
          setPendingTab(null);
          selectTab("quiz");
        })
        .catch(() => {
          if (tabRequestIdRef.current !== requestId) return;
          setPendingTab(null);
          selectTab("quiz");
        });
    },
    [activeTab, prepareQuizTab, selectTab],
  );
  const practiceTabTransition = usePracticeTabTransition(selectTab);

  if (isInitialPending) {
    if (isQuizSurfaceResume || isTestSurfaceResume)
      return <QuizRunnerLoadingScreen />;
    if (isFlashcardSurfaceResume) return <FlashcardRunnerLoadingScreen />;
    return <StudentLessonPageSkeleton initialThemeMode={initialThemeMode} />;
  }

  const lesson = lessonQuery.data;
  if (!lesson || lessonQuery.isError) {
    return (
      <StatePage
        initialThemeMode={initialThemeMode}
        icon={<BookOpen className="h-8 w-8" />}
        title="Chưa mở được bài học"
        copy={
          lessonQuery.error instanceof Error
            ? lessonQuery.error.message
            : "Bạn kiểm tra lại quyền học hoặc quay về khóa học."
        }
      />
    );
  }

  if (
    isFlashcardSurfaceResume &&
    flashcardsQuery.data === undefined &&
    !flashcardsQuery.isError
  ) {
    return <FlashcardRunnerLoadingScreen />;
  }

  if (
    isTestSurfaceResume &&
    testStatusQuery.data === undefined &&
    !testStatusQuery.isError
  ) {
    return <QuizRunnerLoadingScreen />;
  }

  const testHistoryMaxScore = testHistoryQuery.data?.items
    ? Math.max(-1, ...testHistoryQuery.data.items.map((item) => item.score ?? -1))
    : -1;

  const bestTestScore = Math.max(
    testStatusQuery.data?.bestAttempt?.score ?? -1,
    testStatusQuery.data?.latestSubmittedAttempt?.score ?? -1,
    testHistoryMaxScore,
  );
  const hasPassedCurrentLessonTest =
    bestTestScore >= lesson.completionMinScore;

  return (
    <main
      className="min-h-screen px-2 py-4 sm:px-6 lg:px-8"
      data-student-lesson-detail="true"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div className="hidden lg:block">
        <StudentCoursesHeader title={lesson.title} initialThemeMode={initialThemeMode} />
      </div>
      <div className="mx-auto max-w-4xl">
        <StudentDetailMobileBrandBar />

        <section className="mt-1 px-1 pb-2 pt-2 sm:mt-4 sm:px-2 sm:py-5">
          <nav
            aria-label="Vị trí bài học"
            className="flex min-w-0 items-center gap-1.5 text-sm font-black sm:gap-2 sm:text-base lg:text-lg"
          >
            <Link
              href={`/student/courses/${lesson.learningPath.slug}`}
              className="shrink-0 text-sky-700 transition hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
            >
              {lesson.learningPath.title}
            </Link>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-sky-400 dark:text-sky-600"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate text-[#058760] dark:text-emerald-300">
              {lesson.chapter.title}
            </span>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-emerald-400 dark:text-emerald-600"
              aria-hidden="true"
            />
          </nav>

          <h1 className="mt-3 text-xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl">
            {lesson.title}
          </h1>
        </section>

        <LessonVideoPanel lesson={lesson} />

        <nav
          aria-label="Nội dung buổi học"
          className="relative mt-3 grid grid-cols-4 gap-2 px-1 py-5 sm:gap-3 sm:px-2 lg:mt-6 lg:px-3 lg:py-6"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 300 48"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-[12.5%] top-5 h-12 w-3/4 text-sky-300 dark:text-sky-700 lg:top-6 lg:h-14"
          >
            <path
              d="M 0 24 L 100 40 L 200 24 L 300 40"
              fill="none"
              className="stroke-white dark:stroke-slate-800"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="12"
            />
            <path
              d="M 0 24 L 100 40 L 200 24 L 300 40"
              fill="none"
              stroke="currentColor"
              strokeDasharray="7 10"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="5"
            />
          </svg>

          {tabItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = (pendingTab ?? activeTab) === item.id;
            const isCurrent = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabSelect(item.id)}
                aria-current={isCurrent ? "page" : undefined}
                aria-busy={pendingTab === item.id ? true : undefined}
                className={cn(
                  "group relative z-10 flex min-w-0 flex-col items-center gap-2 bg-transparent p-0 text-[11px] font-black transition-transform duration-200 active:scale-95 focus-visible:outline-none lg:gap-2.5",
                  index % 2 === 0 ? "-translate-y-2" : "translate-y-2",
                )}
              >
                <span
                  className={cn(
                    "relative h-16 w-16 shrink-0 rounded-full transition-transform duration-200 group-hover:-translate-y-0.5 group-focus-visible:ring-4 lg:h-20 lg:w-20",
                    item.focusRingClassName,
                    isActive && "scale-110",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 translate-y-1 rounded-full shadow-[0_6px_10px_-9px_rgba(15,23,42,0.4)] ring-1 ring-inset ring-white/25 transition-colors duration-200 dark:shadow-[0_6px_10px_-9px_rgba(0,0,0,0.6)] dark:ring-white/10",
                      isActive ? item.activeNodeBaseClassName : item.nodeBaseClassName,
                    )}
                  />
                  <span
                    className={cn(
                      "relative flex h-16 w-16 items-center justify-center rounded-full border-[3px] transition-colors duration-200 lg:h-20 lg:w-20",
                      isActive ? item.activeNodeClassName : item.nodeClassName,
                    )}
                  >
                    <Icon className="h-7 w-7 lg:h-9 lg:w-9" aria-hidden="true" />
                  </span>
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-sm font-black text-slate-500 transition-colors dark:text-[var(--theme-text-muted)] lg:text-base",
                    isActive && item.activeLabelClassName,
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 min-h-40">
          {activeTab === "lesson" ? (
            <LessonSummaryPanel lesson={lesson} />
          ) : activeTab === "quiz" ? (
            <QuizLearningPanel
              autoStart={practiceTabTransition.autoStartTarget === "quiz"}
              initialQuizSetId={preparedQuizSetId}
              initialSurface={
                learningSurface?.kind === "quiz-runner" ||
                learningSurface?.kind === "quiz-result"
                  ? learningSurface
                  : null
              }
              lesson={lesson}
              onAutoStartHandled={
                practiceTabTransition.completePracticeTabOpen
              }
              token={token}
              onProgressChanged={refreshLearningProgress}
            />
          ) : activeTab === "test" ? (
            isTestStatusPending || shouldShowTestLoading ? (
              shouldShowTestLoading ? (
                <LearningPanelSkeleton />
              ) : (
                <div aria-busy="true" className="min-h-56" />
              )
            ) : (
              <TestLearningPanel
                hasFlashcardContent={
                  flashcardsQuery.data
                    ? flashcardsQuery.data.some((set) => set.flashcards.length > 0)
                    : lesson.flashcardSets.some((set) => set.cardCount > 0)
                }
                hasQuizContent={lesson.quizSets.some(
                  (set) => set.questionCount > 0,
                )}
                initialSurface={
                  learningSurface?.kind === "test-runner" ||
                  learningSurface?.kind === "test-result"
                    ? learningSurface
                    : null
                }
                lesson={lesson}
                status={testStatusQuery.data}
                token={token}
                onStartPrerequisite={practiceTabTransition.openPracticeTab}
                onProgressChanged={refreshLearningProgress}
              />
            )
          ) : isFlashcardsPending || shouldShowFlashcardsLoading ? (
            shouldShowFlashcardsLoading ? (
              <LearningPanelSkeleton />
            ) : (
              <div aria-busy="true" className="min-h-56" />
            )
          ) : null}

          {!isFlashcardsPending &&
          !shouldShowFlashcardsLoading &&
          activeTab === "flashcard" ? (
            <div>
              <FlashcardLearningPanel
                autoStart={practiceTabTransition.autoStartTarget === "flashcard"}
                initialSurface={
                  learningSurface?.kind === "flashcard-runner" ||
                  learningSurface?.kind === "flashcard-result"
                    ? learningSurface
                    : null
                }
                lesson={lesson}
                onAutoStartHandled={
                  practiceTabTransition.completePracticeTabOpen
                }
                sets={flashcardsQuery.data ?? []}
                token={token}
                onProgressChanged={refreshLearningProgress}
              />
            </div>
          ) : null}
        </div>

        <nav aria-label="Điều hướng bài học" className="mt-6 grid gap-3 sm:grid-cols-2">
          <LessonNavigationControl
            backHref={`/student/courses/${lesson.learningPath.slug}`}
            direction="previous"
            disabledReason="Không có bài học trước trong lộ trình."
            isEnabled={Boolean(lesson.navigation.previous)}
            lesson={lesson.navigation.previous}
          />
          <LessonNavigationControl
            direction="next"
            disabledReason={
              lesson.navigation.next
                ? "Cần hoàn thành bài thi của bài học hiện tại."
                : "Không có bài học kế tiếp trong lộ trình."
            }
            isEnabled={!lesson.navigation.next || hasPassedCurrentLessonTest}
            lesson={lesson.navigation.next}
          />
        </nav>
      </div>
      <QuizCurtainTransition
        ariaLabel={
          practiceTabTransition.target === "flashcard"
            ? "Đang chuẩn bị Flashcard"
            : "Đang chuẩn bị Quiz"
        }
        phase={practiceTabTransition.phase}
        statusText={
          practiceTabTransition.target === "flashcard"
            ? "Đang chuẩn bị Flashcard..."
            : "Đang chuẩn bị Quiz..."
        }
        variant={practiceTabTransition.variant}
      />
    </main>
  );
}

function LearningPanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải nội dung"
      className="min-h-56 animate-pulse rounded-[1.5rem] border border-sky-100 bg-white p-4 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-5 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="ml-auto h-9 w-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-5 h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
      <div className="mt-6 h-14 w-full rounded-2xl bg-slate-200 dark:bg-slate-700" />
    </section>
  );
}

function StudentLessonPageSkeleton({
  initialThemeMode,
}: {
  initialThemeMode: AppThemeMode;
}) {
  return (
    <main
      aria-busy="true"
      aria-label="Đang tải bài học"
      className="min-h-screen px-2 py-4 sm:px-6 lg:px-8"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div className="hidden lg:block">
        <StudentCoursesHeader
          title="Đang tải bài học"
          initialThemeMode={initialThemeMode}
        />
      </div>
      <div className="mx-auto max-w-4xl animate-pulse">
        <StudentDetailMobileBrandBar />
        <div className="h-16 rounded-2xl bg-white dark:bg-[var(--theme-surface)]" />
        <div className="mt-5 h-5 w-52 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-8 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="mt-5 aspect-video rounded-[1.5rem] bg-slate-900" />
        <div className="mt-6 grid grid-cols-4 gap-3 px-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 lg:h-20 lg:w-20" />
              <div className="h-4 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
        <div className="mt-8">
          <LearningPanelSkeleton />
        </div>
      </div>
    </main>
  );
}

function StatePage({
  copy,
  icon,
  initialThemeMode,
  title,
}: {
  copy: string;
  icon: React.ReactNode;
  initialThemeMode: AppThemeMode;
  title: string;
}) {
  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-8 sm:px-6 lg:px-8"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div className="mx-auto w-full max-w-2xl rounded-[1.5rem] border border-sky-100 bg-white px-5 py-12 text-center dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
          {icon}
        </span>
        <h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
          {title}
        </h1>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-500 dark:text-[var(--theme-text-muted)]">
          {copy}
        </p>
        <Link
          href="/student/courses"
          className="mt-6 inline-flex min-h-12 items-center gap-2.5 whitespace-nowrap rounded-xl bg-sky-600 px-5 text-base font-black text-white"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Về khóa học của tôi
        </Link>
      </div>
    </main>
  );
}
