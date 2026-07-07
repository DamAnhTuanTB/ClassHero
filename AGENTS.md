# AGENTS.md

## 0. Tổng quan bộ tài liệu đầu vào cho Codex

Bộ tài liệu này là nguồn đầu vào chính để Codex bắt đầu phát triển hệ thống học theo lộ trình.

Mục tiêu của bộ tài liệu không phải là mô tả mọi chi tiết nhỏ của sản phẩm, mà là cung cấp đủ thông tin cốt lõi để Codex có thể code đúng hướng, đúng kiến trúc, đúng phạm vi MVP và hạn chế tự suy diễn.

Bộ tài liệu gồm 12 file chính:

1. `AGENTS.md`  
   Tài liệu chỉ đạo chung cho Codex. File này quy định mục tiêu dự án, công nghệ bắt buộc, cấu trúc repo, quy tắc code, quy tắc test, quy tắc migration, quy tắc bảo mật và Definition of Done.

2. `docs/01-product-scope.md`  
   Mô tả phạm vi MVP: hệ thống làm gì, không làm gì, có những role nào, admin/học sinh/phụ huynh được làm gì, và các quy tắc nghiệp vụ chính.

3. `docs/02-user-flows.md`  
   Mô tả các luồng sử dụng chính: đăng ký, đăng nhập, tạo lộ trình, tạo buổi học, thanh toán, học thử, làm quiz, học flashcard, làm bài kiểm tra, chat AI, phụ huynh theo dõi con và admin xử lý report.

4. `docs/03-technical-architecture.md`  
   Mô tả kiến trúc kỹ thuật đã chốt, gồm front-end, back-end, database, storage, queue, AI provider, realtime notification, payment, email/Zalo và deploy production.

5. `docs/04-database-model.md`  
   Mô tả mô hình dữ liệu chính. File này là cơ sở để tạo Prisma schema, database migration, quan hệ bảng, enum, index và constraint.

6. `docs/05-api-contract.md`  
   Mô tả hợp đồng API giữa front-end và back-end. File này quy định endpoint, method, role được gọi, request body, response body, lỗi thường gặp và side effect.

7. `docs/06-ai-rag-spec.md`  
   Mô tả cách hệ thống sử dụng AI và RAG: xử lý tài liệu, chunking, embedding, retrieval theo từng buổi học, cache lời giải AI, validate output AI và giới hạn phạm vi trả lời.

8. `docs/07-integration-and-env.md`  
   Mô tả tích hợp bên thứ ba và biến môi trường: Supabase, Cloudflare R2, OpenAI, Gemini, payOS, Resend, Zalo, Redis, JWT, web URL và API URL.

9. `docs/08-ui-pages-and-components.md`  
   Mô tả danh sách màn hình và component chính ở public, student, parent và admin.

10. `docs/09-implementation-plan.md`  
    Mô tả thứ tự triển khai theo milestone để Codex và dev team code theo đúng trình tự.

11. `docs/10-seed-data-and-test-cases.md`  
    Mô tả dữ liệu mẫu và test case cơ bản để kiểm tra hệ thống trong quá trình phát triển.

12. `docs/11-ui-design-system.md`
    Mô tả gu thiết kế chính thức cho Codex khi làm UI: phong cách, màu sắc, typography, spacing, layout, component rules, responsive rules, trạng thái UI và checklist nghiệm thu.

### Cách Codex nên đọc tài liệu

Codex không bắt buộc phải đọc lại toàn bộ tài liệu cho mọi task.

Bộ tài liệu này có hai chế độ đọc:

1. **Đọc đầy đủ** khi onboarding lần đầu, khởi tạo repo, làm milestone lớn, refactor kiến trúc hoặc task có ảnh hưởng nhiều module.
2. **Đọc theo phạm vi task** khi task nhỏ, task đã có module rõ ràng hoặc task chỉ sửa một phần hẹp.

#### 1. Đọc đầy đủ khi onboarding hoặc task lớn

Codex phải đọc `AGENTS.md` trước tiên.

Sau đó, nếu đây là lần đầu làm việc với repo hoặc task có phạm vi lớn, Codex nên đọc các tài liệu theo thứ tự:

1. `docs/01-product-scope.md`
2. `docs/03-technical-architecture.md`
3. `docs/04-database-model.md`
4. `docs/05-api-contract.md`
5. `docs/02-user-flows.md`
6. `docs/06-ai-rag-spec.md`
7. `docs/07-integration-and-env.md`
8. `docs/08-ui-pages-and-components.md`
9. `docs/09-implementation-plan.md`
10. `docs/10-seed-data-and-test-cases.md`
11. `docs/11-ui-design-system.md` nếu task có UI.

Áp dụng chế độ đọc đầy đủ cho các task như:

- Khởi tạo repo.
- Tạo database schema ban đầu.
- Tạo module lớn mới.
- Làm milestone mới chưa có code nền.
- Refactor kiến trúc.
- Tích hợp AI, payment, storage, notification hoặc worker.
- Task có ảnh hưởng nhiều module cùng lúc.

#### 2. Đọc theo phạm vi task

Với task nhỏ hoặc task đã có phạm vi rõ ràng, Codex chỉ cần đọc:

- `AGENTS.md`.
- `docs/09-implementation-plan.md` để xác định task thuộc milestone/subtask nào.
- Tài liệu liên quan trực tiếp đến task theo bảng `Task routing map` bên dưới.
- Code hiện tại của module đang sửa.
- Changelog gần nhất nếu cần hiểu thay đổi trước đó.

Không cần đọc lại toàn bộ tài liệu nếu task không ảnh hưởng toàn hệ thống.

#### 3. Khi có nghi ngờ hoặc mâu thuẫn

Nếu task đang làm có dấu hiệu ảnh hưởng sang tài liệu khác, Codex phải mở thêm tài liệu liên quan để kiểm tra chéo.

Ví dụ:

- Sửa database mà làm thay đổi API response thì phải xem cả `docs/04-database-model.md` và `docs/05-api-contract.md`.
- Sửa AI explanation mà ảnh hưởng cache hoặc bảng dữ liệu thì phải xem `docs/06-ai-rag-spec.md`, `docs/04-database-model.md` và `docs/05-api-contract.md`.
- Sửa payment mà ảnh hưởng enrollment thì phải xem `docs/05-api-contract.md`, `docs/04-database-model.md` và `docs/02-user-flows.md`.

#### 4. Nguyên tắc tiết kiệm context

Codex phải ưu tiên đọc đúng tài liệu cần thiết, không đọc tràn lan.

Không dùng việc “đọc thiếu tài liệu” để tự suy diễn nghiệp vụ hoặc tự đổi kiến trúc.

Nếu thiếu thông tin để code an toàn, Codex phải dừng lại, nêu câu hỏi hoặc ghi rõ `TODO`/`ASSUMPTION`.

### Quy trình bắt đầu mỗi task

Trước khi sửa code cho bất kỳ task nào, Codex phải thực hiện quy trình sau:

1. Đọc `AGENTS.md`.
2. Đọc yêu cầu task của owner.
3. Tự phân loại task thuộc milestone/subtask nào trong `docs/09-implementation-plan.md`.
4. Xác định tài liệu liên quan cần đọc theo `Task routing map`.
5. Đọc các tài liệu liên quan trước khi code.
6. Viết kế hoạch thực hiện ngắn gọn, gồm:
   - task thuộc milestone/subtask nào,
   - đã đọc hoặc sẽ đọc tài liệu nào,
   - sẽ sửa module/file nào,
   - có cần cập nhật database/API/AI docs không,
   - lệnh test/build dự kiến sẽ chạy.
7. Chỉ sau đó mới bắt đầu sửa code.

Nếu task quá mơ hồ và không thể phân loại an toàn, Codex phải hỏi lại hoặc ghi rõ `ASSUMPTION`, không tự ý suy diễn nghiệp vụ lớn.

Codex không được dùng prompt ngắn của owner làm lý do để bỏ qua tài liệu liên quan.

### Quy tắc phạm vi khi làm milestone/subtask

`docs/09-implementation-plan.md` chia việc thành các subtask nhỏ dạng `M0.1`, `M0.2`, `M1.1`, v.v.

Quy tắc:

- Một lần owner giao task mặc định chỉ được làm **một subtask**.
- Không tự ý làm sang subtask khác nếu chưa được yêu cầu.
- Nếu cần sửa file thuộc subtask khác để task hiện tại chạy được, phải ghi rõ lý do trong kế hoạch và changelog.
- Nếu một subtask vẫn quá lớn so với context hoặc khả năng hoàn thành trọn vẹn, Codex phải đề xuất chia nhỏ hơn trước khi code.
- Không gom nhiều milestone vào một request, trừ khi owner yêu cầu rõ.

### Task routing map

Codex phải dùng bảng này để chọn tài liệu cần đọc trước khi code.

Quy tắc UI bổ sung:

- Nếu task có giao diện, ngoài các tài liệu trong milestone, Codex phải đọc `docs/08-ui-pages-and-components.md` và `docs/11-ui-design-system.md`.
- Nếu UI cần data/API, đọc thêm `docs/05-api-contract.md`.
- Nếu UI là một flow người dùng cụ thể, đọc thêm `docs/02-user-flows.md`.
- Nếu task chỉ làm UI, không sửa backend/database trừ khi owner yêu cầu rõ.

#### Repo setup / tooling / monorepo

Milestone liên quan:

- `M0.x`

Phải đọc:

- `AGENTS.md`
- `docs/03-technical-architecture.md`
- `docs/07-integration-and-env.md`
- `docs/09-implementation-plan.md`

#### Database / Prisma / migration / seed

Milestone liên quan:

- `M1.x`

Phải đọc:

- `AGENTS.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md` nếu API bị ảnh hưởng
- `docs/06-ai-rag-spec.md` nếu liên quan embedding, AI logs, document chunks hoặc pgvector
- `docs/10-seed-data-and-test-cases.md` nếu liên quan seed/test
- `docs/09-implementation-plan.md`

#### Auth / register / login / refresh token / forgot password / RBAC

Milestone liên quan:

- `M2.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/07-integration-and-env.md`
- `docs/09-implementation-plan.md`

#### Learning path / course / lesson admin

Milestone liên quan:

- `M3.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/08-ui-pages-and-components.md` nếu có UI
- `docs/09-implementation-plan.md`

#### File upload / Cloudflare R2 / PDF processing

Milestone liên quan:

- `M4.x`

Phải đọc:

- `AGENTS.md`
- `docs/03-technical-architecture.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/07-integration-and-env.md`
- `docs/09-implementation-plan.md`

#### Embedding / pgvector / RAG retrieval

Milestone liên quan:

- `M5.x`

Phải đọc:

- `AGENTS.md`
- `docs/03-technical-architecture.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/06-ai-rag-spec.md`
- `docs/07-integration-and-env.md`
- `docs/09-implementation-plan.md`

#### Quiz / flashcard / test CRUD

Milestone liên quan:

- `M6.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/08-ui-pages-and-components.md` nếu có UI
- `docs/09-implementation-plan.md`

#### Student learning flow / attempts / progress / top 5

Milestone liên quan:

- `M7.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/08-ui-pages-and-components.md` nếu có UI
- `docs/09-implementation-plan.md`

#### Payment / payOS / discount / enrollment

Milestone liên quan:

- `M8.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/07-integration-and-env.md`
- `docs/09-implementation-plan.md`

#### AI generation / explanation / AI chat

Milestone liên quan:

- `M9.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/06-ai-rag-spec.md`
- `docs/07-integration-and-env.md`
- `docs/09-implementation-plan.md`

#### Notification / realtime / email / Zalo

Milestone liên quan:

- `M10.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/03-technical-architecture.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/07-integration-and-env.md`
- `docs/08-ui-pages-and-components.md` nếu có UI
- `docs/09-implementation-plan.md`

#### Parent portal

Milestone liên quan:

- `M11.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/08-ui-pages-and-components.md`
- `docs/09-implementation-plan.md`

#### Report / moderation / news / events / livestream

Milestone liên quan:

- `M12.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/08-ui-pages-and-components.md` nếu có UI
- `docs/09-implementation-plan.md`

#### XP / level / leaderboard / profile / avatar

Milestone liên quan:

- `M13.x`

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/08-ui-pages-and-components.md` nếu có UI
- `docs/10-seed-data-and-test-cases.md` nếu có test/seed
- `docs/09-implementation-plan.md`

#### Testing / hardening / deploy

Milestone liên quan:

- `M14.x`

Phải đọc:

- `AGENTS.md`
- `docs/03-technical-architecture.md`
- `docs/07-integration-and-env.md`
- `docs/10-seed-data-and-test-cases.md`
- `docs/09-implementation-plan.md`


### Nguyên tắc xử lý khi có mâu thuẫn

Nếu các tài liệu có điểm chưa khớp, áp dụng thứ tự ưu tiên:

1. `AGENTS.md` ưu tiên cao nhất về quy tắc code, công nghệ, cấu trúc repo và cách làm việc.
2. `docs/01-product-scope.md` ưu tiên cao nhất về phạm vi MVP và nghiệp vụ sản phẩm.
3. `docs/03-technical-architecture.md` ưu tiên cao nhất về công nghệ và kiến trúc hệ thống.
4. `docs/04-database-model.md` ưu tiên cao nhất về dữ liệu và quan hệ bảng.
5. `docs/05-api-contract.md` ưu tiên cao nhất về giao tiếp front-end/back-end.
6. `docs/06-ai-rag-spec.md` ưu tiên cao nhất về AI, RAG, embedding, retrieval và cache lời giải.
7. `docs/09-implementation-plan.md` chỉ quy định thứ tự triển khai, không được dùng để thay đổi phạm vi nghiệp vụ hoặc kiến trúc đã chốt.

Nếu phát hiện mâu thuẫn lớn, Codex phải ghi rõ trong phần trả lời hoặc PR description:

- tài liệu nào mâu thuẫn,
- quyết định tạm thời đang áp dụng,
- file nào cần cập nhật sau.

Không được âm thầm tự ý chọn một hướng làm thay đổi scope hoặc stack.

---

## 1. Mục tiêu dự án

Dự án là hệ thống học theo lộ trình cho học sinh.

MVP tập trung vào:

- Môn Toán, Lý, Hóa.
- Lộ trình học theo môn và khối lớp, ví dụ Toán 7, Toán 8, Lý 8, Hóa 9.
- Học sinh học lần lượt từng buổi trong lộ trình.
- Admin quản lý lộ trình, buổi học, tài liệu, quiz, flashcard, bài kiểm tra, thông báo, report.
- Học sinh học thử buổi đầu, mua lộ trình, học bài, làm quiz, học flashcard, làm bài kiểm tra, chat AI trong buổi học.
- Phụ huynh liên kết con, thanh toán cho con, theo dõi tiến độ và nhận thông báo.
- AI hỗ trợ tạo tóm tắt, quiz, flashcard, bài kiểm tra, lời giải và chat theo tài liệu từng buổi học.
- Thông báo realtime trong hệ thống qua biểu tượng/nút thông báo.
- Thanh toán QR/đối soát tự động bằng payOS.
- File upload lưu ở Cloudflare R2.
- Database production dùng Supabase Postgres + pgvector.

MVP không làm:

- Chat realtime giữa người dùng.
- Chat realtime học sinh với admin.
- Chat realtime phụ huynh với admin.
- Bạn thân.
- Chat nhóm theo khóa.
- Format riêng cho môn Tiếng Anh.
- Học bổng.
- Chống gian lận bài kiểm tra.

---

## 2. Stack công nghệ bắt buộc

Không tự ý thay đổi stack dưới đây.

### Front-end

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
- Công thức lưu dạng LaTeX trong Tiptap JSON.

### Back-end

- NestJS.
- TypeScript.
- REST API.
- Swagger/OpenAPI.
- JWT access token + refresh token.
- RBAC theo role `ADMIN`, `STUDENT`, `PARENT`.
- API container và worker container tách riêng.

### Database

- Supabase Postgres.
- pgvector.
- Prisma.
- Raw SQL trong Prisma cho vector/hybrid search khi cần.
- Không chạy PostgreSQL production trên VPS.

### Queue và worker

- Redis chạy trên VPS.
- BullMQ làm job queue.
- NestJS worker chạy riêng với API container.
- Worker xử lý PDF, embedding, AI generation, gửi notification/email/Zalo, render ảnh minh họa.

### Storage

- Cloudflare R2.
- Không dùng MinIO trong production MVP.
- Không lưu file upload chính trên disk của app/VPS.

### AI

- OpenAI là provider chính.
- Gemini là provider phụ.
- Tạo lớp `AiProvider` abstraction.
- Embedding chính dùng OpenAI Embeddings.
- Structured output chính dùng OpenAI.
- Không trộn embedding của nhiều provider trong cùng một vector space.
- AI output phải validate bằng Zod hoặc JSON Schema.

### Realtime

- Socket.IO.
- NestJS WebSocket Gateway.
- MVP chỉ làm notification realtime trong hệ thống, không làm chat realtime user-user.

### Payment, email, Zalo

- Payment: payOS.
- Email: Resend.
- Zalo notification: Zalo OA/ZNS.

### Deploy

- VPS: Viettel Cloud GEN05.
- OS: Ubuntu LTS.
- Runtime: Docker + Docker Compose.
- Reverse proxy: Nginx.
- SSL: Certbot/Let's Encrypt.
- Chỉ cần 1 domain chính:
  - Front-end: `yourdomain.com`.
  - Back-end API: `api.yourdomain.com`.

---

## 3. Cấu trúc repo đề xuất

Dùng monorepo với Turborepo.

```txt
.
├── AGENTS.md
├── docs/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── tests/
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/
│       │   ├── common/
│       │   ├── config/
│       │   ├── jobs/
│       │   └── workers/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── test/
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/
│       │   └── constants/
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
└── turbo.json
```

ASSUMPTION: Dự án sẽ dùng `apps/web` cho Next.js, `apps/api` cho NestJS, `packages/shared` cho type/schema dùng chung. Nếu repo thực tế đã có cấu trúc khác, không đổi cấu trúc lớn nếu chưa được yêu cầu.

---

## 4. Quy tắc code chung

- Dùng TypeScript nghiêm ngặt.
- Không dùng `any` nếu có thể định nghĩa type rõ.
- Tất cả input từ client phải validate bằng Zod hoặc DTO + class-validator.
- Không hard-code secret, token, API key, webhook key hoặc config production.
- Không tự ý thêm package nặng nếu không cần thiết.
- Không tự ý thêm tính năng ngoài MVP.
- Không đổi database, queue, storage, payment, AI provider đã chốt.
- Code phải chia module rõ theo domain.
- Tên biến, tên hàm và tên file dùng tiếng Anh.
- Nội dung hiển thị cho người dùng có thể dùng tiếng Việt.
- API response nên nhất quán theo format trong `docs/05-api-contract.md`.
- Cần xử lý lỗi rõ ràng, không nuốt lỗi.
- Các thao tác nhạy cảm phải có audit log.

---

## 5. Quy tắc back-end

### Module NestJS đề xuất

```txt
AuthModule
UsersModule
ProfilesModule
CoursesModule
LessonsModule
MaterialsModule
FilesModule
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

