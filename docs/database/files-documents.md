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

### 4.2. `source_documents`

Tài liệu nguồn dài ở cấp lộ trình/course, ví dụ một file sách giáo khoa hoặc giáo trình gồm nhiều bài học.

```txt
id uuid pk
learning_path_id uuid fk learning_paths.id
file_id uuid fk files.id
title string?
status DocumentStatus default UPLOADED
page_count int?
content_hash string?
processing_job_id uuid? fk background_jobs.id
processed_at timestamp?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index:

- `learning_path_id`.
- `status`.
- `content_hash`.
- `file_id`.
- `processing_job_id`.
- `deleted_at`.

Rules:

- Source document không dùng trực tiếp cho retrieval của học sinh.
- Source document là nguồn paid OCR artifact/page-level content, visual refs và mapping sang lesson.
- File gốc vẫn phải được giữ trong object storage để học sinh xem tài liệu chuẩn và để backend render/crop page image fallback khi visual Q&A cần.
- Nếu source document thay đổi, OCR artifact, page text, lesson mappings, chunks, embedding và explanation liên quan có thể stale.

### 4.3. `source_document_pages`

Text/snapshot/quality theo từng trang của source document.

```txt
id uuid pk
source_document_id uuid fk source_documents.id
page_number int
status DocumentStatus default UPLOADED
text text?
text_source string? -- paid_ocr | text_layer | free_ocr | mixed
quality_score float?
thumbnail_file_id uuid? fk files.id
extract_error string?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
```

Index/constraint:

- unique `(source_document_id, page_number)`.
- index `(source_document_id, status)`.
- index `thumbnail_file_id`.

Rules:

- Worker tạo page records sau khi biết tổng số trang.
- Page text/Markdown/LaTeX được import từ paid OCR artifact khi production bật OCR paid; text layer/free OCR chỉ là metadata/fallback local hoặc vận hành có kiểm soát.
- Page text được dùng để chunk theo lesson sau khi admin gán page range.
- `metadata_json` lưu thông tin provider/model/options, artifact key, layout/line refs, bbox/region refs, confidence/quality flags, `printedPage` và visual asset refs nếu provider trả về. `printedPage` lưu `pdfPageNumber`, `printedPageNumber`, `printedPageLabel`, `source`, `confidence`, `evidenceLineIds`, `evidenceText`, `warning`; nếu thiếu hoặc mơ hồ phải lưu rõ `warning` thay vì tự đoán.
- Visual refs phải trỏ tới `image-manifest.json` khi có paid OCR artifact, kèm image entries theo trang gồm `imageId`, `orderInPage`, object key, raw/normalized bounding box, `printedPage`, nearby text/caption, kind heuristic, `qualityFlags` và `isUsableForAi` nếu đã normalize được.
- `metadata_json.visual`/document metadata có thể lưu `artifactAuditKey`, `artifactAuditStatus` và `artifactAuditSummary` trỏ tới `artifact-audit.json`; audit này là nguồn kiểm tra chất lượng artifact trước khi dùng cho RAG, sinh quiz/flashcard/test hoặc visual Q&A.
- `thumbnail_file_id`/metadata có thể trỏ tới thumbnail hoặc page image cache tạo từ PDF gốc; không cần tự crop mọi hình thành file riêng nếu paid OCR provider không trả crop phù hợp.
- Với visual Q&A, backend ưu tiên dùng crop/region/image provider trả về nếu đã lưu nội bộ. Nếu thiếu crop phù hợp, backend có thể render/crop page image từ PDF gốc on demand và cache bằng file purpose phù hợp, miễn là quyền truy cập vẫn kiểm tra qua source document/lesson.
- OCR lỗi ở một trang không được làm mất trạng thái của các trang khác; lưu lỗi theo trang.

### 4.4. `lesson_document_page_ranges`

Mapping thủ công từ lesson sang khoảng trang của source document.

```txt
id uuid pk
lesson_id uuid fk lessons.id
source_document_id uuid fk source_documents.id
page_start int
page_end int
created_by_id uuid? fk users.id
metadata_json jsonb?
created_at timestamp
updated_at timestamp
```

Index/constraint:

- unique `(lesson_id, source_document_id)`.
- index `lesson_id`.
- index `source_document_id`.
- index `created_by_id`.

Rules:

- `page_start <= page_end`.
- Lesson phải thuộc cùng learning path với source document.
- Cho phép cảnh báo range trùng/bỏ sót ở API/UI; không tự động gán page nếu admin chưa xác nhận.
- Khi mapping đổi, worker phải tạo lại chunks cho lesson liên quan.

### 4.5. `lesson_documents`

Dùng cho PDF/tài liệu nguồn cần paid OCR artifact/chunk/embedding.

```txt
id uuid pk
lesson_id uuid fk lessons.id
file_id uuid fk files.id
source_document_id uuid? fk source_documents.id
kind string default SUPPLEMENT -- PRIMARY_FROM_SOURCE | PRIMARY_REPLACEMENT | SUPPLEMENT
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
replaced_at timestamp?
```

Index:

- `lesson_id`.
- `(lesson_id, kind)`.
- `status`.
- `content_hash`.
- `file_id`.
- `source_document_id`.
- `processing_job_id`.
- `replaced_at`.

Rules:

- `content_hash` dùng để phát hiện tài liệu nguồn thay đổi và invalidate embedding/explanation liên quan.
- Nếu tài liệu thay đổi, worker phải tạo lại chunks/embedding và các explanation liên quan có thể bị stale.
- Chapter không có `chapter_documents` riêng ở MVP; tài liệu/chunk/embedding chỉ gắn với lesson.
- Với source document dài, `lesson_documents` có thể trỏ tới `source_document_id` và dùng `lesson_document_page_ranges` để biết page range nguồn.
- `PRIMARY_FROM_SOURCE` là tài liệu chính của lesson được tạo từ source document + page range.
- `PRIMARY_REPLACEMENT` là tài liệu chính thay thế của lesson, có thể đến từ page range mới hoặc file upload riêng.
- `SUPPLEMENT` là tài liệu bổ sung upload trực tiếp cho lesson, ví dụ phiếu bài tập riêng, đáp án, ảnh công thức hoặc tài liệu tham khảo.
- `SUPPLEMENT` có thể là tài liệu cần xử lý hoặc storage-only. Storage-only dùng cho tài liệu tham khảo thêm trong modal tạo lesson: lưu file/document, `status = READY`, `chunk_count = 0`, không có `processing_job_id`, và `metadata_json.processingMode = "storage_only"`.
- Mỗi lesson chỉ có một tài liệu chính active tại một thời điểm; tài liệu chính cũ được đánh dấu bằng `replaced_at`, thay thế tài liệu chính không được xóa hoặc làm mất supplemental documents.
- Một lesson có thể có một hoặc nhiều supplemental documents; tất cả chunks cuối cùng vẫn phải gắn `lesson_id`.

### 4.6. `document_chunks`

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
