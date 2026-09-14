import { expect, test } from "@playwright/test";
import katex from "katex";
import "katex/contrib/mhchem";
import { MathpixMarkdownModel } from "mathpix-markdown-it";

import {
  LEARNING_CONTENT_KATEX_MACROS,
  normalizeLearningContentLatex,
  normalizeLearningContentLatexCommandEscapes,
  normalizeLearningContentMathMarkdown,
  normalizeMathpixMarkdown,
} from "@/lib/learning-content-math";

const LATEX_COMMAND_NAMES_THAT_MUST_NOT_TOUCH_PROSE = [
  "text",
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathbb",
  "mathcal",
  "operatorname",
  "ce",
  "pu",
  "begin",
  "end",
  "frac",
  "dfrac",
  "tfrac",
  "sqrt",
  "overline",
  "underline",
  "overbrace",
  "underbrace",
  "widehat",
  "widetilde",
  "hat",
  "tilde",
  "bar",
  "vec",
  "dot",
  "ddot",
  "overrightarrow",
  "overleftarrow",
  "circ",
  "pi",
  "theta",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "lambda",
  "mu",
  "rho",
  "sigma",
  "phi",
  "varphi",
  "omega",
  "infty",
  "pm",
  "mp",
  "times",
  "div",
  "cdot",
  "le",
  "leq",
  "ge",
  "geq",
  "ne",
  "neq",
  "approx",
  "sim",
  "cong",
  "equiv",
  "parallel",
  "perp",
  "in",
  "notin",
  "subset",
  "subseteq",
  "supset",
  "supseteq",
  "cup",
  "cap",
  "sum",
  "prod",
  "int",
  "lim",
  "sin",
  "cos",
  "tan",
  "cot",
  "log",
  "ln",
  "angle",
  "triangle",
  "left",
  "right",
  "quad",
  "qquad",
] as const;

test("normalizes and renders supported Math, Chemistry, and Physics commands", () => {
  const samples = [
    { input: String.raw`frac{1}{2}`, expected: String.raw`\dfrac{1}{2}` },
    {
      input: String.raw`ce{2H2 + O2 -> 2H2O}`,
      expected: String.raw`\ce{2H2 + O2 -> 2H2O}`,
    },
    { input: String.raw`pu{9.81 m//s2}`, expected: String.raw`\pu{9.81 m//s2}` },
    { input: String.raw`\\vec{F}`, expected: String.raw`\vec{F}` },
    { input: String.raw`\\ce{SO4^2-}`, expected: String.raw`\ce{SO4^2-}` },
    { input: String.raw`\\pu{kg.m.s-2}`, expected: String.raw`\pu{kg.m.s-2}` },
  ];

  for (const sample of samples) {
    const normalized = normalizeLearningContentLatex(sample.input);
    expect(normalized).toBe(sample.expected);
    const html = katex.renderToString(normalized, {
      strict: false,
      throwOnError: false,
    });
    expect(html).not.toContain('mathcolor="#cc0000"');
  }
});

test("renders wide arc notation from AI-authored learning content", () => {
  const latex = String.raw`\operatorname{sd}\wideparen{BCD}+\operatorname{sd}\overparen{BAD}=360^\circ`;
  const html = katex.renderToString(normalizeLearningContentLatex(latex), {
    macros: LEARNING_CONTENT_KATEX_MACROS,
    strict: false,
    throwOnError: false,
  });

  expect(html).not.toContain('mathcolor="#cc0000"');
  expect(html).toContain("⌢");
  expect(html).toContain("BCD");
  expect(html).toContain("BAD");
});

