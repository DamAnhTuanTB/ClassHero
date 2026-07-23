import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type AdminLearningPath,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin/courses/admin-courses-data";
import {
  useAdminCourseMutations,
  useAdminLearningPathsQuery,
} from "@/features/admin/courses/hooks/use-admin-course-queries";
import type { LearningPathFormValues } from "@/features/admin/courses/admin-courses-schemas";
import type {
  EditorMode,
  LearningPathSortKey,
  SortDirection,
  ViewState,
} from "@/features/admin/courses/admin-courses-types";
import {
  filterAndSortLearningPaths,
  getActiveLearningPaths,
  getAdminCourseStats,
  getArchivedLearningPaths,
} from "@/features/admin/courses/admin-courses-utils";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import { ApiRequestError } from "@/lib/api-client";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";

export function useAdminCoursesManager(
  initialLearningPaths?: AdminLearningPath[],
  initialThemeMode: AppThemeMode = "light",
) {
  const learningPathsQuery = useAdminLearningPathsQuery(initialLearningPaths);
  const {
    isAuthHydrated,
    isAuthorized: hasAdminAccess,
    session,
  } = useAuthGuard({
    allowedRoles: ["ADMIN"],
    authError: learningPathsQuery.error,
  });
  const mutations = useAdminCourseMutations();
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<AdminSubject | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AdminPublishStatus | "ALL">("ALL");
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<LearningPathSortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const editingPath = paths.find((path) => path.id === editingPathId) ?? null;
  const isSavingPath = mutations.createPath.isPending || mutations.updatePath.isPending;

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
    try {
      if (pathEditorMode === "create") {
        const createdPath = await mutations.createPath.mutateAsync(values);
        setEditingPathId(createdPath.id);
        setPathEditorMode("edit");
        setIsPathEditorOpen(false);
        toast.success("Đã tạo khóa học", {
          description: "Mở chi tiết khóa học để thêm chương học và buổi học.",
        });
      } else if (editingPath) {
        await mutations.updatePath.mutateAsync({
          pathId: editingPath.id,
          values,
        });
        setIsPathEditorOpen(false);
        toast.success("Đã lưu khóa học", {
          description: "Thông tin quản trị đã được cập nhật.",
        });
      }
    } catch (error) {
      toast.error("Chưa lưu được khóa học", {
        description: getErrorMessage(error),
      });
    }
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

  async function confirmDeletePath() {
    if (deletingPaths.length === 0) {
      return;
    }

    const pathIdSet = new Set(deletingPaths.map((path) => path.id));
    const deletedCount = deletingPaths.length;

    try {
      await Promise.all(
        deletingPaths.map((path) =>
          mutations.archivePath.mutateAsync({
            pathId: path.id,
          }),
        ),
      );
      toast.info(
        deletedCount === 1 ? "Đã xóa khóa học" : `Đã xóa ${deletedCount} khóa học`,
        {
          description: "Khóa học đã được chuyển vào thùng rác.",
        },
      );
      setIsPathEditorOpen(false);
      setSelectedPathIds((current) => current.filter((pathId) => !pathIdSet.has(pathId)));
      setDeletingPathIds([]);
    } catch (error) {
      toast.error("Chưa xóa được khóa học", {
        description: getErrorMessage(error),
      });
    }
  }

  async function restorePaths(pathIds: string[]) {
    const pathIdSet = new Set(pathIds);
    const restoredCount = archivedPaths.filter((path) => pathIdSet.has(path.id)).length;
    if (restoredCount === 0) {
      return;
    }

    try {
      await Promise.all(
        pathIds.map((pathId) =>
          mutations.restorePath.mutateAsync({
            pathId,
          }),
        ),
      );
      toast.success(
        restoredCount === 1
          ? "Đã khôi phục khóa học"
          : `Đã khôi phục ${restoredCount} khóa học`,
        {
          description: "Khóa học trở lại danh sách ở trạng thái Nháp.",
        },
      );
    } catch (error) {
      toast.error("Chưa khôi phục được khóa học", {
        description: getErrorMessage(error),
      });
    }
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

  async function confirmPermanentDeletePaths() {
    if (permanentDeletingPaths.length === 0) {
      return;
    }

    const deletedCount = permanentDeletingPaths.length;

    try {
      await Promise.all(
        permanentDeletingPaths.map((path) =>
          mutations.deletePathPermanently.mutateAsync({
            pathId: path.id,
          }),
        ),
      );
      toast.success(
        deletedCount === 1
          ? "Đã xóa vĩnh viễn khóa học"
          : `Đã xóa vĩnh viễn ${deletedCount} khóa học`,
        {
          description: "Khóa học đã được gỡ khỏi thùng rác.",
        },
      );
      setPermanentDeletingPathIds([]);
    } catch (error) {
      toast.error("Chưa xóa vĩnh viễn được khóa học", {
        description: getErrorMessage(error),
      });
    }
  }

  function closePermanentDeleteConfirm() {
    setPermanentDeletingPathIds([]);
  }

  function retryLoad() {
    void learningPathsQuery.refetch();
  }

  const viewState: ViewState =
    !isAuthHydrated || !hasAdminAccess || learningPathsQuery.isLoading
      ? "loading"
      : learningPathsQuery.isError || !session?.accessToken
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
    uploadCover: (file: File) => mutations.uploadCover.mutateAsync(file),
    isDeletingPath: mutations.archivePath.isPending,
    isPermanentDeletingPath: mutations.deletePathPermanently.isPending,
    isRestoringPath: mutations.restorePath.isPending,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return "Vui lòng thử lại sau ít phút.";
}
