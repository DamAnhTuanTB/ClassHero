# API AI Chat

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 13. AI explanation và chat API

### `POST /student/explanations`

Role: `STUDENT`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid"
}
```

Behavior:

- Kiểm tra quyền xem target.
- Với `TEST_QUESTION`, chỉ cho gọi nếu student đã submit attempt chứa câu đó.
- Nếu cached explanation hợp lệ và hash không stale, trả `200 OK`.
- Nếu cache stale hoặc chưa có, tạo `background_jobs` + `ai_generations`, trả `202 Accepted`.
- Client poll `GET /jobs/:jobId` hoặc nhận realtime event khi job xong.

Cached response:

```json
{
  "data": {
    "mode": "CACHED",
    "explanation": {
      "id": "uuid",
      "contentJson": {},
      "imageFileId": null
    }
  }
}
```

Queued response:

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

### `POST /admin/explanations/regenerate`

Role: `ADMIN`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid"
}
```

Behavior:

- Tạo `AI_GENERATE_EXPLANATION` job.
- MVP overwrite explanation cũ sau khi job thành công.
- Cập nhật hash mới.
- Ghi audit log.

Response: `202 Accepted` với `jobId`.

### Student Chat AI (`M9.6`)

Mọi route dùng role `STUDENT`. Backend kiểm tra enrollment ở mỗi lần đọc/gửi và
trả `AI_CHAT_BLOCKED_DURING_TEST` nếu còn Test attempt `IN_PROGRESS` chưa quá
`startedAt + testSet.durationSeconds + 60 giây grace`. Guard tự chuyển các
attempt đã quá mốc này sang `CANCELLED` trước khi quyết định chặn.

- `GET /student/ai-chat/conversations?cursor=&limit=&scopeType=&learningPathId=`:
  một danh sách chung, sort `last_message_at desc, id desc`, cursor pagination.
- `GET /student/ai-chat/settings`: cấu hình image input hiệu lực, quota câu
  hỏi/ảnh theo ngày và các giá trị `used`/`remaining` của học sinh hiện
  tại; không trả credential.
- `GET /student/ai-chat/conversations/:conversationId`: metadata và scope label.
- `GET /student/ai-chat/conversations/:conversationId/messages?cursor=&limit=`:
  lịch sử message và signed URL attachment sau khi kiểm quyền.
- `PATCH /student/ai-chat/conversations/:conversationId`: đổi title.
- `DELETE /student/ai-chat/conversations/:conversationId`: soft-delete thread.
- `POST /student/ai-chat/conversations/messages/stream`: tạo thread khi gửi tin
  đầu tiên rồi stream answer.
- `POST /student/ai-chat/conversations/:conversationId/messages/stream`: tiếp tục
  thread và giữ scope gốc.

Body gửi tin đầu:

```json
{
  "scopeType": "COURSE",
  "learningPathId": "uuid",
  "surfaceLessonId": "uuid",
  "preferredLessonIds": ["uuid"],
  "videoPlaybackSeconds": 125,
  "activityType": "QUIZ_ATTEMPT",
  "activityId": "uuid",
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid",
  "message": "Gợi ý cho em bước đầu tiên",
  "attachmentFileIds": ["uuid"]
}
```

`preferredLessonIds` là danh sách distinct tối đa 100 buổi đang mở hoặc có CTA
`Vào học`/`Học tiếp` trên màn học sinh. Backend chỉ giữ ID thuộc scope đã resolve
quyền, dùng chúng làm retrieval/prompt boost và không biến chúng thành hard
boundary. `surfaceLessonId` của màn buổi học vẫn được tự động gộp vào danh sách
ưu tiên; timestamp Video và target hiện tại tiếp tục chỉ gắn với
`surfaceLessonId` đơn. Nếu danh sách khóa học còn trả ID lesson catalog trong khi
enrollment đã dùng lộ trình cá nhân, backend ánh xạ ID đó qua `sourceLessonId` sang
lesson thuộc delivery path được cấp quyền; `surfaceLessonId` không được ánh xạ
ngầm để giữ kiểm tra quyền của màn buổi học nghiêm ngặt.
Khi nội dung câu hỏi gọi đích danh một khóa hoặc lesson khác vẫn nằm trong scope,
retrieval ưu tiên chính tên được nêu thay vì tập CTA để bảo toàn ngữ nghĩa toàn
khóa/toàn thư viện.

