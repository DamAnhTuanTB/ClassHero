# API Student Learning

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 9. Student lesson API

### `GET /student/learning-paths/:id`

Role: `STUDENT`.

Behavior:

- Trả chi tiết lộ trình.
- Response gồm cây `chapters -> lessons`; chapter chỉ có metadata tổng quan, lesson có trạng thái truy cập/progress.
- Kèm enrollment/trial status.
- `:id` tiếp tục là ID/slug của khóa `CATALOG` đã mua; backend resolve lộ trình hiệu lực từ enrollment.
- Response bổ sung `purchasedLearningPathId`, `deliveryLearningPathId`, `isPersonalized` và `sourceLearningPathId`.
- Cây `chapters -> lessons`, tổng lesson, progress percent và continue lesson lấy từ lộ trình hiệu lực.
- Không trả private slug hoặc cho phép student khác dùng ID bản cá nhân để discovery.

### `GET /student/lessons/:lessonId`

Role: `STUDENT`.

Behavior:

- Kiểm tra enrollment còn hạn hoặc trial hợp lệ.
- Trả metadata chapter cha để UI hiển thị breadcrumb/tổng quan.
- Trả `navigation.previous`/`navigation.next` theo thứ tự chapter + lesson của
  lộ trình hiệu lực.
- Trả video, material, document `READY`, tóm tắt kiến thức đã duyệt,
  `videoSummary` đã duyệt và metadata của quiz/flashcard/test set đã duyệt,
  không phải reserve. `videoSummary` chỉ xuất hiện khi bản ghi `APPROVED`, chưa
  xóa và không stale; response không trả review/source hash hay provenance admin.
- Trả `videoProgress` của đúng student gồm vị trí gần nhất, phiên bản
  timeline và thời điểm lưu. Khi video URL hoặc cửa sổ cắt thay đổi,
  vị trí cũ không được trả về cho timeline mới.
- Figure Summary/Quiz đã duyệt trả optional `displayScale` do backend hydrate từ
  source revision để giao diện co/phóng toàn bộ visual card nhất quán; response
  student không trả mã TikZ và asset cũ thiếu metadata giữ layout mặc định.
- Figure Summary được hydrate thêm `figureIndex` từ logical figure. Với khối
  `example`/`exercise`, client dùng slot `0` cho hình đề và slot `1` cho hình
  lời giải; không suy vai trò từ vị trí phần tử trong mảng sau khi xóa hình.
- File chỉ trả metadata an toàn và `accessUrl` public/signed có hạn; không trả
  `objectKey`, storage bucket hoặc thông tin nội bộ của provider.
- Aggregate chỉ trả số câu/thẻ của set. Nội dung câu quiz đọc qua endpoint riêng;
  aggregate và test status không trả đáp án đúng, grading config, lời giải hoặc
  nội dung câu test.
- Aggregate vẫn giữ metadata material/document phục vụ các surface sau; UI tab
  `Bài học` của M7 core chỉ hiển thị summary kiến thức trọng tâm.
- `testAvailability` trong aggregate là metadata đọc nhanh. Gate đầy đủ theo
  thời gian + Quiz + Flashcard phải lấy từ endpoint test status.
- Notes/comments/favorites và progress/attempt không thuộc response `M6.5`; các
  phần này được bổ sung ở `M7.x`.
- Nếu lesson thuộc path `PERSONALIZED`, chỉ student sở hữu enrollment đang được giao path đó mới được truy cập.
- Access resolver phải kiểm tra lesson nằm trong lộ trình hiệu lực, không chỉ kiểm tra student đã mua khóa nguồn.
- Lịch sử từ lesson gốc được resolve qua `sourceLessonId` theo contract progress; không sao chép record của student khác.
- Sau activation, mọi write mới của progress/attempt/note/comment/favorite phải dùng lesson/content thuộc bản cá nhân; API không hỗ trợ chuyển enrollment trở lại khóa gốc.

Response chính:

```json
{
  "data": {
    "id": "lesson-uuid",
    "access": { "mode": "ENROLLMENT" },
    "chapter": {},
    "learningPath": {},
    "materials": [],
    "documents": [],
    "summary": null,
    "videoSummary": null,
    "videoProgress": {
      "lastPositionSeconds": 1203,
      "timelineVersion": "sha256",
      "updatedAt": "2026-09-11T03:00:00.000Z"
    },
    "quizSets": [],
    "flashcardSets": [],
    "testSets": [],
    "testAvailability": {
      "canStartTest": false,
      "examOpenAt": "2026-08-01T13:00:00.000Z"
    },
    "navigation": { "previous": null, "next": {} }
  }
}
```

### Các endpoint đọc content `M6.5`

```txt
GET /student/lessons/:lessonId/summary
GET /student/lessons/:lessonId/quiz-sets
GET /student/lessons/:lessonId/flashcard-sets
GET /student/lessons/:lessonId/test-sets/status
```

Tất cả endpoint trên dùng cùng access policy enrollment/trial của lesson. Summary
chỉ trả bản `APPROVED`; quiz chỉ trả câu `APPROVED` và payload an toàn; flashcard
theo contract tại `docs/api/quiz-flashcard-tests.md`; test status chỉ trả
metadata/khả năng bắt đầu.

### Error codes bổ sung

```txt
PERSONAL_LEARNING_PATH_EXISTS
PERSONAL_LEARNING_PATH_NOT_READY
PERSONAL_LEARNING_PATH_ACCESS_DENIED
PERSONAL_LEARNING_PATH_CLONE_FAILED
```

