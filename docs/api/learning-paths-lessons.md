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

### `GET /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

Behavior:

- Trả summary hiện tại hoặc `data: null` nếu lesson chưa có summary.
- Không trả summary đã xóa mềm.

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
- Giữ `ai_generation_id` hiện có để không mất provenance khi admin review/sửa
  một summary vốn được AI tạo.
- `NEEDS_REVIEW` vẫn lưu được khi block có `reviewIssues`; issue không khóa sửa,
  thêm, xóa hoặc sắp xếp block.
- Khi lưu, backend kiểm lại fingerprint đúng field/hình đích. Issue đã được sửa
  hết tự biến mất; acceptance cũ không còn hiệu lực nếu target đã thay đổi.
- Trong `visual.spec.labels`, nhãn bị xóa field `text` hoặc có `text` chỉ gồm
  khoảng trắng được hiểu là admin đã xóa nhãn: backend loại cả phần tử nhãn đó
  trước khi validate và lưu. Quy tắc này không bỏ qua lỗi tọa độ, cạnh hoặc marker
  thật còn lại trong cùng sơ đồ.
- Các text trình bày optional khác (`point.label`, chữ của ký hiệu góc và
  `caption`) bị xóa hoặc để trắng được chuẩn hóa thành `null`; `labelPosition`
  bị xóa cũng được hiểu là chưa chọn vị trí. Những trường hợp này không làm hình
  lỗi vì phần hình học vẫn dựng được.
- `APPROVED` bị từ chối với mã `LESSON_SUMMARY_REVIEW_REQUIRED` nếu còn issue
  chưa được sửa hoặc chấp nhận. Response `details.issues[]` trả `code`, `path`,
  `message`, `suggestion` để admin biết cách xử lý.
- Issue được chuẩn hóa với resolution `ACCEPT_OR_FIX | FIX_ONLY`. Hard issue như
  `DIAGRAM_CANNOT_RENDER`/`BLOCK_CANNOT_PROCESS` luôn bị ép `accepted=false`, nên
  payload client không thể đánh dấu chấp nhận để vượt publish guard.
- `Xóa hình lỗi` không có endpoint riêng: frontend chỉ bỏ visual + issue trong
  bản nháp local; request `PUT` này chỉ phát sinh khi admin bấm `Lưu nội dung`.

