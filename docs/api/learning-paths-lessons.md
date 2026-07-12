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
- M3.1 trả public list tối thiểu theo `subject`, `grade`, pagination để bảo đảm student/public không thấy `DRAFT`, `HIDDEN`, `ARCHIVED` hoặc soft-deleted.
- M3.3 bổ sung ưu tiên lộ trình theo grade của student và enrollment/trial state khi authenticated.
- Nếu request có `Authorization: Bearer <access_token>` hợp lệ của student, danh sách ưu tiên lộ trình cùng `student_profiles.grade` khi query không truyền `grade`.
- Response item có `summary` cho course card/detail và `access` gồm active enrollment/trial state an toàn cho UI.
- Response `meta` có `priorityGrade` và `gradeGroups` để UI group/filter theo grade.

### `GET /learning-paths/:idOrSlug`

Role: public hoặc authenticated.

Behavior:

- Trả thông tin lộ trình.
- Trả chapters public metadata, mỗi chapter chứa lessons public metadata theo thứ tự.
- Chỉ trả lộ trình `PUBLISHED`.
- M3.3 bổ sung trạng thái enrollment/trial nếu authenticated.
- `idOrSlug` nhận UUID hoặc slug public ổn định.

Response item fields bổ sung từ M3.3:

```json
{
  "summary": {
    "chapterCount": 4,
    "lessonCount": 12,
    "firstLessonId": "uuid",
    "effectivePriceVnd": 1500000,
    "hasDiscount": true
  },
  "access": {
    "hasActiveEnrollment": false,
    "enrollment": null,
    "trialAvailable": true,
    "trialLessonId": "uuid"
  }
}
```

Ghi chú:

- `hasActiveEnrollment` chỉ tính cho authenticated student và yêu cầu enrollment `ACTIVE`, `startsAt <= now`, `expiresAt > now`.
- Parent selected child/enrollment state sẽ nối ở milestone parent/payment sau; hiện parent token vẫn xem được dữ liệu public an toàn như guest.

---

## 5. Admin learning path API

### `GET /admin/learning-paths`

Role: `ADMIN`.

Query: `status`, `subject`, `grade`, `search`, pagination.

Behavior:

- Mặc định không trả lộ trình `ARCHIVED`; màn thùng rác quản trị lấy riêng bằng `status=ARCHIVED`.
- Response item có `totalChapterCount`, `totalLessonCount`, `enrolledStudentCount` và `thumbnailFile`/signed URL nếu có file ảnh.

### `GET /admin/learning-paths/:id`

Role: `ADMIN`.

Behavior:

- Trả chi tiết learning path chưa bị soft delete.
- Response include `totalChapterCount`, `totalLessonCount`, `enrolledStudentCount`, `thumbnailFile` và `chapters`; mỗi chapter chứa lesson metadata để admin dựng màn chi tiết.

### `POST /admin/learning-paths`

Role: `ADMIN`.

Body:

```json
{
  "title": "Toán 7",
  "slug": "toan-7",
  "subject": "MATH",
  "grade": 7,
  "originalPriceVnd": 2000000,
  "salePriceVnd": 1500000,
  "thumbnailFileId": "uuid",
  "descriptionJson": {},
  "status": "DRAFT",
  "sortOrder": 1
}
```

Ghi chú:

- `slug` optional; nếu không gửi, backend tự tạo từ `title` và đảm bảo unique.
- `status` default là `DRAFT`.
- `thumbnailFileId` phải trỏ tới file upload purpose `EDITOR_IMAGE` trong Files API. Nếu chưa có purpose thumbnail riêng, admin course cover tạm dùng `EDITOR_IMAGE`.

Side effects:

- Tạo `learning_paths`.
- Ghi `audit_logs`.

### `PATCH /admin/learning-paths/:id`

Role: `ADMIN`.

Body: partial của body create, gồm `status` để chuyển giữa `DRAFT`, `PUBLISHED`, `HIDDEN`. Trạng thái `ARCHIVED` chỉ được tạo qua thao tác xóa mềm.

Behavior:

- Nếu chuyển sang `PUBLISHED`, set `published_at`.
- Nếu chuyển khỏi `PUBLISHED`, clear `published_at`.
- Ghi `audit_logs`.

### `DELETE /admin/learning-paths/:id`

Role: `ADMIN`.

Behavior: soft delete và set status `ARCHIVED`. Lộ trình archived không nằm trong danh sách quản trị mặc định.

Side effects:

- Ghi `audit_logs`.

### `POST /admin/learning-paths/:id/restore`

Role: `ADMIN`.

Behavior: khôi phục lộ trình archived về `DRAFT` để xuất hiện lại trong danh sách quản trị.

Side effects:

- Clear `deleted_at` nếu backend đã set khi xóa mềm.
- Clear `published_at`.
- Ghi `audit_logs`.

### `DELETE /admin/learning-paths/:id/permanent`

Role: `ADMIN`.

Behavior: xóa vĩnh viễn một lộ trình đang `ARCHIVED`. Chỉ cho phép thao tác từ thùng rác quản trị.

Side effects:

- Xóa hoặc purge dữ liệu phụ thuộc theo chính sách retention đã chốt.
- Ghi `audit_logs`.

### `POST /admin/learning-paths/:id/publish`

