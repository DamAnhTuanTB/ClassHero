# M9.6 — Kế hoạch triển khai Chat AI đa ngữ cảnh cho học sinh

Ngày lập kế hoạch: 2026-09-12
Task sở hữu: `M9.6`
Mode hiện tại trong roadmap: `UI + API`
Mode cần dùng cho contract mới: `Database + API + AI/RAG + Storage + UI`

Trạng thái triển khai: **Hoàn tất implementation và verification ngày 2026-09-13**.
Báo cáo live test: `./m9-6-live-test-report.md`.

## 1. Kết quả đích

Học sinh bấm icon Chat AI ở header để mở một chat hub dùng chung. Chat hub hiển
thị toàn bộ các cuộc hội thoại cũ trong một danh sách, không tách danh sách theo
scope. Học sinh có thể tạo cuộc trò chuyện mới, mở lại cuộc trò chuyện cũ và tiếp
tục chat.

Mỗi cuộc trò chuyện giữ một trong hai scope bất biến:

- `LIBRARY`: context được phép là toàn bộ lesson thuộc mọi khóa học học sinh đang
  có enrollment hợp lệ.
- `COURSE`: context được phép là toàn bộ lesson thuộc đúng khóa học đang mở.

Khi chat được mở từ một lesson, scope vẫn là `COURSE`; lesson hiện tại chỉ là tín
hiệu ưu tiên retrieval và được lưu trên message dưới dạng `surfaceLessonId`.

AI trả lời theo kiểu streaming từng phần như ChatGPT, lưu lịch sử đầy đủ, hỗ trợ
text/LaTeX và tối đa 5 ảnh mỗi tin nhắn, mỗi ảnh tối đa 10 MB.

## 2. Quyết định sản phẩm bắt buộc

### 2.1. Một danh sách lịch sử, hai scope hội thoại

- Icon Chat AI ở mọi màn đi tới cùng một route chat hub.
- Danh sách lịch sử query theo student, phân trang cursor và sắp
  `last_message_at desc, id desc`.
- Mỗi item hiển thị title, preview tin cuối, thời gian, trạng thái và badge scope.
- Có filter tùy chọn `Tất cả | Toàn thư viện | Theo khóa học`, nhưng đây chỉ là
  filter trên một nguồn danh sách.
- Từ màn Học tập, nút tạo mới mặc định `LIBRARY`.
- Từ course detail hoặc lesson detail, nút tạo mới mặc định `COURSE` với đúng
  delivery learning path hiện tại.
- Mở hội thoại cũ luôn giữ scope gốc; không đổi scope theo màn nguồn.
- Nếu Chat AI được mở từ Quiz/Flashcard runner, việc chọn một hội thoại
  cũ không được xóa activity/target hiện tại khỏi các tin nhắn mới; scope
  gốc của thread vẫn bất biến và backend tiếp tục enforce quyền target.
- Session chỉ được tạo khi gửi tin đầu tiên. Nếu học sinh chọn ảnh trước, file ở
  trạng thái tạm và được gắn transactionally khi tin đầu tiên được gửi.
- Ngay khi bấm gửi câu đầu tiên, client dùng chính câu hỏi đã rút gọn làm
  optimistic title; `started.title` xác nhận giá trị backend và conversation ID.
  Sau provider event đầu tiên của câu trả lời, backend gọi AI
  đặt title ngắn song song; SSE `title_updated` thay title mặc định ngay trong
  lượt stream đầu. Lỗi đặt title không làm hỏng câu trả lời và giữ title mặc định.

### 2.2. Biên quyền truy cập

- `LIBRARY` chỉ resolve từ enrollment `ACTIVE`, `starts_at <= now < expires_at`.
- Enrollment có `delivery_learning_path_id` dùng delivery path; không retrieval
  từ catalog path gốc thay cho bản cá nhân.
- `COURSE` phải thuộc đúng một enrollment hợp lệ của student.
- Client không được gửi danh sách course/lesson được phép. Backend tự resolve ở
  mỗi request và áp điều kiện quyền ngay trong retrieval query.
- Không retrieval rồi mới lọc ở application layer.
- Course public hoặc lesson trial chưa mua không có Chat AI.
- Mỗi lần tải lịch sử, tải message, lấy signed URL hoặc gửi message đều kiểm lại
  quyền hiện hành.
- Message assistant lưu source learning-path/lesson/chunk IDs để audit và để ẩn
  nội dung nếu quyền nguồn không còn hợp lệ.

### 2.3. Chế độ trả lời theo trạng thái học tập

