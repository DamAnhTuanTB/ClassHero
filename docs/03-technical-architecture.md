# 03. Technical Architecture - Kiến trúc kỹ thuật

## 1. Mục tiêu kiến trúc

Kiến trúc MVP cần:

- Đủ ổn định cho quy mô ban đầu khoảng 50 học sinh.
- Tách rõ front-end, back-end API và worker.
- Không đặt database production trên VPS.
- Không lưu file upload chính trên disk của VPS.
- Có queue cho tác vụ nền như xử lý PDF, embedding, AI, email/Zalo.
- Có RAG theo từng buổi học.
- Có realtime notification trong hệ thống.
- Có khả năng scale dần nếu số lượng học sinh tăng.

---

## 2. Sơ đồ tổng quan

```txt
User Browser
  |
  | HTTPS
  v
Nginx + Certbot on VPS
  |
  +--> frontend-nextjs container
  |
  +--> backend-nestjs-api container
            |
            +--> Supabase Postgres + pgvector
            +--> Object storage (Cloudflare R2; MinIO local/dev)
            +--> Redis on VPS
            +--> OpenAI / Gemini
            +--> payOS
            +--> Resend
            +--> Zalo OA/ZNS
            +--> Socket.IO Gateway

backend-worker container
  |
  +--> Redis/BullMQ
  +--> Supabase Postgres + pgvector
  +--> Object storage (Cloudflare R2; MinIO local/dev)
  +--> OpenAI / Gemini
  +--> Resend / Zalo
```

---

## 3. Monorepo

Dùng Turborepo.

```txt
.
├── apps/
│   ├── web/             # Next.js front-end
│   └── api/             # NestJS API + worker source
├── packages/
│   └── shared/          # Shared types, Zod schemas, constants
├── docs/
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
└── turbo.json
```

ASSUMPTION: API và worker cùng codebase NestJS trong `apps/api`, nhưng chạy bằng command/container khác nhau.

---

## 4. Front-end architecture

### Stack

- Next.js.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Framer Motion.
- TanStack Query.
- Zustand.
- React Hook Form.
- Zod.
- Tiptap.
- KaTeX.
- KaTeX + mhchem.

### App Router route groups đề xuất

```txt
apps/web/app/
├── (public)/
│   ├── page.tsx
│   ├── courses/
│   └── news/
├── (auth)/
│   ├── layout.tsx
│   ├── login/
│   ├── register/
│   ├── forgot-password/
│   └── reset-password/
├── (student)/student/
│   ├── dashboard/
│   ├── courses/
│   ├── lessons/[lessonId]/
│   ├── notifications/
│   ├── profile/
│   └── leaderboard/
├── (parent)/parent/
│   ├── children/
│   ├── dashboard/
│   ├── courses/
│   ├── payments/
│   └── notifications/
└── (admin)/admin/
    ├── dashboard/
    ├── courses/
    ├── lessons/
    ├── reports/
    ├── discounts/
    ├── notifications/
    └── news/
```

### State management

- TanStack Query cho server state, cache, mutation, invalidate sau update.
- Zustand cho client state nhỏ như selected child, notification dropdown, UI preference.
- Không dùng Zustand thay thế database/API state.

### Source organization

Cấu trúc source front-end bắt buộc theo `docs/14-source-code-structure.md`.

- Route/page chỉ compose screen/layout và xử lý boundary của Next.js.
- Feature code đặt trong `apps/web/features/<feature>/` theo nhóm `api/data/hooks/screens/schemas/session/types/utils` khi cần; component local nằm trong `screens/<screen>/components`, shared component nằm trong `apps/web/components/{common,admin,student,parent}`.
- Component/shared primitive dùng lại nhiều màn đặt trong `apps/web/components`; component chỉ dùng một màn đặt trong `screens/<screen>/components`.
- Mỗi file `.tsx` chỉ có một component implementation chính; tránh file barrel/re-export nếu không có nhu cầu bắt buộc từ framework/tooling.
- Import nội bộ dùng `@/...`.

