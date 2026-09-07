import { expect, test } from "@playwright/test";

import {
  addStemFigureCircleCenterLabel,
  createStemFigureQuickAngle,
  removeStemFigureQuickAngle,
  updateStemFigureMidpoint,
  updateStemFigureSegment,
} from "@/lib/stem-figure-geometry-actions";

const BASE_SOURCE = String.raw`\begin{tikzpicture}
  \coordinate (A) at (4,0);
  \coordinate (B) at (0,2);
  \coordinate (C) at (0,-1);
  \coordinate (D) at (1,-2);
  \draw (B) -- (A) -- (C) -- (D);
  \draw (B) -- (C);
  \pic[draw, angle radius=0.50cm, "$74^\circ$"] {angle=C--B--A};
  \pic[draw, angle radius=0.50cm] {angle=B--A--C};
  \pic[draw, angle radius=0.55cm, "$32^\circ$"] {angle=B--A--C};
  \pic[draw, angle radius=0.50cm] {angle=D--C--A};
  \pic[draw, angle radius=0.55cm] {angle=D--C--A};
  \pic[draw, angle radius=0.60cm, "$41^\circ$"] {angle=D--C--A};
\end{tikzpicture}`;

const MIDPOINT_SOURCE = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (0,3);
  \coordinate (D) at (4,3);
\end{tikzpicture}`;

test("adds a midpoint, auto-connects a missing segment and marks both halves", () => {
  const result = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { midpointName: "M", segmentName: "ab" },
    "ADD",
  );

  expect(result.issue).toBeNull();
  expect(result.canonicalSegment).toBe("AB");
  expect(result.midpointName).toBe("M");
  expect(result.addedSegment).toBe(true);
  expect(result.markerVariant).toBe(1);
  expect(result.source).toContain(String.raw`\usetikzlibrary{calc,decorations.markings}`);
  expect(result.source.match(/\\draw\[solid\] \(A\) -- \(B\);/gu)).toHaveLength(1);
  expect(result.source).toContain(String.raw`\coordinate (M) at ($(A)!0.5!(B)$);`);
  expect(result.source).toContain("mark=at position .25");
  expect(result.source).toContain("mark=at position .75");
  expect(result.source).not.toContain("mark=at position .5 with");
  expect(
    result.source.match(
      /\\draw\[line width=0\.55pt\] \(-2\.7pt,-1\.8pt\) -- \(2\.7pt,1\.8pt\);/gu,
    ),
  ).toHaveLength(2);
});

test("keeps an existing segment and assigns different markers to independent midpoint groups", () => {
  const connectedSource = MIDPOINT_SOURCE.replace(
    String.raw`\end{tikzpicture}`,
    String.raw`  \draw (A) -- (B);` + "\n" + String.raw`\end{tikzpicture}`,
  );
  const first = updateStemFigureMidpoint(
    connectedSource,
    { midpointName: "M", segmentName: "AB" },
    "ADD",
  );
  const second = updateStemFigureMidpoint(
    first.source,
    { midpointName: "N", segmentName: "CD" },
    "ADD",
  );

  expect(first.issue).toBeNull();
  expect(first.addedSegment).toBe(false);
  expect(first.source.match(/\\draw \(A\) -- \(B\);/gu)).toHaveLength(1);
  expect(second.issue).toBeNull();
  expect(second.markerVariant).toBe(2);
  expect(second.source).toContain(String.raw`\coordinate (N) at ($(C)!0.5!(D)$);`);
  expect(second.source).toContain(String.raw`(-3pt,-1.8pt) -- (0.4pt,1.8pt)`);
  expect(second.source).toContain(String.raw`(-2.7pt,-1.8pt) -- (2.7pt,1.8pt)`);
});

test("matches an auto-connected midpoint edge and label to the figure's existing styles", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (0,3);
  \draw[very thick] (A) -- (C);
  \node[above, font=\Large] at (A) {$A$};
  \node[above, font=\Large] at (B) {$B$};
  \node[above, font=\Large] at (C) {$C$};
\end{tikzpicture}`;
  const result = updateStemFigureMidpoint(
    source,
    { midpointName: "m", segmentName: "AB" },
    "ADD",
  );

  expect(result.issue).toBeNull();
  expect(result.midpointName).toBe("M");
  expect(result.source).toContain(String.raw`\draw[very thick] (A) -- (B);`);
  expect(result.source).toContain(
    String.raw`\path (A) -- node[midway, auto, inner sep=4pt, font=\Large] {$M$} (B);`,
  );
});