Backend tự suy ra policy cho từng message:

| Trạng thái authoritative                              | Policy                                |
| ----------------------------------------------------- | ------------------------------------- |
| Không có activity đang chạy                           | `FULL_ANSWER`                         |
| Quiz attempt `IN_PROGRESS`, câu chưa kiểm tra/bỏ qua  | `HINT_ONLY`                           |
| Quiz attempt `IN_PROGRESS`, đúng câu đã mở đáp án     | `FULL_ANSWER` chỉ cho target hiện tại |
| Flashcard session `IN_PROGRESS`, thẻ chưa đánh dấu    | `HINT_ONLY`                           |
| Flashcard session `IN_PROGRESS`, đúng thẻ đã đánh dấu | `FULL_ANSWER` chỉ cho target hiện tại |
| Quiz/Flashcard/Test đã submit hoặc đang review        | `FULL_ANSWER`                         |
| Test attempt `IN_PROGRESS`                            | `BLOCKED`                             |

Guard áp dụng cho mọi chat endpoint và mọi tab/browser, không chỉ visibility của
icon. Khi có Test attempt còn trong deadline, backend chặn mở chat, đọc lịch sử
chi tiết, upload/gắn ảnh và gửi message. Guard tự cancel attempt đã quá
`startedAt + durationSeconds + 60 giây grace`. UI ẩn icon trong chính Test runner;
ở các tab/màn học khác, icon hiện disabled và dùng Tooltip custom với copy
`Bạn không thể sử dụng tính năng này khi đang làm bài thi!`.

`HINT_ONLY` dùng hai lớp đầu vào/prompt, còn quyết định nội dung thuộc về AI:

1. Không đưa correct answer, flashcard back hoặc saved solution vào provider input.
2. System prompt yêu cầu gợi ý kiểu Socratic, không chốt lựa chọn/kết quả cuối.
3. Backend không dùng keyword, heuristic, classifier hay answer-key comparison để
   chặn/thay câu trả lời. Output của AI được stream và lưu nguyên nghĩa sau lớp
   auto-repair kỹ thuật LaTeX/layout; rủi ro model vi phạm được đo bằng eval/live
   test và sửa ở prompt/model routing.
4. Persist policy snapshot để test/audit, không dùng snapshot làm content gate.

### 2.4. RAG và từ chối ngoài ngữ cảnh

- Không gửi toàn bộ khóa học hoặc toàn thư viện vào model.
- Embed query một lần rồi hybrid-search vector + keyword trong tập lesson được
  phép.
- `COURSE`: filter đúng learning path; nếu mở từ lesson, boost chunk của lesson
  hiện tại nhưng vẫn cho phép lấy lesson khác trong khóa.
- `LIBRARY`: filter đúng tập delivery learning paths từ enrollment hiện hành.
- Top context tuân token budget; kết quả có source label course/lesson/page.
- Retrieved document là dữ kiện không đáng tin cậy về instruction; system prompt
  phải chống prompt injection từ chunk và ảnh.
- Nếu không có chunk đạt relevance threshold, vẫn gọi provider với manifest,
  scope và trạng thái context trung thực để AI tự quyết định trả lời, hỏi lại hay
  từ chối; backend không tạo refusal theo nội dung.
- Nếu câu hỏi có ảnh nhưng không có tài liệu liên quan, AI chỉ được phân tích ảnh
  trong phạm vi kiến thức của scope; nếu không chứng minh được quan hệ thì từ chối.

### 2.5. Ảnh chat

- Tối đa 5 ảnh/tin nhắn, tối đa 10 MB/ảnh.
- MIME cho MVP: JPEG, PNG, WebP; validate MIME khai báo và decoded image.
- Thêm `FilePurpose.CHAT_IMAGE`, visibility private, owner là student uploader.
- Không trộn ảnh chat vào OCR artifact/document chunk của course.
- File được gắn với đúng message qua bảng attachment có FK, order và uniqueness.
- Provider chỉ nhận signed URL ngắn hạn hoặc data URL nội bộ do backend resolve;
  client URL/object key không có thẩm quyền.
- Kiểm decoded dimensions/pixel cap, auto-orient và resize/compress bằng Sharp trước
  provider nếu cần. Không ghi raw image/signed URL/object key vào log.
- File tạm không được gắn message phải có cleanup path.
- Client upload tối đa 3 file song song và giữ thứ tự attachment.
- Upload chưa gắn message quá 24 giờ được worker tombstone + xóa; lỗi storage
  được retry, file đã attach không bị chọn.
