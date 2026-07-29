# API Quiz Flashcard Tests

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 10. Quiz API

### 10.1. Admin quiz set

#### `GET /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

Behavior:

- Trả các bộ chưa bị xóa mềm theo `sortOrder`, rồi `createdAt` tăng dần để giữ
  ổn định thứ tự tạo của dữ liệu cũ.

#### `POST /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Quiz cơ bản",
  "difficulty": "EASY",
  "questions": [
    {
      "questionType": "MULTIPLE_CHOICE",
      "questionJson": {},
      "optionsJson": {},
      "correctAnswerJson": {},
      "hintJson": {},
      "gradingConfigJson": null,
      "difficulty": "EASY"
    }
  ]
}
```

Behavior:

- Server tự gán `sortOrder` tiếp theo trong lesson.

#### `POST /admin/lessons/:lessonId/quiz-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "questionCount": 10,
  "difficulty": "MEDIUM",
  "questionTypes": [
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "MULTI_STATEMENT_TRUE_FALSE",
    "TEXT_INPUT"
  ]
}
```

Response: `202 Accepted` với `jobId`.

Side effects:

- Tạo `background_jobs` queue `AI_GENERATION`.
- Tạo `ai_generations` type `QUIZ`.
- Enqueue AI job.

#### `PATCH /admin/quiz-sets/:quizSetId`

Role: `ADMIN`.

#### `DELETE /admin/quiz-sets/:quizSetId`

Role: `ADMIN`.

#### `POST /admin/quiz-sets/:quizSetId/review`

Role: `ADMIN`.

Body:

```json
{ "reviewStatus": "APPROVED" }
```

### 10.2. Admin quiz question item-level CRUD

#### `POST /admin/quiz-sets/:quizSetId/questions`

Role: `ADMIN`.

Body:

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "questionJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "2 + 2 bằng bao nhiêu?" }]
      }
    ]
  },
  "optionsJson": [
    {
      "id": "option-a",
      "richText": {
        "type": "doc",
        "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "3" }] }]
      }
    },
    {
      "id": "option-b",
      "richText": {
        "type": "doc",
        "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "4" }] }]
      }
    }
  ],
  "correctAnswerJson": ["option-b"],
  "hintJson": null,
  "explanationJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Cộng hai đơn vị với hai đơn vị được bốn đơn vị." }
        ]
      }
    ]
  },
  "difficulty": "EASY"
}
```

- `optionsJson` là mảng động, tối thiểu 2 phần tử và không có giới hạn cố định 4 phương án.
- Mỗi option có `id` duy nhất; mọi ID trong `correctAnswerJson` phải tồn tại trong `optionsJson`.
- Với `TRUE_FALSE`, `optionsJson` là `null` hoặc không gửi và
  `correctAnswerJson` là một boolean chung:

```json
{
  "questionType": "TRUE_FALSE",
  "questionJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Số 2 là số nguyên tố." }]
      }
    ]
  },
  "optionsJson": null,
  "correctAnswerJson": true,
  "difficulty": "EASY"
}
```

- Với `MULTI_STATEMENT_TRUE_FALSE`, `questionJson` là đề dẫn chung;
  `optionsJson` là danh sách tối thiểu 2 mệnh đề và `correctAnswerJson` ánh xạ
  Đúng/Sai cho từng mệnh đề:

```json
{
  "questionType": "MULTI_STATEMENT_TRUE_FALSE",
  "questionJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Xác định tính đúng sai của các mệnh đề sau." }
        ]
      }
    ]
  },
  "optionsJson": [
    {
      "id": "statement-a",
      "richText": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "Mệnh đề thứ nhất" }]
          }
        ]
      }
    },
    {
      "id": "statement-b",
      "richText": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "Mệnh đề thứ hai" }]
          }
        ]
      }
    }
  ],
  "correctAnswerJson": [
    { "statementId": "statement-a", "value": true },
    { "statementId": "statement-b", "value": false }
  ],
  "difficulty": "MEDIUM"
}
```