test("không biến từ trùng tên lệnh LaTeX trong văn xuôi thành công thức", () => {
  const prose =
    "Khi kim loại kết hợp với phi kim tạo thành muối, chất tan trong nước và nội dung được in đậm trong log dữ liệu.";

  expect(normalizeMathpixMarkdown(prose)).toBe(prose);

  const commandLikeProse = LATEX_COMMAND_NAMES_THAT_MUST_NOT_TOUCH_PROSE.map(
    (word) => `trước ${word} sau`,
  ).join("; ");
  expect(normalizeMathpixMarkdown(commandLikeProse)).toBe(commandLikeProse);

  const commandLikeTextWithArguments = LATEX_COMMAND_NAMES_THAT_MUST_NOT_TOUCH_PROSE.map(
    (word) => `${word}{mẫu}`,
  ).join("; ");
  expect(normalizeMathpixMarkdown(commandLikeTextWithArguments)).toBe(
    commandLikeTextWithArguments,
  );

  const unicodeProse = "muối, muốn, mu\u0301, phi kim, hòa tan, in ấn";
  expect(normalizeMathpixMarkdown(unicodeProse)).toBe(unicodeProse);

  const escapedOrUnclosedProse = String.raw`Giá \$5; chuỗi \\phi; delimiter chưa đóng $phi kim`;
  expect(normalizeMathpixMarkdown(escapedOrUnclosedProse)).toBe(escapedOrUnclosedProse);

  const decodedEscapeCases = [
    [`${String.fromCharCode(9)}riangle`, String.raw`\triangle`],
    [`${String.fromCharCode(12)}rac{1}{2}`, String.raw`\dfrac{1}{2}`],
    [`${String.fromCharCode(8)}eta`, String.raw`\beta`],
    [`${String.fromCharCode(13)}ight`, String.raw`\right`],
    [`${String.fromCharCode(28)}hat{ABC}`, String.raw`\widehat{ABC}`],
    [`${String.fromCharCode(28)}widehat{ABC}`, String.raw`\widehat{ABC}`],
    [`${String.fromCharCode(28)}root{61}`, String.raw`\sqrt{61}`],
    [`${String.fromCharCode(28)}frac{1}{2}`, String.raw`\dfrac{1}{2}`],
    [String.raw`\u001cwidehat{ABC}`, String.raw`\widehat{ABC}`],
    [String.raw`u001croot{61}`, String.raw`\sqrt{61}`],
    [String.raw`u001calpha`, String.raw`\alpha`],
    [`${String.fromCharCode(27)}0`, String.raw`\circ`],
  ] as const;
  for (const [decoded, repaired] of decodedEscapeCases) {
    expect(normalizeMathpixMarkdown(`trước ${decoded} sau`)).toBe(`trước ${decoded} sau`);
    expect(normalizeMathpixMarkdown(`trước $${decoded}$ sau`)).toBe(
      `trước $${repaired}$ sau`,
    );
  }

  expect(
    normalizeMathpixMarkdown(String.raw`Phi kim có biểu thức $phi=frac{1}{2}$.`),
  ).toBe(String.raw`Phi kim có biểu thức $\phi=\dfrac{1}{2}$.`);
  expect(
    normalizeMathpixMarkdown(String.raw`$phi$; $$frac{1}{2}$$; \(theta\); \[ce{NaCl}\]`),
  ).toBe(String.raw`$\phi$; $$\dfrac{1}{2}$$; \(\theta\); \[\ce{NaCl}\]`);

  const renderedProse = MathpixMarkdownModel.markdownToHTML(
    normalizeMathpixMarkdown(prose),
    { htmlTags: true },
  );
  expect(renderedProse).toContain("phi kim tạo thành muối");
  expect(renderedProse).toContain("chất tan trong nước");
  expect(renderedProse).not.toContain("\\phi");
  expect(renderedProse).not.toContain("\\mu");
  expect(renderedProse).not.toContain("\\tan");
});

test("renders Mathpix itemize commands as readable Markdown lists", () => {
  const content = String.raw`\section*{BÀI TẬP}
\begin{itemize}
\item[9.18.] Cho \(A B C D\) là tứ giác nội tiếp.
a) \(\widehat{A}=60^\circ\);
\item[9.19.] Chứng minh hai góc bằng nhau.
\end{itemize}`;

  const normalized = normalizeMathpixMarkdown(content);
  const html = MathpixMarkdownModel.markdownToHTML(normalized, { htmlTags: true });

  expect(normalized).toContain("- **9.18.** Cho");
  expect(normalized).toContain("  a) ");
  expect(normalized).not.toContain("\\begin{itemize}");
  expect(normalized).not.toContain("\\item[");
  expect(normalized).not.toContain("\\end{itemize}");
  expect(html).toContain("<ul>");
  expect(html).toContain("<li>");
  expect(html).toContain("9.18.");
  expect(html).not.toContain("\\begin{itemize}");
  expect(html).not.toContain("\\item[");
});

test("preserves LaTeX list examples inside fenced code", () => {
  const content = [
    "```latex",
    String.raw`\begin{itemize}`,
    String.raw`\item[1.] Ví dụ`,
    String.raw`\end{itemize}`,
    "```",
  ].join("\n");

  expect(normalizeMathpixMarkdown(content)).toBe(content);
});

