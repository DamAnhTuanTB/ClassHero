import { BookOpen, Bot, FileText, Layers3, Shapes } from "lucide-react";
import type { AdminCoursesSidebarItem } from "@/components/admin/courses/admin-courses-sidebar";

export type AdminNavigationKey =
  | "courses"
  | "domains"
  | "lessons"
  | "documents"
  | "ai-settings";

export function getAdminNavigationItems(
  activeItem: AdminNavigationKey,
): AdminCoursesSidebarItem[] {
  return [
    {
      label: "Khóa học",
      icon: Layers3,
      active: activeItem === "courses",
      href: "/admin/courses",
    },
    {
      label: "Lĩnh vực",
      icon: Shapes,
      active: activeItem === "domains",
      href: "/admin/domains",
    },
    {
      label: "Buổi học",
      icon: BookOpen,
      active: activeItem === "lessons",
    },
    {
      label: "Tài liệu",
      icon: FileText,
      active: activeItem === "documents",
    },
    {
      label: "Cài đặt AI",
      icon: Bot,
      active: activeItem === "ai-settings",
      href: "/admin/ai-settings",
    },
  ];
}
