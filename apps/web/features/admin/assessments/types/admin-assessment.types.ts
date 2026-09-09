import type {
  AdminQuizInitialData,
  AdminQuizQuestion,
  AdminQuizQuestionPayload,
  AdminQuizQuestionUpdatePayload,
  AdminQuizSet,
} from "@/features/admin/quiz/api/admin-quiz-api";

export type AdminAssessmentKind = "quiz" | "test";
export type AdminAssessmentInitialData = AdminQuizInitialData;
export type AdminAssessmentQuestionPayload = AdminQuizQuestionPayload;
export type AdminAssessmentQuestionUpdatePayload = AdminQuizQuestionUpdatePayload;

export interface AdminAssessmentSet extends AdminQuizSet {
  durationSeconds?: number;
}

export interface AdminAssessmentQuestion extends Omit<AdminQuizQuestion, "quizSetId"> {
  /** Normalized at the HTTP boundary; UI never needs quizSetId/testSetId. */
  setId: string;
}
