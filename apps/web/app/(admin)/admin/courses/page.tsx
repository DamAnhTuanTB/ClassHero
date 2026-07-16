import { AdminCoursesManager } from "@/features/admin/courses/screens/admin-courses-manager";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminCoursesPage() {
  const initialThemeMode = await getServerThemeMode();

  return <AdminCoursesManager initialThemeMode={initialThemeMode} />;
}