`videoPlaybackSeconds` chỉ được gửi khi Student mở Chat từ sub-tab `Video`.
Backend cộng offset cắt đầu để đổi sang timestamp video nguồn, ưu tiên khối
`knowledge`/`example` của Video Summary bao phủ mốc đó rồi vẫn hybrid-search toàn
bộ Video Summary. Client không gửi transcript, chapter text hoặc summary block.

Tin tiếp theo không nhận `scopeType`/`learningPathId` để đổi scope. Cặp
`activityType`/`activityId` chỉ được gửi khi Chat được mở trực tiếp từ
runner; Quiz dùng `QUIZ_ATTEMPT` + `QUIZ_QUESTION`, Flashcard dùng
`FLASHCARD_STUDY_SESSION` + `FLASHCARD`. Backend xác minh owner, trạng thái
`IN_PROGRESS`, quan hệ target và trạng thái đã mở đáp án của đúng item trước khi
chọn policy. Màn review gửi riêng `targetType`/`targetId` mà không giả làm active
runner; hỗ trợ `QUIZ_QUESTION | FLASHCARD | TEST_QUESTION`. Target hợp lệ được
đưa trực tiếp vào prompt làm `MỤC_HIỆN_TẠI` và có ưu tiên cao hơn RAG. Transport là
SSE với event `started`, `delta`, `title_updated`, `completed`, `failed`; endpoint
không dùng response envelope sau khi headers stream đã gửi. Client được phép hiện
optimistic title từ câu hỏi ngay lúc gửi; `started.title` là tên mặc định
authoritative lấy từ câu hỏi đầu. Ở lượt đầu, `title_updated` được phát ngay khi
tên AI đã lưu thành công và trước `completed`; client cập nhật đồng thời header
và item lịch sử. `completed.message.text`
là nội dung canonical sau backend auto-repair LaTeX và layout; client phải thay
thế buffer delta bằng message này thay vì chỉ nối thêm.

Ảnh upload riêng qua `POST /files/upload` với `purpose=CHAT_IMAGE`. Số ảnh/tin,
dung lượng và MIME allowlist do `chatSettings` quyết định; backend kiểm cấu
hình này khi upload lẫn khi gắn vào message, sau đó kiểm decoded image,
owner và trạng thái chưa gắn message trước khi đưa data nội bộ cho
provider.

Quota ngày đếm theo kết quả thành công, không theo số thread: mỗi assistant
message `COMPLETED` của Student cộng một câu hỏi, kể cả khi nội dung là lời từ
chối do AI tự quyết định; nếu câu đó gắn `N` ảnh thì cộng `N` ảnh. `FAILED`,
`INTERRUPTED`, trạng thái `REFUSED` legacy không qua model và file staging chưa
gắn vào một lượt thành công đều không tiêu hao hai quota. Biên ngày dùng
`Asia/Ho_Chi_Minh`; UI ẩn nút đính kèm khi `studentDailyImageRemaining=0`,
nhưng backend vẫn là enforcement boundary.

Web upload tối đa 3 file song song và giữ thứ tự `attachmentFileIds`. File
`CHAT_IMAGE` chưa gắn message quá 24 giờ được worker chuyển sang tombstone rồi
xóa object + metadata; file đã có `ai_chat_message_attachments` không thuộc
cleanup này.

Câu có ảnh dùng một call tạo câu trả lời duy nhất: backend tải/chuẩn hóa ảnh rồi
gửi ảnh gốc thẳng vào `CHAT/TEXT`, không gọi OCR hoặc visual hint trước. Hybrid
search vẫn dùng câu hỏi text/target và đúng một query embedding. Song song với
retrieval, backend dựng manifest ngắn gồm tên môn, khóa, bài từ đúng ID đã kiểm
quyền. Luna phải tự đọc ảnh trong call chính, chỉ giải khi ảnh khớp đủ rõ
manifest/target/context, và từ chối nếu không chắc hoặc ngoài scope. Manifest
không chứa khóa chưa mua, không nhập ảnh thành document/chunk/embedding và không
được coi là bằng chứng tự động rằng ảnh thuộc phạm vi.

