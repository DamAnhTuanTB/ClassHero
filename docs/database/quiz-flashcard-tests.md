# Database Quiz Flashcard Tests

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 7. Quiz

### 7.1. `quiz_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
difficulty Difficulty default MIXED
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
is_reserve boolean default false
generated_by_user_id uuid? fk users.id
ai_generation_id uuid? fk ai_generations.id
question_count int default 0
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Bộ AI tạo do học sinh yêu cầu có `source = AI`, `review_status = NEEDS_REVIEW`, `is_reserve = true`.
- Dù chưa duyệt, học sinh vẫn được dùng nếu service chọn bộ đó.

### 7.2. `quiz_questions`

```txt
id uuid pk
quiz_set_id uuid fk quiz_sets.id
lesson_id uuid fk lessons.id
question_type QuestionType
question_json jsonb
options_json jsonb?
correct_answer_json jsonb
hint_json jsonb?
grading_config_json jsonb?
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
explanation_id uuid? fk ai_explanations.id
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index:

- `quiz_set_id`.
- `lesson_id`.
- `(lesson_id, review_status)`.

Rules:

- `options_json` của `MULTIPLE_CHOICE` là mảng phương án động, tối thiểu 2 phần tử và không giới hạn cố định ở 4; mỗi phần tử có `id` duy nhất và Tiptap `richText`.
- Rich content trong `question_json`, `options_json[*].richText`, `hint_json`
  và `ai_explanations.content_json` được phép chứa format marks, list,
  `textAlign`, `inlineMath`/`blockMath.attrs.latex` và
  `image.attrs.{fileId,src,alt,title}`. Không lưu ảnh base64 trong JSON; file
  thật nằm ở object storage với `files.purpose=QUESTION_IMAGE`.
- `correct_answer_json` của `MULTIPLE_CHOICE` chỉ chứa ID còn tồn tại trong
  `options_json`; của `TRUE_FALSE` là một boolean chung; của `TEXT_INPUT` là
  mảng chuỗi được chấp nhận.
- Với `MULTI_STATEMENT_TRUE_FALSE`, `question_json` giữ đề dẫn chung;
  `options_json` là mảng tối thiểu 2 phần tử
  `{ id: string, richText: TiptapDoc }` có ID duy nhất; và
  `correct_answer_json` là mảng `{ statementId: string, value: boolean }` ánh
  xạ đúng một lần cho mọi ID trong `options_json`.
- `QuestionType` bổ sung enum `MULTI_STATEMENT_TRUE_FALSE`, vì vậy lúc
  implementation phải có Prisma migration. Các bản ghi `TRUE_FALSE` hiện có
  vẫn giữ boolean và không cần chuyển đổi dữ liệu.
- Chuỗi đáp án `TEXT_INPUT` có thể chứa LaTeX/mhchem canonical nhưng không lưu
  marks/ảnh vì server cần chuẩn hóa và so khớp đáp án học sinh.
- Với `TEXT_INPUT`, các đáp án chấp nhận nằm trong `correct_answer_json`; `grading_config_json` chứa cấu hình so khớp như `caseSensitive`, `exactMatch` và có thể mở rộng thêm `trimWhitespace`, `numericTolerance`, `unitRequired`, `acceptedUnits`.
- Lời giải chi tiết do admin nhập tái sử dụng `ai_explanations`: `target_type=QUIZ_QUESTION`, `target_id=quiz_questions.id`, `source=ADMIN`, `review_status=APPROVED`; `quiz_questions.explanation_id` trỏ tới bản ghi này.
- Khi admin sửa nội dung/correct answer/hint, service phải mark explanation stale hoặc xóa `explanation_id` theo AI/RAG spec.

### 7.3. `quiz_attempts`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
quiz_set_id uuid fk quiz_sets.id
status AttemptStatus default IN_PROGRESS
started_at timestamp
submitted_at timestamp?
correct_count int default 0
wrong_count int default 0
total_count int default 0
created_at timestamp
updated_at timestamp
```

### 7.4. `quiz_attempt_answers`

```txt
id uuid pk
attempt_id uuid fk quiz_attempts.id
question_id uuid fk quiz_questions.id
answer_json jsonb
is_correct boolean
created_at timestamp
```

Constraint:

- unique `(attempt_id, question_id)`.

Rules:

- Với `MULTI_STATEMENT_TRUE_FALSE`, `answer_json` lưu mảng
  `{ statementId: string, value: boolean }`.
- Mỗi mệnh đề có trọng số bằng nhau trong phạm vi điểm của câu. Cấp Quiz coi
  điểm hiệu lực của câu là 1; điểm câu bằng `số mệnh đề đúng / tổng số mệnh đề`.
- `is_correct=true` chỉ khi mọi mệnh đề đều đúng; giá trị này không làm mất
  phần điểm của các mệnh đề đã trả lời đúng.

---

## 8. Flashcard