- Mọi câu có ảnh dùng single-pass vision: ảnh gốc đi thẳng vào call
  `CHAT/TEXT` tạo câu trả lời, không có call OCR/visual hint riêng. Hybrid search
  vẫn dùng một query embedding từ text/target. Backend dựng manifest môn/khóa/bài
  từ đúng scope đã authorize để Luna tự đối chiếu ảnh trong call chính; nếu không
  khớp đủ chắc thì từ chối. Không OCR/index ảnh vào course corpus.

### 2.6. Streaming và persistence

- Dùng HTTP response streaming/SSE; không mở rộng Socket.IO sang chat.
- Event tối thiểu: `started`, `delta`, `title_updated`, `completed`, `failed`.
- Client hiện optimistic title trước `started`; `started.title` luôn mang title
  mặc định authoritative từ câu hỏi đầu. `title_updated` chỉ có
  ở lượt đầu khi title AI đã lưu thành công và phải được phát trước `completed`
  của lượt đó; call title chạy song song sau provider event trả lời đầu tiên.
- Lưu user message và assistant placeholder `GENERATING` trước provider call.
- Chỉ `delta` nội dung đã qua buffer/policy phù hợp; không mô phỏng typing sau khi
  đã nhận toàn bộ response.
- Khi hoàn tất, persist full assistant content, sources, policy, provider metadata
  và usage/cost; event `completed` trả representation authoritative.
- Khi provider/client disconnect lỗi, assistant message chuyển `FAILED` hoặc
  `INTERRUPTED`, reservation được settle/release đúng contract và UI cho retry.
- Không dùng global response envelope cho SSE body; lỗi trước khi stream bắt đầu
  vẫn dùng HTTP error envelope chuẩn, lỗi sau khi bắt đầu stream dùng event `failed`.

## 3. Phạm vi không làm

- Không chat realtime học sinh-học sinh/admin.
- Không dùng web search hoặc kiến thức ngoài tài liệu được phép.
- Không upload PDF/video/audio trong chat.
- Không tạo figure/TikZ trong chat.
- Không sửa hoặc xóa nội dung khóa học từ chat.
- Không tạo thread chia sẻ giữa nhiều user.
- Không dùng Socket.IO làm transport token streaming.
- Không gọi provider thật trong unit/integration test mặc định.

## 4. Dependency và trạng thái repo

- `M5.1-M5.4`: Done; tái sử dụng embedding, vector search và keyword fallback.
- `M9.1`: Done; tái sử dụng `AiProvider`, model routing, usage và budget guard.
- `M7.x`: có attempt/session authoritative cho Quiz, Flashcard và Test.
- `M9.5`: roadmap ghi M9.6 đi sau M9.5 để nhận target item/lời giải. Core chat có
  thể triển khai trước, nhưng M9.6 chỉ đạt đầy đủ integration khi bridge target từ
  explanation/review đã sẵn sàng.
- Prisma đã có `ai_chat_sessions`, `ai_chat_messages`,
  `conversation_summaries`, nhưng schema hiện chỉ cho một session/student/lesson.
- Web đã có icon/link `/student/ai-chat`, nhưng chưa có route chat thực.
- Worktree tại thời điểm lập plan đang có nhiều thay đổi chưa commit, gồm cả
  `app.module.ts`, AI lifecycle, env, shared schema, docs M9 và realtime M9.33.
  Execution phải delta-review trước mỗi patch và không revert/gom các thay đổi đó.

## 5. Thiết kế database và migration

### 5.1. Enum mới

- `AiChatScopeType`: `LIBRARY | COURSE`.
- `AiChatMessageStatus`: `GENERATING | COMPLETED | REFUSED | FAILED | INTERRUPTED`.
- `AiChatResponsePolicy`: `HINT_ONLY | FULL_ANSWER | BLOCKED`.
- `FilePurpose`: thêm `CHAT_IMAGE`.

### 5.2. `ai_chat_sessions`

Thay `lesson_id` bắt buộc bằng:

- `scope_type`.
- `learning_path_id` nullable, bắt buộc với `COURSE`, null với `LIBRARY`.
- `title`, `summary_text`.
- `last_message_at` nullable.
- `deleted_at` nullable.

Không còn unique `(student_user_id, lesson_id)` vì một scope có nhiều cuộc trò
chuyện. Thêm index:

- `(student_user_id, deleted_at, last_message_at desc, id desc)`.
- `(student_user_id, scope_type, learning_path_id, deleted_at)`.

