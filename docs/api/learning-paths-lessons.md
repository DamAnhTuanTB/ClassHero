# API Learning Paths Lessons Materials

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 4. Public learning path API

### `GET /catalog/course-options`

Role: public hoặc authenticated.

Behavior:

- Trả `domains` và `targetAudiences` dùng chung cho bộ lọc catalog khóa học.
- `domains` được sắp xếp theo `sortOrder ASC`, sau đó `name ASC`.
- `targetAudiences` được sắp xếp theo `sortOrder ASC`, sau đó `name ASC`.
- Response chỉ chứa dữ liệu catalog công khai cần cho select; không trả timestamp quản trị.
- Student dùng ID trong `targetAudiences` cho filter có nhãn `Khối lớp` và `domain.id` cho filter có nhãn `Môn học`, nên admin đổi tên không làm hỏng URL/filter đang dùng.

### `GET /learning-paths`

Role: public hoặc authenticated.

Query:

```txt
domainId=<uuid>&targetAudienceId=<uuid>&page=1&pageSize=20
```

Behavior:

- Chỉ trả `PUBLISHED`.
- M3.1 trả public list tối thiểu theo `subject`, `grade`, pagination để bảo đảm student/public không thấy `DRAFT`, `HIDDEN`, `ARCHIVED` hoặc soft-deleted, trừ ngoại lệ lộ trình `DRAFT`/`HIDDEN` mà authenticated student đã mua.
- M3.3 bổ sung ưu tiên lộ trình theo grade của student và enrollment/trial state khi authenticated.
- Nếu request có `Authorization: Bearer <access_token>` hợp lệ của student, danh sách ưu tiên lộ trình cùng `student_profiles.grade` khi query không truyền `grade`.
- Response item có `summary` cho course card/detail và `access` gồm active enrollment/trial state an toàn cho UI.
- Response item trả `targetAudiences[]` theo `sortOrder`; một khóa học có thể khớp nhiều đối tượng và query `targetAudienceId` khớp nếu mảng chứa ID được chọn.
- Nếu authenticated student đã có enrollment active, response item có thêm `progress` để UI dựng tiến độ và buổi học tiếp theo; guest hoặc user chưa mua nhận `progress: null`.
- Nếu authenticated student đã mua một lộ trình đang `DRAFT` hoặc `HIDDEN`, list được phép trả thêm chính lộ trình đó để màn Học tập/Khám phá hiển thị nhãn bảo trì; không trả các lộ trình chưa phát hành cho học sinh chưa mua.
- Response `meta` có `priorityGrade` và `gradeGroups` để UI group/filter theo grade.
- Trong từng nhóm ưu tiên, danh sách được xếp theo `domain.sortOrder`, tiếp theo `learningPath.sortOrder`, rồi `publishedAt` giảm dần.

### `GET /learning-paths/:idOrSlug`

Role: public hoặc authenticated.

Behavior:

- Trả thông tin lộ trình.
- Trả `structureItems` là danh sách top-level có thứ tự gồm chapter và lesson không thuộc chapter; item chapter chứa lessons public metadata theo thứ tự.
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

Response detail có cấu trúc phân biệt bằng `type`:

```json
{
  "structureItems": [
    {
      "type": "LESSON",
      "id": "uuid",
      "chapterId": null,
      "orderIndex": 1,
      "title": "Buổi 1: Làm quen khóa học",
      "shortDescription": "Nội dung nhập môn",
      "lessonType": "BASIC",
      "examOpenAt": null,
      "trialEnabled": true,
      "status": "PUBLISHED"
    },
    {
      "type": "CHAPTER",
      "id": "uuid-chapter",
      "orderIndex": 2,
      "title": "Chương 1: Số hữu tỉ",
      "overview": "Tổng quan chương học",
      "status": "PUBLISHED",
      "lessons": []
    }
  ]
}
```

Ghi chú:

- Response item trả `thumbnailFileId` và `thumbnailFile: { id, originalName, url } | null`. `url` là public URL hoặc signed URL đã resolve từ Files API để màn student/public hiển thị ảnh khóa học thật.
- Response item có `status`; list public/student vẫn chỉ trả `PUBLISHED`, còn detail có thể trả `DRAFT`/`HIDDEN` cho student đã mua để hiển thị nhãn "Khóa học đang được bảo trì".
- Response detail vẫn trả chapter chưa bị xóa mềm kể cả khi `status` là `DRAFT` hoặc `HIDDEN`; front-end phải hiển thị chapter đó nhưng khóa toàn bộ lesson bên trong nếu chapter không phải `PUBLISHED`.
- `structureItems` sắp xếp theo `orderIndex` và có thể xen kẽ item `LESSON`/`CHAPTER`. Trong chapter, `lessons` tiếp tục sắp xếp theo `orderIndex` riêng.
- `chapters` nested cũ có thể được giữ tạm cho client tương thích, nhưng client mới phải dùng `structureItems` làm canonical để không mất vị trí lesson top-level.
- Nếu learning path `status != PUBLISHED`, front-end phải khóa toàn bộ lesson dù từng chapter/lesson đang `PUBLISHED`, ẩn progress/CTA học và hiển thị nhãn bảo trì.
- `hasActiveEnrollment` chỉ tính cho authenticated student và yêu cầu enrollment `ACTIVE`, `startsAt <= now`, `expiresAt > now`.
- `progress.progressPercent` tính theo số lesson `COMPLETED` trên tổng lesson published, gồm lesson không thuộc chapter và lesson thuộc chapter `PUBLISHED`; `continueLessonKind` chỉ là gợi ý UI để chọn copy CTA, không thay thế permission học thật ở API lesson sau này.
- Thứ tự học/điều hướng course-level flatten `structureItems` theo depth-first từ trên xuống: lesson top-level tại chỗ của nó, còn chapter đóng góp các lesson con theo `orderIndex`.
- Parent selected child/enrollment state sẽ nối ở milestone parent/payment sau; hiện parent token vẫn xem được dữ liệu public an toàn như guest.

---

## 5. Admin learning path API

### Catalog Lĩnh vực

- `GET /admin/domains`: trả danh sách lĩnh vực theo `sortOrder ASC`, sau đó `name ASC`.
- `POST /admin/domains`: tạo lĩnh vực; nếu không truyền `sortOrder`, lĩnh vực mới được thêm ở cuối danh sách.
- `PATCH /admin/domains/:id`: sửa tên hoặc `sortOrder` của một lĩnh vực.
- `PATCH /admin/domains/reorder`: nhận toàn bộ `domainIds` theo thứ tự mới, cập nhật `sortOrder` trong một transaction và trả danh sách đã sắp xếp.
- `DELETE /admin/domains/:id`: chỉ xóa lĩnh vực chưa được khóa học sử dụng.

Body reorder:

```json
{
  "domainIds": [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002"
  ]
}
```

Nếu catalog thay đổi trong lúc admin đang sắp xếp, API trả `DOMAIN_CATALOG_CHANGED`; UI phải tải lại trước khi thử lại.

### `GET /admin/learning-paths`

Role: `ADMIN`.

Query: `status`, `domainId`, `targetAudienceId`, `search`, pagination.

Behavior:

- Mặc định không trả lộ trình `ARCHIVED`; màn thùng rác quản trị lấy riêng bằng `status=ARCHIVED`.
- Response item có `totalChapterCount`, `totalLessonCount`, `enrolledStudentCount` và `thumbnailFile`/signed URL nếu có file ảnh.

