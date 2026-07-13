"use client";

import { GraduationCap, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { AdminCoursesSidebarContent } from "@/features/admin-courses/components/admin-courses-sidebar-content";
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

type MobileSidebarViewportStyle = CSSProperties & {
  "--admin-mobile-sidebar-height": string;
  "--admin-mobile-sidebar-top": string;
};

const DEFAULT_MOBILE_SIDEBAR_VIEWPORT_STYLE: MobileSidebarViewportStyle = {
  "--admin-mobile-sidebar-height": "100dvh",
  "--admin-mobile-sidebar-top": "0px",
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mobileViewportStyle, setMobileViewportStyle] =
    useState<MobileSidebarViewportStyle>(DEFAULT_MOBILE_SIDEBAR_VIEWPORT_STYLE);

  function openMobileSidebar() {
    setIsMobileOpen(true);
  }

  function closeMobileSidebar() {
    setIsMobileOpen(false);
  }

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileSidebar();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen) {
      setMobileViewportStyle(DEFAULT_MOBILE_SIDEBAR_VIEWPORT_STYLE);
      return;
    }

    const viewport = window.visualViewport;

    function syncMobileViewport() {
      setMobileViewportStyle({
        "--admin-mobile-sidebar-height": `${Math.round(
          window.visualViewport?.height ?? window.innerHeight,
        )}px`,
        "--admin-mobile-sidebar-top": `${Math.round(
          window.visualViewport?.offsetTop ?? 0,
        )}px`,
      });
    }

    syncMobileViewport();
    viewport?.addEventListener("resize", syncMobileViewport);
    viewport?.addEventListener("scroll", syncMobileViewport);
    window.addEventListener("resize", syncMobileViewport);
    window.addEventListener("orientationchange", syncMobileViewport);

    return () => {
      viewport?.removeEventListener("resize", syncMobileViewport);
      viewport?.removeEventListener("scroll", syncMobileViewport);
      window.removeEventListener("resize", syncMobileViewport);
      window.removeEventListener("orientationchange", syncMobileViewport);
    };
  }, [isMobileOpen]);

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 shadow-[var(--theme-shadow-sm)] lg:hidden",
        )}
      >
        <button
          type="button"
          onClick={openMobileSidebar}
          className="theme-button-neutral grid h-10 w-10 shrink-0 place-items-center rounded-lg transition"
          aria-label="Mở sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--theme-brand-secondary),var(--theme-brand-primary))] text-[var(--theme-brand-foreground)] shadow-[var(--theme-shadow-sm)]">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate leading-none tracking-normal">
              <span className="font-[var(--font-display)] text-lg font-extrabold text-[var(--theme-brand-primary)]">
                Class
              </span>
              <span className="font-[var(--font-display)] text-lg font-extrabold text-[var(--theme-brand-secondary)]">
                Hero
              </span>
            </p>
            <p className="truncate text-xs font-semibold text-[var(--theme-text-muted)]">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {isMobileOpen ? (
        <div
          className="fixed left-0 right-0 top-[var(--admin-mobile-sidebar-top)] z-50 h-[var(--admin-mobile-sidebar-height)] lg:hidden"
          style={mobileViewportStyle}
        >
          <div
            className="theme-dialog-overlay absolute inset-0 cursor-pointer backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeMobileSidebar}
          />
          <aside
            className={cn(
              "relative z-10 flex h-full w-[min(18rem,calc(100vw-2.5rem))] flex-col overflow-y-auto border-r border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[var(--theme-shadow-lg)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            <button
              type="button"
              onClick={closeMobileSidebar}
              className="theme-button-neutral absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-lg transition"
              aria-label="Đóng sidebar"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <AdminCoursesSidebarContent
              subtitle={subtitle}
              items={items}
              isDarkTheme={isDarkTheme}
              isCollapsed={false}
              showAdminProfileTools={showAdminProfileTools}
              onToggleDarkTheme={onToggleDarkTheme}
            />
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          "hidden flex-col overflow-y-auto border-r border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-6 transition-all duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:min-h-0 lg:self-start",
          isCollapsed ? "lg:px-3" : "lg:px-5",
        )}
      >
        <AdminCoursesSidebarContent
          subtitle={subtitle}
          items={items}
          isDarkTheme={isDarkTheme}
          isCollapsed={isCollapsed}
          showAdminProfileTools={showAdminProfileTools}
          onToggleCollapsed={onToggleCollapsed}
          onToggleDarkTheme={onToggleDarkTheme}
        />
      </aside>
    </>
  );
}
