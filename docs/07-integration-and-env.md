# 07. Integration and Env - Tích hợp và biến môi trường

Tài liệu này quy định các dịch vụ bên thứ ba, biến môi trường và nguyên tắc tích hợp.

Không hard-code secret trong source code. Không commit `.env` thật vào repo.

---

## 1. Môi trường

### Local/dev

- Dev local trên máy lập trình viên.
- Không thuê VPS dev riêng.
- Database mặc định chạy local bằng Docker Postgres + pgvector.
- Supabase Free/dev project chỉ dùng khi cần test gần giống staging/production.
- Cloudflare R2 dùng free tier.
- Resend dùng Free tier để test email.
- payOS dùng môi trường test/sandbox.
- AI vẫn cần ngân sách test.

### Production ban đầu

- Quy mô: khoảng 50 học sinh.
- App chạy trên VPS Viettel Cloud GEN05.
- Database dùng Supabase Postgres + pgvector.
- File storage dùng Cloudflare R2.
- Email dùng Resend.
- Thanh toán dùng payOS.
- AI dùng OpenAI chính, Gemini phụ.
- Zalo/ZNS dùng cho thông báo quan trọng.

Ngân sách production nên chuẩn bị khoảng 5.500.000 VNĐ/tháng. Đây là ghi chú vận hành, không phải logic code.

---

## 2. `.env.example` đề xuất

```bash
# App
NODE_ENV=development
APP_NAME=learning-path-mvp
WEB_URL=http://localhost:3000
API_URL=http://localhost:4000/api/v1
API_PORT=4000

# Database - local Postgres + pgvector
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_path_dev?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/learning_path_dev?schema=public

# JWT
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Redis / BullMQ
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY_AI=2
WORKER_CONCURRENCY_DOCUMENT=1
WORKER_CONCURRENCY_NOTIFICATION=3

# Cloudflare R2
R2_ACCOUNT_ID=change-me
R2_ACCESS_KEY_ID=change-me
R2_SECRET_ACCESS_KEY=change-me
R2_BUCKET_NAME=learning-path-dev
R2_PUBLIC_BASE_URL=
R2_SIGNED_URL_TTL_SECONDS=900

# OpenAI
OPENAI_API_KEY=change-me
OPENAI_STRUCTURED_MODEL=gpt-4.1-mini
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536

# Gemini
GEMINI_API_KEY=change-me
GEMINI_STRUCTURED_MODEL=gemini-2.0-flash
GEMINI_CHAT_MODEL=gemini-2.0-flash

# AI budget/rate limit
AI_MONTHLY_BUDGET_VND=1500000
AI_STUDENT_CHAT_DAILY_LIMIT=20
AI_STUDENT_GENERATE_DAILY_LIMIT=5

# payOS
PAYOS_CLIENT_ID=change-me
PAYOS_API_KEY=change-me
PAYOS_CHECKSUM_KEY=change-me
PAYOS_WEBHOOK_URL=http://localhost:4000/api/v1/webhooks/payos

# Resend
RESEND_API_KEY=change-me
RESEND_FROM_EMAIL=no-reply@example.com

# Zalo OA/ZNS
ZALO_OA_ID=change-me
ZALO_APP_ID=change-me
ZALO_SECRET_KEY=change-me
ZALO_ZNS_TEMPLATE_LESSON_REMINDER=change-me
ZALO_ZNS_TEMPLATE_TEST_RESULT=change-me

# Socket.IO / CORS
CORS_ORIGINS=http://localhost:3000
SOCKET_IO_PATH=/socket.io

# File limits
MAX_PDF_UPLOAD_MB=50
MAX_IMAGE_UPLOAD_MB=10
MAX_AVATAR_UPLOAD_MB=5

# Sentry
SENTRY_DSN=

# Logging
LOG_LEVEL=debug
```

ASSUMPTION: Model names trong `.env.example` là placeholder để bắt đầu. Nếu provider/model thực tế khác, cập nhật env và `docs/06-ai-rag-spec.md`.

---

## 2.1. API env validation

API validate các biến nền khi boot. Ở `M2.1`, nhóm env bắt buộc gồm:

- `WEB_URL`, `API_URL`, `API_PORT`.
- `DATABASE_URL`.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- `REDIS_URL`.
- `CORS_ORIGINS`, `LOG_LEVEL`.

Nếu thiếu env, API phải fail fast với message liệt kê biến thiếu. `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` không được để placeholder trong production.

Từ `M2.3`, API cũng đọc optional `RESEND_API_KEY` và `RESEND_FROM_EMAIL` để gửi email reset password. Nếu hai biến này chưa cấu hình thật ở local/dev, forgot-password vẫn tạo reset token hash và trả response chung nhưng không gọi Resend.

Swagger dev/staging chạy tại:

```txt
http://localhost:4000/api/docs
```

---

## 3. Postgres database

Local/dev mặc định dùng Postgres có pgvector trong Docker Compose để có thể chạy migration, seed và xem database bằng DBeaver trên máy lập trình viên.

Thông tin kết nối local từ host machine:

```txt
Host: localhost
Port: 5432
Database: learning_path_dev
Username: postgres
Password: postgres
```

