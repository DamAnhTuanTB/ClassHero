# 10. Seed Data and Test Cases - Dữ liệu mẫu và test case

Tài liệu này mô tả dữ liệu mẫu và test case cơ bản để kiểm tra hệ thống trong quá trình phát triển.

Không dùng secret thật trong seed.

---

## 1. Seed data mục tiêu

Seed data cần đủ để dev kiểm tra nhanh:

- Login admin.
- Student/parent account.
- Parent link child.
- Learning path Toán 7 và Lý 8.
- Mỗi learning path có ít nhất 1 chapter.
- Mỗi chapter có 2 lessons.
- Mỗi lesson có tài liệu mẫu, summary, quiz, flashcard, test.
- Có payment success sample.
- Có enrollment active.
- Có notification sample.
- Có report sample.

---

## 2. Users seed

### 2.1. Admin

```txt
email: admin@example.com
username: admin
password: 123456
role: ADMIN
```

### 2.2. Students

```txt
student1:
  email: student1@example.com
  phone: 0900000001
  username: student1
  password: Student123!
  full_name: Nguyễn Văn An
  grade: 7
  child_code: CHILD001

student2:
  email: student2@example.com
  phone: 0900000002
  username: student2
  password: Student123!
  full_name: Trần Minh Bình
  grade: 8
  child_code: CHILD002

student3:
  email: student3@example.com
  phone: 0900000003
  username: student3
  password: Student123!
  full_name: Lê Hà Chi
  grade: 9
  child_code: CHILD003
```

### 2.3. Parents

```txt
parent1:
  email: parent1@example.com
  phone: 0910000001
  password: Parent123!
  full_name: Phụ huynh An
  linked_child: student1

parent2:
  email: parent2@example.com
  phone: 0910000002
  password: Parent123!
  full_name: Phụ huynh Bình
  linked_child: student2
```

---

## 3. Learning paths seed

### 3.1. Toán 7

```txt
title: Toán 7
subject: MATH
grade: 7
original_price_vnd: 2000000
sale_price_vnd: 1500000
trial_enabled: true
status: PUBLISHED
```

Chapters/Lessons:

```txt
Chapter 1:
  title: Chương 1 - Số hữu tỉ
  order_index: 1
  overview: Tổng quan số hữu tỉ và các phép toán nền tảng.

  Lesson 1:
    title: Buổi 1 - Số hữu tỉ
    order_index: 1
    exam_open_at: now - 1 day
    completion_min_score: 7
    video_url: https://youtube.com/example-toan7-buoi1

  Lesson 2:
    title: Buổi 2 - Lũy thừa của số hữu tỉ
    order_index: 2
    exam_open_at: now + 7 days
    completion_min_score: 7
    video_url: https://youtube.com/example-toan7-buoi2
```

### 3.2. Lý 8

```txt
title: Lý 8
subject: PHYSICS
grade: 8
original_price_vnd: 1800000
sale_price_vnd: 1200000
trial_enabled: true
status: PUBLISHED
```

Lessons:

```txt
Lesson 1:
  title: Buổi 1 - Chuyển động cơ học
  order_index: 1
  exam_open_at: now - 1 day

Lesson 2:
  title: Buổi 2 - Vận tốc
  order_index: 2
  exam_open_at: now + 7 days
```

---

## 4. Content seed cho mỗi lesson

### 4.1. Summary

