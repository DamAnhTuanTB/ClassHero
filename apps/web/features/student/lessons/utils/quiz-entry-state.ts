import type { QuizAttemptStatus } from "@/features/student/lessons/types/student-lesson-types";

export function getQuizEntryActionLabel(status: QuizAttemptStatus | null) {
  if (status?.state === "COMPLETED") return "Xem lại";
  if (status?.state === "IN_PROGRESS" && status.checkedCount > 0) {
    return "Tiếp tục vào làm";
  }
  return "Bắt đầu";
}
