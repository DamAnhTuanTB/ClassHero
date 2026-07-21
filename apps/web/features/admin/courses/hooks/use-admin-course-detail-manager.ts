import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createAdminLessonSupplementDocument,
  deleteAdminLessonSupplementDocument,
  uploadAdminLessonDocumentFile,
} from "@/features/admin/courses/api/admin-course-documents-api";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import {
  useAdminCourseMutations,
  useAdminLearningPathQuery,
} from "@/features/admin/courses/hooks/use-admin-course-queries";
import type {
  ChapterFormValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode, ViewState } from "@/features/admin/courses/admin-courses-types";
import {
  findLessonMatch,
  getAdminCourseDetailStats,
  getLessonReferenceDocumentUploads,
} from "@/features/admin/courses/admin-courses-utils";
import type { AdminLessonDocumentApi } from "@/features/admin/courses/types/admin-course-document-types";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import { ApiRequestError } from "@/lib/api-client";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";

export function useAdminCourseDetailManager(
  pathId: string,
  initialLearningPath?: AdminLearningPath | null,
  initialThemeMode: AppThemeMode = "light",
) {
  const router = useRouter();
  const learningPathQuery = useAdminLearningPathQuery(pathId, initialLearningPath);
  const {
    isAuthHydrated,
    isAuthorized: hasAdminAccess,
    session,
  } = useAuthGuard({
    allowedRoles: ["ADMIN"],
    authError: learningPathQuery.error,
  });
  const accessToken = session?.accessToken ?? "";
  const mutations = useAdminCourseMutations();
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";
  const [path, setPath] = useState(learningPathQuery.data ?? null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [deletingPathId, setDeletingPathId] = useState<string | null>(null);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [pathEditorMode, setPathEditorMode] = useState<EditorMode>("edit");
  const [chapterEditorMode, setChapterEditorMode] = useState<EditorMode>("create");
  const [lessonEditorMode, setLessonEditorMode] = useState<EditorMode>("create");
  const [isPathEditorOpen, setIsPathEditorOpen] = useState(false);
  const [isChapterEditorOpen, setIsChapterEditorOpen] = useState(false);
  const [isLessonEditorOpen, setIsLessonEditorOpen] = useState(false);
  const [isSavingLessonReferences, setIsSavingLessonReferences] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );

  const selectedChapter =
    path?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const selectedLessonMatch = findLessonMatch(path, selectedLessonId);
  const selectedLesson = selectedLessonMatch?.lesson ?? null;
  const deletingPath = path?.id === deletingPathId ? path : null;
  const deletingChapter =
    path?.chapters.find((chapter) => chapter.id === deletingChapterId) ?? null;
  const deletingLessonMatch = findLessonMatch(path, deletingLessonId);
  const deletingLesson = deletingLessonMatch?.lesson ?? null;
  const isSavingPath = mutations.updatePath.isPending;
  const isSavingChapter =
    mutations.createChapter.isPending || mutations.updateChapter.isPending;
  const isSavingLesson =
    mutations.createLesson.isPending ||
    mutations.updateLesson.isPending ||
    isSavingLessonReferences;

  useEffect(() => {
    if (learningPathQuery.data !== undefined) {
      setPath(learningPathQuery.data);
    }
  }, [learningPathQuery.data]);

  const courseStats = useMemo(() => getAdminCourseDetailStats(path), [path]);

  function startEditPath() {
    if (!path) {
      return;
    }

    setPathEditorMode("edit");
    setIsPathEditorOpen(true);
  }

  async function savePath(values: LearningPathFormValues) {
    if (!path) {
      return;
    }

    try {
      await mutations.updatePath.mutateAsync({
        pathId: path.id,
        values,
      });
      await learningPathQuery.refetch();
      toast.success("Đã lưu khóa học", {
        description: "Thông tin khóa học đã được cập nhật.",
      });
      setIsPathEditorOpen(false);
    } catch (error) {
      toast.error("Chưa lưu được khóa học", {
        description: getErrorMessage(error),
      });
    }
  }

  function requestDeletePath() {
    if (!path) {
      return;
    }

    setDeletingPathId(path.id);
  }

  async function confirmDeletePath() {
    if (!deletingPath) {
      return;
    }

    try {
      await mutations.archivePath.mutateAsync({
        pathId: deletingPath.id,
      });
      await mutations.invalidateLearningPath(deletingPath.id);
      toast.info("Đã xóa khóa học", {
        description: "Khóa học đã được chuyển vào thùng rác.",
      });
      setDeletingPathId(null);
      router.push("/admin/courses");
    } catch (error) {
      toast.error("Chưa xóa được khóa học", {
        description: getErrorMessage(error),
      });
    }
  }

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
          description: "Cấu trúc chương học của khóa học đã được cập nhật.",
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

  async function saveLesson(
    values: LessonFormValues,
    documentsManager: {
      documentsByLessonId: Record<string, AdminLessonDocumentApi[]>;
      actions: { reloadDocuments: () => void };
    }
  ) {
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
      let referenceUploadError: unknown = null;

      if (lessonEditorMode === "create") {
        const createdLesson = await mutations.createLesson.mutateAsync({
          chapterId: selectedChapterId,
          values,
        });

        try {
          await uploadLessonReferenceDocuments(createdLesson.id, values);
        } catch (error) {
          referenceUploadError = error;
        }
      } else if (selectedLesson) {
        await mutations.updateLesson.mutateAsync({
          lessonId: selectedLesson.id,
          values,
        });

        try {
          const originalSupplements =
            documentsManager.documentsByLessonId[selectedLesson.id]?.filter(
              (doc) => doc.kind === "SUPPLEMENT",
            ) || [];
          
          const remainingIds = values.referenceDocuments
            .map((doc) => doc.id)
            .filter(Boolean);
            
          const deletedDocs = originalSupplements.filter(
            (doc) => !remainingIds.includes(doc.id),
          );

          for (const doc of deletedDocs) {
            await deleteAdminLessonSupplementDocument(
              selectedLesson.id,
              doc.id,
              accessToken,
            );
          }

          await uploadLessonReferenceDocuments(selectedLesson.id, values);
        } catch (error) {
          referenceUploadError = error;
        }
      }

      await mutations.invalidateLearningPath(path.id);
      await learningPathQuery.refetch();
      // Ensure documents are re-fetched to reflect deleted/added supplements
      documentsManager.actions.reloadDocuments();
      if (referenceUploadError) {
        toast.warning("Đã thêm bài học", {
          description: getErrorMessage(referenceUploadError),
        });
      } else {
        toast.success(
          lessonEditorMode === "create" ? "Đã thêm bài học" : "Đã lưu bài học",
          {
            description: "Danh sách bài học trong chương đã được cập nhật.",
          },
        );
      }
      setLessonEditorMode("create");
      setSelectedLessonId(null);
      setIsLessonEditorOpen(false);
    } catch (error) {
      if (isConflictError(error)) {
        throw new Error("DUPLICATED_LESSON_ORDER", { cause: error });
      }

      toast.error("Chưa lưu được bài học", {
        description: getErrorMessage(error),
      });
    }
  }

  async function uploadLessonReferenceDocuments(
    lessonId: string,
    values: LessonFormValues,
  ) {
    const referenceDocuments = getLessonReferenceDocumentUploads(values);

    if (referenceDocuments.length === 0) {
      return;
    }

    setIsSavingLessonReferences(true);
    try {
      for (const document of referenceDocuments) {
        const uploadedFile = await uploadAdminLessonDocumentFile(
          document.file,
          accessToken,
        );
        await createAdminLessonSupplementDocument(
          lessonId,
          {
            fileId: uploadedFile.id,
            kind: "SUPPLEMENT",
            processingMode: "STORAGE_ONLY",
            title: document.title || uploadedFile.originalName,
          },
          accessToken,
        );
      }
    } finally {
      setIsSavingLessonReferences(false);
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
        description: "Các bài học trong chương cũng được chuyển sang lưu trữ.",
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
      toast.info("Đã xóa bài học");
      setDeletingLessonId(null);
    } catch (error) {
      toast.error("Chưa xóa được bài học", {
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
      toast.error("Chưa đổi được thứ tự bài học", {
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
    deletingPath,
    deletingChapter,
    deletingLesson,
    selectedChapter,
    selectedLesson,
    isChapterEditorOpen,
    isLessonEditorOpen,
    isPathEditorOpen,
    isSavingChapter,
    isSavingLesson,
    isSavingPath,
    isDarkTheme,
    isSidebarCollapsed,
    lessonEditorMode,
    path,
    pathEditorMode,
    selectedChapterId,
    selectedLessonId,
    viewState,
    isDeletingPath: mutations.archivePath.isPending,
    isDeletingChapter: mutations.archiveChapter.isPending,
    isDeletingLesson: mutations.archiveLesson.isPending,
    actions: {
      closeChapterEditor: () => setIsChapterEditorOpen(false),
      closeDeletePathConfirm: () => setDeletingPathId(null),
      closeDeleteChapterConfirm: () => setDeletingChapterId(null),
      closeDeleteLessonConfirm: () => setDeletingLessonId(null),
      closeLessonEditor: () => {
        setIsLessonEditorOpen(false);
        setSelectedLessonId(null);
      },
      closePathEditor: () => setIsPathEditorOpen(false),
      confirmDeletePath,
      confirmDeleteChapter,
      confirmDeleteLesson,
      requestDeletePath,
      requestDeleteChapter,
      requestDeleteLesson,
      retryLoad,
      reorderChapters,
      reorderLessons,
      saveChapter,
      saveLesson,
      savePath,
      startCreateChapter,
      startCreateLesson,
      startEditChapter,
      startEditLesson,
      startEditPath,
      toggleDarkTheme: toggleTheme,
      toggleSidebarCollapsed: () => setIsSidebarCollapsed((current) => !current),
    },
    uploadCover: (file: File) => mutations.uploadCover.mutateAsync(file),
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
