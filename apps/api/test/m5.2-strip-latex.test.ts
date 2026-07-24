import { describe, it, expect } from "vitest";
import { stripLatexForEmbedding } from "#api/workers/utils/strip-latex";

describe("stripLatexForEmbedding", () => {
  it("should remove image references", () => {
    const input =
      'Text before ![alt](https://cdn.mathpix.com/image.jpg?height=100) text after';
    const result = stripLatexForEmbedding(input);
    expect(result).toBe("Text before text after");
  });

  it("should remove \\includegraphics", () => {
    const input =
      '\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/img.jpg}';
    const result = stripLatexForEmbedding(input);
    expect(result).toBe("");
  });

  it("should convert sections to ## headers", () => {
    const input = "\\section*{SỐ HỮU TỈ}";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("## SỐ HỮU TỈ");
  });

  it("should strip figure environment but keep caption", () => {
    const input =
      "\\begin{figure}\n\\includegraphics[alt={}]{img.jpg}\n\\caption{Hình 1}\n\\end{figure}";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("Hình 1");
    expect(result).not.toContain("\\begin");
  });

  it("should convert tables to plain text", () => {
    const input =
      "\\begin{tabular}{|l|l|}\n\\hline Bài 1 & 5 \\\\\n\\hline Bài 2 & 10 \\\\\n\\end{tabular}";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("Bài 1");
    expect(result).toContain("Bài 2");
    expect(result).not.toContain("\\hline");
    expect(result).not.toContain("\\begin");
  });

  it("should convert \\frac to readable form", () => {
    const input = "\\(\\frac{a}{b}\\) là phân số";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("(a/b)");
    expect(result).toContain("là phân số");
    expect(result).not.toContain("\\frac");
  });

  it("should convert math symbols", () => {
    const input = "với \\(a, b \\in \\mathbb{Z}, b \\neq 0\\)";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("∈");
    expect(result).toContain("Z");
    expect(result).toContain("≠");
    expect(result).not.toContain("\\mathbb");
  });

  it("should convert itemize to bullets", () => {
    const input =
      "\\begin{itemize}\n\\item[*] Nhận biết số hữu tỉ\n\\item[-] So sánh\n\\end{itemize}";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("Nhận biết số hữu tỉ");
    expect(result).toContain("So sánh");
    expect(result).not.toContain("\\begin");
  });

  it("should handle real Mathpix output snippet", () => {
    const input = `Số hữu tỉ là số viết được dưới dạng phán số \\(\\frac{a}{b}\\) với \\(a, b \\in \\mathbb{Z}, b \\neq 0\\).
Tập hợp các số hữu tỉ được kí hiệu là Q.
\\begin{figure}
\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/img.jpg}
\\captionsetup{labelformat=empty}
\\caption{Hình minh hoạ}
\\end{figure}`;

    const result = stripLatexForEmbedding(input);

    // Content preserved
    expect(result).toContain("Số hữu tỉ là số viết được dưới dạng phán số");
    expect(result).toContain("(a/b)");
    expect(result).toContain("∈");
    expect(result).toContain("Z");
    expect(result).toContain("≠");
    expect(result).toContain("Tập hợp các số hữu tỉ");
    expect(result).toContain("Hình minh hoạ");

    // Markup removed
    expect(result).not.toContain("\\frac");
    expect(result).not.toContain("\\mathbb");
    expect(result).not.toContain("\\begin");
    expect(result).not.toContain("\\includegraphics");
    expect(result).not.toContain("cdn.mathpix.com");
  });

  it("should reduce text length significantly", () => {
    const heavyLatex = `\\begin{tabular}{|l|l|}
\\hline Gáy & Chỉ số WHtR nhỏ hơn hoặc bằng 0,42 \\\\
\\hline Tót & Chỉ số WHtR lốn hơn 0,42 và nhỏ hơn hoặc bằng 0,52 \\\\
\\hline
\\end{tabular}
\\begin{figure}
\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/cropped/img.jpg?height=375&width=386}
\\captionsetup{labelformat=empty}
\\caption{Ong An}
\\end{figure}`;

    const result = stripLatexForEmbedding(heavyLatex);
    expect(result.length).toBeLessThan(heavyLatex.length * 0.7);
    expect(result).toContain("WHtR");
    expect(result).toContain("Ong An");
  });

  it("should handle \\sqrt", () => {
    const input = "\\(\\sqrt{9} = 3\\)";
    const result = stripLatexForEmbedding(input);
    expect(result).toContain("√(9)");
    expect(result).toContain("3");
  });
});