test("leaves an unbalanced Mathpix list unchanged", () => {
  const content = String.raw`\begin{itemize}
\item[1.] Ví dụ chưa có lệnh đóng`;

  expect(normalizeMathpixMarkdown(content)).toBe(content);
});

test("loại khoảng trắng sát delimiter để Mathpix nhận đúng inline math", () => {
  const malformed = String.raw`Vì $ a\cdot(-4)^2=a\cdot4^2=-7 $.`;
  const normalized = normalizeMathpixMarkdown(malformed);

  expect(normalized).toBe(String.raw`Vì $a\cdot(-4)^2=a\cdot4^2=-7$.`);

  const html = MathpixMarkdownModel.markdownToHTML(normalized, {
    htmlTags: true,
    outMath: {
      include_latex: true,
      include_svg: false,
      output_format: "latex",
    },
  });
  expect(html).toContain('class="math-inline');
  expect(html).not.toContain(String.raw`$ a\cdot`);

  expect(
    normalizeMathpixMarkdown(String.raw`Trước $ x $ sau; $$ y $$; \( z \); \[ t \]`),
  ).toBe(String.raw`Trước $x$ sau; $$y$$; \(z\); \[t\]`);
  expect(normalizeMathpixMarkdown(String.raw`Giữ $\text{ a }$ nguyên vẹn.`)).toBe(
    String.raw`Giữ $\text{ a }$ nguyên vẹn.`,
  );
  expect(normalizeMathpixMarkdown(String.raw`Giữ $a\ $ nguyên vẹn.`)).toBe(
    String.raw`Giữ $a\ $ nguyên vẹn.`,
  );
});

