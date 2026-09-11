import {
  hasMalformedMathText,
  normalizeLearnerMathTextSyntax,
  normalizeMathTextLatexEnvironments,
} from "@learning-path/shared";
import { Difficulty, QuestionType, ReviewStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapGeneratedQuestion } from "#api/modules/ai/utils/lesson-content-generation-mapper";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { lessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import {
  collectFlashcardMathSyntaxWarnings,
  normalizeFlashcardLearnerText,
} from "#api/modules/flashcards/utils/flashcard-generation-mapper";
import {
  collectVideoSummaryOutputWarnings,
  normalizeVideoSummaryTextLayout,
  videoSummaryProviderOutputSchema,
} from "#api/modules/learning-paths/utils/video-summary-output";
import { reconcileLessonSummaryReviewIssues } from "#api/modules/learning-paths/utils/lesson-summary-review";
import { serializeStudentLessonSummary } from "#api/modules/student-learning/serializers/student-lesson.serializers";
import {
  mapGeneratedQuizQuestion,
  normalizeQuizLearnerText,
} from "#api/modules/quiz/utils/quiz-generation-mapper";

const malformedDisplay = String.raw`$$\begin{aligned}x&=1\\&=2.$$`;
const repairedDisplay = String.raw`$$\begin{aligned}x&=1\\&=2.\end{aligned}$$`;

describe("shared learner math text auto-repair", () => {
  it("repairs display environments to a stable result without touching code or prose", () => {
    expect(normalizeMathTextLatexEnvironments(malformedDisplay)).toBe(repairedDisplay);
    expect(normalizeLearnerMathTextSyntax(repairedDisplay)).toBe(repairedDisplay);
    expect(hasMalformedMathText(normalizeLearnerMathTextSyntax(malformedDisplay))).toBe(
      false,
    );

    const bracketDisplay = String.raw`\[\begin{cases}x=1\]`;
    expect(normalizeMathTextLatexEnvironments(bracketDisplay)).toBe(
      String.raw`\[\begin{cases}x=1\end{cases}\]`,
    );
    const codeSpan = String.raw`Code: ` + "`" + malformedDisplay + "`";
    expect(normalizeMathTextLatexEnvironments(codeSpan)).toBe(codeSpan);
    expect(normalizeMathTextLatexEnvironments(String.raw`\begin{aligned}x&=1`)).toBe(
      String.raw`\begin{aligned}x&=1`,
    );

    const orphanDollar =
      "Khung rộng 6 dm. $ Người thợ muốn lắp một vòng tròn qua bốn góc.";
    expect(normalizeLearnerMathTextSyntax(orphanDollar)).toBe(
      "Khung rộng 6 dm.  Người thợ muốn lắp một vòng tròn qua bốn góc.",
    );
    expect(normalizeLearnerMathTextSyntax("Xét $ X + 1 là một biểu thức.")).toBe(
      "Xét $ X + 1 là một biểu thức.",
    );
  });

  it("applies the shared repair before Summary review warnings are reconciled", () => {
    const output = lessonSummaryProviderTransportOutputSchema.parse({
      title: "Phương trình",
      objectives: ["Giải phương trình"],
      theorySections: [
        {
          displayHeading: "Phương pháp",
          sourceEvidence: {
            kind: "HEADING",
            text: "Phương pháp",
            packetPageNumbers: [1],
          },
          items: [
            {
              itemType: "UNIT",
              theory: {
                type: "knowledge",
                title: "Biến đổi",
                content: malformedDisplay,
                sourcePageNumbers: [1],
                figures: [],
              },
              example: {
                type: "example",
                exampleKind: "ILLUSTRATION",
                problem: "Giải phương trình $x=1$.",
                solution: "Ta được $x=1$.",
                answer: "$x=1$.",
                origin: "SOURCE_ADAPTED",
                sourcePageNumbers: [1],
                isGeometry: false,
                geometryStatement: null,
                figures: [],
              },
            },
          ],
        },
      ],
      applicationExercises: {
        standardExercises: [],
        realWorldExercises: [],
      },
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId: "00000000-0000-4000-8000-000000000001",
      output,
      packetPageCount: 1,
      targetGrade: 9,
      subjectKey: "MATH",
    });
    expect(mapped.content.sections[0]?.blocks[0]).toMatchObject({
      type: "knowledge",
      content: repairedDisplay,
    });

    const reviewed = reconcileLessonSummaryReviewIssues({
      type: "lesson_summary_blocks",
      version: 4,
      data: mapped.content,
    });
    expect(JSON.stringify(reviewed)).not.toContain("MALFORMED_LATEX");
  });

  it("repairs malformed math in a legacy persisted Summary during reconciliation", () => {
    const reviewed = reconcileLessonSummaryReviewIssues({
      type: "lesson_summary_blocks",
      version: 4,
      data: {
        title: "Phương trình",
        objectives: ["Giải phương trình"],
        targetGrade: 9,
        sections: [
          {
            order: 1,
            displayHeading: "Phương pháp",
            blocks: [
              {
                type: "knowledge",
                title: "Biến đổi",
                content: malformedDisplay,
                sourcePageNumbers: [1],
                figures: [],
              },
            ],
          },
        ],
      },
    });

    expect(reviewed).toMatchObject({
      data: {
        sections: [
          {
            blocks: [{ content: repairedDisplay }],
          },
        ],
      },
    });
    expect(JSON.stringify(reviewed)).not.toContain("MALFORMED_LATEX");
  });

  it("returns the same repaired legacy Summary to the student surface", () => {
    const result = serializeStudentLessonSummary({
      id: "00000000-0000-4000-8000-000000000010",
      lessonId: "00000000-0000-4000-8000-000000000011",
      contentJson: {
        type: "lesson_summary_blocks",
        version: 4,
        data: {
          title: "Phương trình",
          objectives: ["Giải phương trình"],
          targetGrade: 9,
          sections: [
            {
              order: 1,
              displayHeading: "Phương pháp",
              blocks: [
                {
                  type: "knowledge",
                  title: "Biến đổi",
                  content: malformedDisplay,
                  sourcePageNumbers: [1],
                  figures: [],
                },
              ],
            },
          ],
        },
      },
      source: "AI",
      reviewStatus: ReviewStatus.APPROVED,
      updatedAt: new Date("2026-09-11T00:00:00.000Z"),
      deletedAt: null,
      stemFigures: [],
    } as never);

    expect(result?.contentJson).toMatchObject({
      data: {
        sections: [
          {
            blocks: [{ content: repairedDisplay }],
          },
        ],
      },
    });
  });

  it("applies the shared repair to Video Summary before warning collection", () => {
    expect(normalizeVideoSummaryTextLayout(malformedDisplay)).toBe(repairedDisplay);
    const output = videoSummaryProviderOutputSchema.parse({
      title: "Phương trình",
      objectives: ["Giải phương trình"],
      sections: [
        {
          order: 1,
          displayHeading: "Phương pháp",
          startSeconds: 0,
          blocks: [
            {
              type: "knowledge",
              title: "Biến đổi",
              startSeconds: 0,
              content: malformedDisplay,
            },
          ],
        },
      ],
    });
    expect(collectVideoSummaryOutputWarnings(output)).toEqual([]);
  });

  it("applies the shared repair to Quiz and removes its recoverable warning", () => {
    expect(normalizeQuizLearnerText(malformedDisplay)).toBe(repairedDisplay);
    const mapped = mapGeneratedQuizQuestion({
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Biến đổi từng bước.",
      explanation: {
        problem: "Phương trình có nghiệm $x=1$.",
        solution: malformedDisplay,
        isGeometry: false,
      },
      figure: { requiresQuestionFigure: false, solutionFigure: false },
      correctAnswer: true,
    });
    expect(mapped.explanationBlock.solution).toBe(repairedDisplay);
    expect(mapped.recoveryIssues).toEqual([]);
  });

  it("applies the shared repair to Flashcard and removes its recoverable warning", () => {
    expect(normalizeFlashcardLearnerText(malformedDisplay)).toBe(repairedDisplay);
    expect(
      collectFlashcardMathSyntaxWarnings({
        front: "Giải phương trình sau.",
        back: "$x=2$.",
        solution: malformedDisplay,
      }),
    ).toEqual([]);
  });

  it("applies the shared repair to Test and removes its recoverable warning", () => {
    const mapped = mapGeneratedQuestion({
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      example: {
        problem: "Phương trình có nghiệm $x=1$.",
        solution: malformedDisplay,
        answer: "Đúng.",
        geometryStatement: null,
      },
      sourceChunkIds: ["00000000-0000-4000-8000-000000000002"],
      correctAnswer: true,
    });
    expect(mapped.exampleBlock.solution).toBe(repairedDisplay);
    expect(mapped.recoveryIssues).toEqual([]);
  });
});
