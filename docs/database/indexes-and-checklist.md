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

Vector index ví dụ, cần điều chỉnh theo Supabase/model thực tế:

```sql
-- Example only. Chỉ tạo sau khi xác định operator class phù hợp.
-- CREATE INDEX document_chunks_embedding_hnsw
-- ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 20. Checklist cho Prisma schema

```txt
[ ] Có đầy đủ enum ở mục 2.
[ ] Có `password_reset_tokens`.
[ ] Có `background_jobs` và `ai_generations.background_job_id`.
[ ] `files` có `purpose`.
[ ] `lesson_documents` có `title`, `content_hash`, `processing_job_id`, provider/model/dimension.
[ ] `document_chunks` có provider/model/dimension và filter rule.
[ ] `quiz_questions`, `flashcards`, `test_questions` có `review_status` để admin ẩn item report.
[ ] `quiz_questions`, `test_questions` có `grading_config_json`.
[ ] `ai_explanations` có hash/stale fields.
[ ] `payments` có `idempotency_key`.
[ ] `xp_events` có idempotency.
[ ] Raw SQL partial unique indexes được tạo trong migration.
```
