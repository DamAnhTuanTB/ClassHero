import { ReviewStatus } from "@prisma/client";
import { QuizSetReviewActionDto } from "#api/modules/quiz/dto/review-quiz-set.dto";

export type AssessmentAdminKind = "QUIZ" | "TEST";

/**
 * One public Admin lifecycle vocabulary for both assessment kinds. Persistence
 * adapters decide how a saved/published state is stored; no controller or UI
 * is allowed to infer a different action from a Test-only field.
 */
export function resolveAssessmentReviewAction(input: {
  reviewStatus: ReviewStatus;
  action?: QuizSetReviewActionDto;
}) {
  return (
    input.action ??
    (input.reviewStatus === ReviewStatus.APPROVED
      ? QuizSetReviewActionDto.PUBLISH
      : input.reviewStatus === ReviewStatus.HIDDEN
        ? QuizSetReviewActionDto.WITHDRAW
        : QuizSetReviewActionDto.SAVE)
  );
}
