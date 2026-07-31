import { AdminCoursesManager } from "@/features/admin/courses/screens/admin-courses-manager";
import { getServerAdminLearningPaths } from "@/features/admin/courses/api/server-admin-course-data";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminCoursesPage() {
  const [initialLearningPaths, initialThemeMode] = await Promise.all([
    getServerAdminLearningPaths(),
    getServerThemeMode(),
  ]);

  return (
    <AdminCoursesManager
      initialLearningPaths={initialLearningPaths ?? undefined}
      initialThemeMode={initialThemeMode}
    />
  );
}
