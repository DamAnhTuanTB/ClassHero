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
- File storage local/dev mặc định dùng MinIO trong Docker để giả lập S3/R2.
- Cloudflare R2 free tier chỉ dùng khi cần test gần giống staging/production.
- Resend dùng Free tier để test email.
- payOS dùng môi trường test/sandbox.
- AI vẫn cần ngân sách test.
- Paid OCR local được phép bật để owner test vài cuốn đại diện. Mặc định `.env.example` để `OCR_PAID_ENABLED=false`; khi test thật thì đổi local `.env` thành `true`, đặt Mathpix key và giữ artifact cache bật để tránh gọi lại cùng file. Trước khi chạy forced OCR cả cuốn hoặc nhiều cuốn, phải báo số trang và ước tính chi phí cho owner xác nhận.

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
POSTGRES_HOST_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_path_dev?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/learning_path_dev?schema=public

# JWT
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
JWT_ACCESS_EXPIRES_IN=30d
JWT_REFRESH_EXPIRES_IN=30d

# Redis / BullMQ
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY_AI=4
WORKER_CONCURRENCY_DOCUMENT=1
WORKER_CONCURRENCY_DIAGRAM=3
WORKER_CONCURRENCY_NOTIFICATION=3

# File storage - local/dev mặc định dùng MinIO, staging/production dùng Cloudflare R2
MINIO_API_HOST_PORT=9000
MINIO_CONSOLE_HOST_PORT=9001
FILE_STORAGE_PROVIDER=minio_local
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=learning-path-dev
S3_FORCE_PATH_STYLE=true
FILE_PUBLIC_BASE_URL=
FILE_SIGNED_URL_TTL_SECONDS=900

# OpenAI
OPENAI_API_KEY=change-me
OPENAI_STRUCTURED_MODEL=gpt-4.1-mini
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
# inline | ref | ref_v2; mặc định ref_v2, đổi một giá trị để rollback
AI_SUMMARY_SCHEMA_REFERENCE_STRATEGY=ref_v2
# Stable cache routing không thay prompt/context
AI_SUMMARY_PROMPT_CACHE_KEY_ENABLED=false
# in_memory | 24h; 24h chỉ được gửi khi model hỗ trợ
AI_SUMMARY_PROMPT_CACHE_RETENTION=in_memory
AI_QUIZ_SCHEMA_REFERENCE_STRATEGY=ref_v2
AI_QUIZ_PROMPT_CACHE_KEY_ENABLED=true
AI_QUIZ_PROMPT_CACHE_RETENTION=in_memory

# Gemini
GEMINI_API_KEY=change-me
GEMINI_STRUCTURED_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash

# Paid OCR
OCR_PROVIDER=mathpix
# Local/dev mặc định false; owner có thể bật true để test paid OCR thật vài cuốn đại diện.
OCR_PAID_ENABLED=false
OCR_ALLOW_FREE_FALLBACK=false
OCR_ARTIFACT_CACHE_ENABLED=true
OCR_DEBUG_ARTIFACTS_ENABLED=false
OCR_ARTIFACT_PREFIX=ocr-artifacts
MATHPIX_APP_ID=change-me
MATHPIX_APP_KEY=change-me
MATHPIX_LANGUAGE_HINTS=vi,en
OCR_MAX_CONCURRENT_DOCUMENTS=2
OCR_MONTHLY_BUDGET_VND=1000000

# AI budget/rate limit
AI_PROVIDER_TIMEOUT_MS=60000
AI_GENERATION_TIMEOUT_MS=600000
AI_MONTHLY_BUDGET_VND=1500000
AI_STUDENT_CHAT_DAILY_LIMIT=20
AI_STUDENT_GENERATE_DAILY_LIMIT=5

# Searchable PDF equivalence + temporary Summary packet
SEARCHABLE_PDF_VALIDATION_TTL_SECONDS=3600
SEARCHABLE_PDF_ROLLBACK_TTL_SECONDS=86400
AI_SUMMARY_PACKET_MAX_MB=45
AI_SUMMARY_PACKET_MAX_PAGES=120

