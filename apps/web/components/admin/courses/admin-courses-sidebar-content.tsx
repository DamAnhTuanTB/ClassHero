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
  clearAuthSession,
  useAuthSessionStore,
} from "@/features/auth/session/auth-session";
import type { AdminCoursesSidebarItem } from "@/components/admin/courses/admin-courses-sidebar";
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
  subtitle,
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
      clearAuthSession();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div
        className={cn(
          "flex items-center gap-3 pr-12 lg:pr-0",
          isCollapsed && "lg:justify-center lg:gap-0",
        )}
      >
        <div className={cn("min-w-0", isCollapsed && "lg:w-11 lg:overflow-hidden")}>
          <ClassHeroLogo className="h-8 max-w-none" priority />
          <p
            className={cn(
              "truncate text-xs font-semibold text-[var(--theme-text-muted)]",
              isCollapsed && "lg:hidden",
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {showAdminProfileTools && onToggleDarkTheme ? (
        <div
          className={cn(
            "mt-4 grid gap-1.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2 lg:order-last lg:mt-auto",
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

      <nav className="mt-5 grid gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
              isCollapsed && "lg:justify-center lg:px-0",
              item.active
                ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary-border)]"
                : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={cn("truncate", isCollapsed && "lg:hidden")}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
