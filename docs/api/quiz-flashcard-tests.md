# API Quiz Flashcard Tests

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 10. Quiz API

### 10.1. Admin quiz set

#### `GET /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

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

#### `POST /admin/lessons/:lessonId/quiz-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "questionCount": 10,
  "difficulty": "MEDIUM",
  "questionTypes": ["MULTIPLE_CHOICE", "TRUE_FALSE"]
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
- Với `TRUE_FALSE`, `correctAnswerJson` là boolean.
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

Behavior: trả bộ quiz được phép dùng.

#### `POST /student/quiz-sets/:quizSetId/attempts`

Role: `STUDENT`.

Side effect: tạo attempt.

#### `POST /student/quiz-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [{ "questionId": "uuid", "answerJson": {} }]
}
```

Behavior:

- Chấm bài.
- Lưu answers.
- Trả correct/wrong count.

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
      "hintJson": {},
      "difficulty": "MEDIUM"
    }
  ]
}
```

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

#### `DELETE /admin/flashcard-sets/:setId`

Role: `ADMIN`.

#### `POST /admin/flashcard-sets/:setId/review`

Role: `ADMIN`.

### 11.2. Admin flashcard item-level CRUD

#### `POST /admin/flashcard-sets/:setId/cards`

Role: `ADMIN`.

Body:

```json
{
  "frontJson": {},
  "backJson": {},
  "hintJson": {},
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

#### `PATCH /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior:

- Cập nhật flashcard.
- Nếu nội dung thay đổi, mark explanation stale.

#### `DELETE /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior: soft delete.

### 11.3. Student flashcard

#### `GET /student/lessons/:lessonId/flashcard-sets`

Role: `STUDENT`.

#### `POST /student/flashcards/:flashcardId/progress`

Role: `STUDENT`.

Body:

```json
{ "isKnown": true }
```

#### `POST /student/lessons/:lessonId/flashcard-sets/request-new`

Role: `STUDENT`.

Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---

## 12. Test API

### 12.1. Admin test set

#### `GET /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

#### `POST /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Bài kiểm tra ngắn",
  "durationSeconds": 900,
  "difficultyRatioJson": { "easy": 0.4, "medium": 0.4, "hard": 0.2 },
  "questions": []
}
```

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

#### `DELETE /admin/test-sets/:testSetId`

Role: `ADMIN`.

#### `POST /admin/test-sets/:testSetId/review`

Role: `ADMIN`.

### 12.2. Admin test question item-level CRUD

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
    "bestAttempt": {
      "score": 8,
      "durationSeconds": 600
    }
  }
}
```

#### `POST /student/lessons/:lessonId/test-attempts/start`

Role: `STUDENT`.

Behavior:

- Kiểm tra đã đến `exam_open_at`.
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
- Lưu attempt answers.
- Cập nhật best attempt trong transaction.
- Nếu score >= lesson completion score, cập nhật lesson progress completed.
- Tạo XP event idempotent nếu đủ điều kiện.
- Gửi notification cho student/parent nếu cần.

#### `GET /student/test-attempts/:attemptId/review`

Role: `STUDENT`.

Behavior:

- Chỉ sau khi submit.
- Trả câu hỏi, answer của học sinh, correct answer, trạng thái đúng/sai.

#### `POST /student/lessons/:lessonId/test-sets/request-new`

Role: `STUDENT`.

Behavior:

- Chỉ cho request khi test đã mở.
- Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---
