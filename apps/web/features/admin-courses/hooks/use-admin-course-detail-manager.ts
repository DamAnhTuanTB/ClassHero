import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import {
  useAdminCourseMutations,
  useAdminLearningPathQuery,
} from "@/features/admin-courses/hooks/use-admin-course-queries";
import type {
  ChapterFormValues,
  LessonFormValues,
} from "@/features/admin-courses/schemas";
import type { EditorMode, ViewState } from "@/features/admin-courses/types";
import {
  findLessonMatch,
  getAdminCourseDetailStats,
} from "@/features/admin-courses/utils";
import { useAuthGuard } from "@/features/auth/session";
import { ApiRequestError } from "@/lib/api-client";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";

export function useAdminCourseDetailManager(
  pathId: string,
  initialLearningPath?: AdminLearningPath | null,
  initialThemeMode: AppThemeMode = "light",
) {
  const learningPathQuery = useAdminLearningPathQuery(pathId, initialLearningPath);
  const {
    isAuthHydrated,
    isAuthorized: hasAdminAccess,
    session,
  } = useAuthGuard({
    allowedRoles: ["ADMIN"],
    authError: learningPathQuery.error,
  });
  const mutations = useAdminCourseMutations();
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";
  const [path, setPath] = useState(learningPathQuery.data ?? null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [chapterEditorMode, setChapterEditorMode] = useState<EditorMode>("create");
  const [lessonEditorMode, setLessonEditorMode] = useState<EditorMode>("create");
  const [isChapterEditorOpen, setIsChapterEditorOpen] = useState(false);
  const [isLessonEditorOpen, setIsLessonEditorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const selectedChapter =
    path?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const selectedLessonMatch = findLessonMatch(path, selectedLessonId);
  const selectedLesson = selectedLessonMatch?.lesson ?? null;
  const deletingChapter =
    path?.chapters.find((chapter) => chapter.id === deletingChapterId) ?? null;
  const deletingLessonMatch = findLessonMatch(path, deletingLessonId);
  const deletingLesson = deletingLessonMatch?.lesson ?? null;
  const isSavingChapter =
    mutations.createChapter.isPending || mutations.updateChapter.isPending;
  const isSavingLesson =
    mutations.createLesson.isPending || mutations.updateLesson.isPending;

  useEffect(() => {
    if (learningPathQuery.data !== undefined) {
      setPath(learningPathQuery.data);
    }
  }, [learningPathQuery.data]);

  useEffect(() => {
    if (!path || selectedChapterId) {
      return;
    }

    setSelectedChapterId(path.chapters[0]?.id ?? null);
  }, [path, selectedChapterId]);

  const courseStats = useMemo(() => getAdminCourseDetailStats(path), [path]);

  function startCreateChapter() {
    setChapterEditorMode("create");
    setSelectedChapterId(null);
    setIsChapterEditorOpen(true);
  }

  function startEditChapter(chapterId: string) {
    const chapter = path?.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      return;
    }

    setSelectedChapterId(chapter.id);
    setChapterEditorMode("edit");
    setIsChapterEditorOpen(true);
  }

  async function saveChapter(values: ChapterFormValues) {
    if (!path) {
      return;
    }

    const duplicatedOrder = path.chapters.some(
      (chapter) =>
        chapter.orderIndex === values.orderIndex &&
        (chapterEditorMode === "create" || chapter.id !== selectedChapter?.id),
    );

    if (duplicatedOrder) {
      throw new Error("DUPLICATED_CHAPTER_ORDER");
    }

    try {
      if (chapterEditorMode === "create") {
        const createdChapter = await mutations.createChapter.mutateAsync({
          pathId: path.id,
          values,
        });
        setSelectedChapterId(createdChapter.id);
      } else if (selectedChapter) {
        await mutations.updateChapter.mutateAsync({
          chapterId: selectedChapter.id,
          values,
        });
      }

      await mutations.invalidateLearningPath(path.id);
      await learningPathQuery.refetch();
      toast.success(
        chapterEditorMode === "create" ? "Đã thêm chương học" : "Đã lưu chương học",
        {
          description: "Cấu trúc chương học của lộ trình đã được cập nhật.",
        },
      );
      setChapterEditorMode("create");
      setIsChapterEditorOpen(false);
    } catch (error) {
      if (isConflictError(error)) {
        throw new Error("DUPLICATED_CHAPTER_ORDER", { cause: error });
      }

      toast.error("Chưa lưu được chương học", {
        description: getErrorMessage(error),
      });
    }
  }

  function startCreateLesson(chapterId?: string) {
    const targetChapter =
      path?.chapters.find((chapter) => chapter.id === chapterId) ??
      selectedChapter ??
      path?.chapters[0] ??
      null;

    if (!targetChapter) {
      toast.warning("Hãy tạo chương học trước");
      return;
    }

    setLessonEditorMode("create");
    setSelectedChapterId(targetChapter.id);
    setSelectedLessonId(null);
    setIsLessonEditorOpen(true);
  }

  function startEditLesson(lessonId: string) {
    const match = findLessonMatch(path, lessonId);
    if (!match) {
      return;
    }

    setSelectedChapterId(match.chapter.id);
    setSelectedLessonId(match.lesson.id);
    setLessonEditorMode("edit");
    setIsLessonEditorOpen(true);
  }

  async function saveLesson(values: LessonFormValues) {
    if (!path || !selectedChapterId) {
      return;
    }

    const targetChapter = path.chapters.find(
      (chapter) => chapter.id === selectedChapterId,
    );
    if (!targetChapter) {
      return;
    }

    const duplicatedOrder = targetChapter.lessons.some(
      (lesson) =>
        lesson.orderIndex === values.orderIndex &&
        (lessonEditorMode === "create" || lesson.id !== selectedLesson?.id),
    );

    if (duplicatedOrder) {
      throw new Error("DUPLICATED_LESSON_ORDER");
    }

    try {
      if (lessonEditorMode === "create") {
        const createdLesson = await mutations.createLesson.mutateAsync({
          chapterId: selectedChapterId,
          values,
        });
        setSelectedLessonId(createdLesson.id);
      } else if (selectedLesson) {
        await mutations.updateLesson.mutateAsync({
          lessonId: selectedLesson.id,
          values,
        });
      }

      await mutations.invalidateLearningPath(path.id);
      await learningPathQuery.refetch();
      toast.success(
        lessonEditorMode === "create" ? "Đã thêm buổi học" : "Đã lưu buổi học",
        {
          description: "Danh sách buổi học trong chương đã được cập nhật.",
        },
      );
      setLessonEditorMode("create");
      setIsLessonEditorOpen(false);
    } catch (error) {
      if (isConflictError(error)) {
        throw new Error("DUPLICATED_LESSON_ORDER", { cause: error });
      }

      toast.error("Chưa lưu được buổi học", {
        description: getErrorMessage(error),
      });
    }
  }

  function requestDeleteChapter(chapterId: string) {
    const chapter = path?.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      return;
    }

    setDeletingChapterId(chapter.id);
  }

  async function confirmDeleteChapter() {
    if (!deletingChapter) {
      return;
    }

    try {
      await mutations.archiveChapter.mutateAsync({
        chapterId: deletingChapter.id,
      });
      await mutations.invalidateLearningPath(pathId);
      await learningPathQuery.refetch();
      toast.info("Đã xóa chương học", {
        description: "Các buổi học trong chương cũng được chuyển sang lưu trữ.",
      });
      setDeletingChapterId(null);
    } catch (error) {
      toast.error("Chưa xóa được chương học", {
        description: getErrorMessage(error),
      });
    }
  }

  function requestDeleteLesson(lessonId: string) {
    const match = findLessonMatch(path, lessonId);
    if (!match) {
      return;
    }

    setSelectedChapterId(match.chapter.id);
    setDeletingLessonId(match.lesson.id);
  }

  async function confirmDeleteLesson() {
    if (!deletingLesson || !deletingLessonMatch) {
      return;
    }

    try {
      await mutations.archiveLesson.mutateAsync({
        lessonId: deletingLesson.id,
      });
      await mutations.invalidateLearningPath(pathId);
      await learningPathQuery.refetch();
      toast.info("Đã xóa buổi học");
      setDeletingLessonId(null);
    } catch (error) {
      toast.error("Chưa xóa được buổi học", {
        description: getErrorMessage(error),
      });
    }
  }

  async function reorderChapters(sourceChapterId: string, targetChapterId: string) {
    if (sourceChapterId === targetChapterId) {
      return;
    }

    const targetChapter = path?.chapters.find(
      (chapter) => chapter.id === targetChapterId,
    );
    if (!targetChapter) {
      return;
    }

    try {
      await mutations.updateChapter.mutateAsync({
        chapterId: sourceChapterId,
        values: {
          orderIndex: targetChapter.orderIndex,
        },
      });
      await mutations.invalidateLearningPath(pathId);
      await learningPathQuery.refetch();
      setSelectedChapterId(sourceChapterId);
    } catch (error) {
      toast.error("Chưa đổi được thứ tự chương", {
        description: getErrorMessage(error),
      });
    }
  }

  async function reorderLessons(
    chapterId: string,
    sourceLessonId: string,
    targetLessonId: string,
  ) {
    if (sourceLessonId === targetLessonId) {
      return;
    }

    const targetLesson = path?.chapters
      .find((chapter) => chapter.id === chapterId)
      ?.lessons.find((lesson) => lesson.id === targetLessonId);
    if (!targetLesson) {
      return;
    }

    try {
      await mutations.updateLesson.mutateAsync({
        lessonId: sourceLessonId,
        values: {
          orderIndex: targetLesson.orderIndex,
        },
      });
      await mutations.invalidateLearningPath(pathId);
      await learningPathQuery.refetch();
      setSelectedChapterId(chapterId);
      setSelectedLessonId(sourceLessonId);
    } catch (error) {
      toast.error("Chưa đổi được thứ tự buổi học", {
        description: getErrorMessage(error),
      });
    }
  }

  function retryLoad() {
    void learningPathQuery.refetch();
  }

  const viewState: ViewState =
    !isAuthHydrated || !hasAdminAccess || learningPathQuery.isLoading
      ? "loading"
      : learningPathQuery.isError || !path || !session?.accessToken
        ? "error"
        : "ready";

  return {
    chapterEditorMode,
    courseStats,
    deletingChapter,
    deletingLesson,
    selectedChapter,
    selectedLesson,
    isChapterEditorOpen,
    isLessonEditorOpen,
    isSavingChapter,
    isSavingLesson,
    isDarkTheme,
    isSidebarCollapsed,
    lessonEditorMode,
    path,
    selectedChapterId,
    selectedLessonId,
    viewState,
    isDeletingChapter: mutations.archiveChapter.isPending,
    isDeletingLesson: mutations.archiveLesson.isPending,
    actions: {
      closeChapterEditor: () => setIsChapterEditorOpen(false),
      closeDeleteChapterConfirm: () => setDeletingChapterId(null),
      closeDeleteLessonConfirm: () => setDeletingLessonId(null),
      closeLessonEditor: () => setIsLessonEditorOpen(false),
      confirmDeleteChapter,
      confirmDeleteLesson,
      requestDeleteChapter,
      requestDeleteLesson,
      retryLoad,
      reorderChapters,
      reorderLessons,
      saveChapter,
      saveLesson,
      startCreateChapter,
      startCreateLesson,
      startEditChapter,
      startEditLesson,
      toggleDarkTheme: toggleTheme,
      toggleSidebarCollapsed: () => setIsSidebarCollapsed((current) => !current),
    },
  };
}

function isConflictError(error: unknown) {
  return error instanceof ApiRequestError && error.code === "CONFLICT";
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return "Vui lòng thử lại sau ít phút.";
}
