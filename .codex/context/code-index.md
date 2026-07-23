# Code Index

Last updated: 2026-07-23

File này là bản đồ nhanh của code hiện tại để Codex tìm đúng nơi sửa. Nó chỉ mô tả code đang có hoặc vị trí dự kiến đã được docs chốt; không thay thế việc đọc file thật trước khi sửa.

## 1. Root

| Path                                                | Vai trò                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `package.json`                                      | Script monorepo, package manager `pnpm`                                                                  |
| `pnpm-workspace.yaml`                               | Workspace `apps/*`, `packages/*`                                                                         |
| `turbo.json`                                        | Pipeline build/lint/typecheck/dev                                                                        |
| `docker-compose.yml`                                | Docker local cho web, API, Postgres, Redis và MinIO local                                                |
| `.env.example`                                      | Env root placeholder                                                                                     |
| `.codex/scripts/notify-task.sh`                     | Script thông báo hoàn thành/bị chặn/thất bại cho task Codex                                              |
| `.codex/scripts/codex-telegram-bot.py`              | Bot Telegram local chuyển tin nhắn owner thành `codex exec` full quyền; hiện đang tắt theo yêu cầu owner |
| `.codex/scripts/run-telegram-bot.sh`                | Wrapper chạy Telegram bot từ repo root                                                                   |
| `.codex/scripts/install-telegram-launch-agent.sh`   | Cài LaunchAgent macOS để Telegram bot chạy bền ở nền                                                     |
| `.codex/scripts/uninstall-telegram-launch-agent.sh` | Dừng và gỡ LaunchAgent Telegram bot                                                                      |
| `.codex/telegram/.env.example`                      | Mẫu env cho Telegram bot/notification, không chứa secret thật                                            |
| `.codex/telegram/transcript.md`                     | Transcript chat Telegram local, bị `.gitignore` chặn                                                     |

## 2. Front-end

