import { ExploreCoursesScreen } from "@/features/student/explore/screens/explore-courses-screen";
import { getServerStudentLearningPaths } from "@/features/student/shared/api/server-student-learning-paths-api";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentExploreCoursesPage() {
  const [initialData, initialThemeMode] = await Promise.all([
    getServerStudentLearningPaths(),
    getServerThemeMode(),
  ]);

  return (
    <ExploreCoursesScreen
      initialData={initialData}
      initialThemeMode={initialThemeMode}
    />
  );
}