Không bắt buộc tạo tất cả module ngay từ commit đầu, nhưng nên bám theo hướng này.

### Authentication

- Dùng JWT access token ngắn hạn.
- Dùng refresh token dài hạn.
- Refresh token phải được hash trước khi lưu database.
- Logout phải revoke refresh token.
- Không trả password hash ra API.

### Authorization

- Admin được quản lý nội dung.
- Student chỉ thao tác dữ liệu học tập của chính mình.
- Parent chỉ xem/thao tác dữ liệu của con đã liên kết.
- Một học sinh chỉ có một phụ huynh.
- Một phụ huynh có thể liên kết nhiều con.

### API conventions

- Base path: `/api/v1`.
- Swagger/OpenAPI bật ở môi trường dev/staging.
- Không bật Swagger public production nếu chưa có bảo vệ.
- Các endpoint admin dùng prefix `/admin`.
- Các endpoint parent dùng prefix `/parent`.
- Các endpoint student dùng prefix `/student` khi cần phân biệt rõ.

---

## 6. Quy tắc database và migration

- Dùng Prisma schema làm nguồn định nghĩa chính cho model.
- Migration phải được commit vào repo.
- Không sửa database trực tiếp trong production nếu không có migration.
- Với pgvector, Prisma có thể cần `Unsupported("vector(1536)")` hoặc raw SQL.
- Các index vector/hybrid search nên tạo bằng raw SQL migration.
- Cần bật extension `vector` trên Supabase Postgres.
- Cần unique/index rõ cho:
  - email/phone/username user,
  - mã con của học sinh,
  - enrollment active,
  - payment order code,
  - webhook idempotency,
  - target của cached AI explanation,
  - notification recipient/time,
  - report target/status.

