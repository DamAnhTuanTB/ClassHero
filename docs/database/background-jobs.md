# Database Background Jobs

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 10. Background jobs

### 10.1. `background_jobs`

Dùng để lưu trạng thái durable cho BullMQ jobs và phục vụ `GET /jobs/:jobId`.

```txt
id uuid pk
queue BackgroundJobQueue
status BackgroundJobStatus default QUEUED
bullmq_job_id string?
owner_user_id uuid? fk users.id
lesson_id uuid? fk lessons.id
resource_type string?
resource_id uuid?
input_meta_json jsonb?
result_json jsonb?
error_message text?
attempts int default 0
max_attempts int default 3
available_at timestamp?
started_at timestamp?
finished_at timestamp?
created_at timestamp
updated_at timestamp
```

Index:

- `bullmq_job_id`.
- `(owner_user_id, created_at)`.
- `(queue, status)`.
- `(resource_type, resource_id)`.

Rules:

- API trả `background_jobs.id` làm `jobId`.
- BullMQ job id có thể lưu ở `bullmq_job_id`.
- Không lưu secret hoặc raw prompt quá dài trong `input_meta_json`.
- `GET /jobs/:jobId` phải kiểm tra owner/role.
- `M4.2` tạo job rows cho `DOCUMENT_PROCESSING` khi tạo source document, cập nhật page range, thay thế tài liệu chính hoặc upload supplemental document; `M4.3` chịu trách nhiệm enqueue BullMQ thật và cập nhật `bullmq_job_id`.

---
