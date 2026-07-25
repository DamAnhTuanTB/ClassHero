import { useQuery } from "@tanstack/react-query";
import { getAdminLesson } from "@/features/admin/courses/api/admin-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export function useAdminLesson(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    queryKey: ["admin-lesson", lessonId],
    queryFn: async () => {
      // if (!session?.accessToken) throw new Error("No token");
      return getAdminLesson(lessonId, session?.accessToken || "fake-token");
    },
    enabled: !!lessonId,
  });
}
