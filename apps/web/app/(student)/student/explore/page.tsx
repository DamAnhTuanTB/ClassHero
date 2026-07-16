import { ExploreCoursesScreen } from "@/features/student/explore/screens/explore-courses-screen";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentExploreCoursesPage() {
  const initialThemeMode = await getServerThemeMode();

  return <ExploreCoursesScreen initialThemeMode={initialThemeMode} />;
}