Khi API chạy trong Docker Compose, `DATABASE_URL` phải dùng host service `postgres` thay vì `localhost`:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/learning_path_dev?schema=public
```

Staging/production dùng Supabase Postgres.

Yêu cầu:

- Bật extension `vector`.
- Prisma dùng `DATABASE_URL`.
- Prisma v7 đọc URL qua `apps/api/prisma.config.ts`; migration hiện dùng `DATABASE_URL`.
- `DIRECT_URL` vẫn giữ trong `.env.example` để dành cho trường hợp cần tách URL direct/pooling ở bước triển khai Supabase sau.
- Không dùng Supabase Auth trong MVP nếu backend tự quản JWT.

Cần lưu:

- User/profile.
- Learning path/lesson.
- Content.
- Attempt/progress.
- Payment/enrollment.
- Notification/report.
- AI logs.
- Document chunks/embedding.
- Audit logs.

---

## 4. Cloudflare R2

Dùng cho file storage chính.

File types:

- PDF bài học.
- Ảnh trong editor.
- Ảnh câu hỏi/câu trả lời.
- Avatar.
- Tài liệu upload.
- Ảnh minh họa AI.
- File/ảnh ghi chú.

Backend responsibilities:

- Validate file type.
- Validate file size.
- Tạo object key.
- Upload file.
- Lưu metadata vào `files`.
- Trả signed URL hoặc proxy theo quyền.

Object key đề xuất:

```txt
uploads/{environment}/{purpose}/{yyyy}/{mm}/{uuid}-{safe-filename}
```

Không lưu file chính trong app disk.

---

## 5. OpenAI/Gemini

### OpenAI

Dùng chính cho:

- Embedding.
- Structured output.
- Chat AI.
- Tạo tóm tắt/quiz/flashcard/test/explanation.

### Gemini

Dùng phụ cho:

- backup,
- so sánh,
- tối ưu chi phí sau.

### Rules

- Mọi call AI đi qua `AiProvider` abstraction.
- Output structured phải validate schema.
- Log `ai_generations`.
- Không gửi toàn bộ tài liệu mỗi lần học sinh hỏi.
- Cần rate limit và budget guard.

---

## 6. payOS

Dùng cho thanh toán QR và đối soát tự động.

Cần env:

```txt
PAYOS_CLIENT_ID
PAYOS_API_KEY
PAYOS_CHECKSUM_KEY
PAYOS_WEBHOOK_URL
```

Payment creation:

- Server tính giá.
- Server apply discount.
- Server tạo order payOS.
- Lưu payment `PENDING`.
- Trả QR/checkout cho client.

Webhook:

- Endpoint: `POST /api/v1/webhooks/payos`.
- Verify checksum.
- Lưu raw payload vào `payment_webhook_logs`.
- Idempotent.
- Nếu paid, tạo enrollment 12 tháng.

Không mở khóa lộ trình từ callback client. Chỉ mở khóa sau webhook verified.

---

## 7. Resend

Dùng cho email:

- Quên mật khẩu.
- Thanh toán/mở khóa lộ trình.
- Thông báo học tập cho phụ huynh nếu cần.

Cần env:

```txt
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Rules:

- Gửi qua BullMQ worker.
- Lưu delivery status.
- Retry khi lỗi tạm thời.
- Không gửi email trong unit test thật.

---

## 8. Zalo OA/ZNS

Dùng cho thông báo quan trọng cho phụ huynh:

- Nhắc học.
- Hoàn thành bài học.
- Điểm bài thi.
- Vào học muộn/chưa học đúng lịch.

Cần env:

```txt
ZALO_OA_ID
ZALO_APP_ID
ZALO_SECRET_KEY
ZALO_ZNS_TEMPLATE_...
```

Rules:

- Gửi qua BullMQ worker.
- Lưu delivery status.
- Có retry.
- Cần tránh spam.

TODO: Chốt template ZNS và nội dung message cụ thể.

---

## 9. Redis/BullMQ

Redis dùng cho:

- BullMQ queue.
- Cache nhẹ nếu cần.

Không dùng Redis làm nguồn dữ liệu chính.

Queues:

```txt
document-processing
embedding
ai-generation
notification-delivery
email-delivery
zalo-delivery
diagram-rendering
payment-postprocess
```

Concurrency cấu hình bằng env.

---

## 10. Socket.IO

Dùng cho realtime notification trong hệ thống.

Rules:

- Client connect với access token.
- Gateway authenticate socket.
- User join room theo `user:{userId}`.
- Khi có notification mới, emit vào room user.
- Notification vẫn lưu DB trước.

Không dùng Socket.IO để làm chat realtime giữa người dùng trong MVP.

---

## 11. Nginx/domain/SSL

Production:

- Front-end: domain chính, ví dụ `hocai.vn`.
- API: subdomain, ví dụ `api.hocai.vn`.
- Nginx reverse proxy.
- Certbot/Let's Encrypt cấp SSL.

CORS:

- API chỉ cho phép origin front-end chính.
- Dev cho `localhost:3000`.

---

## 12. Security checklist

- Không commit secret.
- Có `.env.example`, không có `.env` thật.
- Webhook verify checksum.
- JWT secret đủ mạnh.
- Refresh token hash trước khi lưu DB.
- File signed URL có TTL ngắn.
- Backend kiểm tra quyền trước khi trả file.
- Không trả đáp án đúng bài kiểm tra trước khi submit.
- Rate limit cho auth, AI chat, AI generation, payment creation.
- Audit log cho thao tác admin/payment/AI/report.

---

## 13. Production cost note

Ngân sách production ban đầu cho 50 học sinh dự kiến khoảng 5.386.000 VNĐ/tháng, làm tròn nên chuẩn bị 5.500.000 VNĐ/tháng.

Các khoản lớn:

- VPS Viettel GEN05.
- OpenAI/Gemini.
- Supabase Postgres.
- Resend.
- Zalo/ZNS.

Ghi chú này giúp dev tránh thiết kế gây tăng chi phí AI/storage/network không cần thiết.