Migration thêm DB check đảm bảo:

- `LIBRARY -> learning_path_id is null`.
- `COURSE -> learning_path_id is not null`.

Dữ liệu session lesson cũ, nếu có, migrate sang `COURSE` bằng
`lessons.learning_path_id`; giữ title/history và xóa unique cũ.

### 5.3. `ai_chat_messages`

Bổ sung:

- `status`.
- `response_policy`.
- `surface_lesson_id` nullable.
- `target_type`/`target_id` nullable.
- `context_json` cho server-resolved policy/auth snapshot không chứa secret.
- `source_learning_path_ids` và `source_lesson_ids` hoặc nguồn chuẩn hóa tương
  đương; giữ `retrieved_chunk_ids`.
- `error_code` nullable.
- `updated_at`.

Index `(session_id, created_at, id)` phục vụ cursor message history.

### 5.4. `ai_chat_message_attachments`

- `id`, `message_id`, `file_id`, `sort_order`, `created_at`.
- Unique `(message_id, file_id)` và unique `file_id` nếu một upload chỉ được dùng
  cho một message.
- File relation giúp signed URL permission và cleanup không dựa vào JSON.

## 6. API contract dự kiến

Base: `/api/v1/student/ai-chat` với `JwtAuthGuard + RolesGuard(STUDENT)`.

### Lịch sử

- `GET /conversations?cursor=&limit=&scopeType=&learningPathId=`
  - Một danh sách chung, cursor pagination, mặc định 20, cap 50.
- `GET /conversations/:conversationId`
  - Metadata + quyền tiếp tục + scope label.
- `GET /conversations/:conversationId/messages?cursor=&limit=`
  - Cursor pagination, không trả raw prompt/usage nội bộ.
- `PATCH /conversations/:conversationId`
  - Đổi title có validation.
- `DELETE /conversations/:conversationId`
  - Soft-delete tức thì; cleanup content/file theo policy.

### Upload

- Tái sử dụng `POST /files/upload` với `purpose=CHAT_IMAGE` trong MVP.
- Mỗi file upload riêng, tối đa 10 MB; UI có progress/error từng file.
- `GET /files/:fileId/signed-url` chỉ trả cho uploader và message/session hợp lệ.
- Nếu runtime memory cho 5 upload đồng thời không đạt, chuyển CHAT_IMAGE sang
  presigned direct upload mà không đổi message contract.

### Tạo/gửi và streaming

- `POST /conversations/messages/stream`
  - Tạo conversation + message đầu tiên.
  - Body: `scopeType`, optional `learningPathId`, `surfaceLessonId`, optional
    `target`, `message`, `attachmentFileIds`.
- `POST /conversations/:conversationId/messages/stream`
  - Tiếp tục conversation cũ; body không được đổi scope.
- `POST /conversations/:conversationId/messages/:messageId/retry/stream`
  - Retry đúng user message trước đó; idempotency chống double provider call.

SSE event payload dùng shared Zod schema để Web/API cùng parse.

## 7. Backend/module map

Tạo module domain `apps/api/src/modules/ai-chat/`:

- `ai-chat.module.ts`
- `controllers/student-ai-chat.controller.ts`
- `dto/ai-chat-*.dto.ts`
- `services/ai-chat.service.ts`: orchestration/persistence/stream lifecycle.
- `services/ai-chat-access.service.ts`: enrollment scope + ownership.
- `services/ai-chat-policy.service.ts`: resolve test/quiz/flashcard mode.
- `services/ai-chat-retrieval.service.ts`: authorized COURSE/LIBRARY hybrid RAG.
- `services/ai-chat-prompt.service.ts`: prompt/context assembly.
- `services/ai-chat-attachment.service.ts`: validate/resolve image files.
- `services/ai-chat-output-guard.service.ts`: refusal/hint leak guard.
- `selectors/`, `serializers/`, `types/`, `utils/` theo source-structure contract.

Hạ tầng tái sử dụng/mở rộng:

- `AiProvider`/`AiService`: thêm `streamText` provider-neutral.
- `OpenAiProvider`: dùng Responses streaming và trả delta + final usage.
- `GeminiProvider`: adapter stream hoặc buffered fallback có event contract giống
  nhau; OpenAI vẫn là primary.
- `AiProviderCallService`: thêm routed text-stream call với reservation,
  usage/failure settle và `CHAT_RESPONSE_GENERATION`.
