## 2026-07-08 — Update do runner continuation flow

- Summary: Làm rõ `/do` và `/do plan` để có thể commit phần vừa xong rồi tiếp tục task mới đã được gợi ý.
- Changed:
  - Bổ sung luồng commit-then-continue cho `/do` khi trước đó còn thay đổi chưa commit và đã có gợi ý task kế tiếp rõ ràng.
  - Bổ sung `/do plan` để commit trước nếu cần, rồi lập approval-gated plan cho task kế tiếp thay vì triển khai ngay.
- Files: `.codex/skills/do/SKILL.md`, `.codex/skills/do/agents/openai.yaml`
- Tests: `pnpm format:check`; `pnpm exec prettier --check .codex/skills/do/SKILL.md .codex/skills/do/agents/openai.yaml .codex/changelog/CHANGELOG_2026-07-08_codex.md`; `git diff --check`; frontmatter check thủ công cho `do/SKILL.md`.
- Notes: Không thay đổi code production.

## 2026-07-08 — M1.3 learning database models

- Summary: Thêm các model Prisma lõi cho learning path, lesson, document, enrollment và progress.
- Changed:
  - Bổ sung enum/model `LearningPath`, `Lesson`, `LessonMaterial`, `LessonDocument`, `DocumentChunk`, `LessonSummary`, `Enrollment`, `LessonProgress`.
  - Tạo migration SQL kèm FK, index, pgvector field và partial unique index cho active enrollment.
- Files: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260708001000_add_learning_models/migration.sql`, `.codex/context/current-context.md`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `pnpm --filter @learning-path/api typecheck`; `pnpm format:check`; `pnpm exec prettier --check` cho Markdown liên quan; `git diff --check`.
- Notes: `enrollments.payment_id`, `lesson_progress.best_test_attempt_id` và `lesson_summaries.ai_generation_id` giữ dạng UUID scalar cho đến khi các model `Payment`, `TestAttempt`, `AiGeneration` được thêm ở các milestone sau.

## 2026-07-08 — M1.4 learning interaction database models

- Summary: Thêm model Prisma cho quiz, flashcard, test, attempt, favorite và note/comment riêng.
- Changed:
  - Bổ sung enum/model cho `QuizSet`, `QuizQuestion`, `QuizAttempt`, `FlashcardSet`, `FlashcardProgress`, `TestSet`, `TestAttempt`, `StudentNote`, `LessonVideoComment` và `Favorite`.
  - Tạo migration SQL kèm FK, unique constraint, index và partial unique index cho best test attempt theo từng học sinh/lesson.
- Files: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260708002000_add_learning_interaction_models/migration.sql`, `.codex/context/current-context.md`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `pnpm --filter @learning-path/api typecheck`; `pnpm format:check`; `pnpm exec prettier --check` cho Markdown liên quan; `git diff --check`.
- Notes: `ai_generation_id` và `explanation_id` giữ dạng UUID scalar cho đến khi các model AI/explanation được thêm ở `M1.5`.
