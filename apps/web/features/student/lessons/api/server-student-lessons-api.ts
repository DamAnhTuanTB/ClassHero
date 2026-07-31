import "server-only";

import { getServerAuthSession } from "@/features/auth/session/server-auth-session";
import { getStudentLesson } from "@/features/student/lessons/api/student-lessons-api";

export async function getServerStudentLesson(lessonId: string) {
  const session = await getServerAuthSession();

  if (session?.currentUser.user.role !== "STUDENT") {
    return null;
  }

  try {
    return await getStudentLesson(lessonId, session.accessToken, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