Không đặt database production trên VPS.

---

## 7. Quy tắc AI/RAG

- Không gửi toàn bộ tài liệu/PDF lên AI mỗi lần học sinh hỏi.
- Tài liệu buổi học phải được extract text, chunk, embedding và lưu theo `lesson_id`.
- Khi chat AI, retrieval chỉ lấy chunk thuộc đúng `lesson_id` hiện tại.
- Có thể kết hợp vector search với keyword search để bắt công thức/ký hiệu.
- Nếu không tìm được context phù hợp, AI phải từ chối trả lời nội dung ngoài phạm vi và yêu cầu học sinh hỏi lại câu liên quan đến buổi học.
- Lời giải AI cho quiz/flashcard/câu thi phải được cache ở cấp item.
- Nếu đã có lời giải lưu sẵn thì học sinh bấm “Giải thích cho tôi” dùng lại, không gọi AI mới.
- Chỉ tạo lại lời giải khi:
  - chưa có lời giải,
  - admin yêu cầu tạo lại,
  - nội dung câu hỏi thay đổi,
  - tài liệu nguồn thay đổi.
- AI output phải validate bằng Zod/JSON Schema trước khi lưu database.
- Không render raw SVG trực tiếp từ AI.
- Nếu cần ảnh minh họa, AI tạo `diagram_spec_json`, backend render thành SVG/PNG an toàn.

---

## 8. Quy tắc payment

- Payment dùng payOS.
- Webhook phải verify chữ ký/checksum.
- Webhook phải idempotent.
- Không mở khóa lộ trình nếu webhook chưa verify.
- Thanh toán thành công tạo enrollment 12 tháng.
- `expires_at = paid_at + 12 months`.
- Cần lưu payment logs và webhook logs.
- Không tin tưởng dữ liệu amount/course từ client. Server phải tự tính lại amount theo course và discount code.

---

## 9. Quy tắc storage/file upload

- File upload lưu vào Cloudflare R2.
- Không lưu file chính trong thư mục app trên VPS.
- Backend tạo signed URL hoặc proxy upload/download theo quyền.
- Cần lưu metadata file trong database.
- File private phải kiểm tra quyền truy cập.
- File trong editor, ảnh câu hỏi/câu trả lời, avatar, PDF, ảnh ghi chú, ảnh minh họa AI đều dùng chung cơ chế file metadata + R2 object key.
- Cần giới hạn loại file và dung lượng upload.

ASSUMPTION: Giới hạn dung lượng file cụ thể chưa được chốt. Có thể đặt tạm:

- PDF bài học: tối đa 50MB.
- Ảnh: tối đa 10MB.
- Avatar: tối đa 5MB.

Nếu owner có quyết định khác, cập nhật `docs/07-integration-and-env.md` và backend validation.

---

## 10. Quy tắc notification

- Notification in-app luôn lưu DB.
- Nếu user online, gửi realtime event qua Socket.IO.
- Nếu user offline, user mở nút thông báo thì load danh sách mới nhất từ DB.
- Email/Zalo là kênh bổ sung cho một số thông báo quan trọng.
- Admin có thể gửi thông báo thủ công tới từng tài khoản student/parent.
- Realtime notification không đồng nghĩa với chat realtime giữa người dùng.

---

## 11. Quy tắc front-end