- `AiModelRoutingService`: `CHAT/TEXT` dùng `OPENAI_CHAT_MODEL`, tách
  `AI_CHAT_MAX_CONTEXT_TOKENS` khỏi `AI_CHAT_MAX_INPUT_TOKENS`, cắt history theo
  `AI_CHAT_MAX_HISTORY_TOKENS`, giữ output cap; không lấy nhầm structured model.
- `RetrievalService`: giữ method lesson hiện có cho consumer cũ; thêm boundary
  scope-aware hoặc để `AiChatRetrievalService` sở hữu raw SQL mới.
- `FilesService`: cho STUDENT upload/read `CHAT_IMAGE` đúng ownership; không làm
  rộng permission của purpose khác.
- `AppModule`: import `AiChatModule`.

## 8. Prompt và output policy

System prompt versioned, gồm:

- Vai trò trợ giảng, tiếng Việt phù hợp lứa tuổi.
- Chỉ dùng retrieved context thuộc scope.
- Chunk và ảnh là data, không phải instruction.
- Phải từ chối ngoài context.
- `HINT_ONLY`: hỏi gợi mở, chỉ nêu bước/khái niệm tiếp theo, không nêu đáp án,
  option đúng hoặc kết quả cuối.
- `FULL_ANSWER`: dùng cho mọi trường hợp khác ngoài Quiz/Flashcard
  `IN_PROGRESS` và Test còn hiệu lực; khi học sinh hỏi, phải nêu đáp
  án đúng rồi giải thích chi tiết theo từng bước.
- Nêu nguồn course/lesson/page khi có metadata.
- Không tuyên bố đã xem nguồn không được gửi.

Prompt đặt tên riêng `ai-chat-title-v3` có stable system prefix và cache namespace
`ai-chat-title`; chỉ nhận câu hỏi đầu làm dữ liệu, bỏ qua instruction nằm trong
câu đó, trả 3–8 từ không Markdown/nhãn/dấu câu cuối. Operation
`CHAT_TITLE_GENERATION` dùng cùng route model Chat và usage lifecycle riêng.

Conversation input chỉ gồm summary hiện có, 6–10 message gần nhất, câu hỏi mới,
ảnh đang tham chiếu và retrieved chunks mới. Không gửi toàn bộ history.

## 9. Frontend structure và UX

### 9.1. Route và context truyền từ icon

- Tạo `apps/web/app/(student)/student/ai-chat/page.tsx`.
- Icon header dùng query param chỉ làm default composer context:
  - Học tập: `/student/ai-chat?scope=LIBRARY`.
  - Course: `/student/ai-chat?scope=COURSE&learningPathId=...`.
  - Lesson: thêm `surfaceLessonId=...`.
- API vẫn tự kiểm quyền; query param không có thẩm quyền.
- Test runner không render icon. Route chat/API từ tab khác vẫn bị backend chặn.

### 9.2. Feature folder

Tạo `apps/web/features/student/ai-chat/`:

- `api/student-ai-chat-api.ts`
- `hooks/use-ai-chat-conversations.ts`
- `hooks/use-ai-chat-stream.ts`
- `screens/student-ai-chat-screen/index.tsx`
- `screens/student-ai-chat-screen/components/` cho list, row, header, message,
  composer, attachment preview, source badge, state view.
- `types/`, `schemas/`, `utils/` cho SSE parser, validation và formatting.

Shared type/schema SSE và API enum đặt tại `packages/shared` khi cả Web/API dùng.

### 9.3. Màn danh sách và chi tiết

- Mobile: route full-screen, header back + ClassHero + title; composer tránh bị
  bàn phím che, safe-area bottom.
- Desktop: dùng student shell, vùng nội dung tối đa phù hợp; danh sách trái và
  conversation detail phải responsive, không bắt buộc right sidebar trên màn nhỏ.
- Initial screen là một danh sách chung; nút `Tạo cuộc trò chuyện mới` dùng scope
  mặc định từ nơi mở.
- Row có title, last-message preview, relative time, badge scope, attachment/error
  indicator và menu rename/delete.
- Conversation detail render message text/Markdown/KaTeX an toàn, image thumbnail,
  source citations và streaming caret.
- Composer giới hạn text, 5 ảnh, 10 MB/ảnh; preview/remove/upload progress/error.
- Loading skeleton, empty state, list error retry, send disabled, upload pending,
  refusal, stream interrupted và retry đều là state thật.
- Back từ detail về list giữ cursor/scroll cũ.

## 10. Thứ tự triển khai

### Phase 0 — Contract và baseline