Với `HINT_ONLY`, backend loại correct answer/mặt sau/saved solution khỏi input và
dùng prompt Socratic, nhưng không dùng keyword/heuristic/classifier/answer-key
comparison để chặn hoặc thay output. Model tự quyết định nội dung/từ chối; output
được stream và lưu nguyên nghĩa sau auto-repair kỹ thuật LaTeX/layout. Vì vậy
provider vi phạm hint policy là lỗi quality/eval cần sửa ở prompt/model routing,
không chuyển thành refusal hoặc fallback do backend.

`HINT_ONLY` chỉ được suy ra khi request mang runner context hợp lệ và
Quiz attempt hoặc Flashcard study session tương ứng còn `IN_PROGRESS`.
Backend không quét activity `IN_PROGRESS` toàn cục để áp policy cho Chat
ở bề mặt khác. Khi không có runner context hợp lệ, kể cả khi có
activity dở dang trong database, lúc học nội dung thông thường, mở thread
cũ từ hub không có runner context hay xem lại Quiz/Flashcard/Test đã nộp, request dùng
`FULL_ANSWER`; model được cung cấp đáp án/lời giải đã duyệt và
phải nêu đáp án đúng kèm giải thích chi tiết khi học sinh yêu cầu.
Nếu Chat AI được mở từ runner, client phải tiếp tục gửi
`activityType/activityId/targetType/targetId` kể cả khi học sinh chọn một
conversation cũ trong history chung.

Trong một runner còn `IN_PROGRESS`, câu Quiz đã `isChecked=true` (gồm cả
`Kiểm tra` và `Bỏ qua`) hoặc Flashcard item đã có `isKnown=true|false` được
`FULL_ANSWER` cho riêng `targetId` hiện tại. Provider input chỉ chứa đáp án/lời
giải của target đã mở. Nếu học sinh dùng target đó để hỏi một câu/thẻ khác chưa
mở trong cùng set, prompt bắt buộc model chuyển phần câu hỏi khác về hint-only;
backend không heuristic/classifier nội dung và không hậu kiểm thay câu trả lời.
Trong phần hint-only, model không được xác nhận/phủ nhận, chấm
đúng-sai hay lặp lại đáp án học sinh tự đoán; phản hồi phải có ít
nhất một gợi ý cụ thể thay vì chỉ từ chối.

Follow-up nhắc rõ ảnh/hình ở lượt trước mà không upload ảnh mới được phép tái dùng
ảnh của user message gần nhất trong chính thread, sau khi kiểm lại toàn bộ quyền
và giới hạn ảnh. Không có endpoint cho client gửi ID attachment cũ để vượt owner
check.

Ở thread mới, backend lưu ngay title mặc định từ câu hỏi đầu rồi chạy call
`CHAT_TITLE_GENERATION` bằng cùng route `CHAT/TEXT` sau provider event trả lời đầu
tiên. Call title chạy song song, có lifecycle/usage riêng và không làm chậm delta
đầu. Nếu thất bại, response chính vẫn hoàn tất và giữ title mặc định; update title
chỉ thành công khi chưa có rename đồng thời. Title AI được normalize
NFC, loại ký tự ngoài Latin/tiếng Việt/chữ số, thu gọn khoảng trắng và
cắt tối đa 8 từ trước khi lưu. Đây là auto-repair kỹ thuật của title,
không phải content gate cho câu trả lời.

---

### Admin Chat AI simulation (`M9.34`, Done 2026-09-13)

Mọi route dùng role `ADMIN`. Đây là HTTP adapter của cùng Chat runtime `M9.6`,
không phải một generation pipeline mới.

- `GET /admin/ai-chat/sessions?cursor=&limit=&query=`: danh sách phiên của đúng
  admin, cursor theo `last_message_at desc, id desc`.
- `GET /admin/ai-chat/lessons/:lessonId/context-options`: trả các tab và bộ
  Quiz/Flashcard/Test đúng tập nội dung đã duyệt, đã publish mà Student được xem;
  response chỉ có đề/mặt trước, không lộ đáp án.
