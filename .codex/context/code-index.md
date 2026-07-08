# Code Index

Last updated: 2026-07-08

File này là bản đồ nhanh của code hiện tại để Codex tìm đúng nơi sửa. Nó chỉ mô tả code đang có hoặc vị trí dự kiến đã được docs chốt; không thay thế việc đọc file thật trước khi sửa.

## 1. Root

| Path                  | Vai trò                                 |
| --------------------- | --------------------------------------- |
| `package.json`        | Script monorepo, package manager `pnpm` |
| `pnpm-workspace.yaml` | Workspace `apps/*`, `packages/*`        |
| `turbo.json`          | Pipeline build/lint/typecheck/dev       |
| `docker-compose.yml`  | Docker local cho web, API và Redis      |
| `.env.example`        | Env root placeholder                    |

## 2. Front-end

| Path                             | Vai trò                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `apps/web`                       | Next.js App Router front-end                                         |
| `apps/web/app/(public)/page.tsx` | Landing page tạm thời                                                |
| `apps/web/app/globals.css`       | Tailwind/global styles                                               |
| `apps/web/components`            | Component dùng chung, hiện mới có `.gitkeep`                         |
| `apps/web/features`              | Feature UI theo domain, hiện mới có `.gitkeep`                       |
| `apps/web/lib`                   | Client utilities/API client/hooks dùng chung, hiện mới có `.gitkeep` |
| `apps/web/tests`                 | Test front-end, hiện mới có `.gitkeep`                               |

Khi làm UI mới, ưu tiên tạo code theo domain trong `apps/web/features/<feature>/` và route trong `apps/web/app/...`.

## 3. Back-end

| Path                             | Vai trò                                      |
| -------------------------------- | -------------------------------------------- |
| `apps/api`                       | NestJS API                                   |
| `apps/api/src/main.ts`           | Entry NestJS API                             |
| `apps/api/src/app.module.ts`     | Root module                                  |
| `apps/api/src/app.controller.ts` | Controller health/foundation hiện tại        |
| `apps/api/src/app.service.ts`    | Service health/foundation hiện tại           |
| `apps/api/src/modules`           | Domain modules, hiện mới có `.gitkeep`       |
| `apps/api/src/common`            | Common providers/guards/filters/interceptors |
| `apps/api/src/config`            | Config/env helpers                           |
| `apps/api/src/jobs`              | Queue/job definitions                        |
| `apps/api/src/workers`           | Worker entrypoints/processors                |
| `apps/api/test`                  | Backend tests                                |

Khi làm API mới, ưu tiên tạo module trong `apps/api/src/modules/<domain>/` với controller/service/DTO/guard theo NestJS.

## 4. Database

| Path                            | Vai trò                                |
| ------------------------------- | -------------------------------------- |
| `apps/api/prisma/schema.prisma` | Prisma schema chính                    |
| `apps/api/prisma/migrations`    | Migration SQL/Prisma                   |
| `apps/api/prisma/seed.ts`       | Seed dev tối thiểu cho M1.6            |
| `apps/api/prisma.config.ts`     | Prisma 7 config                        |
| `apps/api/tsconfig.seed.json`   | Typecheck riêng cho Prisma seed script |

Khi đổi schema, đọc `docs/04-database-model.md` và file con trong `docs/database/`, sau đó cập nhật migration/docs/changelog.

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
