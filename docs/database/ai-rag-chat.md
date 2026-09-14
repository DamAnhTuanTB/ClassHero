# Database AI RAG Chat

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 11. AI, RAG và chat

### 11.1. `ai_generations`

Log mọi AI job/generation quan trọng.

```txt
id uuid pk
type AiGenerationType
status AiGenerationStatus default QUEUED
provider AiProviderName?
model string?
created_by_user_id uuid? fk users.id
lesson_id uuid? fk lessons.id
background_job_id uuid? fk background_jobs.id
target_type string?
target_id uuid?
prompt_version string?
schema_version string?
input_hash string?
output_hash string?
input_meta_json jsonb?
output_json jsonb?
error_message text?
provider_request_id string?
prompt_tokens int?
completion_tokens int?
total_tokens int?
estimated_cost_vnd int?
latency_ms int?
retry_count int default 0
started_at timestamp?
finished_at timestamp?
created_at timestamp
updated_at timestamp
```

Index:

- `(lesson_id, type, status)`.
- `background_job_id`.
- `(target_type, target_id)`.

`M9.7` bổ sung `AiGenerationType.VIDEO_SUMMARY` và target
`LESSON_VIDEO_SUMMARY`. Usage/accounting, background job và target context dùng
type riêng; không ghi nhận lượt này thành `SUMMARY`, vì Summary kiến thức từ PDF
và Video Summary có source/prompt/schema/persistence khác nhau.

### 11.2. `ai_explanations`

Cache lời giải AI ở cấp item.

```txt
id uuid pk
target_type AiExplanationTargetType
target_id uuid
lesson_id uuid fk lessons.id
content_json jsonb
image_file_id uuid? fk files.id
source ContentSource default AI
review_status ReviewStatus default APPROVED
ai_generation_id uuid? fk ai_generations.id
target_content_hash string?
source_context_hash string?
stale_at timestamp?
regenerated_from_id uuid? fk ai_explanations.id
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(target_type, target_id)`.

Rules:

- Service phải tính hash từ nội dung target và tài liệu/context nguồn.
- Nếu `target_content_hash` hoặc `source_context_hash` không khớp, cache bị coi là stale.
- Admin regenerate ở MVP mặc định overwrite explanation cũ, nhưng phải cập nhật hash và audit log.

Explanation hiện text-only. Cột `diagram_spec_json` đã bị loại khỏi schema trên
nhánh TeX/TikZ; pipeline figure giai đoạn đầu chỉ thuộc Lesson Summary.

### 11.3. `stem_figures`

> **Migration cutover đã được viết (2026-08-19), chưa chạy production:** migration một chiều xóa
> `visualIntent` khỏi `plan_json`, Summary
> content, raw AI output và job metadata còn được đọc; job v2 bị cancel và
> provider request snapshot v2 bị invalidated. Sau cutover mọi active plan phải
> có version 3 và code không có reader v1/v2. Chi tiết tại ADR-0018 và kế hoạch
> M9.2 hard cutover.

Lưu danh tính, vị trí và con trỏ lifecycle của từng hình TeX/TikZ trong Summary.

```txt
id uuid pk
lesson_id uuid fk lessons.id
lesson_summary_id uuid? fk lesson_summaries.id
ai_generation_id uuid? fk ai_generations.id
block_path string
figure_index int
local_plan_id string
plan_json jsonb?
subject_key string
subject_name string
subject_slug string
status StemFigureStatus
theme StemFigureTheme default LIGHT
last_error_category/code/message nullable
current_revision_id uuid? unique fk stem_figure_revisions.id
pending_revision_id uuid? unique fk stem_figure_revisions.id
created_by_id uuid? fk users.id
deleted_at timestamp?
created_at/updated_at timestamp
```

Rules:

- `stem_figure_revisions` là nguồn dữ liệu duy nhất cho source, metadata, preview,
  delivery asset và thông tin renderer/validator; `stem_figures` không giữ bản sao
  hay fallback tương thích ngược.
- `source_kind` nằm ở revision và nhận `AI_TEX | ADMIN_UPLOAD`; upload replacement
  không bắt buộc `latex_source`.
- `current_revision_id` chỉ trỏ tới revision có delivery asset hợp lệ. Source sửa
  tay được compile thành `pending_revision_id`; chỉ promote atomically sau khi
  compile + SVG validator thành công.
- Publish Summary bị chặn nếu reference hoạt động chưa có current revision
  `SUCCEEDED` kèm `delivery_file_id`; xóa reference/soft-delete figure gỡ blocker.