Tạo `lesson_summaries` với `content_json` đơn giản:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Tóm tắt kiến thức chính của buổi học." }
      ]
    }
  ]
}
```

### 4.2. Quiz set sample

Quiz set:

```txt
title: Quiz cơ bản
difficulty: EASY
source: ADMIN
review_status: APPROVED
```

Questions:

1. Multiple choice.
2. True/false.
3. Text input.

### 4.3. Flashcard set sample

Flashcards:

1. Khái niệm chính.
2. Công thức chính.
3. Lỗi thường gặp.

### 4.4. Test set sample

```txt
title: Bài kiểm tra ngắn
duration_seconds: 900
total_score: 10
question_count: 5
```

Questions:

- 3 câu dễ.
- 1 câu trung bình.
- 1 câu khó.

---

## 5. Payment/enrollment seed

Tạo một payment paid cho student1 mua Toán 7.

```txt
payer_user: student1
student_user: student1
learning_path: Toán 7
status: PAID
amount_vnd: 1500000
paid_at: now - 1 day
```

Tạo enrollment:

```txt
student_user: student1
learning_path: Toán 7
starts_at: paid_at
expires_at: paid_at + 12 months
status: ACTIVE
```

Tạo parent payment sample cho parent2 mua Lý 8 cho student2 nếu cần.

---

## 6. Notification seed

Tạo notification cho student1:

```txt
title: Bài kiểm tra đã mở
body: Bài kiểm tra Buổi 1 - Số hữu tỉ đã mở.
kind: SYSTEM
read_at: null
```

Tạo notification cho parent1:

```txt
title: Con bạn đã hoàn thành buổi học
body: Nguyễn Văn An đã hoàn thành Buổi 1 - Số hữu tỉ.
kind: SYSTEM
read_at: null
```

---

## 7. Report seed

Tạo report cho một quiz question:

```txt
reporter: student1
target_type: QUIZ_QUESTION
target_id: quiz_question_1
reason: Đáp án sai
description: Em nghĩ đáp án đúng là B.
status: OPEN
```

---

## 8. AI/RAG seed

Để test RAG không cần gọi AI thật:

- Tạo `lesson_documents` status READY.
- Tạo 3 `document_chunks` cho Toán 7 lesson 1.
- Tạo 3 `document_chunks` cho Lý 8 lesson 1.
- Embedding có thể mock bằng vector giả trong test hoặc bỏ qua trong seed nếu local DB chưa hỗ trợ.

ASSUMPTION: Seed dev có thể tạo document_chunks không embedding để test UI và admin flow. Test retrieval vector cần integration test riêng với pgvector.

---

## 9. Unit test cases

### 9.1. Auth

- Register student thành công.
- Register parent thành công.
- Duplicate email bị reject.
- Login đúng trả token.
- Login sai không tiết lộ account tồn tại.
- Refresh token revoked không dùng được.

### 9.2. RBAC

- Student không gọi được admin API.
- Parent không gọi được admin API.
- Student không xem được note/attempt của student khác.
- Parent không xem được child chưa link.
- Admin xem được report.

### 9.3. Learning path/chapter/lesson

- Admin tạo learning path môn MATH/PHYSICS/CHEMISTRY thành công.
- Môn ngoài scope bị reject.
- Chapter order index trùng trong cùng learning path bị reject.
- Lesson order index trùng trong cùng chapter bị reject.
- Public chỉ thấy PUBLISHED.
- Student grade 7 được ưu tiên Toán 7.

### 9.4. Payment

- Server tự tính amount, không tin client.
- Discount valid giảm đúng.
- Discount expired bị reject.
- payOS webhook invalid signature bị reject.
- payOS webhook paid tạo enrollment.
- Webhook gọi lại không tạo enrollment trùng.
- Enrollment expires_at = paid_at + 12 months.

### 9.5. Quiz

- Student start quiz attempt.
- Submit quiz chấm đúng/sai.
- Attempt submitted không sửa được.
- Student không submit attempt của người khác.

### 9.6. Flashcard

- Student mark known/unknown.
- Progress unique theo student + flashcard.
- Student khác không thấy progress.

### 9.7. Test

- Không start test trước `exam_open_at`.
- Start test sau `exam_open_at` thành công.
- Submit test tính score thang 10.
- Best attempt chọn điểm cao hơn.
- Nếu điểm bằng, best attempt chọn thời gian nhanh hơn.
- Score >= 7 đánh dấu lesson completed.
- XP không cộng trùng cho cùng lesson.

### 9.8. AI/RAG

- Retrieval filter đúng `lesson_id`.
- Không trả chunk lesson khác.
- AI output invalid schema bị reject.
- Cached explanation không gọi AI lần 2.
- Test question explanation chỉ hiện sau submit.
- Chat ngoài scope trả refusal.

### 9.9. Notification

- Tạo notification lưu DB.
- Mark read chỉ cho recipient.
- Manual notification chỉ admin gửi được.
- Notification realtime fail không làm mất DB notification.

### 9.10. Report

- Student report quiz question thành công.
- Report cả quiz set bị reject.
- Admin mark resolved thành công.
- Report action tạo audit log.

---

## 10. API integration test flows

### Flow A: Student mua và học Toán 7

1. Login student1.
2. List learning paths.
3. Create payment Toán 7.
4. Mock payOS webhook paid.
5. Verify enrollment active.
6. Open lesson 1.
7. Start quiz and submit.
8. Start test and submit score >= 7.
9. Verify lesson completed.
10. Verify XP event.

### Flow B: Parent mua cho con

1. Login parent1.
2. Link child by `CHILD001` nếu chưa link.
3. List child learning paths.
4. Create payment for child.
5. Mock webhook paid.
6. Verify enrollment belongs to child.

### Flow C: Admin tạo nội dung

1. Login admin.
2. Create learning path.
3. Create chapter.
4. Create lesson trong chapter.
5. Upload file mock.
6. Create quiz/flashcard/test.
7. Publish learning path.
8. Student sees path.

### Flow D: AI explanation cache

1. Student opens quiz question.
2. Request explanation.
3. Mock AI returns explanation.
4. Request same explanation again.
5. Assert AI provider called once.

---

## 11. Playwright E2E smoke tests

Ưu tiên E2E nhẹ:

1. Login admin, tạo lộ trình, chương học và buổi học.
2. Login student, xem danh sách lộ trình.
3. Student học thử buổi đầu.
4. Student làm quiz.
5. Student làm test đã mở.
6. Parent login, xem dashboard con.
7. Admin gửi notification thủ công, student thấy notification.

Không cần E2E quá nhiều ở giai đoạn đầu vì chi phí bảo trì cao.

---

## 12. Mock strategy

Trong test:

- Mock OpenAI/Gemini.
- Mock R2.
- Mock payOS.
- Mock Resend.
- Mock Zalo.
- Mock Socket.IO emit nếu cần.

Integration test có thể dùng test database riêng.

Không gọi provider thật trong CI mặc định.

---

## 13. Seed command đề xuất

```bash
pnpm --filter api prisma:seed
```

Hoặc:

```bash
cd apps/api
pnpm prisma db seed
```

Seed phải idempotent ở mức cơ bản:

- Nếu admin email đã tồn tại, không tạo trùng.
- Nếu learning path slug đã tồn tại, update hoặc skip.
- Nếu child code đã tồn tại, skip.

---

## 14. TODO

- TODO: Chốt công thức XP chính thức.
- TODO: Chốt nội dung seed rich text đầy đủ cho từng môn.
- TODO: Chốt sample PDF thật hoặc dùng fixture PDF nhỏ.
- TODO: Chốt test coverage threshold.
