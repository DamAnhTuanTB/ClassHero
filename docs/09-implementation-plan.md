# 09. Implementation Plan - Kế hoạch triển khai theo subtask nhỏ

Tài liệu này quy định thứ tự triển khai để Codex code theo đúng nền tảng trước, tính năng sau.

Bản này chia các milestone lớn thành các subtask nhỏ hơn. Mục tiêu là mỗi lần owner giao task, Codex có thể làm trọn vẹn một subtask trong phạm vi an toàn, dễ review, dễ test và dễ rollback.

---

## 0. Nguyên tắc triển khai

- Không làm tính năng ngoài MVP.
- Không đổi stack công nghệ đã chốt.
- Database/API/AI thay đổi phải cập nhật docs liên quan.
- Ưu tiên code chạy được theo từng subtask nhỏ.
- Một lần Codex nhận task mặc định chỉ làm một subtask, ví dụ `M4.2` hoặc `M9.5`.
- Không tự ý làm sang subtask khác nếu chưa được yêu cầu.
- Nếu task ngắn của owner chưa ghi rõ subtask, Codex phải tự map task vào subtask gần nhất trong tài liệu này.
- Nếu task có thể thuộc nhiều subtask, Codex phải nêu giả định hoặc hỏi lại trước khi code.
- Nếu một subtask vẫn quá lớn, Codex phải đề xuất chia nhỏ hơn trước khi code.

---

## 1. Cách dùng tài liệu này với Codex

### 1.1. Khi owner giao task rõ subtask

Ví dụ:

```txt
Hãy làm M8.3: payOS webhook verify + idempotency + tạo enrollment.
```

Codex phải:

1. Đọc `AGENTS.md`.
2. Đọc subtask tương ứng trong tài liệu này.
3. Đọc tài liệu liên quan theo `Task routing map` trong `AGENTS.md`.
4. Viết kế hoạch ngắn.
5. Code đúng phạm vi subtask.
6. Chạy test/build liên quan nếu khả dụng.
7. Cập nhật changelog.

### 1.2. Khi owner giao task ngắn

Ví dụ:

```txt
Làm tính năng thanh toán.
```

Codex không được code ngay.

Codex phải:

1. Tự map task vào milestone/subtask gần nhất, ví dụ `M8.x`.
2. Mở `AGENTS.md` để xem `Task routing map`.
3. Đọc tài liệu liên quan.
4. Nêu rõ sẽ làm subtask nào trước.
5. Chỉ code sau khi phạm vi đủ rõ.

### 1.3. Definition of Done chung cho mọi subtask

Một subtask được xem là xong khi:

- Code nằm đúng phạm vi subtask.
- Không làm lệch MVP.
- Không đổi stack công nghệ.
- Không hard-code secret.
- Có validation, auth và authorization nếu có API.
- Có migration nếu thay đổi database.
- Có cập nhật docs liên quan nếu thay đổi contract/schema/AI behavior.
- Build/lint/test liên quan chạy được nếu môi trường cho phép.
- Nếu test chưa chạy, ghi rõ `Not run` và lý do trong changelog.
- Changelog đã cập nhật theo `AGENTS.md`.

---

## P0: Pre-task - Codex execution plan

### Mục tiêu

Đảm bảo Codex hiểu tài liệu trước khi bắt đầu code.

### M0.P: Đọc tài liệu và tạo execution plan

Phạm vi:

- Không sửa code.
- Đọc tài liệu cốt lõi.
- Tạo hoặc cập nhật `docs/codex-execution-plan.md` nếu owner yêu cầu.