# Isolated TeX Live renderer (worker-only internal service)
TEX_RENDERER_URL=http://localhost:8080
TEX_RENDERER_TOKEN=local-tex-renderer-token
TEX_RENDER_CONCURRENCY=1
TEX_RENDER_REQUEST_TIMEOUT_MS=30000
TEX_RENDER_MAX_AI_REPAIRS=2
TEX_RENDER_MAX_SOURCE_BYTES=40000
TEX_RENDER_MAX_SVG_BYTES=2000000
TEX_RENDER_MAX_SVG_NODES=20000
TEX_RENDER_MAX_PATH_CHARACTERS=1500000

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

Nếu cổng host `5432` đang được một dự án khác sử dụng, đặt
`POSTGRES_HOST_PORT` sang cổng còn trống (ví dụ `5433`) và dùng cùng cổng đó
trong `DATABASE_URL`/`DIRECT_URL` của API chạy trên host. Cổng bên trong Compose
vẫn là `postgres:5432`.

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

## 4. File storage: MinIO local/dev và Cloudflare R2 production

Local/dev mặc định dùng MinIO chạy trong Docker vì MinIO tương thích S3, giúp dev upload/download thật trên máy local mà không cần tài khoản Cloudflare.

Staging/production dùng Cloudflare R2 làm file storage chính. Cloudflare R2 free tier có thể dùng ở dev khi cần test gần giống staging/production.

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
- Upload file qua adapter S3-compatible.
- Lưu metadata vào `files`.
- Trả signed URL hoặc proxy theo quyền.

Object key đề xuất:

```txt
uploads/{environment}/{purpose}/{yyyy}/{mm}/{uuid}-{safe-filename}
```

Không lưu file chính trong app disk.

Provider rules:

- `FILE_STORAGE_PROVIDER=minio_local`: chỉ dùng local/dev, trỏ tới MinIO bằng `S3_ENDPOINT=http://localhost:9000`, `S3_FORCE_PATH_STYLE=true`.
- `FILE_STORAGE_PROVIDER=cloudflare_r2`: dùng staging/production, trỏ tới endpoint S3-compatible của Cloudflare R2 như `https://<account_id>.r2.cloudflarestorage.com`, không chạy MinIO trên VPS production.
- Nếu host port `9000`/`9001` đang được dự án khác sử dụng, đặt
  `MINIO_API_HOST_PORT`/`MINIO_CONSOLE_HOST_PORT` sang cổng còn trống và cập nhật
  `S3_ENDPOINT` của API chạy trên host theo `MINIO_API_HOST_PORT`. API/worker
  trong Compose vẫn dùng endpoint nội bộ `http://minio:9000`.
- Code upload/download phải đi qua một service/adapter chung; module domain không gọi trực tiếp SDK R2/MinIO.
- Signed URL TTL dùng `FILE_SIGNED_URL_TTL_SECONDS`; backend vẫn kiểm tra quyền trước khi trả URL.
- Bucket local/dev có thể tạo tự động khi khởi động Docker/dev script, nhưng production bucket phải tạo và phân quyền thủ công trên Cloudflare.

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
- `AI_SUMMARY_SCHEMA_REFERENCE_STRATEGY` nhận `inline | ref | ref_v2` và mặc định
  `ref_v2`. `ref_v2` thêm hoist subtree deep-equal và tên `$defs` ngắn
  deterministic; `ref` giữ serializer v1, còn `inline` là đường rollback về
  schema mở rộng hoàn toàn. Cả ba giá trị dùng cùng prompt, chunk/metadata, tập
  output hợp lệ, Zod parser và pipeline sau provider; đổi strategy không cần
  migration hoặc regenerate Summary.
- `AI_SUMMARY_PROMPT_CACHE_KEY_ENABLED=true` gửi stable `prompt_cache_key` riêng
  cho Summary. `AI_SUMMARY_PROMPT_CACHE_RETENTION=24h` chỉ gửi extended retention
  cho model đã whitelist capability; mặc định `in_memory` omit provider field.
  Mọi thay đổi strategy hoặc cấu hình cache cần restart API và worker.
- `AI_QUIZ_SCHEMA_REFERENCE_STRATEGY` được khóa ở `ref_v2`. Không dùng `auto`;
  request draft và worker vẫn kiểm cùng schema/hash trước khi gọi provider.
