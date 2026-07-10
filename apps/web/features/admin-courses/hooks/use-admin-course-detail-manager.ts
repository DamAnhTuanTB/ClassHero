import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { type AdminChapter, type AdminLesson } from "@/features/admin-courses/data";
import { useAdminLearningPathQuery } from "@/features/admin-courses/hooks/use-admin-course-queries";
import {
  chapterSchema,
  emptyChapterValues,
  emptyLessonValues,
  lessonSchema,
  type ChapterFormValues,
  type LessonFormValues,
} from "@/features/admin-courses/schemas";
import type { EditorMode, ViewState } from "@/features/admin-courses/types";
import {
  byChapterOrder,
  byLessonOrder,
  findLessonMatch,
  getAdminCourseDetailStats,
  toChapterFormValues,
  toChapterPayload,
  toLessonFormValues,
  toLessonPayload,
  wait,
} from "@/features/admin-courses/utils";

export function useAdminCourseDetailManager(pathId: string) {
  const learningPathQuery = useAdminLearningPathQuery(pathId);
  const [path, setPath] = useState(learningPathQuery.data ?? null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [chapterEditorMode, setChapterEditorMode] = useState<EditorMode>("create");
  const [lessonEditorMode, setLessonEditorMode] = useState<EditorMode>("create");
  const [isChapterEditorOpen, setIsChapterEditorOpen] = useState(false);
  const [isLessonEditorOpen, setIsLessonEditorOpen] = useState(false);
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  const selectedChapter =
    path?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const selectedLessonMatch = findLessonMatch(path, selectedLessonId);
  const selectedLesson = selectedLessonMatch?.lesson ?? null;
  const deletingChapter =
    path?.chapters.find((chapter) => chapter.id === deletingChapterId) ?? null;
  const deletingLessonMatch = findLessonMatch(path, deletingLessonId);
  const deletingLesson = deletingLessonMatch?.lesson ?? null;

  const chapterForm = useForm<ChapterFormValues>({
    resolver: zodResolver(chapterSchema) as Resolver<ChapterFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: emptyChapterValues,
  });
  const lessonForm = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema) as Resolver<LessonFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: emptyLessonValues,
  });

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
    chapterForm.reset({
      ...emptyChapterValues,
      orderIndex: (path?.chapters.length ?? 0) + 1,
      status: "PUBLISHED",
    });
    setIsChapterEditorOpen(true);
  }

  function startEditChapter(chapterId: string) {
    const chapter = path?.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      return;
    }

    setSelectedChapterId(chapter.id);
    setChapterEditorMode("edit");
    chapterForm.reset(toChapterFormValues(chapter));
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
      chapterForm.setError("orderIndex", {
        type: "manual",
        message: "Thứ tự này đã có trong lộ trình",
      });
      return;
    }

    setIsSavingChapter(true);
    await wait(320);
    const payload = toChapterPayload(values);
    const createdChapterId = `chapter-${Date.now()}`;

    setPath((current) => {
      if (!current) {
        return current;
      }

      if (chapterEditorMode === "create") {
        const createdChapter: AdminChapter = {
          ...payload,
          id: createdChapterId,
          lessons: [],
        };

        return {
          ...current,
          totalChapterCount: current.chapters.length + 1,
          updatedAt: new Date().toISOString(),
          chapters: [...current.chapters, createdChapter].sort(byChapterOrder),
        };
      }

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        chapters: current.chapters
          .map((chapter) =>
            chapter.id === selectedChapter?.id ? { ...chapter, ...payload } : chapter,
          )
          .sort(byChapterOrder),
      };
    });

    if (chapterEditorMode === "create") {
      setSelectedChapterId(createdChapterId);
    }
    toast.success(
      chapterEditorMode === "create" ? "Đã thêm chương học" : "Đã lưu chương học",
      {
        description: "Cấu trúc chương học của lộ trình đã được cập nhật.",
      },
    );
    setChapterEditorMode("create");
    setIsChapterEditorOpen(false);
    setIsSavingChapter(false);
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
    lessonForm.reset({
      ...emptyLessonValues,
      orderIndex: targetChapter.lessons.length + 1,
    });
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
    lessonForm.reset(toLessonFormValues(match.lesson));
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
      lessonForm.setError("orderIndex", {
        type: "manual",
        message: "Thứ tự này đã có trong chương",
      });
      return;
    }

    setIsSavingLesson(true);
    await wait(360);
    const payload = toLessonPayload(values);
    const createdLessonId = `lesson-${Date.now()}`;

    setPath((current) => {
      if (!current) {
        return current;
      }

      if (lessonEditorMode === "create") {
        const createdLesson: AdminLesson = {
          ...payload,
          id: createdLessonId,
        };

        return {
          ...current,
          totalLessonCount: current.totalLessonCount + 1,
          updatedAt: new Date().toISOString(),
          chapters: current.chapters.map((chapter) =>
            chapter.id === selectedChapterId
              ? {
                  ...chapter,
                  lessons: [...chapter.lessons, createdLesson].sort(byLessonOrder),
                }
              : chapter,
          ),
        };
      }

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        chapters: current.chapters.map((chapter) =>
          chapter.id === selectedChapterId
            ? {
                ...chapter,
                lessons: chapter.lessons
                  .map((lesson) =>
                    lesson.id === selectedLesson?.id ? { ...lesson, ...payload } : lesson,
                  )
                  .sort(byLessonOrder),
              }
            : chapter,
        ),
      };
    });

    if (lessonEditorMode === "create") {
      setSelectedLessonId(createdLessonId);
    }
    toast.success(
      lessonEditorMode === "create" ? "Đã thêm buổi học" : "Đã lưu buổi học",
      {
        description: "Danh sách buổi học trong chương đã được cập nhật.",
      },
    );
    setLessonEditorMode("create");
    setIsLessonEditorOpen(false);
    setIsSavingLesson(false);
  }

  function requestDeleteChapter(chapterId: string) {
    const chapter = path?.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      return;
    }

    setDeletingChapterId(chapter.id);
  }

  function confirmDeleteChapter() {
    if (!deletingChapter) {
      return;
    }

    setPath((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        chapters: current.chapters.map((chapter) =>
          chapter.id === deletingChapter.id
            ? {
                ...chapter,
                status: "ARCHIVED",
                lessons: chapter.lessons.map((lesson) => ({
                  ...lesson,
                  status: "ARCHIVED",
                })),
              }
            : chapter,
        ),
      };
    });
    toast.info("Đã xóa chương học", {
      description: "Các buổi học trong chương cũng được chuyển sang lưu trữ.",
    });
    setDeletingChapterId(null);
  }

  function requestDeleteLesson(lessonId: string) {
    const match = findLessonMatch(path, lessonId);
    if (!match) {
      return;
    }

    setSelectedChapterId(match.chapter.id);
    setDeletingLessonId(match.lesson.id);
  }

  function confirmDeleteLesson() {
    if (!deletingLesson || !deletingLessonMatch) {
      return;
    }

    setPath((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        chapters: current.chapters.map((chapter) =>
          chapter.id === deletingLessonMatch.chapter.id
            ? {
                ...chapter,
                lessons: chapter.lessons.map((lesson) =>
                  lesson.id === deletingLesson.id
                    ? { ...lesson, status: "ARCHIVED" }
                    : lesson,
                ),
              }
            : chapter,
        ),
      };
    });
    toast.info("Đã xóa buổi học");
    setDeletingLessonId(null);
  }

  function retryLoad() {
    void learningPathQuery.refetch();
  }

  const viewState: ViewState = learningPathQuery.isLoading
    ? "loading"
    : learningPathQuery.isError || !path
      ? "error"
      : "ready";

  return {
    chapterEditorMode,
    chapterForm,
    courseStats,
    deletingChapter,
    deletingLesson,
    isChapterEditorOpen,
    isLessonEditorOpen,
    isSavingChapter,
    isSavingLesson,
    lessonEditorMode,
    lessonForm,
    path,
    selectedChapterId,
    selectedLessonId,
    viewState,
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
      saveChapter,
      saveLesson,
      startCreateChapter,
      startCreateLesson,
      startEditChapter,
      startEditLesson,
    },
  };
}
