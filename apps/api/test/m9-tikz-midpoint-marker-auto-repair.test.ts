import { describe, expect, it } from "vitest";

import { autoRepairTikzLocalHeaderPlacement } from "#api/common/ai/tikz-local-header-auto-repair";
import { autoRepairTikzMidpointMarkerBundles } from "#api/common/ai/tikz-midpoint-marker-auto-repair";
import { autoRepairQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import {
  autoRepairStemFigureLatexSource,
  validateTexSourcePolicy,
} from "#api/modules/stem-figures/utils/tex-source-policy";

const authorityText = String.raw`Cho hình thoi $ABCD$. Gọi $M$, $N$, $P$, $Q$ lần lượt là trung điểm của $AB$, $BC$, $CD$, $DA$.`;
const reportedMidpointBundleSource = String.raw`\usetikzlibrary{calc,decorations.markings}
\tikzset{
  side mark/.style={decoration={markings,mark=at position .18 with {\draw (-2pt,0)--(2pt,0);}},postaction={decorate}},
  mid2/.style={decoration={markings,mark=at position .5 with {\draw (-2pt,-1pt)--(2pt,1pt);\draw (-2pt,1pt)--(2pt,3pt);}},postaction={decorate}},
  mid3/.style={decoration={markings,mark=at position .5 with {\draw (-2pt,-2pt)--(2pt,0);\draw (-2pt,0)--(2pt,2pt);\draw (-2pt,2pt)--(2pt,4pt);}},postaction={decorate}},
  mid4/.style={decoration={markings,mark=at position .5 with {\draw (-2pt,-3pt)--(2pt,-1pt);\draw (-2pt,-1pt)--(2pt,1pt);\draw (-2pt,1pt)--(2pt,3pt);\draw (-2pt,3pt)--(2pt,5pt);}},postaction={decorate}},
  mid5/.style={decoration={markings,mark=at position .5 with {\draw (-2pt,-4pt)--(2pt,-2pt);\draw (-2pt,-2pt)--(2pt,0);\draw (-2pt,0)--(2pt,2pt);\draw (-2pt,2pt)--(2pt,4pt);\draw (-2pt,4pt)--(2pt,6pt);}},postaction={decorate}}
}
\begin{tikzpicture}
  \coordinate (A) at (-2,0);
  \coordinate (B) at (0,4);
  \coordinate (C) at (2,0);
  \coordinate (D) at (0,-4);
  \coordinate (M) at ($(A)!0.5!(B)$);
  \coordinate (N) at ($(B)!0.5!(C)$);
  \coordinate (P) at ($(C)!0.5!(D)$);
  \coordinate (Q) at ($(D)!0.5!(A)$);
  \draw[side mark,mid2] (A)--(B);
  \draw[side mark,mid3] (B)--(C);
  \draw[side mark,mid4] (C)--(D);
  \draw[side mark,mid5] (D)--(A);
  \draw (A)--(C);
  \draw (B)--(D);
  \node[left] at (M) {$M$};
  \node[right] at (N) {$N$};
  \node[right] at (P) {$P$};
  \node[left] at (Q) {$Q$};
\end{tikzpicture}`;

describe("TikZ midpoint-marker auto-repair", () => {
  it("hoists model-emitted local header commands out of the drawing root", () => {
    const source = String.raw`\begin{tikzpicture}
      \usetikzlibrary{decorations.markings}
      \tikzset{mid/.style={thick}}
      \draw[mid] (0,0)--(1,0);
    \end{tikzpicture}`;
    const result = autoRepairTikzLocalHeaderPlacement(source);

    expect(result.changes).toHaveLength(2);
    expect(result.source.indexOf(String.raw`\usetikzlibrary`)).toBeLessThan(
      result.source.indexOf(String.raw`\begin{tikzpicture}`),
    );
    expect(result.source.indexOf(String.raw`\tikzset`)).toBeLessThan(
      result.source.indexOf(String.raw`\begin{tikzpicture}`),
    );
    expect(validateTexSourcePolicy(result.source, undefined, "MATH")).toEqual([]);
    expect(autoRepairTikzLocalHeaderPlacement(result.source)).toEqual({
      source: result.source,
      changes: [],
    });
  });

  it("moves top-level PGF math macro declarations into the drawing root", () => {
    const source = String.raw`\pgfmathsetmacro{\h}{6*sqrt(5)}
\pgfmathtruncatemacro{\count}{4}
\begin{tikzpicture}[scale=0.34]
  \draw (0,0)--(0,\h);
  \node at (1,1) {\count};
\end{tikzpicture}`;
    const result = autoRepairTikzLocalHeaderPlacement(source);
    const rootIndex = result.source.indexOf(String.raw`\begin{tikzpicture}`);

    expect(result.changes).toEqual([
      { kind: "LOCAL_MACRO_MOVED_INTO_ROOT", command: "pgfmathsetmacro" },
      { kind: "LOCAL_MACRO_MOVED_INTO_ROOT", command: "pgfmathtruncatemacro" },
    ]);
    expect(result.source.indexOf(String.raw`\pgfmathsetmacro`)).toBeGreaterThan(
      rootIndex,
    );
    expect(result.source.indexOf(String.raw`\pgfmathtruncatemacro`)).toBeGreaterThan(
      rootIndex,
    );
    expect(validateTexSourcePolicy(result.source, undefined, "MATH")).toEqual([]);
    expect(autoRepairTikzLocalHeaderPlacement(result.source)).toEqual({
      source: result.source,
      changes: [],
    });
  });

  it("does not move commented or nested PGF math macro declarations", () => {
    const source = String.raw`% \pgfmathsetmacro{\ignored}{1}
\tikzset{setup/.code={\pgfmathsetmacro{\nested}{2}}}
\begin{tikzpicture}
  \draw (0,0)--(1,0);
\end{tikzpicture}`;

    expect(autoRepairTikzLocalHeaderPlacement(source)).toEqual({
      source,
      changes: [],
    });
  });

  it("replaces midpoint bundles with compact paired half-segment markers", () => {
    const result = autoRepairTikzMidpointMarkerBundles({
      source: reportedMidpointBundleSource,
      authorityText,
    });

    expect(result.changes).toHaveLength(4);
    expect(result.source).not.toMatch(/\\draw\[side mark,mid[2-5]\]/u);
    expect(result.source.match(/mark=at position \.25/gu)).toHaveLength(4);
    expect(result.source.match(/mark=at position \.75/gu)).toHaveLength(4);
    expect(result.source).toContain("mark=at position .18");
    expect(result.source).toContain(String.raw`\node[left] at (M) {$M$};`);
    expect(result.source).toContain(String.raw`\draw (A)--(C);`);
    expect(
      autoRepairTikzMidpointMarkerBundles({
        source: result.source,
        authorityText,
      }),
    ).toEqual({ source: result.source, changes: [] });
  });

  it("uses no more than two strokes for each repaired marker glyph", () => {
    const result = autoRepairTikzMidpointMarkerBundles({
      source: reportedMidpointBundleSource,
      authorityText,
    });
    const repairedPathLines = result.source
      .split("\n")
      .filter((line) => line.includes("mark=at position .25"));

    expect(repairedPathLines).toHaveLength(4);
    for (const line of repairedPathLines) {
      const firstMark = line.match(/mark=at position \.25 with \{([^}]*)\}/u);
      expect(firstMark?.[1]?.match(/\\draw/gu)?.length ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it("does not guess without authority or a verified midpoint construction", () => {
    const unverified = reportedMidpointBundleSource.replace(
      String.raw`\coordinate (Q) at ($(D)!0.5!(A)$);`,
      String.raw`\coordinate (Q) at (-1,-1);`,
    );
    for (const [source, text] of [
      [reportedMidpointBundleSource, "Cho hình thoi ABCD."],
      [unverified, authorityText],
    ]) {
      expect(
        autoRepairTikzMidpointMarkerBundles({
          source,
          authorityText: text,
        }),
      ).toEqual({ source, changes: [] });
    }
  });

  it("preserves a marker at .5 when it belongs to each explicit half-segment", () => {
    const source = String.raw`\usetikzlibrary{decorations.markings}
      \tikzset{pair/.style={decoration={markings,mark=at position .5 with {\draw (0,-2pt)--(0,2pt);}},postaction={decorate}}}
      \begin{tikzpicture}
        \coordinate (A) at (0,0);
        \coordinate (B) at (4,0);
        \coordinate (M) at (2,0);
        \draw[pair] (A)--(M);
        \draw[pair] (M)--(B);
      \end{tikzpicture}`;

    expect(
      autoRepairTikzMidpointMarkerBundles({
        source,
        authorityText: "Gọi M là trung điểm của AB.",
      }),
    ).toEqual({ source, changes: [] });
  });

  it("applies through Math Quiz and block-generated Summary only", () => {
    expect(
      autoRepairQuizFigureLatexSource({
        source: reportedMidpointBundleSource,
        subjectKey: "MATH",
        authorityText,
      }).changes,
    ).toHaveLength(4);
    expect(
      autoRepairStemFigureLatexSource({
        source: reportedMidpointBundleSource,
        subjectKey: "MATH",
        mode: "GENERATE_FROM_BLOCK",
        authorityText,
      }).changes,
    ).toHaveLength(4);
    expect(
      autoRepairQuizFigureLatexSource({
        source: reportedMidpointBundleSource,
        subjectKey: "PHYSICS",
        authorityText,
      }).changes,
    ).toHaveLength(0);
    expect(
      autoRepairStemFigureLatexSource({
        source: reportedMidpointBundleSource,
        subjectKey: "MATH",
        mode: "EDIT_CURRENT_SOURCE",
        authorityText,
      }).changes,
    ).toHaveLength(0);
  });
});
