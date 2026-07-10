# Database Progress And Enrollment

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 6. Enrollment, progress và học thử

### 6.1. `enrollments`

```txt
id uuid pk
student_user_id uuid fk users.id
learning_path_id uuid fk learning_paths.id
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

### 6.3. Trial access

ASSUMPTION: Không cần bảng trial riêng ở MVP. Quyền học thử được tính bằng:

- `lessons.trial_enabled = true`.
- Student chưa có enrollment active.

Nếu cần tracking trial view, thêm bảng `trial_access_logs` sau.

---
