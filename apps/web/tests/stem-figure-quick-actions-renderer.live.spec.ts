import { expect, test } from "@playwright/test";

import {
  applyStemFigureQuickAction,
  extractStemFigureTextSlots,
  type StemFigureQuickAction,
  updateStemFigureTextSlot,
} from "@/lib/stem-figure-source-actions";

const runLiveRenderer = process.env.RUN_TEX_QUICK_ACTION_LIVE_TESTS === "1";
const rendererUrl = process.env.TEX_RENDERER_URL ?? "http://127.0.0.1:8080";
const rendererToken = process.env.TEX_RENDERER_TOKEN ?? "local-tex-renderer-token";

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

const liveCases = [
  {
    label: "Toán hình học",
    replacementText: "P",
    subjectKey: "MATH",
    source: String.raw`\begin{tikzpicture}[scale=0.9,line cap=round,line join=round]
  \coordinate (A) at (0,0); \coordinate (B) at (4,0); \coordinate (C) at (1.2,2.4);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \draw[dashed] (C) -- (1.2,0);
  \node[below] at (A) {$A$}; \node[below] at (B) {$B$}; \node[above] at (C) {$C$};
  \node[below] at (2,0) {$5\,\mathrm{cm}$}; \node at (1.2,.45) {$60^\circ$};
\end{tikzpicture}`,
  },
  {
    label: "Toán đại số và đồ thị",
    replacementText: "u",
    subjectKey: "MATH",
    source: String.raw`\begin{tikzpicture}[scale=0.8]
  \draw[->] (-3,0) -- (3,0) node[right] {$x$};
  \draw[->] (0,-2) -- (0,3) node[above] {$y$};
  \draw[thick,blue,domain=-2:2,samples=40] plot (\x,{0.5*\x*\x});
  \draw[dashed,gray] (2,0) -- (2,2);
  \node[below] at (-2,0) {$-2$}; \node[left] at (0,2) {$2$};
\end{tikzpicture}`,
  },
  {
    label: "Vật lý mạch điện và vector",
    replacementText: "R_1",
    subjectKey: "PHYSICS",
    source: String.raw`\begin{circuitikz}[scale=0.9]
  \draw (0,0) to[battery] (0,2) to[R,l={$R$}] (3,2) -- (3,0) -- (0,0);
  \draw[->,thick] (3.4,.3) -- (3.4,1.7) node[right] {$I$};
  \draw[dashed] (0,-.4) -- (3,-.4);
  \node at (1.5,-.7) {$12\,\mathrm{cm}$};
\end{circuitikz}`,
  },
  {
    label: "Hóa học cấu tạo và phản ứng",
    replacementText: "N",
    subjectKey: "CHEMISTRY",
    source: String.raw`\begin{tikzpicture}[scale=0.9]
  \node (H1) at (0,0) {$H$}; \node (O) at (1.2,0) {$O$}; \node (H2) at (2.4,0) {$H$};
  \draw[thick] (H1) -- (O) -- (H2);
  \node (C) at (4,0) {$C$}; \node at (5,0) {$O_2$};
  \draw[->] (3.1,0) -- (3.7,0);
  \draw[dotted,gray] (0,-.5) -- (5,-.5);
  \node at (2.5,-.8) {$3$};
\end{tikzpicture}`,
  },
  {
    label: "Sơ đồ tổng quát",
    replacementText: "Bước mới",
    subjectKey: "GENERAL",
    source: String.raw`\begin{tikzpicture}[scale=0.85]
  \node[draw,rounded corners] (A) at (0,0) {Bước 1};
  \node[draw,rounded corners] (B) at (3,0) {Bước 2};
  \draw[->,thick] (A) -- (B);
  \draw[dashed] (0,-1) -- (3,-1);
  \node at (1.5,-1.35) {$90^\circ$};
\end{tikzpicture}`,
  },
] as const;

test.describe("M9.23 real TeX renderer", () => {
  test.skip(
    !runLiveRenderer,
    "Set RUN_TEX_QUICK_ACTION_LIVE_TESTS=1 to use the local renderer.",
  );
  test.setTimeout(120_000);

  test("compiles every quick action for representative cross-subject figures", async ({
    request,
  }) => {
    let renderCount = 0;
    for (const liveCase of liveCases) {
      for (const action of actions) {
        const transformed = applyStemFigureQuickAction(liveCase.source, action);
        const response = await request.post(`${rendererUrl}/render`, {
          data: {
            latexSource: transformed.source,
            subjectKey: liveCase.subjectKey,
          },
          headers: { authorization: `Bearer ${rendererToken}` },
        });
        const body = (await response.json()) as {
          code?: string;
          log?: string;
          ok?: boolean;
        };
        expect(
          body.ok,
          `${liveCase.label} / ${action}: ${body.code ?? "UNKNOWN"}\n${body.log ?? ""}`,
        ).toBe(true);
        renderCount += 1;
      }
    }
    expect(renderCount).toBe(75);
  });

  test("compiles individual text edits and deletions across visual families", async ({
    request,
  }) => {
    let renderCount = 0;
    for (const liveCase of liveCases) {
      const slots = extractStemFigureTextSlots(liveCase.source).slots;
      const firstSlot = slots[0];
      const lastSlot = slots.at(-1);
      expect(firstSlot, `${liveCase.label}: first text slot`).toBeDefined();
      expect(lastSlot, `${liveCase.label}: last text slot`).toBeDefined();

      const variants = [
        updateStemFigureTextSlot(
          liveCase.source,
          firstSlot!.id,
          liveCase.replacementText,
        ).source,
        updateStemFigureTextSlot(liveCase.source, lastSlot!.id, "").source,
      ];
      for (const latexSource of variants) {
        const response = await request.post(`${rendererUrl}/render`, {
          data: { latexSource, subjectKey: liveCase.subjectKey },
          headers: { authorization: `Bearer ${rendererToken}` },
        });
        const body = (await response.json()) as {
          code?: string;
          log?: string;
          ok?: boolean;
        };
        expect(
          body.ok,
          `${liveCase.label}: ${body.code ?? "UNKNOWN"}\n${body.log ?? ""}`,
        ).toBe(true);
        renderCount += 1;
      }
    }
    expect(renderCount).toBe(10);
  });
});