- ID mệnh đề phải duy nhất. `correctAnswerJson` phải chứa đúng một entry cho mọi
  ID trong `optionsJson`, không thiếu, không thừa và không trùng.
- `TRUE_FALSE` và `MULTI_STATEMENT_TRUE_FALSE` là hai contract riêng; API không
  tự chuyển boolean thành danh sách mệnh đề hoặc ngược lại.
- Với `TEXT_INPUT`, `correctAnswerJson` là mảng câu trả lời được chấp nhận và `gradingConfigJson` chứa `caseSensitive`/`exactMatch`.
- `hintJson` và `explanationJson` nhận Tiptap JSON hoặc `null`. Lời giải chi tiết thủ công được lưu trong `ai_explanations` với `source=ADMIN` và trả về qua relation `explanation`.
- `questionJson`, `optionsJson[*].richText`, `hintJson` và
  `explanationJson` cùng nhận cây Tiptap rich content. Contract cho phép
  `heading`, `paragraph`, `bulletList`, `orderedList`, `listItem`; marks
  `bold`, `italic`, `underline`, `strike`, `textStyle.color`; thuộc tính
  `textAlign`, `indent` (số nguyên từ `1` đến `8`) trên paragraph/heading;
  node `inlineMath`/`blockMath` với `attrs.latex`; node `image` với
  `attrs.fileId`, `src`, `alt`, `title`, `alignment` (`left|center|right`),
  `baseWidthPercent`, `widthPercent`, `sourceWidth`, `sourceHeight`, `cropTop`,
  `cropRight`, `cropBottom`, `cropLeft`; và node
  `table`, `tableRow`, `tableHeader`, `tableCell` theo table schema của Tiptap.
  Cell giữ `colspan`, `rowspan`, `colwidth` và `cellHeight` để bảo toàn resize
  cột, chiều cao hàng và trạng thái merge/split khi đọc lại.
- Ảnh câu hỏi phải upload trước qua `POST /files/upload` với
  `purpose=QUESTION_IMAGE`; payload rich content không nhận ảnh base64.
- Crop ảnh là non-destructive và dùng phần trăm bốn cạnh trong khoảng hợp lệ;
  `baseWidthPercent` là độ rộng khung ảnh ở scale gốc, còn `widthPercent` là mức
  resize hiển thị cho người dùng và nằm trong `20–100`. Ảnh mới bắt đầu tại
  `widthPercent=100`; node cũ thiếu `baseWidthPercent` mặc định dùng `100` để
  không đổi cách hiển thị. Xóa node ảnh khỏi rich content không đồng nghĩa xóa
  file storage ở endpoint câu hỏi.
- Với `TEXT_INPUT`, mỗi phần tử `correctAnswerJson` vẫn là string canonical
  dùng để chấm; string có thể chứa LaTeX hoặc mhchem như
  `\frac{1}{2}`/`\ce{H2O}`.
- Server tự gán `sortOrder` tiếp theo trong quiz set.

#### `PATCH /admin/quiz-questions/:questionId`

Role: `ADMIN`.

Behavior:

- Cập nhật câu hỏi với cùng contract nội dung như create; cho phép đổi loại câu hỏi và xóa gợi ý/lời giải bằng `null`.
- Khi gửi `explanationJson`, service tạo mới hoặc cập nhật `ai_explanations` nguồn `ADMIN`; nội dung rỗng/`null` gỡ lời giải khỏi câu hỏi.
- Nếu nội dung/correct answer/hint thay đổi, mark explanation liên quan stale hoặc xóa `explanation_id` theo AI/RAG spec.
- Ghi audit log.

#### `DELETE /admin/quiz-questions/:questionId`

Role: `ADMIN`.

Behavior: soft delete.

### 10.3. Student quiz

#### `GET /student/lessons/:lessonId/quiz-sets`

Role: `STUDENT`.

Behavior:

- Yêu cầu lesson đã publish và student có enrollment active còn hạn cho khóa
  gốc/bản cá nhân hiệu lực, hoặc lesson bật trial.
- Chỉ trả set/question chưa xóa, trạng thái `APPROVED` và set không phải reserve.
- Question chỉ gồm `questionJson`, `optionsJson`, `hintJson`, loại, độ khó và thứ
  tự; không trả `correctAnswerJson`, `gradingConfigJson`, `explanation` hoặc dữ
  liệu chấm điểm nội bộ.
- Attempt/progress và chấm bài thuộc `M7.2`.

#### `POST /student/quiz-sets/:quizSetId/attempts`

Role: `STUDENT`.

Body:

```json
{
  "scope": "ALL",
  "sourceAttemptId": null
}
```

Behavior:

- `scope=ALL` không có `sourceAttemptId` tạo lượt làm đủ câu và trở thành kết
  quả gốc mới. `scope=ALL` có `sourceAttemptId` tạo lượt phụ gồm toàn bộ câu
  của kết quả nguồn.
- `scope=INCORRECT` bắt buộc `sourceAttemptId` thuộc chính student, là attempt
  đã submit và chỉ lấy những câu sai của chính attempt nguồn.
- `sourceAttemptId` luôn là attempt cha trực tiếp. Backend lần theo chuỗi
  cha-con để tìm attempt gốc dùng cho kết quả cộng dồn của toàn bộ bài.
- Tạo sẵn answer placeholder cho đúng tập câu của attempt để server không tin
  danh sách question ID do client gửi về sau.
- Response trả nội dung runner, hint, `correctAnswerJson`, `gradingConfigJson`
  và `explanationJson` đã duyệt để frontend chấm tức thì mà không gọi API từng
  câu. Đây là đánh đổi đã chốt để ưu tiên tốc độ; dữ liệu chấm có thể được xem
  bằng DevTools.
- Mỗi question có `questionNumber` theo vị trí trong bộ Quiz gốc; response có
  `originalTotalCount` để runner retry hiển thị đúng dạng `Câu hỏi 4/9` thay vì
  đánh số lại thành `1/4`.

#### `GET /student/quiz-sets/:quizSetId/attempts/current`

Role: `STUDENT`.

Behavior:

- Trả lượt `IN_PROGRESS` mới nhất của chính student trong bộ Quiz, hoặc `null`
  nếu không có lượt đang làm.
- Response trả lại danh sách câu theo đúng attempt đã tạo, gồm dữ liệu chấm và
  lời giải giống response start. `checkedAnswers` chỉ giữ dữ liệu server từ flow
  cũ; flow hiện hành khôi phục các câu đã kiểm tra từ local storage trên cùng
  trình duyệt và backend chỉ lưu answer chính thức khi submit.
- Frontend dùng endpoint này để khôi phục runner sau refresh/F5 hoặc khi
  student đã thoát runner rồi vào Quiz lại, không tạo attempt mới khi vẫn còn
  lượt `IN_PROGRESS`.
- Response có `scope`, `sourceAttemptId`, `originalTotalCount` và
  `questionNumber` để khôi phục đúng ngữ cảnh của runner retry câu sai.

#### `GET /student/quiz-sets/:quizSetId/attempts/status`

Role: `STUDENT`.

Behavior:

- Trả trạng thái entry của bộ Quiz theo chính student:
  `NOT_STARTED`, `IN_PROGRESS` hoặc `COMPLETED`.
- Chỉ lượt `IN_PROGRESS` được tạo sau lần submit gần nhất mới được ưu tiên và
  response trả `currentAttemptId` cùng `checkedCount` đã lưu ở server. Flow hiện
  hành chưa ghi từng câu lên server nên frontend ghép thêm số câu đã kiểm tra
  trong local storage theo cùng `attemptId`; tổng bằng `0` dùng CTA `Bắt đầu`,
  lớn hơn `0` dùng CTA `Tiếp tục vào làm`. Lượt đang dở cũ hơn lần submit gần
  nhất phải bị bỏ qua để sau F5 không che mất kết quả đã hoàn thành.
