import type { TiptapTextDocument } from "@/types/rich-text";

export type StudentLessonTab = "lesson" | "quiz" | "flashcard" | "test";
export type StudentLearningSurface =
  | {
      kind: "quiz-runner";
      attemptId: string;
      setId: string;
    }
  | {
      kind: "quiz-result";
      attemptId: string;
      setId: string;
    }
  | {
      kind: "flashcard-runner";
      setId: string;
    }
  | {
      kind: "flashcard-result";
      setId: string;
    }
  | {
      kind: "test-runner";
      attemptId: string;
      setId: string;
    }
  | {
      kind: "test-result";
      attemptId: string;
      setId: string;
    };
export type AssessmentQuestionType =
  "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_STATEMENT_TRUE_FALSE" | "TEXT_INPUT";
export type StudentAnswer =
  | string
  | boolean
  | string[]
  | Array<{ statementId: string; value: boolean }>
  | { __unanswered: true };

export type AssessmentOption = {
  id: string;
  richText: TiptapTextDocument;
};

export type QuizFigureAsset = {
  role: "QUESTION" | "SOLUTION";
  altText: string;
  caption: string | null;
  fileId: string;
  mimeType: string;
  url: string | null;
};

export type StudentAssessmentQuestion = {
  id: string;
  questionType: AssessmentQuestionType;
  questionJson: TiptapTextDocument;
  optionsJson: AssessmentOption[] | null;
  hintJson?: TiptapTextDocument | null;
  correctAnswerJson?: StudentAnswer;
  gradingConfigJson?: {
    caseSensitive?: boolean;
    exactMatch?: boolean;
    numericComparison?: boolean;
  } | null;
  explanationJson?: TiptapTextDocument | null;
  explanationBlock?: unknown | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  sortOrder: number;
  questionNumber?: number;
  hasExplanation?: boolean;
  solutionFigureMode?: "NONE" | "REUSE_QUESTION" | "EXTEND_QUESTION";
  questionFigure?: QuizFigureAsset | null;
  solutionFigure?: QuizFigureAsset | null;
};

export type StudentLesson = {
  id: string;
  title: string;
  shortDescription: string | null;
  videoUrl: string | null;
  customVideoSettings: unknown | null;
  completionMinScore: number;
  access: { mode: "ENROLLMENT" | "TRIAL" };
  chapter: {
    id: string;
    title: string;
    orderIndex: number;
  };
  learningPath: {
    id: string;
    slug: string;
    title: string;
  };
  summary: {
    id: string;
    contentJson: TiptapTextDocument;
    updatedAt: string;
  } | null;
  quizSets: Array<{
    id: string;
    title: string;
    questionCount: number;
  }>;
  flashcardSets: Array<{
    id: string;
    title: string;
    cardCount: number;
  }>;
  testSets: Array<{
    id: string;
    title: string;
    questionCount: number;
    durationSeconds: number;
  }>;
  navigation: {
    previous: LessonNavigationItem | null;
    next: LessonNavigationItem | null;
  };
};

export type LessonNavigationItem = {
  id: string;
  title: string;
  orderIndex: number;
  chapter: {
    id: string;
    title: string;
    orderIndex: number;
  };
};

export type QuizAttempt = {
  id: string;
  totalCount: number;
  currentQuestionIndex?: number;
  originalTotalCount?: number;
  scope?: "ALL" | "INCORRECT";
  sourceAttemptId?: string | null;
  quizSet: { id: string; title: string };
  questions: StudentAssessmentQuestion[];
};

export type StatementResult = {
  statementId: string;
  selectedValue: boolean | null;
  correctValue: boolean;
  isCorrect: boolean;
  pointsAwarded: number;
};

export type CheckedAnswer = {
  isCorrect: boolean;
  isSkipped?: boolean;
  correctAnswerJson: StudentAnswer;
  statementResults: StatementResult[] | null;
  explanationJson: TiptapTextDocument | null;
  explanationBlock: unknown | null;
};

export type ResumableQuizAttempt = QuizAttempt & {
  currentQuestionIndex: number;
  savedAnswers: Array<{
    questionId: string;
    answerJson: StudentAnswer;
  }>;
  checkedAnswers: Array<{
    questionId: string;
    answerJson: StudentAnswer;
    feedback: CheckedAnswer;
  }>;
};

export type AttemptSummary = {
  id: string;
  sourceAttemptId?: string | null;
  correctCount: number;
  wrongCount: number;
  totalCount: number;
  accuracyPercent?: number;
};

