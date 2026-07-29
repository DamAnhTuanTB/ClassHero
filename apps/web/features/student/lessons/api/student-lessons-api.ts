import { apiRequest } from "@/lib/api-client";
import type {
  AssessmentReview,
  CompletionResult,
  FlashcardProgressSummary,
  LeaderboardEntry,
  QuizAttempt,
  QuizAttemptStatus,
  QuizSubmitResult,
  ResumableQuizAttempt,
  StudentAnswer,
  StudentFlashcardSet,
  StudentLesson,
  StudentTestAttempt,
  StudentTestResult,
  StudentTestStatus,
} from "@/features/student/lessons/types/student-lesson-types";

export function getStudentLesson(lessonId: string, token?: string) {
  return apiRequest<StudentLesson>(`/student/lessons/${encodeURIComponent(lessonId)}`, {
    token,
  });
}

export function startQuizAttempt(
  quizSetId: string,
  token: string,
  input: { scope: "ALL" | "INCORRECT"; sourceAttemptId?: string },
) {
  return apiRequest<QuizAttempt>(
    `/student/quiz-sets/${encodeURIComponent(quizSetId)}/attempts`,
    { method: "POST", body: input, token },
  );
}

export function getCurrentQuizAttempt(quizSetId: string, token: string) {
  return apiRequest<ResumableQuizAttempt | null>(
    `/student/quiz-sets/${encodeURIComponent(quizSetId)}/attempts/current`,
    { token },
  );
}

export function getQuizAttemptStatus(quizSetId: string, token: string) {
  return apiRequest<QuizAttemptStatus>(
    `/student/quiz-sets/${encodeURIComponent(quizSetId)}/attempts/status`,
    { token },
  );
}

export function submitQuizAttempt(
  attemptId: string,
  answers: Array<{ questionId: string; answerJson: StudentAnswer }>,
  token: string,
) {
  return apiRequest<QuizSubmitResult>(
    `/student/quiz-attempts/${encodeURIComponent(attemptId)}/submit`,
    { method: "POST", body: { answers }, token },
  );
}

export function reviewQuizAttempt(
  attemptId: string,
  scope: "ALL" | "INCORRECT",
  token: string,
) {
  return apiRequest<AssessmentReview>(
    `/student/quiz-attempts/${encodeURIComponent(attemptId)}/review?scope=${scope}`,
    { token },
  );
}

export function getStudentFlashcards(lessonId: string, token?: string) {
  return apiRequest<StudentFlashcardSet[]>(
    `/student/lessons/${encodeURIComponent(lessonId)}/flashcard-sets`,
    { token },
  );
}

export function updateFlashcardProgress(
  flashcardId: string,
  isKnown: boolean,
  token: string,
) {
  return apiRequest<{
    flashcardId: string;
    isKnown: boolean;
    setProgress: FlashcardProgressSummary;
  }>(`/student/flashcards/${encodeURIComponent(flashcardId)}/progress`, {
    method: "PATCH",
    body: { isKnown },
    token,
  });
}

export function toggleFlashcardFavorite(
  lessonId: string,
  flashcardId: string,
  token: string,
) {
  return apiRequest<{ isFavorite: boolean }>("/student/favorites/toggle", {
    method: "POST",
    body: {
      lessonId,
      targetId: flashcardId,
      targetType: "FLASHCARD",
    },
    token,
  });
}

export function getStudentTestStatus(lessonId: string, token?: string) {
  return apiRequest<StudentTestStatus>(
    `/student/lessons/${encodeURIComponent(lessonId)}/test-sets/status`,
    { token },
  );
}

export function startStudentTest(lessonId: string, token: string) {
  return apiRequest<StudentTestAttempt>(
    `/student/lessons/${encodeURIComponent(lessonId)}/test-attempts/start`,
    { method: "POST", token },
  );
}

export function submitStudentTest(
  attemptId: string,
  answers: Array<{ questionId: string; answerJson: StudentAnswer }>,
  token: string,
) {
  return apiRequest<StudentTestResult>(
    `/student/test-attempts/${encodeURIComponent(attemptId)}/submit`,
    { method: "POST", body: { answers }, token },
  );
}

export function reviewStudentTest(
  attemptId: string,
  scope: "ALL" | "INCORRECT",
  token: string,
) {
  return apiRequest<AssessmentReview & StudentTestResult>(
    `/student/test-attempts/${encodeURIComponent(attemptId)}/review?scope=${scope}`,
    { token },
  );
}

export function useStudentTestResult(attemptId: string, token: string) {
  return apiRequest<CompletionResult>(
    `/student/test-attempts/${encodeURIComponent(attemptId)}/use-result`,
    { method: "POST", token },
  );
}

export function getLessonLeaderboard(lessonId: string, token: string) {
  return apiRequest<{ entries: LeaderboardEntry[] }>(
    `/student/lessons/${encodeURIComponent(lessonId)}/leaderboard/top-tests`,
    { token },
  );
}
