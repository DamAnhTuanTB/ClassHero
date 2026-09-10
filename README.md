# Hệ thống học theo lộ trình

MVP tổ chức dạng Turborepo:

```txt
apps/web           Next.js front-end
apps/api           NestJS API và worker
packages/shared    Type/schema/constant dùng chung
docs               Product/technical docs
.codex             Skill, context và plan cho Codex
```

README chỉ hướng dẫn vận hành nhanh. Định tuyến tài liệu nằm tại
`docs/00-docs-map.md`; luật Codex nằm tại `AGENTS.md` và skill đang được kích hoạt.

## Cài đặt

Yêu cầu: Node.js, pnpm `11.10.0` và Docker Desktop/Engine.

```bash
npm install --global pnpm@11.10.0
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

`apps/api/.env` là nguồn cấu hình API, worker, Docker Compose và hạ tầng local.
`apps/web/.env.local` chỉ chứa biến public `NEXT_PUBLIC_*` hoặc secret server-side
do Next.js sở hữu như `YOUTUBE_API_KEY`. Không đặt backend/provider secret trong
web env, không dùng `.env.example` làm runtime env và không commit env thật.

Mọi lệnh Compose phải truyền `--env-file apps/api/.env`.

## Chạy local

Cách khuyến nghị: application chạy bằng pnpm, hạ tầng chạy trong Docker.

```bash
docker compose --env-file apps/api/.env up -d postgres redis minio tex-renderer
pnpm --filter @learning-path/api prisma migrate dev
pnpm --filter @learning-path/api db:seed
pnpm dev
```

Hoặc chạy toàn bộ bằng Docker:

```bash
docker compose --env-file apps/api/.env up --build
```

Không chạy worker pnpm và worker Docker cùng lúc vì cả hai dùng chung Redis queue.

```txt
Web:     http://localhost:3000
API:     http://localhost:4000
Health:  http://localhost:4000/api/v1/health
Swagger: http://localhost:4000/api/docs
```

DBeaver local: `localhost:5432`, database `learning_path_dev`, user/password
`postgres`.

## Kiểm tra thường dùng

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
pnpm format
```

Auth UI E2E và browser dependency:

```bash
pnpm --filter @learning-path/web e2e:auth-ui
pnpm --filter @learning-path/web exec playwright install chromium
```

Chỉ lưu screenshot khi command hoặc owner yêu cầu.

## Docs và lệnh Codex

Với task có mã, luồng đọc mặc định là:

```txt
AGENTS.md đã được runtime cung cấp
→ block Mx.y trong docs/implementation/Mx.md
→ section domain đúng bề mặt thay đổi
→ code/call site/test và git status
```

Không đọc toàn bộ các file trên. Dùng `docs/00-docs-map.md` để chọn context và
xem bảng command đầy đủ.

```txt
/next-task              chọn việc tiếp theo
/task-full plan Mx.y    lập plan
/do                     duyệt plan gần nhất
/task-full Mx.y         làm trọn subtask
/fix bug ...            sửa bug
/review-docs            audit tài liệu/skill
/commit                 commit và cập nhật changelog
```

Feature-management commands mặc định chỉ sửa docs/roadmap. Codex không tự commit;
changelog chỉ được cập nhật trong `/commit`.

## Telegram local

Telegram notification/bot đang tắt và chỉ bật lại khi owner yêu cầu. Khi cần,
tạo `.codex/telegram/.env.local` từ `.codex/telegram/.env.example`, rồi chạy:

```bash
.codex/scripts/run-telegram-bot.sh
```

Bot chỉ nhận `TELEGRAM_ALLOWED_CHAT_IDS`; chat đã allow có toàn quyền local với
repo. Không commit env, token, chat ID hoặc transcript. Các script
`install-telegram-launch-agent.sh` và `uninstall-telegram-launch-agent.sh` dùng để
cài/gỡ LaunchAgent macOS.
