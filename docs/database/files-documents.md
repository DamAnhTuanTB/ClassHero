# Database Files And Documents

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 4. File và tài liệu

### 4.1. `files`

Metadata file lưu cho object storage. Không lưu file binary trong database.

Local/dev dùng `MINIO_LOCAL`; staging/production dùng `CLOUDFLARE_R2`.

```txt
id uuid pk
provider FileProvider
purpose FilePurpose
bucket string
object_key string unique
original_name string
mime_type string
size_bytes bigint
visibility FileVisibility default PRIVATE
status FileStatus default UPLOADED
uploaded_by_id uuid? fk users.id
public_url string?
checksum string?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- `provider` ghi backend storage thật đã lưu file; không dùng để cấp quyền.
- File permission phải kiểm tra theo `purpose`, `uploaded_by_id` và entity đang tham chiếu file.
- Không được chỉ dựa vào `file_id` để cấp signed URL.
- Client không được upload trực tiếp `AI_DIAGRAM`; chỉ backend/worker tạo sau khi validate `diagram_spec_json`.

### 4.2. `lesson_documents`

Dùng cho PDF/tài liệu nguồn cần extract/chunk/embedding.

```txt
id uuid pk
lesson_id uuid fk lessons.id
file_id uuid fk files.id
title string?
status DocumentStatus default UPLOADED
extracted_text text?
extract_error string?
content_hash string?
chunk_count int default 0
processing_job_id uuid? fk background_jobs.id
processed_at timestamp?
embedding_provider AiProviderName?
embedding_model string?
embedding_dimensions int?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
```

Index:

- `lesson_id`.
- `status`.
- `content_hash`.

Rules:

- `content_hash` dùng để phát hiện tài liệu nguồn thay đổi và invalidate embedding/explanation liên quan.
- Nếu tài liệu thay đổi, worker phải tạo lại chunks/embedding và các explanation liên quan có thể bị stale.
- Chapter không có `chapter_documents` riêng ở MVP; tài liệu/chunk/embedding chỉ gắn với lesson.

### 4.3. `document_chunks`

```txt
id uuid pk
document_id uuid fk lesson_documents.id
lesson_id uuid fk lessons.id
chunk_index int
content text
content_hash string?
token_count int?
embedding Unsupported("vector(1536)")?
embedding_provider AiProviderName?
embedding_model string?
embedding_dimensions int?
metadata_json jsonb?
created_at timestamp
```

Index/constraint:

- unique `(document_id, chunk_index)`.
- index `lesson_id`.
- index `(lesson_id, embedding_provider, embedding_model, embedding_dimensions)`.
- vector index trên `embedding` bằng raw SQL.
- keyword/full-text/trigram index có thể thêm raw SQL nếu cần hybrid search.

Rules:

- Lưu `lesson_id` trực tiếp để retrieval luôn filter theo lesson.
- Retrieval phải filter theo `lesson_id`, `embedding_provider`, `embedding_model`, `embedding_dimensions`.
- Không fallback sang vector space khác nếu provider/model/dimension không khớp.

---
