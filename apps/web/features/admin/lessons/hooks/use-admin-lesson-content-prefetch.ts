"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  getAdminFlashcardsQueryOptions,
  getAdminFlashcardSetsQueryOptions,
} from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import {
  getAdminQuizQuestionsQueryOptions,
  getAdminQuizSetsQueryOptions,
} from "@/features/admin/quiz/hooks/use-admin-quiz";
import {
  getAdminAssessmentQuestionsQueryOptions,
  getAdminAssessmentSetsQueryOptions,
} from "@/features/admin/assessments/hooks/use-admin-assessment";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export function useAdminLessonContentPrefetch(lessonId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);
  const accessToken = session?.accessToken ?? "";
  const userId = session?.user.id;

  useEffect(() => {
    if (!enabled || !accessToken || !lessonId) {
      return;
    }

    const cancelIdleTask = scheduleIdleTask(() => {
      const prefetchQuiz = async () => {
        const sets = await queryClient.ensureQueryData(
          getAdminQuizSetsQueryOptions({ accessToken, lessonId, userId }),
        );
        const firstSetId = sets[0]?.id;
        if (firstSetId) {
          await queryClient.prefetchQuery(
            getAdminQuizQuestionsQueryOptions({
              accessToken,
              setId: firstSetId,
              userId,
            }),
          );
        }
      };

      const prefetchFlashcards = async () => {
        const sets = await queryClient.ensureQueryData(
          getAdminFlashcardSetsQueryOptions({ accessToken, lessonId, userId }),
        );
        const firstSetId = sets[0]?.id;
        if (firstSetId) {
          await queryClient.prefetchQuery(
            getAdminFlashcardsQueryOptions({
              accessToken,
              setId: firstSetId,
              userId,
            }),
          );
        }
      };

      const prefetchTests = async () => {
        const sets = await queryClient.ensureQueryData(
          getAdminAssessmentSetsQueryOptions({
            accessToken,
            kind: "test",
            lessonId,
            userId,
          }),
        );
        const firstSetId = sets[0]?.id;
        if (firstSetId) {
          await queryClient.prefetchQuery(
            getAdminAssessmentQuestionsQueryOptions({
              accessToken,
              kind: "test",
              setId: firstSetId,
              userId,
            }),
          );
        }
      };

      void Promise.all([prefetchQuiz(), prefetchFlashcards(), prefetchTests()]).catch(
        () => {
          // Prefetch chỉ tối ưu cảm giác chuyển tab; mỗi tab vẫn giữ error/retry riêng.
        },
      );
    });

    return cancelIdleTask;
  }, [accessToken, enabled, lessonId, queryClient, userId]);
}

function scheduleIdleTask(task: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const idleCallbackId = window.requestIdleCallback(task, { timeout: 1_000 });
    return () => window.cancelIdleCallback(idleCallbackId);
  }

  const timeoutId = globalThis.setTimeout(task, 250);
  return () => globalThis.clearTimeout(timeoutId);
}
