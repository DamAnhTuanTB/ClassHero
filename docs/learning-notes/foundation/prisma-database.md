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
6. Các model nền như `User`, `StudentProfile`, `ParentProfile`, `File`, `BackgroundJob` và `AuditLog` được thêm vào Prisma schema trước các module nghiệp vụ để auth, upload, worker và audit có điểm tựa chung.
7. Các model học tập lõi như `LearningPath`, `Lesson`, `LessonDocument`, `DocumentChunk`, `Enrollment` và `LessonProgress` nối phần course, tài liệu, RAG và tiến độ học vào cùng một schema.
8. Các model tương tác học tập như `QuizSet`, `FlashcardSet`, `TestSet`, `QuizAttempt`, `TestAttempt`, `FlashcardProgress`, `StudentNote`, `LessonVideoComment` và `Favorite` lưu nội dung luyện tập, lịch sử làm bài và ghi chú riêng của học sinh theo từng lesson.
9. Các model còn lại như `Payment`, `PaymentWebhookLog`, `DiscountCode`, `Notification`, `Report`, `AiGeneration`, `AiExplanation`, `AiChatSession`, `XpEvent` và `NewsItem` hoàn thiện nền dữ liệu cho payment, notification, AI, moderation, gamification và tin tức.
10. `apps/api/prisma/seed.ts` tạo dữ liệu dev tối thiểu để kiểm tra các quan hệ chính sau khi chạy migration: admin, học sinh, phụ huynh, lộ trình Toán 7, lesson, tài liệu mẫu, quiz/flashcard/test, enrollment/payment và notification.
11. Local database chạy bằng Docker Postgres + pgvector trong `docker-compose.yml`; Prisma chạy từ host dùng `localhost`, còn API chạy trong Docker dùng hostname service `postgres`.

## Kỹ thuật chính

- Prisma config: giúp Prisma CLI biết đọc schema/migration ở đâu và dùng connection string nào.
- PrismaClient: client TypeScript dùng để query database.
- NestJS provider: biến PrismaClient thành service có thể inject trong controller/service khác.
- Migration: lưu thay đổi database thành file versioned trong repo.
- pgvector: extension cần cho embedding và semantic search ở các milestone AI/RAG.
- Prisma relation: mô tả quan hệ giữa model như `User -> StudentProfile`, `User -> File`, `User -> BackgroundJob`; Prisma dùng phần này để generate client query có type an toàn.
- Durable job table: `background_jobs` lưu trạng thái job lâu dài để API có thể trả `jobId` và UI xem tiến trình, thay vì chỉ dựa vào trạng thái trong Redis/BullMQ.
- Audit log: `audit_logs` ghi lại thao tác nhạy cảm như admin CRUD, file upload, payment hoặc moderation để sau này truy vết được ai đã làm gì.
- Unsupported field: `document_chunks.embedding` dùng `Unsupported("vector(1536)")` để Prisma vẫn quản lý bảng có cột pgvector, còn vector query/index chuyên sâu sẽ dùng raw SQL khi đến milestone RAG.
- Partial unique index: `enrollments_one_active_per_student_path` được viết bằng raw SQL trong migration để đảm bảo một học sinh chỉ có một enrollment active cho một lộ trình.
- Set/question/attempt pattern: quiz, flashcard và test đều tách bảng bộ câu hỏi/card khỏi bảng lịch sử làm bài. Nhờ vậy admin hoặc AI có thể đổi nội dung học tập mà vẫn giữ được attempt cũ để tính tiến độ.
- Denormalized best attempt: `lesson_progress.best_test_attempt_id`, `best_score` và `best_duration_seconds` lưu kết quả tốt nhất để dashboard đọc nhanh, còn partial unique index `test_attempts_one_best_per_student_lesson` đảm bảo mỗi học sinh chỉ có một best attempt cho một lesson.
- Polymorphic favorite nhẹ: `favorites` dùng `target_type` + `target_id` để một bảng có thể lưu cả câu quiz và flashcard yêu thích. Backend sau này phải validate target thật vì Prisma không tạo FK động cho kiểu quan hệ này.
- Payment idempotency: `payments.provider_order_code`, `payment_webhook_logs.event_id` và partial unique index `payments_idempotency_per_purchase` giúp tránh tạo hoặc xử lý trùng thanh toán.
- AI trace và cache: `ai_generations` lưu provider/model/token/cost/error để debug, còn `ai_explanations` lưu hash/stale fields để biết lời giải AI còn khớp với nội dung hiện tại không.
- Notification delivery: `notifications` là nội dung thông báo trong app, còn `notification_deliveries` theo dõi từng kênh như in-app, email hoặc Zalo để worker retry riêng.
- XP idempotency: `xp_events.idempotency_key` giúp cộng XP một lần cho cùng sự kiện, còn `student_profiles.total_xp` và `level` là số liệu denormalized để đọc nhanh.
- Seed idempotent: seed dùng `upsert` với email/slug/unique key cố định để có thể chạy lại nhiều lần trên dev database mà không tạo trùng dữ liệu mẫu.
- Local connection split: `postgresql://postgres:postgres@localhost:5432/learning_path_dev` dùng cho terminal/DBeaver trên máy host; `postgresql://postgres:postgres@postgres:5432/learning_path_dev` dùng bên trong container Docker Compose.

