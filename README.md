# Hệ thống học theo lộ trình

MVP hệ thống học theo lộ trình. Repo dùng monorepo Turborepo:

```txt
apps/web           Next.js front-end
apps/api           NestJS back-end
packages/shared    Type, schema, constant dùng chung
docs/              Tài liệu sản phẩm/kỹ thuật
.codex/            Skill, prompt, context, changelog cho Codex
```

README này là cửa vào nhanh cho owner/người mới. Bản đồ đọc docs nằm ở `docs/00-docs-map.md`. Luật làm việc chi tiết của Codex nằm ở `AGENTS.md` và `.codex/skills/*/SKILL.md`.

---

## 1. Cài đặt

Cần có:

```txt
Node.js
pnpm 11.10.0
Docker Desktop hoặc Docker Engine
```

Cài pnpm nếu chưa có:

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

## 2. Chạy local

Chạy database local và Redis:

```bash
docker compose up -d postgres redis
```

Apply migration và seed dữ liệu mẫu:

```bash
pnpm --filter @learning-path/api prisma migrate dev
pnpm --filter @learning-path/api db:seed
```

DBeaver có thể kết nối database local bằng:

```txt
Host: localhost
Port: 5432
Database: learning_path_dev
Username: postgres
Password: postgres
```

Chạy cả web và API:

```bash
pnpm dev
```

Mở:

```txt
Web:    http://localhost:3000
API:    http://localhost:4000
Health: http://localhost:4000/api/v1/health
```

Chạy riêng từng app:

```bash
pnpm --filter @learning-path/web dev
pnpm --filter @learning-path/api dev
```

Docker local:

```bash
docker compose up --build
```

---

## 3. Check thường dùng

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

Format:

```bash
pnpm format
```

---

## 4. Cách đọc docs

Luồng đọc chuẩn khi làm task:

```txt
AGENTS.md
-> docs/00-docs-map.md nếu cần định tuyến nhanh
-> docs/09-implementation-plan.md
-> docs/implementation/Mx.md theo mã task
-> docs domain liên quan
-> code hiện tại
```

Các nguồn quan trọng:

```txt
AGENTS.md                                  Luật làm việc cao nhất cho Codex
docs/00-docs-map.md                       Bản đồ đọc docs nhanh
docs/01-product-scope.md                  Scope MVP và nghiệp vụ
docs/02-user-flows.md                     Luồng sử dụng
docs/03-technical-architecture.md         Kiến trúc và stack
docs/04-database-model.md                 Index database
docs/database/                            Database chi tiết theo domain
docs/05-api-contract.md                   Index API
docs/api/                                 API chi tiết theo domain
docs/06-ai-rag-spec.md                    AI/RAG
docs/07-integration-and-env.md            Env và tích hợp
docs/08-ui-pages-and-components.md        Màn hình/component
docs/09-implementation-plan.md            Index milestone/subtask
docs/implementation/                      Chi tiết milestone M0..M14
docs/11-ui-design-system.md               UI design system
docs/12-performance-and-observability.md  Hiệu năng/đo đạc
docs/13-seo-and-content-discovery.md      SEO/public discovery
```

File hỗ trợ Codex:

```txt
.codex/context/current-context.md         Trạng thái repo hiện tại
.codex/context/code-index.md              Bản đồ code hiện tại
.codex/plans/codex-execution-plan.md      Ghi chú phụ thuộc nếu cần
.codex/changelog/                         Changelog ngắn mỗi thay đổi
```

---

## 5. Cheatsheet cho owner

| Bạn muốn                       | Lệnh                                |
| ------------------------------ | ----------------------------------- |
| Hỏi việc tiếp theo             | `/next-task`                        |
| Làm trọn subtask               | `/task-full Mx.y`                   |
| Lập plan trước                 | `/task-full plan Mx.y`              |
| Làm UI bằng mock data          | `/task-ui Mx.y`                     |
| Sửa UI theo feedback           | `/change-ui ...`                    |
| Nối UI với API thật            | `/task-connect Mx.y`                |
| Duyệt plan gần nhất            | `/do`                               |
| Sửa bug                        | `/fix bug ...`                      |
| Refactor không đổi behavior    | `/refactor ...`                     |
| Thêm feature vào docs/roadmap  | `/add-feature ...`                  |
| Đổi feature trong docs/roadmap | `/update-feature ...`               |
| Xóa feature khỏi scope/roadmap | `/delete-feature ...`               |
| Hoãn feature sang version sau  | `/move-feature-to-next-version ...` |
| Review docs/skill              | `/review-docs`                      |
| Commit thay đổi                | `/commit`                           |

Ví dụ:

```txt
/next-task
/task-full M1.2
/task-ui plan M3.5
/task-connect M3.5
/fix bug lỗi 500 khi mở API
/commit
```

---

## 6. Quy trình UI khuyến nghị

```txt
/task-ui Mx.y
review UI
/change-ui <góp ý>
nói "ưng rồi" khi chốt UI
/task-connect Mx.y
```

Khi owner nói UI đã `ưng`, `ok`, `đúng ý`, hoặc `chốt UI này`, Codex lưu pattern vào `docs/ui-references/approved-patterns.md`. Chỉ cập nhật `docs/11-ui-design-system.md` nếu đó là rule dùng rộng.

---

## 7. Feature management

Các lệnh sau mặc định chỉ sửa docs/roadmap/task code, chưa sửa production code:

```txt
/add-feature <mô tả>
/update-feature <mô tả>
/delete-feature <mô tả>
/move-feature-to-next-version <mô tả>
```

Sau khi cập nhật docs, Codex sẽ gợi ý task implementation tiếp theo nếu xác định được.

---

## 8. Changelog và commit

Khi thay đổi file đáng commit, Codex cập nhật:

```txt
.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md
```

Codex không tự commit nếu owner chưa yêu cầu. Khi muốn commit:

```txt
/commit
/commit fast
/commit full
```

---

## 9. Khi không chắc bắt đầu từ đâu

Dùng:

```txt
/next-task
```

Codex sẽ đọc roadmap, context, changelog và git status để gợi ý bước tiếp theo.