### `POST /admin/lessons/:lessonId/summary/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "documentIds": ["uuid"],
  "style": "student_friendly",
  "styleInstructions": "Dễ hiểu cho học sinh khối 7.",
  "length": "standard",
  "targetWordCount": 350,
  "extraInstructions": "Dùng câu ngắn",
  "systemInstructions": "System instructions đã được admin kiểm tra",
  "userPrompt": "User prompt đã được admin kiểm tra",
  "model": "gpt-4.1-mini",
  "temperature": 0.2,
  "reasoningEffort": "medium",
  "maxOutputTokens": 8000
}
```

Rules:

- `documentIds` là `lesson_documents.id`, bắt buộc unique và thuộc đúng
  `lessonId` trên URL.
- Mọi document phải active, `READY` và có chunks; API không nhận raw PDF/text.
- Nếu cùng lesson đang có job summary `QUEUED`/`RUNNING`, API trả lại `jobId`
  đó thay vì enqueue provider call thứ hai.
- Sau khi job terminal `SUCCEEDED`/`FAILED`, admin có thể yêu cầu regenerate.
- `style` nhận `student_friendly | concise | academic`; `length` nhận
  `short | standard | detailed`. Các field còn lại là cấu hình theo lần chạy;
  `model` chỉ được chọn trong route `SUMMARY` đang khả dụng.
- `styleInstructions` là nội dung trình bày tự do. `systemInstructions` và
  `userPrompt` cho phép admin
  sửa prompt của lần chạy, nhưng context chunks vẫn do server tải và ghép sau
  user prompt, không nhận raw context từ client. `systemInstructions` cho phép
  tối đa `64.000` ký tự để nhận lại prompt hiệu lực từ preview; `userPrompt` tối
  đa `16.000` ký tự.
- `targetWordCount` không bắt buộc, giới hạn `50..5000`, biểu thị số từ mục
  tiêu gần đúng và được kết hợp với `length` khi dựng user prompt.
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

- Tạo `background_jobs` queue `AI_GENERATION`.
- Tạo `ai_generations` type `SUMMARY`.
- Enqueue AI generation job.
- Worker upsert summary với `source = AI`, `reviewStatus = NEEDS_REVIEW` và
  `aiGenerationId` để admin review trước khi student nhìn thấy.
- Worker parse bằng transport schema rồi kiểm acceptance theo từng block. Block
  hợp lệ được giữ nguyên; block/hình chưa đạt nhưng còn render an toàn vẫn được
  lưu kèm `reviewIssues`; chỉ phần không thể render an toàn mới thành placeholder
  cục bộ. Summary vẫn `NEEDS_REVIEW` và các block khác vẫn hiển thị.
- Hình còn structural-safe nhưng có lỗi semantic dùng `DIAGRAM_NEEDS_REVIEW` và
  vẫn render; chỉ hình không tạo được spec an toàn mới dùng
  `DIAGRAM_CANNOT_RENDER`/`FIX_ONLY`.
- Recovery không xóa điểm, cạnh hay đường cong chỉ vì thiếu tên điểm dựng, thiếu
  vạch chia hoặc chưa đạt một quy ước trình bày. Các phần hình học đó vẫn hiển thị
  kèm `DIAGRAM_NEEDS_REVIEW`. Chỉ nét tham chiếu tới điểm không tồn tại bị bỏ;
  nếu sau đó không còn nét nào có thể vẽ thì mới dùng placeholder hình lỗi.
- Chỉ root JSON không đọc được/không xác định được ownership section-block,
  source stale hoặc lỗi provider/hạ tầng mới làm toàn job thất bại.
- Một thao tác tạo chỉ có một provider attempt; không tự retry, fallback hay gọi
  AI sửa block. Admin chấp nhận/sửa issue là thao tác local và không tốn provider.
- Contract v3 không đổi endpoint/body generation và trả
  `contentJson.type=lesson_summary_blocks`, `version=2`. Example mới chỉ lưu đề,
  lời giải, đáp án và chỉ có visual khi thật sự có `DIAGRAM_SPEC` bắt buộc
  `toScale=true`; không có origin/sourceAssessment/candidate metadata. Block và
  root có thể có `reviewIssues[]` optional. API/FE tiếp tục đọc version 1 và dữ
  liệu version 2 cũ.

### `POST /admin/lessons/:lessonId/summary/prompt-preview`

Role: `ADMIN`.

Body giống endpoint `generate-ai` ở trên.

Behavior:

- Dùng cùng context loader và prompt builder với worker để trả đúng
  `systemPrompt`, `userPrompt` và `inputPrompt` đầy đủ có context chunks.
- `systemPrompt`/`userPrompt` trả về là prompt hiệu lực để FE hiển thị và cho
  admin chỉnh sửa. Nếu FE gửi lại nguyên hai prompt này khi generate/preview,
  server tái sử dụng trực tiếp và không lồng thêm một lớp base prompt.
- Trả thêm `openAiRequest` ở dạng JSON với các field `model`, `instructions`,
  `input`, `text.format`, `temperature`, `max_output_tokens`; `text.format` phải
  chứa đúng structured-output name, strict mode và JSON Schema mà provider sử
  dụng. Đây phải là payload xem trước đầy đủ sau khi server ghép context, không
  phải object gần giống request thật và không chứa credential.
- Trả số document/chunk, token ước tính, model/provider thực tế,
  temperature, giới hạn output, danh sách model khả dụng và chi phí tối đa ước
  tính theo bảng giá hiện tại.
- Chỉ dựng dữ liệu xem trước trong API; không tạo job, không gọi OpenAI/Gemini,
  không ghi usage và không phát sinh chi phí provider.
- Không trả API key, secret hoặc credential provider.

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

### `GET /admin/lessons/:lessonId/ai-generation-panel`

Role: `ADMIN`.

Behavior:

- Trả readiness của lesson cho Summary và cho nội dung cần embedding, toàn bộ
  lesson document active, cùng job mới nhất của `SUMMARY`, `QUIZ`, `FLASHCARD`,
  `TEST`. Mỗi document có `status`, `chunkCount`, `canUseForSummary` và
  `unavailableReason`. Document được tạo từ khối trích xuất có thêm `pageRange`
  dạng `{ pageStart, pageEnd }`; document upload trực tiếp trả `pageRange = null`.
  UI vẫn hiển thị tài liệu chưa sẵn sàng nhưng không cho chọn để tạo Summary.
- `lesson.targetGrade` trả khối lớp ưu tiên của learning path (hoặc `null`) để UI
  dựng mặc định cách trình bày theo đúng đối tượng khóa học.
- Mỗi job chỉ trả trạng thái durable, `jobId`, resource đích, review status,
  lỗi và timestamps để UI khôi phục/polling sau reload.
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
{
  "type": "RICH_TEXT",
  "title": "Phiếu chuẩn bị",
  "contentJson": {},
  "fileId": null,
  "url": null
}
```

---
