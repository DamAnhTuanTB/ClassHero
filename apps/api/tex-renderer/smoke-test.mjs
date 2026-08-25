import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.TEX_RENDERER_TOKEN ?? "";
const endpoint = process.env.TEX_RENDERER_SMOKE_URL ?? "http://127.0.0.1:8080/render";
const outputDirectory = process.env.TEX_RENDERER_SMOKE_OUTPUT_DIR ?? null;

const cases = [
  {
    name: "gem-style-math-fragment",
    subjectKey: "MATH",
    source: String.raw`\usetikzlibrary{calc,angles,quotes}
\tikzset{mypoint/.style={circle,fill=black,inner sep=1.2pt}}
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (3,0);
  \coordinate (C) at (1,2);
  \draw (A)--(B)--(C)--cycle;
  \node[mypoint] at ($(A)!0.5!(B)$) {};
  \pic[draw,"$45^\circ$"] {angle=B--A--C};
  \node[right=2pt] at (C) {$C$};
\end{tikzpicture}`,
  },
  {
    name: "math-local-relation-markers",
    subjectKey: "MATH",
    source: String.raw`\usetikzlibrary{angles,calc,decorations.markings,quotes}
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (M) at (2,0);
  \coordinate (B) at (4,0);
  \coordinate (P) at (2,2);
  \draw (A)--(B);
  \draw[dashed] (M)--(P);
  \pic[draw,angle radius=4mm] {right angle=A--M--P};
  \draw[postaction={decorate},decoration={markings,mark=at position 0.5 with {\draw (0,-2pt)--(0,2pt);}}] (A)--(M);
  \draw[postaction={decorate},decoration={markings,mark=at position 0.5 with {\draw (0,-2pt)--(0,2pt);}}] (M)--(B);
\end{tikzpicture}`,
  },
  {
    name: "user-gem-cosine-fragment",
    subjectKey: "MATH",
    source: String.raw`\begin{tikzpicture}[scale=0.85, >=stealth]
  \draw[->] (-7.2,0) -- (7.2,0) node[below] {$x$};
  \draw[->] (0,-1.6) -- (0,1.6) node[right] {$y$};
  \node[below left] at (0,0) {$O$};
  \draw[thick, red, samples=200, domain={-2*pi}:{2*pi}]
    plot (\x, {cos(\x r)});
  \draw[dashed] (0,1) node[above left] {$1$} -- (6.28,1);
  \draw[dashed] (0,-1) node[left] {$-1$} -- (3.14,-1);
  \draw[dashed] (-3.14,-1) -- (-3.14,0);
  \draw[dashed] (3.14,-1) -- (3.14,0);
  \draw[dashed] (6.28,1) -- (6.28,0);
  \draw[dashed] (-6.28,1) -- (-6.28,0);
  \node[below, scale=0.8] at (1.57,0) {$\dfrac{\pi}{2}$};
  \node[above, scale=0.8] at (3.14,0) {$\pi$};
  \node[below right, scale=0.8] at (4.71,0) {$\dfrac{3\pi}{2}$};
  \node[below, scale=0.8] at (6.28,0) {$2\pi$};
  \node[below, scale=0.8] at (-1.57,0) {$-\dfrac{\pi}{2}$};
  \node[above, scale=0.8] at (-3.14,0) {$-\pi$};
  \node[below left, scale=0.8] at (-4.71,0) {$-\dfrac{3\pi}{2}$};
  \node[below, scale=0.8] at (-6.28,0) {$-2\pi$};
\end{tikzpicture}`,
  },
  {
    name: "user-gem-sine-fragment",
    subjectKey: "MATH",
    source: String.raw`\begin{tikzpicture}[scale=0.8,>=stealth]
  \draw[->] (-7,0) -- (7,0) node[below] {$x$};
  \draw[->] (0,-1.8) -- (0,1.8) node[right] {$y$};
  \node[above left] at (0,0) {$O$};
  \draw[thick, blue, samples=200, domain={-2*pi}:{2*pi}]
    plot (\x, {sin(\x r)});
  \draw[dashed] (1.57,0) -- (1.57,1) -- (0,1) node[left] {$1$};
  \draw[dashed] (-1.57,0) -- (-1.57,-1) -- (0,-1) node[right] {$-1$};
  \draw[dashed] (4.71,0) -- (4.71,-1);
  \draw[dashed] (-4.71,0) -- (-4.71,1);
  \node[below, scale=0.8] at (1.57,0) {$\dfrac{\pi}{2}$};
  \node[above right, scale=0.8] at (3.14,0) {$\pi$};
  \node[above, scale=0.8] at (4.71,0) {$\dfrac{3\pi}{2}$};
  \node[above, scale=0.8] at (6.28,0) {$2\pi$};
  \node[above, scale=0.8] at (-1.57,0) {$-\dfrac{\pi}{2}$};
  \node[below left, scale=0.8] at (-3.14,0) {$-\pi$};
  \node[below, scale=0.8] at (-4.71,0) {$-\dfrac{3\pi}{2}$};
  \node[below, scale=0.8] at (-6.28,0) {$-2\pi$};
\end{tikzpicture}`,
  },
  {
    name: "grade-3-tikz",
    subjectKey: "GENERAL",
    source: String.raw`\begin{tikzpicture}
  \draw[very thick] (0,0) rectangle (4,1);
  \foreach \x in {1,2,3} \draw (\x,0)--(\x,1);
  \fill[blue!30] (0,0) rectangle (3,1);
  \node[below] at (2,-.15) {Phân số $\frac{3}{4}$};
\end{tikzpicture}`,
  },
  {
    name: "grade-9-tkz-euclide",
    subjectKey: "MATH",
    source: String.raw`\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,1/3/C}
  \tkzDrawPolygon[thick](A,B,C)
  \tkzDrawPoints(A,B,C)
  \tkzLabelPoints[below](A,B)
  \tkzLabelPoints[above](C)
\end{tikzpicture}`,
  },
  {
    name: "grade-12-pgfplots-3d",
    subjectKey: "MATH",
    source: String.raw`\usepgfplotslibrary{fillbetween}
\pgfplotsset{lesson axis/.style={axis lines=middle}}
\begin{tikzpicture}
  \begin{axis}[lesson axis,domain=-2:2,samples=41,width=8cm,height=6cm]
    \addplot[blue,thick] {x^2-1};
  \end{axis}
\end{tikzpicture}`,
  },
  {
    name: "physics-circuitikz",
    subjectKey: "PHYSICS",
    source: String.raw`\begin{circuitikz}
  \draw (0,0) to[battery1,l=$U$] (0,2) to[R,l=$R$] (3,2) -- (3,0) -- (0,0);
\end{circuitikz}`,
  },
  {
    name: "chemistry-chemfig-mhchem",
    subjectKey: "CHEMISTRY",
    source: String.raw`\begin{tikzpicture}
  \node[anchor=west] at (0,1) {\chemfig{H-O-H}};
  \node[anchor=west] at (0,0) {$\ce{2H2 + O2 -> 2H2O}$};
\end{tikzpicture}`,
  },
];

