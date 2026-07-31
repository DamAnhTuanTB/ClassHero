import { AdminLessonDetailManager } from "@/features/admin/lessons/screens/admin-lesson-detail";
import {
  getServerAdminLesson,
  getServerAdminQuizInitialData,
} from "@/features/admin/courses/api/server-admin-course-data";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const [initialLesson, initialQuizData, initialThemeMode] = await Promise.all([
    getServerAdminLesson(lessonId),
    getServerAdminQuizInitialData(lessonId),
    getServerThemeMode(),
  ]);

  return (
    <AdminLessonDetailManager
      initialLesson={initialLesson ?? undefined}
      initialQuizData={initialQuizData ?? undefined}
      initialThemeMode={initialThemeMode}
      lessonId={lessonId}
    />
  );
}
