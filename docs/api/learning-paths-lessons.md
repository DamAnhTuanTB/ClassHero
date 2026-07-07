# API Learning Paths Lessons Materials

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 4. Public learning path API

### `GET /learning-paths`

Role: public hoặc authenticated.

Query:

```txt
subject=MATH&grade=7&page=1&pageSize=20
```

Behavior:

- Chỉ trả `PUBLISHED`.
- Nếu user là student, ưu tiên lộ trình theo grade.
- Nếu authenticated, kèm enrollment/trial state.

### `GET /learning-paths/:id`

Role: public hoặc authenticated.

Behavior:

- Trả thông tin lộ trình.
- Trả lessons public metadata.
- Trả trạng thái enrollment/trial nếu authenticated.

---

## 5. Admin learning path API

### `GET /admin/learning-paths`

Role: `ADMIN`.

Query: `status`, `subject`, `grade`, `search`, pagination.

### `POST /admin/learning-paths`

Role: `ADMIN`.

Body:

```json
{
  "title": "Toán 7",
  "subject": "MATH",
  "grade": 7,
  "originalPriceVnd": 2000000,
  "salePriceVnd": 1500000,
  "thumbnailFileId": "uuid",
  "descriptionJson": {},
  "trialEnabled": true,
  "status": "DRAFT"
}
```

Side effects:

- Tạo `learning_paths`.
- Ghi `audit_logs`.

### `PATCH /admin/learning-paths/:id`

Role: `ADMIN`.

### `DELETE /admin/learning-paths/:id`

Role: `ADMIN`.

Behavior: soft delete hoặc archive.

### `POST /admin/learning-paths/:id/publish`

Role: `ADMIN`.

Behavior: set status `PUBLISHED`, set `published_at`.

---

## 6. Admin lesson API

### `GET /admin/learning-paths/:learningPathId/lessons`

Role: `ADMIN`.

### `POST /admin/learning-paths/:learningPathId/lessons`

Role: `ADMIN`.

Body:

```json
{
  "orderIndex": 1,
  "title": "Buổi 1: Số hữu tỉ",
  "shortDescription": "Ôn tập số hữu tỉ và phép tính cơ bản",
  "scheduledAt": "2026-08-01T12:00:00.000Z",
  "examOpenAt": "2026-08-01T13:00:00.000Z",
  "videoUrl": "https://youtube.com/...",
  "completionMinScore": 7,
  "status": "DRAFT"
}
```

### `GET /admin/lessons/:lessonId`

Role: `ADMIN`.

### `PATCH /admin/lessons/:lessonId`

Role: `ADMIN`.

### `DELETE /admin/lessons/:lessonId`

Role: `ADMIN`.

### `POST /admin/lessons/:lessonId/publish`

Role: `ADMIN`.

---

## 7. Lesson summary API

### `GET /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

### `PUT /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

Body:

```json
{
  "contentJson": {},
  "source": "ADMIN",
  "reviewStatus": "APPROVED"
}
```

Side effects:

- Upsert `lesson_summaries`.
- Ghi audit log.

### `POST /admin/lessons/:lessonId/summary/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "documentIds": ["uuid"],
  "style": "student_friendly"
}
```

Response: `202 Accepted`.

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

Side effects:

- Tạo `background_jobs` queue `AI_GENERATION`.
- Tạo `ai_generations` type `SUMMARY`.
- Enqueue AI generation job.

### `GET /student/lessons/:lessonId/summary`

Role: `STUDENT`.

Behavior:

- Kiểm tra enrollment hoặc trial.
- Trả summary đã được phép xem.

---

## 8. File/material API

### `POST /files/upload`

Role: authenticated.

Content-Type: `multipart/form-data`.

Fields:

```txt
file: binary
purpose: AVATAR | LESSON_DOCUMENT | EDITOR_IMAGE | QUESTION_IMAGE | NOTE_IMAGE
```

Permission matrix:

```txt
ADMIN:
- LESSON_DOCUMENT
- EDITOR_IMAGE
- QUESTION_IMAGE

STUDENT:
- AVATAR
- NOTE_IMAGE

PARENT:
- TODO: chốt parent avatar trong MVP hay không.

AI_DIAGRAM:
- Không cho client upload trực tiếp.
- Chỉ backend/worker tạo sau khi validate diagram_spec_json.
```

Behavior:

- Validate file type/size theo purpose.
- Upload Cloudflare R2.
- Lưu `files` với `purpose`.
- Trả file metadata.

### `GET /files/:fileId/signed-url`

Role: authenticated.

Behavior:

- Kiểm tra quyền dựa trên purpose, owner và entity tham chiếu.
- Trả signed URL ngắn hạn.

### `POST /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

Body:

```json
{
  "fileId": "uuid",
  "title": "PDF bài học"
}
```

Side effects:

- Tạo `lesson_documents`.
- Tạo `background_jobs` queue `DOCUMENT_PROCESSING`.
- Enqueue job nếu PDF.

### `GET /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

### `POST /admin/lessons/:lessonId/materials`

Role: `ADMIN`.

Body:

```json
{
  "type": "RICH_TEXT",
  "title": "Phiếu chuẩn bị",
  "contentJson": {},
  "fileId": null,
  "url": null
}
```

---
