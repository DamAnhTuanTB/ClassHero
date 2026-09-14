"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  RefreshCw,
  Settings2,
  TableProperties,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { AdminCoursesSidebar } from "@/components/admin/courses/admin-courses-sidebar";
import { getAdminNavigationItems } from "@/components/admin/courses/admin-navigation-items";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import {
  createProviderCatalogItem,
  createProviderPriceVersion,
  deleteProviderCatalogItem,
  getAiConfigurations,
  getProviderBudgets,
  getProviderCatalog,
  getProviderOverview,
  getUsageBreakdown,
  getUsageEvents,
  getUsageTimeline,
  updateAiConfigurations,
  updateProviderBudgets,
  updateProviderCatalogItem,
} from "@/features/admin/ai-settings/api/provider-operations-api";
import { ModelConfigurationsTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/model-configurations-tab";
import { ProviderCatalogTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/provider-catalog-tab";
import { UsageCostTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/usage-cost-tab";
import type {
  AiChatRuntimeSettings,
  AiFeatureConfiguration,
  ProviderBudget,
  UsageGranularity,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import {
  formatDateTime,
  formatVnd,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore } from "@/lib/theme-store";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

type TabKey = "models" | "usage" | "catalog";
const tabs = [
  { key: "models" as const, label: "Thiết lập mặc định", icon: Settings2 },
  { key: "usage" as const, label: "Chi phí sử dụng", icon: CircleDollarSign },
  { key: "catalog" as const, label: "Quản lý model", icon: TableProperties },
];
const adminNavItems = getAdminNavigationItems("ai-settings");

export function AdminAiSettingsScreen() {
  const { isAuthorized } = useAuthGuard({ allowedRoles: ["ADMIN"] });
  const session = useAuthSessionStore((state) => state.session);
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab") as TabKey | null;
  const initialTab = tabParam && tabs.some((t) => t.key === tabParam) ? tabParam : "models";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());
  const [granularity, setGranularity] = useState<UsageGranularity>("DAY");
  const isDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );
  const enabled = isAuthorized && Boolean(token);
  const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);

  const selectTab = (tab: TabKey) => {
    setActiveTab(tab);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    window.requestAnimationFrame(() => {
      tabRefs.current.get(tab)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  };

  const handleTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (activeTabIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (activeTabIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex]?.key;
    if (nextTab) {
      selectTab(nextTab);
      window.requestAnimationFrame(() => tabRefs.current.get(nextTab)?.focus());
    }
  };

  const overviewQuery = useQuery({
    queryKey: ["provider-operations", "overview"],
    queryFn: () => getProviderOverview(token),
    enabled,
  });
  const configurationsQuery = useQuery({
    queryKey: ["provider-operations", "ai-configurations"],
    queryFn: () => getAiConfigurations(token),
    enabled,
  });

  const catalogQuery = useQuery({
    queryKey: ["provider-operations", "catalog"],
    queryFn: () => getProviderCatalog(token),
    enabled: enabled && activeTab === "catalog",
  });
  const budgetsQuery = useQuery({
    queryKey: ["provider-operations", "budgets"],
    queryFn: () => getProviderBudgets(token),
    enabled: enabled && activeTab === "usage",
  });
  const timelineQuery = useQuery({
    queryKey: ["provider-operations", "timeline", granularity],
    queryFn: () => getUsageTimeline(granularity, token),
    enabled: enabled && activeTab === "usage",
  });
  const breakdownQuery = useQuery({
    queryKey: ["provider-operations", "breakdown"],
    queryFn: () => getUsageBreakdown(token),
    enabled: enabled && activeTab === "usage",
  });
  const [eventsPage, setEventsPage] = useState(1);

  const eventsQuery = useQuery({
    queryKey: ["provider-operations", "events", eventsPage],
    queryFn: () => getUsageEvents(token, eventsPage),
    enabled: enabled && activeTab === "usage",
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["provider-operations"] });
  };
  const configurationMutation = useMutation({
    mutationFn: (input: {
      configurations: AiFeatureConfiguration[];
      chatSettings?: AiChatRuntimeSettings;
    }) =>
      updateAiConfigurations(
        input.configurations,
        token,
        input.chatSettings,
      ),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã lưu mô hình AI");
    },
    onError: () => toast.error("Chưa thể lưu mô hình AI. Vui lòng thử lại."),
  });

  const budgetMutation = useMutation({
    mutationFn: (budgets: ProviderBudget[]) => updateProviderBudgets(budgets, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã lưu ngân sách");
    },
    onError: () => toast.error("Chưa thể lưu ngân sách. Vui lòng thử lại."),
  });
  const priceMutation = useMutation({
    mutationFn: ({
      catalogItemId,
      input,
    }: {
      catalogItemId: string;
      input: Parameters<typeof createProviderPriceVersion>[1];
    }) => createProviderPriceVersion(catalogItemId, input, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã cập nhật bảng giá");
    },
    onError: () => toast.error("Chưa thể lưu bảng giá. Vui lòng thử lại."),
  });
  
  const createModelMutation = useMutation({
    mutationFn: (input: Parameters<typeof createProviderCatalogItem>[0]) => 
      createProviderCatalogItem(input, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã thêm mô hình mới");
    },
    onError: () => toast.error("Chưa thể thêm mô hình. Vui lòng thử lại."),
  });
  
  const updateModelMutation = useMutation({
    mutationFn: ({ id, input }: { id: string, input: Parameters<typeof updateProviderCatalogItem>[1] }) => 
      updateProviderCatalogItem(id, input, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã cập nhật mô hình");
    },
    onError: () => toast.error("Chưa thể cập nhật mô hình. Vui lòng thử lại."),
  });
  
  const deleteModelMutation = useMutation({
    mutationFn: (id: string) => deleteProviderCatalogItem(id, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã xoá mô hình");
    },
    onError: (error: unknown) => {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa thể xoá mô hình. Vui lòng thử lại.",
        ),
      );
    }
  });

  if (!isAuthorized) return null;

  const overview = overviewQuery.data;
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
          subtitle="Quản lý AI và tài liệu"
          items={adminNavItems}
          isDarkTheme={isDarkTheme}
          isCollapsed={isSidebarCollapsed}
          showAdminProfileTools
          onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
          onToggleDarkTheme={toggleTheme}
        />

        <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">
                Cài đặt AI
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={overviewQuery.isFetching}
              className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-4 w-4", overviewQuery.isFetching && "animate-spin")}
                aria-hidden="true"
              />
              Làm mới
            </button>
          </header>

          {overviewQuery.isLoading ? (
            <OverviewSkeleton />
          ) : overviewQuery.isError ? (
            <AdminDataErrorState
              className="mt-6"
              description="Vui lòng thử lại để xem tổng quan vận hành và chi phí."
              isRetrying={overviewQuery.isFetching}
              onRetry={() => overviewQuery.refetch()}
              title="Không tải được tổng quan Cài đặt AI"
              variant="compact"
            />
          ) : overview ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Chi phí tháng này"
                value={formatVnd(overview.totalCostVnd)}
                hint={`${overview.calls} lượt sử dụng`}
              />
              <KpiCard
                label="Tiết kiệm nhờ dùng lại"
                value={formatVnd(overview.savedCostVnd)}
                hint="Nhờ dùng lại kết quả đã có"
                tone="success"
              />
              <KpiCard
                label="Tỷ lệ thành công"
                value={`${overview.successRate}%`}
                hint={`${overview.failedCount} lượt lỗi`}
                tone={overview.successRate >= 95 ? "primary" : "warning"}
              />
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto overflow-y-hidden border-b border-[var(--theme-border)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="relative grid min-w-[38rem] grid-cols-3"
              role="tablist"
              aria-label="Cài đặt AI"
              onKeyDown={handleTabsKeyDown}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  ref={(element) => {
                    if (element) tabRefs.current.set(tab.key, element);
                    else tabRefs.current.delete(tab.key);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls="ai-settings-tab-panel"
                  tabIndex={activeTab === tab.key ? 0 : -1}
                  onClick={() => selectTab(tab.key)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-extrabold transition-colors sm:px-4",
                    activeTab === tab.key
                      ? "text-[var(--theme-primary)]"
                      : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]",
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/3 rounded-full bg-[var(--theme-primary)] transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
              />
            </div>
          </div>

          <div id="ai-settings-tab-panel" role="tabpanel" className="min-h-[28rem] py-6">
            {activeTab === "models" ? (
              configurationsQuery.isLoading ? (
                <TabLoading />
              ) : configurationsQuery.isError || !configurationsQuery.data ? (
                <AdminDataErrorState
                  description="Vui lòng thử lại để tiếp tục chọn mô hình AI."
                  headingLevel={3}
                  isRetrying={configurationsQuery.isFetching}
                  onRetry={() => configurationsQuery.refetch()}
                  title="Không tải được danh sách mô hình AI"
                  variant="section"
                />
              ) : (
                <ModelConfigurationsTab
                  data={configurationsQuery.data}
                  isSaving={configurationMutation.isPending}
                  onSave={(configurations, chatSettings) =>
                    configurationMutation.mutate({
                      configurations,
                      chatSettings,
                    })
                  }
                />
              )
            ) : null}

            {activeTab === "usage" ? (
              budgetsQuery.isError ||
              timelineQuery.isError ||
              breakdownQuery.isError ||
              eventsQuery.isError ? (
                <AdminDataErrorState
                  description="Vui lòng thử lại để xem thống kê chi phí và ngân sách."
                  headingLevel={3}
                  isRetrying={
                    budgetsQuery.isFetching ||
                    timelineQuery.isFetching ||
                    breakdownQuery.isFetching ||
                    eventsQuery.isFetching
                  }
                  onRetry={() =>
                    Promise.all([
                      budgetsQuery.refetch(),
                      timelineQuery.refetch(),
                      breakdownQuery.refetch(),
                      eventsQuery.refetch(),
                    ])
                  }
                  title="Không tải được dữ liệu chi phí"
                  variant="section"
                />
              ) : (
                <UsageCostTab
                  budgets={budgetsQuery.data ?? overview?.budgets ?? []}
                  timeline={timelineQuery.data}
                  breakdown={breakdownQuery.data}
                  events={eventsQuery.data}
                  eventsPage={eventsPage}
                  granularity={granularity}
                  isLoading={
                    timelineQuery.isLoading ||
                    breakdownQuery.isLoading ||
                    eventsQuery.isLoading
                  }
                  isSavingBudgets={budgetMutation.isPending}
                  onEventsPageChange={setEventsPage}
                  onGranularityChange={setGranularity}
                  onSaveBudgets={(items) => budgetMutation.mutate(items)}
                />
              )
            ) : null}
            {activeTab === "catalog" ? (
              catalogQuery.isLoading ? (
                <TabLoading />
              ) : catalogQuery.isError || !catalogQuery.data ? (
                <AdminDataErrorState
                  description="Vui lòng thử lại để xem bảng giá."
                  headingLevel={3}
                  isRetrying={catalogQuery.isFetching}
                  onRetry={() => catalogQuery.refetch()}
                  title="Không tải được bảng giá dịch vụ"
                  variant="section"
                />
              ) : (
                <ProviderCatalogTab
                  catalog={catalogQuery.data}
                  configurations={configurationsQuery.data?.configurations}
                  fxRateVndPerUsd={overview?.accounting.fxRateVndPerUsd}
                  isSaving={priceMutation.isPending}
                  onCreatePrice={async (catalogItemId, input) => {
                    await priceMutation.mutateAsync({ catalogItemId, input });
                  }}
                  onCreateModel={async (input) => {
                    await createModelMutation.mutateAsync(input);
                  }}
                  onUpdateModel={async (id, input) => {
                    await updateModelMutation.mutateAsync({ id, input });
                  }}
                  onDeleteModel={async (id) => {
                    await deleteModelMutation.mutateAsync(id);
                  }}
                  onRefreshCatalog={() => catalogQuery.refetch()}
                  isMutatingModel={
                    createModelMutation.isPending || 
                    updateModelMutation.isPending || 
                    deleteModelMutation.isPending
                  }
                />
              )
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  const accent =
    tone === "primary"
      ? "text-[var(--theme-primary)]"
      : tone === "success"
        ? "text-[var(--theme-success-text)]"
        : tone === "warning"
          ? "text-[var(--theme-warning-text)]"
          : "text-[var(--theme-text-strong)]";
  return (
    <article className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <p className="text-sm font-bold text-[var(--theme-text-muted)]">{label}</p>
      <p className={cn("mt-2 text-xl font-extrabold", accent)}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--theme-text-muted)]">{hint}</p>
    </article>
  );
}

function OverviewSkeleton() {
  return (
    <div
      className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Đang tải tổng quan AI"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4"
        >
          <SkeletonBlock className="h-4 w-28 rounded" />
          <SkeletonBlock className="mt-3 h-7 w-36 rounded" />
          <SkeletonBlock className="mt-2 h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}
function TabLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-label="Đang tải dữ liệu">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5"
        >
          <SkeletonBlock className="h-4 w-24 rounded" />
          <SkeletonBlock className="mt-3 h-6 w-40 rounded" />
          <SkeletonBlock className="mt-5 h-12 w-full rounded-xl" />
          <SkeletonBlock className="mt-3 h-12 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
