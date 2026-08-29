import { expect, test } from "@playwright/test";

import {
  applyStemFigureQuickAction,
  extractStemFigureTextSlots,
  readStemFigureScalePercentage,
  removeStemFigureAngleMeasurements,
  removeStemFigureLengthLabels,
  setStemFigureScalePercentage,
  type StemFigureQuickAction,
  updateStemFigureTextSlot,
  updateStemFigureTextSlotAdjustment,
} from "@/lib/stem-figure-source-actions";
import { readStemFigureDisplayScale } from "@learning-path/shared";

test("removes standalone metric length labels and preserves geometry labels", () => {
  const source = String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (5,0);
  \draw (A) -- (B);
  \node[below] at (A) {$A$};
  \node[below] at (B) {$B$};
  \node[left] at (0,2) {$13\,\mathrm{m}$};
  \node[right] at (5,2) {$12 m$};
  \node[below] at (2.5,0) {$5\,\text{m}$};
\end{tikzpicture}`;

  const result = removeStemFigureLengthLabels(source);

  expect(result.removedCount).toBe(3);
  expect(result.source).toContain(String.raw`\node[below] at (A) {$A$};`);
  expect(result.source).toContain(String.raw`\node[below] at (B) {$B$};`);
  expect(result.source).not.toContain(String.raw`13\,\mathrm{m}`);
  expect(result.source).not.toContain("12 m");
  expect(result.source).not.toContain(String.raw`5\,\text{m}`);
});

test("removes inline length nodes without deleting their owning paths", () => {
  const source = String.raw`\begin{tikzpicture}
  \draw (A) -- node[midway,below] {$5\,\mathrm{cm}$} (B);
  \draw (B) -- node[pos=.4,right] {$\frac{13}{2}\,\mathrm{m}$} (C);
\end{tikzpicture}`;

  const result = removeStemFigureLengthLabels(source);

  expect(result.removedCount).toBe(2);
  expect(result.source).toContain(String.raw`\draw (A) -- (B);`);
  expect(result.source).toContain(String.raw`\draw (B) -- (C);`);
});

test("preserves angle, speed, area, axis and vector labels", () => {
  const source = String.raw`\begin{tikzpicture}
  \node at (0,0) {$60^\circ$};
  \node at (1,0) {$12\,\mathrm{m/s}$};
  \node at (2,0) {$25\,\mathrm{m}^2$};
  \node at (3,0) {$12$};
  \node at (4,0) {$\vec m$};
  % \node at (5,0) {$99\,\mathrm{m}$};
\end{tikzpicture}`;

  const result = removeStemFigureLengthLabels(source);

  expect(result.removedCount).toBe(0);
  expect(result.source).toBe(source);
});

test("removes symbolic measurements only when the unit is explicit", () => {
  const source = String.raw`\begin{tikzpicture}
  \node at (0,0) {$x+1\,\mathrm{cm}$};
  \node at (1,0) {$r$};
  \node at (2,0) {$m$};
  \node at (3,0) {$x\,\mathrm{m}$};
  \node at (4,0) {$\Delta m$};
\end{tikzpicture}`;

  const result = removeStemFigureLengthLabels(source);

  expect(result.removedCount).toBe(2);
  expect(result.source).toContain(String.raw`\node at (1,0) {$r$};`);
  expect(result.source).toContain(String.raw`\node at (2,0) {$m$};`);
  expect(result.source).toContain(String.raw`\node at (4,0) {$\Delta m$};`);
});

test("removes common angle measurement labels and preserves angle geometry", () => {
  const source = String.raw`\begin{tikzpicture}
  \draw (A) -- (B) -- (C);
  \draw pic[draw] {right angle = A--B--C};
  \draw (A) -- (B) pic[draw, "$75^\circ$", angle radius=8mm] {angle=A--B--C};
  \pic [draw, "$90^\circ$"] {right angle=A--B--C};
  \node at (0,0) {$60^\circ$};
  \node at (1,0) {$90^{\circ}$};
  \node at (2,0) {45°};
  \node at (3,0) {$\ang{30}$};
  \node at (4,0) {$\SI{15}{\degree}$};
\end{tikzpicture}`;

  const result = removeStemFigureAngleMeasurements(source);

  expect(result.removedCount).toBe(7);
  expect(result.source).toContain(String.raw`\draw (A) -- (B) -- (C);`);
  expect(result.source).toContain(String.raw`\draw pic[draw] {right angle = A--B--C};`);
  expect(result.source).toContain(
    String.raw`\draw (A) -- (B) pic[draw, angle radius=8mm] {angle=A--B--C};`,
  );
  expect(result.source).toContain(String.raw`\pic [draw] {right angle=A--B--C};`);
  expect(result.source).not.toContain(String.raw`60^\circ`);
  expect(result.source).not.toContain("45°");
});

test("angle cleanup preserves point, length and temperature labels", () => {
  const source = String.raw`\begin{tikzpicture}
  \node at (0,0) {$A$};
  \node at (1,0) {$12\,\mathrm{cm}$};
  \node at (2,0) {$30^\circ\mathrm{C}$};
  \node at (3,0) {$\angle ABC$};
\end{tikzpicture}`;

  const result = removeStemFigureAngleMeasurements(source);

  expect(result.removedCount).toBe(0);
  expect(result.source).toBe(source);
});

test("numeric cleanup removes only number-only nodes and preserves semantic labels", () => {
  const source = String.raw`\begin{tikzpicture}
  \node at (0,0) {$-3$};
  \node at (1,0) {$\frac{1}{2}$};
  \node at (2,0) {$A$};
  \node at (3,0) {$x=2$};
  \node at (4,0) {$12\,\mathrm{cm}$};
  \node at (5,0) {$90^\circ$};
  \node at (6,0) {$\mathrm{H_2O}$};
\end{tikzpicture}`;

  const result = applyStemFigureQuickAction(source, "REMOVE_NUMERIC_LABELS");

  expect(result.changedCount).toBe(2);
  expect(result.source).not.toContain("{$-3$}");
  expect(result.source).not.toContain(String.raw`{$\frac{1}{2}$}`);
  expect(result.source).toContain("{$A$}");
  expect(result.source).toContain("{$x=2$}");
  expect(result.source).toContain(String.raw`{$12\,\mathrm{cm}$}`);
  expect(result.source).toContain(String.raw`{$90^\circ$}`);
  expect(result.source).toContain(String.raw`{$\mathrm{H_2O}$}`);
});

test("dashed cleanup removes only dashed and dotted path commands", () => {
  const source = String.raw`\begin{tikzpicture}
  \draw (0,0) -- (4,0);
  \draw[dashed, gray] (0,1) -- (4,1);
  \path[densely dotted] (0,2) -- (4,2);
  \draw[blue, dash pattern=on 2pt off 1pt] (0,3) -- (4,3);
  % \draw[dashed] (0,4) -- (4,4);
\end{tikzpicture}`;

  const result = applyStemFigureQuickAction(source, "REMOVE_DASHED_PATHS");

  expect(result.changedCount).toBe(3);
  expect(result.source).toContain(String.raw`\draw (0,0) -- (4,0);`);
  expect(result.source).toContain(String.raw`% \draw[dashed] (0,4) -- (4,4);`);
  expect(result.source).not.toContain("densely dotted");
  expect(result.source).not.toContain("dash pattern=on 2pt off 1pt");
});

test("line weight and display scale actions preserve TikZ geometry and labels", () => {
  const source = String.raw`\begin{tikzpicture}[scale=0.9, line cap=round]
  \draw[thick, blue] (0,0) -- (2,0);
  \filldraw (1,1) circle (2pt);
  \node at (0,0) {$C$};
  % \draw[ultra thick] ignored;
\end{tikzpicture}`;

  const weighted = applyStemFigureQuickAction(source, "SET_LINE_WEIGHT_BOLD");
  expect(weighted.changedCount).toBe(2);
  expect(weighted.source).toContain("[blue, line width=1.2pt]");
  expect(weighted.source).toContain(String.raw`\filldraw[line width=1.2pt]`);
  expect(weighted.source).toContain(String.raw`\node at (0,0) {$C$};`);
  expect(weighted.source).toContain(String.raw`% \draw[ultra thick] ignored;`);

  const scaled = applyStemFigureQuickAction(source, "SCALE_UP");
  expect(scaled.changedCount).toBe(1);
  expect(readStemFigureDisplayScale(scaled.source)).toBe(1.2);
  expect(scaled.source).toContain("% classhero-display-scale: 1.2");
  expect(scaled.source).toContain("[scale=0.9, line cap=round]");
  expect(scaled.source).toContain(String.raw`\node at (0,0) {$C$};`);

  const scaledDown = applyStemFigureQuickAction(scaled.source, "SCALE_DOWN");
  expect(readStemFigureDisplayScale(scaledDown.source)).toBe(0.96);
  expect(scaledDown.source.match(/classhero-display-scale/gu)).toHaveLength(1);
});

test("adjusts main and secondary label font sizes without changing label content", () => {
  const source = String.raw`\begin{tikzpicture}
  \node[above,font=\small\bfseries] at (0,0) {$A$};
  \node at (1,0) {$\mathrm{H_2O}$};
  \draw (0,0) -- node[midway,below] {$5\,\mathrm{cm}$} (2,0);
  \node at (2,1) {$60^\circ$};
  \node at (3,1) {$-2$};
\end{tikzpicture}`;

  const primary = applyStemFigureQuickAction(source, "SET_PRIMARY_LABEL_SIZE_LARGE");
  expect(primary.changedCount).toBe(2);
  expect(primary.source).toContain(String.raw`font=\large\bfseries`);
  expect(primary.source).toContain(
    String.raw`\node[font=\large] at (1,0) {$\mathrm{H_2O}$};`,
  );
  expect(primary.source).toContain(String.raw`{$5\,\mathrm{cm}$}`);

  const secondary = applyStemFigureQuickAction(
    primary.source,
    "SET_SECONDARY_LABEL_SIZE_SMALL",
  );
  expect(secondary.changedCount).toBe(3);
  expect(secondary.source).toContain(
    String.raw`node[midway, below, font=\footnotesize] {$5\,\mathrm{cm}$}`,
  );
  expect(secondary.source).toContain(
    String.raw`\node[font=\footnotesize] at (2,1) {$60^\circ$};`,
  );
  expect(secondary.source).toContain(
    String.raw`\node[font=\footnotesize] at (3,1) {$-2$};`,
  );
  expect(secondary.source).toContain(String.raw`{$\mathrm{H_2O}$}`);
});

test("scales the figure and both label roles from 10 to 200 percent", () => {
  const source = String.raw`\begin{tikzpicture}
  \node[above,font=\small\bfseries] at (0,0) {$A$};
  \node at (1,0) {$\mathrm{H_2O}$};
  \draw (0,0) -- node[midway,below] {$5\,\mathrm{cm}$} (2,0);
  \node at (2,1) {$60^\circ$};
\end{tikzpicture}`;

  const display = setStemFigureScalePercentage(source, "DISPLAY", 200);
  expect(readStemFigureScalePercentage(display.source, "DISPLAY")).toBe(200);
  expect(display.source).toContain("% classhero-display-scale: 2");

  const primary = setStemFigureScalePercentage(display.source, "PRIMARY_LABEL", 150);
  expect(readStemFigureScalePercentage(primary.source, "PRIMARY_LABEL")).toBe(150);
  expect(primary.changedCount).toBe(2);
  expect(primary.source).toContain("% classhero-primary-label-scale: 1.5");
  expect(primary.source).toContain(
    String.raw`font=\fontsize{13.5pt}{16.2pt}\selectfont\bfseries`,
  );
  expect(primary.source).toContain(String.raw`font=\fontsize{15pt}{18pt}\selectfont`);

  const secondary = setStemFigureScalePercentage(primary.source, "SECONDARY_LABEL", 200);
  expect(readStemFigureScalePercentage(secondary.source, "SECONDARY_LABEL")).toBe(200);
  expect(secondary.changedCount).toBe(2);
  expect(secondary.source).toContain("% classhero-secondary-label-scale: 2");
  expect(secondary.source).toContain(String.raw`font=\fontsize{20pt}{24pt}\selectfont`);

  const restored = setStemFigureScalePercentage(secondary.source, "PRIMARY_LABEL", 100);
  expect(readStemFigureScalePercentage(restored.source, "PRIMARY_LABEL")).toBe(100);
  expect(restored.source).toContain(
    String.raw`font=\fontsize{9pt}{10.8pt}\selectfont\bfseries`,
  );

  expect(readStemFigureScalePercentage(source, "DISPLAY")).toBe(100);
  expect(readStemFigureScalePercentage(source, "PRIMARY_LABEL")).toBe(100);
  expect(readStemFigureScalePercentage(source, "SECONDARY_LABEL")).toBe(100);
  expect(
    readStemFigureScalePercentage(
      setStemFigureScalePercentage(source, "DISPLAY", 1).source,
      "DISPLAY",
    ),
  ).toBe(10);
  expect(
    readStemFigureScalePercentage(
      setStemFigureScalePercentage(source, "DISPLAY", 999).source,
      "DISPLAY",
    ),
  ).toBe(200);
});

test("extracts editable text slots in source order and ignores comments and IDs", () => {
  const source = String.raw`\begin{circuitikz}
  \coordinate (A) at (0,0);
  % \node at (0,0) {$IGNORED$};
  \fill (A) circle (1.2pt) node[anchor=west] {$A$};
  \node at (1,0) {$65^\circ$};
  \draw (A) -- node[midway] {Ghi chú} (B)
    pic[draw, "$112^\circ$", angle radius=6mm] {angle=A--B--C};
  \draw (0,0) to[R,l={$R_1$}] (2,0);
\end{circuitikz}`;

  const result = extractStemFigureTextSlots(source);

  expect(result.unsupportedCount).toBe(0);
  expect(result.slots.map(({ kind, value }) => ({ kind, value }))).toEqual([
    { kind: "LABEL", value: "A" },
    { kind: "MEASUREMENT", value: String.raw`65^\circ` },
    { kind: "ANNOTATION", value: "Ghi chú" },
    { kind: "MEASUREMENT", value: String.raw`112^\circ` },
    { kind: "COMPONENT_LABEL", value: "R_1" },
  ]);
  expect(result.slots.map(({ adjustment }) => adjustment)).toEqual([
    { fontSizePercentage: 100, xOffsetPt: 0, yOffsetPt: 0 },
    { fontSizePercentage: 100, xOffsetPt: 0, yOffsetPt: 0 },
    { fontSizePercentage: 100, xOffsetPt: 0, yOffsetPt: 0 },
    null,
    null,
  ]);
});

test("adjusts one node position and font relative to its current style", () => {
  const source = String.raw`\begin{tikzpicture}
  \node[above, xshift=1cm, font=\small\bfseries] at (0,0) {$A$};
  \node at (1,0) {$B$};
\end{tikzpicture}`;

  const applyAdjustment = (
    currentSource: string,
    target: "FONT_SIZE" | "X" | "Y",
    value: number,
  ) => {
    const slot = extractStemFigureTextSlots(currentSource).slots.find(
      ({ value: slotValue }) => slotValue === "A",
    );
    expect(slot).toBeDefined();
    return updateStemFigureTextSlotAdjustment(currentSource, slot!.id, target, value)
      .source;
  };

  let transformed = applyAdjustment(source, "X", 12);
  transformed = applyAdjustment(transformed, "Y", -7);
  transformed = applyAdjustment(transformed, "FONT_SIZE", 150);

  expect(transformed).toContain("xshift=1cm");
  expect(transformed).toContain(
    "classhero text slot adjustment/.style={xshift=+12pt, yshift=-7pt, font=\\fontsize{13.5pt}{16.2pt}\\selectfont}",
  );
  expect(transformed).toContain(String.raw`\node at (1,0) {$B$};`);
  expect(
    extractStemFigureTextSlots(transformed).slots.find(({ value }) => value === "A")
      ?.adjustment,
  ).toEqual({ fontSizePercentage: 150, xOffsetPt: 12, yOffsetPt: -7 });

  transformed = applyAdjustment(transformed, "X", 0);
  transformed = applyAdjustment(transformed, "Y", 0);
  transformed = applyAdjustment(transformed, "FONT_SIZE", 100);
  expect(transformed).toBe(source);
});

test("composes per-label font size with group font size in either order", () => {
  const source = String.raw`\begin{tikzpicture}
  \node[font=\small] at (0,0) {$A$};
  \node at (1,0) {$B$};
\end{tikzpicture}`;
  const adjustLabel = (currentSource: string, percentage: number) => {
    const slot = extractStemFigureTextSlots(currentSource).slots.find(
      ({ value }) => value === "A",
    );
    expect(slot).toBeDefined();
    return updateStemFigureTextSlotAdjustment(
      currentSource,
      slot!.id,
      "FONT_SIZE",
      percentage,
    ).source;
  };

  const labelFirst = adjustLabel(source, 150);
  const thenGroup = setStemFigureScalePercentage(labelFirst, "PRIMARY_LABEL", 120).source;
  expect(
    extractStemFigureTextSlots(thenGroup).slots.find(({ value }) => value === "A")
      ?.adjustment?.fontSizePercentage,
  ).toBe(150);
  expect(thenGroup).toContain(String.raw`\fontsize{10.8pt}{12.96pt}\selectfont`);
  expect(thenGroup).toContain(String.raw`\fontsize{16.2pt}{19.44pt}\selectfont`);

  const groupFirst = setStemFigureScalePercentage(source, "PRIMARY_LABEL", 120).source;
  const thenLabel = adjustLabel(groupFirst, 150);
  expect(
    extractStemFigureTextSlots(thenLabel).slots.find(({ value }) => value === "A")
      ?.adjustment?.fontSizePercentage,
  ).toBe(150);
  expect(thenLabel).toContain(String.raw`\fontsize{16.2pt}{19.44pt}\selectfont`);

  const groupRestored = setStemFigureScalePercentage(
    thenLabel,
    "PRIMARY_LABEL",
    100,
  ).source;
  expect(
    extractStemFigureTextSlots(groupRestored).slots.find(({ value }) => value === "A")
      ?.adjustment?.fontSizePercentage,
  ).toBe(150);
  expect(groupRestored).toContain(String.raw`\fontsize{13.5pt}{16.2pt}\selectfont`);

  const positionOnly = (() => {
    const slot = extractStemFigureTextSlots(source).slots[0];
    expect(slot).toBeDefined();
    return updateStemFigureTextSlotAdjustment(source, slot!.id, "X", 999).source;
  })();
  const positionThenGroup = setStemFigureScalePercentage(
    positionOnly,
    "PRIMARY_LABEL",
    120,
  ).source;
  expect(
    extractStemFigureTextSlots(positionThenGroup).slots.find(({ value }) => value === "A")
      ?.adjustment,
  ).toEqual({ fontSizePercentage: 100, xOffsetPt: 50, yOffsetPt: 0 });
  expect(positionThenGroup).toContain(
    "classhero text slot adjustment/.style={xshift=+50pt}",
  );
  expect(positionThenGroup).not.toContain("}\\fontsize");
});

test("edits duplicate node labels independently and preserves math delimiters", () => {
  const source = String.raw`\begin{tikzpicture}
  \node at (0,0) {$A$};
  \node at (1,0) {$A$};
  \node at (2,0) {$60^\circ$};
\end{tikzpicture}`;
  const slots = extractStemFigureTextSlots(source).slots;

  const firstLabel = slots[0];
  const measurement = slots[2];
  expect(firstLabel).toBeDefined();
  expect(measurement).toBeDefined();

  const renamed = updateStemFigureTextSlot(source, firstLabel!.id, "B");
  expect(renamed.changedCount).toBe(1);
  expect(renamed.source.match(/\{\$A\$\}/gu)).toHaveLength(1);
  expect(renamed.source).toContain("{$B$}");

  const currentMeasurement = extractStemFigureTextSlots(renamed.source).slots.find(
    ({ kind }) => kind === "MEASUREMENT",
  );
  expect(currentMeasurement).toBeDefined();
  const changedMeasurement = updateStemFigureTextSlot(
    renamed.source,
    currentMeasurement!.id,
    String.raw`75^\circ`,
  );
  expect(changedMeasurement.source).toContain(String.raw`{$75^\circ$}`);
});

test("deletes only the selected text clause and preserves owning geometry", () => {
  const source = String.raw`\begin{circuitikz}
  \node at (0,1) {$A$};
  \draw (A) -- node[midway] {$5\,\mathrm{cm}$} (B)
    pic[draw, "$60^\circ$", angle radius=6mm] {angle=A--B--C};
  \draw (0,0) to[R,l={$R$}] (2,0);
\end{circuitikz}`;

  let transformed = source;
  for (const expectedValue of [
    "A",
    String.raw`5\,\mathrm{cm}`,
    String.raw`60^\circ`,
    "R",
  ]) {
    const slot = extractStemFigureTextSlots(transformed).slots.find(
      ({ value }) => value === expectedValue,
    );
    expect(slot, expectedValue).toBeDefined();
    transformed = updateStemFigureTextSlot(transformed, slot!.id, "").source;
  }

  expect(transformed).not.toContain("{$A$}");
  expect(transformed).toContain(String.raw`\draw (A) -- (B)`);
  expect(transformed).toContain(String.raw`pic[draw, angle radius=6mm]`);
  expect(transformed).toContain(String.raw`to[R] (2,0)`);
  expect(transformed).toContain(String.raw`{angle=A--B--C}`);
});

test("reports malformed supported candidates without rewriting them", () => {
  const source = String.raw`\begin{tikzpicture}
  \node[above at (0,0) {$A$};
\end{tikzpicture}`;

  const result = extractStemFigureTextSlots(source);

  expect(result.slots).toEqual([]);
  expect(result.unsupportedCount).toBe(1);
  expect(updateStemFigureTextSlot(source, "NODE:missing", "B").source).toBe(source);
});

test("quick-action regression matrix covers every grade and cross-subject visual family", () => {
  const matrix = createCrossSubjectMatrix();
  const actions: StemFigureQuickAction[] = [
    "REMOVE_LENGTH_LABELS",
    "REMOVE_ANGLE_MEASUREMENTS",
    "REMOVE_NUMERIC_LABELS",
    "REMOVE_DASHED_PATHS",
    "SET_LINE_WEIGHT_THIN",
    "SET_LINE_WEIGHT_NORMAL",
    "SET_LINE_WEIGHT_BOLD",
    "SET_PRIMARY_LABEL_SIZE_SMALL",
    "SET_PRIMARY_LABEL_SIZE_NORMAL",
    "SET_PRIMARY_LABEL_SIZE_LARGE",
    "SET_SECONDARY_LABEL_SIZE_TINY",
    "SET_SECONDARY_LABEL_SIZE_SMALL",
    "SET_SECONDARY_LABEL_SIZE_NORMAL",
    "SCALE_DOWN",
    "SCALE_UP",
  ];

  expect(matrix).toHaveLength(40);
  for (const grade of Array.from({ length: 10 }, (_, index) => index + 3)) {
    for (const subject of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      expect(
        matrix.some((fixture) => fixture.grade === grade && fixture.subject === subject),
      ).toBe(true);
    }
  }

  for (const fixture of matrix) {
    for (const action of actions) {
      const result = applyStemFigureQuickAction(fixture.source, action);
      expect(
        result.source,
        `${fixture.subject} lớp ${fixture.grade}: ${fixture.family} / ${action}`,
      ).toContain(`\\begin{${fixture.environment}}`);
      expect(result.source).toContain(`\\end{${fixture.environment}}`);
      expect(result.source).toContain("% visual-family:");
      expect(result.source).toContain("{$A$}");
      expect(result.source).toContain("{$C$}");
      expect(result.source).toContain("{$H$}");
      expect(result.source).toContain("{$O$}");
    }
  }
});

type MatrixSubject = "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";

const VISUAL_FAMILIES: Record<MatrixSubject, string[]> = {
  MATH: [
    "mô hình đoạn thẳng số học",
    "lưới phân số",
    "biểu đồ cột",
    "tia số và bất phương trình",
    "hình học tam giác",
    "đồ thị tọa độ",
    "hình học đường tròn",
    "bảng dấu và biến thiên",
    "đồ thị hàm số",
    "hình học không gian",
  ],
  PHYSICS: [
    "minh họa quan sát",
    "sơ đồ quá trình",
    "đòn bẩy",
    "vector lực",
    "tia sáng quang học",
    "mạch điện",
    "đồ thị chuyển động",
    "tổng hợp vector",
    "sóng cơ",
    "điện trường",
  ],
  CHEMISTRY: [
    "mô hình hạt",
    "trạng thái vật chất",
    "dung dịch",
    "cấu tạo nguyên tử",
    "mô hình phân tử",
    "sơ đồ phản ứng",
    "dụng cụ thí nghiệm",
    "công thức cấu tạo",
    "giản đồ năng lượng",
    "mạch hữu cơ",
  ],
  GENERAL: [
    "đồng hồ và bảng",
    "bản đồ đơn giản",
    "vòng đời",
    "sơ đồ phân loại",
    "trục thời gian",
    "lưu đồ",
    "biểu đồ so sánh",
    "sơ đồ khối",
    "bảng dữ liệu",
    "đồ thị tổng hợp",
  ],
};

function createCrossSubjectMatrix() {
  return (["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const).flatMap((subject) =>
    VISUAL_FAMILIES[subject].map((family, index) => {
      const grade = index + 3;
      const environment =
        subject === "PHYSICS" && family === "mạch điện" ? "circuitikz" : "tikzpicture";
      return {
        environment,
        family,
        grade,
        source: createRepresentativeSource(subject, family, environment),
        subject,
      };
    }),
  );
}

function createRepresentativeSource(
  subject: MatrixSubject,
  family: string,
  environment: "circuitikz" | "tikzpicture",
) {
  const subjectPath =
    subject === "PHYSICS" && family === "mạch điện"
      ? String.raw`\draw (0,0) to[R] (2,0) to[battery] (2,2) -- (0,2) -- cycle;`
      : subject === "CHEMISTRY"
        ? String.raw`\draw (0,0) -- (1,0) -- (2,0);`
        : subject === "MATH" && /đồ thị|tia số|bảng dấu/u.test(family)
          ? String.raw`\draw[->] (-2,0) -- (3,0); \draw[->] (0,-2) -- (0,3);`
          : String.raw`\draw (0,0) -- (4,0) -- (2,2.5) -- cycle;`;

  return String.raw`\begin{${environment}}[scale=0.9, line cap=round]
  % visual-family: ${subject} / ${family}
  ${subjectPath}
  \draw[dashed, gray] (0,1) -- (3,1);
  \node at (0,0) {$A$};
  \node at (1,0) {$C$};
  \node at (2,0) {$H$};
  \node at (3,0) {$O$};
  \node at (1,1) {$-3$};
  \node at (2,1) {$5\,\mathrm{cm}$};
  \node at (3,1) {$60^\circ$};
\end{${environment}}`;
}
