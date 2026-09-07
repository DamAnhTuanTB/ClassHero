import { normalizeLessonSummaryAngleNotation } from "@learning-path/shared";
import type { AdminQuizQuestion } from "@/features/admin/quiz/api/admin-quiz-api";
import {
  createEmptyTiptapDocument,
  createMathMarkdownTiptapDocument,
  normalizeLessonSummaryAnglesInTiptapDocument,
} from "@/lib/tiptap-rich-content";

type QuizExplanationEditorSource = Pick<
  AdminQuizQuestion,
  "explanation" | "sourceMetadataJson"
>;

export function resolveQuizExplanationEditorContent(
  question: QuizExplanationEditorSource,
) {
  const explanationBlock = question.sourceMetadataJson?.quizExplanationBlock;
  if (
    explanationBlock &&
    typeof explanationBlock === "object" &&
    !Array.isArray(explanationBlock) &&
    "type" in explanationBlock &&
    explanationBlock.type === "quizExplanation" &&
    "solution" in explanationBlock &&
    typeof explanationBlock.solution === "string"
  ) {
    return createMathMarkdownTiptapDocument(
      normalizeLessonSummaryAngleNotation(explanationBlock.solution),
    );
  }

  return question.explanation?.contentJson
    ? normalizeLessonSummaryAnglesInTiptapDocument(question.explanation.contentJson)
    : createEmptyTiptapDocument();
}
