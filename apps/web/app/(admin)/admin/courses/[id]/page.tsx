import { AdminCourseDetailManager } from "@/features/admin-courses/screens/admin-course-detail-manager";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialThemeMode = await getServerThemeMode();

  return <AdminCourseDetailManager pathId={id} initialThemeMode={initialThemeMode} />;
}