test("deletes a managed midpoint by segment alone and preserves the base segment", () => {
  const added = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { midpointName: "M", segmentName: "AB" },
    "ADD",
  );
  const removed = updateStemFigureMidpoint(
    added.source,
    { segmentName: "B-A" },
    "REMOVE",
  );

  expect(removed.issue).toBeNull();
  expect(removed.midpointName).toBe("M");
  expect(removed.source).not.toContain("classhero-quick-midpoint");
  expect(removed.source).not.toContain(String.raw`\coordinate (M)`);
  expect(removed.source).not.toContain("mark=at position .25");
  expect(removed.source).not.toContain("mark=at position .75");
  expect(removed.source).toContain(String.raw`\draw[solid] (A) -- (B);`);
});

test("replaces the managed midpoint name on the same segment without duplicating its marker or edge", () => {
  const added = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { midpointName: "M", segmentName: "AB" },
    "ADD",
  );
  const replaced = updateStemFigureMidpoint(
    added.source,
    { midpointName: "N", segmentName: "BA" },
    "ADD",
  );

  expect(replaced.issue).toBeNull();
  expect(replaced.replacedMidpointName).toBe("M");
  expect(replaced.midpointName).toBe("N");
  expect(replaced.markerVariant).toBe(added.markerVariant);
  expect(replaced.addedSegment).toBe(false);
  expect(replaced.source).not.toContain(String.raw`\coordinate (M)`);
  expect(replaced.source).not.toContain("{$M$}");
  expect(replaced.source).toContain(String.raw`\coordinate (N) at ($(B)!0.5!(A)$);`);
  expect(replaced.source.match(/classhero-quick-midpoint:start/gu)).toHaveLength(1);
  expect(replaced.source.match(/mark=at position \.25/gu)).toHaveLength(1);
  expect(replaced.source.match(/\\draw\[solid\] \(A\) -- \(B\);/gu)).toHaveLength(1);
});

test("does not overwrite a midpoint that is referenced by other geometry", () => {
  const added = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { midpointName: "M", segmentName: "AB" },
    "ADD",
  );
  const inUseSource = added.source.replace(
    String.raw`\end{tikzpicture}`,
    String.raw`  \draw (M) -- (C);` + "\n" + String.raw`\end{tikzpicture}`,
  );
  const replaced = updateStemFigureMidpoint(
    inUseSource,
    { midpointName: "N", segmentName: "AB" },
    "ADD",
  );

  expect(replaced.issue).toMatchObject({ code: "MIDPOINT_IN_USE" });
  expect(replaced.source).toBe(inUseSource);
});

test("rejects ambiguous midpoint ownership and a midpoint still used elsewhere", () => {
  const added = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { midpointName: "M", segmentName: "AB" },
    "ADD",
  );
  const inUseSource = added.source.replace(
    String.raw`\end{tikzpicture}`,
    String.raw`  \draw (M) -- (C);` + "\n" + String.raw`\end{tikzpicture}`,
  );
  const inUse = updateStemFigureMidpoint(inUseSource, { segmentName: "AB" }, "REMOVE");
  const missing = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { segmentName: "AB" },
    "REMOVE",
  );

  expect(inUse.issue).toMatchObject({ code: "MIDPOINT_IN_USE" });
  expect(inUse.source).toBe(inUseSource);
  expect(missing.issue).toMatchObject({ code: "MIDPOINT_NOT_FOUND" });
  expect(missing.source).toBe(MIDPOINT_SOURCE);
});

test("rejects duplicate names and an existing calculated midpoint relation", () => {
  const duplicateName = updateStemFigureMidpoint(
    MIDPOINT_SOURCE,
    { midpointName: "C", segmentName: "AB" },
    "ADD",
  );
  const relationSource = MIDPOINT_SOURCE.replace(
    String.raw`\end{tikzpicture}`,
    String.raw`  \coordinate (M) at ($(A)!0.5!(B)$);` +
      "\n" +
      String.raw`\end{tikzpicture}`,
  );
  const existingRelation = updateStemFigureMidpoint(
    relationSource,
    { midpointName: "N", segmentName: "AB" },
    "ADD",
  );

  expect(duplicateName.issue).toMatchObject({ code: "MIDPOINT_ALREADY_EXISTS" });
  expect(existingRelation.issue).toMatchObject({ code: "MIDPOINT_ALREADY_EXISTS" });
  expect(duplicateName.source).toBe(MIDPOINT_SOURCE);
  expect(existingRelation.source).toBe(relationSource);
});