### `GET /admin/learning-paths/:id`

Role: `ADMIN`.

Behavior:

- Trả chi tiết learning path chưa bị soft delete.
- Response include `totalChapterCount`, `totalLessonCount`, `enrolledStudentCount`, `thumbnailFile` và canonical `structureItems`; item chapter chứa lesson metadata để admin dựng cây có thứ tự. `chapters` có thể được giữ tạm cho client cũ.

### `POST /admin/learning-paths`

Role: `ADMIN`.

Body:

```json
{
  "title": "Toán 7",
  "slug": "toan-7",
  "domainId": "10000000-0000-4000-8000-000000000001",
  "targetAudienceIds": ["20000000-0000-4000-8000-000000000007"],
  "originalPriceVnd": 2000000,
  "salePriceVnd": 1500000,
  "thumbnailFileId": "uuid",
  "descriptionJson": {},
  "startDate": "2026-09-05",
  "endDate": "2027-05-31",
  "lessonCountMin": 50,
  "lessonCountMax": 100,
  "status": "DRAFT",
  "sortOrder": 1
}
```

Ghi chú:

- `slug` optional; nếu không gửi, backend tự tạo từ `title` và đảm bảo unique.
- `status` default là `DRAFT`.
- `targetAudienceIds` bắt buộc có đúng một UUID. Contract giữ kiểu mảng để tương thích schema/bảng nối hiện tại; PATCH mảng này sẽ thay đối tượng của khóa học.
- `thumbnailFileId` phải trỏ tới file upload purpose `EDITOR_IMAGE` trong Files API. Nếu chưa có purpose thumbnail riêng, admin course cover tạm dùng `EDITOR_IMAGE`.
- `startDate` và `endDate` là optional, dùng format `YYYY-MM-DD`; nếu gửi cả hai, `endDate` không được sớm hơn `startDate`. Gửi `null` khi PATCH để xóa ngày đã lưu.
- `lessonCountMin` và `lessonCountMax` là optional, nhận số nguyên từ 1 đến 500; nếu gửi cả hai, max không được nhỏ hơn min. Gửi `null` khi PATCH để xóa giá trị đã lưu.

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
  "title": "Chương 1: Số hữu tỉ",
  "overview": "Tổng quan các kiến thức nền về số hữu tỉ",
  "objectivesJson": {
    "items": ["Nhận biết số hữu tỉ", "Thực hiện phép tính cơ bản"]
  },
  "status": "DRAFT"
}
```

Behavior:

- Client không truyền `orderIndex`. Backend khóa cấu trúc, tự nối chapter vào cuối canonical `structureItems`, compact lại thứ tự liên tục từ `1` và lưu trong cùng transaction.
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

Body: partial metadata của body create; `orderIndex` optional chỉ dành cho flow reorder chapter hiện có, không xuất hiện trong modal tạo/sửa.

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

### `POST /admin/learning-paths/:learningPathId/lessons`

Role: `ADMIN`.

Endpoint canonical để tạo lesson trực tiếp từ course detail.

Body:

```json
{
  "chapterId": null,
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
  "sourceDocumentExtractions": []
}
```

Behavior:

- `chapterId` optional/nullable. `null` hoặc bỏ field tạo lesson không thuộc chapter; UUID tạo lesson trong chapter tương ứng.
- Nếu có `chapterId`, chapter phải active và thuộc đúng `learningPathId` trên URL.
- Client không truyền `orderIndex`. Nếu `chapterId = null`, backend nối lesson vào cuối canonical `structureItems`; nếu có `chapterId`, backend nối lesson vào cuối `chapter.lessons`.
- Backend khóa cấu trúc, validate title/chapter, compact dãy thứ tự liên tục từ `1` và lưu trong cùng transaction. Đổi vị trí sau khi tạo dùng endpoint `move`.
- Tăng `learning_paths.total_lesson_count` và ghi `audit_logs` như flow create hiện có.

Các field metadata/document khác giữ nguyên rule create lesson hiện hành: score mặc định `7`, `trialEnabled` mặc định `false`, `lessonType` mặc định `BASIC`, `liveUrl` chỉ giữ cho `LIVE`, video chỉ nhận YouTube/Google Drive và `sourceDocumentExtractions` phải thuộc cùng learning path.

### `POST /admin/chapters/:chapterId/lessons`

Role: `ADMIN`.

Endpoint compatibility cho client cũ. Behavior tương đương endpoint canonical với `chapterId` lấy từ URL và không cho body ghi đè sang chapter khác/null.

### `GET /admin/chapters/:chapterId/lessons`

Role: `ADMIN`.

Behavior:

- Trả danh sách lesson chưa bị soft delete trong một chapter, sắp xếp theo `orderIndex` tăng dần.
- Nếu chapter không tồn tại hoặc đã bị xóa mềm, trả `404 NOT_FOUND`.

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

- Trả lesson chưa bị soft delete, gồm `chapterId: string | null`, `chapterTitle: string | null`, `lessonType` và `liveUrl`.

### `PATCH /admin/lessons/:lessonId`

Role: `ADMIN`.

Body: partial metadata của body create. `sourceDocumentExtractions` là collection đầy đủ sau chỉnh sửa: gửi `[]` để xóa tất cả khối, hoặc bỏ field khi chỉ sửa metadata lesson. Item hiện có gửi thêm `id` của page range để backend reconcile ổn định. Di chuyển container/vị trí dùng endpoint `move` riêng bên dưới.

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

`customVideoSettings.transcript` là bản chép lời optional đã được admin duyệt:

```json
{
  "customVideoSettings": {
    "transcriptLanguage": "vi",
    "transcript": [
      { "time": 5.275, "endTime": 7.4, "text": "Chào các em, hôm nay chúng ta..." },
      { "time": 7.425, "endTime": 10.18, "text": "Trước tiên cô sẽ nhắc lại..." }
    ]
  }
}
```

Mỗi đoạn cần `time` là số giây nguồn không âm, `endTime` optional nhưng không nhỏ hơn `time`, và `text` sau trim không rỗng. Transcript lấy mới giữ nguyên timestamp cue YouTube với tối đa 3 chữ số thập phân; form admin hiển thị thời gian sau cắt nhưng cộng lại `startTimeInSeconds` trước khi PATCH. API nhận tối đa 10.000 đoạn; client gửi theo thứ tự tăng dần.

Behavior:

- Cho phép đổi `orderIndex`, metadata, `lessonType`, `liveUrl`, thời điểm mở bài thi, video URL, custom video settings/chapters, completion score, `trialEnabled` và `status`.
- `shortDescription`, `liveUrl`, `scheduledAt`, `examOpenAt`, `videoUrl` có thể set `null` để clear.
- Khi đổi `lessonType` về `BASIC`, backend clear `liveUrl` kể cả request không gửi lại field này.
- Nếu đổi `orderIndex` qua endpoint PATCH cũ, chỉ reorder trong container hiện tại để tương thích; chuyển container phải dùng endpoint `move`.
- Nếu đổi `title`, backend kiểm tra uniqueness trong container hiện tại; lesson hiện tại được loại khỏi phép kiểm tra.
- Nếu gửi `sourceDocumentExtractions`, backend validate source document cùng learning path, readiness, thứ tự range và same-source overlap; sau đó tạo/cập nhật/xóa đúng từng mapping và enqueue chunking khi nguồn/range đổi.
- Same-source overlap trả `400` với `error.code = "LESSON_SOURCE_EXTRACTION_OVERLAP"` và details của hai range xung đột.
- Ghi `audit_logs`.

### `PATCH /admin/lessons/:lessonId/move`

Role: `ADMIN`.

Body:

```json
{
  "chapterId": null,
  "targetOrderIndex": 3
}
```

Behavior:

- `chapterId` bắt buộc hiện diện nhưng nhận UUID hoặc `null`. UUID là chapter đích trong cùng learning path; `null` là top-level.
- `targetOrderIndex` là vị trí chèn 1-based. Với chapter đích, vị trí tính trong `chapter.lessons`; với top-level, vị trí tính trong canonical `structureItems` gồm cả chapter và lesson top-level.
- Hỗ trợ move trong cùng container, chapter A sang chapter B, chapter ra top-level và top-level vào chapter.
- Trong một transaction: khóa/đọc structure liên quan, dựng cây sau move, kiểm tra completion guard, compact container nguồn, shift container đích, validate title ở đích và cập nhật `chapter_id`/`order_index`. Response trả lesson sau move; client refetch course detail để nhận `structureItems` mới.
- Completion guard bỏ qua chính lesson đang move, nhưng chặn nếu trong cây kết quả lesson đó đứng trước bất kỳ lesson khác có ít nhất một `lesson_progress.status = COMPLETED`. Trả `409` với `error.code = "LESSON_MOVE_BEFORE_COMPLETED"`, message `Không thể di chuyển trước buổi học đã có học sinh hoàn thành` và details của lesson mốc đầu tiên.
- Admin course detail trả `hasStudentCompletion` trên từng lesson bằng aggregate/existence query, không trả danh sách học sinh hoặc progress nhạy cảm.
- Request sai chapter learning path trả validation error. `targetOrderIndex` hợp lệ theo DTO nhưng lớn hơn độ dài container được chuẩn hóa về vị trí cuối; conflict đồng thời phải rollback toàn bộ và UI refetch trước khi thử lại.
- Ghi `audit_logs` gồm container/vị trí trước và sau.

### `POST /admin/lessons/:lessonId/video-transcript/fetch`

Role: `ADMIN`.

Behavior:

- Đọc `videoUrl` hiện tại của lesson và chỉ chấp nhận URL YouTube.
- Thử lấy caption công khai từ YouTube ở server; ưu tiên tiếng Việt, sau đó fallback sang ngôn ngữ công khai phù hợp.
- Đọc `customVideoSettings`: nếu custom player đang bật, chỉ giữ segment có timestamp nguồn trong khoảng `[startTimeInSeconds, videoDuration - endTimeCutInSeconds)`; nếu custom player bị tắt thì dùng toàn bộ video. Sau khi lọc, response trừ `startTimeInSeconds` để timestamp trả về thuộc trục phát sau cắt bắt đầu tại `0:00`.
- Giữ nguyên từng cue caption theo `offset` và `duration` YouTube trả về; chỉ chuẩn hóa khoảng trắng, bỏ cue rỗng/trùng hệt liền nhau và ánh xạ timestamp về trục phát sau cắt. Không chia cue thành bucket hoặc ước tính timestamp từng từ.
- Không lưu lesson trong request này. Response chỉ trả bản nháp để admin duyệt:

```json
{
  "timeline": "PLAYBACK",
  "language": "vi",
  "isAutoGenerated": true,
  "videoDuration": 1863,
  "playbackStartTime": 5,
  "playbackEndTime": 1841,
  "chapters": [{ "time": 908, "title": "2. Đơn thức đồng dạng" }],
  "segments": [
    {
      "time": 908.275,
      "endTime": 914.6,
      "text": "Thứ hai là đơn thức đồng dạng. Vậy hai đơn thức như thế nào được gọi là hai đơn thức đồng dạng?"
    }
  ]
}
```

- Nếu cấu hình cắt làm khoảng phát rỗng/không hợp lệ, trả `400` với `error.code = "VIDEO_TRANSCRIPT_INVALID_WINDOW"`.
- Không có caption công khai trả `404` với `error.code = "VIDEO_TRANSCRIPT_NOT_AVAILABLE"`.
- URL không phải YouTube trả `400` với `error.code = "VIDEO_TRANSCRIPT_UNSUPPORTED"`.
- Timeout/rate limit/lỗi upstream trả envelope lỗi thống nhất và không xóa transcript đã lưu.

### `DELETE /admin/lessons/:lessonId`

Role: `ADMIN`.

Behavior:

- Soft delete lesson và set status `ARCHIVED`.
- Compact vị trí trong container hiện tại; nếu lesson ở top-level thì compact canonical structure gồm cả chapter và lesson top-level.
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

> **Breaking API đã triển khai (2026-08-19):** M9.2 figure plan v3 đã xóa
> `visualIntent` khỏi mọi request/response/raw Phase 1/provider preview.
> Payload còn key này bị strict validation reject. Không có endpoint hoặc
> serializer đọc contract cũ. Preview/create/worker dùng chung block projection
> theo `.codex/plans/m9-2-remove-visual-intent-hard-cutover-plan.md`.

### `GET /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

