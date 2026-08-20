import { expect, test } from "@playwright/test";
import { normalizeInlineSubpartBreaks } from "@/components/common/content/lesson-summary-example-content-normalizer";

test("đưa danh sách a)-h) đang cùng dòng về các dòng riêng", () => {
  expect(
    normalizeInlineSubpartBreaks(
      "a) Tìm một điểm thuộc đường thẳng. b) Tìm vectơ chỉ phương. c) Kết luận.",
    ),
  ).toBe("a) Tìm một điểm thuộc đường thẳng.\nb) Tìm vectơ chỉ phương.\nc) Kết luận.");

  const letters = "abcdefgh";
  for (let index = 0; index < letters.length - 1; index += 1) {
    const first = letters[index]!;
    const second = letters[index + 1]!;
    expect(
      normalizeInlineSubpartBreaks(
        `Dẫn nhập: ${first}) Ý thứ nhất. ${second}) Ý thứ hai.`,
      ),
    ).toBe(`Dẫn nhập:\n${first}) Ý thứ nhất.\n${second}) Ý thứ hai.`);
  }
});

test("bao phủ marker thường, Markdown emphasis, viết hoa và các loại khoảng trắng", () => {
  const wrappers = ["", "*", "_", "**", "__"];
  const horizontalSpaces = [" ", "   ", "\t", "\u00a0"];

  for (const wrapper of wrappers) {
    for (const spacing of horizontalSpaces) {
      const first = `${wrapper}A)${wrapper}`;
      const second = `${wrapper}B)${wrapper}`;
      expect(
        normalizeInlineSubpartBreaks(
          `Kết quả:${spacing}${first} x = 1${spacing}${second} y = 2`,
        ),
      ).toBe(`Kết quả:\n${first} x = 1\n${second} y = 2`);
    }
  }
});

test("nhận marker thiếu khoảng trắng sau dấu đóng khi nội dung vẫn rõ", () => {
  expect(normalizeInlineSubpartBreaks("a)Tính x. b)Chứng minh y.")).toBe(
    "a)Tính x.\nb)Chứng minh y.",
  );
  expect(normalizeInlineSubpartBreaks("a)$x=1$. b)\\(y=2\\).")).toBe(
    "a)$x=1$.\nb)\\(y=2\\).",
  );
});

test("giữ nguyên marker đã xuống dòng, indentation và line ending Windows", () => {
  const fixtures = [
    "a) Tìm x.\nb) Tìm y.",
    "  a) Tìm x.\n  b) Tìm y.",
    "a) Tìm x.\r\nb) Tìm y.",
    "a) Tìm x.\u2028b) Tìm y.",
    "a) Tìm x.\u2029b) Tìm y.",
  ];

  for (const content of fixtures) {
    expect(normalizeInlineSubpartBreaks(content)).toBe(content);
  }
});

test("giữ cấu trúc bullet Markdown và vẫn tách bullet bị dính cùng dòng", () => {
  expect(normalizeInlineSubpartBreaks("- a) Tìm x.\n- b) Tìm y.")).toBe(
    "- a) Tìm x.\n- b) Tìm y.",
  );
  expect(normalizeInlineSubpartBreaks("- a) Tìm x. - b) Tìm y.")).toBe(
    "- a) Tìm x.\n- b) Tìm y.",
  );
  expect(normalizeInlineSubpartBreaks("1. a) Tìm x. 2. b) Tìm y.")).toBe(
    "1. a) Tìm x.\n2. b) Tìm y.",
  );
});

test("không chèn newline vào công thức LaTeX hoặc code Markdown", () => {
  const protectedFixtures = [
    String.raw`Công thức $\text{ a) x b) y }$ được giữ nguyên.`,
    String.raw`$$\begin{aligned} a)\ x &= 1 \\ b)\ y &= 2\end{aligned}$$`,
    String.raw`\(\text{ a) x b) y }\)`,
    String.raw`\[\text{ a) x b) y }\]`,
    String.raw`\begin{cases} a)\ x=1 \\ b)\ y=2 \end{cases}`,
    "`a) foo b) bar`",
    "``a) `foo` b) bar``",
    "```text\na) foo b) bar\n```",
    "~~~text\na) foo b) bar\n~~~",
    "```text\na) foo b) bar",
    "~~~text\na) foo b) bar",
    "`a) foo b) bar",
    String.raw`\begin{aligned} a)\ x=1 \\ b)\ y=2`,
  ];

  for (const content of protectedFixtures) {
    expect(normalizeInlineSubpartBreaks(content)).toBe(content);
  }
});

test("chỉ tách marker thật khi danh sách chứa công thức hoặc code", () => {
  expect(
    normalizeInlineSubpartBreaks(
      String.raw`a) Tính $\text{ c) chỉ là chữ trong công thức }$. b) Kết luận.`,
    ),
  ).toBe(
    `${String.raw`a) Tính $\text{ c) chỉ là chữ trong công thức }$.`}\nb) Kết luận.`,
  );
  expect(normalizeInlineSubpartBreaks("a) Đọc `c) không phải ý`. b) Trả lời.")).toBe(
    "a) Đọc `c) không phải ý`.\nb) Trả lời.",
  );
});

test("không hiểu nhầm ký hiệu toán, marker đơn hoặc thứ tự không phải danh sách", () => {
  const counterexamples = [
    "Chọn đáp án a) nếu mệnh đề đúng.",
    "f(a) = a + 1 và g(b) = b - 1",
    "f (a) = a + 1 và g (b) = b - 1",
    "Hai cặp ký hiệu (a) và (b) chỉ là tham số.",
    "Các nhãn b) rồi a) không tạo thành thứ tự tăng.",
    "Hai nhãn a) rồi c) bị thiếu ý trung gian.",
    "URL https://example.test/a) không phải marker b).",
  ];

  for (const content of counterexamples) {
    expect(normalizeInlineSubpartBreaks(content)).toBe(content);
  }
});

test("chuẩn hóa có tính idempotent và không đổi ký tự nội dung", () => {
  const fixtures = [
    "a) Tìm x. b) Tìm y. c) Kết luận.",
    "Mở đầu: **a)** Tính $x$. **b)** Tính $y$.",
    "- a) Tìm x. - b) Tìm y.",
    "a) 😀 Tìm x. b) Kết luận với ký hiệu 𝑥.",
  ];

  for (const content of fixtures) {
    const normalized = normalizeInlineSubpartBreaks(content);
    expect(normalizeInlineSubpartBreaks(normalized)).toBe(normalized);
    expect(normalized.replaceAll(/\s/gu, "")).toBe(content.replaceAll(/\s/gu, ""));
  }
});
