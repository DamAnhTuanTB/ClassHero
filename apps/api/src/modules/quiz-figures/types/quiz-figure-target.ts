import { AiGenerationType } from "@prisma/client";

export const quizFigureTargetKinds = ["QUIZ", "TEST"] as const;

export type QuizFigureTarget =
  { kind: "QUIZ"; questionId: string } | { kind: "TEST"; questionId: string };

export function quizFigureTargetWhere(target: QuizFigureTarget) {
  return target.kind === "QUIZ"
    ? { quizQuestionId: target.questionId }
    : { testQuestionId: target.questionId };
}

export function quizFigureTargetCreateData(target: QuizFigureTarget) {
  return target.kind === "QUIZ"
    ? { quizQuestionId: target.questionId, testQuestionId: null }
    : { quizQuestionId: null, testQuestionId: target.questionId };
}

export function quizFigureTargetFeature(target: Pick<QuizFigureTarget, "kind">) {
  return target.kind === "QUIZ" ? AiGenerationType.QUIZ : AiGenerationType.TEST;
}

export function quizFigureTargetUsageKind(target: Pick<QuizFigureTarget, "kind">) {
  return target.kind === "QUIZ" ? ("QUIZ_QUESTION" as const) : ("TEST_QUESTION" as const);
}

export function quizFigureTargetLabel(target: Pick<QuizFigureTarget, "kind">) {
  return target.kind === "QUIZ" ? "Quiz" : "Test";
}