1. Ghi regression tests cho schema scope, authorization và policy trước khi sửa.
2. Cập nhật docs nguồn cho scope mới, ảnh, streaming, lịch sử chung và task Mode.
3. Chụp baseline `git diff --check`, Prisma validate và typecheck hiện tại để phân
   biệt lỗi sẵn có với lỗi M9.6.

### Phase 1 — Database/shared contract

1. Thêm enum/model/relation/index/check constraint và migration an toàn.
2. Migrate session lesson cũ sang COURSE.
3. Thêm shared schemas cho scope, message status, SSE events và request constraints.
4. `prisma generate`, `prisma validate`, migration test trên database local.

### Phase 2 — Access, policy và retrieval

1. Implement access resolver từ enrollment/delivery path.
2. Implement active attempt resolver và `HINT_ONLY/FULL_ANSWER/BLOCKED`.
3. Implement COURSE/LIBRARY hybrid retrieval với current-lesson boost.
4. Test không leak giữa student/course, expired enrollment, trial và personal path.
5. Test relevant/irrelevant query và token cap.

### Phase 3 — Persistence/history API và ảnh

1. Implement conversation CRUD/list/messages cursor pagination.
2. Mở `CHAT_IMAGE` upload/read permission, 10 MB và 5 IDs/message.
3. Implement attachment ownership/one-message binding/orphan cleanup.
4. Test IDOR, deleted session, unauthorized file, MIME/size/count và pagination.

### Phase 4 — Provider streaming và Chat service

1. Mở rộng provider-neutral streaming types/interface.
2. Implement OpenAI Responses stream, cleanup và final usage.
3. Mở rộng routed call để reserve/settle budget và ghi usage/cost.
4. Implement prompt assembly, model-owned refusal và message lifecycle.
5. Implement hint output guard và retry idempotency.
6. Test delta order, completed/failed/disconnect, no double call và persistence.

### Phase 5 — Web chat hub

1. Tạo route, API client, cursor queries và SSE reader.
2. Tạo unified history list + new conversation draft.
3. Tạo conversation detail + streaming message renderer.
4. Tạo composer/upload previews và source badges.
5. Nối header icon với default scope ở Học tập/Course/Lesson; ẩn ở test runner.
6. Nối lesson surface/target state để backend validate và ưu tiên context.

### Phase 6 — Docs, hardening và runtime verification

1. Cập nhật API/database/AI/env/UI/performance/roadmap/coverage/dependency docs.
2. Chạy static, unit, PostgreSQL integration, API E2E và web E2E.
3. Restart API/worker khi env/schema/provider interface thay đổi.
4. Chạy browser trực tiếp và kiểm bằng mắt mobile/laptop, light/dark, history,
   streaming, upload, refusal, hint/review/test policy.
5. Sau local gate, báo owner model + số call + upper-bound cost và chỉ chạy live
   OpenAI khi được xác nhận chi phí cụ thể.

## 11. Test matrix bắt buộc

### Authorization/RAG

- Student A không đọc session/message/file của Student B.
- LIBRARY chỉ retrieve course có enrollment active của đúng student.
- Không retrieve khóa chưa mua, expired, future-start hoặc catalog source khi phải
  dùng delivery path.
- COURSE không đổi scope bằng body/query tampered.
- Lesson boost không đưa chunk ngoài course.
- Query ngoài context vẫn gọi provider; AI tự quyết định refusal, backend không
  chặn/thay nội dung theo keyword hoặc độ tương đồng retrieval.

### Learning policy

- Quiz/Flashcard `IN_PROGRESS` => hint-only, provider input không có answer key.
- Review/submitted => full answer.
- Test `IN_PROGRESS` chặn list detail/send/upload/retry từ mọi tab.
- Sau submit test, chat hoạt động lại.
- Test chứng minh backend stream/persist nguyên output model trong hint mode;
  eval live dùng để phát hiện vi phạm prompt thay vì content guard hậu kỳ.

### History/session

- Một unified list chứa LIBRARY và COURSE đúng thứ tự.
- New chat không tạo row trước tin đầu.
- Tin đầu tạo title mặc định ngay; title AI thay thế qua SSE trong khi phản hồi đầu
  đang stream. Lỗi title giữ fallback và không làm fail câu trả lời.
- Mở old chat giữ nguyên scope.
- Cursor ổn định khi có message mới.
- Rename/delete ownership và soft-delete đúng.
- Conversation dài chỉ gửi summary + recent window.

### Image

