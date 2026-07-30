import type { AssessmentQuestionType } from "@/features/student/lessons/types/student-lesson-types";

export function getAssessmentQuestionInstruction(questionType: AssessmentQuestionType) {
  if (questionType === "MULTIPLE_CHOICE") return "Chọn đáp án đúng";
  if (questionType === "TRUE_FALSE") return "Chọn Đúng hoặc Sai";
  if (questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    return "Đánh giá từng nhận định";
  }
  return "Nhập câu trả lời";
}