test("adds a quick angle, connects only missing segments and assigns a distinct arc group", () => {
  const result = createStemFigureQuickAngle(BASE_SOURCE, {
    angleName: "abd",
    autoConnect: true,
    degreesText: "50°",
  });

  expect(result.issue).toBeNull();
  expect(result.canonicalAngle).toBe("ABD");
  expect(result.degrees).toBe(50);
  expect(result.markerCount).toBe(4);
  expect(result.addedSegments).toEqual(["BD"]);
  expect(result.source.match(/\\draw \(B\) -- \(D\);/gu)).toHaveLength(1);
  expect(result.source.match(/angle=D--B--A/gu)).toHaveLength(4);
  expect(result.source.match(/\$50\^\\circ\$/gu)).toHaveLength(1);
  expect(result.source).toContain("angle radius=0.65cm");
  expect(result.source.indexOf("angle=D--B--A")).toBeLessThan(
    result.source.indexOf(String.raw`\end{tikzpicture}`),
  );
});

test("reuses the marker count for the same measurement and detects chained segments", () => {
  const result = createStemFigureQuickAngle(BASE_SOURCE, {
    angleName: "B-C-D",
    autoConnect: true,
    degreesText: String.raw`$32^\circ$`,
  });

  expect(result.issue).toBeNull();
  expect(result.markerCount).toBe(2);
  expect(result.addedSegments).toEqual([]);
  expect(result.source.match(/angle=D--C--B/gu)).toHaveLength(2);
  expect(result.source.match(/\\draw\[solid\]/gu) ?? []).toHaveLength(0);
});

test("assigns a new marker group after legacy single-pic angle styles", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (4,0);
  \coordinate (B) at (0,2);
  \coordinate (C) at (0,-1);
  \coordinate (D) at (1,-2);
  \draw (B) -- (A) -- (C) -- (D);
  \pic[draw, "$74^\circ$"] {angle=C--B--A};
  \pic[draw, "$32^\circ$", double] {angle=B--A--C};
  \pic[draw, "$41^\circ$", densely dashed] {angle=D--C--A};
\end{tikzpicture}`;
  const result = createStemFigureQuickAngle(source, {
    angleName: "ABD",
    autoConnect: true,
    degreesText: "50",
  });

  expect(result.issue).toBeNull();
  expect(result.markerCount).toBe(4);
  expect(result.source.match(/angle=D--B--A/gu)).toHaveLength(4);
});

test("requires explicit opt-in before connecting a missing side", () => {
  const result = createStemFigureQuickAngle(BASE_SOURCE, {
    angleName: "ABD",
    autoConnect: false,
    degreesText: "50",
  });

  expect(result.issue).toMatchObject({ code: "MISSING_SEGMENT" });
  expect(result.issue?.message).toContain("BD");
  expect(result.source).toBe(BASE_SOURCE);
});

test("rejects unknown and repeated angles without changing source", () => {
  const unknown = createStemFigureQuickAngle(BASE_SOURCE, {
    angleName: "ABZ",
    autoConnect: true,
    degreesText: "50",
  });
  const repeated = createStemFigureQuickAngle(BASE_SOURCE, {
    angleName: "ABA",
    autoConnect: true,
    degreesText: "50",
  });
  expect(unknown.issue).toMatchObject({ code: "MISSING_POINT" });
  expect(repeated.issue).toMatchObject({ code: "POINTS_NOT_DISTINCT" });
  expect(unknown.source).toBe(BASE_SOURCE);
  expect(repeated.source).toBe(BASE_SOURCE);
});

test("replaces an existing angle measurement and keeps exactly one marker group", () => {
  const result = createStemFigureQuickAngle(BASE_SOURCE, {
    angleName: "cab",
    autoConnect: true,
    degreesText: "60",
  });

  expect(result.issue).toBeNull();
  expect(result.replacedExisting).toBe(true);
  expect(result.canonicalAngle).toBe("CAB");
  expect(result.source).not.toContain(String.raw`$32^\circ$`);
  expect(result.source.match(/angle=B--A--C/gu)).toHaveLength(result.markerCount ?? 0);
  expect(result.source.match(/\$60\^\\circ\$/gu)).toHaveLength(1);
});

test("reserves an arc style used by an algebraic angle when adding a different measure", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (3,0);
  \coordinate (B) at (0,2);
  \coordinate (C) at (-2,0);
  \coordinate (D) at (0,-3);
  \draw (B) -- (A) -- (D) -- (C) -- cycle;
  \pic[draw, angle radius=0.50cm, "$(2x+10)^\circ$"] {angle=B--A--D};
\end{tikzpicture}`;
  const result = createStemFigureQuickAngle(source, {
    angleName: "ADB",
    autoConnect: true,
    degreesText: "50",
  });

  expect(result.issue).toBeNull();
  expect(result.markerCount).toBe(2);
  expect(result.source.match(/angle=B--A--D/gu)).toHaveLength(1);
  expect(result.source.match(/angle=A--D--B/gu)).toHaveLength(2);
});