export type QuizSubmitResult = AttemptSummary & {
  aggregateResult: AttemptSummary;
};

export type QuizAttemptStatus = {
  state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  currentAttemptId: string | null;
  answeredCount: number;
  checkedCount: number;
  latestSubmittedAttempt: AttemptSummary | null;
};

export type QuizHistoryItem = AttemptSummary & {
  id: string;
  setId: string;
  displayName: string;
  state: "IN_PROGRESS" | "COMPLETED";
  startedAt: string;
  completedAt: string | null;
  answeredCount: number;
};

export type QuizHistory = {
  total: number;
  items: QuizHistoryItem[];
};

export type QuizProgressSnapshot = {
  attemptId: string;
  currentQuestionIndex: number;
  answeredCount: number;
  checkedCount: number;
};

export type AssessmentReview = AttemptSummary & {
  originalTotalCount?: number;
  scope: "ALL" | "INCORRECT";
  questions: Array<
    StudentAssessmentQuestion &
      CheckedAnswer & {
        answerJson: StudentAnswer;
        pointsAwarded?: number;
      }
  >;
};

export type StudentFlashcardSet = {
  id: string;
  lessonId: string;
  title: string;
  cardCount: number;
  flashcards: StudentFlashcard[];
  progress: FlashcardProgressSummary;
};

export type StudentFlashcard = {
  id: string;
  frontJson: TiptapTextDocument;
  backJson: TiptapTextDocument;
  explanation: { contentJson: TiptapTextDocument } | null;
  isFavorite: boolean;
  progress: {
    isKnown: boolean;
    lastReviewedAt: string;
    reviewCount: number;
  } | null;
};

export type FlashcardProgressSummary = {
  totalCount: number;
  reviewedCount: number;
  knownCount: number;
  unknownCount: number;
  unreviewedCount: number;
  isCompleted: boolean;
};

export type FlashcardStudySessionSummary = {
  id: string;
  setId?: string;
  flashcardSetId?: string;
  displayName?: string;
  state: "IN_PROGRESS" | "COMPLETED";
  startedAt?: string;
  completedAt: string | null;
  reviewedCount: number;
  knownCount: number;
  unknownCount: number;
  totalCount: number;
};

export type FlashcardStudySession = FlashcardStudySessionSummary & {
  flashcardSetId: string;
  items: Array<{
    flashcardId: string;
    isKnown: boolean | null;
    reviewedAt: string | null;
  }>;
};

export type FlashcardHistoryItem = FlashcardStudySessionSummary & {
  setId: string;
  displayName: string;
  startedAt: string;
};

export type FlashcardHistory = {
  total: number;
  items: FlashcardHistoryItem[];
};

export type StudentTestStatus = {
  canStart: boolean;
  examOpenAt: string | null;
  evaluatedAt: string;
  lockReason:
    "TRIAL_NOT_ALLOWED" | "BEFORE_OPEN_TIME" | "PREREQUISITES_INCOMPLETE" | null;
  quiz: { isRequired: boolean; isCompleted: boolean };
  flashcard: { isRequired: boolean; isCompleted: boolean };
  bestAttempt: {
    id: string;
    score: number;
    durationSeconds: number;
  } | null;
  latestSubmittedAttempt: {
    id: string;
    score: number | null;
    durationSeconds: number | null;
    submittedAt: string | null;
  } | null;
  sets: Array<{
    id: string;
    title: string;
    durationSeconds: number;
    totalScore: number;
    questionCount: number;
  }>;
};

export type StudentTestHistoryItem = {
  id: string;
  attemptId: string | null;
  setId: string;
  displayName: string;
  state: "NOT_STARTED" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  score: number | null;
  correctCount: number;
  totalCount: number;
};

export type StudentTestHistory = {
  total: number;
  currentItemId: string | null;
  items: StudentTestHistoryItem[];
};

export type StudentTestAttempt = {
  id: string;
  startedAt: string;
  totalCount: number;
  testSet: {
    id: string;
    title: string;
    durationSeconds: number;
    totalScore: number;
  };
  questions: StudentAssessmentQuestion[];
};

export type StudentTestResult = AttemptSummary & {
  durationSeconds: number;
  score: number;
  completionMinScore: number;
  passed: boolean;
};

export type LeaderboardEntry = {
  rank: number;
  attemptId: string;
  studentName: string;
  score: number;
  durationSeconds: number;
  isCurrentStudent: boolean;
};
