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
- M3.1 trả public list tối thiểu theo `subject`, `grade`, pagination để bảo đảm student/public không thấy `DRAFT`, `HIDDEN`, `ARCHIVED` hoặc soft-deleted, trừ ngoại lệ lộ trình `DRAFT`/`HIDDEN` mà authenticated student đã mua.
- M3.3 bổ sung ưu tiên lộ trình theo grade của student và enrollment/trial state khi authenticated.
- Nếu request có `Authorization: Bearer <access_token>` hợp lệ của student, danh sách ưu tiên lộ trình cùng `student_profiles.grade` khi query không truyền `grade`.
- Response item có `summary` cho course card/detail và `access` gồm active enrollment/trial state an toàn cho UI.
- Nếu authenticated student đã có enrollment active, response item có thêm `progress` để UI dựng tiến độ và buổi học tiếp theo; guest hoặc user chưa mua nhận `progress: null`.
- Nếu authenticated student đã mua một lộ trình đang `DRAFT` hoặc `HIDDEN`, list được phép trả thêm chính lộ trình đó để màn Học tập/Khám phá hiển thị nhãn bảo trì; không trả các lộ trình chưa phát hành cho học sinh chưa mua.
- Response `meta` có `priorityGrade` và `gradeGroups` để UI group/filter theo grade.

### `GET /learning-paths/:idOrSlug`

Role: public hoặc authenticated.

Behavior:

- Trả thông tin lộ trình.
- Trả chapters public metadata, mỗi chapter chứa lessons public metadata theo thứ tự.
- Lesson public metadata trả `lessonType` để UI phân biệt buổi học cơ bản và buổi học live; không trả `liveUrl` qua endpoint public.
- Mặc định chỉ trả lộ trình `PUBLISHED`.
- Nếu authenticated student đã có active enrollment với lộ trình đó, detail vẫn trả lộ trình `DRAFT` hoặc `HIDDEN` chưa bị xóa mềm để học sinh thấy khóa học đã mua; UI phải coi `status != PUBLISHED` là trạng thái bảo trì và khóa toàn bộ lesson.
- M3.3 bổ sung trạng thái enrollment/trial nếu authenticated; M3.5 bổ sung progress cơ bản từ `lesson_progress` cho authenticated student đã mua lộ trình.
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
  },
  "progress": null
}
```

Nếu authenticated student đã có enrollment active, `progress` có shape:

```json
{
  "completedLessonCount": 1,
  "progressPercent": 25,
  "continueLessonId": "uuid",
  "continueLessonKind": "next",
  "continueLessonTitle": "Buổi 2: Biểu thức đại số"
}
```

Response detail có thêm `chapters`:

```json
{
  "chapters": [
    {
      "id": "uuid",
      "orderIndex": 1,
      "title": "Chương 1: Số hữu tỉ",
      "overview": "Tổng quan chương học",
      "status": "PUBLISHED",
      "lessons": [
        {
          "id": "uuid",
          "orderIndex": 1,
          "title": "Buổi 1: Số hữu tỉ",
          "shortDescription": "Ôn tập số hữu tỉ",
          "lessonType": "LIVE",
          "examOpenAt": null,
          "trialEnabled": true,
          "status": "PUBLISHED"
        }
      ]
    }
  ]
}
```

Ghi chú:

- Response item trả `thumbnailFileId` và `thumbnailFile: { id, originalName, url } | null`. `url` là public URL hoặc signed URL đã resolve từ Files API để màn student/public hiển thị ảnh khóa học thật.
- Response item có `status`; list public/student vẫn chỉ trả `PUBLISHED`, còn detail có thể trả `DRAFT`/`HIDDEN` cho student đã mua để hiển thị nhãn "Khóa học đang được bảo trì".
- Response detail vẫn trả chapter chưa bị xóa mềm kể cả khi `status` là `DRAFT` hoặc `HIDDEN`; front-end phải hiển thị chapter đó nhưng khóa toàn bộ lesson bên trong nếu chapter không phải `PUBLISHED`.
- Nếu learning path `status != PUBLISHED`, front-end phải khóa toàn bộ lesson dù từng chapter/lesson đang `PUBLISHED`, ẩn progress/CTA học và hiển thị nhãn bảo trì.
- `hasActiveEnrollment` chỉ tính cho authenticated student và yêu cầu enrollment `ACTIVE`, `startsAt <= now`, `expiresAt > now`.
- `progress.progressPercent` tính theo số lesson `COMPLETED` trên tổng lesson published thuộc chapter `PUBLISHED`; `continueLessonKind` chỉ là gợi ý UI để chọn copy CTA, không thay thế permission học thật ở API lesson sau này.
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
  "lessonType": "LIVE",
  "liveUrl": "https://meet.google.com/abc-defg-hij",
  "scheduledAt": "2026-08-01T12:00:00.000Z",
  "examOpenAt": "2026-08-01T13:00:00.000Z",
  "videoUrl": "https://youtube.com/...",
  "completionMinScore": 7,
  "trialEnabled": false,
  "status": "DRAFT",
  "sourceDocumentExtractions": [
    {
      "sourceDocumentId": "uuid-source-a",
      "pageStart": 20,
      "pageEnd": 22,
      "sortOrder": 0
    },
    {
      "sourceDocumentId": "uuid-source-a",
      "pageStart": 30,
      "pageEnd": 35,
      "sortOrder": 2
    }
  ]
}
```

