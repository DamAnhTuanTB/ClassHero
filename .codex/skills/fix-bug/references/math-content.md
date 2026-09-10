# Math Content Bug Rules

Read this reference only for KaTeX, MathJax, LaTeX normalization, or display-math layout bugs.

## Renderer CSS

- When KaTeX and MathJax share a content wrapper, scope SVG resets to the renderer container, for example `mjx-container[jax="SVG"] > svg`. Do not use a broad wrapper selector such as `.mmd-content svg`; it can override KaTeX stretchy-delimiter layout.
- After math CSS changes, verify tall braces, radicals, fractions, integrals with limits, and exponent/subscript combinations at normal and enlarged zoom.
- Give horizontally scrollable display math one canonical overflow owner. Avoid a nested `overflow-y: hidden` container that clips legitimate ink outside the inner line box. Reserve ink-safe padding on the outer scroller and inspect every clipping ancestor.

## LaTeX Normalization

- Treat `\\right.` as delimiter syntax, never as removable sentence punctuation.
- Repair a misplaced `$$` before `\\end{aligned}` or similar environments before parsing.
- Cover valid and malformed forms with regression tests; do not rely on raw red fallback output as recovery behavior.
