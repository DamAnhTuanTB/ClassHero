/**
 * Strip LaTeX/Mathpix markup from MMD text before embedding.
 *
 * Mathpix OCR output contains heavy LaTeX formatting:
 * - \begin{figure}, \includegraphics, \caption
 * - \begin{tabular}, \hline, \\, &
 * - \begin{itemize}, \item
 * - \frac{}{}, \sqrt{}, \mathbb{}, etc.
 * - ![](https://cdn.mathpix.com/...) image links
 *
 * These commands pollute embedding vectors with non-semantic noise.
 * This function strips formatting but preserves mathematical meaning.
 *
 * Tested: v2 search accuracy 7/7 vs v1 (raw LaTeX) 3/7.
 */

export function stripLatexForEmbedding(mmd: string): string {
  let text = mmd;

  // ── Images ──
  text = text.replace(/!\[.*?\]\(https?:\/\/[^)]+\)/g, "");
  text = text.replace(/\\includegraphics\[.*?\]\{[^}]+\}/g, "");

  // ── Figure/caption environments ──
  text = text.replace(/\\begin\{figure\}/g, "");
  text = text.replace(/\\end\{figure\}/g, "");
  text = text.replace(/\\captionsetup\{[^}]*\}/g, "");
  text = text.replace(/\\caption\{([^}]*)\}/g, "$1");

  // ── Section headings → plain markers ──
  text = text.replace(/\\section\*?\{([^}]*)\}/g, "\n## $1\n");
  text = text.replace(/\\subsection\*?\{([^}]*)\}/g, "\n### $1\n");

  // ── Tables: remove structure, keep data ──
  text = text.replace(/\\begin\{tabular\}\{[^}]*\}/g, "");
  text = text.replace(/\\end\{tabular\}/g, "");
  text = text.replace(/\\hline/g, "");
  text = text.replace(/\\\\/g, "\n");
  text = text.replace(/\s*&\s*/g, " | ");

  // ── Lists: convert to plain bullets ──
  text = text.replace(/\\begin\{itemize\}/g, "");
  text = text.replace(/\\end\{itemize\}/g, "");
  text = text.replace(/\\begin\{enumerate\}/g, "");
  text = text.replace(/\\end\{enumerate\}/g, "");
  text = text.replace(/\\item\[([^\]]*)\]/g, "$1 ");
  text = text.replace(/\\item\s/g, "• ");

  // ── Inline math delimiters ──
  text = text.replace(/\\\(([^\\]*?)\\\)/g, "$1");
  text = text.replace(/\\\[([^\\]*?)\\\]/g, "$1");

  // ── Common math commands → readable form ──
  text = text.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1/$2)");
  text = text.replace(/\\sqrt\{([^}]*)\}/g, "√($1)");
  text = text.replace(/\\mathbb\{([^}]*)\}/g, "$1");
  text = text.replace(/\\mathrm\{([^}]*)\}/g, "$1");
  text = text.replace(/\\text\{([^}]*)\}/g, "$1");
  text = text.replace(/\\textbf\{([^}]*)\}/g, "$1");
  text = text.replace(/\\textit\{([^}]*)\}/g, "$1");
  text = text.replace(/\\overline\{([^}]*)\}/g, "$1");
  text = text.replace(/\\underline\{([^}]*)\}/g, "$1");
  text = text.replace(/\\ldots/g, "...");
  text = text.replace(/\\neq/g, "≠");
  text = text.replace(/\\leq/g, "≤");
  text = text.replace(/\\geq/g, "≥");
  text = text.replace(/\\times/g, "×");
  text = text.replace(/\\cdot/g, "·");
  text = text.replace(/\\quad/g, " ");
  text = text.replace(/\\qquad/g, "  ");
  text = text.replace(/\\in\b/g, "∈");
  text = text.replace(/\\subset/g, "⊂");
  text = text.replace(/\\infty/g, "∞");
  text = text.replace(/\\pm/g, "±");
  text = text.replace(/\\approx/g, "≈");
  text = text.replace(/\\rightarrow/g, "→");
  text = text.replace(/\\Rightarrow/g, "⇒");
  text = text.replace(/\\left/g, "");
  text = text.replace(/\\right/g, "");

  // ── Remaining LaTeX commands (generic cleanup) ──
  text = text.replace(/\\[a-zA-Z]+\{[^}]*\}/g, "");
  text = text.replace(/\\[a-zA-Z]+/g, "");

  // ── Whitespace cleanup ──
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/^\s+$/gm, "");

  return text.trim();
}
