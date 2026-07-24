/**
 * Keyword extractor cho hybrid search.
 *
 * Extract LaTeX commands, math symbols, units, named terms từ query
 * để dùng ILIKE search trên document_chunks.content (LaTeX gốc).
 *
 * Xem docs/06-ai-rag-spec.md §4.3.
 */

/** Minimum keyword length to avoid noise */
const MIN_KEYWORD_LENGTH = 2;

/**
 * Vietnamese stopwords — loại khỏi keyword search.
 */
const STOPWORDS = new Set([
  "là",
  "gì",
  "có",
  "và",
  "của",
  "cho",
  "với",
  "được",
  "không",
  "trong",
  "này",
  "các",
  "để",
  "khi",
  "như",
  "thế",
  "nào",
  "bao",
  "nhiêu",
  "bằng",
  "hãy",
  "tôi",
  "em",
  "thầy",
  "cô",
  "bài",
  "câu",
  "hỏi",
  "trả",
  "lời",
  "ví",
  "dụ",
  "theo",
  "nếu",
  "thì",
  "hoặc",
  "hay",
  "từ",
  "đến",
  "về",
  "tại",
  "sao",
  "vì",
  "một",
  "hai",
  "ba",
  "vậy",
  "đó",
  "đây",
  "rồi",
  "lại",
  "mà",
  "cũng",
  "cách",
  "giải",
  "tính",
  "tìm",
  "biết",
  "hiểu",
]);

/**
 * Extract keywords từ query cho ILIKE search.
 *
 * Returns mảng strings, mỗi string sẽ dùng trong `content ILIKE '%keyword%'`.
 *
 * Patterns detected:
 * 1. LaTeX commands: \frac, \sqrt, \int, \sum, \lim, etc.
 * 2. LaTeX expressions: \frac{a}{b}, \sqrt{9}, etc.
 * 3. Math unicode: √, ∫, Σ, Δ, π, ∞, ≠, ≤, ≥
 * 4. Units: cm, cm², kg, m/s, °C, mol, etc.
 * 5. Chemical formulas: H₂O, NaCl, CO₂, etc.
 * 6. Named math terms: remaining non-stopword tokens ≥ 2 chars
 */
export function extractKeywords(query: string): string[] {
  const keywords: string[] = [];

  // 1. LaTeX expressions (e.g., \frac{a}{b}, \sqrt{9})
  const latexExpressions = query.match(/\\[a-zA-Z]+(\{[^}]*\})+/g);
  if (latexExpressions) {
    keywords.push(...latexExpressions);
  }

  // 2. LaTeX commands without args (e.g., \pi, \infty, \neq)
  const latexCommands = query.match(/\\[a-zA-Z]{2,}/g);
  if (latexCommands) {
    for (const cmd of latexCommands) {
      // Avoid duplicates from step 1
      if (!keywords.some((k) => k.includes(cmd))) {
        keywords.push(cmd);
      }
    }
  }

  // 3. Math unicode symbols
  const mathSymbols = query.match(/[√∫∑Σ∏Δδπ∞±≈≠≤≥×·∈⊂⊃∪∩∀∃]/g);
  if (mathSymbols) {
    keywords.push(...mathSymbols);
  }

  // 4. Numbers with symbols (e.g., √9, 2π, 3/4)
  const numberPatterns = query.match(/[√]?\d+[.,]?\d*[²³⁴]?/g);
  if (numberPatterns) {
    for (const np of numberPatterns) {
      if (np.length >= MIN_KEYWORD_LENGTH) {
        keywords.push(np);
      }
    }
  }

  // 5. Unit patterns (e.g., cm², kg, m/s, °C, mol/L)
  const unitPatterns = query.match(
    /\d+\s*(?:km\/h|m\/s|mol|cm|mm|km|dm|kg|mg|ml|Hz|Pa|°C|°F|m|g|L|N|J|W|V|A|Ω)(?:²|³)?(?!\w)/gi,
  );
  if (unitPatterns) {
    keywords.push(...unitPatterns.map((u) => u.trim()));
  }

  // 6. Chemical formulas (e.g., H₂O, NaCl, CO₂, H2SO4)
  const chemPatterns = query.match(
    /[A-Z][a-z]?[₀₁₂₃₄₅₆₇₈₉0-9]*(?:[A-Z][a-z]?[₀₁₂₃₄₅₆₇₈₉0-9]*)*/g,
  );
  if (chemPatterns) {
    for (const cp of chemPatterns) {
      // Only include if it looks like a formula (has subscript or multiple elements)
      if (
        cp.length >= 2 &&
        (/[₀₁₂₃₄₅₆₇₈₉]/.test(cp) || /[A-Z].*[A-Z]/.test(cp) || /[A-Z][a-z]\d/.test(cp))
      ) {
        keywords.push(cp);
      }
    }
  }

  // 7. Named terms — remaining meaningful words
  const words = query
    .replace(/\\[a-zA-Z]+(\{[^}]*\})*/g, "") // remove LaTeX
    .replace(/[√∫∑Σ∏Δδπ∞±≈≠≤≥×·∈⊂⊃∪∩∀∃]/g, "") // remove symbols
    .split(/[\s,;:.!?()[\]{}]+/)
    .filter(
      (w) =>
        w.length >= MIN_KEYWORD_LENGTH &&
        !STOPWORDS.has(w.toLowerCase()) &&
        !/^\d+$/.test(w), // exclude pure numbers
    );

  for (const word of words) {
    if (!keywords.includes(word)) {
      keywords.push(word);
    }
  }

  return keywords;
}
