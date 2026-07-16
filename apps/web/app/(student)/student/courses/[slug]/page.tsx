import { StudentCourseDetailScreen } from "@/features/student/courses/screens/student-course-detail-screen";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, initialThemeMode] = await Promise.all([params, getServerThemeMode()]);

  return <StudentCourseDetailScreen initialThemeMode={initialThemeMode} slug={slug} />;
}
