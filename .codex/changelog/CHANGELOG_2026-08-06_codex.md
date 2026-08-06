# Changelog 2026-08-06

## fix(ai): improve lesson summary structured output stability
- Updated `LESSON_SUMMARY_PROMPT` to enforce the use of `$ ... $` and `$$ ... $$` for math block formatting, completely banning `\( ... \)` to resolve UI parsing issues involving punctuation.
- Renamed the catch-all `key_knowledge` block schema to `additional_info` and updated the UI label to 'Thông tin bổ sung' for better conceptual accuracy.
- Removed `displayNumber` from the JSON Schema entirely to prevent AI counting failures and API strict mode crashes. 
- Implemented deterministic per-type numbering on the Frontend (React) inside `summary-block-renderer.tsx` to handle block counting securely.
- Enforced independent block separation and specifically mandated the use of `example` blocks for examples in the AI prompt to prevent AI from cramming everything into `note` or `definition`.
- Bumped schema version to `v6` and prompt version to `v9`.
