import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminStatuses,
  type AdminLearningPath,
  type AdminPublishStatus,
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
import { useAdminCatalogOptions } from "@/features/admin/domains/hooks/use-admin-catalog-options";
import { ApiRequestError } from "@/lib/api-client";
import { getQueryRenderState } from "@/lib/query-render-state";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";
import { useFilterSearchParams } from "@/lib/use-filter-search-params";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";

const learningPathSortKeys: LearningPathSortKey[] = [
  "title",
  "subject",
  "grade",
  "price",
  "status",
];

export function useAdminCoursesManager(
  initialLearningPaths?: AdminLearningPath[],
  initialThemeMode: AppThemeMode = "light",
) {
  const learningPathsQuery = useAdminLearningPathsQuery(initialLearningPaths);
  const catalogOptionsQuery = useAdminCatalogOptions();
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
  const { replaceFilterSearchParams, searchParams } = useFilterSearchParams();
  const paths = learningPathsQuery.data ?? [];
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
  const query = searchParams.get("q") ?? "";
  const catalogOptions = catalogOptionsQuery.data ?? {
    domains: [],
    targetAudiences: [],
  };
  const domainFilter = parseCatalogFilter(
    searchParams.get("domain"),
    catalogOptions.domains.map((domain) => domain.id),
  );
  const statusFilter = parseAdminStatusFilter(searchParams.get("status"));
  const targetAudienceFilter = parseCatalogFilter(
    searchParams.get("targetAudience"),
    catalogOptions.targetAudiences.map((audience) => audience.id),
  );
  const sortKey = parseLearningPathSortKey(searchParams.get("sort"));
  const sortDirection = parseSortDirection(searchParams.get("direction"));

  const editingPath = paths.find((path) => path.id === editingPathId) ?? null;
  const isSavingPath = mutations.createPath.isPending || mutations.updatePath.isPending;

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
        domainFilter,
        query,
        sortDirection,
        sortKey,
        statusFilter,
        targetAudienceFilter,
      }),
    [
      activePaths,
      domainFilter,
      query,
      sortDirection,
      sortKey,
      statusFilter,
      targetAudienceFilter,
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
      const nextDirection = sortDirection === "asc" ? "desc" : "asc";
      replaceFilterSearchParams({
        direction: nextDirection === "asc" ? null : nextDirection,
        sort: nextSortKey === "title" ? null : nextSortKey,
      });
      return;
    }

    replaceFilterSearchParams({
      direction: null,
      sort: nextSortKey === "title" ? null : nextSortKey,
    });
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
    void Promise.all([learningPathsQuery.refetch(), catalogOptionsQuery.refetch()]);
  }

  const queryRenderState = getQueryRenderState(learningPathsQuery);
  const canUseServerDataBeforeAuthHydration =
    !isAuthHydrated && initialLearningPaths !== undefined;
  const viewState: ViewState =
    canUseServerDataBeforeAuthHydration
      ? queryRenderState
      : !isAuthHydrated || !hasAdminAccess
      ? "loading"
      : !session?.accessToken
        ? "error"
        : queryRenderState;

  return {
    allFilteredPathsSelected,
    archivedPaths,
    catalogOptions,
    domainFilter,
    filteredPaths,
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
    targetAudienceFilter,
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
      setDomainFilter: (value: string | "ALL") => {
        replaceFilterSearchParams({ domain: value === "ALL" ? null : value });
      },
      setQuery: (value: string) => {
        replaceFilterSearchParams({ q: value });
      },
      setStatusFilter: (value: AdminPublishStatus | "ALL") => {
        replaceFilterSearchParams({
          status: value === "ALL" ? null : value.toLowerCase(),
        });
      },
      setTargetAudienceFilter: (value: string | "ALL") => {
        replaceFilterSearchParams({
          targetAudience: value === "ALL" ? null : value,
        });
      },
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

function parseAdminStatusFilter(value: string | null): AdminPublishStatus | "ALL" {
  const normalizedValue = value?.toUpperCase() as AdminPublishStatus | undefined;

  return normalizedValue && adminStatuses.some((status) => status === normalizedValue)
    ? normalizedValue
    : "ALL";
}

function parseCatalogFilter(value: string | null, optionIds: string[]): string | "ALL" {
  return value && optionIds.includes(value) ? value : "ALL";
}

function parseLearningPathSortKey(value: string | null): LearningPathSortKey {
  return value && learningPathSortKeys.includes(value as LearningPathSortKey)
    ? (value as LearningPathSortKey)
    : "title";
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}