test("rejects unsupported point positions instead of guessing an angle sweep", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (origin);
  \coordinate (B) at (left point);
  \coordinate (D) at (lower point);
\end{tikzpicture}`;
  const result = createStemFigureQuickAngle(source, {
    angleName: "ABD",
    autoConnect: true,
    degreesText: "50",
  });

  expect(result.issue).toMatchObject({ code: "SOURCE_UNSUPPORTED" });
  expect(result.source).toBe(source);
});

test("adds an angle safely when named points use literal polar coordinates", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (30:3cm);
  \coordinate (B) at (90:3cm);
  \coordinate (C) at (140:3cm);
  \coordinate (D) at (262:3cm);
  \draw[thick] (B) -- (A) -- (D);
\end{tikzpicture}`;
  const result = createStemFigureQuickAngle(source, {
    angleName: "ADB",
    autoConnect: true,
    degreesText: "50",
  });

  expect(result.issue).toBeNull();
  expect(result.canonicalAngle).toBe("ADB");
  expect(result.addedSegments).toEqual(["DB"]);
  expect(result.source).toContain(String.raw`\draw[thick] (D) -- (B);`);
  expect(result.source).toContain("{angle=A--D--B}");
  expect(result.source).toContain(String.raw`$50^\circ$`);
});

test("adds an angle when polar points are offset from a numeric named origin", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (O) at (1,-2);
  \coordinate (A) at ($(O)+(0:3)$);
  \coordinate (B) at ($(O)+(90:3)$);
  \coordinate (D) at ($(O)+(-90:3)$);
  \draw[line width=0.9pt] (B) -- (A) -- (D);
\end{tikzpicture}`;
  const result = createStemFigureQuickAngle(source, {
    angleName: "ADB",
    autoConnect: true,
    degreesText: "50",
  });

  expect(result.issue).toBeNull();
  expect(result.source).toContain(String.raw`\draw[line width=0.9pt] (D) -- (B);`);
  expect(result.source).toContain("{angle=A--D--B}");
});

test("adds an uppercase label for the unique circle center without adding another dot", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (30:3cm);
  \coordinate (B) at (90:3cm);
  \draw[black!65] (0,0) circle (3cm);
  \fill (0,0) circle (1.2pt);
  \node[above, font=\Large] at (A) {$A$};
  \node[above, font=\Large] at (B) {$B$};
\end{tikzpicture}`;
  const result = addStemFigureCircleCenterLabel(source, { centerName: "o" });

  expect(result.issue).toBeNull();
  expect(result.centerName).toBe("O");
  expect(result.source).toContain(String.raw`\coordinate (O) at (0,0);`);
  expect(result.source).toContain(
    String.raw`\node[above right=4pt, inner sep=2pt, font=\Large] at (O) {$O$};`,
  );
  expect(result.source.match(/\\fill \(0,0\) circle \(1\.2pt\);/gu)).toHaveLength(1);
});

test("renames a managed circle-center label without duplicating it", () => {
  const source = String.raw`\begin{tikzpicture}
  \draw (0,0) circle (3cm);
\end{tikzpicture}`;
  const added = addStemFigureCircleCenterLabel(source, { centerName: "o" });
  const renamed = addStemFigureCircleCenterLabel(added.source, { centerName: "i" });

  expect(renamed.issue).toBeNull();
  expect(renamed.replacedCenterName).toBe("O");
  expect(renamed.centerName).toBe("I");
  expect(renamed.source).not.toContain(String.raw`\coordinate (O)`);
  expect(renamed.source).toContain(String.raw`\coordinate (I) at (0,0);`);
  expect(renamed.source.match(/classhero-quick-circle-center:start/gu)).toHaveLength(1);
});

