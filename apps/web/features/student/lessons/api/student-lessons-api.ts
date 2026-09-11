import { apiRequest } from "@/lib/api-client";
import type { ApiRequestOptions } from "@/lib/api-client";
import type {
  AssessmentReview,
  FlashcardProgressSummary,
  FlashcardHistory,
  FlashcardStudySession,
  FlashcardStudySessionSummary,
  LeaderboardEntry,
  QuizAttempt,
  QuizAttemptStatus,
  QuizHistory,
  QuizProgressSnapshot,
  QuizSubmitResult,
  ResumableQuizAttempt,
  StudentAnswer,
  StudentFlashcardSet,
  StudentLesson,
  StudentTestAttempt,
  StudentTestHistory,
  StudentTestResult,
  StudentTestStatus,
  StudentVideoProgress,
} from "@/features/student/lessons/types/student-lesson-types";

export function getStudentLesson(
  lessonId: string,
  token?: string,
  options: Pick<ApiRequestOptions, "cache"> = {},
) {
  return apiRequest<StudentLesson>(`/student/lessons/${encodeURIComponent(lessonId)}`, {
    cache: options.cache,
    token,
  });
}

export function getStudentVideoProgress(lessonId: string, token: string) {
  return apiRequest<StudentVideoProgress>(
    `/student/lessons/${encodeURIComponent(lessonId)}/video-progress`,
    { token },
  );
}

export function saveStudentVideoProgress(
  lessonId: string,
  positionSeconds: number,
  token: string,
  options?: { keepalive?: boolean },
) {
  return apiRequest<StudentVideoProgress>(
    `/student/lessons/${encodeURIComponent(lessonId)}/video-progress`,
    {
      method: "PATCH",
      body: { positionSeconds },
      keepalive: options?.keepalive,
      token,
    },
  );
}

export function startQuizAttempt(
  quizSetId: string,
  token: string,
  input: {
    scope: "ALL" | "INCORRECT";
    sourceAttemptId?: string;
    restartAttemptId?: string;
  },
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

export function getQuizHistory(lessonId: string, token: string) {
  return apiRequest<QuizHistory>(
    `/student/lessons/${encodeURIComponent(lessonId)}/quiz-history`,
    { token },
  );
}

export function saveQuizProgress(
  attemptId: string,
  input: {
    currentQuestionIndex: number;
    answer?: {
      questionId: string;
      answerJson: StudentAnswer;
      isChecked?: boolean;
    };
  },
  token: string,
  options?: { keepalive?: boolean },
) {
  return apiRequest<QuizProgressSnapshot>(
    `/student/quiz-attempts/${encodeURIComponent(attemptId)}/progress`,
    {
      method: "PATCH",
      body: input,
      token,
      keepalive: options?.keepalive,
    },
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

export function getFlashcardHistory(lessonId: string, token: string) {
  return apiRequest<FlashcardHistory>(
    `/student/lessons/${encodeURIComponent(lessonId)}/flashcard-history`,
    { token },
  );
}

export function getFlashcardStudySession(sessionId: string, token: string) {
  return apiRequest<FlashcardStudySession>(
    `/student/flashcard-sessions/${encodeURIComponent(sessionId)}`,
    { token },
  );
}

export function startFlashcardStudySession(
  setId: string,
  token: string,
  resumeExistingProgress = false,
  restartSessionId?: string,
) {
  return apiRequest<FlashcardStudySession>(
    `/student/flashcard-sets/${encodeURIComponent(setId)}/sessions`,
    {
      method: "POST",
      body: { resumeExistingProgress, restartSessionId },
      token,
    },
  );
}

export function updateFlashcardProgress(
  flashcardId: string,
  isKnown: boolean,
  token: string,
  sessionId?: string,
) {
  return apiRequest<{
    flashcardId: string;
    isKnown: boolean;
    setProgress: FlashcardProgressSummary;
    studySession: FlashcardStudySessionSummary | null;
  }>(`/student/flashcards/${encodeURIComponent(flashcardId)}/progress`, {
    method: "PATCH",
    body: { isKnown, sessionId },
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

export function getTestHistory(lessonId: string, token: string) {
  return apiRequest<StudentTestHistory>(
    `/student/lessons/${encodeURIComponent(lessonId)}/test-history`,
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

export function getLessonLeaderboard(lessonId: string, token: string) {
  return apiRequest<{ entries: LeaderboardEntry[] }>(
    `/student/lessons/${encodeURIComponent(lessonId)}/leaderboard/top-tests`,
    { token },
  );
}
