# Prisma Database Foundation

## Chủ đề này dùng để làm gì?

Prisma database foundation là lớp nền để NestJS API nói chuyện với Supabase Postgres. Nó chuẩn bị Prisma config, Prisma schema ban đầu, Prisma client và migration bật `pgvector` cho các tính năng AI/RAG sau này.

## Cách nó hoạt động trong repo

Ở backend NestJS, các module nghiệp vụ không nên tự tạo kết nối database riêng. Thay vào đó, chúng dùng chung `PrismaService`.

Luồng nền tảng:

```txt
NestJS module/service
-> inject PrismaService
-> PrismaClient dùng DATABASE_URL
-> Prisma adapter kết nối Postgres
-> database Supabase/Postgres
```

## Luồng kỹ thuật

1. `apps/api/prisma.config.ts` đọc `DATABASE_URL` để Prisma CLI biết schema và migration nằm ở đâu.
2. `apps/api/prisma/schema.prisma` là điểm bắt đầu định nghĩa datasource, generator và các model sau này.
3. Migration `20260707000000_enable_pgvector` bật extension `vector` để Postgres lưu embedding.
4. `PrismaService` bọc `PrismaClient` để NestJS có một service dùng chung cho database.
5. `PrismaModule` export `PrismaService` để các module khác inject khi cần truy cập DB.

## Kỹ thuật chính

- Prisma config: giúp Prisma CLI biết đọc schema/migration ở đâu và dùng connection string nào.
- PrismaClient: client TypeScript dùng để query database.
- NestJS provider: biến PrismaClient thành service có thể inject trong controller/service khác.
- Migration: lưu thay đổi database thành file versioned trong repo.
- pgvector: extension cần cho embedding và semantic search ở các milestone AI/RAG.

## File quan trọng

- `apps/api/prisma.config.ts`: cấu hình Prisma CLI.
- `apps/api/prisma/schema.prisma`: schema Prisma gốc.
- `apps/api/prisma/migrations/20260707000000_enable_pgvector/migration.sql`: migration bật pgvector.
- `apps/api/src/common/prisma/prisma.service.ts`: service kết nối database.
- `apps/api/src/common/prisma/prisma.module.ts`: module export PrismaService.
- `apps/api/src/app.module.ts`: import PrismaModule vào app.

## Khi nào cần nhớ lại?

Đọc lại note này khi làm:

- model/migration mới trong `M1.x`,
- service backend cần query database,
- lỗi liên quan `DATABASE_URL`, Prisma generate, Prisma validate hoặc migration,
- tính năng AI/RAG cần `pgvector`.

## Task liên quan

- `M1.1`: Setup Prisma và database foundation.
