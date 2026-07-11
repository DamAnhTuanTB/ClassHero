import { getAdminLearningPathsSnapshot } from "@/features/admin-courses/api";
import { AdminCoursesManager } from "@/features/admin-courses";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminCoursesPage() {
  const initialThemeMode = await getServerThemeMode();

  return (
    <AdminCoursesManager
      initialLearningPaths={getAdminLearningPathsSnapshot()}
      initialThemeMode={initialThemeMode}
    />
  );
}
