# Hệ thống học theo lộ trình

MVP hệ thống học theo lộ trình, tổ chức dưới dạng Turborepo:

```txt
apps/web           Next.js front-end
apps/api           NestJS API và worker source
packages/shared    Type, schema, constant dùng chung
docs/              Tài liệu sản phẩm/kỹ thuật
.codex/            Skill, prompt, context và plan cho Codex
```

README là cửa vào vận hành. Bản đồ tài liệu nằm ở `docs/00-docs-map.md`; luật
làm việc của Codex nằm ở `AGENTS.md` và `.codex/skills/*/SKILL.md`.

## 1. Cài đặt

Yêu cầu: Node.js, pnpm `11.10.0` và Docker Desktop/Engine.

```bash
npm install --global pnpm@11.10.0
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Không commit file `.env` thật.

## 2. Chạy local

Khởi động Postgres và Redis, apply migration, seed rồi chạy web/API:

```bash
docker compose up -d postgres redis
pnpm --filter @learning-path/api prisma migrate dev
pnpm --filter @learning-path/api db:seed
pnpm dev
```

Các địa chỉ mặc định:

```txt
Web:     http://localhost:3000
API:     http://localhost:4000
Health:  http://localhost:4000/api/v1/health
Swagger: http://localhost:4000/api/docs
```

Chạy riêng hoặc chạy toàn bộ bằng Docker:

```bash
pnpm --filter @learning-path/web dev
pnpm --filter @learning-path/api dev
docker compose up --build
```

DBeaver local dùng `localhost:5432`, database `learning_path_dev`, user/password
`postgres`.

## 3. Kiểm tra thường dùng

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
pnpm format
```

Auth UI E2E:

```bash
pnpm --filter @learning-path/web e2e:auth-ui
pnpm --filter @learning-path/web exec playwright install chromium
```

Chỉ sinh/lưu screenshot khi command hoặc yêu cầu có từ `screenshot`.

## 4. Cách đọc docs

Luồng mặc định cho một task:

```txt
AGENTS.md
-> docs/00-docs-map.md nếu cần định tuyến
-> docs/09-implementation-plan.md
-> docs/implementation/Mx.md theo mã task
-> docs domain liên quan
-> code hiện tại
```

Các index chính:

| Phạm vi                | File                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Scope và flow          | `docs/01-product-scope.md`, `docs/02-user-flows.md`                                                                    |
| Kiến trúc/env          | `docs/03-technical-architecture.md`, `docs/07-integration-and-env.md`                                                  |
| Database/API           | `docs/04-database-model.md`, `docs/05-api-contract.md`                                                                 |
| AI/RAG                 | `docs/06-ai-rag-spec.md`                                                                                               |
| UI                     | `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`                                                    |
| Roadmap                | `docs/09-implementation-plan.md`, `docs/implementation/`                                                               |
| Performance/SEO/source | `docs/12-performance-and-observability.md`, `docs/13-seo-and-content-discovery.md`, `docs/14-source-code-structure.md` |

`docs/04-database-model.md` và `docs/05-api-contract.md` là index; khi chạm DB/API
phải mở file domain tương ứng trong `docs/database/` hoặc `docs/api/`.

## 5. Lệnh owner hay dùng

| Mục tiêu                   | Lệnh                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Chọn việc tiếp theo        | `/next-task`                                                                                          |
| Làm trọn subtask           | `/task-full Mx.y`                                                                                     |
| Lập plan trước             | `/task-full plan Mx.y`                                                                                |
| Dựng UI bằng mock          | `/task-ui Mx.y`                                                                                       |
| Sửa UI theo feedback       | `/change-ui ...`                                                                                      |
| Nối UI với API thật        | `/task-connect Mx.y`                                                                                  |
| Duyệt plan gần nhất        | `/do`                                                                                                 |
| Sửa bug/refactor           | `/fix bug ...`, `/refactor ...`                                                                       |
| Quản lý feature trong docs | `/add-feature ...`, `/update-feature ...`, `/delete-feature ...`, `/move-feature-to-next-version ...` |
| Review docs/skill          | `/review-docs`                                                                                        |
| Commit                     | `/commit`                                                                                             |

Quy trình UI thường dùng:

```txt
/task-ui Mx.y
/change-ui <góp ý>
nói "ưng rồi" khi chốt UI
/task-connect Mx.y
```

Các lệnh quản lý feature mặc định chỉ cập nhật docs/roadmap, chưa sửa production
code. Changelog cũng chỉ được ghi trong workflow `/commit` khi commit thật sự
được tạo.

## 6. Điều khiển Codex qua Telegram

Telegram notification/bot hiện đang tắt và chỉ bật lại khi owner yêu cầu rõ.
Khi cần dùng, tạo `.codex/telegram/.env.local` từ
`.codex/telegram/.env.example`, sau đó chạy:

```bash
.codex/scripts/run-telegram-bot.sh
```

Các script `install-telegram-launch-agent.sh` và
`uninstall-telegram-launch-agent.sh` dùng để cài/gỡ LaunchAgent macOS. Bot chỉ
nhận lệnh từ `TELEGRAM_ALLOWED_CHAT_IDS`; các chat ID đã allow có quyền local đầy
đủ với repo. Không commit `.env.local`, token, chat ID riêng hoặc transcript.

## 7. Commit và bước tiếp theo

Codex không tự commit. Khi muốn lưu thay đổi:

```txt
/commit
/commit fast
/commit full
```

Nếu chưa biết bắt đầu từ đâu, dùng `/next-task`; Codex sẽ đọc roadmap, context,
changelog và trạng thái git để đề xuất subtask phù hợp.
