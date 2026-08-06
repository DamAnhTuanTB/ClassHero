# Changelog 2026-08-06

## fix(ai): improve lesson summary structured output stability
- Updated `LESSON_SUMMARY_PROMPT` to enforce the use of `$ ... $` and `$$ ... $$` for math block formatting, completely banning `\( ... \)` to resolve UI parsing issues involving punctuation.
- Renamed the catch-all `key_knowledge` block schema to `additional_info` and updated the UI label to 'Thông tin bổ sung' for better conceptual accuracy.
- Removed `displayNumber` from the JSON Schema entirely to prevent AI counting failures and API strict mode crashes. 
- Implemented deterministic per-type numbering on the Frontend (React) inside `summary-block-renderer.tsx` to handle block counting securely.
- Enforced independent block separation and specifically mandated the use of `example` blocks for examples in the AI prompt to prevent AI from cramming everything into `note` or `definition`.
- Bumped schema version to `v6` and prompt version to `v9`.

## feat(ui): refine lesson summary blocks with modern design system
- Unified all 13 block types under BaseBlockContainer with distinct color and icon mappings to ensure visual consistency and avoid clashing styles.
- Changed block labels to more pedagogical and student-friendly terms (e.g., 'Quy trình' -> 'Phương pháp giải', 'Tóm tắt phần' -> 'Tổng kết').
- Removed redundant outer card wrappers and 'Lưu ý' box in the admin lesson summary view, achieving a flatter and cleaner layout without deep nesting.
- Increased block label font size (11px -> 13px) and scaled icon sizes (w-3.5 -> w-4) to improve readability.
- Redesigned section headings, replacing the static dark circle with a modern, rounded-xl numbering block and adding a subtle, animated hover underline.

## style(admin): optimize mobile layout padding and improve visual hierarchy of assessment panels
- Restructured Admin Lesson Detail page layout to optimize screen estate on mobile devices by decreasing the overall padding from `px-6` to `px-3` on smaller screens.
- Refined the visual hierarchy of the AI Generation, Quiz, Flashcard, and Test panels by implementing a layered effect: the outer container uses a light gray `bg-[var(--theme-bg-subtle)]` background, while the inner child cards are styled with `bg-white dark:bg-slate-950` and a subtle shadow to create better depth and distinction.
- Realigned the layout of the Admin Flashcard row component to be symmetrical; detached the front face from the header into its own container with consistent `p-3` padding, mirroring the back face.
