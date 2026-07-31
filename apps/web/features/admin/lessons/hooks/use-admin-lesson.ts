import { useQuery } from "@tanstack/react-query";
import { getAdminLesson } from "@/features/admin/courses/api/admin-lessons-api";
import type { AdminLesson } from "@/features/admin/courses/admin-courses-data";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export function useAdminLesson(
  lessonId: string,
  initialData?: AdminLesson | null,
) {
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);
  const accessToken = session?.accessToken ?? "";

  return useQuery({
    queryKey: ["admin-lesson", lessonId, session?.user.id ?? "guest"],
    queryFn: () => getAdminLesson(lessonId, accessToken),
    enabled: isHydrated && Boolean(accessToken) && Boolean(lessonId),
    initialData,
  });
}
