"use client";

import {
  GraduationCap,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminCoursesSidebarItem = {
  label: string;
  icon: LucideIcon;
  active: boolean;
};

type AdminCoursesSidebarProps = {
  subtitle: string;
  items: AdminCoursesSidebarItem[];
  isDarkTheme?: boolean;
  isCollapsed?: boolean;
  showAdminProfileTools?: boolean;
  onToggleCollapsed?: () => void;
  onToggleDarkTheme?: () => void;
};

export function AdminCoursesSidebar({
  subtitle,
  items,
  isDarkTheme = false,
  isCollapsed = false,
  showAdminProfileTools = false,
  onToggleCollapsed,
  onToggleDarkTheme,
}: AdminCoursesSidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col border-b px-4 py-4 transition-colors lg:min-h-screen lg:border-b-0 lg:border-r lg:py-6",
        isDarkTheme ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white",
        isCollapsed ? "lg:px-3" : "lg:px-5",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          isCollapsed && "lg:justify-center lg:gap-0",
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-600 text-white">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className={cn(isCollapsed && "lg:hidden")}>
          <p
            className={cn(
              "text-sm font-extrabold",
              isDarkTheme ? "text-white" : "text-slate-950",
            )}
          >
            ClassHero Admin
          </p>
          <p
            className={cn(
              "text-xs font-semibold",
              isDarkTheme ? "text-slate-400" : "text-slate-500",
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {onToggleCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "mt-4 hidden min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition lg:inline-flex",
            isDarkTheme
              ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700",
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

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
              isCollapsed && "lg:justify-center lg:px-0",
              item.active
                ? isDarkTheme
                  ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20"
                  : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
                : isDarkTheme
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            <span className={cn(isCollapsed && "lg:hidden")}>{item.label}</span>
          </button>
        ))}
      </nav>

      {showAdminProfileTools && onToggleDarkTheme ? (
        <div
          className={cn(
            "mt-5 grid gap-3 rounded-lg border p-3 lg:mt-auto",
            isDarkTheme
              ? "border-slate-800 bg-slate-950/60"
              : "border-slate-200 bg-slate-50",
            isCollapsed && "lg:place-items-center lg:p-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              isCollapsed && "lg:justify-center lg:gap-0",
            )}
          >
            <div
              className={cn(
                "grid h-10 w-10 place-items-center rounded-lg border",
                isDarkTheme
                  ? "border-slate-700 bg-slate-800 text-sky-300"
                  : "border-sky-100 bg-white text-sky-700",
              )}
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
              <p
                className={cn(
                  "truncate text-sm font-extrabold",
                  isDarkTheme ? "text-white" : "text-slate-950",
                )}
              >
                Nguyễn Admin
              </p>
              <p
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 text-xs font-bold",
                  isDarkTheme ? "text-emerald-300" : "text-emerald-700",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Quản trị viên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleDarkTheme}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition",
              isDarkTheme
                ? "border-slate-700 bg-slate-800 text-amber-200 hover:bg-slate-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700",
              isCollapsed && "lg:w-10 lg:px-0",
            )}
            aria-label={
              isDarkTheme ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
            }
          >
            {isDarkTheme ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
            <span className={cn(isCollapsed && "lg:hidden")}>
              {isDarkTheme ? "Giao diện tối" : "Giao diện sáng"}
            </span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
