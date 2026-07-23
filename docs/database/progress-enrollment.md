# Database Progress And Enrollment

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 6. Enrollment, progress và học thử

### 6.1. `enrollments`

```txt
id uuid pk
student_user_id uuid fk users.id
learning_path_id uuid fk learning_paths.id
delivery_learning_path_id uuid? unique fk learning_paths.id
paid_by_user_id uuid? fk users.id
payment_id uuid? fk payments.id
status EnrollmentStatus default ACTIVE
starts_at timestamp
expires_at timestamp
created_at timestamp
updated_at timestamp
```

Index/constraint:

- index `(student_user_id, learning_path_id, status)`.
- index `delivery_learning_path_id`.
- Raw SQL partial unique index cho một active enrollment.

Raw SQL:

```sql
CREATE UNIQUE INDEX enrollments_one_active_per_student_path
ON enrollments(student_user_id, learning_path_id)
WHERE status = 'ACTIVE';
```

Rules:

- Sau thanh toán thành công, `expires_at = paid_at + interval '12 months'`.
- Nếu đã có enrollment active còn hạn, không tạo payment/enrollment mới cho cùng student + learning path.
- Service hoặc scheduled job phải chuyển enrollment hết hạn sang `EXPIRED` khi cần.
- `learning_path_id` luôn là khóa `CATALOG` đã mua và là nguồn cho payment/doanh thu.
- `delivery_learning_path_id` nullable; khi null student học khóa đã mua, khi có giá trị student học private `PERSONALIZED` path đó.
- `delivery_learning_path_id` chỉ được gán sau khi clone hoàn tất; clone lỗi không được thay đổi enrollment.
- Bản được giao phải có `source_learning_path_id = enrollments.learning_path_id`.
- Mỗi personalized path chỉ thuộc tối đa một enrollment đang được giao; không được chia sẻ ngầm giữa nhiều học sinh.
- Sau khi đã gán `delivery_learning_path_id`, business service không cho clear hoặc đổi sang path khác; bản cá nhân trở thành curriculum chính thức của enrollment.
- Việc sửa sai sau activation thực hiện trên bản cá nhân và ghi audit, không chuyển enrollment về khóa gốc.

### 6.2. `lesson_progress`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
status LessonProgressStatus default NOT_STARTED
best_test_attempt_id uuid? fk test_attempts.id
best_score numeric?
best_duration_seconds int?
completed_at timestamp?
xp_awarded boolean default false
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(student_user_id, lesson_id)`.

Rules:

- Buổi học completed khi bài kiểm tra đạt `completion_min_score`, mặc định 7.
- `best_test_attempt_id` là nguồn chính cho kết quả tốt nhất.
- Nếu dùng thêm `test_attempts.is_best_for_lesson`, phải cập nhật trong transaction.
- Khi tạo bản cá nhân, backend dùng `source_lesson_id` để upsert trạng thái tiến độ tương ứng cho lesson clone; lesson mới không có source bắt đầu `NOT_STARTED`.
- Nếu source progress đã `xp_awarded = true`, progress ánh xạ trong bản cá nhân phải ngăn cộng XP lần hai.
- Attempt/note/comment/favorite cũ không được nhân bản thành record mới; student API truy xuất lịch sử liên quan qua lesson lineage khi cần.
- Mọi progress/attempt/note/comment/favorite tạo sau activation phải gắn với lesson/content của bản cá nhân.
- Progress percent, continue lesson và completion denominator luôn tính theo lộ trình hiệu lực của enrollment, không theo `learning_paths.total_lesson_count` của khóa đã mua một cách mù quáng.

### 6.3. Trial access

ASSUMPTION: Không cần bảng trial riêng ở MVP. Quyền học thử được tính bằng:

- `lessons.trial_enabled = true`.
- Student chưa có enrollment active.

Nếu cần tracking trial view, thêm bảng `trial_access_logs` sau.

---
