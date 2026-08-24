import { expect, test } from "@playwright/test";

import {
  removeQuizDisplayMathTerminalPeriods,
  resolveQuizAnswerOptionDisplay,
  resolveQuizCorrectAnswerDisplay,
} from "@/components/common/content/quiz-explanation-content-normalizer";

test("lấy đáp án hiển thị từ dữ liệu chấm cho đủ bốn loại Quiz", () => {
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "MULTIPLE_CHOICE",
      correctAnswer: ["option-b"],
      optionIds: ["option-a", "option-b", "option-c"],
    }),
  ).toEqual({ content: "B", optionLabel: "B" });
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "TRUE_FALSE",
      correctAnswer: false,
    }),
  ).toEqual({ content: "Sai", optionLabel: null });
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "MULTI_STATEMENT_TRUE_FALSE",
      correctAnswer: [
        { statementId: "statement-a", value: true },
        { statementId: "statement-b", value: false },
      ],
      optionIds: ["statement-a", "statement-b"],
    }),
  ).toEqual({ content: "a) Đúng\nb) Sai", optionLabel: null });
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "TEXT_INPUT",
      correctAnswer: ["2.1"],
    }),
  ).toEqual({ content: "2.1", optionLabel: null });
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "TEXT_INPUT",
      correctAnswer: ["1/2"],
    }),
  ).toEqual({ content: "$\\frac{1}{2}$", optionLabel: null });
});

test("chỉ định dạng phân số số học chuẩn trong đáp án nhập", () => {
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "TEXT_INPUT",
      correctAnswer: ["-3/4", "0.5"],
    }),
  ).toEqual({ content: "$-\\frac{3}{4}$ hoặc 0.5", optionLabel: null });

  for (const value of ["1/0", "1 / 2", "1/2 kg", "2026/08", "a/b"]) {
    expect(
      resolveQuizCorrectAnswerDisplay({
        questionType: "TEXT_INPUT",
        correctAnswer: [value],
      }),
    ).toEqual({ content: value, optionLabel: null });
  }
});

test("không tự chế đáp án hiển thị khi dữ liệu chấm không hợp lệ", () => {
  expect(
    resolveQuizCorrectAnswerDisplay({
      questionType: "TEXT_INPUT",
      correctAnswer: { answer: "Không hợp lệ" },
    }),
  ).toBeNull();
});

test("tách tiền tố phương án khỏi nội dung đáp án để render badge", () => {
  expect(resolveQuizAnswerOptionDisplay("B. $6$", null)).toEqual({
    content: "$6$",
    optionLabel: "B",
  });
  expect(resolveQuizAnswerOptionDisplay("AA) Phương án cuối", "quiz-option-aa")).toEqual(
    {
      content: "Phương án cuối",
      optionLabel: "AA",
    },
  );
  expect(resolveQuizAnswerOptionDisplay("$6$", "B")).toEqual({
    content: "$6$",
    optionLabel: "B",
  });
});

test("không biến chữ cái đầu của đáp án thường hoặc id nội bộ thành badge", () => {
  expect(resolveQuizAnswerOptionDisplay("Bất phương trình có nghiệm", null)).toEqual({
    content: "Bất phương trình có nghiệm",
    optionLabel: null,
  });
  expect(resolveQuizAnswerOptionDisplay("$6$", "quiz-option-b")).toEqual({
    content: "$6$",
    optionLabel: null,
  });
});

test("bỏ dấu chấm kết câu nằm trong công thức display của lời giải Quiz", () => {
  expect(
    removeQuizDisplayMathTerminalPeriods(
      "Thay $t=2$ vào phương trình:\n$$x=2-3\\cdot2=2-6=-4.$$\nVậy $x=-4$.",
    ),
  ).toBe(
    "Thay $t=2$ vào phương trình:\n$$x=2-3\\cdot2=2-6=-4$$\nVậy $x=-4$.",
  );

  expect(removeQuizDisplayMathTerminalPeriods("\\[x=1.25.\\]")).toBe(
    "\\[x=1.25\\]",
  );
});

test("không đổi dấu thập phân, dấu chấm ngoài công thức hoặc inline math", () => {
  const fixtures = [
    "$$x=1.25$$",
    "Giá trị là $x=4.$ và câu vẫn tiếp tục.",
    "$$x=4$$.",
    "Vậy x bằng 4.",
    "Câu trước kết thúc.\n$$x=4$$",
    "$$1,2,3,...$$",
  ];

  for (const content of fixtures) {
    expect(removeQuizDisplayMathTerminalPeriods(content)).toBe(content);
  }
});

test("chuẩn hóa dấu chấm có tính idempotent", () => {
  const content = "$$x=-4.$$";
  const normalized = removeQuizDisplayMathTerminalPeriods(content);

  expect(removeQuizDisplayMathTerminalPeriods(normalized)).toBe(normalized);
});

test("giữ dấu chấm cú pháp của delimiter vô hình \\right.", () => {
  const content = String.raw`$$
\left\{
\begin{aligned}
x&=1\\
y&=2
\end{aligned}
\right.
$$`;

  expect(removeQuizDisplayMathTerminalPeriods(content)).toBe(content);
});
