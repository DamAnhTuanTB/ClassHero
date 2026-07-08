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

## 2026-07-08 — M2.2 auth register login refresh logout

- Summary: Thêm AuthModule cho register student/parent, login, JWT access token, refresh token rotation và logout.
- Changed:
  - Bổ sung endpoint `/auth/register/student`, `/auth/register/parent`, `/auth/login`, `/auth/refresh`, `/auth/logout` với DTO validation, password scrypt hash, duplicate identity errors và access token JWT.
  - Refresh token được sinh dạng opaque token, chỉ lưu SHA-256 hash trong `refresh_tokens`, rotate khi refresh và revoke khi logout.
  - Cập nhật API docs, context/code index, feature coverage matrix và learning note cho basic auth.
- Files: `apps/api/src/modules/auth/**`, `apps/api/src/app.module.ts`, `apps/api/package.json`, `pnpm-lock.yaml`, `docs/api/auth-profile.md`, `.codex/context/**`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/api typecheck`; `pnpm --filter @learning-path/api build`; `pnpm --filter @learning-path/api lint`; `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `prisma migrate status` với local `DATABASE_URL`; smoke test HTTP local cho register student/parent, login, refresh rotate, old refresh 401, logout và refresh sau logout 401; `pnpm format:check`; `pnpm exec prettier --check` cho Markdown liên quan; `git diff --check`.
- Notes: Smoke test tạo user test trong Postgres dev local rồi đã cleanup; không đổi schema/migration.

## 2026-07-08 — M2.3 RBAC profile and password reset API

- Summary: Thêm JWT/RBAC guard, `GET /me`, cập nhật student profile và forgot/reset password.
- Changed:
  - Bổ sung common auth layer `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser` để enforce authenticated/role API ở backend.
  - Mở rộng AuthModule với `/me`, `/me/student-profile`, `/auth/forgot-password`, `/auth/reset-password`; reset token chỉ lưu hash và reset thành công revoke refresh token cũ.
  - Cập nhật API/env docs, context/code index, feature coverage matrix và learning note cho auth/RBAC/profile/reset.
- Files: `apps/api/src/common/auth/**`, `apps/api/src/modules/auth/**`, `apps/api/src/config/env.validation.ts`, `apps/api/.env.example`, `docs/api/auth-profile.md`, `docs/07-integration-and-env.md`, `.codex/context/**`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/api typecheck`; `pnpm --filter @learning-path/api build`; `pnpm --filter @learning-path/api lint`; `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; HTTP smoke test local cho `/me`, RBAC student profile, forgot/reset password và revoke refresh token sau reset; `pnpm format:check`; `pnpm exec prettier --check` cho Markdown liên quan; `git diff --check`.
- Notes: Không đổi schema/migration; Resend email reset chỉ gọi khi env thật được cấu hình.

## 2026-07-08 — M2.4 auth UI mock

- Summary: Dựng UI mock cho login, register student/parent, forgot password và reset password.
- Changed:
  - Thêm các route public `/login`, `/register/student`, `/register/parent`, `/forgot-password`, `/reset-password` với metadata `noindex`.
  - Tạo feature auth gồm shell chung, React Hook Form + Zod schemas, mock submit loading/success/error và cập nhật landing link vào auth flow.