Chi tiết performance budget, cache, pagination, query, worker latency và observability nằm ở `docs/12-performance-and-observability.md`.

### SEO và public discovery

Các route public quan trọng như landing, course list/detail và news/event public phải có nền SEO theo `docs/13-seo-and-content-discovery.md`.

Nguyên tắc kiến trúc:

- Nội dung chính của public page nên render được từ server bằng Next.js App Router.
- Dùng `metadata`/`generateMetadata` cho title, description, canonical và Open Graph.
- Dùng `sitemap.ts` và `robots.ts` khi có route public thật.
- Không index route private như admin, student, parent, auth hoặc API.
- Public API cấp dữ liệu SEO phải chỉ trả nội dung `published` và có query/index/cache phù hợp.

### Rich text và công thức

Các nội dung sau nên dùng cùng cơ chế rich text:

- Câu hỏi.
- Câu trả lời.
- Lời giải.
- Tóm tắt bài học.
- Phiếu tài liệu.
- Ghi chú.
- Nội dung tin tức/sự kiện.

Dữ liệu lưu dạng Tiptap JSON. Công thức Toán/Lý/Hóa lưu LaTeX trong Tiptap JSON.

---

## 5. Back-end architecture

### Stack

- NestJS.
- TypeScript.
- REST API.
- Swagger/OpenAPI.
- Prisma.
- JWT access token + refresh token.
- RBAC guard.
- BullMQ.

### Import alias

- Back-end source trong `apps/api/src` dùng alias native Node `#api/...` cho import/export nội bộ.
- Alias khai báo trong `apps/api/package.json` bằng package `imports`: TypeScript resolve về `src`, runtime Node resolve về `dist`.
- Không dùng `@/...` trong `apps/api` nếu chưa bổ sung runtime resolver tương ứng, vì `tsc` không tự rewrite alias cho Node.
- Socket.IO.

### API foundation

- Base path API là `/api/v1`.
- Swagger/OpenAPI bật ở dev/staging tại `/api/docs`; không bật public production nếu chưa bảo vệ.
- Env bắt buộc được validate khi boot API để thiếu cấu hình báo lỗi rõ.
- Request DTO dùng global validation pipe với whitelist và transform.
- Response lỗi dùng envelope `{ "error": { "code", "message", "details" } }`.
- HTTP exception phải tạo qua helper/factory trong `apps/api/src/common/errors` để giữ code/message/details thống nhất; module domain không tự dựng trực tiếp Nest exception với body riêng lẻ.
- Prisma error mapping dùng helper chung trong `apps/api/src/common/errors`, còn module domain quyết định message nghiệp vụ phù hợp.

### Module đề xuất

```txt
AuthModule
UsersModule
ProfilesModule
FilesModule
CoursesModule
LessonsModule
MaterialsModule
QuizModule
FlashcardsModule
TestsModule
AttemptsModule
ProgressModule
PaymentsModule
DiscountsModule
AiModule
RagModule
NotificationsModule
ReportsModule
NewsModule
GamificationModule
ParentsModule
AuditModule
```

### Layering

Cấu trúc source back-end bắt buộc theo `docs/14-source-code-structure.md`.

Mỗi module nên tách:

```txt
module/
├── controllers/
├── dto/
├── selectors/
├── serializers/
├── services/
├── types/
├── utils/
├── *.module.ts
├── repositories/ nếu cần
└── tests/
```

Quy tắc:

- Controller chỉ xử lý HTTP boundary.
- Service chứa nghiệp vụ.
- Repository hoặc PrismaService xử lý DB.
- Root module domain chỉ giữ `*.module.ts`; không đặt dồn controller/service/helper/select/type/serializer ngang hàng ở root.
- Prisma select dùng lại đặt trong `selectors/`; response mapper đặt trong `serializers/`; normalizer/helper/error wrapper domain đặt trong `utils/`; type nội bộ đặt trong `types/`.
- Import nội bộ dùng `#api/...`.
- Không gọi AI/payment/storage trực tiếp trong controller.
- Job nặng phải enqueue BullMQ, không xử lý blocking trong request nếu có thể.
- Endpoint list/search hoặc flow nhạy độ trễ phải bám `docs/12-performance-and-observability.md`.