Behavior:

- `completionMinScore` mặc định là `7` nếu không gửi.
- `trialEnabled` mặc định là `false`; học thử thuộc từng buổi học, không thuộc lộ trình.
- `lessonType` nhận `BASIC | LIVE`, mặc định `BASIC`.
- `liveUrl` là optional. Nếu có ở lesson `LIVE`, giá trị phải là URL HTTP(S) hợp lệ. Với lesson `BASIC`, backend luôn lưu `liveUrl = null`.
- `orderIndex` phải unique trong cùng chapter.
- `title` được trim, thu gọn khoảng trắng và không được trùng (không phân biệt hoa/thường) với lesson đang hoạt động khác trong cùng chapter. Hai chapter khác nhau có thể dùng cùng tên lesson. Nếu trùng trong chapter, trả `409` với `error.code = "LESSON_TITLE_DUPLICATE"` và message `Buổi học đã trùng tên`.
- `videoUrl` chỉ chấp nhận YouTube hoặc Google Drive.
- `sourceDocumentExtractions` là ordered collection optional của flow M4.x. Mỗi item trỏ tới một source document thuộc cùng learning path và một range. Gửi `[]` khi lesson không có khối trích xuất.
- Nhiều item có thể dùng cùng `sourceDocumentId`, nhưng range không được giao nhau theo biên inclusive. Các source document khác nhau có thể dùng cùng số trang.

Side effects:

- Tạo `lessons`.
- Nếu có `sourceDocumentExtractions`, backend validate toàn bộ source documents/ranges và reconcile collection trong cùng transaction.
- Mỗi source document chỉ được dùng khi `READY`, đủ page records, mọi page `READY` và không còn `printedPage.warning`; nếu chưa đạt, trả lỗi validation thay vì lưu mapping sớm.
- Tạo một `lesson_document_page_ranges` và một `lesson_documents(kind = PRIMARY_FROM_SOURCE)` liên kết bằng `pageRangeId` cho từng khối; enqueue chunking cho các khối mới/đã đổi.
- Tăng `learning_paths.total_lesson_count`.
- Ghi `audit_logs`.

### `GET /admin/lessons/:lessonId`

Role: `ADMIN`.

Behavior:

- Trả lesson chưa bị soft delete, gồm `lessonType` và `liveUrl`.

### `PATCH /admin/lessons/:lessonId`

Role: `ADMIN`.

Body: partial của body create. `sourceDocumentExtractions` là collection đầy đủ sau chỉnh sửa: gửi `[]` để xóa tất cả khối, hoặc bỏ field khi chỉ sửa metadata lesson. Item hiện có gửi thêm `id` của page range để backend reconcile ổn định.

`customVideoSettings.chapters` là danh sách mốc thời gian optional của video:

```json
{
  "customVideoSettings": {
    "chapters": [
      { "time": 0, "title": "Giới thiệu" },
      { "time": 69, "title": "1. Đơn thức và đơn thức thu gọn" }
    ]
  }
}
```

Mỗi mốc cần `time` là số giây nguyên không âm và `title` không rỗng. Có thể bỏ field `chapters` khi chỉ sửa cài đặt player khác.

