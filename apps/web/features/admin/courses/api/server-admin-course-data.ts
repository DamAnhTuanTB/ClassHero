import "server-only";

import {
  getAdminLearningPath,
  listAdminLearningPaths,
} from "@/features/admin/courses/api/admin-learning-paths-api";
import { getAdminLesson } from "@/features/admin/courses/api/admin-lessons-api";
import {
  getAdminQuizQuestions,
  getAdminQuizSets,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { getServerAuthSession } from "@/features/auth/session/server-auth-session";

export async function getServerAdminLearningPaths() {
  const session = await getAdminServerSession();
  if (!session) return null;

  try {
    return await listAdminLearningPaths(session.accessToken, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function getServerAdminLearningPath(pathId: string) {
  const session = await getAdminServerSession();
  if (!session) return null;

  try {
    return await getAdminLearningPath(pathId, session.accessToken, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function getServerAdminLesson(lessonId: string) {
  const session = await getAdminServerSession();
  if (!session) return null;

  try {
    return await getAdminLesson(lessonId, session.accessToken, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function getServerAdminQuizInitialData(lessonId: string) {
  const session = await getAdminServerSession();
  if (!session) return null;

  try {
    const sets = await getAdminQuizSets(lessonId, session.accessToken, {
      cache: "no-store",
    });
    const firstSet = sets[0];
    const questions = firstSet
      ? await getAdminQuizQuestions(firstSet.id, session.accessToken, {
          cache: "no-store",
        })
      : [];

    return {
      questions,
      questionSetId: firstSet?.id ?? null,
      sets,
    };
  } catch {
    return null;
  }
}

async function getAdminServerSession() {
  const session = await getServerAuthSession();
  return session?.currentUser.user.role === "ADMIN" ? session : null;
}
