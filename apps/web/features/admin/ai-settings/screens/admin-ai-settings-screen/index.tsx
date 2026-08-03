"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CircleDollarSign, DatabaseZap, Loader2, RefreshCw, Settings2, TableProperties } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminCoursesSidebar } from "@/components/admin/courses/admin-courses-sidebar";
import { getAdminNavigationItems } from "@/components/admin/courses/admin-navigation-items";
import {
  createProviderPriceVersion,
  getAiConfigurations,
  getOcrSettings,
  getProviderAuditHistory,
  getProviderBudgets,
  getProviderCatalog,
  getProviderOverview,
  getUsageBreakdown,
  getUsageEvents,
  getUsageTimeline,
  updateAiConfigurations,
  updateOcrSettings,
  updateProviderBudgets,
} from "@/features/admin/ai-settings/api/provider-operations-api";
import { ModelConfigurationsTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/model-configurations-tab";
import { OcrSettingsTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/ocr-settings-tab";
import { ProviderCatalogTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/provider-catalog-tab";
import { UsageCostTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/usage-cost-tab";
import type {
  AccountingSettings,
  AiFeatureConfiguration,
  ProviderBudget,
  UsageGranularity,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import { formatDateTime, formatVnd } from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore } from "@/lib/theme-store";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import { cn } from "@/lib/utils";

type TabKey = "models" | "ocr" | "usage" | "catalog";
const tabs = [
  { key: "models" as const, label: "Cấu hình model", icon: Settings2 },
  { key: "ocr" as const, label: "OCR & tài liệu", icon: DatabaseZap },
  { key: "usage" as const, label: "Chi phí & sử dụng", icon: CircleDollarSign },
  { key: "catalog" as const, label: "Bảng giá provider", icon: TableProperties },
];
const adminNavItems = getAdminNavigationItems("ai-settings");

export function AdminAiSettingsScreen() {
  const { isAuthorized } = useAuthGuard({ allowedRoles: ["ADMIN"] });
  const session = useAuthSessionStore((state) => state.session);
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("models");
  const [granularity, setGranularity] = useState<UsageGranularity>("DAY");
  const isDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );
  const enabled = isAuthorized && Boolean(token);

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
  const ocrQuery = useQuery({
    queryKey: ["provider-operations", "ocr-settings"],
    queryFn: () => getOcrSettings(token),
    enabled: enabled && activeTab === "ocr",
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
  const eventsQuery = useQuery({
    queryKey: ["provider-operations", "events", 1],
    queryFn: () => getUsageEvents(token),
    enabled: enabled && activeTab === "usage",
  });
  const auditQuery = useQuery({
    queryKey: ["provider-operations", "audit"],
    queryFn: () => getProviderAuditHistory(token),
    enabled: enabled && activeTab === "catalog",
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["provider-operations"] });
  };
  const configurationMutation = useMutation({
    mutationFn: (configurations: AiFeatureConfiguration[]) =>
      updateAiConfigurations(configurations, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã lưu cấu hình model");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể lưu cấu hình model"),
  });
  const ocrMutation = useMutation({
    mutationFn: (settings: AccountingSettings) => updateOcrSettings(settings, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã lưu thiết lập OCR");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể lưu thiết lập OCR"),
  });
  const budgetMutation = useMutation({
    mutationFn: (budgets: ProviderBudget[]) => updateProviderBudgets(budgets, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã lưu ngân sách provider");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể lưu ngân sách"),
  });
  const priceMutation = useMutation({
    mutationFn: ({ catalogItemId, input }: { catalogItemId: string; input: Parameters<typeof createProviderPriceVersion>[1] }) =>
      createProviderPriceVersion(catalogItemId, input, token),
    onSuccess: async () => {
      await refreshAll();
      toast.success("Đã thêm phiên bản giá");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể lưu bảng giá"),
  });

  if (!isAuthorized) return null;

  const overview = overviewQuery.data;
  return (
    <main data-admin-theme="true" className="theme-page">
      <div className={cn("admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200", isSidebarCollapsed ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
        <AdminCoursesSidebar
          subtitle="Vận hành AI & OCR"
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
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--theme-primary)]"><Bot className="h-4 w-4" /> Trung tâm vận hành provider</div>
              <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">Cài đặt AI</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--theme-text-muted)]">Chọn model cho từng chức năng, theo dõi AI/OCR và kiểm soát chi phí trong một màn hình.</p>
            </div>
            <button type="button" onClick={() => void refreshAll()} disabled={overviewQuery.isFetching} className="theme-button-neutral inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"><RefreshCw className={cn("h-4 w-4", overviewQuery.isFetching && "animate-spin")} />Làm mới</button>
          </header>

          {overviewQuery.isLoading ? (
            <div className="mt-6 grid min-h-40 place-items-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]"><div className="inline-flex items-center gap-2 font-bold text-[var(--theme-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" />Đang tải tổng quan AI</div></div>
          ) : overviewQuery.isError ? (
            <div className="mt-6 rounded-xl border border-[var(--theme-danger-border)] bg-[var(--theme-danger-bg)] p-5"><p className="font-extrabold text-[var(--theme-danger-text)]">Không tải được dữ liệu Cài đặt AI</p><button type="button" onClick={() => void overviewQuery.refetch()} className="mt-3 min-h-10 rounded-lg border border-[var(--theme-danger-border)] px-4 text-sm font-extrabold text-[var(--theme-danger-text)]">Thử lại</button></div>
          ) : overview ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Chi phí tháng này" value={formatVnd(overview.totalCostVnd)} hint={`${overview.calls} lượt provider`} />
              <KpiCard label="Tiết kiệm nhờ cache" value={formatVnd(overview.savedCostVnd)} hint="OCR/AI cached usage" tone="success" />
              <KpiCard label="Tỷ lệ thành công" value={`${overview.successRate}%`} hint={`${overview.failedCount} lượt lỗi`} tone={overview.successRate >= 95 ? "success" : "warning"} />
              <KpiCard label="Dữ liệu gần nhất" value={overview.latestUsageAt ? formatDateTime(overview.latestUsageAt) : "Chưa có"} hint="Asia/Ho_Chi_Minh" />
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto border-b border-[var(--theme-border)]">
            <div className="flex min-w-max gap-1" role="tablist" aria-label="Cài đặt AI">
              {tabs.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-extrabold transition", activeTab === tab.key ? "border-[var(--theme-primary)] text-[var(--theme-primary)]" : "border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]")}><tab.icon className="h-4 w-4" />{tab.label}</button>)}
            </div>
          </div>

          <div className="py-6">
            {activeTab === "models" ? configurationsQuery.isLoading ? <TabLoading /> : configurationsQuery.isError || !configurationsQuery.data ? <TabError onRetry={() => void configurationsQuery.refetch()} /> : <ModelConfigurationsTab data={configurationsQuery.data} isSaving={configurationMutation.isPending} onSave={(items) => configurationMutation.mutate(items)} /> : null}
            {activeTab === "ocr" ? ocrQuery.isLoading ? <TabLoading /> : ocrQuery.isError || !ocrQuery.data ? <TabError onRetry={() => void ocrQuery.refetch()} /> : <OcrSettingsTab data={ocrQuery.data} isSaving={ocrMutation.isPending} onSave={(settings) => ocrMutation.mutate(settings)} /> : null}
            {activeTab === "usage" ? <UsageCostTab budgets={budgetsQuery.data ?? overview?.budgets ?? []} timeline={timelineQuery.data} breakdown={breakdownQuery.data} events={eventsQuery.data} granularity={granularity} isLoading={timelineQuery.isLoading || breakdownQuery.isLoading || eventsQuery.isLoading} isSavingBudgets={budgetMutation.isPending} onGranularityChange={setGranularity} onSaveBudgets={(items) => budgetMutation.mutate(items)} /> : null}
            {activeTab === "catalog" ? catalogQuery.isLoading ? <TabLoading /> : catalogQuery.isError || !catalogQuery.data ? <TabError onRetry={() => void catalogQuery.refetch()} /> : <ProviderCatalogTab catalog={catalogQuery.data} audit={auditQuery.data} isSaving={priceMutation.isPending} onCreatePrice={async (catalogItemId, input) => { await priceMutation.mutateAsync({ catalogItemId, input }); }} /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: "default" | "success" | "warning" }) {
  const accent = tone === "success" ? "text-[var(--theme-success-text)]" : tone === "warning" ? "text-[var(--theme-warning-text)]" : "text-[var(--theme-text-strong)]";
  return <article className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4"><p className="text-sm font-bold text-[var(--theme-text-muted)]">{label}</p><p className={cn("mt-2 text-xl font-extrabold", accent)}>{value}</p><p className="mt-1 text-xs font-semibold text-[var(--theme-text-muted)]">{hint}</p></article>;
}

function TabLoading() { return <div className="grid min-h-56 place-items-center"><div className="inline-flex items-center gap-2 font-bold text-[var(--theme-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" />Đang tải dữ liệu</div></div>; }
function TabError({ onRetry }: { onRetry: () => void }) { return <div className="rounded-xl border border-[var(--theme-danger-border)] bg-[var(--theme-danger-bg)] p-5 text-center"><p className="font-extrabold text-[var(--theme-danger-text)]">Chưa thể tải dữ liệu.</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-[var(--theme-danger-border)] px-4 py-2 text-sm font-extrabold text-[var(--theme-danger-text)]">Thử lại</button></div>; }