Behavior:

- Trả summary hiện tại hoặc `data: null` nếu lesson chưa có summary.
- Không trả summary đã xóa mềm.
- Trả `phaseOneBlockJsonByPath` cho Summary AI sinh bằng contract mới. Mỗi key là
  block path `sections.{sectionIndex}.blocks.{blockIndex}` và value là nguyên
  object structured output mà provider trả ở Phase 1 cho đúng block đó, trước
  mapper và trước khi backend gắn ID/trạng thái hình. Lượt sinh cũ chưa có
  snapshot editable theo block trả `null`.
- Trả `sourcePages[]` cho Summary AI gồm ánh xạ provenance
  `packetPageNumber -> sourceFileId + sourcePdfPageNumber`, kèm tên tài liệu và
  nhãn trang in nếu có. Admin UI dùng ánh xạ này để mở đúng PDF gốc tại các
  `sourcePageNumbers` của từng block; signed URL vẫn lấy qua file API chỉ khi
  modal mở. Summary thủ công hoặc lượt cũ không còn manifest trả mảng rỗng.
- Với mỗi `contentJson.data.sections[].blocks[].figures[]` có
  `kind=TEX_FIGURE`, response gồm `figureId`, `figureOrigin`, `status`, `altText`
  và `caption`. Render plan chuẩn vẫn nằm trong bản ghi STEM figure tương ứng.

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

- Upsert `lesson_summaries` và ghi audit log.
- Giữ `ai_generation_id` khi admin sửa content để không mất provenance.
- Ở mọi trạng thái lưu, mỗi `TEX_FIGURE.figureId` phải còn là figure active thuộc
  đúng Summary hiện tại. Reference từ bản sinh cũ hoặc figure đã xóa bị reject với
  `LESSON_SUMMARY_STEM_FIGURES_INVALID_REFERENCE`; frontend phải refetch và
  reconcile theo đúng `aiGenerationId` trước khi lưu.