Behavior:

- Cho phép đổi `orderIndex`, metadata, `lessonType`, `liveUrl`, thời điểm mở bài thi, video URL, custom video settings/chapters, completion score, `trialEnabled` và `status`.
- `shortDescription`, `liveUrl`, `scheduledAt`, `examOpenAt`, `videoUrl` có thể set `null` để clear.
- Khi đổi `lessonType` về `BASIC`, backend clear `liveUrl` kể cả request không gửi lại field này.
- Nếu đổi `orderIndex`, thứ tự mới vẫn không được trùng trong cùng chapter.
- Nếu đổi `title`, tên mới vẫn phải duy nhất trong cùng chapter theo cùng quy tắc của API tạo lesson; lesson hiện tại được loại khỏi phép kiểm tra.
- Nếu gửi `sourceDocumentExtractions`, backend validate source document cùng learning path, readiness, thứ tự range và same-source overlap; sau đó tạo/cập nhật/xóa đúng từng mapping và enqueue chunking khi nguồn/range đổi.
- Same-source overlap trả `400` với `error.code = "LESSON_SOURCE_EXTRACTION_OVERLAP"` và details của hai range xung đột.
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

## 8. Admin personalized learning path API

### `GET /admin/learning-paths/:learningPathId/enrollments`

Role: `ADMIN`.

Query: `search`, `personalizationStatus`, pagination.

Behavior:

- Chỉ nhận `learningPathId` của khóa `CATALOG`.
- Trả enrollment, thông tin student tối thiểu, lộ trình đang được giao và trạng thái clone job nếu có.

### `POST /admin/enrollments/:enrollmentId/personal-learning-path`

Role: `ADMIN`.

Body:

```json
{
  "idempotencyKey": "client-generated-key"
}
```

Behavior:

- Chỉ cho enrollment hợp lệ của khóa `CATALOG`.
- Nếu enrollment đã có bản cá nhân đang dùng, trả `409 PERSONAL_LEARNING_PATH_EXISTS`.
- Queue clone job và trả `202 Accepted` theo job convention.
- Clone gồm learning path/chapter/lesson và nội dung quản trị mutable; file/OCR artifact hợp lệ được tái sử dụng.
- Chỉ set `enrollment.delivery_learning_path_id` ở bước cuối sau khi toàn bộ clone thành công.
- Ghi audit log.

### `GET /admin/enrollments/:enrollmentId/personal-learning-path`

Role: `ADMIN`.

Behavior:

- Trả khóa gốc, bản cá nhân hiện tại, clone status và lineage summary.
- Sau khi clone đã activation, API chỉ trả bản cá nhân hiện tại; không có endpoint revert/reset về khóa gốc.

### Quy tắc dùng lại CRUD

- CRUD learning path/chapter/lesson hiện có được tái sử dụng cho path `PERSONALIZED` ở admin.
- Response admin phải trả `kind`, `sourceLearningPathId` và student owner summary khi là bản cá nhân.
- Delete permanent bản cá nhân bị chặn khi còn student history hoặc chưa qua retention policy.
- Bản cá nhân đang gắn với enrollment không được archive/delete ở cấp root; admin sửa trực tiếp chapter/lesson/content bên trong.
- Public list/detail luôn filter `kind = CATALOG`; không dựa riêng vào `status`.

---

## 9. Lesson summary API

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

## 10. File/material API

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

### `POST /admin/learning-paths/:learningPathId/source-documents`

Role: `ADMIN`.

Ghi chú: Course có thể upload nhiều PDF/tài liệu nguồn. Mọi source document active đều là nguồn trích xuất ngang hàng cho lesson; chapter không có document/material upload riêng.

Body:

```json
{
  "fileId": "uuid",
  "title": "Toán 7 Tập 1"
}
```

Side effects:

- Tạo thêm source document; không thay thế/xóa mềm source documents đã có.
- Tạo `background_jobs` queue `DOCUMENT_PROCESSING`.
- `M4.2` tạo durable job record; `M4.3` nối BullMQ thật để worker nhận job; `M4.4` import hoặc tạo paid OCR artifact page-level nếu PDF.

### `POST /admin/source-documents/:sourceDocumentId/process`

Role: `ADMIN`.

Behavior:

- Tạo job xử lý lại tài liệu nguồn bằng file gốc đã upload.
- Đưa source document về trạng thái `PROCESSING`, gắn `processingJobId` mới và enqueue `DOCUMENT_PROCESSING`.
- Nếu job hiện tại vẫn đang `QUEUED` hoặc `RUNNING`, trả `409 CONFLICT` để tránh bấm trùng nhiều lần.
- Dùng cho nút `Xử lý lại`/`Chạy xử lý` trong UI M4.5 khi tài liệu lỗi, bị hủy hoặc cần đọc lại sau khi cấu hình provider/cache đã sẵn sàng.

### `GET /admin/learning-paths/:learningPathId/source-documents`

Role: `ADMIN`.

Behavior:

- Trả toàn bộ source documents active của lộ trình theo đúng thứ tự upload cũ đến mới (`createdAt asc`, `id asc`).
- Mỗi item có `readiness` gồm `status`, `isEligibleForExtraction`, `warningPageCount`, `readyPageCount`, `totalPageRecords`. Chỉ item có `isEligibleForExtraction = true` mới được đưa vào source select của modal lesson; item còn `printedPage.warning` có `status = NEEDS_CONFIRMATION`.
- UI dùng phần tử đầu danh sách làm mặc định cho source select của khối trích xuất mới, nhưng admin có thể chọn bất kỳ phần tử nào.

### `DELETE /admin/source-documents/:sourceDocumentId`

Role: `ADMIN`.

Behavior:

- Xóa mềm source document chưa được gán vào lesson.
- Nếu source document còn page range hoặc lesson document active, trả `409 CONFLICT`.
- Không xóa file gốc khỏi object storage trong request này.

### `GET /admin/source-documents/:sourceDocumentId/pages`

Role: `ADMIN`.

Behavior:

- Trả danh sách page records: `pageNumber`, `printedPage` (`pdfPageNumber`, `printedPageNumber`, `printedPageLabel`, `source`, `confidence`, `warning`), `status`, `textSource`, `ocrProvider`, `artifactKey` hoặc artifact status nếu có, `qualityScore`, `thumbnailFileId`, `hasVisualAssets`/`visualAssetCount` nếu có, `imageManifestKey`/visual refs, `artifactAuditKey`/audit status nếu có, và text preview ngắn.
- Nếu `printedPage.warning` là `missing` hoặc `ambiguous`, UI M4.5 nên cho admin thấy trạng thái cần kiểm tra/xác nhận thay vì âm thầm coi `pageNumber` là số trang in.
- `textSource` production mặc định là `paid_ocr` khi OCR paid đã bật; `text_layer`/`free_ocr` chỉ dùng cho fallback local hoặc vận hành có kiểm soát.

### `PUT /admin/source-documents/:sourceDocumentId/lesson-page-ranges`

Role: `ADMIN`.

Body:

```json
{
  "ranges": [
    {
      "lessonId": "uuid",
      "pageStart": 20,
      "pageEnd": 22
    }
  ]
}
```

Behavior:

- Validate lesson thuộc cùng learning path với source document.
- Validate page range nằm trong tổng số trang.
- Chỉ cho lưu khi source document `READY`, đủ page records, mọi page `READY` và không còn `printedPage.warning`; nếu không, trả lỗi để admin xử lý/xác nhận tài liệu trước.
- Trả warning nếu page range trùng hoặc có trang chưa gán.
- Tạo/cập nhật lesson document mapping cho từng lesson.
- Tạo `background_jobs` queue `DOCUMENT_PROCESSING` cho chunking các lesson bị thay đổi range; `M4.3` nối BullMQ thật.

### `POST /admin/lessons/:lessonId/primary-document/replace`

Role: `ADMIN`.

Ghi chú: Endpoint tương thích cho client cũ với một page range hoặc một file. UI mới dùng `sourceDocumentExtractions` trên create/update lesson để quản lý nhiều khối và dùng `POST /admin/lessons/:lessonId/documents` để thêm file nền tảng.

Body khi dùng page range từ source document:

```json
{
  "sourceDocumentId": "uuid",
  "pageStart": 20,
  "pageEnd": 22
}
```

Body tương thích khi upload file nền tảng:

```json
{
  "fileId": "uuid",
  "title": "PDF gốc của buổi học"
}
```

Behavior:

- Client mới không dùng endpoint này để reconcile nhiều khối; collection canonical nằm ở `sourceDocumentExtractions`.
- Một lesson có thể có nhiều file nền tảng active; tất cả đều trả `kind = PRIMARY_FROM_SOURCE`.
- Thay page range chỉ đánh dấu page-range document cũ là replaced, không ảnh hưởng các file nền tảng upload.
- Nhánh `fileId` tạo thêm một file nền tảng và không thay thế các tài liệu nền tảng hiện có.
- Tài liệu `SUPPLEMENT` và `HOMEWORK` của lesson không bị ảnh hưởng.
- Nếu thay bằng page range từ source document, backend chỉ nhận khi source document/page đã sẵn sàng như rule của `PUT /admin/source-documents/:sourceDocumentId/lesson-page-ranges`.
- Tạo `background_jobs` queue `DOCUMENT_PROCESSING` để import/tạo OCR artifact nếu cần rồi chunk lại cho lesson; `M4.3` nối BullMQ thật.

### `POST /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

Ghi chú: Upload trực tiếp một tài liệu nền tảng, tài liệu bổ sung hoặc tài liệu bài tập về nhà cho lesson.

Body:

```json
{
  "fileId": "uuid",
  "title": "Phiếu bài tập thêm",
  "kind": "SUPPLEMENT",
  "processingMode": "PROCESSING"
}
```

`kind` nhận một trong ba giá trị canonical: `PRIMARY_FROM_SOURCE`, `SUPPLEMENT`, `HOMEWORK`.

`processingMode` optional:

- Không gửi hoặc gửi `PROCESSING`: tài liệu bổ sung được đưa vào pipeline xử lý/chunking như context bổ sung của lesson.
- Gửi `STORAGE_ONLY`: dùng cho tài liệu tham khảo trong modal tạo lesson; backend chỉ lưu file/document kèm lesson, set document `READY`, `chunkCount = 0`, không tạo OCR artifact, chunk, embedding hoặc `background_jobs`.

Side effects:

- Tạo `lesson_documents` trực tiếp cho lesson với kind được gửi lên. `PRIMARY_FROM_SOURCE` ở endpoint này luôn là file upload trực tiếp, không phải page-range mapping.
- Tạo thêm `PRIMARY_FROM_SOURCE` không replace hoặc xóa các tài liệu nền tảng hiện có.
- Tạo `background_jobs` queue `DOCUMENT_PROCESSING` khi `processingMode` là `PROCESSING`.
- `M4.3` nối BullMQ thật để worker nhận job nếu PDF; `M4.4` dùng paid OCR-first cho tài liệu học chính/supplement khi OCR paid được bật.

### `GET /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

Behavior:

- Trả cả tài liệu chính từ source document/page range và tài liệu bổ sung upload trực tiếp.
- Response chỉ dùng ba kind canonical: `PRIMARY_FROM_SOURCE | SUPPLEMENT | HOMEWORK`.
- Item từ khối trích xuất có `pageRangeId`, object `pageRange` và `sortOrder`; file upload trực tiếp có `pageRangeId = null`.

### `GET /admin/learning-paths/:learningPathId/lesson-documents`

Role: `ADMIN`.

Behavior:

- Trả toàn bộ lesson documents active của các lesson trong một learning path.
- Dùng cho màn M4.5 để hiển thị tài liệu chính, tài liệu bổ sung, trạng thái chunking và lỗi theo từng buổi học bằng một request tổng hợp, tránh gọi `GET /admin/lessons/:lessonId/documents` lặp lại cho từng lesson.
- Response item dùng cùng shape với `GET /admin/lessons/:lessonId/documents`.
- Danh sách được sắp xếp theo `sortOrder`, sau đó `createdAt`/`id` để UI khôi phục thứ tự ổn định.

### `DELETE /admin/lessons/:lessonId/documents/:documentId`

Role: `ADMIN`.

Behavior:

- Cho xóa file upload trực tiếp `PRIMARY_FROM_SOURCE`, `SUPPLEMENT` hoặc `HOMEWORK`.
- Không cho xóa tài liệu `PRIMARY_FROM_SOURCE` có `source_document_id`; page range phải được xóa bằng flow mapping của lesson.
- Không xóa file gốc khỏi object storage trong request này.

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