- Dùng Next.js App Router.
- Dùng TypeScript.
- Dùng Tailwind CSS + shadcn/ui.
- Dùng TanStack Query cho server state.
- Dùng Zustand cho client state nhỏ như auth/session UI, selected child, notification dropdown state.
- Form dùng React Hook Form + Zod.
- Rich text dùng Tiptap.
- Công thức Toán/Lý/Hóa lưu LaTeX trong Tiptap JSON.
- Khi làm UI, phải đọc `docs/11-ui-design-system.md` và `docs/08-ui-pages-and-components.md`.
- Nếu có `docs/ui-references/approved-patterns.md`, phải đọc khi làm UI tương tự pattern đã được owner chốt.
- Không tự chọn style ngẫu nhiên; bám token, spacing, typography và responsive rules trong `docs/11-ui-design-system.md`.
- UI ưu tiên mobile-first: thiết kế và kiểm tra trước cho điện thoại, sau đó mở rộng cho tablet/iPad và laptop/desktop.
- Các màn học, quiz, flashcard, test, payment và dashboard phải responsive rõ ràng trên mobile, tablet/iPad và laptop/desktop; tránh layout chỉ đẹp trên một nhóm thiết bị.
- Màn hình có data/action phải có loading, empty, error và disabled state phù hợp.
- Nếu task chỉ làm UI, không sửa backend/database. Nếu cần mock data, đặt mock rõ ràng và dễ xóa khi connect API.
- Nếu có thể chạy app, UI task nên được kiểm tra bằng browser/screenshot ở mobile và desktop; layout phức tạp kiểm tra thêm tablet/iPad.
- Khi owner nói "ưng rồi", "ok rồi", "đúng ý rồi" hoặc "chốt UI này", Codex phải lưu pattern vào `docs/ui-references/approved-patterns.md`; chỉ cập nhật `docs/11-ui-design-system.md` nếu đó là nguyên tắc áp dụng rộng.
- Không xử lý permission chỉ bằng UI. Backend vẫn phải enforce RBAC.
- Route admin/student/parent phải có guard.

---

## 12. Testing

- Unit test: Jest.
- Backend API test: Jest + Supertest.
- Frontend E2E: Playwright.
- AI output test: validate bằng Zod/JSON Schema.
- Payment webhook test phải kiểm tra idempotency.
- Worker job test nên dùng mock provider cho AI, mock R2, mock payOS, mock Resend/Zalo.

Không gọi OpenAI/Gemini thật trong unit test mặc định.

---

## 13. Quy tắc changelog và commit

Mục tiêu: mỗi lần Codex hoàn thành một thay đổi có thể commit, repo phải có changelog ngắn gọn ghi lại việc đã làm. Changelog này giúp owner kiểm tra lịch sử thay đổi mà không phải đọc toàn bộ diff.

### 13.1. Vị trí changelog

Codex phải ghi changelog trong thư mục:

```txt
.codex/changelog/
```

Nếu thư mục chưa tồn tại, Codex phải tạo thư mục này.

Tên file changelog theo ngày:

```txt
.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md
```

Ví dụ:

```txt
.codex/changelog/CHANGELOG_2026-07-06_codex.md
```

Quy tắc:

- Nếu trong cùng ngày đã có file changelog, append thêm entry mới vào file đó.
- Nếu chưa có file changelog của ngày hiện tại, tạo file mới.
- Ngày dùng theo ngày local của môi trường chạy Codex nếu có thể lấy được bằng hệ thống; nếu không rõ timezone, dùng UTC và ghi `ASSUMPTION: date uses UTC`.
- Không tạo một file changelog mới cho từng commit nếu cùng ngày đã có file.

### 13.2. Khi nào phải ghi changelog

Codex phải cập nhật changelog khi:

- Hoàn thành một task code có thể commit.
- Thay đổi database schema hoặc migration.
- Thay đổi API contract hoặc behavior API.
- Thay đổi worker/job/queue.
- Thay đổi AI/RAG prompt, schema, retrieval hoặc cache logic.
- Thay đổi payment, auth, permission, storage, notification hoặc integration bên thứ ba.
- Sửa bug có tác động đến nghiệp vụ.
- Thêm/sửa test đáng kể.
- Cập nhật tài liệu trong repo theo yêu cầu task.

Không bắt buộc ghi changelog cho:

- Thay đổi nháp chưa hoàn thành.
- Format whitespace nhỏ không có ý nghĩa.
- Comment tạm thời trong quá trình làm việc chưa commit.

### 13.3. Format entry changelog

