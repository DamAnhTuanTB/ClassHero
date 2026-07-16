import { PurchasedCoursesScreen } from "@/features/student/courses/screens/purchased-courses-screen";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentPurchasedCoursesPage() {
  const initialThemeMode = await getServerThemeMode();

  return <PurchasedCoursesScreen initialThemeMode={initialThemeMode} />;
}
