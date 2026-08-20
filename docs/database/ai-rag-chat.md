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
lesson_id uuid fk lessons.id
title string?
summary_text text?
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(student_user_id, lesson_id)` cho MVP.

ASSUMPTION: MVP dùng một chat session cho mỗi student + lesson để đơn giản.

### 11.8. `ai_chat_messages`

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
role AiChatMessageRole
content_json jsonb
retrieved_chunk_ids uuid[]?
ai_generation_id uuid? fk ai_generations.id
created_at timestamp
```

### 11.8. `conversation_summaries`

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
summary_text text
message_count int
ai_generation_id uuid? fk ai_generations.id
created_at timestamp
updated_at timestamp
```

---
