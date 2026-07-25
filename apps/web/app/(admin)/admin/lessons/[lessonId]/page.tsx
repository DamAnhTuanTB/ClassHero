import { AdminLessonDetailManager } from "@/features/admin/lessons/screens/admin-lesson-detail";

export default async function AdminLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  return <AdminLessonDetailManager lessonId={lessonId} />;
}