- Với figure đã thành công, regenerate/manual edit ghi pending revision; candidate
  lỗi không thay source hoặc delivery asset hiện hành.
- Theme hiện chỉ nhận `LIGHT`.
- Unique `(lesson_summary_id, block_path, figure_index)` cho phép mỗi block sở hữu
  nhiều figure theo đúng thứ tự; `local_plan_id` và `plan_json` giữ identity/brief
  Stage 1 để resolver và UI không làm mất owner-local plan.
- `plan_json` writer chỉ lưu `figurePlanContractVersion=3`.
  `figureOrigin` là provenance bắt buộc đã qua Zod; mỗi
  `sourceReferences[]` giữ provenance và `sourceTarget { scope, locator }` để
  phân biệt toàn hình với hình con. `TEXTBOOK_SOURCE` bắt buộc có reference;
  `GENERATED_FROM_BRIEF` bắt buộc không có reference. Reader strict reject v1/v2,
  source target thiếu và field ngoài schema.
- `lesson_summaries.content_json` giữ provenance rút gọn `figureOrigin` trên mỗi
  `TEX_FIGURE`: backend copy giá trị đã validate từ `plan_json`. Không thêm cột
  database và không sao chép locator/crop manifest vào content JSON.
- Subject fields là snapshot bất biến của `learning_path.domain` tại lần sinh;
  worker/retry dùng snapshot này để chọn prompt, root environment allowlist và
  compiler profile đúng môn. `latex_source` chỉ lưu LaTeX figure snippet gồm
  optional local header trong allowlist rồi đúng một drawing root. Backend sở hữu
  document wrapper/package và phạm vi library; snippet chỉ được chọn library/style
  cục bộ trong versioned toolbox manifest theo ADR-0015.

### 11.4. `stem_figure_revisions`

Lưu lịch sử source/candidate bất biến theo `source_version`, gồm origin, source
kind, source/hash, preview SVG đã sanitize, delivery file, renderer/validator
version, diagnostic gần nhất và trạng thái revision. Không có PDF edit artifact,
SyncTeX map hoặc edit-session state.

Revision còn snapshot `reference_snapshot_json/hash` và
`generation_brief_hash`. Retry/sinh revision mới phải dùng lại đúng plan + ảnh
tham chiếu đã resolve, không được thay bằng generic brief. Chỉ
`TEX_COMPILE_FAILED` có diagnostic batch đầy đủ được auto repair; mọi category
khác không auto retry.

M9.18 không thêm bảng/cột hoặc lưu mask thô. Apply raster edit tạo revision
`ADMIN_UPLOAD` và delivery `File` mới; metadata file giữ
`uploadSource=stem-figure.raster-edit`, `derivedFromRevisionId`, version pipeline,
danh sách operation, mask coverage và tiếp tục giữ `textbookSourceObjectKey` để
provenance/current asset kind vẫn là `TEXTBOOK_SOURCE`. Revision hiện hành chỉ
được đổi sau khi output đã validate; revision trước tiếp tục là lịch sử bất biến.
Mỗi raster edit kế tiếp derive từ current revision vừa promote, không đọc lại crop
OCR ban đầu, nên chuỗi chỉnh sửa vẫn truy vết được qua `derivedFromRevisionId`.

M9.17 snapshot thêm boolean `autoEnhanceTextbookSourceImages` trong
`lesson_summary_request_drafts.source_snapshot_json.generationConfiguration` và
`ai_generations.input_meta_json`. Field mặc định `false`, chỉ hiệu lực cùng
`useTextbookSourceImages=true` và không cần cột/migration riêng. Delivery crop đã
tự làm nét ghi pipeline/operation trong `files.metadata_json`.

### 11.5. `lesson_summary_request_drafts`

Snapshot immutable của exact request sau prompt preview: lesson/user, request và
packet/manifest hash, packet object/filename/size/page count, system/user prompt,
schema name/version/hash/body, source snapshot, model config, cost estimate, TTL
và `consumed_at`. Generate kiểm draft fresh + request hash + source/config hiện
hành rồi mới consume. `request_hash` chỉ index, không unique toàn cục, để admin có
thể tạo lại cùng preview sau một draft đã dùng/hỏng.

### 11.6. `stem_figure_render_attempts`

Audit bất biến theo lần compile/validate/repair/regenerate: revision bắt buộc,
figure/job, attempt number, source version/hash, kind, status, log rút gọn, error
category/code, validator issues, duration và timestamps. Unique
`(stem_figure_id, attempt_number)`.