---

## 6. Database architecture

- Supabase Postgres.
- pgvector cho embedding.
- Prisma ORM.
- Raw SQL qua Prisma cho vector/hybrid search.

Không chạy PostgreSQL production trên VPS để giảm rủi ro mất dữ liệu, đầy ổ, lỗi backup, lỗi deploy app và tranh tài nguyên với worker/API.

Database lưu user, student/parent profile, lộ trình, chương học tổng quan, buổi học, tài liệu, quiz, flashcard, bài thi, attempt, progress, payment, enrollment, notification, report, AI logs, audit logs, document chunks/embedding.

Chi tiết ở `docs/04-database-model.md`.

---

## 7. File storage architecture

Provider:

- Local/dev: MinIO trong Docker, dùng S3-compatible API.
- Staging/production: Cloudflare R2.

File lưu trên object storage:

- PDF bài học.
- Ảnh trong editor.
- Ảnh câu hỏi/câu trả lời.
- Avatar.
- Tài liệu upload.
- Ảnh minh họa AI.
- File/ảnh ghi chú.

Backend phải validate file type/size, tạo object key, upload qua object storage adapter, lưu metadata file trong database, tạo signed URL hoặc proxy download theo quyền, không lưu file chính trong app disk.

MinIO chỉ dùng local/dev để giảm phụ thuộc tài khoản Cloudflare khi lập trình. Production không chạy MinIO trên VPS và vẫn dùng Cloudflare R2.

ASSUMPTION: Có thể dùng signed URL ngắn hạn cho download/upload. Nếu cần kiểm soát chặt hơn, dùng proxy endpoint có auth.

---

## 8. Queue và worker architecture

Redis chạy trên VPS. Dùng Redis cho BullMQ queue/cache nhẹ, không dùng Redis làm nguồn dữ liệu chính.

BullMQ queues đề xuất:

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

Worker jobs:

- Extract text PDF.
- Chunk tài liệu.
- Tạo embedding.
- AI tạo tóm tắt.
- AI tạo quiz.
- AI tạo flashcard.
- AI tạo bài kiểm tra.
- AI tạo lời giải.
- Render ảnh minh họa từ `diagram_spec_json`.
- Gửi thông báo.
- Gửi email/Zalo.
- Xử lý hậu kỳ payment.

ASSUMPTION: Concurrency ban đầu:

- PDF processing: 1-2.
- Embedding: 1-2.
- AI generation: 1-3.
- Notification/email/Zalo: 3-5.

Cần cấu hình bằng env, không hard-code cố định.

---

## 9. AI/RAG architecture

Providers:

- OpenAI: provider chính.
- Gemini: provider phụ.

Tạo interface chung:

```ts
export interface AiProvider {
  generateStructured<TOutput>(
    input: AiStructuredInput,
    schema: unknown,
  ): Promise<TOutput>;
  generateText(input: AiTextInput): Promise<AiTextOutput>;
  createEmbedding(input: AiEmbeddingInput): Promise<AiEmbeddingOutput>;
}
```

Nguyên tắc:

- Không gọi trực tiếp OpenAI/Gemini rải rác trong code.
- Mọi call AI đi qua `AiModule`.
- Mọi output có cấu trúc phải validate.
- Mọi generation quan trọng phải log.
- Cần budget/usage guard để kiểm soát chi phí AI.

Pipeline tài liệu:

```txt
Upload PDF
  -> Save object storage
  -> lesson_documents status UPLOADED
  -> enqueue document-processing
  -> extract text
  -> chunk text
  -> create embeddings
  -> save document_chunks with lesson_id
  -> document status READY
```

Runtime chat/retrieval:

```txt
Student asks question in lesson
  -> validate permission
  -> create query embedding
  -> retrieve chunks where lesson_id = current lesson
  -> optional keyword search
  -> build prompt with selected chunks
  -> AI answer
  -> save chat message
```

