# Changelog 2026-08-07

## AI Generation & Provider Operations
- Refactored `lesson-summary.types.ts` to strictly validate `example`, `theorem`, `property`, `knowledge`, `procedure`, and `note` blocks.
- Optimized `lesson-summary-prompt.ts` with mature RAG constraints, preventing prompt injection and hallucination (forcing usage of "dữ liệu nguồn").
- Improved Mathpix Markdown rendering UI in `summary-block-renderer.tsx` (removed excessive bolding in examples, enhanced solution steps styling with blue-tinted borders).
- Enhanced AI Model routing service and provider catalog admin interfaces (CRUD for Provider Catalog Items).
- Seeded default AI provider configurations.
- Tinh chỉnh toàn diện System Prompt và Zod Schema (chuyển `solutionSteps` sang `solution` dạng Markdown liền khối) của tính năng Lesson Summary để ép AI sinh các khối học liệu đan xen (Interleaving), chống bịa đặt kiến thức (Hallucination), và tự động tạo Section "Luyện tập với bài toán thực tế" cuối bài.
- Sửa lỗi UI render (TypeError TS2532) cho khối Ví dụ.

## UI/UX Improvements
- **ReactJson Textarea Editing**: Fixed UI layout issues in `SummaryBlockRenderer` when using `ReactJson` editing feature.
  - Adjusted global CSS to ensure `textarea` elements break to a new line when editing fields.
  - Hardcoded `max-height` constraints on textarea to override the aggressive inline height calculation by `react-textarea-autosize`.
  - Resized and adjusted margins for Edit Action SVG icons (Check/Cancel) for improved clicking accuracy and readability.
  - Applied CSS fix exclusively to `.react-json-view` descendants to prevent accidental override of unrelated JSON wrapper components.
- **AI Generation**: Updated `lesson-summary-prompt.ts` to refine the LLM output behavior.
  - Removed deprecated priority items and content checklists.

## Bug Fixes
- **JSON Edit View**: Resolved an issue where manipulating the CSS structure for `textarea` would unintentionally apply `display: block` to the ReactJson grid layout wrapper, which broke horizontal alignment.
- **Admin Lesson JSON View**: Added `keyModifier` prop to `ReactJson` in the 'Chỉ xem JSON' (JSON-Only) view mode so users can double-click to edit values, maintaining consistency with the Split-view mode.

## AI Prompt Refinements
- **Lesson Summary Prompt (`lesson-summary-prompt.ts`)**: Comprehensively refined and renamed system prompt rules to enforce structural integrity and improve output readability.
  - Re-titled rules (e.g. `CÁCH ĐẶT TIÊU ĐỀ (TITLE)`, `VĂN PHONG LỜI GIẢI (SOLUTION)`) to make them highly explicit for the LLM.
  - Strictly banned the AI from hallucinating new consolidation sections like "Bài tập" or "Bài tập củng cố". Mandated that only the "Luyện tập với các bài toán thực tế" section is allowed to group exercises.
  - Enforced a strict paragraphing rule (`\n\n`) for the `content`, `problem`, and `solution` fields.
  - Forced the LLM to place each logical argument in `solution` on its own line.
  - Explicitly required that enumerated items (e.g., `a), b), c)`) within `problem` and `content` fields must be split onto separate lines for readability.
  - Solidified the rule explicitly prohibiting `example` and `note` content from bleeding into theoretical `content` fields.
  - Specified exact valid block types (`knowledge`, `theorem`, `note`, `procedure`, `property`) in the formatting rule for the `content` field to improve LLM type matching.
