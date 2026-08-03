"use client";

import {
  Loader2,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { logout } from "@/features/auth/api/auth-api";
import {
  clearAuthSessionEverywhere,
  useAuthSessionStore,
} from "@/features/auth/session/auth-session";
import type { AdminCoursesSidebarItem } from "@/components/admin/courses/admin-courses-sidebar";
import { resetFilterSearchParamsEvent } from "@/lib/use-filter-search-params";
import { cn } from "@/lib/utils";

type AdminCoursesSidebarContentProps = {
  subtitle: string;
  items: AdminCoursesSidebarItem[];
  isDarkTheme: boolean;
  isCollapsed: boolean;
  showAdminProfileTools: boolean;
  onToggleCollapsed?: () => void;
  onToggleDarkTheme?: () => void;
};

export function AdminCoursesSidebarContent({
  items,
  isDarkTheme,
  isCollapsed,
  showAdminProfileTools,
  onToggleCollapsed,
  onToggleDarkTheme,
}: AdminCoursesSidebarContentProps) {
  const router = useRouter();
  const session = useAuthSessionStore((state) => state.session);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      if (session) {
        await logout(
          {
            refreshToken: session.refreshToken,
          },
          session.accessToken,
        );
      }
    } catch {
      toast.warning("Đã đăng xuất khỏi thiết bị này", {
        description: "Chưa xác nhận được phiên máy chủ. Vui lòng đăng nhập lại nếu cần.",
      });
    } finally {
      await clearAuthSessionEverywhere();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex items-center gap-3 pr-12 lg:pr-0",
          isCollapsed && "lg:justify-center lg:gap-0",
        )}
      >
        <div className={cn("min-w-0", isCollapsed && "lg:w-11 lg:overflow-hidden")}>
          <ClassHeroLogo className="h-12 max-w-[13rem]" priority />
        </div>
      </div>

      {onToggleCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "theme-button-neutral mt-4 hidden min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition lg:inline-flex",
            isCollapsed && "lg:px-0",
          )}
          aria-label={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
          <span className={cn(isCollapsed && "lg:hidden")}>
            {isCollapsed ? "Mở rộng" : "Thu gọn"}
          </span>
        </button>
      ) : null}

      <nav className="mb-4 mt-5 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (!item.href) {
                return;
              }

              if (item.active) {
                window.history.replaceState(window.history.state, "", item.href);
                window.dispatchEvent(new Event(resetFilterSearchParamsEvent));
                router.replace(item.href);
                return;
              }

              router.push(item.href);
            }}
            aria-current={item.active ? "page" : undefined}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "relative inline-flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-2xl border border-l-4 px-4 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]",
              isCollapsed && "lg:justify-center lg:border-l lg:px-0",
              item.active
                ? "border-sky-100 border-l-sky-300 bg-sky-50 text-sky-700 shadow-none dark:border-[var(--theme-primary-border)] dark:border-l-sky-400/70 dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]"
                : "border-transparent border-l-transparent text-[var(--theme-text-muted)] hover:border-sky-100 hover:border-l-sky-200/70 hover:bg-sky-50/70 hover:text-sky-700 dark:hover:border-[var(--theme-border)] dark:hover:border-l-[var(--theme-primary-border)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-[var(--theme-text-strong)]",
            )}
          >
            <item.icon
              className={cn(
                "h-6 w-6 shrink-0 transition",
                item.active ? "text-sky-600" : "text-inherit",
              )}
              aria-hidden="true"
            />
            <span className={cn("truncate", isCollapsed && "lg:hidden")}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {showAdminProfileTools && onToggleDarkTheme ? (
        <div
          className={cn(
            "mt-auto grid shrink-0 gap-1.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2",
            isCollapsed && "lg:place-items-center lg:p-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2.5",
              isCollapsed && "lg:justify-center lg:gap-0",
            )}
          >
            <div className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
              <p className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]">
                Nguyễn Admin
              </p>
              <p className="inline-flex min-w-0 items-center gap-1 text-xs font-bold leading-tight text-[var(--theme-success-text)]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Quản trị viên</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleDarkTheme}
            data-theme-toggle="true"
            className={cn(
              "theme-button-neutral inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm font-bold transition",
              isCollapsed && "lg:w-10 lg:px-0",
            )}
            aria-label={
              isDarkTheme ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
            }
          >
            {isDarkTheme ? (
              <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className={cn("min-w-0 truncate", isCollapsed && "lg:hidden")}>
              {isDarkTheme ? "Giao diện tối" : "Giao diện sáng"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={cn(
              "theme-button-danger-subtle inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70",
              isCollapsed && "lg:w-10 lg:px-0",
            )}
            aria-label="Đăng xuất khỏi tài khoản admin"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className={cn("min-w-0 truncate", isCollapsed && "lg:hidden")}>
              {isLoggingOut ? "Đang đăng xuất" : "Đăng xuất"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