- 1–5 ảnh hợp lệ pass; ảnh thứ 6 fail.
- 10 MB pass, lớn hơn 10 MB fail.
- MIME giả, decoded image lỗi, pixel bomb, file owner khác fail.
- Attachment không gắn được hai message và signed URL hết quyền đúng.
- Ảnh chat không trở thành lesson document/chunk.

### Streaming

- Delta hiển thị đúng thứ tự, không lặp/mất Unicode/LaTeX.
- Completed message khớp nội dung đã stream và DB.
- AI tự từ chối được lưu như message `COMPLETED`; provider error/timeout/disconnect
  có final state + retry.
- Usage/cost settle một lần, không để reservation treo.
- Double-click/reconnect không tạo hai provider calls.

### UI bằng mắt

- Mobile viewport theo ảnh owner: icon đúng vùng header, touch target >= 44 px.
- Unified history list, empty/loading/error/long title/long preview.
- New chat scope mặc định đúng từ ba nơi mở icon.
- Keyboard mobile không che composer; ảnh có progress/remove/error.
- Streaming mượt, autoscroll chỉ khi user đang ở cuối; không giật khi user đọc trên.
- Quiz/Flashcard hint, review full answer, test không có icon.
- Light/dark, mobile/tablet/laptop không overflow.

## 12. Lệnh verification dự kiến

```bash
pnpm --filter @learning-path/api db:validate
pnpm --filter @learning-path/api db:generate
pnpm --filter @learning-path/api typecheck
pnpm --filter @learning-path/web typecheck
pnpm --filter @learning-path/api test -- test/m9.6-ai-chat*.test.ts
pnpm --filter @learning-path/web e2e -- tests/m9.6-ai-chat.spec.ts
pnpm --filter @learning-path/api lint
pnpm --filter @learning-path/web lint
git diff --check
```

PostgreSQL/MinIO/API runtime tests dùng local services. Browser visual test dùng
Chrome/in-app browser trên origin mà web thật đang gọi. Không dùng cổng thay thế
nếu UI đang trỏ origin khác.

## 13. Paid live-test gate

Trước call OpenAI thật phải báo:

- model route thực tế của `CHAT/TEXT`;
- số message test;
- số ảnh và detail;
- input/output token upper bound;
- ước tính USD/VND từ price catalog hiện hành.

Live sample sau khi owner xác nhận chi phí phải override route chat sang đúng
`gpt-5.6-luna` theo yêu cầu owner; không tự fallback model nếu API key không có
quyền dùng model này. Chính agent hiện tại thực hiện, không tạo sub-agent.

Ma trận câu hỏi live:

1. COURSE: câu định nghĩa/khái niệm đúng context.
2. COURSE: câu bài tập cần giải thích theo từng bước.
3. COURSE: câu liên hệ hai lesson khác nhau trong cùng khóa.
4. LIBRARY: câu thuộc khóa thứ nhất và câu thuộc khóa thứ hai trong nhiều
   enrollment; nguồn phải chọn đúng khóa đã mua.
5. Câu cố tình hỏi kiến thức ngoài mọi khóa đã mua; phải refusal và không bịa.
6. Câu nhắc một khóa chưa mua; không được retrieval hoặc trả nội dung khóa đó.
7. Quiz `HINT_ONLY`: hỏi thẳng đáp án, hỏi biến tướng và hỏi bước tiếp theo; cả
   ba không được lộ option/kết quả cuối nhưng vẫn phải hữu ích.
8. Flashcard `HINT_ONLY`: không lộ mặt sau/solution.
9. Review `FULL_ANSWER`: yêu cầu nêu đáp án, giải lại và giải theo cách dễ hiểu.
10. Test `IN_PROGRESS`: icon không hiện và API từ tab chat cũ bị chặn.
11. Một câu kèm ảnh rõ; một ảnh không liên quan; một message nhiều ảnh.
12. Follow-up dựa trên lịch sử gần; mở lại thread cũ và tiếp tục; kiểm scope cũ
    không đổi theo entry point mới.

Chấm từng câu theo: đúng dữ kiện nguồn, đúng scope, không hallucination, đúng
policy đáp án, dễ hiểu theo lứa tuổi, tính hữu ích, citation/source phù hợp và
độ mượt/độ trễ streaming. Thêm quality gate trình bày: đoạn ngắn, mỗi bước/ý ở
dòng riêng, câu nhiều phần đủ thứ tự, không có prose wall quá 3 câu, LaTeX mới
dùng `$...$`/`$$...$$` và không còn lỗi sau backend repair. Ghi TTFT, tổng thời
gian, số call, token/usage, cache hit, chi phí và lỗi model nếu có.