### 11.7. `ai_chat_sessions`

```txt
id uuid pk
student_user_id uuid fk users.id
admin_user_id uuid? fk users.id
mode AiChatSessionMode default STUDENT
scope_type AiChatScopeType
learning_path_id uuid? fk learning_paths.id
title string?
summary_text text?
configuration_override_json jsonb?
configuration_version int default 1
last_message_at timestamp?
deleted_at timestamp?
created_at timestamp
updated_at timestamp
```

Constraint:

- `LIBRARY` bắt buộc `learning_path_id is null`.
- `COURSE` bắt buộc `learning_path_id is not null`.
- Không unique theo scope: một học sinh có thể tạo nhiều thread.
- Index history theo `(student_user_id, deleted_at, last_message_at desc, id desc)`.
- Từ `M9.34`, `mode=STUDENT` bắt buộc `student_user_id` có giá trị và
  `admin_user_id is null`; `mode=ADMIN_SIMULATION` áp dụng XOR ngược lại. Admin
  simulation dùng scope `LESSON | COURSE | COURSE_SET`, còn Student tiếp tục chỉ
  dùng `LIBRARY | COURSE`.
- `configuration_override_json` chỉ hợp lệ cho `ADMIN_SIMULATION`, validate bằng
  schema versioned và không chứa API key/raw provider JSON. `configuration_version`
  dùng optimistic update; thay đổi không rewrite turn trace cũ.
- Index history Admin theo
  `(admin_user_id, mode, deleted_at, last_message_at desc, id desc)`.
- Lượt đầu lưu title mặc định từ câu hỏi trước khi stream. Call
  `CHAT_TITLE_GENERATION` chỉ cập nhật row khi title vẫn bằng giá trị mặc định,
  tránh ghi đè rename đồng thời; lỗi title không rollback session/message.

### 11.8. `ai_chat_messages`

Ngoài role/content và generation link, message lưu `status`, `response_policy`,
optional `surface_lesson_id`/target, server-resolved `context_json`, source path /
lesson / chunk IDs và `error_code`. Policy là snapshot để audit rule hint-only,
không phải content gate. Lời từ chối do AI sinh được lưu `COMPLETED` như mọi câu
trả lời; `REFUSED` chỉ còn tương thích dữ liệu legacy.

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
role AiChatMessageRole
status AiChatMessageStatus
response_policy AiChatResponsePolicy
content_json jsonb
surface_lesson_id uuid? fk lessons.id
target_type string?
target_id uuid?
context_json jsonb?
source_learning_path_ids uuid[]
source_lesson_ids uuid[]
retrieved_chunk_ids uuid[]
error_code string?
ai_generation_id uuid? fk ai_generations.id
daily_quota_counted_at timestamp?
created_at timestamp
updated_at timestamp
```

### 11.9. `ai_chat_message_attachments`

Liên kết một `FilePurpose.CHAT_IMAGE` private với đúng một message, có `sort_order`
và unique `file_id`. Attachment không phải source document và không được nhập vào
OCR artifact/document chunks.

Upload chưa có attachment là staging file. Worker dọn file `CHAT_IMAGE` chưa
gắn sau 24 giờ, dùng tombstone `FileStatus.DELETED` trước khi xóa object và
retry tombstone nếu storage tạm lỗi. Ảnh chat không lưu OCR/visual hint và không
trở thành course content; legacy metadata từ bản thử nghiệm cũ không còn consumer.

```txt
id uuid pk
message_id uuid fk ai_chat_messages.id
file_id uuid unique fk files.id
sort_order int
daily_quota_counted_at timestamp?
created_at timestamp
```

Hai timestamp quota chỉ được ghi trong cùng transaction chuyển assistant
Student sang `COMPLETED`: assistant ghi một lượt câu hỏi và tất cả attachment
của user message tương ứng ghi số ảnh. Lượt Admin simulation, refusal, failure
hoặc interruption đều để null.

### 11.10. `conversation_summaries`

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
summary_text text
message_count int
ai_generation_id uuid? fk ai_generations.id
created_at timestamp
updated_at timestamp
```

### 11.11. `ai_chat_session_scope_items` (`M9.34`, Done 2026-09-13)