- Khi `reviewStatus=APPROVED`, backend thu thập mọi reference
  `visual.kind=TEX_FIGURE`. Tất cả figure phải thuộc đúng lesson, có
  current revision `SUCCEEDED` kèm delivery asset; nếu không, trả
  `LESSON_SUMMARY_STEM_FIGURES_UNRESOLVED`.
- Source TeX và preview SVG không được gửi trong `contentJson`; chúng được quản
  lý qua STEM figure API riêng.

### `PUT /admin/lessons/:lessonId/summary/phase-one-blocks`

Role: `ADMIN`.

Body:

```json
{
  "phaseOneBlockJsonByPath": {
    "sections.0.blocks.0": {}
  },
  "phaseOneLayoutOperations": [
    { "type": "DELETE_BLOCK", "sectionIndex": 0, "blockIndex": 1 },
    { "type": "DELETE_SECTION", "sectionIndex": 2 },
    { "type": "MERGE_SECTION", "sectionIndex": 1 },
    { "type": "MOVE_SECTION", "sectionIndex": 2, "targetSectionIndex": 0 },
    {
      "type": "MOVE_BLOCK",
      "sectionIndex": 0,
      "blockIndex": 1,
      "targetSectionIndex": 1,
      "targetBlockIndex": 0
    }
  ],
  "source": "ADMIN",
  "reviewStatus": "NEEDS_REVIEW"
}
```

Behavior:

- Mặc định chỉ nhận đúng tập block path của snapshot Phase 1 đã lưu. Khi admin
  xóa block, xóa section hoặc xóa heading để gộp section, frontend gửi thêm
  `phaseOneLayoutOperations` theo đúng thứ tự thao tác; backend áp dụng các thao
  tác này lên snapshot trước rồi mới đối chiếu tập path đã được đánh lại.
- `DELETE_BLOCK` xóa đúng block và kéo các block phía sau lên;
  `DELETE_SECTION` xóa section cùng toàn bộ block bên trong rồi kéo các section
  phía sau lên; `MERGE_SECTION` chỉ hợp lệ với section không phải đầu tiên, nối
  toàn bộ block vào section ngay trước rồi đánh lại section/block path. Lịch sử
  layout được lưu cùng snapshot để lần Lưu/tải lại sau không dựng lại block hoặc
  section đã xóa.
- `MOVE_SECTION` và `MOVE_BLOCK` lưu đúng thao tác kéo thả/nút lên-xuống. Chỉ số
  đích được tính trên mảng sau khi phần tử nguồn đã được lấy ra; backend dùng cùng
  thao tác để đánh lại raw block path và `stem_figures.block_path` trong một
  transaction.
- Ghép từng object đã sửa về đúng vị trí trong provider output gốc, validate lại
  bằng strict schema tương ứng với môn và lớp rồi mới map/upsert Summary.
- Cho sửa text, `caption` và provenance hợp lệ của figure đã tồn tại; raw Phase 1
  không có `altText`.
  Không cho thêm/xóa phần tử `figures[]` qua raw;
  thao tác thay đổi số figure phải đi qua STEM figure API/menu ảnh.
- Giữ nguyên figure ID, revision và asset hiện tại. Endpoint không gọi AI
  provider, không enqueue Stage 2/diagram rendering và không tự tạo ảnh mới.
- Figure thuộc block bị xóa được soft-delete; figure thuộc block chỉ đổi vị trí
  được cập nhật `blockPath` trong cùng transaction và giữ nguyên revision/asset.
- Figure đã soft-delete không giữ chỗ unique của một block đang được dịch chuyển;
  tombstone của figure đi theo block nếu block được đổi vị trí, và raw plan tương
  ứng được phép tồn tại mà không dựng lại reference hình trong Summary.
- Chỉ được frontend gọi khi admin bấm `Lưu` hoặc `Phát hành`; thay đổi realtime
  trong preview trước đó chỉ là state cục bộ chưa persist.
- Lượt sinh cũ không có snapshot version 2 trả lỗi
  `LESSON_SUMMARY_PHASE_ONE_RAW_UNAVAILABLE`; admin cần sinh lại Summary để có
  raw editable đầy đủ.

### `DELETE /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

Behavior:

- Xóa cứng summary hiện tại của lesson.
- Cascade xóa các bản ghi STEM figure, revision và render attempt thuộc summary;
  file asset đã upload không bị API này tự xóa khỏi storage.
- Ghi audit log `LESSON_SUMMARY_DELETED` với snapshot nội dung trước khi xóa.
- Trả `{ "deleted": true }`; nếu lesson không có summary thì trả `{ "deleted": false }`.

