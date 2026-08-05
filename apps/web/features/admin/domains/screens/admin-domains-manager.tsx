"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type DragEvent } from "react";
import { toast } from "sonner";
import { AdminCoursesSidebar } from "@/components/admin/courses/admin-courses-sidebar";
import { getAdminNavigationItems } from "@/components/admin/courses/admin-navigation-items";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import {
  createAdminDomain,
  deleteAdminDomain,
  listAdminDomains,
  reorderAdminDomains,
  updateAdminDomain,
  type AdminDomain,
} from "@/features/admin/domains/api/admin-domains-api";
import { AdminDomainsListSkeleton } from "@/features/admin/domains/screens/admin-domains-manager/components/admin-domains-list-skeleton";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore } from "@/lib/theme-store";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import { cn } from "@/lib/utils";

const adminNavItems = getAdminNavigationItems("domains");

export function AdminDomainsManager() {
  const { isAuthorized } = useAuthGuard({ allowedRoles: ["ADMIN"] });
  const session = useAuthSessionStore((state) => state.session);
  const isDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<AdminDomain | null>(null);
  const [draggedDomainId, setDraggedDomainId] = useState<string | null>(null);
  const [domainDropTargetId, setDomainDropTargetId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const token = session?.accessToken ?? "";
  const domainsQueryKey = ["admin-domains", session?.user.id] as const;
  const domainsQuery = useQuery({
    queryKey: domainsQueryKey,
    queryFn: () => listAdminDomains(token),
    enabled: isAuthorized && Boolean(token),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-domains"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-course-catalog-options"] }),
    ]);

  const createMutation = useMutation({
    mutationFn: () => createAdminDomain(name, token),
    onSuccess: async () => {
      setName("");
      await refresh();
      toast.success("Đã thêm lĩnh vực");
    },
    onError: () => toast.error("Không thể thêm lĩnh vực"),
  });
  const updateMutation = useMutation({
    mutationFn: () => updateAdminDomain(editing!.id, name, token),
    onSuccess: async () => {
      setEditing(null);
      setName("");
      await refresh();
      toast.success("Đã cập nhật lĩnh vực");
    },
    onError: () => toast.error("Không thể cập nhật lĩnh vực"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminDomain(id, token),
    onSuccess: refresh,
    onError: () => toast.error("Không thể xóa lĩnh vực đang được sử dụng"),
  });
  const reorderMutation = useMutation({
    mutationFn: (domainIds: string[]) => reorderAdminDomains(domainIds, token),
    onMutate: async (domainIds) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      const previousDomains = queryClient.getQueryData<AdminDomain[]>(domainsQueryKey);
      const domainById = new Map(
        previousDomains?.map((domain) => [domain.id, domain]) ?? [],
      );
      const nextDomains = domainIds.flatMap((domainId, index): AdminDomain[] => {
        const domain = domainById.get(domainId);

        return domain ? [{ ...domain, sortOrder: index + 1 }] : [];
      });

      queryClient.setQueryData(domainsQueryKey, nextDomains);
      return { previousDomains };
    },
    onSuccess: async (domains) => {
      queryClient.setQueryData(domainsQueryKey, domains);
      await queryClient.invalidateQueries({
        queryKey: ["admin-course-catalog-options"],
      });
      toast.success("Đã cập nhật thứ tự lĩnh vực");
    },
    onError: (_error, _domainIds, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
      }
      toast.error("Không thể cập nhật thứ tự lĩnh vực");
    },
  });
  const pending = createMutation.isPending || updateMutation.isPending;

  const reorderDomains = (sourceDomainId: string, targetDomainId: string) => {
    const domains = domainsQuery.data ?? [];
    const sourceIndex = domains.findIndex((domain) => domain.id === sourceDomainId);
    const targetIndex = domains.findIndex((domain) => domain.id === targetDomainId);

    if (
      reorderMutation.isPending ||
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    const nextDomains = [...domains];
    const [sourceDomain] = nextDomains.splice(sourceIndex, 1);

    if (!sourceDomain) {
      return;
    }

    nextDomains.splice(targetIndex, 0, sourceDomain);
    reorderMutation.mutate(nextDomains.map((domain) => domain.id));
  };

  const handleDomainDragStart = (
    event: DragEvent<HTMLButtonElement>,
    domainId: string,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", domainId);
    setDraggedDomainId(domainId);
  };

  const handleDomainDragOver = (event: DragEvent<HTMLDivElement>, domainId: string) => {
    if (!draggedDomainId || draggedDomainId === domainId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDomainDropTargetId(domainId);
  };

  const handleDomainDrop = (event: DragEvent<HTMLDivElement>, targetDomainId: string) => {
    event.preventDefault();
    if (draggedDomainId && draggedDomainId !== targetDomainId) {
      reorderDomains(draggedDomainId, targetDomainId);
    }
    setDraggedDomainId(null);
    setDomainDropTargetId(null);
  };

  const clearDragState = () => {
    setDraggedDomainId(null);
    setDomainDropTargetId(null);
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <main data-admin-theme="true" className="theme-page">
      <div
        className={cn(
          "admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200",
          isSidebarCollapsed
            ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
            : "lg:grid-cols-[17rem_minmax(0,1fr)]",
        )}
      >
        <AdminCoursesSidebar
          subtitle="Quản lý nội dung học"
          items={adminNavItems}
          isDarkTheme={isDarkTheme}
          isCollapsed={isSidebarCollapsed}
          showAdminProfileTools
          onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          onToggleDarkTheme={toggleTheme}
        />

        <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">
                  Quản lý lĩnh vực
                </h1>
              </div>
            </header>

            <div className="mt-6">
              <form
                className="flex flex-col gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (name.trim()) {
                    (editing ? updateMutation : createMutation).mutate();
                  }
                }}
              >
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Tiếng Anh"
                  aria-label="Tên lĩnh vực"
                  className="min-h-11 flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 font-semibold text-[var(--theme-text)] outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)] dark:focus:ring-1"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 font-extrabold disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {editing ? "Lưu thay đổi" : "Thêm lĩnh vực"}
                </button>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setName("");
                    }}
                    className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 font-bold"
                  >
                    Hủy
                  </button>
                ) : null}
              </form>

              <section className="mt-4 overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                {/* {domainsQuery.data && domainsQuery.data.length > 0 ? (
 <div className="border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-3">
 <p className="text-sm font-bold text-[var(--theme-text-muted)]">
 Kéo biểu tượng ở đầu mỗi dòng để đổi thứ tự hiển thị.
 </p>
 </div>
 ) : null} */}
                {domainsQuery.isLoading ? <AdminDomainsListSkeleton /> : null}
                {domainsQuery.isError ? (
                  <AdminDataErrorState
                    className="rounded-none border-0 shadow-none"
                    description="Vui lòng thử lại để tiếp tục quản lý các lĩnh vực."
                    headingLevel={3}
                    isRetrying={domainsQuery.isFetching}
                    onRetry={() => domainsQuery.refetch()}
                    title="Không tải được danh sách lĩnh vực"
                    variant="compact"
                  />
                ) : null}
                {domainsQuery.data?.map((domain) => (
                  <div
                    key={domain.id}
                    onDragOver={(event) => handleDomainDragOver(event, domain.id)}
                    onDragLeave={() => setDomainDropTargetId(null)}
                    onDrop={(event) => handleDomainDrop(event, domain.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 border-b border-[var(--theme-border)] px-4 py-3 transition last:border-0",
                      draggedDomainId === domain.id && "opacity-60",
                      domainDropTargetId === domain.id &&
                        "bg-[var(--theme-success-bg)] ring-2 ring-inset ring-[var(--theme-success-border)]",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        draggable={!reorderMutation.isPending}
                        onDragStart={(event) => handleDomainDragStart(event, domain.id)}
                        onDragEnd={clearDragState}
                        disabled={reorderMutation.isPending}
                        aria-label={`Kéo để đổi vị trí ${domain.name}`}
                        title="Kéo để đổi vị trí lĩnh vực"
                        className="grid h-10 w-6 shrink-0 cursor-grab place-items-center rounded-md text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] active:cursor-grabbing disabled:opacity-50"
                      >
                        <GripVertical className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <p className="truncate font-extrabold text-[var(--theme-text-strong)]">
                        {domain.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        aria-label={`Sửa ${domain.name}`}
                        onClick={() => {
                          setEditing(domain);
                          setName(domain.name);
                        }}
                        className="theme-button-primary-subtle inline-flex h-10 w-10 items-center justify-center rounded-lg"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Xóa ${domain.name}`}
                        onClick={() => {
                          if (window.confirm(`Xóa lĩnh vực ${domain.name}?`)) {
                            deleteMutation.mutate(domain.id);
                          }
                        }}
                        className="theme-button-danger-subtle inline-flex h-10 w-10 items-center justify-center rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                {domainsQuery.data?.length === 0 ? (
                  <p className="p-5 text-sm text-[var(--theme-text-muted)]">
                    Chưa có lĩnh vực. Hãy thêm lĩnh vực đầu tiên.
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