- `POST /admin/ai-chat/sessions/messages/stream`: tạo phiên với scope `LESSON |
COURSE | COURSE_SET`, optional session override và stream lượt đầu.
- `GET /admin/ai-chat/sessions/:sessionId`: metadata, scope label, default version,
  session override, effective configuration cho lượt kế tiếp và `totalCostVnd`
  authoritative của toàn phiên. Tổng này cộng usage thực tế của mọi generation
  trả lời (kể cả embedding/attempt trả phí liên quan) và generation đặt tên phiên.
  Response có `lastSurfaceLessonId` lấy từ lượt gần nhất để UI khôi phục ngữ cảnh
  buổi học theo lượt; field này không đổi hoặc làm hẹp scope đã khóa của phiên.
- `PATCH /admin/ai-chat/sessions/:sessionId/configuration`: cập nhật override bằng
  optimistic `expectedVersion`; chỉ ảnh hưởng lượt gửi sau khi update thành công.
- `GET /admin/ai-chat/sessions/:sessionId/messages?cursor=&limit=`: lịch sử phiên;
  mỗi assistant message có `turnMetrics` gồm `totalCostVnd`,
  `timeToFirstTokenMs` và `responseLatencyMs` riêng của đúng lượt đó. Chi phí lượt
  cộng mọi provider usage gắn với response generation; latency không cộng dồn các
  lượt trước.
- `POST /admin/ai-chat/sessions/:sessionId/messages/stream`: gửi câu hỏi và stream
  cùng bộ SSE event `started/delta/title_updated/completed/failed` của Student
  Chat; event `completed.message` của Admin trả cùng `turnMetrics` như API lịch sử
  để UI hiện số liệu ngay khi stream kết thúc.
- `GET /admin/ai-chat/sessions/:sessionId/messages/:assistantMessageId/trace`:
  request/usage inspector của đúng assistant turn.
- `DELETE /admin/ai-chat/sessions/:sessionId`: soft-delete phiên của admin.

Body tạo phiên:

```json
{
  "title": "Kiểm thử chương Hàm số",
  "scope": {
    "type": "COURSE_SET",
    "learningPathIds": ["uuid-1", "uuid-2"]
  },
  "configurationOverride": {
    "primaryCatalogItemId": "uuid",
    "fallbackCatalogItemId": null,
    "reasoningEffort": "medium",
    "temperature": null,
    "maxInputTokens": 12000,
    "maxOutputTokens": 800,
    "fallbackTemperature": 0.2,
    "fallbackReasoningEffort": null,
    "fallbackMaxOutputTokens": 600
  }
}
```

Với scope `LESSON`, hoặc `COURSE` kèm `surfaceLessonId`, mỗi lượt có
thể gửi thêm context mô phỏng không bắt buộc:

```json
{
  "surfaceLessonId": "uuid",
  "simulationSurface": "VIDEO_SUMMARY",
  "videoPlaybackSeconds": 125
}
```

- Không gửi `simulationSurface`: chat bình thường theo scope đã khóa. Với `COURSE`
  kèm `surfaceLessonId`, retrieval vẫn giữ toàn khóa và chỉ ưu tiên buổi hiện tại.
- `VIDEO_SUMMARY`: bắt buộc `videoPlaybackSeconds`, không nhận target/state và
  ưu tiên đúng khối Video Summary hiện tại như Student ở tab Video.
- `KNOWLEDGE`: không nhận target/state/playback timestamp, dùng `FULL_ANSWER` theo
  scope đã khóa và chỉ ưu tiên buổi hiện tại khi scope là `COURSE`.
- `QUIZ | FLASHCARD`: `UNANSWERED -> HINT_ONLY`,
  `ANSWER_REVEALED -> FULL_ANSWER` cho đúng target hiện tại,
  `SUBMITTED -> FULL_ANSWER` cho toàn scope review.
- `TEST`: `IN_PROGRESS -> BLOCKED`, `SUBMITTED -> FULL_ANSWER` cho toàn scope
  review. Nhánh `BLOCKED`
  dừng trước upload validation, transaction, retrieval và mọi provider call.
- Backend kiểm surface/target/lesson khớp nhau. Policy được resolve bằng cùng hàm
  mà Student Quiz/Flashcard/Test dùng; Admin không được tự truyền
  `responsePolicy` hay quyền xem đáp án.

