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

## 2026-07-08 — M1.5 remaining MVP database models

- Summary: Thêm model Prisma còn lại cho payment, notification, report, AI log/cache/chat, XP và news.
- Changed:
  - Bổ sung enum/model cho discount/payment/webhook, notification delivery, report moderation, AI generation/explanation/chat, XP event và news item.
  - Nối các UUID scalar từ M1.3/M1.4 sang relation thật với `Payment`, `AiGeneration` và `AiExplanation`; thêm partial unique index cho payment idempotency.
- Files: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260708003000_add_remaining_mvp_models/migration.sql`, `.codex/context/current-context.md`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `pnpm --filter @learning-path/api typecheck`; `pnpm format:check`; `pnpm exec prettier --check` cho Markdown liên quan; `git diff --check`.
- Notes: Chưa apply migration vào database thật; payment/webhook/AI provider logic sẽ được implement ở các milestone API/worker sau.

## 2026-07-08 — M1.6 database seed and validation

- Summary: Thêm seed dev tối thiểu và check riêng cho dữ liệu mẫu Prisma.
- Changed:
  - Bổ sung `db:seed` và `db:seed:check` cho API package.
  - Tạo seed idempotent cho admin/student/parent, Toán 7, lesson, document chunk, quiz/flashcard/test, payment/enrollment, notification, report, note, XP và news.
- Files: `apps/api/package.json`, `apps/api/tsconfig.seed.json`, `apps/api/prisma/seed.ts`, `.codex/context/current-context.md`, `.codex/context/code-index.md`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/api db:seed:check`; `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `pnpm --filter @learning-path/api typecheck`; `pnpm format:check`; `pnpm exec prettier --check` cho Markdown liên quan; `git diff --check`.
- Notes: Chưa chạy `db:seed` vào database thật vì chưa có `.env`/`DATABASE_URL` trong môi trường hiện tại.

## 2026-07-08 — Local Postgres dev database

- Summary: Bổ sung Postgres + pgvector local cho môi trường dev và DBeaver.
- Changed:
  - Thêm service `postgres` dùng image pgvector vào Docker Compose, kèm healthcheck và volume local.
  - Chuyển env example/docs sang local database mặc định, đồng thời giữ Supabase cho staging/production.
- Files: `docker-compose.yml`, `.env.example`, `apps/api/.env.example`, `README.md`, `docs/03-technical-architecture.md`, `docs/04-database-model.md`, `docs/07-integration-and-env.md`, `.codex/context/**`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `docker compose config`; `docker compose up -d postgres`; `pnpm --filter @learning-path/api prisma migrate dev` với local `DATABASE_URL`; `pnpm --filter @learning-path/api db:seed` với local `DATABASE_URL`; kiểm tra `vector` extension và seed counts bằng `psql`; `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:seed:check`; `pnpm format:check`; `git diff --check`.
- Notes: Local credentials `postgres/postgres` chỉ dùng cho dev Docker; không phải production secret.
