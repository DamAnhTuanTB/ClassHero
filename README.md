# Hệ thống học theo lộ trình

Dự án MVP cho hệ thống học theo lộ trình. Repo dùng monorepo Turborepo, gồm:

```txt
apps/web           Next.js front-end
apps/api           NestJS back-end
packages/shared    Type, schema, constant dùng chung
docs/              Tài liệu sản phẩm/kỹ thuật
.codex/            Skill, prompt, context, changelog cho Codex
```

README này là hướng dẫn nhanh cho người mới. Chi tiết quy tắc làm việc của Codex nằm trong `AGENTS.md` và `.codex/skills/*/SKILL.md`.

---

## 1. Cài Đặt Lần Đầu

Cần có:

```txt
Node.js
pnpm 11.10.0
```

Nếu chưa có pnpm:

```bash
npm install --global pnpm@11.10.0
```

Cài dependencies:

```bash
pnpm install
```

Tạo env local:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Không commit file `.env` thật.

---

## 2. Chạy Dự Án Local

Chạy cả front-end và back-end:

```bash
pnpm dev
```

Mở:

```txt
Front-end: http://localhost:3000
Back-end:  http://localhost:4000
Health:    http://localhost:4000/api/v1/health
```

Chạy riêng từng app:

```bash
pnpm --filter @learning-path/web dev
pnpm --filter @learning-path/api dev
```

Chạy bằng Docker local:

```bash
docker compose up --build
```

Docker local chạy:

```txt
Web:   http://localhost:3000
API:   http://localhost:4000
Redis: localhost:6379
```

---