Với `LESSON`, scope nhận đúng `lessonId`; với `COURSE`, nhận đúng một
`learningPathId`; với `COURSE_SET`, nhận mảng distinct có ít nhất hai ID. Backend
load resource authoritative, kiểm resource tồn tại/khả dụng và tự resolve lesson,
document/chunk. Scope không được sửa sau lượt đầu; muốn đổi phải tạo phiên mới.
`surfaceLessonId` là context theo từng lượt, phải thuộc `COURSE` đã khóa
và không làm hẹp retrieval xuống một lesson.

Configuration layering:

```txt
CHAT/TEXT default -> session override -> capability validation -> effective request
```

- Default `CHAT/TEXT` và `chatSettings` tách biệt đọc/ghi qua chính `GET/PUT /admin/provider-operations/ai-configurations`;
  màn Admin Chat không có endpoint/default record thứ hai.
- Override chỉ nhận field provider-neutral đã allowlist: primary/fallback catalog
  item; primary và fallback có `temperature` hoặc `reasoningEffort` riêng theo
  capability của chính model đó; primary có giới hạn input/output và fallback
  có giới hạn output riêng. Backend không cho một model nhận đồng thời
  temperature và reasoning effort. Không nhận raw OpenAI request JSON,
  prompt-cache key, credential hoặc provider header.
- Khi primary stream lỗi tạm thời trước delta đầu tiên, runtime có thể chuyển
  sang fallback với đúng parameter riêng của fallback. Sau khi đã phát delta,
  không nối thêm output từ model khác vào cùng một câu trả lời.
- Mỗi turn snapshot default version, override version và effective configuration
  trước paid call. Config đổi trong lúc stream không ảnh hưởng turn đang chạy.

Trace response chỉ dành cho session `ADMIN_SIMULATION` và owner ADMIN tương ứng:

```json
{
  "data": {
    "turnId": "uuid",
    "request": {
      "systemPrompt": "...",
      "userPrompt": "...",
      "history": [],
      "retrievedContext": [],
      "images": [],
      "effectiveConfiguration": {}
    },
    "usage": {
      "provider": "OPENAI",
      "model": "gpt-5.6",
      "providerRequestId": "...",
      "promptTokens": 0,
      "cachedInputTokens": 0,
      "cacheWriteInputTokens": 0,
      "completionTokens": 0,
      "reasoningTokens": 0,
      "totalCostVnd": 0,
      "latencyMs": 0,
      "timeToFirstTokenMs": 0,
      "attempts": []
    }
  }
}
```

`totalCostVnd` aggregate mọi provider attempt cùng `turnId`, gồm retrieval/
vision preprocessing trả phí và main response. Trace giữ exact text/input order
đã gửi nhưng thay binary image bằng metadata + authenticated preview reference;
không trả credential, authorization header, signed URL, raw base64, provider file
ID hoặc object key. Attempt lỗi sau khi provider đã trả usage vẫn được cộng chi
phí và hiển thị status/error code an toàn.

Controller Admin chỉ resolve auth/scope/session ownership rồi gọi shared Chat
runtime entrypoint. Prompt builder, retrieval, history limit, response policy,
provider gateway, budget reservation, streaming, LaTeX repair và persistence
lifecycle phải dùng cùng implementation với controller Student; architecture
test phải fail nếu Admin gọi một provider/prompt service riêng.

---

## 13.1. Smart video contextual AI (`M15`, planned)

- `ASK_THIS_MOMENT` và `I_DONT_UNDERSTAND` tái sử dụng `AiProvider`, retrieval, cache/job và rate limit hiện có.
- Client chỉ gửi `lessonId`, `playbackSeconds`, action và optional question; backend tự resolve chapter/transcript context.
- Retrieval tiếp tục filter theo lesson; transcript window không thay thế document RAG.
- Cache key phải gồm timeline/transcript/chapter version để cấu hình cắt hoặc nội dung đã sửa không trả explanation cũ.
- Chapter summary/flashcard video là background job, có source timestamp và review status.
- Whole-video summary admin ở `M9.7` là pipeline riêng: bắt buộc video + saved
  transcript, nhận toàn bộ normalized transcript packet và optional chapter
  timeline từ backend, dùng request draft/hash rồi chạy background job. Flow này
  không dùng window transcript của contextual Q&A và không ghi vào Lesson Summary.
- Không gửi raw watch-event stream vào model để “đánh giá” học sinh. Recommendation service dùng feature aggregate/rule giải thích được; model chỉ hỗ trợ nội dung học tập.
