import { describe, expect, it } from "vitest";

import {
  autoRepairDistinctNumericAngleMarkerGroups,
  autoRepairDistinctNumericManualAngleArcs,
  autoRepairReversedInteriorAnglePics,
} from "#api/common/ai/tikz-angle-auto-repair";
import { autoRepairQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import { autoRepairStemFigureLatexSource } from "#api/modules/stem-figures/utils/tex-source-policy";

const counterclockwiseCyclicQuadrilateral = String.raw`\begin{tikzpicture}
  \coordinate (A) at (80:3);
  \coordinate (B) at (170:3);
  \coordinate (C) at (264:3);
  \coordinate (D) at (318:3);
  \draw[thick] (A)--(B)--(C)--(D)--cycle;
  \pic[draw, angle radius=0.42cm] {angle=D--A--B};
  \pic[draw, angle radius=0.42cm] {angle=A--B--C};
  \pic[draw, angle radius=0.42cm] {angle=B--C--D};
  \pic[draw, angle radius=0.42cm] {angle=C--D--A};
\end{tikzpicture}`;

const distinctNumericAnglesWithSameMarker = String.raw`\begin{tikzpicture}
  \coordinate (Ctr) at (0,0);
  \coordinate (A) at (0:2.5);
  \coordinate (B) at (90:2.5);
  \coordinate (C) at (136:2.5);
  \coordinate (D) at (220:2.5);
  \draw (Ctr) circle (2.5);
  \draw (A)--(B)--(C)--(D)--cycle;
  \pic [draw, angle radius=0.42cm] {angle=B--A--D};
  \node[font=\small] at ($(A)+(167.5:0.72)$) {$65^\circ$};
  \pic [draw, angle radius=0.42cm] {angle=C--B--A};
  \node[font=\small] at ($(B)+(259:0.72)$) {$112^\circ$};
\end{tikzpicture}`;

describe("TikZ interior-angle auto-repair", () => {
  it("reverses reflex angle pics on a counterclockwise convex polygon", () => {
    const result = autoRepairReversedInteriorAnglePics({
      source: counterclockwiseCyclicQuadrilateral,
      authorityText: "Tứ giác lồi ABCD nội tiếp một đường tròn.",
    });

    expect(result.changes).toHaveLength(4);
    expect(result.source).toContain("{angle=B--A--D}");
    expect(result.source).toContain("{angle=C--B--A}");
    expect(result.source).toContain("{angle=D--C--B}");
    expect(result.source).toContain("{angle=A--D--C}");
  });

  it("keeps a correct clockwise polygon unchanged", () => {
    const source = String.raw`\begin{tikzpicture}
      \coordinate (A) at (-1,1);
      \coordinate (B) at (1,1);
      \coordinate (C) at (1,-1);
      \coordinate (D) at (-1,-1);
      \draw (A)--(B)--(C)--(D)--cycle;
      \pic[draw] {angle=A--B--C};
    \end{tikzpicture}`;
    const result = autoRepairReversedInteriorAnglePics({
      source,
      authorityText: "Hình vuông ABCD.",
    });

    expect(result).toEqual({ source, changes: [] });
  });

  it("does not rewrite an explicitly requested exterior or reflex angle", () => {
    for (const authorityText of [
      "Đánh dấu góc ngoài tại A.",
      "Draw the reflex angle at A.",
    ]) {
      const result = autoRepairReversedInteriorAnglePics({
        source: counterclockwiseCyclicQuadrilateral,
        authorityText,
      });
      expect(result).toEqual({
        source: counterclockwiseCyclicQuadrilateral,
        changes: [],
      });
    }
  });

  it("does not guess for a concave polygon or non-literal coordinates", () => {
    const concave = String.raw`\begin{tikzpicture}
      \coordinate (A) at (0,0);
      \coordinate (B) at (2,0);
      \coordinate (C) at (1,0.5);
      \coordinate (D) at (2,2);
      \coordinate (E) at (0,2);
      \draw (A)--(B)--(C)--(D)--(E)--cycle;
      \pic[draw] {angle=B--C--D};
    \end{tikzpicture}`;
    const calculated = String.raw`\begin{tikzpicture}
      \coordinate (A) at ($(O)+(30:2)$);
      \coordinate (B) at (1,1);
      \coordinate (C) at (0,0);
      \draw (A)--(B)--(C)--cycle;
      \pic[draw] {angle=A--B--C};
    \end{tikzpicture}`;

    expect(
      autoRepairReversedInteriorAnglePics({ source: concave, authorityText: "" }),
    ).toEqual({ source: concave, changes: [] });
    expect(
      autoRepairReversedInteriorAnglePics({ source: calculated, authorityText: "" }),
    ).toEqual({ source: calculated, changes: [] });
  });

  it("applies to Math Quiz AI source but not another subject", () => {
    expect(
      autoRepairQuizFigureLatexSource({
        source: counterclockwiseCyclicQuadrilateral,
        subjectKey: "MATH",
        authorityText: "Tứ giác lồi.",
      }).changes,
    ).toHaveLength(4);
    expect(
      autoRepairQuizFigureLatexSource({
        source: counterclockwiseCyclicQuadrilateral,
        subjectKey: "PHYSICS",
        authorityText: "Tứ giác lồi.",
      }).changes,
    ).toHaveLength(0);
  });

  it("applies to Summary generated from a block and preserves source-authority modes", () => {
    expect(
      autoRepairStemFigureLatexSource({
        source: counterclockwiseCyclicQuadrilateral,
        subjectKey: "MATH",
        mode: "GENERATE_FROM_BLOCK",
        authorityText: "Tứ giác lồi.",
      }).changes,
    ).toHaveLength(4);
    for (const mode of ["REGENERATE_FROM_SOURCE", "EDIT_CURRENT_SOURCE"] as const) {
      expect(
        autoRepairStemFigureLatexSource({
          source: counterclockwiseCyclicQuadrilateral,
          subjectKey: "MATH",
          mode,
          authorityText: "Tứ giác lồi.",
        }).changes,
      ).toHaveLength(0);
    }
  });
});

describe("TikZ angle-marker-group auto-repair", () => {
  const distinctAuthority = JSON.stringify({
    problem: String.raw`Tứ giác $ABCD$ nội tiếp đường tròn, $\widehat{A}=65^\circ$ và $\widehat{B}=112^\circ$.`,
  });

  it("gives explicitly different numeric angles visibly different marker groups", () => {
    const result = autoRepairDistinctNumericAngleMarkerGroups({
      source: distinctNumericAnglesWithSameMarker,
      authorityText: distinctAuthority,
    });

    expect(result.changes).toEqual([
      expect.objectContaining({ vertex: "B", degrees: 112 }),
    ]);
    expect(result.source).toContain(
      String.raw`\pic [draw, angle radius=0.42cm] {angle=B--A--D}`,
    );
    expect(result.source).toContain(
      String.raw`\pic [draw, angle radius=0.42cm, double, double distance=0.6pt] {angle=C--B--A}`,
    );
    expect(
      autoRepairDistinctNumericAngleMarkerGroups({
        source: result.source,
        authorityText: distinctAuthority,
      }),
    ).toEqual({ source: result.source, changes: [] });
  });

  it("does not count different radii as different marker groups", () => {
    const source = distinctNumericAnglesWithSameMarker.replace(
      "angle radius=0.42cm] {angle=C--B--A}",
      "angle radius=0.58cm] {angle=C--B--A}",
    );
    const result = autoRepairDistinctNumericAngleMarkerGroups({
      source,
      authorityText: distinctAuthority,
    });

    expect(result.changes).toHaveLength(1);
    expect(result.source).toContain("angle radius=0.58cm, double");
  });

  it("preserves already distinct marker groups", () => {
    const source = distinctNumericAnglesWithSameMarker.replace(
      "angle radius=0.42cm] {angle=C--B--A}",
      "angle radius=0.42cm, densely dashed] {angle=C--B--A}",
    );

    expect(
      autoRepairDistinctNumericAngleMarkerGroups({
        source,
        authorityText: distinctAuthority,
      }),
    ).toEqual({ source, changes: [] });
  });

  it("keeps equal angles in one marker group while separating another value", () => {
    const source = distinctNumericAnglesWithSameMarker.replace(
      String.raw`\end{tikzpicture}`,
      String.raw`\pic [draw, angle radius=0.46cm] {angle=B--C--D};\end{tikzpicture}`,
    );
    const authorityText = JSON.stringify({
      problem: String.raw`$\widehat{A}=65^\circ$, $\widehat{B}=112^\circ$ và $\widehat{C}=65^\circ$.`,
    });
    const result = autoRepairDistinctNumericAngleMarkerGroups({
      source,
      authorityText,
    });

    expect(result.source).toContain(
      String.raw`\pic [draw, angle radius=0.46cm] {angle=B--C--D}`,
    );
    expect(result.source).toContain(
      String.raw`\pic [draw, angle radius=0.42cm, double, double distance=0.6pt] {angle=C--B--A}`,
    );
  });

  it("does not guess from algebraic expressions, duplicate pics, or custom styles", () => {
    const algebraicAuthority = JSON.stringify({
      problem: String.raw`$\widehat{A}=2x+10^\circ$ và $\widehat{B}=3x-20^\circ$.`,
    });
    const duplicatePicSource = distinctNumericAnglesWithSameMarker.replace(
      String.raw`\node[font=\small] at ($(A)+(167.5:0.72)$) {$65^\circ$};`,
      String.raw`\pic [draw, angle radius=0.50cm] {angle=B--A--D};`,
    );
    const customStyleSource = distinctNumericAnglesWithSameMarker.replace(
      "draw, angle radius=0.42cm",
      "draw, schoolAngleStyle, angle radius=0.42cm",
    );

    for (const [source, authorityText] of [
      [distinctNumericAnglesWithSameMarker, algebraicAuthority],
      [duplicatePicSource, distinctAuthority],
      [customStyleSource, distinctAuthority],
    ]) {
      expect(
        autoRepairDistinctNumericAngleMarkerGroups({ source, authorityText }),
      ).toEqual({ source, changes: [] });
    }
  });

  it("applies through Math Quiz and block-generated Summary only", () => {
    const quiz = autoRepairQuizFigureLatexSource({
      source: distinctNumericAnglesWithSameMarker,
      subjectKey: "MATH",
      authorityText: distinctAuthority,
    });
    const summary = autoRepairStemFigureLatexSource({
      source: distinctNumericAnglesWithSameMarker,
      subjectKey: "MATH",
      mode: "GENERATE_FROM_BLOCK",
      authorityText: distinctAuthority,
    });
    expect(quiz.source).toContain("double distance=0.6pt");
    expect(summary.source).toContain("double distance=0.6pt");

    expect(
      autoRepairQuizFigureLatexSource({
        source: distinctNumericAnglesWithSameMarker,
        subjectKey: "PHYSICS",
        authorityText: distinctAuthority,
      }).changes,
    ).toHaveLength(0);
    for (const mode of ["REGENERATE_FROM_SOURCE", "EDIT_CURRENT_SOURCE"] as const) {
      expect(
        autoRepairStemFigureLatexSource({
          source: distinctNumericAnglesWithSameMarker,
          subjectKey: "MATH",
          mode,
          authorityText: distinctAuthority,
        }).changes,
      ).toHaveLength(0);
    }
  });

  it("separates reported same-vertex numeric angles drawn as literal arcs", () => {
    const source = String.raw`\begin{tikzpicture}
      \coordinate (A) at (140:3);
      \coordinate (B) at (20:3);
      \coordinate (C) at (-28:3);
      \coordinate (D) at (-90:3);
      \draw (A)--(B)--(C)--(D)--cycle;
      \draw (A)--(C);
      \draw (A) ++(-34:0.55) arc (-34:-10:0.55);
      \draw (A) ++(-65:0.62) arc (-65:-34:0.62);
      \path (A) ++(-22:0.86) node {$24^\circ$};
      \path (A) ++(-49.5:0.96) node {$31^\circ$};
    \end{tikzpicture}`;
    const authorityText = String.raw`Cho tứ giác $ABCD$ nội tiếp, biết $\widehat{BAC}=24^\circ$ và $\widehat{CAD}=31^\circ$.`;
    const result = autoRepairDistinctNumericManualAngleArcs({
      source,
      authorityText,
    });

    expect(result.changes).toEqual([
      expect.objectContaining({ vertex: "A", degrees: 31 }),
    ]);
    expect(result.source).toContain(
      String.raw`\draw (A) ++(-34:0.55) arc (-34:-10:0.55);`,
    );
    expect(result.source).toContain(
      String.raw`\draw [double, double distance=0.6pt](A) ++(-65:0.62) arc (-65:-34:0.62);`,
    );
    expect(
      autoRepairDistinctNumericManualAngleArcs({
        source: result.source,
        authorityText,
      }),
    ).toEqual({ source: result.source, changes: [] });
  });

  it("separates same-vertex numeric angles drawn with different named-ray pics", () => {
    const source = String.raw`\begin{tikzpicture}
      \pic[draw, angle radius=.4cm, pic text options={font=\small}] {angle=B--A--C};
      \pic[draw, angle radius=.6cm, pic text options={font=\small}] {angle=C--A--D};
    \end{tikzpicture}`;
    const authorityText = String.raw`$\widehat{BAC}=24^\circ$ và $\widehat{CAD}=31^\circ$.`;
    const result = autoRepairDistinctNumericAngleMarkerGroups({
      source,
      authorityText,
    });

    expect(result.changes).toEqual([
      expect.objectContaining({ vertex: "A", degrees: 31 }),
    ]);
    expect(result.source).toContain(
      String.raw`\pic[draw, angle radius=.6cm, pic text options={font=\small}, double, double distance=0.6pt] {angle=C--A--D}`,
    );
  });

  it("does not guess manual arcs whose sweep or options are not authoritative", () => {
    const authorityText = String.raw`$\widehat{BAC}=24^\circ$ và $\widehat{CAD}=31^\circ$.`;
    for (const source of [
      String.raw`\begin{tikzpicture}\draw (A) ++(0:1) arc (0:20:1);\draw (A) ++(30:1) arc (30:60:1);\end{tikzpicture}`,
      String.raw`\begin{tikzpicture}\draw[schoolAngle] (A) ++(0:1) arc (0:24:1);\draw (A) ++(30:1) arc (30:61:1);\end{tikzpicture}`,
    ]) {
      expect(autoRepairDistinctNumericManualAngleArcs({ source, authorityText })).toEqual(
        { source, changes: [] },
      );
    }
  });
});
