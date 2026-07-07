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

- Với `TEXT_INPUT`, `grading_config_json` có thể chứa `acceptedAnswers`, `caseSensitive`, `trimWhitespace`, `numericTolerance`, `unitRequired`, `acceptedUnits`.
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

- Khi admin sửa `front_json`, `back_json` hoặc `hint_json`, service phải mark explanation stale hoặc xóa `explanation_id`.

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
- Với `TEXT_INPUT`, dùng `grading_config_json` như quiz.
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

---