### `POST /admin/lessons/:lessonId/summary/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "documentIds": ["uuid"],
  "style": "student_friendly",
  "styleInstructions": "Dễ hiểu, gần gũi, sử dụng cách diễn đạt và mức độ chi tiết phù hợp lứa tuổi.",
  "length": "standard",
  "targetWordCount": 350,
  "extraInstructions": "Dùng câu ngắn",
  "systemInstructions": "System instructions đã được admin kiểm tra",
  "userPrompt": "User prompt đã được admin kiểm tra",
  "model": "gpt-4.1-mini",
  "temperature": 0.2,
  "reasoningEffort": "medium",
  "maxOutputTokens": 8000,
  "useTextbookSourceImages": false,
  "autoEnhanceTextbookSourceImages": false
}
```

Rules:

- `documentIds` là `lesson_documents.id`, bắt buộc unique và thuộc đúng
  `lessonId` trên URL.
- Mọi document phải active, `READY`, trỏ tới canonical PDF searchable đã pass
  readiness và có page range hợp lệ; API không nhận raw PDF/text từ client.
- `requestDraftId` và `requestHash` từ prompt-preview là bắt buộc ở generate.
  Draft phải chưa hết hạn/chưa consume và còn khớp source + generation config.
- `useTextbookSourceImages` là boolean optional, mặc định `false`, và phải là một
  phần của request draft/hash/job snapshot. Field này chỉ điều khiển hậu xử lý
  figure sau khi Phase 1 đã validate/map thành công; service Phase 1 không được
  branch theo field này. Không được nối field vào PDF packet, manifest,
  system/user prompt, provider JSON Schema/request, validation hoặc mapper Phase 1.
- `autoEnhanceTextbookSourceImages` là boolean optional, mặc định `false`, chỉ có
  hiệu lực khi `useTextbookSourceImages=true` và cũng thuộc request
  draft/hash/job snapshot. Backend chuẩn hóa cờ này về `false` nếu cờ cha tắt;
  field không được đi vào PDF packet, prompt, provider schema/request hay mapper.
- Nếu cùng lesson đang có job summary `QUEUED`/`RUNNING`, API trả lại `jobId`
  đó thay vì enqueue provider call thứ hai.
- Sau khi job terminal `SUCCEEDED`/`FAILED`, admin có thể yêu cầu regenerate.
- `style` nhận `student_friendly | concise | academic`; `length` nhận
  `short | standard | detailed`. Các field còn lại là cấu hình theo lần chạy;
  `model` chỉ được chọn trong route `SUMMARY` đang khả dụng.
- `styleInstructions` là nội dung trình bày tự do. `systemInstructions` và
  `userPrompt` cho phép admin
  sửa prompt của lần chạy, nhưng PDF packet + manifest vẫn do server dựng và
  snapshot trong request draft, không nhận raw context từ client. `systemInstructions` cho phép
  tối đa `64.000` ký tự để nhận lại prompt hiệu lực từ preview; `userPrompt` tối
  đa `16.000` ký tự.
- Contract Summary giữ `systemInstructions`/`userPrompt` là phần prompt admin có
  thể thay thế và round-trip giữa preview/generate. Modal luôn điền prompt mặc
  định đầy đủ để admin xem trước. Khi admin sửa, toàn bộ nội dung hiện có trong
  từng ô được gửi nguyên văn; server không cắt, khôi phục hoặc nối thêm subject
  profile, yêu cầu hình hay một prompt ẩn nào khác. UI không cho gửi hai ô rỗng.
- `targetWordCount` không bắt buộc, giới hạn `50..5000`, biểu thị số từ mục
  tiêu gần đúng và được kết hợp với `length` trong đúng một mục `Độ dài` khi
  dựng user prompt; không xuất thành hai dòng chỉ dẫn rời nhau.
- `temperature` giới hạn `0..1`; `reasoningEffort` nhận một trong các mức chuẩn
  `none | minimal | low | medium | high | xhigh | max`, nhưng danh sách option
  thực tế và validation phải lấy từ `capabilities.reasoningEffortLevels` của đúng
  model do admin thiết lập tại màn Cài đặt AI; `maxOutputTokens` giới hạn
  `8000..32000`. Bỏ trống thì dùng Cài đặt AI hiện tại với sàn mặc định `8000`
  cho Summary.

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

- Tạo `background_jobs` queue `AI_GENERATION` và `ai_generations` type
  `SUMMARY`.
- Worker validate structured output năm block. Mỗi section gồm `UNIT` (theory +
  example bắt buộc) hoặc `NOTE`; theory/note/example có provenance trang nguồn,
  example có origin và solution bắt buộc. Provider không được sinh `procedure`.
- Example Toán có `isGeometry`; schema theo lớp bắt buộc GT–KL cho Hình học lớp
  7–9 và bắt buộc `geometryStatement=null` cho lớp 10–12/các nội dung không phải
  Hình học.
- Figure coverage dựa quan hệ hình nguồn ở phía trước/phía sau block trong PDF,
  không dựa title/keyword và không có semantic coverage gate backend. Provider
  trả semantic brief; backend cấp ID deterministic và resolve ảnh tham chiếu.
- Sau khi validate/map, worker upsert Summary
  `source=AI/reviewStatus=NEEDS_REVIEW` với content contract version 3.
- Khi sinh lại, worker xóa cứng toàn bộ STEM figure, revision và render attempt
  thuộc bản Summary trước rồi mới tạo figure của bản mới; bản content cũ bị thay
  thế trong cùng transaction, vì vậy chỉ còn bản sinh mới nhất.
- Khi `useTextbookSourceImages=false`, mỗi provider `figure` tạo một
  `stem_figures` row và một `DIAGRAM_RENDERING` job; content block chỉ giữ
  reference `TEX_FIGURE` như luồng mặc định hiện tại.
- Khi `useTextbookSourceImages=true`, worker tuyệt đối không enqueue
  `DIAGRAM_RENDERING` và không gọi provider Phase 2. Với figure
  `TEXTBOOK_SOURCE`, toàn bộ asset `OCR_CROP` usable thuộc tập khớp chắc chắn
  được tách thành các figure cùng block theo thứ tự resolver, tải, kiểm
  MIME/kích thước, chuẩn hóa WebP, copy sang file delivery riêng và tạo current
  revision `SUCCEEDED` theo cùng invariant của `use-source-crop`. Không dùng trực
  tiếp object OCR làm delivery. Nếu không có crop, có nhiều candidate mơ hồ hoặc
  chỉ có `PDF_PAGE`, figure giữ `NEEDS_REVIEW`, không tự lấy candidate đầu tiên.
  Figure `GENERATED_FROM_BRIEF` không được materialize thành active reference vì
  chế độ này chỉ dùng hình thật có trong SGK; raw Phase 1 vẫn giữ nguyên để audit.
- Khi `autoEnhanceTextbookSourceImages=true`, từng crop chắc chắn phải chạy
  `TEXTBOOK_RASTER_CLEANUP_V2` trước khi upload delivery và được encode WebP
  lossless. Metadata file ghi pipeline/operation; crop xử lý lỗi chuyển
  `NEEDS_REVIEW`, không fallback sang bản chưa làm nét. Job result trả thêm
  `sourceFigureEnhancedCount`.
- Kết quả job ở chế độ ảnh gốc trả các counter
  `sourceFigureImportedCount`, `sourceFigureNeedsReviewCount`,
  `generatedFigureSkippedCount` và `phaseTwoEnqueuedCount=0` để UI giải thích
  đầy đủ, không coi Summary thành công là mọi ảnh đã tự điền thành công.
- Render worker kiểm core fragment, ghép compiler envelope/toolbox theo
  `subjectKey`, rồi chạy LuaLaTeX -> dvisvgm -> SVG validator.
- Chỉ lỗi compiler `TEX_COMPILE_FAILED` có diagnostic batch đầy đủ mới tự gọi
  OpenAI repair tối đa theo `maxRepairAttempts`; request repair phải gửi toàn bộ
  structured errors và raw compiler log của đúng lượt đó. Source policy,
  validator, provider, timeout, network, storage và lỗi hạ tầng không tự retry.
- SVG hợp lệ được sanitize rồi promote atomically lên R2; source editor có đường
  draft compile/apply riêng để admin kiểm tra preview trước khi thay asset hiện hành.
- Server lấy target grade từ learning path và prompt bắt buộc hỗ trợ lớp 3–12.
- Server lấy môn từ `learning_path.domain`, snapshot `subjectKey`/`subjectName`/
  `subjectSlug` vào job/figure và chỉ ghép profile đúng môn. Toán, Vật lý và Hóa
  học không nhận chéo rule/toolbox; AI không được tự khai package/library.
- Figure luôn `theme=LIGHT`; không tạo dark variant.
- Quiz/Flashcard/Test/Explanation/Chat không dùng pipeline figure trong task này.

### `POST /admin/lessons/:lessonId/summary/prompt-preview`

Role: `ADMIN`.

Body dùng cùng cấu hình nội dung/source như endpoint `generate-ai`; response trả
thêm `requestDraftId` và `requestHash`. Generate bắt buộc gửi lại đúng hai giá trị
này, không tự dựng một request khác ở thời điểm enqueue.

Behavior:

- Dùng cùng packet builder, schema và prompt builder với worker để trả đúng
  `systemPrompt`, `userPrompt`, PDF packet, manifest và cấu hình model.
- `useTextbookSourceImages` không đổi provider input Phase 1. Preview vẫn phải
  snapshot field này và trả breakdown cho biết Phase 2 dự kiến bằng `0` khi bật;
  request OpenAI Phase 1 hiển thị phải giống hệt khi field này tắt nếu các cấu
  hình nội dung khác không đổi. Có thể hiển thị mode hậu xử lý ngoài provider
  request, nhưng không được serialize field vào Files API hoặc Responses API.
- `autoEnhanceTextbookSourceImages` có cùng nguyên tắc snapshot và provider
  isolation; bật/tắt cờ này không được làm thay đổi `openAiFileUploadRequest`,
  `openAiRequest`, system prompt hoặc user prompt.
- `systemPrompt`/`userPrompt` trả về là prompt hiệu lực để FE xem. Khi request gửi
  giá trị khác rỗng, server dùng nguyên văn giá trị đó làm toàn bộ prompt tương
  ứng. Nếu field rỗng/không có, server mới dựng prompt mặc định đầy đủ. Preview
  và worker dùng chung builder; không có bước nối prompt sau preview.
- Trả thêm `openAiFileUploadRequest` là biểu diễn tuần tự hóa của multipart
  request lên Files API (`purpose=user_data` và File gồm tên, MIME type, số byte;
  binary được thay bằng placeholder) cùng `openAiRequest` là body Responses API
  với đúng các field `model`, `instructions`, `input` gồm `input_file`
  `detail=high` + manifest text, `text.format`, `temperature` hoặc `reasoning`,
  `max_output_tokens`;
  khi cấu hình Summary bật cache còn có `prompt_cache_key` và
  `prompt_cache_retention`. `text.format` phải chứa đúng structured-output name,
  strict mode và JSON Schema mà provider sử dụng. Đây phải là payload xem trước
  đầy đủ sau khi server ghép context, không phải object gần giống request thật và
  không chứa credential. Vì endpoint preview không gọi provider, `file_id` dùng
  placeholder mô tả ID do Files API trả ở runtime. Các field nội bộ/UI như
  `packetHash`, `inputTextItems.id` và filename không được giả lập trong body
  Responses API; chúng chỉ nằm ở context audit hoặc request upload tương ứng.
- Trả số document/page, byte/hash packet, model/provider thực tế, temperature,
  giới hạn output và danh sách model khả dụng. Token input được tách thành
  `textInputTokens`, `pdfInputTokens` và `estimatedTokens` (tổng hai phần); PDF
  chỉ là estimate trước khi gọi provider, không phải usage đã thanh toán.
- `estimatedCost` tách `inputUpperBoundUsd/Vnd`,
  `outputUpperBoundUsd/Vnd` và `upperBoundUsd/Vnd` tổng. Input dùng tổng token
  text + PDF ước tính; output dùng `maxOutputTokens`, nên nhãn UI phải nói rõ
  output và tổng là mức tối đa.
- `context` trả `lessonTitle`, ordered packet page mapping và model manifest để UI
  gắn từng trang về đúng document/range/page nguồn; Summary request không còn gửi
  OCR chunks/sourceTopics/sourceCandidates.
- `context.tokenBreakdown` tách phần text thành quy tắc hệ thống, câu lệnh người
  dùng, nội dung/context text, manifest/text kỹ thuật và JSON Schema; đồng thời
  trả riêng PDF và tổng input. Các số là estimate phục vụ review/cost, không phải
  usage provider đã thanh toán.
- Chỉ dựng dữ liệu xem trước trong API; không tạo job, không gọi OpenAI/Gemini,
  không ghi usage và không phát sinh chi phí provider.
- Không trả API key, secret hoặc credential provider.

### Searchable PDF validation/promote API

Role: `ADMIN`.

- `POST /admin/source-documents/:id/searchable-pdf/validate`: nhận
  `candidateFileId`, chạy equivalence toàn tài liệu và lưu report/contact sheet có
  TTL; không gọi paid OCR.
- `GET /admin/source-documents/:id/searchable-pdf/validation/:validationId`: trả
  status, metrics, warnings/failures và signed contact-sheet URL.
- `POST /admin/source-documents/:id/searchable-pdf/promote`: nhận validation id và
  optional `acceptWarnings`; atomically đổi canonical file khi checksum/source
  vẫn fresh, giữ active OCR artifact/page/chunk lineage.

### STEM figure review API

Role cho toàn bộ endpoint: `ADMIN`.

- `GET /admin/lessons/:lessonId/stem-figures`: danh sách figure, source, trạng
  thái, preview/asset URL và lỗi gần nhất của lesson. Mỗi item trả
  `figureOrigin=TEXTBOOK_SOURCE | GENERATED_FROM_BRIEF` từ render plan v3 đã
  qua Zod. Dữ liệu plan thiếu/không đọc được trả `null`.
  Response admin còn trả `currentRevisionOrigin=INITIAL_AI | AUTO_REPAIR |