- Attempt có `sourceAttemptId` là lượt phụ nên không che trạng thái
  `COMPLETED`/kết quả tích lũy của attempt gốc trên panel Quiz. Nếu F5 ngay
  trong runner lượt phụ, frontend vẫn khôi phục lượt phụ bằng history marker
  và endpoint `current`.
- Nếu không có lượt đang làm nhưng đã submit, response trả
  `latestSubmittedAttempt` gồm `id`, `correctCount`, `wrongCount`,
  `totalCount`, `accuracyPercent` để panel mở lại kết quả gần nhất.
- Endpoint chỉ trả metadata nhẹ, không trả nội dung câu hỏi hoặc đáp án.
- Khi tạo hoặc submit một lượt mới, backend chuyển các lượt `IN_PROGRESS` dư
  của cùng student/bộ Quiz sang `CANCELLED` để giữ một nguồn trạng thái hiện
  hành.

#### `POST /student/quiz-attempts/:attemptId/questions/:questionId/check`

Role: `STUDENT`.

Body:

```json
{ "answerJson": {} }
```

Behavior:

- Endpoint tương thích cho client cũ; UI hiện hành không gọi endpoint này.
- Client hiện hành chấm local từ dữ liệu đã trả khi start/resume và chỉ ghi
  answer lên server ở endpoint submit.

