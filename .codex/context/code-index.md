# Code Index

Last updated: 2026-07-10

File này là bản đồ nhanh của code hiện tại để Codex tìm đúng nơi sửa. Nó chỉ mô tả code đang có hoặc vị trí dự kiến đã được docs chốt; không thay thế việc đọc file thật trước khi sửa.

## 1. Root

| Path                                                | Vai trò                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `package.json`                                      | Script monorepo, package manager `pnpm`                                                                  |
| `pnpm-workspace.yaml`                               | Workspace `apps/*`, `packages/*`                                                                         |
| `turbo.json`                                        | Pipeline build/lint/typecheck/dev                                                                        |
| `docker-compose.yml`                                | Docker local cho web, API, Postgres và Redis                                                             |
| `.env.example`                                      | Env root placeholder                                                                                     |
| `.codex/scripts/notify-task.sh`                     | Script thông báo hoàn thành/bị chặn/thất bại cho task Codex                                              |
| `.codex/scripts/codex-telegram-bot.py`              | Bot Telegram local chuyển tin nhắn owner thành `codex exec` full quyền; hiện đang tắt theo yêu cầu owner |
| `.codex/scripts/run-telegram-bot.sh`                | Wrapper chạy Telegram bot từ repo root                                                                   |
| `.codex/scripts/install-telegram-launch-agent.sh`   | Cài LaunchAgent macOS để Telegram bot chạy bền ở nền                                                     |
| `.codex/scripts/uninstall-telegram-launch-agent.sh` | Dừng và gỡ LaunchAgent Telegram bot                                                                      |
| `.codex/telegram/.env.example`                      | Mẫu env cho Telegram bot/notification, không chứa secret thật                                            |
| `.codex/telegram/transcript.md`                     | Transcript chat Telegram local, bị `.gitignore` chặn                                                     |

## 2. Front-end

| Path                                    | Vai trò                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `apps/web`                              | Next.js App Router front-end                                              |
| `apps/web/app/(public)/page.tsx`        | Landing page tạm thời, có link vào auth UI                                |
| `apps/web/app/(public)/login`           | Route đăng nhập nối API thật cho `M2.4`                                   |
| `apps/web/app/(public)/register`        | Route đăng ký student/parent nối API thật cho `M2.4`                      |
| `apps/web/app/(public)/forgot-password` | Route quên mật khẩu nối API thật cho `M2.4`                               |
| `apps/web/app/(public)/reset-password`  | Route đặt lại mật khẩu nối API thật cho `M2.4`                            |
| `apps/web/app/globals.css`              | Tailwind/global styles                                                    |
| `apps/web/components`                   | Component dùng chung, gồm primitive UI như select                         |
| `apps/web/features/auth`                | Auth UI shell, forms, Zod schemas, API client và session store cho `M2.4` |
| `apps/web/lib`                          | Client utilities/API client dùng chung, gồm `api-client.ts`               |
| `apps/web/playwright.config.ts`         | Playwright config, tự build/start web và lưu report local                 |
| `apps/web/tests/auth-ui.spec.ts`        | E2E/screenshot smoke test cho auth UI `M2.4`                              |
| `apps/web/tests`                        | Test front-end theo feature                                               |

Khi làm UI mới, ưu tiên tạo code theo domain trong `apps/web/features/<feature>/` và route trong `apps/web/app/...`.

## 3. Back-end

| Path                                  | Vai trò                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                            | NestJS API                                                                                                                         |
| `apps/api/src/main.ts`                | Entry NestJS API                                                                                                                   |
| `apps/api/src/app.module.ts`          | Root module                                                                                                                        |
| `apps/api/src/app.controller.ts`      | Controller health/foundation hiện tại                                                                                              |
| `apps/api/src/app.service.ts`         | Service health/foundation hiện tại                                                                                                 |
| `apps/api/src/common/api`             | API response envelope interceptor                                                                                                  |
| `apps/api/src/common/errors`          | Global HTTP error envelope filter                                                                                                  |
| `apps/api/src/modules`                | Domain modules                                                                                                                     |
| `apps/api/src/common`                 | Common providers/guards/filters/interceptors                                                                                       |
| `apps/api/src/common/auth`            | JWT auth guard, roles guard/decorator và current user decorator                                                                    |
| `apps/api/src/common/validation`      | Global validation error helper và explicit DTO validation pipe                                                                     |
| `apps/api/src/config`                 | Env validation và Swagger setup                                                                                                    |
| `apps/api/src/modules/auth`           | Auth/profile API cho register/login/refresh/logout, `/me`, RBAC và reset password                                                  |
| `apps/api/src/modules/auth/dto`       | DTO validation cho auth request bodies                                                                                             |
| `apps/api/src/modules/learning-paths` | Public published learning path API tối thiểu, admin learning path CRUD/publish API `M3.1`, và admin lesson CRUD/publish API `M3.2` |
| `apps/api/src/jobs`                   | Queue/job definitions                                                                                                              |
| `apps/api/src/workers`                | Worker entrypoints/processors                                                                                                      |
| `apps/api/test`                       | Backend tests                                                                                                                      |

Khi làm API mới, ưu tiên tạo module trong `apps/api/src/modules/<domain>/` với controller/service/DTO/guard theo NestJS.

## 4. Database

| Path                            | Vai trò                                |
| ------------------------------- | -------------------------------------- |
| `apps/api/prisma/schema.prisma` | Prisma schema chính                    |
| `apps/api/prisma/migrations`    | Migration SQL/Prisma                   |
| `apps/api/prisma/seed.ts`       | Seed dev tối thiểu cho M1.6            |
| `apps/api/prisma.config.ts`     | Prisma 7 config                        |
| `apps/api/tsconfig.seed.json`   | Typecheck riêng cho Prisma seed script |

Khi đổi schema, đọc `docs/04-database-model.md` và file con trong `docs/database/`, sau đó cập nhật migration/docs. Changelog chỉ ghi trong workflow `/commit`.

## 5. Shared Package

| Path                            | Vai trò                 |
| ------------------------------- | ----------------------- |
| `packages/shared/src/types`     | Shared TypeScript types |
| `packages/shared/src/schemas`   | Shared Zod schemas      |
| `packages/shared/src/constants` | Constants dùng chung    |
| `packages/shared/src/index.ts`  | Public export           |

Shared package dùng cho schema/type có thể chia sẻ giữa web và API, tránh duplicate contract.

## 6. Khi nào cập nhật file này

Codex nên cập nhật file này khi:

- Tạo module/domain mới.
- Di chuyển file hoặc đổi cấu trúc thư mục quan trọng.
- Thêm entrypoint worker, API client, shared schema lớn.
- Một path trong bảng không còn đúng.

Không ghi danh sách mọi file nhỏ; chỉ ghi bản đồ giúp tìm code nhanh.