test("rejects a missing or ambiguous circle center and a point name used elsewhere", () => {
  const noCircle = addStemFigureCircleCenterLabel(MIDPOINT_SOURCE, { centerName: "O" });
  const twoCenters = addStemFigureCircleCenterLabel(
    String.raw`\begin{tikzpicture}
  \draw (0,0) circle (1cm);
  \draw (3,0) circle (1cm);
\end{tikzpicture}`,
    { centerName: "O" },
  );
  const collision = addStemFigureCircleCenterLabel(
    String.raw`\begin{tikzpicture}
  \coordinate (O) at (2,0);
  \draw (0,0) circle (1cm);
\end{tikzpicture}`,
    { centerName: "O" },
  );

  expect(noCircle.issue).toMatchObject({ code: "CIRCLE_NOT_FOUND" });
  expect(twoCenters.issue).toMatchObject({ code: "CIRCLE_CENTER_AMBIGUOUS" });
  expect(collision.issue).toMatchObject({ code: "CIRCLE_CENTER_NAME_EXISTS" });
});

test("ignores commented points, segments and angle markers", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (2,0);
  \coordinate (B) at (0,0);
  \coordinate (D) at (0,2);
  % \coordinate (Z) at (1,1);
  % \draw (B) -- (D);
  % \pic[draw, "$50^\circ$"] {angle=A--B--D};
  \draw (A) -- (B);
\end{tikzpicture}`;
  const result = createStemFigureQuickAngle(source, {
    angleName: "ABD",
    autoConnect: true,
    degreesText: "50",
  });

  expect(result.issue).toBeNull();
  expect(result.addedSegments).toEqual(["BD"]);
  expect(result.markerCount).toBe(1);
});

test("removes a named angle marker group in either endpoint order and preserves its sides", () => {
  const result = removeStemFigureQuickAngle(BASE_SOURCE, { angleName: "c-a-b" });

  expect(result.issue).toBeNull();
  expect(result.canonicalAngle).toBe("CAB");
  expect(result.changedCount).toBe(2);
  expect(result.source).not.toContain("angle=B--A--C");
  expect(result.source).toContain("angle=C--B--A");
  expect(result.source).toContain("angle=D--C--A");
  expect(result.source).toContain(String.raw`\draw (B) -- (A) -- (C) -- (D);`);
});

test("reports an unknown named angle without changing the source", () => {
  const missingMarker = removeStemFigureQuickAngle(BASE_SOURCE, { angleName: "ABD" });
  const missingPoint = removeStemFigureQuickAngle(BASE_SOURCE, { angleName: "ABZ" });

  expect(missingMarker.issue).toMatchObject({ code: "ANGLE_NOT_FOUND" });
  expect(missingPoint.issue).toMatchObject({ code: "MISSING_POINT" });
  expect(missingMarker.source).toBe(BASE_SOURCE);
  expect(missingPoint.source).toBe(BASE_SOURCE);
});

test("removes standalone and inline angle pics without requiring an option list", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (2,0);
  \coordinate (B) at (0,0);
  \coordinate (C) at (0,2);
  \draw (A) -- (B) -- (C) pic {angle=A--B--C};
  \pic {angle=C--B--A};
\end{tikzpicture}`;
  const result = removeStemFigureQuickAngle(source, { angleName: "ABC" });

  expect(result.issue).toBeNull();
  expect(result.changedCount).toBe(2);
  expect(result.source).not.toContain("pic {angle=");
  expect(result.source).toContain(String.raw`\draw (A) -- (B) -- (C) ;`);
});

test("removes a separate degree node explicitly anchored to the target angle vertex", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,2);
  \coordinate (B) at (2,2);
  \coordinate (C) at (2,0);
  \draw (A) -- (C) -- (B);
  \pic[draw, angle radius=0.50cm] {angle=A--C--B};
  \pic[draw, angle radius=0.55cm] {angle=B--C--A};
  \node[font=\small] at ($(C)+(135:0.82)$) {$32^\circ$};
