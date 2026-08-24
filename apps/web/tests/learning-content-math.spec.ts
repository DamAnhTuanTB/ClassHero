import { expect, test } from "@playwright/test";

import { normalizeLearningContentMathMarkdown } from "@/lib/learning-content-math";

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