Mỗi entry changelog phải ngắn gọn, chỉ ghi ý chính. Mặc định dùng format:

```md
## YYYY-MM-DD — <tên task ngắn>

- Summary: <1 câu mô tả thay đổi chính>
- Changed: <1-2 ý chính, có thể ghi cùng một dòng>
- Files: `path/to/file`, `path/to/another-file`
- Tests: <test đã chạy hoặc "Not run: <lý do>">
- Notes: <chỉ ghi nếu có migration/env/TODO/ASSUMPTION/rủi ro>
```

Nếu mục nào không có thông tin đáng nói thì bỏ mục đó, trừ `Summary`, `Files` và `Tests`.

Nếu task lớn hoặc có rủi ro cao, có thể thêm các mục:

```md
- Database: <migration/schema/index/constraint đã đổi>
- API: <endpoint/DTO/guard/service đã đổi>
- Worker/AI: <queue/job/provider/schema/retrieval/cache đã đổi>
- Security: <auth/RBAC/secret/webhook permission đã kiểm tra>
```

### 13.4. Quy tắc nội dung changelog

- Viết ngắn, cụ thể, không kể lại toàn bộ diff; ưu tiên 4-8 dòng cho một entry thường.
- `Changed` tối đa 2 ý chính, trừ task lớn thật sự cần nhiều hơn.
- `Files` có thể gom path liên quan bằng wildcard như `apps/api/**` nếu hợp lý.
- Không ghi secret, API key, token, webhook signature, private URL hoặc thông tin nhạy cảm.
- Không copy raw prompt dài hoặc dữ liệu người dùng vào changelog.
- Nếu có migration, ghi tên migration và mục đích.
- Nếu có biến môi trường mới, chỉ ghi tên biến, không ghi giá trị.
- Nếu test chưa chạy được, phải ghi rõ `Not run` và lý do.
- Nếu có rủi ro còn lại, ghi ngắn trong `Notes` hoặc `TODO`.

### 13.5. Quan hệ với commit

Codex không được tự commit nếu owner chưa yêu cầu rõ.

Khi owner yêu cầu commit hoặc khi Codex đề xuất một commit, Codex phải đảm bảo:

- Changelog đã được cập nhật trước.
- File changelog nằm trong cùng commit với code liên quan.
- Commit message tóm tắt đúng nội dung thay đổi.

Format commit message đề xuất:

```txt
<type>(<scope>): <summary>
```

Ví dụ:

```txt
feat(auth): add refresh token rotation
fix(payment): make payOS webhook idempotent
docs(codex): update AI RAG implementation rules
```

Type gợi ý:

```txt
feat, fix, refactor, docs, test, chore, perf, build, ci
```

---

## 14. Definition of Done

Một task được xem là xong khi:

- Code chạy được ở local.
- Không có lỗi TypeScript nghiêm trọng.
- API liên quan có validation, auth và authorization.
- Database thay đổi có migration.
- Side effect quan trọng có log hoặc audit log.
- Có test phù hợp hoặc có ghi chú rõ nếu chưa test được.
- Không làm lệch scope MVP.
- Không hard-code secret.
- Đã cập nhật changelog trong `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` nếu task có thể commit.
- Đã xác định đúng milestone/subtask trong `docs/09-implementation-plan.md` và không làm vượt phạm vi task đã giao.
- Không phá các flow chính đã mô tả trong `docs/02-user-flows.md`.
- Nếu thay đổi API, cập nhật `docs/05-api-contract.md`.
- Nếu thay đổi schema, cập nhật `docs/04-database-model.md`.
- Nếu thay đổi AI/RAG, cập nhật `docs/06-ai-rag-spec.md`.

---

## 15. Ghi chú vận hành ban đầu

Quy mô production ban đầu dự kiến là 50 học sinh.

Ngân sách production nên chuẩn bị khoảng 5.500.000 VNĐ/tháng, gồm VPS Viettel GEN05, Supabase Postgres Pro, Cloudflare R2, Resend, Zalo/ZNS, OpenAI/Gemini, domain và dự phòng phát sinh.

Ghi chú này chỉ dùng để định hướng vận hành và không phải là yêu cầu code trực tiếp.
