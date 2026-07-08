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

## 2026-07-08 — M2.1 backend foundation module

- Summary: Chuẩn hóa nền NestJS API trước khi làm auth/domain modules.
- Changed:
  - Thêm ConfigModule env validation bằng Zod, global validation pipe, error envelope filter, response envelope interceptor, Swagger dev và logger boot.
  - Chuyển PrismaService sang đọc `DATABASE_URL` qua ConfigService; thêm dependency Nest config/swagger và DTO validation.
- Files: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/common/**`, `apps/api/src/config/**`, `apps/api/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, `docs/**`, `.codex/context/**`
- Tests: `pnpm --filter @learning-path/api typecheck`; `pnpm --filter @learning-path/api build`; smoke test `GET /api/v1/health`, `GET /api/docs-json`, `GET /api/v1/not-found`; env validation direct check; `pnpm --filter @learning-path/api lint`; `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `pnpm format:check`; `git diff --check`.
- Notes: `@scarf/scarf` build script được đặt `false` trong `pnpm-workspace.yaml` vì chỉ là dependency phụ của Swagger UI, không cần chạy script trong repo.

## 2026-07-08 — Codex task completion notification

- Summary: Thêm cơ chế thông báo rõ ràng khi task Codex hoàn thành, bị chặn hoặc thất bại.
- Changed:
  - Thêm `.codex/scripts/notify-task.sh` dùng macOS notification qua `osascript`, có fallback không làm task fail.
  - Cập nhật `AGENTS.md`, context/code index và các skill chính để gọi notification trước final response.
- Files: `.codex/scripts/notify-task.sh`, `AGENTS.md`, `.codex/skills/*/SKILL.md`, `.codex/context/current-context.md`, `.codex/context/code-index.md`
- Tests: `bash -n .codex/scripts/notify-task.sh`; `.codex/scripts/notify-task.sh done "Codex notification test" "Thiết lập thông báo task đã sẵn sàng."`; `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py` cho các skill đã sửa; `pnpm format:check`; `git diff --check`; scan conflict/secret bằng `rg`.
- Notes: Notification chỉ ghi task/outcome ngắn; không ghi secret, token, private URL hoặc dữ liệu nhạy cảm.

## 2026-07-08 — Telegram full-control Codex bridge

- Summary: Thêm bot Telegram local để owner chat/ra lệnh cho Codex trong repo và nhận kết quả qua Telegram.
- Changed:
  - Thêm `.codex/scripts/codex-telegram-bot.py` và wrapper `.codex/scripts/run-telegram-bot.sh` để nhận tin nhắn Telegram, kiểm tra `chat_id` allow, gọi `codex exec` full quyền và gửi final response lại Telegram.
  - Thêm `.codex/telegram/.env.example`, ignore env/state/run local, bỏ qua update cũ khi bot start và mở rộng `notify-task.sh` để gửi Telegram notification khi token/chat ID được cấu hình.
  - Chuyển bot sang `telegram-thread` để không lẫn phiên Codex app/terminal, log lỗi từng message thay vì chết im lặng, và thêm script cài/gỡ macOS LaunchAgent để chạy bền.
  - Cập nhật `README.md`, `AGENTS.md`, context và code index với cách vận hành Telegram bot.
- Files: `.codex/scripts/codex-telegram-bot.py`, `.codex/scripts/run-telegram-bot.sh`, `.codex/scripts/install-telegram-launch-agent.sh`, `.codex/scripts/uninstall-telegram-launch-agent.sh`, `.codex/scripts/notify-task.sh`, `.codex/telegram/.env.example`, `.gitignore`, `README.md`, `AGENTS.md`, `.codex/context/current-context.md`, `.codex/context/code-index.md`
- Tests: `python3 -m py_compile .codex/scripts/codex-telegram-bot.py`; `bash -n .codex/scripts/notify-task.sh`; `bash -n .codex/scripts/run-telegram-bot.sh`; `bash -n .codex/scripts/install-telegram-launch-agent.sh`; `bash -n .codex/scripts/uninstall-telegram-launch-agent.sh`; `TELEGRAM_BOT_TOKEN=dummy TELEGRAM_ALLOWED_CHAT_IDS=123 .codex/scripts/run-telegram-bot.sh --check`; Telegram `getMe` OK; LaunchAgent `com.codex.learning-path.telegram-bot` running; `pnpm format:check`; `git diff --check`; scan conflict/secret bằng `rg`.
- Notes: Token/chat ID thật nằm trong `.codex/telegram/.env.local` và không commit; token đã lộ trong chat nên nên revoke và thay token mới sau khi test ổn.

## 2026-07-08 — Telegram chat transcript

- Summary: Lưu transcript Markdown local cho luồng chat Telegram để owner xem lại trong repo.
- Changed:
  - Thêm transcript logging vào Telegram bot cho tin nhắn Telegram và phản hồi Codex, kèm redaction cơ bản cho token/secret pattern.
  - Thêm env mẫu `CODEX_TELEGRAM_TRANSCRIPT_*`, ignore `.codex/telegram/transcript.md`, cập nhật README/context/code index.
- Files: `.codex/scripts/codex-telegram-bot.py`, `.codex/telegram/.env.example`, `.gitignore`, `README.md`, `.codex/context/current-context.md`, `.codex/context/code-index.md`
- Tests: `python3 -m py_compile .codex/scripts/codex-telegram-bot.py`; `bash -n` cho Telegram scripts; `TELEGRAM_BOT_TOKEN=dummy TELEGRAM_ALLOWED_CHAT_IDS=123 .codex/scripts/run-telegram-bot.sh --check`; transcript redaction test với file tạm; restart LaunchAgent; `pnpm format:check`; `git diff --check`; scan conflict/secret bằng `rg`.
- Notes: Transcript là file local bị ignore khỏi git; không dùng transcript để lưu secret thật.

## 2026-07-08 — Learning note for Codex notifications and Telegram

- Summary: Ghi lại lý thuyết học tập cho macOS notification, Telegram notification, Telegram control và transcript.
- Changed:
  - Thêm note nền tảng `docs/learning-notes/foundation/codex-notification-and-telegram.md`.
  - Cập nhật `docs/learning-notes/index.md` để owner tìm lại note.
- Files: `docs/learning-notes/foundation/codex-notification-and-telegram.md`, `docs/learning-notes/index.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm format:check`; `git diff --check`; scan conflict/secret bằng `rg`.
- Notes: Note không ghi token/chat ID thật.
