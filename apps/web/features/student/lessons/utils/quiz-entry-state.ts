import type { QuizAttemptStatus } from "@/features/student/lessons/types/student-lesson-types";

export function getQuizEntryActionLabel(status: QuizAttemptStatus | null) {
  if (status?.state === "COMPLETED") return "Xem lại";
  if (status?.state === "IN_PROGRESS") return "Tiếp tục làm";
  return "Bắt đầu";
}