| Path                                   | Vai trò                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/web`                             | Next.js App Router front-end                                                                                    |
| `apps/web/app/(public)/page.tsx`       | Route boundary landing page tạm thời, compose `HomeScreen` từ feature public home                               |
| `apps/web/app/(auth)/layout.tsx`       | Next.js layout chung cho auth flow, bọc `GuestRouteGuard`, visual/form layout theo route variant và mount `AppToaster` |
| `apps/web/app/(auth)/login`            | Route đăng nhập nối API thật cho `M2.4`                                                                         |
| `apps/web/app/(auth)/register`         | Route đăng ký student/parent nối API thật cho `M2.4`                                                            |
| `apps/web/app/(auth)/forgot-password`  | Route quên mật khẩu nối API thật cho `M2.4`                                                                     |
| `apps/web/app/(auth)/reset-password`   | Route đặt lại mật khẩu nối API thật cho `M2.4`                                                                  |
| `apps/web/app/(admin)/layout.tsx`      | Layout riêng admin đọc cookie theme server-side, import admin theme CSS, bọc `AuthenticatedRouteGuard` role `ADMIN` và mount `AppToaster` |
| `apps/web/app/(admin)/admin-theme.css` | CSS scoped cho admin theme/checkbox/dark bridge, chỉ import từ admin layout                                     |
| `apps/web/app/(admin)/admin/courses`   | Route UI quản lý lộ trình/chương/buổi học admin, đã nối API thật và upload ảnh cho `M3.4`                       |
| `apps/web/app/(student)/layout.tsx`     | Layout riêng student, bọc `AuthenticatedRouteGuard` role `STUDENT`, rồi render `StudentShell`/sidebar điều hướng student course |
| `apps/web/app/(student)/student/courses` | Route `M3.5` màn lộ trình đã mua của học sinh, lấy dữ liệu từ public learning path API kèm session token nếu có                                                                      |
| `apps/web/app/(student)/student/explore` | Route `M3.5` màn tất cả lộ trình published với filter lớp/môn client-side trên dữ liệu API, tách riêng khỏi `/student/courses`      |
| `apps/web/app/globals.css`             | Tailwind/global styles dùng chung thật sự cho mọi route, không chứa CSS chỉ dành cho admin                      |
| `apps/web/app/toaster`                 | Toaster wiring route-specific cho auth/admin, gom AppToaster, single-toast queue, constants và icon config      |
| `apps/web/components`                  | Root component dùng chung duy nhất, chia scope `common`, `admin`, `student`, `parent`                          |
| `apps/web/components/common/forms`     | Form primitives dùng chung mọi role, mỗi component một file, import trực tiếp file thật                        |
| `apps/web/components/common/ui/select` | Radix/shadcn select wrappers, mỗi wrapper một file, import trực tiếp, không qua file re-export trung gian      |
| `apps/web/features/auth`               | Auth domain cho API/session/schema/options/types/utils; `api/auth-api.ts` chỉ giữ request function, type API nằm trong `types/auth-api-types.ts`, error copy nằm trong `utils/auth-api-errors.ts` |
| `apps/web/features/public`             | Public home feature; màn chính ở `screens/home/index.tsx`, component local ở `screens/home/components`         |
| `apps/web/features/admin/courses`      | Admin course/chapter/lesson UI; mỗi màn nằm trong `screens/<screen>/index.tsx`, component local nằm cạnh màn trong `components/`; API client tách theo endpoint group trong `api/`, mapper trong `mappers/`, payload transformer trong `payloads/`, API DTO type trong `types/`; M4.5 document UI dùng `hooks/use-admin-course-documents-manager.ts`, `api/admin-course-documents-api.ts`, `admin-course-documents-utils.ts`, row upload dùng chung `lesson-document-upload-row.tsx` và các section document trong `screens/admin-course-detail-manager/components/` |
| `apps/web/features/student`            | Role folder student: route feature `courses`, `explore` và shared non-component API/hooks/data/types/utils               |
| `apps/web/features/student/courses`    | Feature route `/student/courses`: `purchased-courses-screen` và `student-course-detail-screen`, component local nằm dưới từng screen |
| `apps/web/features/student/explore`    | Feature route `/student/explore`: `screens/explore-courses-screen/index.tsx`, component filter local nằm cạnh screen |
| `apps/web/features/student/shared/api/student-learning-paths-api.ts` | API client cho `GET /learning-paths`, `GET /learning-paths/:slug` và mock purchase; mapper/type tách sang `shared/mappers` và `shared/types` |
| `apps/web/features/student/shared/hooks/use-student-courses-query.ts` | TanStack Query hook cho list/detail student course, tự truyền access token sau khi đọc session/token đã lưu trong trình duyệt |
| `apps/web/lib`                         | Utilities/API client dùng chung, gồm `api-client.ts`, `theme-store.ts`, `theme-constants.ts`, `server-theme.ts` |
| `apps/web/playwright.config.ts`        | Playwright config, tự build/start web và lưu report local                                                       |
| `apps/web/tests/auth-ui.spec.ts`       | E2E/screenshot smoke test cho auth UI `M2.4`                                                                    |
| `apps/web/tests`                       | Test front-end theo feature                                                                                     |

Khi làm UI mới, ưu tiên tạo code theo domain trong `apps/web/features/<feature>/` và route trong `apps/web/app/...`. Root `apps/web/app/layout.tsx` chỉ giữ provider/script/CSS cần cho mọi route; shell, toaster, CSS hoặc tool riêng role phải đặt ở route group layout hoặc lazy-load để public/client route không tải nhầm bundle admin.

## 3. Back-end

| Path                                  | Vai trò                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                            | NestJS API, dùng alias native Node `#api/...` cho import/export nội bộ trong `src`                                                                                                                                                                                            |
| `apps/api/src/main.ts`                | Entry NestJS API                                                                                                                                                                                                                                                              |
| `apps/api/src/app.module.ts`          | Root module                                                                                                                                                                                                                                                                   |
| `apps/api/src/app.controller.ts`      | Controller health/foundation hiện tại                                                                                                                                                                                                                                         |
| `apps/api/src/app.service.ts`         | Service health/foundation hiện tại                                                                                                                                                                                                                                            |
| `apps/api/src/common/api`             | API response envelope interceptor                                                                                                                                                                                                                                             |
| `apps/api/src/common/errors`          | Global HTTP error envelope filter, reusable API exception factory và Prisma error mapper để giữ `{ error: { code, message, details } }` thống nhất                                                                                                                            |
| `apps/api/src/modules`                | Domain modules                                                                                                                                                                                                                                                                |
| `apps/api/src/common`                 | Common providers/guards/filters/interceptors                                                                                                                                                                                                                                  |
| `apps/api/src/common/auth`            | JWT auth guard, optional JWT guard, roles guard/decorator và current user decorator                                                                                                                                                                                           |
| `apps/api/src/common/validation`      | Global validation error helper và explicit DTO validation pipe                                                                                                                                                                                                                |
| `apps/api/src/config`                 | Env validation và Swagger setup                                                                                                                                                                                                                                               |
| `apps/api/src/modules/auth`           | Auth/profile API cho register/login/refresh/logout, `/me`, RBAC và reset password; module root chỉ giữ `auth.module.ts`, code tách theo `controllers/services/dto/selectors/serializers/utils/types`                                                                          |
| `apps/api/src/modules/auth/dto`       | DTO validation cho auth request bodies                                                                                                                                                                                                                                        |
| `apps/api/src/modules/files`          | Files API/storage service cho upload authenticated, signed URL, local MinIO dev và S3-compatible adapter cho R2 |
| `apps/api/src/modules/learning-paths` | Public/student learning path list/detail API `M3.1`/`M3.3`/`M3.5` có optional auth, enrollment/trial state, chapters detail và progress cơ bản; `M3.6` thêm admin personal-learning-path enrollment list/create/get API, idempotent clone request và catalog privacy; admin learning path CRUD/publish/archive/restore/permanent delete, admin chapter/lesson CRUD, nhiều source documents và lesson document APIs cho `M4.2`/`M4.5`; lesson create/update nhận ordered `sourceDocumentExtractions`, revalidate same-source overlap và liên kết từng range bằng `pageRangeId`; endpoint lesson documents hỗ trợ ba kind chuẩn `PRIMARY_FROM_SOURCE`/`SUPPLEMENT`/`HOMEWORK`; document readiness/range helpers nằm trong `utils/document.helpers.ts` |
| `apps/api/src/modules/jobs`           | Job status API `GET /jobs/:jobId` đọc `background_jobs`, enforce admin/owner permission và trả trạng thái job cho UI polling; `BackgroundJobQueueService` enqueue durable job rows vào BullMQ và lưu `bullmq_job_id` |
| `apps/api/src/modules/payments`       | Payment/enrollment API layer; hiện có endpoint mock `POST /student/payments/mock-success` để nút student `Mua ngay` tạo payment `PAID` giả và enrollment active 12 tháng trong dev/MVP |
| `apps/api/src/jobs`                   | Queue/job definitions, BullMQ queue-name mapping, Redis connection parser và JSON/error helper dùng chung cho API enqueue + worker |
| `apps/api/src/workers`                | Worker entrypoint `workers/main.ts`, `WorkerModule`, document-processing processor/service cho `M4.3`; `DocumentProcessingProcessor` xử lý `M4.4` paid OCR artifact import, source page OCR, printed page mapping, visual manifest/audit, primary/supplement lesson chunking và failure status; `M3.6` có personal learning-path clone processor/worker/cloner, deep-copy mutable content, reuse file/OCR artifact và chỉ activate enrollment ở cuối transaction |
| `apps/api/src/workers/utils/ocr-artifact-versions.ts` | Version constants cho derived OCR artifacts (`pages.json`, `image-manifest.json`, `artifact-audit.json`) |
| `apps/api/src/workers/utils/ocr-artifact-normalizer.ts` | Utility normalize Mathpix artifacts thành page text/Markdown/confidence/layout refs/quality flags/`printedPage` dùng cho source pages và lesson chunks |
| `apps/api/src/workers/utils/ocr-printed-page.ts` | Utility infer `printedPage` từ OCR boundary lines và offset rule toàn tài liệu để map `pdfPageNumber` sang `printedPageNumber`/`printedPageLabel`, kèm source/confidence/evidence/warning |
| `apps/api/src/workers/utils/ocr-image-manifest.ts` | Utility normalize Mathpix crop/images thành `image-manifest.json` với page/order, `printedPage`, object key, raw/normalized bbox, page dimensions, nearby text/caption, kind heuristic, quality flags và `isUsableForAi` |
| `apps/api/src/workers/utils/ocr-visual-resolver.ts` | Utility resolve câu hỏi visual theo `printedPageNumber`/`pdfPageNumber`/query/kind từ `image-manifest.json`, trả candidates và page fallback |
| `apps/api/src/workers/utils/ocr-artifact-audit.ts` | Utility tạo `artifact-audit.json` cho page count, printed page mapping, visual bbox/object key/text/quality và resolver smoke tests |
| `apps/api/test`                       | Backend tests; có unit + PostgreSQL integration cho personal learning-path clone `M3.6`, focused/unit + integration cho `M4.2`, worker foundation `M4.3`, worker artifact/chunking `M4.4` chạy bằng Vitest, và harness live `m4.4-live-mathpix-minio.ts` để verify Mathpix + MinIO artifact/image upload khi có env thật; script live build API trước vì `#api` runtime imports trỏ `dist` |
| `apps/api/vitest.config.ts`           | Vitest config cho API tests, alias `#api/*` về `src/*` để test TypeScript source                                                                                                                                                                                              |

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