Phải đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/03-technical-architecture.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/06-ai-rag-spec.md`
- `docs/09-implementation-plan.md`

Done khi:

- Có execution plan ngắn theo thứ tự subtask.
- Có ghi chú mâu thuẫn hoặc `TODO` nếu phát hiện.
- Không có code production bị thay đổi.
- Changelog đã cập nhật nếu có thay đổi file.

---

## M0: Repo setup và tooling nền tảng

### M0.1: Khởi tạo monorepo Turborepo

Mục tiêu:

- Tạo cấu trúc repo nền tảng.

Phạm vi:

- Setup Turborepo.
- Tạo `apps/web` Next.js TypeScript.
- Tạo `apps/api` NestJS TypeScript.
- Tạo `packages/shared`.
- Tạo scripts root cơ bản: dev, build, lint, typecheck nếu phù hợp.

Không làm:

- Không tạo business logic.
- Không tạo Prisma schema.
- Không tích hợp R2/payOS/AI.

Done khi:

- `pnpm install` chạy được.
- Web/API có thể start ở mức mặc định.
- Cấu trúc repo đúng định hướng trong `AGENTS.md`.

### M0.2: Tooling, env example, Docker local và health check

Mục tiêu:

- Hoàn thiện nền chạy local cơ bản.

Phạm vi:

- Setup ESLint/Prettier nếu cần.
- Tạo `.env.example` cho root/web/api theo `docs/07-integration-and-env.md`.
- Tạo `docker-compose.dev.yml` hoặc `docker-compose.yml` local cho web/api/redis.
- Tạo health endpoint cơ bản cho API.
- Tạo README local run ngắn.

Không làm:

- Không hard-code secret.
- Không tạo module nghiệp vụ.

Done khi:

- API có health check.
- `.env.example` không chứa secret thật.
- README hướng dẫn chạy local đủ dùng.

---

## M1: Database + Prisma nền tảng

### M1.1: Setup Prisma và database foundation

Mục tiêu:

- Kết nối NestJS với Prisma/Supabase Postgres ở mức nền.

Phạm vi:

- Setup Prisma trong `apps/api`.
- Tạo `schema.prisma` ban đầu.
- Cấu hình DATABASE_URL/DIRECT_URL nếu cần.
- Tạo PrismaModule/PrismaService skeleton nếu phù hợp.
- Tạo migration bật extension `vector` cho pgvector.

Không làm:

- Không tạo toàn bộ model MVP trong một lượt nếu quá lớn.
- Không implement API nghiệp vụ.

Done khi:

- `prisma validate` chạy được.
- Migration pgvector có ghi chú rõ nếu dùng raw SQL.

### M1.2: User, auth token, profile, file và background job models

Mục tiêu:

- Tạo nhóm model nền tảng dùng chung cho nhiều module.

Phạm vi:

- Enums nền tảng.
- `users`.
- `student_profiles`.
- `parent_profiles`.
- `parent_student_links`.
- `refresh_tokens`.
- `password_reset_tokens`.
- `files`.
- `background_jobs`.
- `audit_logs` nếu chưa có.

Done khi:

- Relations đúng role admin/student/parent.
- Một học sinh chỉ có một phụ huynh theo constraint/service rule.
- File model có `purpose`, provider, object key, visibility/status.
- Background job đủ phục vụ `GET /jobs/:jobId`.

### M1.3: Learning path, lesson, material, document và enrollment models

Mục tiêu:

- Tạo model lõi cho lộ trình/buổi học/tài liệu/enrollment.

Phạm vi:

- `learning_paths`.
- `lessons`.
- `lesson_materials`.
- `lesson_documents`.
- `document_chunks` với pgvector field.
- `lesson_summaries`.
- `enrollments`.
- `lesson_progress`.

Done khi:

- Lesson có order unique trong learning path.
- Enrollment có thời hạn 12 tháng.
- Có partial unique index cho active enrollment nếu dùng raw SQL.
- Document/chunk hỗ trợ RAG theo `lesson_id`, provider, model, dimensions.

### M1.4: Quiz, flashcard, test, attempt và learning interaction models

Mục tiêu:

- Tạo model cho nội dung học tập và lịch sử làm bài.

Phạm vi:

- `quiz_sets`.
- `quiz_questions`.
- `quiz_attempts`.
- `quiz_attempt_answers`.
- `flashcard_sets`.
- `flashcards`.
- `flashcard_progress`.
- `test_sets`.
- `test_questions`.
- `test_attempts`.
- `test_attempt_answers`.
- Favorite item model nếu đã có trong database model.
- Note/comment private model nếu đã có trong database model.

Done khi:

- Một lesson có nhiều bộ quiz/flashcard/test.
- Attempt nhiều lần được lưu.
- Best attempt có index/rule rõ.
- Item-level report/hide có field hỗ trợ.

### M1.5: Payment, notification, report, AI log, gamification và news models

Mục tiêu:

- Tạo các model còn lại cho MVP.

Phạm vi:

- `payments`.
- `payment_webhook_logs`.
- `discount_codes`.
- `notifications`.
- `notification_deliveries`.
- `reports`.
- `report_actions`.
- `ai_generations`.
- `ai_explanations`.
- `ai_chat_sessions`.
- `ai_chat_messages`.
- `conversation_summaries`.
- `xp_events`.
- `student_levels` hoặc field level theo database model.
- `news_events`.

Done khi:

- Payment có idempotency/webhook log.
- Notification hỗ trợ realtime/offline/delivery.
- AI logs lưu provider/model/token/cost/error đủ debug.
- AI explanation cache có hash/stale logic.
- XP completion có idempotency rule.

### M1.6: Seed tối thiểu và database validation

Mục tiêu:

- Có dữ liệu mẫu để test các milestone sau.

Phạm vi:

- Seed admin.
- Seed 1 student.
- Seed 1 parent.
- Seed 1 learning path Toán 7.
- Seed 1-2 lesson tối thiểu.
- Seed sample quiz/flashcard/test nếu phù hợp.

Done khi:

- Seed chạy được trên dev DB.
- Admin login được ở milestone Auth sau khi Auth hoàn tất.
- Prisma client generate thành công.

---

## M2: Auth, RBAC và backend foundation

### M2.1: Backend foundation module

Mục tiêu:

- Chuẩn hóa nền API trước khi làm auth/domain.

Phạm vi:

- ConfigModule với env validation.
- PrismaModule nếu chưa làm ở M1.
- Global validation pipe.
- Error response format.
- Swagger/OpenAPI setup.
- Logger cơ bản.

Done khi:

- API build được.
- Swagger chạy ở dev.
- Thiếu env bắt buộc báo lỗi rõ.

### M2.2: Register, login, refresh và logout

Mục tiêu:

- Hoàn thiện auth cơ bản.

Phạm vi:

- Register student.
- Register parent.
- Login bằng username/email/số điện thoại theo contract.
- Password hashing.
- JWT access token.
- Refresh token hash/revoke.
- Logout revoke refresh token.

Done khi:

- Student/parent register được.
- Login trả access/refresh token.
- Refresh token rotate/revoke đúng rule.

### M2.3: RBAC, `GET /me`, profile base và forgot/reset password

Mục tiêu:

- Enforce role và hoàn thiện account API nền.

Phạm vi:

- Role decorator/guard.
- `GET /me`.
- API profile cơ bản theo contract.
- Forgot password.
- Reset password bằng `password_reset_tokens`.
- Test permission admin/student/parent tối thiểu.

Done khi:

- Admin endpoint bị chặn nếu không phải admin.
- Student/parent chỉ đọc/sửa phần được phép.
- Reset token không lưu raw token.

---

## M3: Admin learning path và lesson CRUD

### M3.1: Admin learning path API

Mục tiêu:

- Admin quản lý lộ trình học.

Phạm vi:

- CRUD learning path.
- Publish/archive/hide status.
- Price/original price/discount price fields.
- Subject/grade filtering.
- Audit log cho thao tác quan trọng.

Done khi:

- Admin tạo/sửa/xóa mềm/publish lộ trình.
- Student chỉ thấy lộ trình published.

### M3.2: Admin lesson API

Mục tiêu:

- Admin quản lý buổi học trong lộ trình.

Phạm vi:

- CRUD lesson.
- Sort order.
- `exam_open_at` hoặc thời điểm mở bài thi.
- Video link.
- Completion criteria default score >= 7.
- Lesson status/publish nếu đã chốt.

Done khi:

- Admin tạo Toán 7 với nhiều buổi học.
- Order trong một learning path không bị trùng.

### M3.3: Public/student learning path listing

Mục tiêu:

- Học sinh/phụ huynh xem danh sách lộ trình published.

Phạm vi:

- Public/student route xem danh sách lộ trình.
- Group/filter theo grade.
- Ưu tiên lớp của học sinh nếu đã đăng nhập.
- Course detail summary.

Done khi:

- Student lớp 7 thấy Toán 7 ưu tiên.
- Chưa mua vẫn xem được thông tin lộ trình.

### M3.4: Admin learning path/lesson UI cơ bản

Mục tiêu:

- Có giao diện admin tối thiểu để nhập dữ liệu lộ trình/buổi học.

Phạm vi:

- List/create/edit learning path.
- List/create/edit lesson.
- Form validation.
- API integration bằng TanStack Query.

Done khi:

- Admin thao tác được từ UI.
- UI không thay thế backend permission.

---

## M4: File upload, Cloudflare R2 và document processing

### M4.1: FilesModule và R2 service

Mục tiêu:

- Có nền upload file vào Cloudflare R2.

Phạm vi:

- R2 client/service.
- File metadata create.
- Upload endpoint hoặc signed upload flow theo contract.
- Permission matrix theo `FilePurpose`.
- File type/size validation.

Done khi:

- Upload ảnh/PDF test lên R2 hoặc mock R2 local được.
- Metadata lưu DB.
- Không lưu file chính trên disk app.

### M4.2: Lesson document API

Mục tiêu:

- Admin gắn PDF/tài liệu vào lesson.

Phạm vi:

- Admin create/list/delete lesson document.
- Lưu `lesson_documents`.
- Tạo background job document processing.
- Job status trả qua `background_jobs`.

Done khi:

- Admin upload PDF và gắn với lesson.
- Có job queued cho xử lý PDF.

### M4.3: BullMQ worker foundation

Mục tiêu:

- Có nền worker chạy tách API.

Phạm vi:

- Redis/BullMQ config.
- Worker bootstrap riêng.
- Background job status update: queued/running/succeeded/failed.
- Retry/error handling cơ bản.

Done khi:

- API enqueue job được.
- Worker nhận job và cập nhật DB status.

### M4.4: PDF extract và chunking

Mục tiêu:

- Xử lý PDF thành text chunks chưa cần embedding.

Phạm vi:

- Extract text PDF bằng pdf-parse/pdfjs-dist.
- Chunking tài liệu.
- Lưu `document_chunks` không embedding hoặc embedding null.
- Lưu error nếu extract thất bại.

Done khi:

- PDF upload tạo được chunks theo lesson.
- Chunk có metadata page/order nếu có thể.

---

## M5: Embedding + RAG retrieval

### M5.1: AiProvider abstraction cho embedding

Mục tiêu:

- Có lớp AI provider abstraction nền.

Phạm vi:

- `AiProvider` interface.
- OpenAI embedding provider.
- Config model/env validation.
- Không gọi Gemini cho embedding trong MVP trừ khi owner yêu cầu.

Done khi:

- Code gọi embedding thông qua abstraction.
- Không trộn provider/model trong cùng vector space.

### M5.2: Embedding worker và lưu pgvector

Mục tiêu:

- Tạo embedding cho chunks.

Phạm vi:

- Embedding job.
- Batch embedding nếu phù hợp.
- Lưu vector vào `document_chunks`.
- Lưu provider/model/dimensions/token usage nếu có.

Done khi:

- Chunk có vector.
- Job retry/error hoạt động.

### M5.3: RetrievalService vector search theo lesson

Mục tiêu:

- Tìm context theo đúng lesson.

Phạm vi:

- Raw SQL pgvector search.
- Filter theo `lesson_id`, provider, model, dimensions.
- Không trả chunk lesson khác.
- Unit/integration test retrieval cơ bản.

Done khi:

- `retrieveContext(lessonId, query)` hoạt động.
- Test chứng minh không leak context giữa lesson.

### M5.4: Hybrid search cho công thức/ký hiệu

Mục tiêu:

- Bổ sung keyword fallback cho Toán/Lý/Hóa.

Phạm vi:

- Keyword search trong cùng lesson.
- Bắt LaTeX/ký hiệu/đơn vị/tên định luật/tên phản ứng.
- Merge kết quả vector + keyword.

Done khi:

- Retrieval có fallback keyword.
- Không vượt token budget context.

---

## M6: Quiz, flashcard, test CRUD thủ công

### M6.1: Rich text JSON và shared content schema

Mục tiêu:

- Chuẩn hóa dữ liệu rich text/công thức dùng chung.

Phạm vi:

- Shared schema cho Tiptap JSON nếu cần.
- DTO validation cho question/answer/explanation/hint.
- Support LaTeX/mhchem ở dạng data, chưa cần editor đầy đủ.

Done khi:

- Backend validate được content JSON.
- Frontend có helper render cơ bản nếu làm UI.

### M6.2: Quiz CRUD API và admin UI tối thiểu

Mục tiêu:

- Admin quản lý quiz thủ công.

Phạm vi:

- CRUD quiz set.
- CRUD quiz question item-level.
- Question type: multiple choice, true/false, text input.
- Difficulty.
- Grading config cho text input.
- Admin UI tối thiểu.

Done khi:

- Admin tạo/sửa/xóa câu quiz lẻ.
- Student đọc được quiz metadata/content.

### M6.3: Flashcard CRUD API và admin UI tối thiểu

Mục tiêu:

- Admin quản lý flashcard thủ công.

Phạm vi:

- CRUD flashcard set.
- CRUD flashcard item-level.
- Front/back/hint/difficulty.
- Admin UI tối thiểu.

Done khi:

- Admin tạo nhiều bộ flashcard trong một lesson.
- Student đọc được flashcard content.

### M6.4: Test CRUD API và admin UI tối thiểu

Mục tiêu:

- Admin quản lý bài kiểm tra thủ công.

Phạm vi:

- CRUD test set.
- CRUD test question item-level.
- Duration.
- Difficulty ratio metadata.
- Total score 10.
- Points default equal nếu chưa set.
- Admin UI tối thiểu.

Done khi:

- Admin tạo nhiều bộ đề trong một lesson.
- Câu hỏi có correct answer và grading config.

### M6.5: Student read-only lesson content API

Mục tiêu:

- Student có thể load nội dung lesson để chuẩn bị flow học.

Phạm vi:

- Read lesson summary/materials/quiz sets/flashcard sets/test metadata.
- Enforce preview rule: trước ngày mở bài thi vẫn xem video/tài liệu/tóm tắt/quiz/flashcard, chưa làm test.

Done khi:

- Student load được lesson content.
- Test availability không bị mở sai.

---

## M7: Student learning flow

### M7.1: Access check, trial lesson và lesson page skeleton

Mục tiêu:

- Enforce quyền học theo enrollment/trial.

Phạm vi:

- Enrollment check.
- Trial first lesson check.
- Student lesson page/API skeleton.
- Previous/next lesson metadata.

Done khi:

- Chưa mua chỉ học thử buổi đầu nếu được phép.
- Đã mua học được lesson trong enrollment còn hạn.

### M7.2: Quiz attempt và submit

Mục tiêu:

- Student làm quiz.

Phạm vi:

- Start quiz attempt.
- Submit answers.
- Chấm điểm/số đúng/số sai.
- Làm lại tất cả.
- Làm lại câu sai nếu nằm trong contract.

Done khi:

- Quiz attempt lưu lịch sử.
- Kết quả trả đúng số câu đúng/sai.

### M7.3: Flashcard progress, favorite và review

Mục tiêu:

- Student học flashcard.

Phạm vi:

- Mark known/unknown.
- Thống kê đã thuộc/chưa thuộc.
- Ôn lại tất cả/chưa thuộc.
- Favorite flashcard nếu model/API đã có.

Done khi:

- Progress lưu theo student/card.
- Student xem lại item yêu thích trong lesson.

### M7.4: Test start, submit và review

Mục tiêu:

- Student làm bài kiểm tra.

Phạm vi:

- Chỉ mở test sau `exam_open_at`.
- Start test attempt.
- Submit answers.
- Score trên thang 10.
- Review toàn bộ đề và câu sai.
- Mỗi lần làm là một bộ đề khác nếu có.

Done khi:

- Test bị chặn trước giờ mở.
- Attempt lưu đầy đủ answers/score/duration.

### M7.5: Best attempt, lesson completion và top 5

Mục tiêu:

- Tính kết quả tốt nhất và hoàn thành lesson.

Phạm vi:

- Best attempt rule: điểm cao hơn, nếu bằng thì thời gian nhanh hơn.
- Lesson completed khi best score >= 7.
- Top 5 trong lesson theo score/time.
- Transaction/idempotency khi update best/progress.

Done khi:

- Best attempt đúng rule.
- Lesson chỉ completed khi đạt điều kiện.
- Top 5 trả đúng thứ tự.

### M7.6: Personal notes và private comments dưới video

Mục tiêu:

- Student ghi chú và comment riêng theo lesson/video.

Phạm vi:

- Note text/image nếu model/API đã có.
- Private comment dưới video chỉ hiện cho chính student.
- File note image dùng R2 permission.

Done khi:

- Student tạo/sửa/xóa note của mình.
- Comment của student khác không hiển thị.

---

## M8: Payment, discount và enrollment

### M8.1: Discount code admin và validation

Mục tiêu:

- Admin tạo và kiểm tra mã giảm giá.

Phạm vi:

- CRUD discount code admin.
- Validate active/expired/usage limit nếu model hỗ trợ.
- Server-side price calculation.

Done khi:

- Client không tự quyết định amount cuối.
- Discount invalid trả lỗi rõ.

### M8.2: Create payment order bằng payOS

Mục tiêu:

- Student/parent tạo QR payment.

Phạm vi:

- Student create payment cho mình.
- Parent create payment cho con đã link.
- payOS create order.
- Payment pending lưu DB.
- Idempotency key hoặc pending payment reuse.

Done khi:

- API trả QR/checkout data.
- Không tạo payment trùng không cần thiết.

### M8.3: payOS webhook verify, idempotency và enrollment 12 tháng

Mục tiêu:

- Tự động mở khóa lộ trình sau thanh toán thành công.

Phạm vi:

- Verify webhook checksum/signature.
- Lưu webhook logs.
- Idempotent processing.
- Payment status update.
- Tạo enrollment 12 tháng.
- Không tạo enrollment trùng khi webhook gọi lại.

Done khi:

- Webhook giả lập paid tạo enrollment.
- Webhook gọi lại không tạo trùng.
- Webhook invalid bị reject.

### M8.4: Payment UI/status và thông báo sau thanh toán

Mục tiêu:

- Hoàn thiện trải nghiệm thanh toán tối thiểu.

Phạm vi:

- Payment page QR/status polling.
- Payment success/failure state.
- Trigger notification in-app/email nếu module notification đã có; nếu chưa có, tạo TODO hoặc event placeholder.

Done khi:

- Student/parent biết thanh toán thành công.
- Enrollment mở khóa đúng learning path.

---

## M9: AI generation, explanation và chat

### M9.1: AiModule structured output foundation

Mục tiêu:

- Chuẩn hóa gọi AI cho structured output.

Phạm vi:

- AiModule.
- OpenAI structured output provider.
- Gemini provider placeholder nếu cần.
- Zod/JSON Schema validation.
- AI generation logs.
- Background job lifecycle cho AI.

Done khi:

- AI call đi qua AiProvider abstraction.
- Output invalid không được lưu DB.

### M9.2: Admin generate lesson summary

Mục tiêu:

- Admin dùng AI tạo tóm tắt bài học.

Phạm vi:

- API enqueue generate summary.
- Worker lấy context lesson document chunks.
- Validate output.
- Upsert `lesson_summaries`.
- Admin có thể sửa lại summary sau khi AI tạo.

Done khi:

- Summary tạo được từ tài liệu lesson.
- Không gửi toàn bộ PDF raw vào prompt.

### M9.3: Admin generate quiz/flashcard/test

Mục tiêu:

- Admin dùng AI tạo nội dung học tập.

Phạm vi:

- Generate quiz set/questions.
- Generate flashcard set/cards.
- Generate test set/questions.
- Save source AI và review status.
- Mapping explanation nếu AI output có lời giải.

Done khi:

- Admin tạo được bộ AI và sửa được sau đó.
- AI output được validate trước khi lưu.

### M9.4: Student request-new reserve-first flow

Mục tiêu:

- Student lấy bộ mới từ kho dự phòng, hết mới gọi AI.

Phạm vi:

- Request-new quiz/flashcard/test.
- Nếu có set dự phòng phù hợp: trả 200 EXISTING.
- Nếu hết: enqueue AI job, trả 202 QUEUED.
- Bộ mới lưu DB và trở thành dự phòng cho học sinh khác.

Done khi:

- Không gọi AI nếu còn bộ dự phòng.
- Response 200/202 đúng contract.

### M9.5: AI explanation cache inline

Mục tiêu:

- “Giải thích cho tôi” dùng cache ở cấp item.

Phạm vi:

- Endpoint explanation cho quiz/flashcard/test question.
- Với test question chỉ hiện sau submit.
- Cache hit trả 200.
- Cache missing/stale trả 202 job.
- Hash/stale logic theo target/source context.

Done khi:

- Cùng item không gọi AI lại nếu cache còn hợp lệ.
- Nội dung thay đổi làm stale explanation.

### M9.6: Chat AI trong lesson bằng RAG

Mục tiêu:

- Student chat với AI theo tài liệu buổi học.

Phạm vi:

- Chat session/messages.
- Retrieval theo lesson.
- Gửi một số tin nhắn gần nhất, không gửi toàn bộ lịch sử.
- Không upload ảnh/file trong chat.
- Từ chối câu hỏi ngoài phạm vi lesson.

Done khi:

- Chat lưu lịch sử.
- AI không trả lời ngoài context lesson.

### M9.7: Conversation summary và diagram placeholder

Mục tiêu:

- Chuẩn bị phần tối ưu hội thoại dài và ảnh minh họa an toàn.

Phạm vi:

- Conversation summary job nếu hội thoại dài.
- `diagram_spec_json` placeholder/schema.
- Không render raw SVG trực tiếp từ AI.
- Diagram rendering job có thể để placeholder nếu chưa implement.

Done khi:

- Có summary mechanism hoặc TODO rõ.
- Không có raw SVG AI render trực tiếp.

---

## M10: Notification realtime, email và Zalo

### M10.1: Notification in-app API

Mục tiêu:

- Lưu và đọc thông báo trong hệ thống.

Phạm vi:

- Notification create service.
- List notifications của user.
- Mark read / mark all read.
- Pagination.

Done khi:

- Notification lưu DB.
- User chỉ đọc notification của mình.

### M10.2: NotificationBell UI

Mục tiêu:

- User xem thông báo trên giao diện.

Phạm vi:

- Icon/bell UI.
- Dropdown/list.
- Unread count.
- Mark read.

Done khi:

- Student/parent thấy danh sách notification mới nhất.

### M10.3: Socket.IO realtime notification

Mục tiêu:

- User online nhận notification realtime.

Phạm vi:

- NestJS WebSocket Gateway.
- Auth socket.
- Join room theo user id.
- Emit notification event khi có notification mới.

Done khi:

- Online nhận realtime.
- Offline vẫn load được từ DB sau khi mở bell.

### M10.4: Admin manual notification

Mục tiêu:

- Admin gửi thông báo thủ công cho student/parent.

Phạm vi:

- Admin API tạo notification thủ công.
- Chọn recipient cụ thể.
- Admin UI form tối thiểu.
- Audit log.

Done khi:

- Admin gửi riêng cho tài khoản student/parent.
- Recipient thấy trong notification list.

### M10.5: Automatic notification triggers

Mục tiêu:

- Tạo notification tự động cho flow quan trọng.

Phạm vi:

- Test opened.
- Lesson completed.
- Test result.
- Lesson reminder khoảng 15 phút nếu scheduling sẵn sàng.
- Late/missed learning có thể placeholder nếu chưa có scheduler.

Done khi:

- Flow chính tạo notification đúng người nhận.
- Placeholder/TODO rõ cho trigger cần scheduler phức tạp.

### M10.6: Email/Zalo delivery workers

Mục tiêu:

- Gửi notification ra kênh ngoài hệ thống.

Phạm vi:

- Resend worker.
- Zalo OA/ZNS worker hoặc placeholder integration rõ.
- Delivery status/logs.
- Retry/error handling.

Done khi:

- Email test dùng Resend sandbox/dev nếu có.
- Zalo nếu chưa có credential thật thì có mock/placeholder rõ.

---

## M11: Parent portal

### M11.1: Parent-child link và selected child

Mục tiêu:

- Parent liên kết và chọn con.

Phạm vi:

- Link child bằng child code.
- Enforce một student chỉ có một parent.
- Parent selected child state/UI.
- Backend guard kiểm tra parent-child ownership.

Done khi:

- Parent link con thành công.
- Parent không xem được student chưa link.

### M11.2: Parent dashboard và progress view

Mục tiêu:

- Parent theo dõi tiến độ con.

Phạm vi:

- Progress by selected child.
- Lesson status.
- Quiz/flashcard/test summary.
- Best test score/time.

Done khi:

- Parent xem đúng dữ liệu của con đang chọn.

### M11.3: Parent course list và payment for child

Mục tiêu:

- Parent xem lộ trình và thanh toán cho con.

Phạm vi:

- Course list ưu tiên theo grade của child.
- Create payment cho child reuse M8 service.
- Enrollment tạo cho child, không phải parent.

Done khi:

- Parent mua lộ trình cho con thành công.

### M11.4: Parent notifications và news view

Mục tiêu:

- Parent nhận thông báo và xem tin tức/sự kiện.

Phạm vi:

- Parent notification list/bell reuse M10.
- Parent news/events view nếu M12 đã có.
- Nếu M12 chưa có, chỉ chuẩn bị route placeholder.

Done khi:

- Parent nhận notification liên quan đến con.

---

## M12: Report, moderation, news/events/livestream

### M12.1: Student report item

Mục tiêu:

- Student report lỗi ở cấp item.

Phạm vi:

- Report quiz question.
- Report flashcard.
- Report test question.
- Reason/message.
- Không report cả set chỉ vì một item lỗi.

Done khi:

- Report lưu đúng target type/id.
- Student không report target không có quyền xem.

### M12.2: Admin report moderation

Mục tiêu:

- Admin xử lý report.

Phạm vi:

- List reports.
- Actions: edit/hide/restore/mark resolved/reject theo API contract.
- Report action log.
- Audit log.

Done khi:

- Admin xử lý được report item.
- Hide/restore ảnh hưởng đúng item.

### M12.3: AI unreviewed content moderation

Mục tiêu:

- Admin xem/sửa/duyệt/ẩn nội dung AI chưa duyệt.

Phạm vi:

- List AI-generated sets/items by review status.
- Approve/hide/edit.
- Không chặn student dùng nội dung AI chưa duyệt nếu scope cho phép.

Done khi:

- Admin kiểm duyệt được content AI.
- Review status cập nhật rõ.

### M12.4: News/events/livestream CRUD admin

Mục tiêu:

- Admin quản lý tin tức/sự kiện/lịch livestream.

Phạm vi:

- CRUD news/event/livestream.
- Publish/archive.
- Rich text content nếu cần.

Done khi:

- Admin tạo bài published.

### M12.5: Student/parent news/events view

Mục tiêu:

- User xem tin tức/sự kiện/livestream.

Phạm vi:

- Public/student/parent view theo contract.
- List/detail.
- Chỉ show published.

Done khi:

- Published news hiển thị đúng role.

---

## M13: Gamification, profile, leaderboard

### M13.1: XP events và level calculation

Mục tiêu:

- Cộng XP khi hoàn thành lesson.

Phạm vi:

- XP event service.
- Idempotency khi lesson completed.
- Level calculation.
- XP dựa trên score/time theo rule tạm nếu chưa chốt chi tiết.

ASSUMPTION:

- Công thức XP cụ thể chưa chốt. Nếu chưa có rule, dùng công thức đơn giản và ghi TODO để owner duyệt.

Done khi:

- Hoàn thành lesson cộng XP một lần.

### M13.2: Global student leaderboard

Mục tiêu:

- Bảng xếp hạng toàn bộ học sinh.

Phạm vi:

- API leaderboard.
- Sort theo level cao nhất, sau đó total XP.
- UI leaderboard tối thiểu.

Done khi:

- Leaderboard trả rank ổn định.

### M13.3: Student profile editable fields

Mục tiêu:

- Student cập nhật đúng field được phép.

Phạm vi:

- Avatar.
- Display username.
- Địa chỉ nhà.
- Không cho đổi ngày sinh, họ tên, giới tính, số điện thoại, email.

Done khi:

- Backend enforce allowed fields.
- UI không hiển thị field bị cấm sửa như editable.

### M13.4: Avatar upload integration

Mục tiêu:

- Avatar dùng chung file/R2 pipeline.

Phạm vi:

- Avatar upload purpose.
- Signed URL/access control.
- Update profile avatar file id.

Done khi:

- Student đổi avatar được.
- File permission đúng user.

---

## M14: Testing, hardening và deploy

### M14.1: Unit tests cho service quan trọng

Mục tiêu:

- Tăng độ tin cậy business logic.

Phạm vi:

- Auth service.
- Payment/enrollment service.
- Attempt scoring/best attempt.
- Permission helpers.
- AI output validation bằng mock.

Done khi:

- Unit tests chạy được local.

### M14.2: API tests cho flow nhạy cảm

Mục tiêu:

- Kiểm tra API/RBAC/permission.

Phạm vi:

- Auth register/login/refresh/logout.
- Admin-only route.
- Student access own data.
- Parent access linked child only.
- Payment webhook idempotency.
- Attempt submit.

Done khi:

- API tests pass.

### M14.3: Playwright E2E cho flow chính

Mục tiêu:

- Test luồng người dùng đầu cuối tối thiểu.

Phạm vi:

- Student login.
- View course/lesson.
- Trial lesson.
- Quiz/test basic flow.
- Admin create simple content nếu có seed hỗ trợ.

Done khi:

- E2E chạy được local hoặc CI dev.

### M14.4: Security hardening và rate limit

Mục tiêu:

- Giảm rủi ro trước production.

Phạm vi:

- Rate limit auth.
- Rate limit AI/payment endpoints.
- Webhook signature verify test.
- File upload type/size hardening.
- Không expose Swagger public production nếu chưa bảo vệ.

Done khi:

- Endpoint nhạy cảm có rate limit/guard.
- Không có secret trong repo.

### M14.5: Logging, monitoring và error tracking

Mục tiêu:

- Có quan sát vận hành cơ bản.

Phạm vi:

- Pino logger.
- Sentry setup nếu có DSN.
- Worker logs.
- Background job failure logs.
- Payment/AI audit log kiểm tra.

Done khi:

- Error quan trọng có log đủ debug.

### M14.6: Docker Compose production, Nginx và health checks

Mục tiêu:

- Chuẩn bị deploy VPS.

Phạm vi:

- Docker Compose production.
- Nginx config mẫu.
- Certbot/Let's Encrypt notes.
- Health checks.
- Services: frontend, api, worker, redis, nginx.
- Không chạy Postgres/R2 trên VPS.

Done khi:

- Có cấu hình deploy mẫu rõ.
- Health check OK trong môi trường dev/staging nếu có.

### M14.7: Backup/restore và vận hành production notes

Mục tiêu:

- Có ghi chú vận hành tối thiểu cho production ban đầu.

Phạm vi:

- Supabase backup/restore notes.
- R2 file storage notes.
- Env/secrets checklist.
- Monthly AI/payment/email/Zalo budget limit notes.
- Worker backlog monitoring notes.

Done khi:

- Có tài liệu vận hành ngắn.
- Không ghi secret thật.

---

## 2. Thứ tự ưu tiên nếu thiếu thời gian

Nếu cần cắt giảm trong nội bộ MVP để ra bản chạy đầu tiên, ưu tiên:

1. `M0.x` Repo setup.
2. `M1.x` Database + Prisma nền tảng.
3. `M2.x` Auth/RBAC.
4. `M3.x` Learning path/lesson.
5. `M4.x` File upload/document processing.
6. `M6.x` Quiz/flashcard/test thủ công.
7. `M7.x` Student learning flow.
8. `M8.x` Payment/enrollment.
9. `M5.x` Embedding/RAG retrieval.
10. `M9.x` AI generation/explanation/chat.
11. `M10.x` Notification.
12. `M11.x` Parent portal.
13. `M12.x` Report/news/moderation.
14. `M13.x` Gamification/profile.
15. `M14.x` Testing/hardening/deploy.

Không được cắt các quyết định kiến trúc đã chốt như Supabase Postgres, Cloudflare R2, NestJS, Next.js, payOS, OpenAI/Gemini abstraction, Redis/BullMQ worker.

---

## 3. Ghi chú cho Codex khi nhận task ngắn

Khi owner yêu cầu một task ngắn như “làm tính năng X”, Codex không được code ngay.

Codex phải:

1. Tự map task đó vào subtask gần nhất trong tài liệu này.
2. Mở `AGENTS.md` để xem `Task routing map`.
3. Đọc các tài liệu liên quan theo `Task routing map`.
4. Xác nhận phạm vi task không vượt subtask đã chọn.
5. Nêu kế hoạch ngắn.
6. Sau đó mới code.

Nếu task có thể thuộc nhiều subtask, Codex phải nêu giả định hoặc hỏi lại trước khi sửa code.

---

## 4. Mẫu prompt owner nên dùng

```txt
Hãy làm Mx.y: <tên subtask> theo docs/09-implementation-plan.md.

Trước khi code:
- Đọc AGENTS.md.
- Đọc docs liên quan theo Task routing map.
- Nêu kế hoạch ngắn.

Phạm vi:
- Chỉ làm Mx.y.
- Không làm sang subtask khác.
- Không thêm tính năng ngoài MVP.
- Không đổi stack.

Sau khi xong:
- Chạy test/build liên quan nếu khả dụng.
- Cập nhật changelog theo AGENTS.md.
- Báo file đã sửa và lệnh đã chạy.
```