ADMIN_EDIT | ADMIN_REGENERATE | ADMIN_UPLOAD | MANUAL_REPAIR | null` từ
  revision đang sở hữu asset hiển thị; client dùng provenance này thay vì suy từ
  `AI_TEX` để phân biệt hình AI ban đầu với hình admin đã tạo/sửa/thay.
  `planJson` vẫn chứa nguyên `sourceReferences` Phase 1 để JSON review admin có
  thể chiếu đúng trang, nhãn hình và `sourceTarget` mà không sao chép provenance
  này vào `lesson_summaries.content_json`.
- `GET /admin/lessons/:lessonId/stem-figures/:figureId`: chi tiết một figure.
- `POST /admin/lessons/:lessonId/stem-figures/blocks/ensure`: nhận `blockPath`,
  trả logical figure đang hoạt động hoặc phục hồi/tạo một draft figure chưa gắn
  vào Summary. Endpoint dùng chung cho menu ảnh cấp block; draft chỉ được gắn
  vào block sau khi upload/apply/render thành công nên không tạo placeholder chờ.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/drafts/compile`: nhận
  `baseRevisionId`, `sourceVersion`, `latexSource`, `altText`, optional `caption`;
  compile local không gọi AI và trả revision `DRAFT_READY` kèm `previewSvg` đã
  sanitize, hoặc một diagnostic batch nếu compile/validator không đạt.