- `AI_QUIZ_PROMPT_CACHE_KEY_ENABLED=true` gửi stable cache routing key namespace
  Quiz. `AI_QUIZ_PROMPT_CACHE_RETENTION` có cùng `in_memory | 24h` và capability
  guard như Summary. Prompt cache không cache output và không đổi prompt/PDF.
- Log `ai_generations`.
- `AI_PROVIDER_TIMEOUT_MS` giới hạn các provider request ngắn như embedding.
- `AI_GENERATION_TIMEOUT_MS` giới hạn riêng request sinh text/structured output dài;
  mặc định 10 phút để model reasoning cao có đủ thời gian trả kết quả.
- BullMQ quản lý retry durable nên OpenAI SDK không tự retry lồng bên trong một
  attempt. Riêng Summary giữ `maxAttempts=1`: một lần admin bấm tạo chỉ phát sinh
  đúng một provider call, kể cả khi request hết thời gian chờ.
- Không gửi toàn bộ tài liệu mỗi lần học sinh hỏi.
- Cần rate limit và budget guard.

### Paid provider cost guard

- Với provider tính phí theo usage như Mathpix/OpenAI/Gemini, không chạy forced/full runtime test mặc định nếu cache hoặc sample test đã đủ kiểm code.
- Với Mathpix PDF OCR, ước tính chi phí trước khi chạy bằng `số trang PDF × đơn giá/page` theo pricing hiện hành của tài khoản/provider. Ví dụ 265 trang ở mức khoảng `$0.005/page` tương đương khoảng `$1.325` trước các yếu tố billing khác.
- Trước khi OCR thật cả cuốn hoặc nhiều cuốn, Codex phải báo owner phạm vi, số trang, ước tính chi phí và xin xác nhận rõ, kể cả khi đang test local.
- Sau khi đã có artifact cache theo `content_hash + provider/options`, mọi lần verify code/derived artifacts phải ưu tiên cache-hit rerun, không gọi Mathpix lại.
- Final/report sau khi test thật phải ghi rõ `forceMathpix` hay cache hit, số trang đã xử lý, artifact key và chi phí/usage ước tính nếu biết.

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
- Mô tả payOS dùng `payments.reference_code`, ví dụ `Toan7MS64646464`; mã này
  gồm môn, lớp và số ngẫu nhiên, được lưu để tra soát. Backend vẫn liên kết
  chính xác webhook bằng `payments.provider_order_code`.
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

`diagram-rendering` hiện chỉ nhận `stem_figures` của Summary. Worker gọi
`TEX_RENDERER_URL` qua private Docker network với bearer token; renderer không
publish port ra host/Internet trong Compose. Chỉ `TEX_COMPILE_FAILED` có batch
compiler đầy đủ mới được bounded OpenAI repair. Mỗi repair gửi toàn bộ lỗi và raw
log của lượt compile đó. Source policy, validator, provider, timeout, network,
storage và lỗi hạ tầng không tự retry; các thao tác retry thủ công vẫn theo
lifecycle hình hiện có.

Renderer tạo sẵn LuaTeX font-name database làm seed trong image. Khi container
boot, seed được copy một lần sang `TEXMFCACHE` writable trong tmpfs vì luaotfload
có thể bổ sung module cache lazy; mọi child process dùng chung cache này thay vì
đặt trong `HOME` tạm bị xóa sau mỗi lượt. `TEX_RENDER_CONCURRENCY` là giới hạn
compile toàn cục của container, khác với concurrency từng BullMQ queue. Với
resource limit 1 vCPU, mặc định dùng `1` để tránh Summary và Quiz cộng dồn nhiều
LuaLaTeX process rồi cùng chạm timeout.

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

## 10.1. YouTube public transcript

- M3.8 lấy transcript best-effort ở server từ caption công khai của video YouTube bên thứ ba.
- Tích hợp này không dùng YouTube Data API `captions.download`, vì endpoint chính thức yêu cầu OAuth và quyền chỉnh sửa video.
- Không cần API key/env mới. Không chạy speech-to-text fallback trong MVP.
- Request phải có timeout, giới hạn retry và lỗi thân thiện; thất bại không được ảnh hưởng video playback hoặc transcript đã lưu.
- Do đây là endpoint không được YouTube cam kết ổn định cho video bên thứ ba, code phải cô lập sau service riêng để có thể thay provider sau này.

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
