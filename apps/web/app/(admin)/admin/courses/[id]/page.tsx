import { AdminCourseDetailManager } from "@/features/admin/courses/screens/admin-course-detail-manager";
import { getServerAdminLearningPath } from "@/features/admin/courses/api/server-admin-course-data";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminCourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const enrollmentId =
    typeof resolvedSearchParams.enrollmentId === "string"
      ? resolvedSearchParams.enrollmentId
      : null;
  const [initialLearningPath, initialThemeMode] = await Promise.all([
    getServerAdminLearningPath(id),
    getServerThemeMode(),
  ]);

  return (
    <AdminCourseDetailManager
      pathId={id}
      enrollmentId={enrollmentId}
      initialLearningPath={initialLearningPath ?? undefined}
      initialThemeMode={initialThemeMode}
    />
  );
}
