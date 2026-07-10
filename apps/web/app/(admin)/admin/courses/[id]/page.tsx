import { AdminCourseDetailManager } from "@/features/admin-courses";

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminCourseDetailManager pathId={id} />;
}
