# Changelog 2026-08-07

## AI Generation & Provider Operations
- Refactored `lesson-summary.types.ts` to strictly validate `example`, `theorem`, `property`, `knowledge`, `procedure`, and `note` blocks.
- Optimized `lesson-summary-prompt.ts` with mature RAG constraints, preventing prompt injection and hallucination (forcing usage of "dữ liệu nguồn").
- Improved Mathpix Markdown rendering UI in `summary-block-renderer.tsx` (removed excessive bolding in examples, enhanced solution steps styling with blue-tinted borders).
- Enhanced AI Model routing service and provider catalog admin interfaces (CRUD for Provider Catalog Items).
- Seeded default AI provider configurations.