## 3. Lệnh Kiểm Tra

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
```

Format code:

```bash
pnpm format
```

---

## 4. Cơ Chế Tài Liệu

Bộ docs nhiều là có chủ đích, nhưng Codex không đọc tất cả mỗi lần. Cơ chế chuẩn là **đọc theo tầng**:

```txt
AGENTS.md
-> docs/09-implementation-plan.md
-> docs/implementation/Mx.md theo mã task
-> docs domain liên quan
-> code hiện tại
```

Các file nguồn chính:

```txt
AGENTS.md                                      Luật làm việc cao nhất cho Codex
docs/01-product-scope.md                      Scope MVP và nghiệp vụ
docs/02-user-flows.md                         Luồng sử dụng
docs/03-technical-architecture.md             Kiến trúc và stack
docs/04-database-model.md                     Index database
docs/database/                                Database chi tiết theo domain
docs/05-api-contract.md                       Index API
docs/api/                                     API chi tiết theo domain
docs/06-ai-rag-spec.md                        AI/RAG
docs/07-integration-and-env.md                Env và tích hợp
docs/08-ui-pages-and-components.md            Màn hình/component
docs/09-implementation-plan.md                Index milestone/subtask
docs/implementation/                          Chi tiết milestone M0..M14
docs/10-seed-data-and-test-cases.md           Seed/test case
docs/11-ui-design-system.md                   UI design system
docs/12-performance-and-observability.md      Hiệu năng/đo đạc
docs/13-seo-and-content-discovery.md          SEO/public discovery
docs/learning-notes/                          Sổ tay kỹ thuật học lại
docs/ui-references/                           Pattern UI đã duyệt
docs/decisions/                               Decision log
```

File hỗ trợ Codex:

```txt
.codex/context/current-context.md             Trạng thái repo hiện tại
.codex/context/code-index.md                  Bản đồ code hiện tại
.codex/plans/codex-execution-plan.md          Ghi chú thứ tự/phụ thuộc nếu cần
.codex/changelog/                             Changelog ngắn mỗi thay đổi
```

Các file hỗ trợ trên giúp Codex định hướng nhanh, nhưng không thay thế docs gốc.

---

## 5. Cơ Chế Task `Mx.y`

Khi bạn giao task dạng `Mx.y`, Codex lấy phần `Mx` để mở file milestone tương ứng:

```txt
M0.2  -> docs/implementation/M0.md
M1.4  -> docs/implementation/M1.md
M3.4  -> docs/implementation/M3.md
M8.3  -> docs/implementation/M8.md
M10.2 -> docs/implementation/M10.md
```

Luồng đọc chuẩn khi bạn gõ `/task-full M8.3`:

```txt
Đọc AGENTS.md
-> đọc docs/09-implementation-plan.md
-> đọc docs/implementation/M8.md
-> đọc Mode của M8.3
-> đọc docs liên quan theo Task Routing Map
-> đọc code hiện tại
-> nêu kế hoạch ngắn
-> mới sửa file
```

`Mode` trong milestone cho biết bề mặt chính của task:

```txt
UI only             Chỉ UI/mock data
API only            Backend/API/service
UI + API            Có cả UI và API
DB only             Prisma/schema/migration/seed
Worker/Integration  Worker, queue, storage, AI, payment, realtime, deploy
Docs only           Chỉ tài liệu/kế hoạch
```

---

## 6. Skill Codex

Giao việc bằng các lệnh sau:

| Bạn muốn | Lệnh |
| --- | --- |
| Làm UI bằng mock data | `/task-ui Mx.y` |
| Nối UI với API thật | `/task-connect Mx.y` |
| Làm trọn subtask | `/task-full Mx.y` |
| Sửa UI theo feedback | `/change-ui ...` |
| Sửa bug | `/fix bug ...` |
| Refactor không đổi behavior | `/refactor ...` |
| Thêm feature vào docs/roadmap | `/add-feature ...` |
| Đổi feature trong docs/roadmap | `/update-feature ...` |
| Xóa feature khỏi scope/roadmap | `/delete-feature ...` |
| Hoãn feature sang version sau | `/move-feature-to-next-version ...` |
| Hỏi task tiếp theo | `/next-task` |
| Rà soát docs/skill | `/review-docs` |
| Duyệt plan và bắt đầu làm | `/do` |
| Commit thay đổi | `/commit` |

Ví dụ:

```txt
/task-full M1.2
/task-ui plan M3.5
/task-connect M3.5
/change-ui sửa landing page phần hero
/fix bug lỗi 500 khi mở API
/review-docs
/commit fast
```

Chi tiết từng skill nằm trong:

```txt
.codex/skills/<tên-skill>/SKILL.md
```

---

## 7. Quy Trình Task Khuyến Nghị

### Làm nhanh một subtask rõ scope

```txt
/task-full Mx.y
```

Codex sẽ làm đủ phần cần thiết trong phạm vi task: UI, API, database, worker/integration hoặc docs tùy `Mode`.

### Làm UI trước để review

```txt
/task-ui Mx.y
review UI
/change-ui <góp ý>
nói "ưng rồi" khi chốt UI
/task-connect Mx.y
```

Khi bạn nói UI đã `ưng`, `ok`, `đúng ý`, `chốt UI này`, Codex sẽ lưu pattern vào `docs/ui-references/approved-patterns.md`. Nếu đó là rule dùng rộng, Codex mới cập nhật `docs/11-ui-design-system.md`.

### Muốn Codex lập plan trước

```txt
/task-full plan Mx.y
/task-ui plan Mx.y
/task-connect plan Mx.y
```

Sau khi xem plan, nếu đồng ý:

```txt
/do
```

`/do` nghĩa là duyệt plan gần nhất và cho Codex bắt đầu triển khai.

---

## 8. Feature Management

Các skill sau mặc định chỉ sửa docs/roadmap/task code, chưa code production:

```txt
/add-feature <mô tả>
/update-feature <mô tả>
/delete-feature <mô tả>
/move-feature-to-next-version <mô tả>
```

Codex sẽ cập nhật source of truth như product scope, user flows, API/database/UI/AI docs, implementation milestone, dependency graph hoặc feature coverage nếu cần. Sau đó Codex gợi ý task code tiếp theo để triển khai.

---

## 9. Performance, UI Và SEO

Dự án ưu tiên:

- UI mobile-first, vẫn ổn trên tablet/iPad và laptop/desktop.
- Tương tác mobile mượt, phản hồi nhanh, ít layout shift.
- API/database/worker/AI có hiệu năng phù hợp MVP và có đo đạc.
- Public page có nền SEO tốt để Google crawl/index đúng.

Khi task liên quan, Codex đọc:

```txt
UI/responsive          -> docs/11-ui-design-system.md
Hiệu năng/độ trễ       -> docs/12-performance-and-observability.md
SEO/public discovery   -> docs/13-seo-and-content-discovery.md
```

---

## 10. Learning Notes

Sau các task có giải thích kỹ thuật có giá trị học lại, Codex có thể cập nhật:

```txt
docs/learning-notes/
```

Nguyên tắc:

- Ghi theo feature-first.
- Merge vào note cũ nếu đã có.
- Không copy nguyên văn final response.
- Tránh lặp lại rule đã có trong docs nguồn.

---

## 11. Changelog Và Commit

Khi thay đổi file đáng commit, Codex cập nhật:

```txt
.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md
```

Codex không tự commit nếu bạn chưa yêu cầu. Khi muốn commit:

```txt
/commit
/commit fast
/commit full
```

Gợi ý:

- `/commit fast`: docs/skill nhỏ, muốn nhanh.
- `/commit`: mặc định, Codex tự chọn check theo diff.
- `/commit full`: thay đổi rủi ro cao, schema/dependency/shared package/nhiều module.

---

## 12. Lean Mode

Với task nhỏ, docs-only, UI nhỏ, wording, config nhẹ hoặc bug cô lập, Codex có thể dùng lean mode để làm nhanh:

- không chạy full lint/build/test toàn repo,
- chỉ chạy check nhỏ nhất đủ tin cậy,
- ghi rõ check nào đã chạy hoặc bỏ qua.

Không dùng lean mode cho thay đổi rủi ro cao như auth/RBAC, payment, database/schema, API contract, AI/RAG, worker, storage, notification, security hoặc multi-module behavior.

---

## 13. Khi Không Chắc Làm Gì

Dùng:

```txt
/next-task
```

Codex sẽ đọc roadmap, context, changelog và git status để gợi ý bước tiếp theo.