- `latexSource` của draft chỉ nhận LaTeX figure snippet gồm optional local
  header allowlist (`\usetikzlibrary`, `\usepgfplotslibrary`, `\tikzset`,
  `\pgfplotsset` không đổi `compat`, `\tdplotsetmaincoords`) rồi đúng một
  `tikzpicture`, hoặc một `circuitikz` với profile Vật lý. Library phải thuộc
  versioned toolbox manifest của môn; cấm `documentclass`, `usepackage`, font,
  document wrapper và compiler preamble. Source phải pass policy trước khi tạo
  revision/compile. Standalone source cũ bị reject; không có compatibility path.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/drafts/apply`: nhận
  `baseRevisionId`, `revisionId`, `sourceVersion`, `altText`, optional `caption`.
  Nếu `revisionId` là revision hiện hành, endpoint chỉ cập nhật metadata và
  Summary reference mà không biên dịch hoặc upload lại ảnh. Nếu là revision
  `DRAFT_READY`, endpoint promote atomically revision còn khớp current revision
  và áp dụng metadata mới nhất do admin nhập. Client được gửi `caption=null` hoặc
  chuỗi rỗng; backend chuẩn hóa cả hai thành `null`, nên thao tác xóa caption là
  hợp lệ và vẫn giữ nguyên asset/source hiện hành.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/retry`: force enqueue
  lại từ diagnostic batch mới nhất, trả `202`.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/create-new-ai/preview`:
  nhận mutation guard, `referenceImageMode`, optional `adminInstructions`,
  `model`, `temperature`, `reasoningEffort`, `systemPrompt`, `userPrompt`; dựng
  đúng generation brief, signed preview của các ảnh và toàn bộ request OpenAI sẽ
  gửi ở Stage 2 nhưng không tạo revision, không enqueue và không gọi provider.
  `model` phải thuộc catalog còn khả dụng; `temperature`/`reasoningEffort` chỉ
  hợp lệ theo capability của model đã chọn. Response trả riêng `systemPrompt`,
  `userPrompt`, cấu hình đã resolve, token text/ảnh ước tính và chi phí input,
  output, tổng tối đa bên cạnh `providerInput`.
  `providerInput` phải gồm provider/model đã resolve, system instructions, user
  input, ảnh theo đúng thứ tự (phần byte nhị phân được ẩn khi hiển thị),
  `text.format`/JSON Schema, reasoning hoặc temperature và giới hạn output token.
  Khi `adminInstructions` có nội dung, provider request phải thể hiện ảnh và
  field này là hai nguồn thẩm quyền duy nhất, ngang hàng theo phạm vi: ảnh khóa
  baseline, field khóa đúng phần sửa đổi/bổ sung. Request phải áp dụng delta và
  giữ nguyên mọi phần ảnh ngoài delta; block sở hữu không được ghi đè nguồn nào.
  Yêu cầu mơ hồ không cho phép thiết kế lại toàn hình. Safety,
  structured-output schema, TeX allowlist/compile contract và tính đúng nội tại
  vẫn là invariant không thể ghi đè. Khi field rỗng hoặc chỉ có khoảng trắng,
  serializer phải bỏ key và system/user prompt mặc định không được nhắc tới yêu
  cầu sửa đổi/bổ sung. Preview không được mô tả field như preference phụ.
  JSON chuyên vẽ chỉ giữ grade và projection của đúng block sở hữu hình; không
  ghép theory đứng trước. Với example,
  projection chỉ giữ `problem`, `isGeometry` và hypotheses GT–KL khi có; không
  gửi `solution`, `answer` hoặc conclusions. Không gửi lesson title hoặc section
  heading. Chỉ khi thực sự có
  ảnh mới gửi `reference: { mode, images }`; khi không ảnh, gửi
  `reference: { mode: "NONE" }` và bỏ `images` thay vì gửi mảng rỗng. Không có
  checklist semantic song song. `SOURCE_CROP_ONLY` thêm `sourceTarget` cạnh
  từng ảnh; `CURRENT_ONLY` cũng gửi target của ảnh sách và thêm
  `currentLatexSource`, còn `NONE` không gửi locator SGK. Preview không lặp source
  reference, số trang, object key, hash, lifecycle metadata hoặc
  precedence. Preview chỉ được gọi khi admin bấm
  `Xem dữ liệu`, không tự refetch khi đổi lựa chọn ảnh hay nhập yêu cầu.
  UI không dựng thêm một khối `adminInstructions` ngoài request: giá trị này chỉ
  xuất hiện đúng vị trí đã được serialize trong user prompt. `providerInput` và
  provider thật dùng chung serializer; binary ảnh là ngoại lệ duy nhất được thay
  bằng placeholder ở preview.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/create-new-ai`: nhận cùng
  payload preview rồi tạo revision AI mới. `referenceImageMode` là một trong
  `SOURCE_CROP_ONLY`, `CURRENT_ONLY`, `NONE`; mỗi request gửi tối đa một nhóm ảnh
  sách giáo khoa. `SOURCE_CROP_ONLY` không gửi code revision hiện tại;
  `CURRENT_ONLY` gửi thêm source TeX/TikZ của current revision và không gửi
  delivery asset hiện hành. `NONE` chỉ dùng khi khối không có ảnh phù hợp và
  không hiển thị như một lựa chọn ảnh thứ ba. Backend tự resolve crop nguồn mới
  nhất và tự lấy current source, không tin object key hoặc code do client gửi.
  Route model và hai prompt đã chỉnh được snapshot vào durable job; worker phải
  dùng đúng snapshot đó nên request tạo thật không được tự quay lại cấu hình hoặc
  prompt mặc định khác với lần admin đã xem.
  Compiler repair sau lượt tạo chỉ được sửa lỗi source kỹ thuật và phải bảo toàn
  cả baseline ảnh lẫn delta `adminInstructions`; không được hoàn tác delta hoặc
  thiết kế lại phần ảnh không được nhắc.
  Khi field rỗng, request repair cũng không được thêm câu nói về yêu cầu admin.
  Mỗi source reference có nhãn gửi tối đa bốn OCR crop khớp chính xác khác object
  key để bảo toàn figure nhiều panel; provider brief phải khai báo `panelCount`
  đúng bằng số ảnh và invariant một ảnh/một panel. Nhãn mơ hồ chỉ chọn một crop tốt nhất.
  Reference không có nhãn hình cụ thể, hoặc nhãn không khớp crop đáng tin cậy,
  phải resolve ảnh nguyên trang PDF làm fallback; metadata trang chỉ dùng nội bộ
  và không gửi lặp trong provider-facing JSON.
  Full-page fallback chỉ hợp lệ khi figure có `sourceReferences` từ Stage 1.
  Resolver chỉ dùng `sourceReferences.figureLabel` và `sourceTarget.locator` để
  rank crop hoặc định vị hình con.
  `blocks/ensure` cho figure do admin thêm vào block chưa từng có hình phải tạo
  `sourceReferences=[]`, không suy reference từ trang nội dung của block/section.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/use-source-crop`: nhận
  mutation guard, `sourceSnapshotHash`, `sourceObjectKey` và boolean `enhance`; chỉ
  chấp nhận đúng
  asset `OCR_CROP` thuộc immutable reference snapshot đã resolve cho logical
  figure (head hoặc fallback lịch sử với dữ liệu cũ). Backend tải, kiểm
  MIME/kích thước. `enhance=false` promote crop qua luồng chuẩn hóa raster hiện
  có; `enhance=true` chạy thêm preset local `TEXTBOOK_RASTER_CLEANUP_V2`, encode
  WebP lossless và ghi metadata `ENHANCE` trước khi promote. Cả hai nhánh lưu file
  `AI_DIAGRAM` riêng và atomically tạo revision `ADMIN_UPLOAD` thành công. Nếu
  validate/xử lý/upload lỗi, current revision không đổi. Endpoint không gọi
  provider, không tự retry và không cho dùng ảnh toàn trang fallback như một crop.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/raster-edits/preview`:
  nhận multipart gồm `baseCurrentRevisionId`, `baseSourceVersion`, JSON operation
  `{ enhance, removeSimpleDetails, pipelineVersion }` và optional PNG mask khi
  bật xóa. Backend tự resolve delivery asset hiện hành, chỉ nhận asset
  `TEXTBOOK_SOURCE`/`SUCCEEDED`, xử lý bản preview có cạnh dài tối đa `1600px` và
  trả `previewDataUrl`, kích thước, warnings, mask coverage/background variance.
  Endpoint không tạo File/revision, không ghi R2 và không gọi provider.
- `POST /admin/lessons/:lessonId/stem-figures/:figureId/raster-edits/apply`:
  nhận cùng mutation guard/operation/mask. Backend kiểm MIME, decoded dimensions,
  pixel/byte cap, mask dimensions/coverage/components và độ đồng nhất vòng nền
  quanh vùng tô; scale mask về kích thước gốc bằng nearest-neighbor. Request chỉ
  được bật đúng một operation. Output WebP lossless tạo File/revision mới rồi chỉ
  promote khi toàn bộ validation/storage thành công; request kế tiếp luôn resolve
  delivery asset của current revision mới này làm input.
  Mask chạm mép được xem là mask đã clip theo biên ảnh và không bị từ chối chỉ vì
  chạm cạnh; service lấy mẫu nền từ phần vòng còn nằm trong ảnh. Vùng trong ảnh
  vẫn phải qua coverage/bounding-box cap, minimum background samples và variance
  gate như mọi mask khác.
  Request stale, nền phức tạp, mask quá lớn hoặc output lỗi giữ nguyên current
  revision. Response trả figure/revision hiện hành mới và audit id; client có thể
  giữ modal mở và dùng chính figure response làm guard/input cho request preview
  hoặc apply kế tiếp mà không cần đóng rồi mở lại editor.

