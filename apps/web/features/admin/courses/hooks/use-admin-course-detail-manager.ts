import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createAdminLessonDocument,
  deleteAdminLessonDocument,
  updateAdminLessonDocument,
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
  getLessonsInContainer,
  resolveFoundationDocumentSortOrder,
} from "@/features/admin/courses/admin-courses-utils";
import { readRecord } from "@/features/admin/courses/admin-course-documents-utils";
import type { AdminLessonDocumentApi } from "@/features/admin/courses/types/admin-course-document-types";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import { ApiRequestError } from "@/lib/api-client";
import { getQueryRenderState } from "@/lib/query-render-state";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
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
  const path = learningPathQuery.data ?? null;
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
    mutations.moveLesson.isPending ||
    isSavingLessonReferences;

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
      toast.error("Chưa lưu được chương học", {
        description: getErrorMessage(error),
      });
    }
  }

  function startCreateLesson(chapterId: string | null = null) {
    if (chapterId && !path?.chapters.some((chapter) => chapter.id === chapterId)) {
      return;
    }

    setLessonEditorMode("create");
    setSelectedChapterId(chapterId);
    setSelectedLessonId(null);
    setIsLessonEditorOpen(true);
  }

  function startEditLesson(lessonId: string) {
    const match = findLessonMatch(path, lessonId);
    if (!match) {
      return;
    }

    setSelectedChapterId(match.chapter?.id ?? null);
    setSelectedLessonId(match.lesson.id);
    setLessonEditorMode("edit");
    setIsLessonEditorOpen(true);
  }

  async function saveLesson(
    values: LessonFormValues,
    documentsManager: {
      documentsByLessonId: Record<string, AdminLessonDocumentApi[]>;
      actions: { reloadDocuments: () => void };
    },
    options: {
      chapterId?: string | null;
      closeEditor?: boolean;
      lessonId?: string;
    } = {},
  ): Promise<boolean> {
    const explicitLessonMatch = options.lessonId
      ? findLessonMatch(path, options.lessonId)
      : null;
    const targetChapterId =
      options.chapterId !== undefined
        ? options.chapterId
        : explicitLessonMatch
          ? (explicitLessonMatch.chapter?.id ?? null)
          : selectedChapterId;
    const targetLesson = explicitLessonMatch?.lesson ?? selectedLesson;
    const targetEditorMode = options.lessonId ? "edit" : lessonEditorMode;

    if (!path) {
      return false;
    }

    if (
      targetChapterId &&
      !path.chapters.some((chapter) => chapter.id === targetChapterId)
    ) {
      return false;
    }

    const normalizedTitle = normalizeLessonTitleForComparison(values.title);
    const targetLessons = getLessonsInContainer(path, targetChapterId);
    const duplicatedTitle = targetLessons.some(
      (lesson) =>
        lesson.id !== targetLesson?.id &&
        normalizeLessonTitleForComparison(lesson.title) === normalizedTitle,
    );

    if (duplicatedTitle) {
      throw new Error("DUPLICATED_LESSON_TITLE");
    }

    try {
      let referenceUploadError: unknown = null;
      if (targetEditorMode === "create") {
        const createdLesson = await mutations.createLesson.mutateAsync({
          chapterId: targetChapterId,
          pathId: path.id,
          values,
        });
        try {
          await uploadLessonReferenceDocuments(createdLesson.id, values);
        } catch (error) {
          referenceUploadError = error;
        }
      } else if (targetLesson) {
        await mutations.updateLesson.mutateAsync({
          lessonId: targetLesson.id,
          values,
        });

        try {
          const originalDocuments =
            documentsManager.documentsByLessonId[targetLesson.id]?.filter((doc) => {
              const isRangeDocument =
                doc.kind === "PRIMARY_FROM_SOURCE" &&
                (Boolean(doc.sourceDocumentId) ||
                  readRecord(doc.metadataJson)?.source === "source_document_page_range");
              return !isRangeDocument;
            }) || [];

          const remainingIds = values.referenceDocuments
            .map((doc) => doc.id)
            .filter(Boolean);

          const deletedDocs = originalDocuments.filter(
            (doc) => !remainingIds.includes(doc.id),
          );

          for (const doc of deletedDocs) {
            await deleteAdminLessonDocument(targetLesson.id, doc.id, accessToken);
          }

          const existingDocsToUpdate = values.referenceDocuments
            .filter((doc) => doc.id)
            .map((doc, index) => {
              const original = originalDocuments.find((o) => o.id === doc.id);
              if (!original) return null;

              const titleChanged = doc.title !== original.title;
              const targetKind = doc.type ?? "SUPPLEMENT";
              const typeChanged = targetKind !== original.kind;
              const sortOrder =
                targetKind === "PRIMARY_FROM_SOURCE"
                  ? resolveFoundationDocumentSortOrder(values, doc, index)
                  : original.sortOrder;
              const sortOrderChanged = sortOrder !== original.sortOrder;

              if (!titleChanged && !typeChanged && !sortOrderChanged) return null;

              return {
                id: doc.id!,
                title: titleChanged ? doc.title : undefined,
                kind: typeChanged ? targetKind : undefined,
                sortOrder: sortOrderChanged ? sortOrder : undefined,
              };
            })
            .filter(Boolean) as Array<{
            id: string;
            title?: string;
            kind?: "PRIMARY_FROM_SOURCE" | "SUPPLEMENT" | "HOMEWORK";
            sortOrder?: number;
          }>;

          for (const docUpdate of existingDocsToUpdate) {
            await updateAdminLessonDocument(
              targetLesson.id,
              docUpdate.id,
              {
                title: docUpdate.title,
                kind: docUpdate.kind,
                sortOrder: docUpdate.sortOrder,
              },
              accessToken,
            );
          }

          await uploadLessonReferenceDocuments(targetLesson.id, values);
        } catch (error) {
          referenceUploadError = error;
        }
      }

      await mutations.invalidateLearningPath(path.id);
      await learningPathQuery.refetch();
      // Ensure documents are re-fetched to reflect deleted/added supplements
      documentsManager.actions.reloadDocuments();
      if (targetLesson) {
        mutations.invalidateAiPanel(targetLesson.id);
      }

      if (referenceUploadError) {
        toast.warning(
          targetEditorMode === "create" ? "Đã thêm buổi học" : "Đã lưu buổi học",
          {
            description: getErrorMessage(referenceUploadError),
          },
        );
      } else {
        toast.success(
          targetEditorMode === "create" ? "Đã thêm buổi học" : "Đã lưu buổi học",
          {
            description: "Cấu trúc buổi học của khóa học đã được cập nhật.",
          },
        );
      }
      if (options.closeEditor !== false) {
        setLessonEditorMode("create");
        setSelectedLessonId(null);
        setIsLessonEditorOpen(false);
      }
      return true;
    } catch (error) {
      if (isLessonTitleConflictError(error)) {
        throw new Error("DUPLICATED_LESSON_TITLE", { cause: error });
      }

      toast.error("Chưa lưu được buổi học", {
        description: getErrorMessage(error),
      });
      return false;
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
        await createAdminLessonDocument(
          lessonId,
          {
            fileId: uploadedFile.id,
            kind: document.type ?? "SUPPLEMENT",
            processingMode: "PROCESSING",
            sortOrder: document.sortOrder,
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

    setSelectedChapterId(match.chapter?.id ?? null);
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

  async function moveChapter(chapterId: string, targetOrderIndex: number) {
    if (!path || targetOrderIndex < 1) {
      return;
    }

    try {
      await mutations.updateChapter.mutateAsync({
        chapterId,
        values: {
          orderIndex: targetOrderIndex,
        },
      });
      await mutations.invalidateLearningPath(pathId);
      await learningPathQuery.refetch();
      setSelectedChapterId(chapterId);
    } catch (error) {
      toast.error("Chưa đổi được thứ tự chương", {
        description: getErrorMessage(error),
      });
    }
  }

  async function moveLesson(
    lessonId: string,
    chapterId: string | null,
    targetOrderIndex: number,
  ) {
    if (!path || targetOrderIndex < 1) {
      return false;
    }

    try {
      await mutations.moveLesson.mutateAsync({
        chapterId,
        lessonId,
        targetOrderIndex,
      });
      await mutations.invalidateLearningPath(pathId);
      await learningPathQuery.refetch();
      setSelectedChapterId(chapterId);
      setSelectedLessonId(lessonId);
      toast.success("Đã di chuyển buổi học");
      return true;
    } catch (error) {
      toast.error(
        isLessonMoveBeforeCompletedError(error)
          ? "Không thể đặt buổi học ở vị trí này"
          : "Chưa di chuyển được buổi học",
        {
          description: getErrorMessage(error),
        },
      );
      return false;
    }
  }

  function retryLoad() {
    void learningPathQuery.refetch();
  }

  const queryRenderState = getQueryRenderState(learningPathQuery);
  const canUseServerDataBeforeAuthHydration =
    !isAuthHydrated && initialLearningPath !== undefined;
  const viewState: ViewState = canUseServerDataBeforeAuthHydration
    ? queryRenderState
    : !isAuthHydrated || !hasAdminAccess
      ? "loading"
      : queryRenderState === "loading"
        ? "loading"
        : !session?.accessToken || queryRenderState === "error" || !path
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
    isMovingLesson: mutations.moveLesson.isPending,
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
      moveChapter,
      moveLesson,
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

function isLessonTitleConflictError(error: unknown) {
  return error instanceof ApiRequestError && error.code === "LESSON_TITLE_DUPLICATE";
}

function isLessonMoveBeforeCompletedError(error: unknown) {
  return (
    error instanceof ApiRequestError && error.code === "LESSON_MOVE_BEFORE_COMPLETED"
  );
}

function normalizeLessonTitleForComparison(title: string) {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

function getErrorMessage(error: unknown) {
  return getUserFacingErrorMessage(error, "Vui lòng thử lại sau ít phút.");
}