### `GET /student/lessons/:lessonId/leaderboard/top-tests`

Role: `STUDENT`.

Behavior:

- Trả tối đa 5 attempt đã được chọn làm best của từng student, theo score giảm
  dần, duration tăng dần và submit sớm hơn khi vẫn bằng nhau.
- Chỉ student có quyền đọc lesson mới gọi được endpoint.

---

## 14. Notes, comments, favorites API

### `GET /student/lessons/:lessonId/notes`

Role: `STUDENT`.

### `POST /student/lessons/:lessonId/notes`

Role: `STUDENT`.

Body:

```json
{ "contentJson": {} }
```

### `PATCH /student/notes/:noteId`

Role: `STUDENT`.

### `DELETE /student/notes/:noteId`

Role: `STUDENT`.

### `GET /student/lessons/:lessonId/video-comments`

Role: `STUDENT`.

Behavior: trả comment riêng của chính student.

### `POST /student/lessons/:lessonId/video-comments`

Role: `STUDENT`.

### `POST /student/favorites/toggle`

Role: `STUDENT`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid",
  "lessonId": "uuid"
}
```

### `GET /student/lessons/:lessonId/favorites`

Role: `STUDENT`.

---

## 15. Smart video learning API (`M15`)

Các endpoint dưới đây là contract định hướng; request/response cuối cùng được chốt trong từng subtask trước khi code.

### `GET /student/lessons/:lessonId/video-progress`

Role: `STUDENT`.

Behavior:

- Trả `lastPositionSeconds`, `timelineVersion` và `updatedAt` cho lát cắt
  smart-resume đã triển khai. Unique watched seconds/percent và optional
  chapter mastery/recommendations được bổ sung trong các lát cắt M15 sau.
- Mọi timestamp phía student dùng timeline sau cắt.
- Không dùng watched percent để tự đánh dấu completed.

### `PATCH /student/lessons/:lessonId/video-progress`

Role: `STUDENT`.

Body:

```json
{ "positionSeconds": 1203.4 }
```

Behavior:

- Kiểm tra quyền đọc lesson và lưu vị trí tuyệt đối gần nhất theo
  timeline sau cắt; request lặp an toàn vì không cộng dồn thời gian.
- Client batch khoảng 10 giây và flush khi pause, ẩn/rời trang hoặc
  component unmount; không gửi theo từng frame.
- Response cùng shape với `GET video-progress`.

### `POST /student/lessons/:lessonId/video-sessions`

Planned cho watched intervals và analytics đầy đủ.

Role: `STUDENT`.

Behavior:

- Tạo/resume playback session idempotent cho student + lesson.

### `POST /student/lessons/:lessonId/video-sessions/:sessionId/heartbeat`

Role: `STUDENT`.

Body định hướng:

```json
{
  "idempotencyKey": "uuid",
  "timelineVersion": "string",
  "positionSeconds": 42,
  "watchedIntervals": [{ "startSeconds": 30, "endSeconds": 42 }],
  "reason": "HEARTBEAT"
}
```

Behavior:

- Validate ownership, timeline version, duration và interval hợp lệ.
- Merge interval ở server; request lặp không cộng trùng.
- `reason` có thể là `HEARTBEAT`, `PAUSE`, `SEEK`, `CHAPTER_CHANGE`, `ENDED`, `PAGE_HIDE`.

### Timestamp note

`POST/PATCH` note của mục 14 bổ sung optional:

```json
{
  "contentJson": {},
  "playbackSeconds": 42,
  "timelineVersion": "string"
}
```

Backend tự resolve `sourceSeconds` và chapter hiện tại; không tin chapter title client gửi.

### `GET /student/lessons/:lessonId/video-learning`

Role: `STUDENT`.

Behavior:

- Trả transcript/chapter được phép hiển thị, checkpoint, mastery và recommendation cần cho UI.
- Không trả raw signal/event log.

### `POST /student/lessons/:lessonId/video-checkpoints/:checkpointId/attempts`

Role: `STUDENT`.

Behavior:

- Reuse content/answer validation từ quiz/test khi phù hợp.
- Lưu attempt idempotent và trả feedback + resume position.

### `GET /student/lessons/:lessonId/video-search`

Role: `STUDENT`.

Query:

```txt
q=<text>
```

Behavior:

- Hybrid/semantic search chỉ trong lesson đang có quyền.
- Trả chapter, snippet, `playbackSeconds` và score đã normalize.

### `POST /student/lessons/:lessonId/video-context-actions`

Role: `STUDENT`.

Body định hướng:

```json
{
  "action": "ASK_THIS_MOMENT",
  "playbackSeconds": 42,
  "question": "Vì sao bước này đổi dấu?"
}
```

Behavior:

- `action` gồm `ASK_THIS_MOMENT` hoặc `I_DONT_UNDERSTAND`.
- Backend resolve chapter/transcript/RAG context từ lesson + timestamp.
- Response theo cache/job contract AI, có rate limit/budget guard.

### Admin analytics

`M15.8` cần endpoint admin aggregate theo lesson/chapter/time bucket. Contract cụ thể chỉ chốt khi có schema/retention/privacy threshold; không trả raw surveillance log từng student.

Error codes dự kiến:

```txt
VIDEO_TIMELINE_VERSION_MISMATCH
VIDEO_SESSION_NOT_FOUND
VIDEO_INTERVAL_INVALID
VIDEO_TRANSCRIPT_UNAVAILABLE
VIDEO_CHECKPOINT_NOT_FOUND
VIDEO_CONTEXT_UNAVAILABLE
```

---
