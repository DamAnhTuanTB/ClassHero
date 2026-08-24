import { resolveQuizCorrectAnswerDisplay } from "@/components/common/content/quiz-explanation-content-normalizer";
import type {
  AdminMultiStatementAnswer,
  AdminQuizOption,
  AdminQuizQuestion,
  QuizQuestionType,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { createMathTextTiptapDocument } from "@/lib/tiptap-rich-content";

const QUESTION_TYPES = new Set<QuizQuestionType>([
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "MULTI_STATEMENT_TRUE_FALSE",
  "TEXT_INPUT",
]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"] as const);

export function buildQuizQuestionPreviewFromGenerationJson(
  current: AdminQuizQuestion,
  generationQuestionJson: Record<string, unknown>,
): AdminQuizQuestion {
  const questionType =
    readQuestionType(generationQuestionJson.questionType) ?? current.questionType;
  const difficulty =
    readDifficulty(generationQuestionJson.difficulty) ?? current.difficulty;
  const explanation = asRecord(generationQuestionJson.explanation);
  const problem = readString(explanation?.problem) ?? "";
  const hint = readString(generationQuestionJson.hint);
  const mapped = mapQuestionSpecificFields(questionType, generationQuestionJson);
  const answer = buildPreviewAnswer(questionType, mapped);
  const solution = buildPreviewSolution(questionType, explanation);
  const explanationBlock = {
    type: "quizExplanation",
    problem,
    solution,
    answer,
    ...(typeof explanation?.isGeometry === "boolean"
      ? { isGeometry: explanation.isGeometry }
      : {}),
    ...(explanation && "geometryStatement" in explanation
      ? { geometryStatement: explanation.geometryStatement }
      : {}),
    origin: "AI_AUTHORED",
  };

  return {
    ...current,
    questionType,
    difficulty,
    questionJson: createMathTextTiptapDocument(problem),
    optionsJson: mapped.optionsJson,
    correctAnswerJson: mapped.correctAnswerJson,
    hintJson: hint ? createMathTextTiptapDocument(hint) : null,
    explanation: {
      id: current.explanation?.id ?? "generation-json-preview",
      contentJson: createMathTextTiptapDocument(
        [solution, answer ? `Đáp án: ${answer}` : ""].filter(Boolean).join("\n"),
      ),
      reviewStatus: current.explanation?.reviewStatus ?? "NEEDS_REVIEW",
      staleAt: null,
    },
    sourceMetadataJson: {
      ...(current.sourceMetadataJson ?? {}),
      quizExplanationBlock: explanationBlock,
    },
    generationQuestionJson,
  };
}

export function isProtectedQuizGenerationJsonEdit(input: {
  name?: string | null;
  namespace?: Array<string | null>;
}) {
  return input.name === "figure" || input.namespace?.[0] === "figure";
}

function mapQuestionSpecificFields(
  questionType: QuizQuestionType,
  value: Record<string, unknown>,
): Pick<AdminQuizQuestion, "optionsJson" | "correctAnswerJson"> {
  if (questionType === "MULTIPLE_CHOICE") {
    return {
      optionsJson: readOptions(value.options),
      correctAnswerJson: readString(value.correctOptionId)
        ? [readString(value.correctOptionId)!]
        : [],
    };
  }
  if (questionType === "TRUE_FALSE") {
    return {
      optionsJson: null,
      correctAnswerJson:
        typeof value.correctAnswer === "boolean" ? value.correctAnswer : false,
    };
  }
  if (questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    const statements = readStatements(value.statements);
    return {
      optionsJson: statements.options,
      correctAnswerJson: statements.answers,
    };
  }
  const answer = value.correctAnswer;
  return {
    optionsJson: null,
    correctAnswerJson: Array.isArray(answer)
      ? answer.filter((item): item is string => typeof item === "string")
      : typeof answer === "string"
        ? [answer]
        : [],
  };
}

function buildPreviewSolution(
  questionType: QuizQuestionType,
  explanation: Record<string, unknown> | null,
) {
  if (questionType !== "MULTI_STATEMENT_TRUE_FALSE") {
    return readString(explanation?.solution) ?? "";
  }
  return Array.isArray(explanation?.statementSolutions)
    ? explanation.statementSolutions
        .flatMap((item) => {
          const record = asRecord(item);
          const statementId = readString(record?.statementId);
          const solution = readString(record?.solution);
          return statementId && solution ? [`**${statementId})** ${solution}`] : [];
        })
        .join("\n\n")
    : "";
}

function buildPreviewAnswer(
  questionType: QuizQuestionType,
  mapped: Pick<AdminQuizQuestion, "optionsJson" | "correctAnswerJson">,
) {
  return (
    resolveQuizCorrectAnswerDisplay({
      correctAnswer: mapped.correctAnswerJson,
      optionIds: mapped.optionsJson?.map((option) => option.id),
      questionType,
    })?.content ?? ""
  );
}

function readOptions(value: unknown): AdminQuizOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const id = readString(record?.id);
    const text = readString(record?.text);
    return id && text ? [{ id, richText: createMathTextTiptapDocument(text) }] : [];
  });
}

function readStatements(value: unknown) {
  const options: AdminQuizOption[] = [];
  const answers: AdminMultiStatementAnswer[] = [];
  if (!Array.isArray(value)) return { options, answers };
  value.forEach((item) => {
    const record = asRecord(item);
    const id = readString(record?.id);
    const text = readString(record?.text);
    if (!id || !text || typeof record?.value !== "boolean") return;
    options.push({ id, richText: createMathTextTiptapDocument(text) });
    answers.push({ statementId: id, value: record.value });
  });
  return { options, answers };
}

function readQuestionType(value: unknown) {
  return typeof value === "string" && QUESTION_TYPES.has(value as QuizQuestionType)
    ? (value as QuizQuestionType)
    : null;
}

function readDifficulty(value: unknown) {
  return typeof value === "string" && DIFFICULTIES.has(value as "EASY")
    ? (value as "EASY" | "MEDIUM" | "HARD")
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
