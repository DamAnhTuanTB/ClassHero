# Hệ thống học theo lộ trình

Dự án MVP cho hệ thống học theo lộ trình, gồm front-end Next.js, back-end NestJS và package shared dùng chung trong một monorepo Turborepo.

## Cần cài trước

- Node.js
- pnpm `11.10.0`

Nếu chưa có pnpm:

```bash
npm install --global pnpm@11.10.0
```

## Cài dependencies

```bash
pnpm install
```

## Chạy local

Chạy cả front-end và back-end:

```bash
pnpm dev
```

Mở trên trình duyệt:

```txt
Front-end: http://localhost:3000
Back-end:  http://localhost:4000
```

Chạy riêng từng phần:

```bash
pnpm --filter @learning-path/web dev
pnpm --filter @learning-path/api dev
```

## Lệnh kiểm tra

```bash
pnpm typecheck
pnpm build
pnpm lint
```

Lưu ý: lint hiện mới là placeholder, phần ESLint/Prettier sẽ làm ở subtask `M0.2`.

## Cấu trúc chính

```txt
apps/web         Next.js front-end
apps/api         NestJS back-end
packages/shared  Type/schema/constant dùng chung
docs/            Tài liệu sản phẩm và kỹ thuật
.codex/          Plan, prompt, skill và changelog cho Codex
```

## Cách làm việc với Codex

Giao việc theo mã subtask:

```txt
/task M0.2
```

Codex sẽ đọc tài liệu liên quan trước khi code, cập nhật changelog sau khi xong và gợi ý subtask tiếp theo.