Role: `ADMIN`.

Behavior: set status `PUBLISHED`, set `published_at`.

---

## 6. Admin chapter API

### `GET /admin/learning-paths/:learningPathId/chapters`

Role: `ADMIN`.

Behavior:

- Trả danh sách chapter chưa bị soft delete trong một learning path, sắp xếp theo `orderIndex` tăng dần.
- Nếu learning path không tồn tại hoặc đã bị xóa mềm, trả `404 NOT_FOUND`.

### `POST /admin/learning-paths/:learningPathId/chapters`

Role: `ADMIN`.

Body:

```json
{
  "orderIndex": 1,
  "title": "Chương 1: Số hữu tỉ",
  "overview": "Tổng quan các kiến thức nền về số hữu tỉ",
  "objectivesJson": {
    "items": ["Nhận biết số hữu tỉ", "Thực hiện phép tính cơ bản"]
  },
  "status": "DRAFT"
}
```

Behavior:

- `orderIndex` phải unique trong cùng learning path.
- Chapter chỉ chứa thông tin tổng quan; không nhận video URL, document/material, summary học tập, quiz, flashcard hoặc test.

Side effects:

- Tạo `learning_path_chapters`.
- Tăng `learning_paths.total_chapter_count` nếu dùng denormalized counter.
- Ghi `audit_logs`.

### `GET /admin/chapters/:chapterId`

Role: `ADMIN`.

Behavior:

- Trả chapter chưa bị soft delete, kèm lesson metadata nếu UI chi tiết cần.

### `PATCH /admin/chapters/:chapterId`

Role: `ADMIN`.

Body: partial của body create.

Behavior:

- Cho phép đổi `orderIndex`, `title`, `overview`, `objectivesJson` và `status`.
- Nếu đổi `orderIndex`, thứ tự mới vẫn không được trùng trong cùng learning path.
- Ghi `audit_logs`.

### `DELETE /admin/chapters/:chapterId`

Role: `ADMIN`.

Behavior:

- Soft delete chapter và set status `ARCHIVED`.
- Chỉ cho phép xóa mềm khi service xử lý rõ các lesson con theo policy archive; MVP ưu tiên archive chapter kèm các lesson con để tránh lesson mồ côi.
- Ghi `audit_logs`.

### `POST /admin/chapters/:chapterId/publish`

Role: `ADMIN`.

Behavior:

- Set status `PUBLISHED`.
- Ghi `audit_logs`.

---

## 7. Admin lesson API

### `GET /admin/chapters/:chapterId/lessons`

Role: `ADMIN`.

Behavior:

- Trả danh sách lesson chưa bị soft delete trong một chapter, sắp xếp theo `orderIndex` tăng dần.
- Nếu chapter không tồn tại hoặc đã bị xóa mềm, trả `404 NOT_FOUND`.

### `POST /admin/chapters/:chapterId/lessons`

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
  "trialEnabled": false,
  "status": "DRAFT"
}
```

Behavior:

- `completionMinScore` mặc định là `7` nếu không gửi.
- `trialEnabled` mặc định là `false`; học thử thuộc từng buổi học, không thuộc lộ trình.
- `orderIndex` phải unique trong cùng chapter.
- `videoUrl` chỉ chấp nhận YouTube hoặc Google Drive.

Side effects:

- Tạo `lessons`.
- Tăng `learning_paths.total_lesson_count`.
- Ghi `audit_logs`.

### `GET /admin/lessons/:lessonId`

Role: `ADMIN`.

Behavior:

- Trả lesson chưa bị soft delete.

### `PATCH /admin/lessons/:lessonId`

Role: `ADMIN`.

Body: partial của body create.

Behavior:

- Cho phép đổi `orderIndex`, metadata, thời điểm mở bài thi, video URL, completion score, `trialEnabled` và `status`.
- `shortDescription`, `scheduledAt`, `examOpenAt`, `videoUrl` có thể set `null` để clear.
- Nếu đổi `orderIndex`, thứ tự mới vẫn không được trùng trong cùng chapter.
- Ghi `audit_logs`.

### `DELETE /admin/lessons/:lessonId`

Role: `ADMIN`.

Behavior:

- Soft delete lesson và set status `ARCHIVED`.
- Giải phóng `orderIndex` để admin có thể tạo lesson mới cùng thứ tự trong learning path nếu cần.
- Giảm `learning_paths.total_lesson_count`.
- Ghi `audit_logs`.

### `POST /admin/lessons/:lessonId/publish`

Role: `ADMIN`.

Behavior:

- Set status `PUBLISHED`.
- Ghi `audit_logs`.

---

## 8. Lesson summary API

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

## 9. File/material API

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
- Upload qua storage adapter S3-compatible: MinIO local/dev hoặc Cloudflare R2 staging/production.
- Lưu `files` với `purpose`.
- Trả file metadata.

### `GET /files/:fileId/signed-url`

Role: authenticated.

Behavior:

- Kiểm tra quyền dựa trên purpose, owner và entity tham chiếu.
- Trả signed URL ngắn hạn để UI đọc file private/local MinIO/R2 mà không public bucket.

### `POST /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

Ghi chú: Chapter không có document/material upload riêng ở MVP; upload tài liệu chỉ thực hiện ở cấp lesson.

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
