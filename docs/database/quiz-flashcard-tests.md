# Database Quiz Flashcard Tests

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 7. Quiz

### 7.1. `quiz_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
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
- Học sinh chỉ nhận bộ khi chính bộ đã được admin phát hành
  (`review_status = APPROVED`) và không dùng bộ reserve trực tiếp.

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
source_metadata_json jsonb?
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
published_at timestamp?
explanation_id uuid? fk ai_explanations.id
solution_figure_mode QuizSolutionFigureMode default NONE
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index:

- `quiz_set_id`.
- `lesson_id`.
- `(lesson_id, review_status)`.
- `(quiz_set_id, published_at)`.

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
- Item Quiz do AI sinh lưu `source_metadata_json` gồm `aiGenerationId`,
  `generationQuestionIndex` và `quizExplanationBlock` thuộc riêng Quiz. Quiz
  không lưu source hash/chunk/page ở cấp câu và không đọc legacy `exampleBlock`.
  Student chỉ nhận projection `explanationBlock`, không nhận metadata nội bộ.
- `quizExplanationBlock` giữ `isGeometry` và bảng GT–KL khi schema môn/lớp yêu
  cầu. Phân loại Hình học không quyết định `solution_figure_mode`.
- `solution_figure_mode`: `NONE`, `REUSE_QUESTION` hoặc `EXTEND_QUESTION`.
  EXTEND luôn có revision lời giải trỏ `derived_from_question_revision_id` tới
  exact current revision của hình đề.
- Với `TEXT_INPUT`, các đáp án chấp nhận nằm trong `correct_answer_json`; `grading_config_json` chứa cấu hình so khớp như `caseSensitive`, `exactMatch` và có thể mở rộng thêm `trimWhitespace`, `numericTolerance`, `unitRequired`, `acceptedUnits`.
- Lời giải chi tiết do admin nhập tái sử dụng `ai_explanations`: `target_type=QUIZ_QUESTION`, `target_id=quiz_questions.id`, `source=ADMIN`, `review_status=APPROVED`; `quiz_questions.explanation_id` trỏ tới bản ghi này.
- Khi admin sửa nội dung/correct answer/hint, service phải mark explanation stale hoặc xóa `explanation_id` theo AI/RAG spec.
- `published_at` là watermark phát hành của từng câu, không phải snapshot JSON.
  Câu mới tạo, vừa sửa hoặc vừa duyệt có giá trị `null`; action `SAVE`/`PUBLISH`
  của bộ đóng dấu cho mọi câu `APPROVED` hiện tại. Student luôn lọc cả
  `review_status=APPROVED` và `published_at IS NOT NULL`.

### 7.2a. `quiz_figures`, `quiz_figure_revisions`, `quiz_figure_render_attempts`

- `quiz_figures` có tối đa một row cho mỗi `(quiz_question_id, role)` với role
  `QUESTION | SOLUTION`, giữ lifecycle, plan, subject snapshot và current/pending
  revision.
- `quiz_figure_revisions` là nguồn chuẩn của TeX/TikZ hoặc file `ADMIN_UPLOAD`,
  preview/delivery asset và lineage. Revision SOLUTION do AI mở rộng phải trỏ
  exact revision QUESTION đã dùng làm nền.
- `quiz_figure_render_attempts` audit từng lần provider/compile/render và usage.
- Đây là các bảng thuộc riêng Quiz, không FK/import sang `stem_figures` của
  Summary. AI không lưu crop/ảnh gốc SGK; admin upload là đường raster riêng.