- Files: `apps/web/app/(public)/**`, `apps/web/features/auth/**`, `.codex/context/**`, `docs/implementation/feature-coverage-matrix.md`, `docs/learning-notes/**`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm format:check`; `git diff --check`; dev server smoke check bằng Node `fetch` cho `/`, `/login`, `/register/student`, `/register/parent`, `/forgot-password`, `/reset-password`.
- Notes: Chỉ làm UI/mock theo `/task-ui`; chưa gọi API thật, chưa lưu session/token thật. Screenshot/browser automation chưa chạy vì repo chưa có Playwright; bước nối API tiếp theo là `/task-connect M2.4`.

## 2026-07-08 — Playwright auth UI screenshots

- Summary: Thiết lập Playwright cho web app để test và chụp screenshot auth UI.
- Changed:
  - Thêm `@playwright/test`, config Playwright Chromium desktop/tablet/mobile, script `e2e:auth-ui` và test auth UI.
  - Lưu screenshot/report/results vào `.codex` dạng artifact local bị ignore; cập nhật README, context/code index và learning note.
- Files: `apps/web/package.json`, `apps/web/playwright.config.ts`, `apps/web/tests/auth-ui.spec.ts`, `.gitignore`, `README.md`, `.codex/context/**`, `docs/learning-notes/**`, `pnpm-lock.yaml`
- Tests: `pnpm --filter @learning-path/web exec playwright install chromium`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; xem nhanh screenshot login desktop/mobile.
- Notes: Screenshot local nằm trong `.codex/screenshots/` và không commit. Playwright config chạy `next build` + `next start` để ảnh không dính dev overlay.

## 2026-07-08 — Production-quality task UI rule

- Summary: Ghi rõ `/task-ui` phải tạo UI như bản production, không phải demo kỹ thuật.
- Changed:
  - Bổ sung rule trong `task-ui` skill: mock data chỉ là implementation detail, không được lộ text kỹ thuật/task code/debug note trên UI.
  - Bổ sung rule vào UI design system để visible copy luôn viết cho người dùng thật, còn giải thích kỹ thuật nằm trong final/changelog/docs/test.
- Files: `.codex/skills/task-ui/SKILL.md`, `docs/11-ui-design-system.md`
- Tests: `pnpm exec prettier --check .codex/skills/task-ui/SKILL.md docs/11-ui-design-system.md .codex/changelog/CHANGELOG_2026-07-08_codex.md`; `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/task-ui`; `git diff --check`.
- Notes: Không đổi production code.

## 2026-07-08 — Owner feedback note workflow

- Summary: Ghi rule Codex phải tự note lại giải pháp/quy tắc mới sau feedback không hài lòng của owner.
- Changed:
  - Thêm mục `Khi Owner Không Hài Lòng` vào `AGENTS.md`.
  - Cập nhật current context để nhắc Codex không chờ owner hỏi lại đã note chưa.
- Files: `AGENTS.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm exec prettier --check AGENTS.md .codex/context/current-context.md .codex/changelog/CHANGELOG_2026-07-08_codex.md`; `git diff --check`.
- Notes: Không đổi production code.

## 2026-07-08 — UI screenshot opt-in skill rule

- Summary: Chuyển screenshot trong các workflow UI sang chế độ opt-in theo keyword `screenshot`.
- Changed:
  - Cập nhật `task-ui`, `change-ui`, `task-full` và `task-connect` để chỉ chụp/lưu screenshot khi command có từ `screenshot`.
  - Đồng bộ `AGENTS.md`, UI design system và current context để browser/responsive check vẫn áp dụng nhưng screenshot không còn là mặc định.
- Files: `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/skills/task-full/SKILL.md`, `.codex/skills/task-connect/SKILL.md`, `AGENTS.md`, `docs/11-ui-design-system.md`, `.codex/context/current-context.md`
- Tests: `quick_validate.py` cho `task-ui`, `change-ui`, `task-full`, `task-connect`; `pnpm exec prettier --check` cho các file đã sửa; `git diff --check`.
- Notes: Không đổi production code.

## 2026-07-08 — M2.4 auth UI concise production polish

- Summary: Làm lại auth UI theo hướng gọn, thân thiện và chuyên nghiệp cho học sinh/phụ huynh.
- Changed:
  - Bỏ panel/card giải thích dài ở auth shell; các màn login/register/forgot/reset chỉ còn brand nhỏ, form card, tiêu đề ngắn, copy hỗ trợ tối thiểu và CTA chính.
  - Giữ register student và register parent độc lập, không link chéo giữa hai vai trò; rút gọn success state và cập nhật Playwright để không chụp screenshot mặc định.
  - Ghi rule copy ngắn gọn cho UI học sinh/phụ huynh vào UI design system, `task-ui`, `change-ui` và current context.
- Files: `apps/web/features/auth/**`, `apps/web/app/(public)/**`, `apps/web/tests/auth-ui.spec.ts`, `apps/web/playwright.config.ts`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass và không bật screenshot; `pnpm exec prettier --check` cho các file đã sửa; `git diff --check`.
- Notes: Không cập nhật `docs/ui-references/approved-patterns.md` vì owner chưa chốt UI là ưng/đúng ý.

## 2026-07-08 — M2.4 login UI copy polish

- Summary: Sửa riêng màn đăng nhập để bớt cảm giác tài liệu kỹ thuật.
- Changed:
  - Đổi brand auth từ pill lớn sang wordmark nhỏ, kéo form lên gọn hơn.
  - Đổi login title/copy thành `Chào mừng trở lại` và `Đăng nhập để tiếp tục học`; đổi label `Email, username hoặc số điện thoại` thành `Tài khoản`.
  - Đổi visible copy `username` còn lại trong auth thành `tên đăng nhập`.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-forms.tsx`, `apps/web/features/auth/auth-schemas.ts`, `apps/web/tests/auth-ui.spec.ts`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; `git diff --check`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`.

## 2026-07-08 — M2.4 auth UI youthful visual polish

- Summary: Tăng màu sắc và năng lượng học tập cho màn đăng nhập/đăng ký.
- Changed:
  - Thêm nền màu sáng, panel visual học tập ngắn, subject chips và card form nổi hơn cho auth shell.
  - Làm input/CTA trẻ trung hơn bằng nền xanh nhạt, focus ring rõ và CTA gradient.
  - Ghi rule auth UI học sinh/phụ huynh không được quá xám/lạnh vào UI design system, `task-ui`, `change-ui` và current context.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-form-primitives.tsx`, `apps/web/app/(public)/**`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; `quick_validate.py` cho `task-ui` và `change-ui`; `git diff --check`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 creative auth redesign

- Summary: Thiết kế lại auth UI theo hướng giàu hình ảnh, có font và visual identity rõ hơn.
- Changed:
  - Dùng font `Be Vietnam Pro` cho web app để typography mềm và hiện đại hơn.
  - Đổi auth shell sang nền ảnh học tập từ Unsplash, overlay gradient màu, hero slogan ngắn và form card nổi.
  - Tạo theme riêng cho login, register student, register parent và recovery; ghi rule dùng ảnh/illustration/font phù hợp vào UI docs, `task-ui`, `change-ui` và context.
- Files: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-form-primitives.tsx`, `apps/web/app/(public)/**`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; ảnh nền dùng Unsplash remote photo, chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 student-style auth illustration

- Summary: Thay ảnh nền người đi làm bằng minh họa học đường trẻ trung hơn.
- Changed:
  - Tạo và thêm asset `student-study-bg.png` với bàn học, balo, sách vở, công thức và sticker môn học.
  - Đổi auth shell sang dùng ảnh local sáng hơn, overlay nhẹ hơn, hero card nền sáng để tránh cảm giác coworking/corporate.
  - Ghi rule tránh ảnh người đi làm/coworking cho auth học sinh vào UI design system, `task-ui`, `change-ui` và current context.
- Files: `apps/web/public/images/auth/student-study-bg.png`, `apps/web/features/auth/auth-page-shell.tsx`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth split-screen reference polish

- Summary: Chỉnh auth layout theo kiểu reference: trái visual/slogan, phải form sạch.
- Changed:
  - Đổi auth shell từ background full-page + glass card sang split-screen desktop rõ ràng.
  - Bên trái giữ ảnh minh họa học đường, brand, slogan lớn và subject chips; bên phải là form trên nền trắng.
  - Ghi rule split-screen auth vào UI design system, `task-ui`, `change-ui` và current context.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth welcome slogan copy

- Summary: Đổi nội dung visual panel auth sang lời chào thương hiệu và slogan ngắn.
- Changed:
  - Thay các headline theo role bằng welcome copy như `Chào mừng bạn đến với hệ thống học tập`.
  - Thêm slogan ngắn theo từng flow, ví dụ `Nền tảng học trực tuyến giúp bạn tiến bộ từng ngày`.
  - Ghi rule auth visual panel nên dùng lời chào thương hiệu + câu định vị ngắn vào UI docs, `task-ui`, `change-ui` và current context.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth display font polish

- Summary: Đổi font heading phần visual bên trái để có cá tính trẻ trung hơn.
- Changed:
  - Thêm Google font `Baloo 2` làm display font cho heading visual panel auth.
  - Giữ `Be Vietnam Pro` cho form/body để đảm bảo dễ đọc.
  - Ghi rule dùng display font riêng có kiểm soát cho auth visual panel vào UI docs, `task-ui`, `change-ui` và current context.
- Files: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/features/auth/auth-page-shell.tsx`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth left-panel motion polish

- Summary: Làm lại phần visual bên trái auth để nhẹ, nhiều màu và có chuyển động hơn.
- Changed:
  - Giảm độ nặng của headline bằng gradient text, kích thước vừa hơn và panel trong hơn để không che mất nền học tập.
  - Thêm floating learning icons với CSS animation nhẹ và hỗ trợ `prefers-reduced-motion`.
  - Ghi rule tránh headline quá lớn/toàn đen và panel che nền cho auth visual vào UI docs, `task-ui`, `change-ui` và current context.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/app/globals.css`, `apps/web/tests/auth-ui.spec.ts`, `docs/11-ui-design-system.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; `quick_validate.py` cho `task-ui` và `change-ui`; `git diff --check`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 EduView-style auth UI

- Summary: Đổi trang đăng nhập/đăng ký sang phong cách learning dashboard theo ảnh reference owner gửi.
- Changed:
  - Thay auth shell bằng app frame bo lớn, nền lavender, top bar tối và các card học tập/progress/lịch học nhiều màu.
  - Làm form input/CTA mềm hơn với bo lớn, focus violet và CTA gradient để ăn nhập với dashboard visual.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-form-primitives.tsx`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth reference adaptation correction

- Summary: Sửa lại cách áp dụng ảnh reference để auth vẫn là auth flow, không copy bố cục dashboard.
- Changed:
  - Bỏ app-frame dashboard/topbar/progress layout quá giống reference; quay lại split-screen auth với ảnh học tập bên trái và form bên phải.
  - Giữ lại tinh thần reference ở mức phù hợp: nền lavender, bo góc lớn, mini card học tập, icon nổi và palette trẻ trung.
  - Ghi rule dùng ảnh reference như style direction, không copy literal layout, vào UI docs, `change-ui`, `task-ui` và current context.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `docs/11-ui-design-system.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; `quick_validate.py` cho `change-ui` và `task-ui`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 EduPath auth card redesign

- Summary: Làm lại UI đăng nhập, đăng ký học sinh và đăng ký phụ huynh theo phong cách card minh họa của ảnh reference.
- Changed:
  - Đổi auth shell thành card dọc với hero minh họa, brand EduPath, form card nổi và nền sáng mềm.
  - Thêm input icon, CTA theo màu từng vai trò, login tab, gợi ý mật khẩu cho học sinh và box bảo mật cho phụ huynh.
  - Dùng asset minh họa cắt từ ảnh reference owner gửi cho login, học sinh và phụ huynh; giữ đúng scope auth hiện có, không thêm social login dù ảnh mẫu có Google/Facebook.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-form-primitives.tsx`, `apps/web/features/auth/auth-forms.tsx`, `apps/web/public/images/auth/reference/**`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 mobile auth reference fixes

- Summary: Chỉnh lại auth UI để bám mobile reference và bỏ các phần thừa owner chỉ ra.
- Changed:
  - Bỏ chip chân trang ở auth shell, bỏ tab `Đăng ký` cạnh `Đăng nhập` và bỏ step `Liên kết con` ở màn phụ huynh.
  - Generate mới 3 ảnh minh họa học sinh nam, học sinh nữ và gia đình theo phong cách reference rồi đổi UI sang dùng asset mới.
  - Ghi rule reference mobile phải ưu tiên mobile layout và không tự thêm chip/tab/bước phụ vào UI docs, `change-ui`, `task-ui` và current context.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-forms.tsx`, `apps/web/public/images/auth/reference/*-generated.png`, `docs/11-ui-design-system.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; `quick_validate.py` cho `change-ui` và `task-ui`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth responsive illustration fixes

- Summary: Sửa auth UI để mobile hiện ảnh minh họa, ảnh có nền trong suốt và laptop trở lại bố cục hai cột.
- Changed:
  - Đổi login, đăng ký học sinh và đăng ký phụ huynh sang dùng 3 asset minh họa transparent.
  - Hiện minh họa ở mobile với vị trí nằm trong hero, không còn bị ẩn ở responsive điện thoại.
  - Khôi phục layout laptop dạng hai cột: visual bên trái, form bên phải.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/public/images/auth/reference/*-transparent.png`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; kiểm tra alpha 3 ảnh transparent bằng `Pillow`.
- Notes: `Pillow` được cài ở user Python để chạy helper tách nền; không thêm dependency vào repo. Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — M2.4 auth reference visual alignment

- Summary: Căn lại visual auth theo reference mobile: ảnh lớn hơn, có mảng màu loang và bỏ icon động.
- Changed:
  - Phóng lớn ảnh minh họa bé trai, bé gái và gia đình trên mobile/tablet/desktop.
  - Thêm blob màu loang tĩnh phía sau ảnh để ảnh không nằm trơ trên nền trắng.
  - Bỏ toàn bộ icon floating/animation và cố định heading thành hai dòng: 3 chữ đầu ở dòng một, phần còn lại ở dòng hai.
  - Kéo ảnh mobile về trong khung để không bị cắt mất và giới hạn vùng chữ để tránh đè ảnh.
  - Bỏ tab/box `Đăng nhập` cũ; form login/register dùng heading thật trong card.
  - Chuyển màu chủ đạo màn học sinh sang xanh dương, giữ phụ huynh xanh lá.
  - Chỉnh laptop để mô tả không đè lên ảnh và đổi `Quay lại đăng nhập` thành pill button căn giữa theo logo.
  - Bỏ offset âm của ảnh ở laptop/desktop để ảnh luôn hiển thị trọn vẹn trong panel.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `apps/web/features/auth/auth-forms.tsx`, `apps/web/features/auth/auth-form-primitives.tsx`, `apps/web/app/globals.css`, `apps/web/tests/auth-ui.spec.ts`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm --filter @learning-path/web typecheck`; `pnpm --filter @learning-path/web lint`; `pnpm --filter @learning-path/web build`; `pnpm --filter @learning-path/web e2e:auth-ui` với 18/18 pass; `pnpm exec prettier --check` cho file auth liên quan.
- Notes: Không chụp screenshot vì command không có từ `screenshot`; chưa cập nhật approved patterns vì owner chưa chốt UI.

## 2026-07-08 — ClassHero auth brand and tool-noise rule

- Summary: Đổi auth brand sang ClassHero tông xanh dương dịu hơn và ghi rule giảm lỗi hiển thị tool `Bad Request`.
- Changed:
  - Đổi wordmark auth thành `ClassHero`, logo mũ tốt nghiệp và hai sắc xanh dương gần nhau để không bị lệnh tông.
  - Ghi rule vận hành tránh `{"detail":"Bad Request"}` vào `AGENTS.md` và current context: quote path nhạy cảm, hạn chế gom tool sau khi gặp lỗi, dùng `apply_patch` cho docs/changelog.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `AGENTS.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm exec prettier --write` cho file liên quan; `git diff --check`.
- Notes: `Bad Request` là lỗi hiển thị/lớp tool Codex, không phải lỗi app; không chụp screenshot vì command không có từ `screenshot`.

## 2026-07-08 — UI lean checks and ClassHero wordmark

- Summary: Ghi rule hạn chế check nặng cho task UI và tinh chỉnh wordmark ClassHero bằng phối font.
- Changed:
  - Cập nhật `AGENTS.md`, `change-ui`, `task-ui` và current context để task UI mặc định ưu tiên lean checks, không tự động chạy typecheck/lint/build/E2E nếu chỉ sửa UI nhỏ.
  - Đổi wordmark ClassHero: `Class` và `Hero` dùng cùng display font, cùng size/cân nặng, chỉ khác hai sắc xanh dương nhẹ để cân hơn.
  - Ghi rõ khi Codex UI hiện `Bad Request` thì không được dừng task; phải kiểm tra/retry bằng lệnh đơn giản hơn và tiếp tục phần việc chính.
- Files: `AGENTS.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/context/current-context.md`, `apps/web/features/auth/auth-page-shell.tsx`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm exec prettier --write` cho file liên quan; `git diff --check`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`.

## 2026-07-08 — Adaptive Bad Request handling

- Summary: Điều chỉnh rule xử lý `Bad Request` để không làm chậm workflow toàn cục.
- Changed:
  - Giữ ưu tiên thao tác nhanh/đọc song song khi an toàn.
  - Chỉ hạ cấp sang từng bước cho thao tác vừa gây lỗi, output quá dài hoặc path/ký tự phức tạp.
- Files: `AGENTS.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm exec prettier --write` cho file liên quan; `git diff --check`.
- Notes: Đây là mitigation cho lỗi hiển thị Codex tool, không phải lỗi app.

## 2026-07-08 — Student register illustration position

- Summary: Dịch ảnh minh họa học sinh nữ ở màn đăng ký lên cao hơn.
- Changed:
  - Tách positioning riêng cho illustration `student` để ảnh không bị tụt sâu ở mobile/laptop.
  - Giữ nguyên positioning của ảnh login và phụ huynh.
- Files: `apps/web/features/auth/auth-page-shell.tsx`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm exec prettier --write` cho file liên quan; `git diff --check`.
- Notes: Không chụp screenshot vì command không có từ `screenshot`.

## 2026-07-08 — Micro UI fast path rule

- Summary: Ghi rule xử lý nhanh cho các chỉnh sửa UI rất nhỏ.
- Changed:
  - Với micro UI tweak như dịch ảnh, đổi spacing hoặc chỉnh một màu, Codex phải patch đúng thuộc tính nhỏ nhất và không gộp cleanup workflow/docs không liên quan.
  - Áp dụng rule này cho `change-ui`, `task-ui` và current context.
- Files: `.codex/skills/change-ui/SKILL.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `pnpm exec prettier --write` cho file liên quan; `git diff --check`.
- Notes: Rule này được thêm sau feedback owner về tốc độ xử lý micro UI tweak.

## 2026-07-08 — Stop chained commands after Bad Request

- Summary: Siết rule để tránh lặp lỗi Codex UI `Bad Request`.
- Changed:
  - Khi session vừa gặp `Bad Request`, không dùng shell command nối chuỗi kiểu `&&`, `;` hoặc nhiều lệnh trong một activity.
  - Vẫn giữ tốc độ bằng read-only song song khi an toàn, nhưng command kiểm tra/sửa phải tách đơn lẻ nếu đang có dấu hiệu lỗi tool UI.
- Files: `AGENTS.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `git diff --check`.
- Notes: Đây là rule vận hành Codex trong repo, không phải thay đổi app.

## 2026-07-08 — Parallel command speed preference

- Summary: Ghi rõ ưu tiên của owner là Codex chạy song song nhiều command/tool khi an toàn để tối đa tốc độ.
- Changed:
  - Cập nhật `AGENTS.md` để ưu tiên tốc độ bằng nhiều command/tool song song khi độc lập và an toàn.
  - Cập nhật current context để các phiên sau giữ preference này, chỉ hạ cấp khi tool lỗi, output quá dài hoặc thao tác có rủi ro.
- Files: `AGENTS.md`, `.codex/context/current-context.md`, `.codex/changelog/CHANGELOG_2026-07-08_codex.md`
- Tests: `git diff --check`.
- Notes: Đây là rule workflow Codex, không phải thay đổi app.

- 2026-07-08: Đồng bộ rule changelog chỉ ghi trong workflow `/commit`.
- 2026-07-08: Ghi rule ưu tiên tool song song, fast path UI nhỏ và screenshot opt-in.
- 2026-07-08: Tắt Telegram notification/bot cho tới khi owner yêu cầu bật lại.
- 2026-07-08: Dịch ảnh minh họa học sinh nữ ở màn đăng ký lên cao hơn.
