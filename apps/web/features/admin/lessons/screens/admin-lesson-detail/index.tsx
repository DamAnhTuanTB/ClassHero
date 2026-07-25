"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminLesson } from "../../hooks/use-admin-lesson";
import { AdminQuizTab } from "@/features/admin/quiz/components/admin-quiz-tab";
import { 
  Loader2, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  Layers, 
  ClipboardList,
  ChevronRight,
  ArrowLeft,
  Layers3
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/components/admin/courses/admin-courses-sidebar";
import { statusLabels, statusStyles } from "@/features/admin/courses/admin-courses-data";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import { CustomYoutubePlayer } from "@/components/shared/custom-youtube-player";
import { LessonVideoSettingsForm } from "../../components/lesson-video-settings-form";
import { useThemeStore } from "@/lib/theme-store";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";

interface AdminLessonDetailManagerProps {
  lessonId: string;
}

type TabKey = "documents" | "quiz" | "flashcard" | "test";

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Khóa học", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: false },
  { label: "Tài liệu", icon: FileText, active: false },
];

export function AdminLessonDetailManager({ lessonId }: AdminLessonDetailManagerProps) {
  const router = useRouter();
  const { data: lesson, isLoading, error } = useAdminLesson(lessonId);
  const [activeTab, setActiveTab] = useState<TabKey>("quiz");

  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : false;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );

  if (isLoading) {
    return (
      <main data-admin-theme="true" className="theme-page">
        <div className={cn("admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200", isSidebarCollapsed ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
          <AdminCoursesSidebar
            subtitle="Quản lý nội dung học"
            items={adminNavItems}
            isDarkTheme={isDarkTheme}
            isCollapsed={isSidebarCollapsed}
            showAdminProfileTools
            onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onToggleDarkTheme={toggleTheme}
          />
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-text-muted)]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !lesson) {
    return (
      <main data-admin-theme="true" className="theme-page">
        <div className={cn("admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200", isSidebarCollapsed ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
          <AdminCoursesSidebar
            subtitle="Quản lý nội dung học"
            items={adminNavItems}
            isDarkTheme={isDarkTheme}
            isCollapsed={isSidebarCollapsed}
            showAdminProfileTools
            onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onToggleDarkTheme={toggleTheme}
          />
          <div className="p-6">
            <div className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-bg)] p-4 text-[var(--theme-danger-text)]">
              <p className="text-sm font-bold">
                {error?.message || "Không tìm thấy buổi học"}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const courseId = lesson.learningPathId;

  return (
    <main data-admin-theme="true" className="theme-page">
      <div className={cn("admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200", isSidebarCollapsed ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
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
          <div className="border-b border-[var(--theme-border)] px-6 py-5 space-y-5 bg-[var(--theme-bg-subtle)]">
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
                <div className="flex items-center gap-1.5 text-[var(--theme-primary)]">
                  <Layers3 className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{lesson.courseTitle || "Khóa học"}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--theme-text-disabled)]" />
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-[var(--theme-text-muted)]" />
                  <span className="truncate max-w-[200px]">{lesson.chapterTitle || "Chương"}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--theme-text-strong)]">{lesson.title}</h1>
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                    {/* Bỏ nhãn loại buổi học ở đây vì đã có trong phần thông tin chi tiết */}
                    {lesson.trialEnabled && (
                      <span className="rounded-full bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)] px-2 py-0.5">
                        Cho phép học thử
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
               <div className="w-full flex flex-col gap-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Video Section */}
                  <div className="sm:rounded-xl sm:border border-[var(--theme-border)] sm:bg-[var(--theme-bg)] sm:overflow-hidden sm:shadow-sm w-screen relative left-1/2 -ml-[50vw] sm:w-auto sm:static sm:left-auto sm:ml-0">
                    <div className="px-4 py-3 sm:border-b border-[var(--theme-border)] sm:bg-[var(--theme-bg-subtle)] font-bold text-sm text-[var(--theme-text-strong)] hidden sm:block">
                      Video bài giảng
                    </div>
                    <div className="p-0 sm:p-4 sm:bg-[var(--theme-bg-subtle)]/30 flex justify-center items-center">
                      {lesson.videoUrl ? (
                        <div className="w-full">
                          <div className="w-full aspect-video sm:rounded-lg sm:border border-[var(--theme-border)] bg-black flex items-center justify-center relative group">
                            {lesson.videoUrl.includes("youtube.com") || lesson.videoUrl.includes("youtu.be") ? (
                              <CustomYoutubePlayer videoUrl={lesson.videoUrl} settings={lesson.customVideoSettings as any} title={lesson.title} />
                            ) : (
                              <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-white hover:text-white/80 hover:underline flex flex-col items-center gap-3">
                                <div className="p-4 rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
                                  <BookOpen className="h-8 w-8" />
                                </div>
                                <span className="font-medium text-sm">Mở video bài giảng</span>
                              </a>
                            )}
                          </div>
                          
                          {/* Cài đặt Video */}
                          {lesson.videoUrl && (lesson.videoUrl.includes("youtube.com") || lesson.videoUrl.includes("youtu.be")) && (
                            <div className="px-4 sm:px-0">
                              <LessonVideoSettingsForm 
                                lessonId={lessonId} 
                                initialSettings={lesson.customVideoSettings as any} 
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded-lg border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] flex flex-col items-center justify-center text-[var(--theme-text-muted)] p-6 text-center">
                          <div className="p-4 rounded-full bg-[var(--theme-bg-hover)] mb-3">
                            <Layers className="h-8 w-8" />
                          </div>
                          <p className="font-medium text-[var(--theme-text-strong)]">Chưa có video</p>
                          <p className="text-xs mt-1">Buổi học này chưa được cấu hình video</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description Section */}
                  <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] overflow-hidden shadow-sm">
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
                  <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] font-bold text-sm text-[var(--theme-text-strong)]">
                      Thông tin chi tiết
                    </div>
                    <div className="p-4 space-y-5">
                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">Loại buổi học</p>
                        <p className="text-sm font-semibold text-[var(--theme-text-strong)]">
                          {lesson.lessonType === "BASIC" ? "Cơ bản" : "Học trực tuyến (Live)"}
                        </p>
                      </div>
                      
                      {lesson.lessonType === "LIVE" && (
                        <div>
                          <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">Link học trực tuyến</p>
                          {lesson.liveUrl ? (
                            <a href={lesson.liveUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--theme-primary)] hover:underline break-all">
                              {lesson.liveUrl}
                            </a>
                          ) : (
                            <p className="text-sm text-[var(--theme-text-strong)]">-</p>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">Thời gian bắt đầu</p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          {lesson.scheduledAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(lesson.scheduledAt)) : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">Thời gian mở bài tập</p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          {lesson.examOpenAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(lesson.examOpenAt)) : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">Điểm hoàn thành tối thiểu</p>
                        <p className="text-sm text-[var(--theme-text-strong)]">{lesson.completionMinScore}/10</p>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 uppercase tracking-wider">Trạng thái</p>
                        <p className="text-sm text-[var(--theme-text-strong)]">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", statusStyles[lesson.status])}>
                            {statusLabels[lesson.status]}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-2 overflow-x-auto no-scrollbar mt-4">
                <button
                  onClick={() => setActiveTab("documents")}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-bold transition-colors border-b-2",
                    activeTab === "documents"
                      ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)] hover:bg-[var(--theme-bg-hover)]"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Tài liệu
                </button>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-bold transition-colors border-b-2",
                    activeTab === "quiz"
                      ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)] hover:bg-[var(--theme-bg-hover)]"
                  )}
                >
                  <HelpCircle className="h-4 w-4" />
                  Quiz
                </button>
                <button
                  onClick={() => setActiveTab("flashcard")}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-bold transition-colors border-b-2",
                    activeTab === "flashcard"
                      ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)] hover:bg-[var(--theme-bg-hover)]"
                  )}
                >
                  <Layers className="h-4 w-4" />
                  Flashcard
                </button>
                <button
                  onClick={() => setActiveTab("test")}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-bold transition-colors border-b-2",
                    activeTab === "test"
                      ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
                      : "border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)] hover:bg-[var(--theme-bg-hover)]"
                  )}
                >
                  <ClipboardList className="h-4 w-4" />
                  Test
                </button>
              </div>
              
              <div className="bg-[var(--theme-bg-subtle)] border border-[var(--theme-border)] rounded-xl min-h-[400px]">
                {activeTab === "documents" && (
                  <div className="p-6 text-[var(--theme-text-muted)] text-sm font-medium">Tính năng tài liệu đang được phát triển.</div>
                )}
                
                {activeTab === "quiz" && (
                  <div className="p-6 h-full">
                    <AdminQuizTab lessonId={lessonId} />
                  </div>
                )}
                
                {activeTab === "flashcard" && (
                  <div className="p-6 text-[var(--theme-text-muted)] text-sm font-medium">Quản lý Flashcard sẽ được tích hợp ở M6.3.</div>
                )}
                
                {activeTab === "test" && (
                  <div className="p-6 text-[var(--theme-text-muted)] text-sm font-medium">Quản lý Bài kiểm tra sẽ được tích hợp ở M6.4.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
