import { expect, test } from "@playwright/test";
import { splitOcrPreviewContent } from "@/features/admin/courses/utils/split-ocr-preview-content";

test.describe("OCR preview content chunking", () => {
  test("preserves all paragraphs in order", () => {
    const source = ["Mở đầu", "Đoạn thứ hai", "Đoạn kết"].join("\n\n");
    const chunks = splitOcrPreviewContent(source, 10);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n")).toBe(source);
  });

  test("does not split an open LaTeX environment", () => {
    const source = [
      "Mở đầu đủ dài",
      "\\begin{tabular}{cc}\nA & B",
      "C & D\n\\end{tabular}",
      "Đoạn kết đủ dài",
    ].join("\n\n");
    const chunks = splitOcrPreviewContent(source, 12);

    expect(chunks.join("\n\n")).toBe(source);
    expect(
      chunks.some(
        (chunk) => chunk.includes("\\begin{tabular}") && chunk.includes("\\end{tabular}"),
      ),
    ).toBe(true);
  });

  test("does not split fenced code or display math blocks", () => {
    const source = [
      "Mở đầu đủ dài",
      "```text\nnội dung",
      "kết thúc```",
      "$$\nx + y",
      "= z\n$$",
      "Đoạn kết đủ dài",
    ].join("\n\n");
    const chunks = splitOcrPreviewContent(source, 12);

    expect(chunks.join("\n\n")).toBe(source);
    expect(
      chunks.some((chunk) => chunk.includes("```text") && chunk.includes("kết thúc```")),
    ).toBe(true);
    expect(
      chunks.some((chunk) => chunk.includes("$$\nx + y") && chunk.includes("= z\n$$")),
    ).toBe(true);
  });
});