`pipelineVersion` hiện hành là `TEXTBOOK_RASTER_CLEANUP_V2`. Preset enhance v2
giữ denoise/contrast/sharpen của v1 và thêm saturation `1.06` để màu đậm hơn nhẹ,
không hạ brightness toàn ảnh.
Chính xác một operation phải bật; mask bắt buộc khi
`removeSimpleDetails=true` và bị cấm khi false. Client
không được gửi object key, signed URL hay source bytes làm authority. Service
giới hạn vùng xóa nhỏ trên nền gần đồng nhất và trả error code ổn định
`STEM_FIGURE_RASTER_EDIT_UNSUPPORTED`, `STEM_FIGURE_RASTER_MASK_INVALID`,
`STEM_FIGURE_RASTER_BACKGROUND_COMPLEX` hoặc conflict stale revision; không
content-aware inpainting, không phục hồi đường/texture và không rasterize
`AI_TEX`. Apply ghi audit `STEM_FIGURE_RASTER_EDIT_APPLIED` nhưng không lưu mask
thô; metadata output giữ revision nguồn, pipeline, operation summary và
provenance `TEXTBOOK_SOURCE`.

Admin figure response có `sourceReferenceSnapshotHash` và
`sourceReferenceImages[]` kèm signed preview URL, nhãn/trang/vai trò/nguồn và
`canUseAsFigure`. Object key do client gửi không được tin cậy độc lập; API luôn
đối chiếu lại với snapshot và revision guard để chặn stale/wrong-crop selection.
Revision mã code/upload mới phải kế thừa immutable snapshot. Với dữ liệu cũ có
head revision thiếu snapshot, response admin và mutation `use-source-crop` cùng
resolve revision lịch sử gần nhất có snapshot để UI không hiển thị khác với
validation backend.
Request trace được lưu ngay khi provider request đã resolve, trước bước reserve
ngân sách, nên lần tạo gần nhất vẫn có thể được mở lại để Edit kể cả khi request
bị budget gate chặn trước lúc gửi provider.

Source editor chỉ nhận preview SVG. Không có PDF response/artifact, SyncTeX,
edit-session hoặc API locate-source.

Mỗi `TEX_FIGURE` trong Summary content JSON mới phải có `figureOrigin`:
`TEXTBOOK_SOURCE` khi Stage 1 xác nhận PDF có hình và trỏ ít nhất một
`sourceReferences`, hoặc `GENERATED_FROM_BRIEF` khi figure được dựng mới từ
semantic brief và `sourceReferences=[]`. Provider Stage 1 bắt buộc trả field này,
backend validate quan hệ giữa hai field và client không được tự khai/chỉnh nó.
Reader vẫn chấp nhận Summary/plan cũ chưa có field, còn API/UI admin suy fallback
từ `planJson.sourceReferences` khi cần để JSON cũ cũng đọc được provenance.

Không endpoint nào trả source/preview cho student.

### `GET /student/lessons/:lessonId/summary`

Role: `STUDENT`.

Behavior:

- Kiểm tra enrollment hoặc trial.
- Trả Summary đã được phép xem. Mỗi `TEX_FIGURE` chỉ được hydrate khi figure
  có current revision `SUCCEEDED` kèm delivery asset; response có `assetUrl`,
  alt/caption và không có source/preview.

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
- Chỉ backend tạo sau khi SVG Summary qua validator local hoặc ảnh thay thế do
  admin upload qua endpoint figure chuyên biệt.
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

- Trả danh sách page records: `pageNumber`, `printedPage` (`pdfPageNumber`, `printedPageNumber`, `printedPageLabel`, `source`, `confidence`, `warning`), `status`, `textSource`, `ocrProvider`, `artifactKey` hoặc artifact status nếu có, `qualityScore`, `thumbnailFileId`, `hasVisualAssets`/`visualAssetCount` nếu có, `imageManifestKey`/visual refs, `artifactAuditKey`/audit status nếu có, text preview ngắn, `orderedContent` và `ocrImages[]`.
- `orderedContent` giữ nguyên luồng text/table/figure/caption theo thứ tự Mathpix trả về cho từng trang. Backend chỉ thay URL ảnh provider/public cũ bên trong luồng bằng signed URL ngắn hạn của object nội bộ; không được tách ảnh ra rồi nối gallery ở cuối trang.
- `ocrImages[]` là metadata ảnh đã sắp theo thứ tự trên trang để debug/consumer chuyên biệt. Mỗi ảnh trả `imageId`, caption/kind/mime type và signed `url`; API chỉ ký object key thuộc đúng source document đang được admin truy cập. UI preview chính phải render `orderedContent`, không dùng `ocrImages[]` để tự suy đoán vị trí ảnh.
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

### `GET /admin/lessons/:lessonId/ai-generation-panel`

Role: `ADMIN`.

Behavior:

- Trả readiness của lesson cho Summary và cho nội dung cần embedding, toàn bộ
  lesson document active, cùng job mới nhất của `SUMMARY`, `QUIZ`, `FLASHCARD`,
  `TEST`. Mỗi document có `status`, `chunkCount`, `canUseForSummary` và
  `unavailableReason`. Document được tạo từ khối trích xuất có thêm `pageRange`
  dạng `{ pageStart, pageEnd }` theo số trang in đã xác nhận; nếu metadata trang
  in chưa có thì từng đầu mút fallback về số trang PDF. Document upload trực tiếp
  trả `pageRange = null`.
  UI vẫn hiển thị tài liệu chưa sẵn sàng nhưng không cho chọn để tạo Summary.
- `lesson.targetGrade` trả khối lớp ưu tiên của learning path (hoặc `null`) để UI
  dựng mặc định cách trình bày theo đúng đối tượng khóa học.
- `summaryConfiguration` trả cấu hình mặc định và danh sách model Summary hỗ trợ
  PDF `detail=high` độc lập với endpoint prompt-preview. Vì vậy lỗi dựng packet
  hoặc preview không được làm dropdown model biến mất.
- `canUseForSummary` dùng cùng điều kiện packet với endpoint prompt-preview:
  tài liệu trích xuất phải có đủ source document và page range; PDF nền tảng tải
  trực tiếp không có hai liên kết này vẫn hợp lệ và dùng toàn bộ các trang.
- Mỗi job chỉ trả trạng thái durable, `jobId`, resource đích, review status,
  lỗi, timestamps và metadata accounting tối thiểu để UI khôi phục/polling sau
  reload. `estimatedCostVnd` là tổng chi phí đã ghi nhận của toàn lần sinh;
  `usageEventCount` là số lượt gọi provider cấu thành tổng đó, không phải số job.
- Không trả chunk text, prompt, `inputMeta`, structured output hay provider
  payload. Student/Parent không được truy cập endpoint.

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

```