Chỉ dùng cho session `ADMIN_SIMULATION` để biểu diễn scope chọn thủ công mà vẫn
giữ foreign key; Student scope tiếp tục resolve theo enrollment hiện hành.

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
learning_path_id uuid fk learning_paths.id
lesson_id uuid? fk lessons.id
sort_order int
created_at timestamp
```

- Scope `LESSON` có đúng một row và `lesson_id` phải thuộc `learning_path_id` của
  row đó; `COURSE` có đúng một row với `lesson_id is null`; `COURSE_SET` có ít
  nhất hai learning path distinct và mọi `lesson_id is null`.
- Unique `(session_id, learning_path_id, lesson_id)` và `(session_id, sort_order)`;
  service transaction kiểm cardinality/cross-row rule trước khi tạo phiên.
- Scope trở thành immutable ngay khi session có message đầu tiên. Xóa/ẩn resource
  về sau không làm trace cũ đổi, nhưng lượt gửi mới phải fail thân thiện nếu scope
  không còn khả dụng.

### 11.12. `ai_chat_turn_traces` (`M9.34`, Done 2026-09-13)

Trace bất biến của đúng một assistant turn trong phiên Admin simulation.

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
user_message_id uuid unique fk ai_chat_messages.id
assistant_message_id uuid unique fk ai_chat_messages.id
ai_generation_id uuid unique fk ai_generations.id
scope_snapshot_json jsonb
default_configuration_version int
session_configuration_version int
configuration_override_snapshot_json jsonb?
effective_configuration_json jsonb
provider_request_snapshot_json jsonb
created_at timestamp
```

- Shared Chat runtime tạo `ai_generation_id`/turn correlation trước mọi paid
  call. Retrieval embedding và main response của turn đều truyền cùng generation
  ID vào provider gateway để chi phí được aggregate chính xác từ
  `provider_usage_events`.
- Request snapshot giữ đúng thứ tự system/user/history/context đã gửi. Ảnh chỉ lưu
  file ID/hash/detail và metadata cần audit, không lưu base64, signed URL, provider
  file ID hoặc object key. Snapshot không chứa credential/header/secret.
- Chỉ tạo full trace cho `ADMIN_SIMULATION`; Student dùng cùng runtime/correlation
  nhưng không nhân bản raw prompt chỉ để phục vụ màn quản trị này.
- Query inspector load trace theo `assistant_message_id`, kiểm session mode + admin
  ownership và aggregate usage theo `ai_generation_id`; không scan toàn lịch sử.

### 11.13. `ai_chat_runtime_settings`

Singleton `singleton_key=default` giữ phần cấu hình Chat không thuộc route
tạo text, tách hẳn khỏi `ai_feature_model_configs`.

```txt
id uuid pk
singleton_key string unique
embedding_catalog_item_id uuid? fk provider_catalog_items.id
max_images_per_message int
max_image_bytes bigint
allowed_image_mime_types text[]
student_daily_message_limit int
student_daily_image_limit int
version int
updated_by_user_id uuid? fk users.id
created_at timestamp
updated_at timestamp
```

- Embedding catalog item phải là OpenAI `ACTIVE`, có capability `EMBEDDING`
  và dimensions khớp vector space đã index; không được dùng là model
  tạo câu trả lời.
- MIME chỉ nhận tập con không rỗng của JPEG/PNG/WebP. Per-message image
  limit `1..10`, dung lượng `64 KiB..20 MiB`, quota câu hỏi `1..1000`
  và quota ảnh `0..1000`.
- Update dùng optimistic `version` và ghi audit log riêng; Student/Admin cùng
  resolve singleton này cho một turn snapshot.

### 11.14. `video_summary_chunks`

Lưu corpus Chat/RAG được tạo từ bản Video Summary persisted; không lưu hoặc chunk
raw transcript.

```txt
id uuid pk
video_summary_id uuid fk lesson_video_summaries.id on delete cascade
lesson_id uuid fk lessons.id on delete cascade
chunk_index int
content text
content_hash string
summary_hash string
token_count int
start_seconds float?
end_seconds float?
embedding vector(1536)?
embedding_provider AiProviderName?
embedding_model string?
embedding_dimensions int?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
```

- Unique `(video_summary_id, chunk_index)`; index theo summary, lesson/hash và
  vector space; HNSW cosine chỉ áp dụng row có embedding.
- Mỗi row chỉ biểu diễn một khối `knowledge` hoặc `example`, giữ timestamp video
  nguồn. `end_seconds` là mốc bắt đầu lớn hơn kế tiếp để tìm khối bao phủ playback.
- Khi nội dung summary đổi, service thay toàn bộ chunk trong cùng transaction và
  enqueue embedding theo `summary_hash`. Retrieval Student chỉ nhận summary
  `APPROVED`, không stale và chưa xóa.

---
