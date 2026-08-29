import { describe, expect, it } from "vitest";

import { autoRepairTikzNarrativeCallouts } from "#api/common/ai/tikz-narrative-callout-auto-repair";
import { autoRepairQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import { buildQuizFigureSystemPrompt } from "#api/modules/quiz-figures/utils/prompts/quiz-figure-system-prompt-resolver";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { autoRepairStemFigureLatexSource } from "#api/modules/stem-figures/utils/tex-source-policy";
import { buildStemFigureSystemPrompt } from "#api/modules/stem-figures/utils/prompts/stem-figure-system-prompt-resolver";

const reportedRectangleSource = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (0,8);
  \coordinate (C) at (15,8);
  \coordinate (D) at (15,0);
  \coordinate (O) at (7.5,4);
  \draw (A)--(B)--(C)--(D)--cycle;
  \draw (A)--(C) node[pos=0.28, sloped, above, font=\small] {$\mathrm{17\,cm}$};
  \draw (B)--(D);
  \fill (O) circle (2pt);
  \node[below left] at (A) {$A$};
  \node[above left] at (B) {$B$};
  \node[above right] at (C) {$C$};
  \node[below right] at (D) {$D$};
  \node[right=3pt] at (O) {$O$};
  \node[above=8pt] at (7.5,8) {Chu vi: $\mathrm{46\,cm}$};
\end{tikzpicture}`;

const subjects = [
  { id: "math", key: "MATH", name: "Toán", slug: "toan" },
  { id: "physics", key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
  { id: "chemistry", key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
  { id: "general", key: "GENERAL", name: "Môn khác", slug: "mon-khac" },
] as const;

describe("TikZ narrative-callout auto-repair", () => {
  it("removes the reported perimeter callout and preserves owned measurements", () => {
    const result = autoRepairTikzNarrativeCallouts(reportedRectangleSource);

    expect(result.changes).toEqual([
      {
        kind: "NARRATIVE_CALLOUT_REMOVED",
        nodeKind: "standalone",
        text: "Chu vi: 46 cm",
      },
    ]);
    expect(result.source).not.toContain("Chu vi");
    expect(result.source).toContain(String.raw`{$\mathrm{17\,cm}$}`);
    expect(result.source).toContain(String.raw`at (O) {$O$}`);
    expect(autoRepairTikzNarrativeCallouts(result.source)).toEqual({
      source: result.source,
      changes: [],
    });
  });

  it("removes a narrative path node without deleting its owning path", () => {
    const source = String.raw`\begin{tikzpicture}
      \draw (0,0)--(3,0) node[midway,above] {Kết luận: đoạn thẳng dài nhất.};
    \end{tikzpicture}`;
    const result = autoRepairTikzNarrativeCallouts(source);

    expect(result.changes).toEqual([
      expect.objectContaining({ nodeKind: "path-attached" }),
    ]);
    expect(result.source).toContain(String.raw`\draw (0,0)--(3,0) ;`);
    expect(result.source).not.toContain("Kết luận");
  });

  it("preserves short semantic labels, formulas, categories and measurements", () => {
    const source = String.raw`\begin{tikzpicture}
      \draw (0,0)--(3,0) node[midway,above] {$\mathrm{17\,cm}$};
      \node at (0,0) {$A$};
      \node at (0,1) {$f\colon A\to B$};
      \node at (0,2) {dung dịch HCl};
      \node at (0,3) {Nhóm A};
      \node at (0,4) {$x\,(\mathrm{cm})$};
    \end{tikzpicture}`;

    expect(autoRepairTikzNarrativeCallouts(source)).toEqual({
      source,
      changes: [],
    });
  });

  it("ignores narrative-looking text inside comments", () => {
    const source = String.raw`\begin{tikzpicture}
      % \node at (0,0) {Chu vi: 46 cm};
      \node at (0,0) {$A$};
    \end{tikzpicture}`;

    expect(autoRepairTikzNarrativeCallouts(source)).toEqual({
      source,
      changes: [],
    });
  });

  it("applies to every Quiz subject and every Summary source mode", () => {
    for (const subject of subjects) {
      const quiz = autoRepairQuizFigureLatexSource({
        source: reportedRectangleSource,
        subjectKey: subject.key,
        authorityText: "",
      });
      expect(quiz.source).not.toContain("Chu vi");

      for (const mode of [
        "REGENERATE_FROM_SOURCE",
        "EDIT_CURRENT_SOURCE",
        "GENERATE_FROM_BLOCK",
        "REPAIR",
      ] as const) {
        const summary = autoRepairStemFigureLatexSource({
          source: reportedRectangleSource,
          subjectKey: subject.key,
          mode,
          authorityText: "",
        });
        expect(summary.source).not.toContain("Chu vi");
      }
    }
  });
});

describe("narrative-callout prompt contract", () => {
  it("is present in every Quiz and Summary subject-owned prompt", () => {
    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      for (const mode of ["QUESTION", "SOLUTION"] as const) {
        expect(buildQuizFigureSystemPrompt(snapshot, mode)).toContain(
          "Cấm mọi text node dạng tiêu đề, câu dẫn, câu giải thích, kết luận hoặc callout",
        );
      }
      for (const mode of [
        "REGENERATE_FROM_SOURCE",
        "EDIT_CURRENT_SOURCE",
        "GENERATE_FROM_BLOCK",
        "REPAIR",
      ] as const) {
        expect(buildStemFigureSystemPrompt(subject, mode)).toContain(
          "Cấm mọi text node dạng tiêu đề, câu dẫn, câu giải thích, kết luận hoặc callout",
        );
      }
    }
  });
});
