import { describe, it, expect } from "vitest";
import { extractKeywords } from "#api/modules/ai/utils/keyword-extractor";

describe("keyword-extractor", () => {
  it("should extract LaTeX commands and expressions", () => {
    const result = extractKeywords("tính phân số \\frac{a}{b} và \\sqrt{9}");
    expect(result).toContain("\\frac{a}{b}");
    expect(result).toContain("\\sqrt{9}");
  });

  it("should extract isolated LaTeX commands", () => {
    const result = extractKeywords("kí hiệu \\pi và \\infty");
    expect(result).toContain("\\pi");
    expect(result).toContain("\\infty");
  });

  it("should extract math unicode symbols", () => {
    const result = extractKeywords("tìm Δ và ∑ của ∫x dx");
    expect(result).toContain("Δ");
    expect(result).toContain("∑");
    expect(result).toContain("∫");
  });

  it("should extract numbers with math symbols", () => {
    const result = extractKeywords("căn √9 và √25");
    expect(result).toContain("√9");
    expect(result).toContain("√25");
  });

  it("should extract units", () => {
    const result = extractKeywords("diện tích 25 cm² và 10 kg, vận tốc 5 m/s");
    expect(result).toContain("25 cm²");
    expect(result).toContain("10 kg");
    expect(result).toContain("5 m/s");
  });

  it("should extract chemical formulas", () => {
    const result = extractKeywords("pha H₂O với H2SO4 và CO2");
    expect(result).toContain("H₂O");
    expect(result).toContain("H2SO4");
    expect(result).toContain("CO2");
  });

  it("should extract named terms excluding stopwords", () => {
    const result = extractKeywords("tính diện tích hình chữ nhật");
    // "tính" is a stopword. "diện", "tích", "hình", "chữ", "nhật" are kept.
    expect(result).toContain("diện");
    expect(result).toContain("tích");
    expect(result).toContain("hình");
    expect(result).toContain("chữ");
    expect(result).toContain("nhật");
    expect(result).not.toContain("tính");
  });

  it("should exclude pure numbers", () => {
    const result = extractKeywords("bài 1 và câu 2");
    expect(result).not.toContain("1");
    expect(result).not.toContain("2");
  });
});
