import { expect, test } from "@playwright/test";
import katex from "katex";
import { MathpixMarkdownModel } from "mathpix-markdown-it";

import {
  normalizeLearningContentLatexCommandEscapes,
  normalizeLearningContentMathMarkdown,
  normalizeMathpixMarkdown,
} from "@/lib/learning-content-math";

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

test("chỉ bỏ slash escape dư và không nuốt row separator đứng trước lệnh", () => {
  expect(normalizeLearningContentLatexCommandEscapes(String.raw`\\widehat{C}`)).toBe(
    String.raw`\widehat{C}`,
  );
  expect(
    normalizeLearningContentLatexCommandEscapes(String.raw`\\\\widehat{C}`),
  ).toBe(String.raw`\\\widehat{C}`);

  const rowBeforeAlignmentMarker = String.raw`x&=1\\&=2`;
  expect(normalizeLearningContentLatexCommandEscapes(rowBeforeAlignmentMarker)).toBe(
    rowBeforeAlignmentMarker,
  );
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
  ];

  for (const command of commands) {
    const validRowStart = `x&=1\\\\\\${command}`;
    const expectedCommand = command === "frac" ? "dfrac" : command;
    const expectedRowStart = `x&=1\\\\\\${expectedCommand}`;
    expect(normalizeMathpixMarkdown(validRowStart)).toBe(expectedRowStart);

    const doubledCommandEscape = `x&=1\\\\\\\\${command}`;
    expect(normalizeMathpixMarkdown(doubledCommandEscape)).toBe(expectedRowStart);
  }
});