## File quan trọng

- `apps/api/prisma.config.ts`: cấu hình Prisma CLI.
- `apps/api/prisma/schema.prisma`: schema Prisma gốc.
- `apps/api/prisma/migrations/20260707000000_enable_pgvector/migration.sql`: migration bật pgvector.
- `apps/api/prisma/migrations/20260707001000_add_foundation_models/migration.sql`: migration thêm model nền user/auth/profile/file/job/audit.
- `apps/api/prisma/migrations/20260708001000_add_learning_models/migration.sql`: migration thêm model lộ trình, buổi học, tài liệu, chunk, enrollment và progress.
- `apps/api/prisma/migrations/20260708002000_add_learning_interaction_models/migration.sql`: migration thêm quiz, flashcard, test, attempt, favorite, note/comment riêng.
- `apps/api/prisma/migrations/20260708003000_add_remaining_mvp_models/migration.sql`: migration thêm payment, notification, report, AI log/cache/chat, XP và news.
- `apps/api/prisma/seed.ts`: seed dev tối thiểu cho admin/student/parent, Toán 7 và sample learning data.
- `apps/api/tsconfig.seed.json`: typecheck riêng cho seed script.
- `docker-compose.yml`: Postgres local dùng image pgvector, Redis, API và web cho môi trường dev.
- `apps/api/src/common/prisma/prisma.service.ts`: service kết nối database.
- `apps/api/src/common/prisma/prisma.module.ts`: module export PrismaService.
- `apps/api/src/app.module.ts`: import PrismaModule vào app.

## Khi nào cần nhớ lại?

Đọc lại note này khi làm:

- model/migration mới trong `M1.x`,
- service backend cần query database,
- lỗi liên quan `DATABASE_URL`, Prisma generate, Prisma validate hoặc migration,
- flow auth, upload, worker/job hoặc audit cần biết bảng nền nằm ở đâu,
- course/lesson/enrollment/progress cần biết quan hệ dữ liệu nền,
- quiz/flashcard/test/attempt/note/favorite cần biết cách dữ liệu luyện tập nối với lesson và user,
- payment/webhook/discount, notification delivery, AI generation/cache/chat, report moderation, XP hoặc news cần biết bảng nền và idempotency/log nằm ở đâu,
- tính năng AI/RAG cần `pgvector` và `document_chunks`.
- cần seed dữ liệu dev để kiểm tra nhanh luồng auth/course/payment/progress ở các milestone sau.

## Task liên quan

- `M1.1`: Setup Prisma và database foundation.
- `M1.2`: User, auth token, profile, file và background job models.
- `M1.3`: Learning path, lesson, material, document và enrollment models.
- `M1.4`: Quiz, flashcard, test, attempt và learning interaction models.
- `M1.5`: Payment, notification, report, AI log, gamification và news models.
- `M1.6`: Seed tối thiểu và database validation.
