import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type AdminLearningPath,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin-courses/data";
import { useAdminLearningPathsQuery } from "@/features/admin-courses/hooks/use-admin-course-queries";
import type { LearningPathFormValues } from "@/features/admin-courses/schemas";
import type {
  EditorMode,
  LearningPathSortKey,
  SortDirection,
  ViewState,
} from "@/features/admin-courses/types";
import {
  filterAndSortLearningPaths,
  getActiveLearningPaths,
  getAdminCourseStats,
  getArchivedLearningPaths,
  toLearningPathPayload,
  wait,
} from "@/features/admin-courses/utils";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";

export function useAdminCoursesManager(
  initialLearningPaths?: AdminLearningPath[],
  initialThemeMode: AppThemeMode = "light",
) {
  const learningPathsQuery = useAdminLearningPathsQuery(initialLearningPaths);
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";
  const [paths, setPaths] = useState<AdminLearningPath[]>(
    () => learningPathsQuery.data ?? [],
  );
  const [pathEditorMode, setPathEditorMode] = useState<EditorMode>("edit");
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isPathEditorOpen, setIsPathEditorOpen] = useState(false);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [deletingPathIds, setDeletingPathIds] = useState<string[]>([]);
  const [permanentDeletingPathIds, setPermanentDeletingPathIds] = useState<string[]>([]);
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<AdminSubject | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AdminPublishStatus | "ALL">("ALL");
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<LearningPathSortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isSavingPath, setIsSavingPath] = useState(false);

  const editingPath = paths.find((path) => path.id === editingPathId) ?? null;

  useEffect(() => {
    if (learningPathsQuery.data) {
      setPaths(learningPathsQuery.data);
    }
  }, [learningPathsQuery.data]);

  const activePaths = useMemo(() => getActiveLearningPaths(paths), [paths]);
  const deletingPaths = useMemo(
    () => activePaths.filter((path) => deletingPathIds.includes(path.id)),
    [activePaths, deletingPathIds],
  );

  const archivedPaths = useMemo(() => getArchivedLearningPaths(paths), [paths]);
  const permanentDeletingPaths = useMemo(
    () => archivedPaths.filter((path) => permanentDeletingPathIds.includes(path.id)),
    [archivedPaths, permanentDeletingPathIds],
  );

  const filteredPaths = useMemo(
    () =>
      filterAndSortLearningPaths(activePaths, {
        gradeFilter,
        query,
        sortDirection,
        sortKey,
        statusFilter,
        subjectFilter,
      }),
    [
      activePaths,
      gradeFilter,
      query,
      sortDirection,
      sortKey,
      statusFilter,
      subjectFilter,
    ],
  );
  const filteredPathIds = useMemo(
    () => filteredPaths.map((path) => path.id),
    [filteredPaths],
  );
  const allFilteredPathsSelected =
    filteredPathIds.length > 0 &&
    filteredPathIds.every((pathId) => selectedPathIds.includes(pathId));

  const stats = useMemo(
    () => getAdminCourseStats(activePaths, archivedPaths),
    [activePaths, archivedPaths],
  );

  useEffect(() => {
    setSelectedPathIds((current) => {
      const visiblePathIds = new Set(filteredPathIds);
      const nextSelectedIds = current.filter((pathId) => visiblePathIds.has(pathId));

      return nextSelectedIds.length === current.length ? current : nextSelectedIds;
    });
  }, [filteredPathIds]);

  function startCreatePath() {
    setPathEditorMode("create");
    setEditingPathId(null);
    setIsPathEditorOpen(true);
  }

  function startEditPath(pathId: string) {
    const path = paths.find((item) => item.id === pathId);
    if (!path) {
      return;
    }

    setEditingPathId(path.id);
    setPathEditorMode("edit");
    setIsPathEditorOpen(true);
  }

  async function savePath(values: LearningPathFormValues) {
    setIsSavingPath(true);
    await wait(420);
    const payload = toLearningPathPayload(values);

    if (pathEditorMode === "create") {
      const createdPath: AdminLearningPath = {
        ...payload,
        id: `path-${Date.now()}`,
        enrolledStudentCount: 0,
        totalChapterCount: 0,
        totalLessonCount: 0,
        updatedAt: new Date().toISOString(),
        chapters: [],
      };
      setPaths((current) => [createdPath, ...current]);
      setEditingPathId(createdPath.id);
      setPathEditorMode("edit");
      setIsPathEditorOpen(false);
      toast.success("Đã tạo lộ trình", {
        description: "Mở chi tiết lộ trình để thêm chương học và buổi học.",
      });
    } else if (editingPath) {
      setPaths((current) =>
        current.map((path) =>
          path.id === editingPath.id
            ? { ...path, ...payload, updatedAt: new Date().toISOString() }
            : path,
        ),
      );
      setIsPathEditorOpen(false);
      toast.success("Đã lưu lộ trình", {
        description: "Thông tin quản trị đã được cập nhật trên màn hình.",
      });
    }

    setIsSavingPath(false);
  }

  function toggleSelectPath(pathId: string) {
    setSelectedPathIds((current) =>
      current.includes(pathId)
        ? current.filter((selectedPathId) => selectedPathId !== pathId)
        : [...current, pathId],
    );
  }

  function toggleSelectAllPaths() {
    setSelectedPathIds(allFilteredPathsSelected ? [] : filteredPathIds);
  }

  function toggleSort(nextSortKey: LearningPathSortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  function requestDeletePaths(pathIds: string[]) {
    const pathIdSet = new Set(pathIds);
    const activePathIds = activePaths
      .filter((path) => pathIdSet.has(path.id))
      .map((path) => path.id);

    if (activePathIds.length === 0) {
      return;
    }

    setDeletingPathIds(activePathIds);
  }

  function requestDeletePath(pathId: string) {
    requestDeletePaths([pathId]);
  }

  function requestDeleteSelectedPaths() {
    requestDeletePaths(selectedPathIds);
  }

  function confirmDeletePath() {
    if (deletingPaths.length === 0) {
      return;
    }

    const pathIdSet = new Set(deletingPaths.map((path) => path.id));
    const deletedCount = deletingPaths.length;

    setPaths((current) =>
      current.map((path) =>
        pathIdSet.has(path.id)
          ? { ...path, status: "ARCHIVED", updatedAt: new Date().toISOString() }
          : path,
      ),
    );
    toast.info(
      deletedCount === 1 ? "Đã xóa lộ trình" : `Đã xóa ${deletedCount} lộ trình`,
      {
        description: "Lộ trình đã được chuyển vào thùng rác.",
      },
    );
    setIsPathEditorOpen(false);
    setSelectedPathIds((current) => current.filter((pathId) => !pathIdSet.has(pathId)));
    setDeletingPathIds([]);
  }

  function restorePaths(pathIds: string[]) {
    const pathIdSet = new Set(pathIds);
    const restoredCount = archivedPaths.filter((path) => pathIdSet.has(path.id)).length;
    if (restoredCount === 0) {
      return;
    }

    setPaths((current) =>
      current.map((path) =>
        pathIdSet.has(path.id) && path.status === "ARCHIVED"
          ? { ...path, status: "DRAFT", updatedAt: new Date().toISOString() }
          : path,
      ),
    );
    toast.success(
      restoredCount === 1
        ? "Đã khôi phục lộ trình"
        : `Đã khôi phục ${restoredCount} lộ trình`,
      {
        description: "Lộ trình trở lại danh sách ở trạng thái Nháp.",
      },
    );
  }

  function requestPermanentDeletePaths(pathIds: string[]) {
    const pathIdSet = new Set(pathIds);
    const archivedIds = archivedPaths
      .filter((path) => pathIdSet.has(path.id))
      .map((path) => path.id);

    if (archivedIds.length === 0) {
      return;
    }

    setPermanentDeletingPathIds(archivedIds);
  }

  function confirmPermanentDeletePaths() {
    if (permanentDeletingPaths.length === 0) {
      return;
    }

    const pathIdSet = new Set(permanentDeletingPaths.map((path) => path.id));
    const deletedCount = permanentDeletingPaths.length;

    setPaths((current) => current.filter((path) => !pathIdSet.has(path.id)));
    toast.success(
      deletedCount === 1
        ? "Đã xóa vĩnh viễn lộ trình"
        : `Đã xóa vĩnh viễn ${deletedCount} lộ trình`,
      {
        description: "Lộ trình đã được gỡ khỏi thùng rác.",
      },
    );
    setPermanentDeletingPathIds([]);
  }

  function closePermanentDeleteConfirm() {
    setPermanentDeletingPathIds([]);
  }

  function retryLoad() {
    void learningPathsQuery.refetch();
  }

  const viewState: ViewState = learningPathsQuery.isLoading
    ? "loading"
    : learningPathsQuery.isError
      ? "error"
      : "ready";

  return {
    allFilteredPathsSelected,
    archivedPaths,
    filteredPaths,
    gradeFilter,
    isArchiveDialogOpen,
    isPathEditorOpen,
    isSavingPath,
    isDarkTheme,
    isSidebarCollapsed,
    pathEditorMode,
    query,
    deletingPaths,
    editingPath,
    permanentDeletingPaths,
    selectedPathIds,
    sortDirection,
    sortKey,
    stats,
    statusFilter,
    subjectFilter,
    viewState,
    actions: {
      clearSelectedPaths: () => setSelectedPathIds([]),
      closeDeleteConfirm: () => setDeletingPathIds([]),
      closePermanentDeleteConfirm,
      closeArchiveDialog: () => setIsArchiveDialogOpen(false),
      closePathEditor: () => setIsPathEditorOpen(false),
      confirmDeletePath,
      confirmPermanentDeletePaths,
      openArchiveDialog: () => setIsArchiveDialogOpen(true),
      requestPermanentDeletePaths,
      requestDeletePath,
      requestDeleteSelectedPaths,
      retryLoad,
      restorePaths,
      savePath,
      setGradeFilter,
      setQuery,
      setStatusFilter,
      setSubjectFilter,
      startCreatePath,
      startEditPath,
      toggleDarkTheme: toggleTheme,
      toggleSidebarCollapsed: () => setIsSidebarCollapsed((current) => !current),
      toggleSelectAllPaths,
      toggleSelectPath,
      toggleSort,
    },
  };
}
