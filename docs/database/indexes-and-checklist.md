# Database Indexes And Checklist

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 19. Raw SQL indexes bắt buộc/khuyến nghị

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE UNIQUE INDEX enrollments_one_active_per_student_path
ON enrollments(student_user_id, learning_path_id)
WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX test_attempts_one_best_per_student_lesson
ON test_attempts(student_user_id, lesson_id)
WHERE is_best_for_lesson = true;
```

Vector index đang dùng cho `document_chunks.embedding`:

```sql
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Migration bù `20260727001000_restore_embedding_hnsw_index` reissue câu lệnh idempotent này cho các môi trường đã ghi nhận migration cũ nhưng thiếu physical index.

---

## 20. Checklist cho Prisma schema

```txt
[ ] Có đầy đủ enum ở mục 2.
[ ] Có `password_reset_tokens`.
[ ] Có `background_jobs` và `ai_generations.background_job_id`.
[ ] `files` có `purpose`.
[ ] `learning_path_chapters` có unique `(learning_path_id, order_index)` và service giữ invariant cross-table với lesson top-level dùng cùng logical order.
[ ] `lessons.chapter_id` nullable; lesson luôn có `learning_path_id` hợp lệ và chapter nếu có phải thuộc cùng learning path.
[ ] `lessons` có unique `(chapter_id, order_index)` cho lesson trong chương và partial unique `(learning_path_id, order_index)` cho lesson active không thuộc chương; move/reorder compact source và shift destination trong transaction.
[ ] `lesson_documents` có `title`, `content_hash`, `processing_job_id`, provider/model/dimension.
[x] `document_chunks` có provider/model/dimension và filter rule.
[ ] `quiz_questions`, `flashcards`, `test_questions` có `review_status` để admin ẩn item report.
[ ] `quiz_questions`, `test_questions` có `grading_config_json`.
[ ] `ai_explanations` có hash/stale fields.
[ ] `payments` có `idempotency_key`.
[ ] `xp_events` có idempotency.
[x] Raw SQL partial unique/vector indexes được tạo trong migration.
```