### 7.3. `quiz_attempts`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
quiz_set_id uuid fk quiz_sets.id
source_attempt_id uuid? fk quiz_attempts.id
status AttemptStatus default IN_PROGRESS
started_at timestamp
submitted_at timestamp?
correct_count int default 0
wrong_count int default 0
total_count int default 0
current_question_index int default 0
created_at timestamp
updated_at timestamp
```

### 7.4. `quiz_attempt_answers`

```txt
id uuid pk
attempt_id uuid fk quiz_attempts.id
question_id uuid fk quiz_questions.id
answer_json jsonb
is_answered boolean default false
is_checked boolean default false
is_correct boolean
created_at timestamp
```

Constraint:

- unique `(attempt_id, question_id)`.

Rules:

- Khi start, mỗi câu được phép trong attempt có một answer placeholder nội bộ.
  Placeholder này chốt tập question ID ở server và chưa được tính là câu đã trả
  lời. Trong lúc làm, autosave cập nhật `answer_json`; `is_answered` chỉ bật khi
  đáp án đã đầy đủ theo loại câu, còn `is_checked` chỉ bật sau khi student bấm
  kiểm tra. Khi submit, payload phải chứa đúng một answer cho mọi placeholder;
  server chấm lại và cập nhật toàn bộ answer trong cùng transaction.
- Tập placeholder là nguồn chuẩn cho `total_count`, thứ tự và số câu khi resume,
  submit, retry hoặc review. Việc admin thêm hoặc soft-delete rồi lưu/phát hành
  câu không được thêm/xóa placeholder của attempt `IN_PROGRESS` đã tồn tại; thay
  đổi membership chỉ áp dụng cho attempt mới.
- `quiz_attempts.current_question_index` là vị trí resume dùng chung giữa các
  thiết bị. Client vẫn có thể mirror local để phản hồi nhanh nhưng server là
  nguồn chính.
- Attempt `ALL` có `source_attempt_id=null` là kết quả gốc. Mọi attempt có
  `source_attempt_id` là lượt phụ và trỏ tới attempt cha trực tiếp, nên chuỗi
  retry giữ được đúng bộ câu của từng lượt.
- Khi submit attempt phụ, row attempt đó vẫn giữ
  `correct_count`/`wrong_count`/`total_count` của chính lượt làm. Server đồng
  thời lần về attempt gốc và chỉ thay các answer đang sai bằng answer đúng mới,
  rồi tính lại thống kê toàn bài trên attempt gốc. Câu đã đúng không bị hạ
  thành sai bởi một retry cũ hoặc request đồng thời.
- Attempt `ALL` mới không có liên kết nguồn trở thành kết quả gốc hiện hành mới
  và không cộng dồn với kết quả trước đó. Attempt `ALL` có liên kết nguồn chỉ
  làm lại toàn bộ tập câu của lượt cha và vẫn thuộc chuỗi retry hiện tại.
- Lịch sử bộ Quiz của student chỉ liệt kê attempt gốc
  (`source_attempt_id=null`). Mỗi attempt gốc là một mục lịch sử độc lập được
  đánh số theo thứ tự bắt đầu `Bộ 1`, `Bộ 2`, ...; vì vậy khi hết bộ dự phòng và
  UI tái sử dụng cùng một `quiz_set_id`, attempt mới vẫn phải tạo thêm một mục
  lịch sử. Attempt retry không tạo thêm tên bộ trong danh sách này.
- Tại một thời điểm chỉ mục `IN_PROGRESS` hiện hành mới được hiển thị là đang
  làm. Các attempt đang dở cũ hơn lần submit gần nhất hoặc đã chuyển
  `CANCELLED` không xuất hiện trong lịch sử student.
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
source_metadata_json jsonb?
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
- Flashcard AI không sinh hoặc ghi `hint_json`; provenance được lưu riêng trong
  `source_metadata_json` và chỉ dùng ở flow quản trị.
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

Rules:

- Mỗi lần student đánh dấu đã thuộc/chưa thuộc đều upsert record, tăng
  `review_count` và cập nhật `last_reviewed_at`.
- Flashcard prerequisite hoàn thành khi mọi card được duyệt của ít nhất một set
  không dự phòng đã có `review_count > 0`; không yêu cầu mọi `is_known=true`.

### 8.4. `flashcard_study_sessions`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
flashcard_set_id uuid fk flashcard_sets.id
status AttemptStatus default IN_PROGRESS
started_at timestamp
completed_at timestamp?
reviewed_count int default 0
known_count int default 0
unknown_count int default 0
total_count int default 0
created_at timestamp
updated_at timestamp
```

### 8.5. `flashcard_study_session_items`

```txt
id uuid pk
session_id uuid fk flashcard_study_sessions.id
flashcard_id uuid fk flashcards.id
sort_order int default 0
is_known boolean?
reviewed_at timestamp?
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(session_id, flashcard_id)`.

Rules:

- `flashcard_progress` tiếp tục là trạng thái học mới nhất theo student/card và
  phục vụ prerequisite. `flashcard_study_sessions` cùng các item là snapshot
  theo từng lượt để resume và hiển thị lịch sử; không thay thế progress toàn cục.
- Mỗi lần bắt đầu một lượt học toàn bộ tạo một session mới, kể cả khi tái sử
  dụng lại cùng `flashcard_set_id`. Session được đánh số theo thứ tự bắt đầu
  `Bộ 1`, `Bộ 2`, ... trong lịch sử của lesson.
- Khi mọi item có `is_known`, session chuyển `SUBMITTED`, lưu
  `completed_at` và thống kê known/unknown. Session `IN_PROGRESS` hiện hành là
  mục duy nhất mang trạng thái đang làm; khi bắt đầu session mới, các session
  đang dở trước đó của student trong lesson chuyển `CANCELLED` và không hiển thị.
- `resumeExistingProgress=true` chỉ dùng để tạo session tương thích từ progress
  legacy chưa có session. Những item đã có progress được nạp vào snapshot mới;
  các lượt mới/làm lại thông thường bắt đầu với item chưa đánh dấu.

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
source_metadata_json jsonb?
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
- Item AI lưu `source_metadata_json` cùng shape provenance với quiz question.
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

- Submit attempt đạt ngưỡng tự động cập nhật best và lesson completion
  trong transaction. Attempt chưa đạt không hủy completion/best đã có.
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

- Khi start, answer placeholder chốt tập câu của đề. Timer auto-submit có thể
  thay placeholder bằng marker unanswered hợp lệ để lưu câu 0 điểm.
- Với `MULTI_STATEMENT_TRUE_FALSE`, `answer_json` lưu mảng
  `{ statementId: string, value: boolean }`.
- Nếu câu có `N` mệnh đề và điểm hiệu lực là `P`, mỗi mệnh đề đúng nhận `P / N`,
  mệnh đề sai nhận 0; `points_awarded` là tổng điểm các mệnh đề đúng.
- `is_correct=true` chỉ khi mọi mệnh đề đều đúng. Việc một mệnh đề sai không
  xóa phần điểm của các mệnh đề đúng khác.

---
