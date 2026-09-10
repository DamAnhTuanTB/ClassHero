# Code Index

Last updated: 2026-09-10

Bản đồ ownership cấp thư mục/entrypoint. Dùng để định tuyến, sau đó đọc code,
call site và test thật; không ghi lịch sử feature hoặc mô tả implementation dài.

## Root và tooling

| Path                                                | Ownership                                  |
| --------------------------------------------------- | ------------------------------------------ |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json` | Workspace và pipeline monorepo             |
| `docker-compose.yml`                                | Hạ tầng/app container local                |
| `apps/*/.env.example`                               | Contract env mẫu; không phải env runtime   |
| `.codex/scripts/`                                   | Notification và automation local cho Codex |
| `docs/`                                             | Product/technical source of truth          |

## Web — `apps/web`

| Path                                                | Ownership                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `app/`                                              | Next.js route/layout boundary; chỉ compose feature screen và server bootstrap |
| `app/(auth)/`                                       | Auth routes/layout                                                            |
| `app/(admin)/`                                      | Admin routes/layout/theme                                                     |
| `app/(student)/`                                    | Student routes/layout                                                         |
| `app/api/auth/session/route.ts`                     | Next.js session-cookie bridge                                                 |
| `components/common/`                                | Shared UI/form/content/math primitives mọi role                               |
| `components/admin/`, `student/`, `parent/`          | Shared component theo role                                                    |
| `features/auth/`                                    | Auth API/session/schema/screens                                               |
| `features/public/`                                  | Public screens                                                                |
| `features/admin/courses/`                           | Learning path/chapter/lesson/document admin UI                                |
| `features/admin/lessons/`                           | Lesson detail, transcript, video và Video Summary admin UI                    |
| `features/admin/ai-generation/`                     | Shared admin generation/review UI                                             |
| `features/admin/ai-settings/`                       | Provider catalog, routing, budget và usage UI                                 |
| `features/admin/assessments/`                       | Shared Quiz/Test admin core                                                   |
| `features/admin/quiz/`, `flashcards/`, `tests/`     | Domain adapters/UI tương ứng                                                  |
| `features/student/courses/`, `explore/`, `lessons/` | Student catalog và learning flow                                              |
| `lib/`                                              | Cross-feature client utilities; chỉ đặt logic thật sự dùng chung              |
| `tests/`                                            | Web unit/contract/Playwright tests                                            |

Feature code ưu tiên `api/data/hooks/screens/schemas/types/utils`; component chỉ
dùng một màn nằm trong `screens/<screen>/components`. Import nội bộ dùng `@/...`.

## API và worker — `apps/api`

| Path                                                 | Ownership                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/main.ts`, `src/app.module.ts`                   | API bootstrap/root module                                               |
| `src/common/`                                        | Auth, errors, validation và cross-domain infrastructure                 |
| `src/config/`                                        | Env validation và Swagger/config                                        |
| `src/modules/auth/`                                  | Auth/profile/RBAC                                                       |
| `src/modules/domains/`                               | Catalog lĩnh vực/đối tượng                                              |
| `src/modules/files/`                                 | Upload, signed URL và storage adapter                                   |
| `src/modules/learning-paths/`                        | Course/chapter/lesson/document, transcript và Video Summary API/service |
| `src/modules/student-learning/`                      | Student lesson aggregate, navigation, attempts/progress                 |
| `src/modules/assessments/`                           | Shared Quiz/Test admin behavior                                         |
| `src/modules/quiz/`, `flashcards/`, `tests/`         | Domain CRUD/attempt adapters                                            |
| `src/modules/ai/`                                    | Provider-neutral AI lifecycle, retrieval và Lesson Summary core         |
| `src/modules/provider-operations/`                   | Catalog/price/routing/budget/usage accounting                           |
| `src/modules/question-figures/`, `solution-figures/` | Shared question/solution figure core                                    |
| `src/modules/quiz-figures/`, `stem-figures/`         | Figure persistence/lifecycle/admin operations                           |
| `src/modules/jobs/`                                  | Job-status API và enqueue boundary                                      |
| `src/jobs/`                                          | Queue names, Redis/job helpers và shared job errors                     |
| `src/workers/`                                       | Worker bootstrap, processors và provider execution; restart sau khi sửa |
| `tex-renderer/`                                      | Isolated TeX Live/LuaLaTeX → SVG service                                |
| `test/`                                              | API unit/integration/live opt-in tests                                  |

M15.9 entrypoints hiện nằm trong `modules/learning-paths/` và
`workers/services/video-summary-generation.service.ts`; tìm `video-summary` để
mở controller, DTO, service, prompt/schema/source helpers và focused tests.
Backend import nội bộ dùng `#api/...`; root domain chỉ giữ `*.module.ts`, phần còn
lại chia theo `controllers/services/dto/selectors/serializers/utils/types`.

## Database và shared package

| Path                             | Ownership                            |
| -------------------------------- | ------------------------------------ |
| `apps/api/prisma/schema.prisma`  | Prisma schema nguồn                  |
| `apps/api/prisma/migrations/`    | Migration bất biến theo thời gian    |
| `apps/api/prisma/seed.ts`        | Seed dev/test                        |
| `packages/shared/src/schemas/`   | Shared Zod contracts                 |
| `packages/shared/src/types/`     | Shared TypeScript types              |
| `packages/shared/src/constants/` | Shared constants/versioned manifests |
| `packages/shared/src/index.ts`   | Public exports                       |

## Khi cập nhật index

Chỉ cập nhật khi thêm/di chuyển domain, entrypoint, worker, API client hoặc shared
contract quan trọng. Không liệt kê từng component/helper/migration và không ghi
feature history; dùng `rg`/`rg --files` để tìm file cụ thể.
