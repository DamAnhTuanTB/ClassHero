import "server-only";

import { getServerAuthSession } from "@/features/auth/session/server-auth-session";
import {
  getStudentLearningPathDetail,
  listStudentLearningPaths,
} from "@/features/student/shared/api/student-learning-paths-api";

export async function getServerStudentLearningPaths() {
  const session = await getServerAuthSession();

  if (session?.currentUser.user.role !== "STUDENT") {
    return null;
  }

  try {
    return await listStudentLearningPaths(session.accessToken, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function getServerStudentLearningPathDetail(slug: string) {
  const session = await getServerAuthSession();

  if (session?.currentUser.user.role !== "STUDENT") {
    return null;
  }

  try {
    return await getStudentLearningPathDetail(slug, session.accessToken, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