AI không được lấy context từ lesson khác.
Chapter chỉ là metadata tổng quan để nhóm lesson; document processing và RAG không chạy ở cấp chapter trong MVP.

---

## 10. Realtime notification architecture

- Stack: Socket.IO + NestJS WebSocket Gateway.
- Notification luôn lưu DB.
- Nếu user online, backend gửi event realtime.
- Nếu user offline, khi user mở nút thông báo thì load danh sách mới nhất từ DB.
- Email/Zalo là delivery channel bổ sung.

Không làm chat realtime giữa người dùng trong MVP.

---

## 11. Payment architecture

Provider: payOS.

```txt
User chọn lộ trình
  -> Backend tính giá
  -> Backend tạo payment order payOS
  -> Frontend hiển thị QR/checkout
  -> payOS webhook
  -> Backend verify webhook
  -> Backend update payment PAID
  -> Backend create enrollment 12 months
  -> Send notifications
```

Quy tắc:

- Webhook phải verify checksum.
- Webhook phải idempotent.
- Server tính lại giá, không tin client.
- Payment logs và webhook logs lưu DB.

---

## 12. Email/Zalo architecture

Email provider: Resend.

Dùng cho:

- quên mật khẩu,
- thông báo thanh toán/mở khóa,
- thông báo học tập cho phụ huynh nếu cần.

Zalo provider: Zalo OA/ZNS.

Dùng cho thông báo quan trọng cho phụ huynh:

- nhắc học,
- hoàn thành bài học,
- điểm bài thi,
- vào học muộn/chưa học đúng lịch.

Delivery qua BullMQ worker, lưu status trong `notification_deliveries`, có retry.

---

## 13. Deploy architecture

VPS:

- Provider: Viettel Cloud.
- Gói: GEN05.
- Cấu hình: 8 vCPU, 16GB RAM, 120GB SSD.

Services chạy trên VPS:

- `frontend-nextjs`.
- `backend-nestjs-api`.
- `backend-worker`.
- `redis`.
- `nginx`.

Services không chạy trên VPS:

- PostgreSQL database chính.
- File storage chính.
- MinIO làm storage production.

Production dùng Docker Compose.

Chỉ cần 1 domain chính:

- `hocai.vn` cho front-end.
- `api.hocai.vn` cho back-end.

---

## 14. Logging, monitoring và audit

- Backend logger: Pino.
- Error tracking: Sentry.
- Audit log cho thao tác quan trọng của admin, AI, payment, report, notification và file.

Theo dõi vận hành:

- CPU/RAM/disk VPS.
- Docker container logs.
- Worker backlog.
- Redis memory.
- AI usage/cost.
- Supabase usage.
- R2 storage/bandwidth.
- MinIO local/dev disk usage.
- Email/Zalo delivery failure.

---

## 15. Môi trường

Local/dev:

- Dev local trên máy lập trình viên.
- Không thuê VPS dev riêng.
- Database local chạy bằng Docker Postgres + pgvector.
- Supabase Free/dev project chỉ dùng khi cần test gần giống staging/production.
- MinIO Docker dùng mặc định cho file storage local/dev.
- Cloudflare R2 free tier chỉ dùng khi cần test storage gần staging/production.
- Resend dùng Free tier để test email.
- payOS dùng sandbox/test.
- AI vẫn cần ngân sách test.

Production ban đầu:

- Quy mô: khoảng 50 học sinh.
- VPS Viettel GEN05.
- Supabase Postgres Pro.
- Cloudflare R2.
- Resend Pro.
- payOS.
- Zalo/ZNS.
- OpenAI/Gemini.

---

## 16. Scale path

Khi tải tăng:

1. Tối ưu query/index.
2. Giới hạn concurrency worker.
3. Tách backend-worker sang VPS riêng.
4. Scale API container.
5. Scale worker theo queue.
6. Tối ưu AI usage/cache.
7. Xem xét nâng Supabase plan nếu DB là bottleneck.

Ưu tiên tách worker trước nếu các job AI/PDF nặng.