test("renders multiline display math with a standalone relation sign as math", () => {
  const content = String.raw`Các tính chất:

$$
\int kf(x)\,\mathrm{d}x
=
k\int f(x)\,\mathrm{d}x
\quad (k\ne 0),
$$

Và hàm lũy thừa:

$$
\int x^\alpha\,\mathrm{d}x
=
\frac{x^{\alpha+1}}{\alpha+1}+C
\quad (\alpha\ne -1).
$$`;

  const normalized = normalizeMathpixMarkdown(content);
  expect(normalized).toContain(
    String.raw`$$\int kf(x)\,\mathrm{d}x = k\int f(x)\,\mathrm{d}x \quad (k\ne 0),$$`,
  );
  expect(normalized).toContain(
    String.raw`$$\int x^\alpha\,\mathrm{d}x = \dfrac{x^{\alpha+1}}{\alpha+1}+C \quad (\alpha\ne -1).$$`,
  );
  expect(normalizeMathpixMarkdown(normalized)).toBe(normalized);

  const html = MathpixMarkdownModel.markdownToHTML(normalized, {
    htmlTags: true,
    outMath: {
      include_latex: true,
      include_svg: false,
      output_format: "latex",
    },
  });
  expect(html.match(/class="math-block/gu)).toHaveLength(2);
  expect(html).not.toContain("<h1");
  expect(html).not.toContain("<h2");
});

test("tự đóng inline math khi model để công thức tràn sang văn xuôi", () => {
  const malformed = String.raw`Cao $8\,\text{m}. Hai điểm thuộc cung. Lấy $\pi\approx3{,}14$.`;
  const repaired = String.raw`Cao $8\,\text{m}$. Hai điểm thuộc cung. Lấy $\pi\approx3{,}14$.`;

  expect(normalizeMathpixMarkdown(malformed)).toBe(repaired);
  expect(normalizeMathpixMarkdown(repaired)).toBe(repaired);
});

const LEADING_LOGICAL_RELATION_OPERATORS = [
  "Rightarrow",
  "Leftarrow",
  "Leftrightarrow",
  "Longrightarrow",
  "Longleftarrow",
  "Longleftrightarrow",
  "implies",
  "impliedby",
  "iff",
] as const;

test("đưa delimiter đóng display math ra sau môi trường aligned", () => {
  const malformed = String.raw`$$\begin{aligned}S&=1\\&=2.$$\end{aligned}$$`;

  expect(normalizeLearningContentMathMarkdown(malformed)).toBe(
    String.raw`$$\begin{aligned}S&=1\\&=2.\end{aligned}$$`,
  );
});

test("sửa các môi trường display math phổ biến và giữ nội dung hợp lệ", () => {
  const environmentNames = [
    "aligned",
    "alignedat",
    "array",
    "cases",
    "gather",
    "gathered",
    "matrix",
    "pmatrix",
    "bmatrix",
    "Bmatrix",
    "vmatrix",
    "Vmatrix",
    "split",
  ];

  for (const environmentName of environmentNames) {
    const malformed = `$$\\begin{${environmentName}}x=1$$\\end{${environmentName}}$$`;
    expect(normalizeLearningContentMathMarkdown(malformed)).toBe(
      `$$\\begin{${environmentName}}x=1\\end{${environmentName}}$$`,
    );
  }

  const valid = String.raw`$$\begin{aligned}x&=1\\y&=2\end{aligned}$$`;
  expect(normalizeLearningContentMathMarkdown(valid)).toBe(valid);
  expect(normalizeLearningContentMathMarkdown(valid)).toBe(
    normalizeLearningContentMathMarkdown(normalizeLearningContentMathMarkdown(valid)),
  );
});

test("đưa toán tử suy luận hoặc tương đương ra khỏi cột dấu bằng", () => {
  for (const operator of LEADING_LOGICAL_RELATION_OPERATORS) {
    const malformed = `$$\\begin{aligned}x&=1\\\\&\\${operator} a = 2x\\end{aligned}$$`;
    expect(normalizeLearningContentMathMarkdown(malformed)).toBe(
      `$$\\begin{aligned}x&=1\\\\\\${operator}\\quad a &= 2x\\end{aligned}$$`,
    );
  }
});

test("sửa dòng suy ra không có dấu bằng và giữ các dòng căn đúng", () => {
  const valid = String.raw`$$\begin{aligned}x&=1\\\Rightarrow\quad y&=2\end{aligned}$$`;

  for (const operator of LEADING_LOGICAL_RELATION_OPERATORS) {
    const malformed = `$$\\begin{aligned}x&>0\\\\&\\${operator} P\\end{aligned}$$`;
    expect(normalizeLearningContentMathMarkdown(malformed)).toBe(
      `$$\\begin{aligned}x&>0\\\\\\${operator} P\\end{aligned}$$`,
    );
  }

  expect(normalizeLearningContentMathMarkdown(valid)).toBe(valid);
  expect(normalizeLearningContentMathMarkdown(valid)).toBe(
    normalizeLearningContentMathMarkdown(normalizeLearningContentMathMarkdown(valid)),
  );
});

test("không đổi các mũi tên biểu diễn ánh xạ hoặc chuyển trạng thái", () => {
  for (const operator of ["to", "mapsto"]) {
    const content = `$$\\begin{aligned}x&=1\\\\&\\${operator} y\\end{aligned}$$`;
    expect(normalizeLearningContentMathMarkdown(content)).toBe(content);
  }
});

test("không sửa dấu phân cột hợp lệ trong môi trường array", () => {
  const content = String.raw`$$\begin{array}{cc}P&\Leftrightarrow Q\end{array}$$`;
  expect(normalizeLearningContentMathMarkdown(content)).toBe(content);
});

test("giữ xuống dòng aligned khi dòng kế tiếp bắt đầu bằng lệnh LaTeX", () => {
  const content = String.raw`\begin{aligned}\widehat{A}+\widehat{C}&=180^\circ\\\widehat{C}&=112^\circ\\&=68^\circ\end{aligned}`;

  expect(normalizeLearningContentLatexCommandEscapes(content)).toBe(content);
});

test("tự đóng môi trường LaTeX còn thiếu trước khi render nội dung học sinh cũ", () => {
  const malformed = String.raw`\begin{aligned}\widehat{C}&=180^\circ-\widehat{A}\\&=120^\circ,`;
  const repaired = String.raw`\begin{aligned}\widehat{C}&=180^\circ-\widehat{A}\\&=120^\circ,\end{aligned}`;

  expect(normalizeLearningContentLatex(malformed)).toBe(repaired);
  expect(normalizeLearningContentLatex(repaired)).toBe(repaired);
  expect(normalizeLearningContentLatex(String.raw`x^2+y^2`)).toBe(String.raw`x^2+y^2`);

  const html = katex.renderToString(normalizeLearningContentLatex(malformed), {
    displayMode: true,
    strict: false,
    throwOnError: false,
  });
  expect(html).not.toContain('mathcolor="#cc0000"');
});

test("chỉ bỏ slash escape dư và không nuốt row separator đứng trước lệnh", () => {
  expect(normalizeLearningContentLatexCommandEscapes(String.raw`\\widehat{C}`)).toBe(
    String.raw`\widehat{C}`,
  );
  expect(normalizeLearningContentLatexCommandEscapes(String.raw`\\\\widehat{C}`)).toBe(
    String.raw`\\\widehat{C}`,
  );
  expect(normalizeLearningContentLatexCommandEscapes(String.raw`\\qquad`)).toBe(
    String.raw`\qquad`,
  );

  const rowBeforeAlignmentMarker = String.raw`x&=1\\&=2`;
  expect(normalizeLearningContentLatexCommandEscapes(rowBeforeAlignmentMarker)).toBe(
    rowBeforeAlignmentMarker,
  );
});

test("sửa lệnh giãn cách bị JSON double-escape trong lời giải", () => {
  const malformed = String.raw`Vì các bán kính bằng nhau:

$$OA=OB,\\qquad OB=OC,\\qquad OC=OD,\\qquad OD=OA.$$`;
  const repaired = String.raw`Vì các bán kính bằng nhau:

$$OA=OB,\qquad OB=OC,\qquad OC=OD,\qquad OD=OA.$$`;

  expect(normalizeMathpixMarkdown(malformed)).toBe(repaired);
  expect(normalizeMathpixMarkdown(repaired)).toBe(repaired);
});

test("pipeline Mathpix giữ đủ ba dòng của các lời giải Quiz bị lỗi thực tế", () => {
  const fixtures = [
    String.raw`$$\begin{aligned}\widehat{A}+\widehat{C}&=180^\circ\\\widehat{C}&=180^\circ-68^\circ\\&=112^\circ.\end{aligned}$$`,
    String.raw`$$\begin{aligned}\widehat{A}+\widehat{C}&=180^\circ\\2\widehat{A}&=180^\circ\\\widehat{A}&=90^\circ.\end{aligned}$$`,
  ];

  for (const content of fixtures) {
    const normalized = normalizeMathpixMarkdown(content);
    expect(normalized).toBe(content);
    expect(normalizeMathpixMarkdown(normalized)).toBe(normalized);

    const mathpixHtml = MathpixMarkdownModel.markdownToHTML(normalized, {
      htmlTags: true,
      outMath: {
        include_latex: true,
        include_svg: false,
        output_format: "latex",
      },
    });
    const serializedMath = mathpixHtml.match(
      /<span class="math-block [^"]*">(\$\$[\s\S]*?\$\$)<\/span>/u,
    )?.[1];
    expect(serializedMath).toBeTruthy();

    const latex = serializedMath!.slice(2, -2).replaceAll("&amp;", "&");
    const html = katex.renderToString(latex, {
      displayMode: true,
      strict: false,
      throwOnError: false,
    });
    expect(html.match(/<mtr>/gu)).toHaveLength(3);
  }
});

test("repairs a missing terminal inline-math closer without guessing an unfinished formula", () => {
  const malformed = String.raw`Tứ giác $ABCD$ nội tiếp đường tròn $(O).`;
  const repaired = String.raw`Tứ giác $ABCD$ nội tiếp đường tròn $(O)$.`;

  expect(normalizeMathpixMarkdown(malformed)).toBe(repaired);
  expect(normalizeMathpixMarkdown(repaired)).toBe(repaired);
  expect(normalizeMathpixMarkdown(String.raw`Trường hợp mơ hồ $x+1`)).toBe(
    String.raw`Trường hợp mơ hồ $x+1`,
  );
});

test("pipeline Mathpix giữ row separator ở mọi lệnh từng được hỗ trợ sửa escape", () => {
  const commands = [
    "angle",
    "triangle",
    "frac",
    "dfrac",
    "sqrt",
    "cdot",
    "times",
    "left",
    "right",
    "mathrm",
    "text",
    "circ",
    "widehat",
    "overline",
    "perp",
    "parallel",
    "cong",
    "neq",
    "ne",
    "le",
    "ge",
    "vec",
    "operatorname",
    "sum",
    "int",
    "ce",
    "pu",
    "quad",
    "qquad",
  ];

  for (const command of commands) {
    const validRowStart = `x&=1\\\\\\${command}`;
    const expectedCommand = command === "frac" ? "dfrac" : command;
    const expectedRowStart = `x&=1\\\\\\${expectedCommand}`;
    expect(normalizeMathpixMarkdown(`$$${validRowStart}$$`)).toBe(
      `$$${expectedRowStart}$$`,
    );

    const doubledCommandEscape = `x&=1\\\\\\\\${command}`;
    expect(normalizeMathpixMarkdown(`$$${doubledCommandEscape}$$`)).toBe(
      `$$${expectedRowStart}$$`,
    );
  }
});
