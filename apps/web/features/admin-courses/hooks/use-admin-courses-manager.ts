import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import {
  adminLearningPaths,
  type AdminLearningPath,
  type AdminLesson,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin-courses/data";
import {
  emptyLessonValues,
  emptyPathValues,
  learningPathSchema,
  lessonSchema,
  type LearningPathFormValues,
  type LessonFormValues,
} from "@/features/admin-courses/schemas";
import type { EditorMode, ViewState } from "@/features/admin-courses/types";
import {
  byLessonOrder,
  toLearningPathPayload,
  toLessonFormValues,
  toLessonPayload,
  toPathFormValues,
  wait,
} from "@/features/admin-courses/utils";

export function useAdminCoursesManager() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [paths, setPaths] = useState<AdminLearningPath[]>(adminLearningPaths);
  const [selectedPathId, setSelectedPathId] = useState(adminLearningPaths[0]?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [pathEditorMode, setPathEditorMode] = useState<EditorMode>("edit");
  const [lessonEditorMode, setLessonEditorMode] = useState<EditorMode>("create");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<AdminSubject | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AdminPublishStatus | "ALL">("ALL");
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  const selectedPath = paths.find((path) => path.id === selectedPathId) ?? null;
  const selectedLesson =
    selectedPath?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  const pathForm = useForm<LearningPathFormValues>({
    resolver: zodResolver(learningPathSchema) as Resolver<LearningPathFormValues>,
    defaultValues: selectedPath ? toPathFormValues(selectedPath) : emptyPathValues,
  });
  const lessonForm = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema) as Resolver<LessonFormValues>,
    defaultValues: emptyLessonValues,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setViewState("ready");
    }, 420);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (pathEditorMode === "edit" && selectedPath) {
      pathForm.reset(toPathFormValues(selectedPath));
    }
  }, [pathEditorMode, pathForm, selectedPath]);

  useEffect(() => {
    if (lessonEditorMode === "edit" && selectedLesson) {
      lessonForm.reset(toLessonFormValues(selectedLesson));
      return;
    }

    if (lessonEditorMode === "create") {
      lessonForm.reset({
        ...emptyLessonValues,
        orderIndex: (selectedPath?.lessons.length ?? 0) + 1,
      });
    }
  }, [lessonEditorMode, lessonForm, selectedLesson, selectedPath]);

  const filteredPaths = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return paths.filter((path) => {
      const matchesKeyword =
        !keyword ||
        path.title.toLowerCase().includes(keyword) ||
        path.slug.toLowerCase().includes(keyword);
      const matchesSubject = subjectFilter === "ALL" || path.subject === subjectFilter;
      const matchesStatus = statusFilter === "ALL" || path.status === statusFilter;
      const matchesGrade = gradeFilter === "ALL" || path.grade === gradeFilter;

      return matchesKeyword && matchesSubject && matchesStatus && matchesGrade;
    });
  }, [gradeFilter, paths, query, statusFilter, subjectFilter]);

  const stats = useMemo(() => {
    const published = paths.filter((path) => path.status === "PUBLISHED").length;
    const lessons = paths.reduce((total, path) => total + path.lessons.length, 0);
    const trial = paths.filter((path) => path.trialEnabled).length;

    return { published, lessons, trial };
  }, [paths]);

  function startCreatePath() {
    setPathEditorMode("create");
    setSelectedLessonId(null);
    pathForm.reset(emptyPathValues);
  }

  function startEditPath(pathId: string) {
    const path = paths.find((item) => item.id === pathId);
    if (!path) {
      return;
    }

    setSelectedPathId(path.id);
    setPathEditorMode("edit");
    setSelectedLessonId(null);
    pathForm.reset(toPathFormValues(path));
  }

  function startCreateLesson() {
    setLessonEditorMode("create");
    setSelectedLessonId(null);
    lessonForm.reset({
      ...emptyLessonValues,
      orderIndex: (selectedPath?.lessons.length ?? 0) + 1,
    });
  }

  function startEditLesson(lessonId: string) {
    const lesson = selectedPath?.lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      return;
    }

    setSelectedLessonId(lesson.id);
    setLessonEditorMode("edit");
    lessonForm.reset(toLessonFormValues(lesson));
  }

  async function savePath(values: LearningPathFormValues) {
    setIsSavingPath(true);
    await wait(420);
    const payload = toLearningPathPayload(values);

    if (pathEditorMode === "create") {
      const createdPath: AdminLearningPath = {
        ...payload,
        id: `path-${Date.now()}`,
        totalLessonCount: 0,
        updatedAt: new Date().toISOString(),
        lessons: [],
      };
      setPaths((current) => [createdPath, ...current]);
      setSelectedPathId(createdPath.id);
      setPathEditorMode("edit");
      toast.success("Đã tạo lộ trình", {
        description: "Bạn có thể thêm buổi học ngay bên dưới.",
      });
    } else if (selectedPath) {
      setPaths((current) =>
        current.map((path) =>
          path.id === selectedPath.id
            ? { ...path, ...payload, updatedAt: new Date().toISOString() }
            : path,
        ),
      );
      toast.success("Đã lưu lộ trình", {
        description: "Thông tin quản trị đã được cập nhật trên màn hình.",
      });
    }

    setIsSavingPath(false);
  }

  async function saveLesson(values: LessonFormValues) {
    if (!selectedPath) {
      return;
    }

    const duplicatedOrder = selectedPath.lessons.some(
      (lesson) =>
        lesson.orderIndex === values.orderIndex &&
        (lessonEditorMode === "create" || lesson.id !== selectedLesson?.id),
    );

    if (duplicatedOrder) {
      lessonForm.setError("orderIndex", {
        type: "manual",
        message: "Thứ tự này đã có trong lộ trình",
      });
      return;
    }

    setIsSavingLesson(true);
    await wait(360);
    const payload = toLessonPayload(values);

    setPaths((current) =>
      current.map((path) => {
        if (path.id !== selectedPath.id) {
          return path;
        }

        if (lessonEditorMode === "create") {
          const createdLesson: AdminLesson = {
            ...payload,
            id: `lesson-${Date.now()}`,
          };

          return {
            ...path,
            totalLessonCount: path.lessons.length + 1,
            updatedAt: new Date().toISOString(),
            lessons: [...path.lessons, createdLesson].sort(byLessonOrder),
          };
        }

        return {
          ...path,
          updatedAt: new Date().toISOString(),
          lessons: path.lessons
            .map((lesson) =>
              lesson.id === selectedLesson?.id ? { ...lesson, ...payload } : lesson,
            )
            .sort(byLessonOrder),
        };
      }),
    );

    toast.success(
      lessonEditorMode === "create" ? "Đã thêm buổi học" : "Đã lưu buổi học",
      {
        description: "Danh sách buổi học đã được cập nhật.",
      },
    );
    setLessonEditorMode("create");
    setSelectedLessonId(null);
    setIsSavingLesson(false);
  }

  function archiveSelectedPath() {
    if (!selectedPath) {
      return;
    }

    setPaths((current) =>
      current.map((path) =>
        path.id === selectedPath.id
          ? { ...path, status: "ARCHIVED", updatedAt: new Date().toISOString() }
          : path,
      ),
    );
    toast.info("Đã chuyển vào lưu trữ", {
      description: "Lộ trình không còn nằm trong nhóm đang mở.",
    });
  }

  function archiveLesson(lessonId: string) {
    if (!selectedPath) {
      return;
    }

    setPaths((current) =>
      current.map((path) =>
        path.id === selectedPath.id
          ? {
              ...path,
              lessons: path.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, status: "ARCHIVED" } : lesson,
              ),
            }
          : path,
      ),
    );
    toast.info("Đã lưu trữ buổi học");
  }

  function retryLoad() {
    setViewState("loading");
    window.setTimeout(() => setViewState("ready"), 380);
  }

  return {
    filteredPaths,
    gradeFilter,
    isSavingLesson,
    isSavingPath,
    lessonEditorMode,
    lessonForm,
    pathEditorMode,
    pathForm,
    query,
    selectedLessonId,
    selectedPath,
    selectedPathId,
    stats,
    statusFilter,
    subjectFilter,
    viewState,
    actions: {
      archiveLesson,
      archiveSelectedPath,
      retryLoad,
      saveLesson,
      savePath,
      setGradeFilter,
      setQuery,
      setStatusFilter,
      setSubjectFilter,
      startCreateLesson,
      startCreatePath,
      startEditLesson,
      startEditPath,
    },
  };
}
