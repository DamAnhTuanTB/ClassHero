import { cookies } from "next/headers";
import {
  adminSidebarCollapsedStorageKey,
  studentSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";

export async function getServerSidebarCollapseState() {
  const cookieStore = await cookies();

  return {
    adminSidebarCollapsed:
      cookieStore.get(adminSidebarCollapsedStorageKey)?.value === "true",
    studentSidebarCollapsed:
      cookieStore.get(studentSidebarCollapsedStorageKey)?.value === "true",
  };
}