### 8.1. `flashcard_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
difficulty Difficulty default MIXED
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
is_reserve boolean default false
generated_by_user_id uuid? fk users.id
ai_generation_id uuid? fk ai_generations.id
card_count int default 0
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 8.2. `flashcards`

```txt
id uuid pk
flashcard_set_id uuid fk flashcard_sets.id
lesson_id uuid fk lessons.id
front_json jsonb
back_json jsonb
hint_json jsonb?
explanation_id uuid? fk ai_explanations.id
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- `hint_json` là cột legacy nullable; contract M6.3 mới không đọc/ghi trường này.
- Lời giải chi tiết do admin nhập tái sử dụng `ai_explanations`:
  `target_type=FLASHCARD`, `target_id=flashcards.id`, `source=ADMIN`,
  `review_status=APPROVED`; `flashcards.explanation_id` trỏ tới bản ghi này.
- Khi admin sửa `front_json` hoặc `back_json` mà không gửi lời giải mới,
  service phải mark explanation hiện tại là stale.

### 8.3. `flashcard_progress`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
flashcard_id uuid fk flashcards.id
is_known boolean
last_reviewed_at timestamp
review_count int default 0
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(student_user_id, flashcard_id)`.

---

## 9. Bài kiểm tra

### 9.1. `test_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
duration_seconds int
difficulty Difficulty default MIXED
difficulty_ratio_json jsonb?
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
is_reserve boolean default false
generated_by_user_id uuid? fk users.id
ai_generation_id uuid? fk ai_generations.id
question_count int default 0
total_score numeric default 10
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 9.2. `test_questions`

```txt
id uuid pk
test_set_id uuid fk test_sets.id
lesson_id uuid fk lessons.id
question_type QuestionType
question_json jsonb
options_json jsonb?
correct_answer_json jsonb
hint_json jsonb?
grading_config_json jsonb?
points numeric?
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
explanation_id uuid? fk ai_explanations.id
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Nếu `points` null, service tính điểm bằng nhau để tổng là 10.
- API trả thêm `effectivePoints` (không lưu cột riêng) để UI/flow chấm điểm dùng
  được điểm đã chia đều; phần dư do làm tròn được phân bổ theo thứ tự câu hỏi để
  tổng vẫn đúng `test_sets.total_score`.
- Với `TEXT_INPUT`, dùng `grading_config_json` như quiz.
- Test hỗ trợ đủ bốn loại `MULTIPLE_CHOICE`, `TRUE_FALSE`,
  `MULTI_STATEMENT_TRUE_FALSE`, `TEXT_INPUT` với cùng shape dữ liệu như Quiz.
- `test_questions.TRUE_FALSE` tiếp tục nhận một boolean chung.
  `test_questions.MULTI_STATEMENT_TRUE_FALSE` dùng danh sách mệnh đề và ánh xạ
  theo `statementId`; hai loại không được suy diễn hoặc chuyển đổi lẫn nhau.
- Khi admin sửa nội dung/correct answer/hint, service phải mark explanation stale hoặc xóa `explanation_id`.

### 9.3. `test_attempts`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
test_set_id uuid fk test_sets.id
status AttemptStatus default IN_PROGRESS
started_at timestamp
submitted_at timestamp?
duration_seconds int?
score numeric?
correct_count int default 0
wrong_count int default 0
total_count int default 0
is_best_for_lesson boolean default false
created_at timestamp
updated_at timestamp
```

Index:

- `(student_user_id, lesson_id)`.
- `(lesson_id, score, duration_seconds)` cho top 5 lesson.

Raw SQL:

```sql
CREATE UNIQUE INDEX test_attempts_one_best_per_student_lesson
ON test_attempts(student_user_id, lesson_id)
WHERE is_best_for_lesson = true;
```

Rules:

- Cập nhật best attempt phải chạy trong transaction.
- Best result ưu tiên điểm cao hơn; nếu bằng điểm, thời gian làm nhanh hơn.
- `lesson_progress.best_test_attempt_id` là nguồn chính; `is_best_for_lesson` là denormalized để query nhanh.

### 9.4. `test_attempt_answers`

```txt
id uuid pk
attempt_id uuid fk test_attempts.id
question_id uuid fk test_questions.id
answer_json jsonb
is_correct boolean
points_awarded numeric?
created_at timestamp
```

Constraint:

- unique `(attempt_id, question_id)`.

Rules:

- Với `MULTI_STATEMENT_TRUE_FALSE`, `answer_json` lưu mảng
  `{ statementId: string, value: boolean }`.
- Nếu câu có `N` mệnh đề và điểm hiệu lực là `P`, mỗi mệnh đề đúng nhận `P / N`,
  mệnh đề sai nhận 0; `points_awarded` là tổng điểm các mệnh đề đúng.
- `is_correct=true` chỉ khi mọi mệnh đề đều đúng. Việc một mệnh đề sai không
  xóa phần điểm của các mệnh đề đúng khác.

---