#### `POST /student/quiz-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [
    {
      "questionId": "uuid",
      "answerJson": {}
    }
  ]
}
```

Behavior:

- Nhận toàn bộ answer trong một request. Backend không tin danh sách question ID
  từ client: phải khớp chính xác các placeholder đã tạo cho attempt, không trùng
  và không thiếu câu.
- Backend validate answer theo loại câu, chấm lại authoritative, lưu answers và
  submit attempt trong một transaction.
- Ở runner, frontend dùng answer đầy đủ làm căn cứ cho `Đã làm`/cảnh báo thiếu
  câu; student không bắt buộc bấm nút kiểm tra ở từng câu.
- Trả summary của chính attempt vừa submit gồm `id`, `sourceAttemptId`,
  `correctCount`, `wrongCount`, `totalCount`, `accuracyPercent` để backend giữ
  được lịch sử chi tiết của từng lượt làm.
- Response đồng thời có `aggregateResult`, là summary của attempt gốc sau khi
  đã cộng các câu sửa đúng từ lượt phụ. Frontend luôn dùng `aggregateResult`
  cho màn kết quả, trạng thái panel và mọi action xem lại/làm lại; không hiển
  thị summary riêng của lượt con.
- Với attempt phụ, server lưu kết quả riêng của lượt đó vào lịch sử và chỉ nâng
  các answer đang sai của attempt gốc thành đúng; câu đã đúng không bị hạ thành
  sai. Với attempt gốc `ALL`, `aggregateResult` chính là kết quả attempt vừa
  submit và không cộng dồn dữ liệu từ kết quả gốc cũ.

#### `GET /student/quiz-attempts/:attemptId/review?scope=ALL|INCORRECT`

Role: `STUDENT`.

Behavior:

- Chỉ owner của attempt đã submit được xem lại.
- `ALL` trả toàn bộ câu; `INCORRECT` chỉ trả câu sai.
- Response có answer của student, đáp án đúng, kết quả từng mệnh đề và lời giải
  đã duyệt.
- Review dùng thống kê và tập câu của chính attempt được yêu cầu; đồng thời trả
  `questionNumber` và `originalTotalCount` theo bộ Quiz gốc để lượt con không bị
  đánh số lại từ 1.

#### `POST /student/lessons/:lessonId/quiz-sets/request-new`

Role: `STUDENT`.

Behavior:

- Kiểm tra bộ dự phòng phù hợp.
- Nếu còn, trả bộ có sẵn.
- Nếu hết, enqueue AI generate bộ mới.

Response nếu có bộ dự phòng:

```json
{
  "data": {
    "mode": "EXISTING",
    "setId": "uuid"
  }
}
```

Response nếu phải tạo AI job: `202 Accepted`.

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

---

## 11. Flashcard API

### 11.1. Admin flashcard set

#### `GET /admin/lessons/:lessonId/flashcard-sets`

Role: `ADMIN`.

Behavior:

- Trả các bộ chưa bị xóa mềm theo `sortOrder`, rồi `createdAt` tăng dần.
- `cardCount` phản ánh số flashcard chưa bị xóa mềm.

#### `POST /admin/lessons/:lessonId/flashcard-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Flashcard công thức",
  "difficulty": "MEDIUM",
  "cards": [
    {
      "frontJson": {},
      "backJson": {},
      "explanationJson": {},
      "difficulty": "MEDIUM"
    }
  ]
}
```

Behavior:

- Chỉ tạo cho lesson tồn tại.
- Bộ thủ công dùng `source=ADMIN`, `reviewStatus=APPROVED`.
- Server tự gán `sortOrder` tiếp theo và ghi audit log.

#### `POST /admin/lessons/:lessonId/flashcard-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "cardCount": 20,
  "difficulty": "MEDIUM"
}
```

Response: `202 Accepted` với `jobId`.

#### `PATCH /admin/flashcard-sets/:setId`

Role: `ADMIN`.

Behavior: cập nhật title/difficulty và ghi audit log.

#### `DELETE /admin/flashcard-sets/:setId`

Role: `ADMIN`.

Behavior: soft delete và ghi audit log.

#### `POST /admin/flashcard-sets/:setId/review`

Role: `ADMIN`.

Behavior: cập nhật `reviewStatus` và ghi audit log.

### 11.2. Admin flashcard item-level CRUD

#### `POST /admin/flashcard-sets/:setId/cards`

Role: `ADMIN`.

Body:

```json
{
  "frontJson": {},
  "backJson": {},
  "explanationJson": {},
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

Rules:

- `frontJson` và `backJson` là Tiptap JSON có nội dung; công thức, ảnh có
  `alt`/`src` và bảng được tính là nội dung cấu trúc hợp lệ.
- `explanationJson` optional và có thể gửi `null`; form quản trị không còn ô
  gợi ý.
- Lời giải chi tiết thủ công được lưu trong `ai_explanations` với
  `targetType=FLASHCARD`, `source=ADMIN`, `reviewStatus=APPROVED` và trả về qua
  relation `explanation`.
- Difficulty của từng card chỉ nhận `EASY`, `MEDIUM`, `HARD`; server tự gán
  `sortOrder` tiếp theo nếu client không gửi.
- Tạo card tăng `flashcard_sets.card_count` trong cùng transaction và ghi audit
  log.

#### `PATCH /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior:

- Cập nhật flashcard.
- Nếu front/back thay đổi mà request không gửi `explanationJson`, mark lời giải
  hiện tại stale. Gửi `explanationJson` sẽ tạo/cập nhật lời giải; gửi `null`
  hoặc document rỗng sẽ gỡ lời giải.
- Ghi audit log.

#### `DELETE /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior: soft delete.

- Giảm `flashcard_sets.card_count` trong cùng transaction.
- Ghi audit log.

### 11.3. Student flashcard

#### `GET /student/lessons/:lessonId/flashcard-sets`

Role: `STUDENT`.

Behavior:

- Yêu cầu lesson đã publish và student có enrollment active còn hạn cho khóa
  gốc/bản cá nhân hiệu lực, hoặc lesson bật trial.
- Chỉ trả set/card chưa xóa, set/card `APPROVED` và set không phải reserve.
- Response chứa front/back/difficulty, lời giải đã `APPROVED`,
  `progress`/`isFavorite` theo student và summary đã review/known/unknown.

#### `PATCH /student/flashcards/:flashcardId/progress`

Role: `STUDENT`.

Body:

```json
{ "isKnown": true }
```

Behavior:

- Upsert progress theo student/card, tăng `reviewCount` và cập nhật
  `lastReviewedAt`.
- Completion prerequisite cần mỗi card của ít nhất một bộ được duyệt đã review
  một lần; `isKnown` dùng để tách nhóm đã thuộc/chưa thuộc.

#### `POST /student/favorites/toggle`

Role: `STUDENT`.

Behavior:

- Toggle favorite cho Quiz question hoặc Flashcard sau khi kiểm tra ownership,
  lesson access và target thuộc đúng lesson.

#### `POST /student/lessons/:lessonId/flashcard-sets/request-new`

Role: `STUDENT`.

Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---

## 12. Test API

### 12.1. Admin test set

#### `GET /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

Behavior:

- Trả các bộ đề chưa bị xóa mềm theo `sortOrder`, rồi `createdAt` tăng dần để
  giữ ổn định thứ tự tạo của dữ liệu cũ.

#### `POST /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Bài kiểm tra ngắn",
  "durationSeconds": 900,
  "difficulty": "MIXED",
  "difficultyRatioJson": { "easy": 0.4, "medium": 0.4, "hard": 0.2 }
}
```

Rules:

- `durationSeconds` bắt buộc, từ `60` đến `14400` giây.
- UI quản trị nhập thời gian theo phút rồi đổi sang giây trước khi gọi API.
- Server tự gán `sortOrder` tiếp theo trong lesson.
- `difficultyRatioJson` là metadata tùy chọn; UI CRUD thủ công M6.4 giữ cùng
  field mức độ như Quiz và không bắt admin nhập tỷ lệ riêng.

#### `POST /admin/lessons/:lessonId/test-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "questionCount": 10,
  "durationSeconds": 900,
  "difficultyRatio": { "easy": 0.4, "medium": 0.4, "hard": 0.2 }
}
```

Response: `202 Accepted` với `jobId`.

#### `PATCH /admin/test-sets/:testSetId`

Role: `ADMIN`.

Body: một phần hoặc toàn bộ `title`, `durationSeconds`, `difficulty`,
`difficultyRatioJson`.

#### `DELETE /admin/test-sets/:testSetId`

Role: `ADMIN`.

Behavior: soft delete.

#### `POST /admin/test-sets/:testSetId/review`

Role: `ADMIN`.

### 12.2. Admin test question item-level CRUD

#### `GET /admin/test-sets/:testSetId/questions`

Role: `ADMIN`.

Response mỗi câu gồm `points` đã lưu và `effectivePoints`. Khi `points=null`,
service chia phần điểm còn lại cho các câu chưa đặt điểm riêng, làm tròn hai chữ
số thập phân và giữ tổng điểm hiệu lực bằng `test_sets.total_score` (mặc định 10).

#### `POST /admin/test-sets/:testSetId/questions`

Role: `ADMIN`.

Body:

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "questionJson": {},
  "optionsJson": {},
  "correctAnswerJson": {},
  "hintJson": {},
  "gradingConfigJson": {},
  "points": null,
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

Contract nội dung câu hỏi giống mục `10.2 Admin quiz question item-level CRUD`
và hỗ trợ đủ bốn loại `MULTIPLE_CHOICE`, `TRUE_FALSE`,
`MULTI_STATEMENT_TRUE_FALSE`, `TEXT_INPUT`; Test bổ sung `points`.

#### `PATCH /admin/test-questions/:questionId`

Role: `ADMIN`.

Behavior:

- Cập nhật câu hỏi.
- Nếu nội dung/correct answer/hint thay đổi, mark explanation stale.

#### `DELETE /admin/test-questions/:questionId`

Role: `ADMIN`.

Behavior: soft delete.

### 12.3. Student test

#### `GET /student/lessons/:lessonId/test-sets/status`

Role: `STUDENT`.

Response gồm:

```json
{
  "data": {
    "canStart": true,
    "examOpenAt": "2026-08-01T13:00:00.000Z",
    "evaluatedAt": "2026-08-01T13:01:00.000Z",
    "lockReason": null,
    "quiz": { "isRequired": true, "isCompleted": true },
    "flashcard": { "isRequired": true, "isCompleted": true },
    "bestAttempt": null,
    "sets": [
      {
        "id": "test-set-uuid",
        "title": "Kiểm tra cuối bài",
        "durationSeconds": 900,
        "totalScore": 10,
        "questionCount": 10
      }
    ]
  }
}
```

Behavior:

- Dùng cùng enrollment/trial access policy của lesson.
- Chỉ trả metadata set `APPROVED`, chưa xóa, không phải reserve và số câu đã
  duyệt; không trả nội dung câu hỏi hoặc đáp án.
- `canStart=true` chỉ khi có enrollment, đã tới giờ mở và prerequisite Quiz +
  Flashcard đều hoàn thành. Trial luôn bị khóa dù được đọc nội dung lesson.
- `lockReason` là `TRIAL_NOT_ALLOWED`, `BEFORE_OPEN_TIME`,
  `PREREQUISITES_INCOMPLETE` hoặc `null`.
- Không có content Quiz/Flashcard được duyệt thì prerequisite tương ứng không
  bắt buộc.
- `bestAttempt` là kết quả student đã chủ động dùng cho lesson.

#### `POST /student/lessons/:lessonId/test-attempts/start`

Role: `STUDENT`.

Behavior:

- Kiểm tra đã đến `exam_open_at`.
- Kiểm tra enrollment và prerequisite Quiz + Flashcard.
- Chọn bộ đề phù hợp.
- Tạo attempt.
- Trả câu hỏi không kèm đáp án đúng.

#### `POST /student/test-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [{ "questionId": "uuid", "answerJson": {} }]
}
```

Behavior:

- Chấm điểm thang 10.
- Với `MULTI_STATEMENT_TRUE_FALSE`, `answerJson` là mảng
  `{ statementId, value }`. Nếu câu có `N` mệnh đề và `effectivePoints = P`,
  mỗi mệnh đề đúng nhận `P / N`, mệnh đề sai nhận 0; tổng điểm câu không dùng
  all-or-nothing.
- Lưu attempt answers.
- Chỉ chấm/lưu attempt và trả `passed`; chưa cập nhật best/completion.
- Client có thể gửi marker unanswered khi timer tự nộp; câu đó nhận 0 điểm.

#### `GET /student/test-attempts/:attemptId/review?scope=ALL|INCORRECT`

Role: `STUDENT`.

Behavior:

- Chỉ sau khi submit.
- Trả câu hỏi, answer của học sinh, correct answer, trạng thái đúng/sai. Với
  `MULTI_STATEMENT_TRUE_FALSE`, response có kết quả và điểm nhận được theo từng
  `statementId`; `isCorrect` của cả câu chỉ true khi mọi mệnh đề đều đúng.

#### `POST /student/test-attempts/:attemptId/use-result`

Role: `STUDENT`.

Behavior:

- Chỉ nhận attempt đã submit của chính student và đạt
  `lesson.completion_min_score`.
- Trong transaction, so sánh score cao hơn rồi duration thấp hơn; cập nhật
  `is_best_for_lesson`, `lesson_progress` và completion idempotently.
- Response trả Completion, best attempt và Top 5. Attempt không đạt bị từ chối
  với `TEST_SCORE_BELOW_COMPLETION_THRESHOLD`.

#### `GET /student/lessons/:lessonId/leaderboard/top-tests`

Role: `STUDENT`.

Behavior:

- Trả tối đa 5 best result đã được student lựa chọn, sort score giảm dần,
  duration tăng dần rồi thời điểm submit.

#### `POST /student/lessons/:lessonId/test-sets/request-new`

Role: `STUDENT`.

Behavior:

- Chỉ cho request khi test đã mở.
- Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---
