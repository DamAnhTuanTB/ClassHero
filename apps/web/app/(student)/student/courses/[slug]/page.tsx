import { StudentCourseDetailScreen } from "@/features/student/courses/screens/student-course-detail-screen";
import { getServerStudentLearningPathDetail } from "@/features/student/shared/api/server-student-learning-paths-api";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [initialData, initialThemeMode] = await Promise.all([
    getServerStudentLearningPathDetail(slug),
    getServerThemeMode(),
  ]);

  return (
    <StudentCourseDetailScreen
      initialData={initialData}
      initialThemeMode={initialThemeMode}
      slug={slug}
    />
  );
}