\end{tikzpicture}`;
  const result = removeStemFigureQuickAngle(source, { angleName: "ACB" });

  expect(result.issue).toBeNull();
  expect(result.source).not.toContain("angle=A--C--B");
  expect(result.source).not.toContain("angle=B--C--A");
  expect(result.source).not.toContain(String.raw`32^\circ`);
  expect(result.source).toContain(String.raw`\draw (A) -- (C) -- (B);`);
});

test("keeps an adjacent angle label when two marked angles share one vertex", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (B) at (-2,1);
  \coordinate (A) at (0,0);
  \coordinate (C) at (-2,-1);
  \coordinate (D) at (0,-2);
  \pic[draw] {angle=B--A--C};
  \node at ($(A)+(180:0.8)$) {$32^\circ$};
  \pic[draw] {angle=C--A--D};
  \node at ($(A)+(225:0.8)$) {$41^\circ$};
\end{tikzpicture}`;
  const result = removeStemFigureQuickAngle(source, { angleName: "BAC" });

  expect(result.issue).toBeNull();
  expect(result.source).not.toContain("angle=B--A--C");
  expect(result.source).not.toContain(String.raw`32^\circ`);
  expect(result.source).toContain("angle=C--A--D");
  expect(result.source).toContain(String.raw`41^\circ`);
});

test("connects a named segment once and rejects a duplicate in either direction", () => {
  const connected = updateStemFigureSegment(
    BASE_SOURCE,
    { segmentName: "bd" },
    "CONNECT",
  );

  expect(connected.issue).toBeNull();
  expect(connected.canonicalSegment).toBe("BD");
  expect(connected.source).toContain(String.raw`\draw (B) -- (D);`);

  const duplicate = updateStemFigureSegment(
    connected.source,
    { segmentName: "D-B" },
    "CONNECT",
  );
  expect(duplicate.issue).toMatchObject({ code: "SEGMENT_ALREADY_EXISTS" });
  expect(duplicate.source).toBe(connected.source);
});

test("connects a segment with the dominant line thickness already used by the figure", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \coordinate (C) at (2,2);
  \coordinate (D) at (0,2);
  \draw[thick] (A) -- (B) -- (C) -- (D);
\end{tikzpicture}`;
  const result = updateStemFigureSegment(source, { segmentName: "BD" }, "CONNECT");

  expect(result.issue).toBeNull();
  expect(result.source).toContain(String.raw`\draw[thick] (B) -- (D);`);
});

test("disconnects a middle edge by splitting a straight path without reconnecting it", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (1,0);
  \coordinate (C) at (2,0);
  \coordinate (D) at (3,0);
  \draw[thick] (A) -- (B) -- (C) -- (D);
\end{tikzpicture}`;
  const result = updateStemFigureSegment(source, { segmentName: "CB" }, "DISCONNECT");

  expect(result.issue).toBeNull();
  expect(result.changedCount).toBe(1);
  expect(result.source).toContain(String.raw`\draw[thick] (A) -- (B);`);
  expect(result.source).toContain(String.raw`\draw[thick] (C) -- (D);`);
  expect(result.source).not.toContain("(B) -- (C)");
});

test("opens a polygon cycle at the disconnected edge and preserves every other side", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \coordinate (C) at (1,2);
  \draw (A) -- (B) -- (C) -- cycle;
\end{tikzpicture}`;
  const result = updateStemFigureSegment(source, { segmentName: "AB" }, "DISCONNECT");

  expect(result.issue).toBeNull();
  expect(result.source).toContain(String.raw`\draw (B) -- (C) -- (A);`);
  expect(result.source).not.toContain("cycle");

  const closingEdge = updateStemFigureSegment(
    source,
    { segmentName: "CA" },
    "DISCONNECT",
  );
  expect(closingEdge.issue).toBeNull();
  expect(closingEdge.source).toContain(String.raw`\draw (A) -- (B) -- (C);`);
  expect(closingEdge.source).not.toContain("cycle");
});

test("does not guess how to disconnect a segment embedded in a complex draw command", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \draw (A) -- node[midway] {$2$} (B);
\end{tikzpicture}`;
  const result = updateStemFigureSegment(source, { segmentName: "AB" }, "DISCONNECT");

  expect(result.issue).toMatchObject({ code: "SOURCE_UNSUPPORTED" });
  expect(result.source).toBe(source);
});