Regression batch cuối sau các lỗi live đầu dùng đúng 24 call `gpt-5.6-luna` + 24
query embedding: 6 Vật lý, 6 Hóa học, 6 Ngữ văn, 2 LIBRARY đa môn và 4 HINT_ONLY;
8 message có ảnh với tổng 13 ảnh, gồm follow-up dùng lại ảnh cũ, ảnh mờ, hai ảnh,
năm ảnh và prompt injection. Fixture course/enrollment đa môn chỉ tồn tại ở local
test database, phải cleanup sau khi xuất bằng chứng.

Đợt mở rộng sau batch này được phép vượt 30 lượt để kiểm tra regression nhiều ảnh,
ảnh lịch sử, Flashcard không có gợi ý duyệt, prompt-injection, review full-answer
và prompt-cache bằng request lặp. Sau quyết định single-pass, regression ảnh phải
chứng minh mỗi lượt chỉ có một query embedding và một call Luna tạo câu trả lời,
ảnh được đối chiếu với manifest scope đã authorize, đồng thời AI tự từ chối ảnh
ngoài/không rõ scope. Nếu provider làm lộ đáp án ở `HINT_ONLY`, ghi nhận là lỗi
chất lượng và sửa prompt/model routing rồi chạy lại regression; backend không
thay output bằng fallback cục bộ hoặc tự từ chối.

Không force OCR; dùng document chunks/artifacts local/cache đã có.

### 13.1. Bổ sung Video Summary context (2026-09-14)

- Raw transcript chỉ dùng làm nguồn sinh Video Summary, không được nhập vào corpus
  hoặc truy xuất trực tiếp cho Chat AI.
- Khi Video Summary được persist thành công, tách riêng các khối
  `knowledge`/`example`, giữ timestamp video nguồn, tạo embedding và coi đây là
  nguồn RAG cấp lesson ngang hàng tài liệu đính kèm. Student chỉ dùng bản đã
  duyệt, không stale và chưa xóa.
- Khi Student mở Chat từ sub-tab `Video`, FE đóng băng playback timestamp trong
  URL; backend đổi sang timeline nguồn theo offset cắt và ưu tiên khối bao phủ mốc
  đó cao nhất. Keyword + vector search vẫn chạy trên toàn bộ Video Summary để hỏi
  mốc khác vẫn có kết quả.
- Admin simulation `VIDEO_SUMMARY` bắt buộc nhập playback timestamp và gọi cùng
  runtime/retrieval với Student; không có nhánh prompt hoặc search riêng.
- Regression gồm unit contract, embedding worker, Student/Admin request payload,
  SSE thật và kiểm tra trực tiếp UI/trace bằng trình duyệt.

## 14. Definition of Done

- Một chat hub/lịch sử chung hoạt động với nhiều conversations.
- Scope `LIBRARY/COURSE` đúng và không leak khóa chưa mua.
- Lesson surface ưu tiên lesson hiện tại nhưng cho phép toàn course.
- Quiz/Flashcard hint-only, review full-answer, active Test blocked ở backend.
- Streaming thật, message/usage/error persisted nhất quán.
- Upload tối đa 5 ảnh × 10 MB với ownership và private access.
- UI production-like, responsive, light/dark và đã kiểm trực tiếp bằng mắt.
- Schema/API/AI/UI/env/performance/roadmap docs phản ánh contract mới.
- Focused test, package typecheck/lint và runtime/E2E pass; skipped gate được báo.
- Provider thật chỉ được gọi sau cost gate và final ghi số call/usage/cost.

## 15. Assumption cần owner duyệt cùng plan

- “Đã mua” được hiểu là enrollment đang active và còn thời hạn, không phải từng có
  payment thành công trong quá khứ.
- Trial lesson chưa mua không có Chat AI.
- Khi bất kỳ Test attempt nào của student đang `IN_PROGRESS` và chưa quá deadline,
  toàn bộ chat hub bị khóa để không đi đường vòng qua LIBRARY hoặc course khác.
  Attempt quá deadline được auto-cancel; bắt đầu attempt mới hủy attempt cũ và
  thoát/reload runner gửi cancel keepalive.
- Lịch sử text giữ tới khi student xóa/account bị xóa; ảnh gốc được chuẩn hóa và
  attachment retained cùng conversation theo policy cleanup.
- Một conversation không đổi scope sau khi tạo.
- M9.6 dùng existing task code; không tạo task code mới, nhưng triển khai theo các
  phase độc lập ở mục 10.
