import { PurchasedCoursesScreen } from "@/features/student/courses/screens/purchased-courses-screen";
import { getServerAuthSession } from "@/features/auth/session/server-auth-session";
import { getServerStudentLearningPaths } from "@/features/student/shared/api/server-student-learning-paths-api";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentPurchasedCoursesPage() {
  const [initialData, initialThemeMode, serverAuthSession] = await Promise.all([
    getServerStudentLearningPaths(),
    getServerThemeMode(),
    getServerAuthSession(),
  ]);

  return (
    <PurchasedCoursesScreen
      initialData={initialData}
      initialStudentName={serverAuthSession?.currentUser.user.fullName}
      initialThemeMode={initialThemeMode}
    />
  );
}
