"use client";

import {
  BookOpen,
  Compass,
  Home,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { logout } from "@/features/auth/api/auth-api";
import {
  clearAuthSession,
  useAuthSessionStore,
} from "@/features/auth/session/auth-session";
import { studentProfile } from "@/features/student/shared/student-courses-data";
import type { StudentCourseNavItem } from "@/features/student/shared/student-courses-types";
import {
  studentSidebarCollapsedDatasetKey,
  studentSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore, type AppThemeMode } from "@/lib/theme-store";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import { cn } from "@/lib/utils";

const navItems: StudentCourseNavItem[] = [
  {
    description: "Tổng quan học tập.",
    href: "/student/dashboard",
    icon: Home,
    label: "Trang chủ",
  },
  {
    description: "Khám phá tất cả khóa học đang mở.",
    href: "/student/explore",
    icon: Compass,
    label: "Khám phá",
  },
  {
    description: "Tiếp tục học các khóa học đã mua.",
    href: "/student/courses",
    icon: BookOpen,
    label: "Học tập",
  },
  {
    description: "Tin tức, sự kiện và lịch livestream.",
    href: "/student/news",
    icon: Newspaper,
    label: "Sự kiện",
  },
  {
    description: "Thông tin cá nhân.",
    href: "/student/profile",
    icon: UserRound,
    label: "Trang cá nhân",
  },
  {
    description: "Các tính năng khác.",
    href: "/student/more",
    icon: Menu,
    label: "Menu",
  },
];

const mobileNavIconStrokeWidth = 1.75;

export function StudentShell({
  children,
  initialThemeMode = "light",
}: {
  children: ReactNode;
  initialThemeMode?: AppThemeMode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const storeIsDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDarkTheme = isThemeHydrated ? storeIsDarkTheme : initialThemeMode === "dark";
  const session = useAuthSessionStore((state) => state.session);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    studentSidebarCollapsedStorageKey,
    false,
    studentSidebarCollapsedDatasetKey,
  );
  const studentFullName =
    session?.user.role === "STUDENT" ? session.user.fullName?.trim() : "";
  const studentDisplayName = studentFullName || studentProfile.name;

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
    <div
      data-student-shell="true"
      className="min-h-screen overflow-x-hidden bg-[var(--theme-bg)] text-[var(--theme-text)] transition-[padding] duration-300 ease-out lg:pl-[17rem]"
    >
      <input
        id="student-sidebar-collapsed"
        type="checkbox"
        checked={isSidebarCollapsed}
        onChange={(event) => setIsSidebarCollapsed(event.target.checked)}
        className="student-sidebar-toggle sr-only"
      />
      <aside className="student-desktop-sidebar fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col overflow-hidden border-r border-sky-100 bg-[color-mix(in_srgb,var(--theme-surface)_96%,transparent)] px-4 py-5 shadow-none transition-[width,padding] duration-300 ease-out lg:flex dark:border-[var(--theme-border)]">
        <div className="flex min-h-12 items-center">
          <label
            htmlFor="student-sidebar-collapsed"
            className="student-sidebar-collapse-control flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-sky-200/80 bg-white px-3 text-sm font-extrabold text-sky-700 transition hover:bg-sky-50 focus-within:outline-none focus-within:ring-4 focus-within:ring-blue-100 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-primary)]"
          >
            <PanelLeftClose
              className="student-sidebar-open-only h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <PanelLeftOpen
              className="student-sidebar-collapsed-only h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <span className="student-sidebar-open-only">Thu gọn</span>
            <span className="student-sidebar-collapsed-only">Mở rộng</span>
          </label>
        </div>

        <nav
          className="student-sidebar-nav mt-5 grid min-h-0 flex-1 content-start gap-1.5 overflow-x-hidden overflow-y-auto pb-4 pr-1"
          aria-label="Điều hướng học tập học sinh"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isStudentNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                className={cn(
                  "student-sidebar-nav-item group relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-2xl border border-l-4 px-4 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]",
                  isActive
                    ? "border-sky-100 border-l-sky-300 bg-sky-50 text-sky-700 shadow-none dark:border-[var(--theme-primary-border)] dark:border-l-sky-400/70 dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]"
                    : "border-transparent border-l-transparent text-[var(--theme-text-muted)] hover:border-sky-100 hover:border-l-sky-200/70 hover:bg-sky-50/70 hover:text-sky-700 dark:hover:border-[var(--theme-border)] dark:hover:border-l-[var(--theme-primary-border)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-[var(--theme-text-strong)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 shrink-0 transition",
                    isActive ? "text-sky-600" : "text-inherit",
                  )}
                  aria-hidden="true"
                />
                <span className="student-sidebar-label min-w-0">
                  <span className="block truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="student-sidebar-profile-card sticky bottom-0 mt-4 grid gap-2 rounded-2xl border border-[#bae6fd] bg-white p-2 shadow-none dark:border-sky-400/35 dark:bg-[var(--theme-surface-soft)]">
          <div className="student-sidebar-profile flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sky-200 bg-white text-sky-700 shadow-[0_8px_18px_-16px_rgb(2_132_199_/_52%)] dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="student-sidebar-profile-text min-w-0">
              <p className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]">
                {studentDisplayName}
              </p>
              <p
                className="inline-flex min-w-0 items-center text-[13px] font-semibold leading-tight"
                style={{ color: "var(--student-profile-role-color, #0369a1)" }}
              >
                <span className="truncate">Học sinh lớp {studentProfile.grade}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            data-theme-toggle="true"
            className="student-sidebar-tool-button student-sidebar-theme-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200"
            aria-label={
              isDarkTheme ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
            }
          >
            {isDarkTheme ? (
              <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="student-sidebar-profile-text min-w-0 truncate">
              {isDarkTheme ? "Giao diện tối" : "Giao diện sáng"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="student-sidebar-tool-button student-sidebar-logout-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-wait disabled:opacity-70"
            aria-label="Đăng xuất khỏi tài khoản học sinh"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="student-sidebar-profile-text min-w-0 truncate">
              {isLoggingOut ? "Đang đăng xuất" : "Đăng xuất"}
            </span>
          </button>
        </div>
      </aside>

      <div
        data-student-content="true"
        className="min-w-0 overflow-x-hidden pb-[4.75rem] lg:pb-0"
      >
        {children}
      </div>

      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-6 overflow-hidden border-t border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-surface)_96%,transparent)] px-0 pb-0.5 pt-0 shadow-[0_-10px_28px_rgb(15_23_42_/_8%)] backdrop-blur lg:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isStudentNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              className={cn(
                "relative flex h-full min-w-0 flex-col items-center justify-center gap-0 rounded-none px-0 pb-0.5 pt-0.5 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]",
                isActive
                  ? "text-[var(--theme-primary)]"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
              )}
            >
              <span
                className={cn(
                  "absolute left-[15%] right-[15%] top-[-1px] h-1 rounded-b-md transition",
                  isActive ? "bg-[var(--theme-primary)]" : "bg-transparent",
                )}
                aria-hidden="true"
              />
              <Icon
                className="h-7 w-7 shrink-0"
                strokeWidth={mobileNavIconStrokeWidth}
                aria-hidden="true"
              />
              <span className="block max-w-full whitespace-nowrap text-[9.5px] font-semibold leading-[10px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isStudentNavItemActive(pathname: string, href: string) {
  if (href === "/student/courses") {
    return pathname === href || pathname.startsWith("/student/courses/");
  }

  return pathname === href;
}