for (const smokeCase of cases) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      latexSource: smokeCase.source,
      subjectKey: smokeCase.subjectKey ?? "GENERAL",
    }),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true || !result.svg?.includes("<svg")) {
    throw new Error(`${smokeCase.name} failed: ${JSON.stringify(result)}`);
  }
  if (/viewBox=['"]0 -792 612 792['"]/u.test(result.svg)) {
    throw new Error(
      `${smokeCase.name} failed: renderer returned an uncropped Letter page`,
    );
  }
  if (/Font names database not found, generating new one/iu.test(result.log ?? "")) {
    throw new Error(`${smokeCase.name} failed: LuaTeX font cache was rebuilt at runtime`);
  }
  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, `${smokeCase.name}.svg`), result.svg);
  }
  process.stdout.write(`${smokeCase.name}: ok (${result.durationMs}ms)\n`);
}

const multiErrorSource = String.raw`\begin{tikzpicture}
  \undefinedcommandone
  \draw (0,0) -- (1,1);
  \undefinedcommandtwo
\end{tikzpicture}`;
const failureResponse = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ latexSource: multiErrorSource }),
});
const failure = await failureResponse.json();
if (
  failureResponse.status !== 422 ||
  failure.ok !== false ||
  failure.category !== "SOURCE" ||
  failure.collectionComplete !== true ||
  !Array.isArray(failure.issues) ||
  failure.issues.length < 2
) {
  throw new Error(`multi-error diagnostic collection failed: ${JSON.stringify(failure)}`);
}
process.stdout.write(
  `multi-error-compiler: ok (${failure.issues.length} issues in one complete batch)\n`,
);

const burstSource = String.raw`\begin{tikzpicture}
  \draw (0,0) circle (1);
\end{tikzpicture}`;
const burstResults = await Promise.all(
  Array.from({ length: 6 }, async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ latexSource: burstSource, subjectKey: "MATH" }),
    });
    return { response, result: await response.json() };
  }),
);
for (const { response, result } of burstResults) {
  if (!response.ok || result.ok !== true || !result.svg?.includes("<svg")) {
    throw new Error(`concurrent render burst failed: ${JSON.stringify(result)}`);
  }
  if (/Font names database not found, generating new one/iu.test(result.log ?? "")) {
    throw new Error("concurrent render burst rebuilt the LuaTeX font cache at runtime");
  }
}
process.stdout.write(`concurrent-render-burst: ok (${burstResults.length} requests)\n`);

const standaloneResponse = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    subjectKey: "MATH",
    latexSource: String.raw`\documentclass{standalone}\begin{document}\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}\end{document}`,
  }),
});
const standaloneFailure = await standaloneResponse.json();
if (
  standaloneResponse.status !== 422 ||
  standaloneFailure.code !== "TEX_SOURCE_POLICY_REJECTED" ||
  !standaloneFailure.issues?.some(
    (item) => item.code === "TEX_DOCUMENT_DECLARATION_FORBIDDEN",
  )
) {
  throw new Error(`standalone rejection failed: ${JSON.stringify(standaloneFailure)}`);
}
process.stdout.write("standalone-source-policy: ok\n");
