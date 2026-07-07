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
diagram_spec_json jsonb?
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

### 11.3. `ai_chat_sessions`

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

### 11.4. `ai_chat_messages`

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
role AiChatMessageRole
content_json jsonb
retrieved_chunk_ids uuid[]?
ai_generation_id uuid? fk ai_generations.id
created_at timestamp
```

### 11.5. `conversation_summaries`

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
