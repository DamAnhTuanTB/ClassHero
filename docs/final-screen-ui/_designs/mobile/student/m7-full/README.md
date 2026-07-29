# M7 Student Learning — Mobile Design

Viewport: `390 × 844`

Role: `STUDENT`

Theme chính: light. Hướng visual dùng semantic surface/border/status để có thể triển khai dark theme cùng scope code sau này.

## Flow outputs

- `flow-board.png`: ảnh tổng hợp toàn bộ flow.
- `flow-board.html`: viewer trực tiếp, có navigation và hướng dẫn từng node.
- `index.html`: entrypoint mở viewer.

## Cases

1. `01-lesson-enrolled`: lesson có enrollment; tab Bài học hiển thị tóm tắt trọng tâm, không liệt kê tài liệu.
2. `02-lesson-trial`: lesson học thử.
3. `03-lesson-paywall`: lesson không có quyền truy cập.
4. `04-quiz-runner`: gợi ý mở theo nút; kiểm tra từng đáp án trước khi xem lời giải.
5. `05-quiz-result`: kết quả gọn và bốn action xem lại/làm lại.
6. `06-flashcard-study`: học Flashcard.
7. `07-flashcard-summary`: chỉ còn ôn tất cả hoặc thẻ chưa thuộc.
8. `08-test-locked`: đã tới giờ nhưng vẫn khóa khi thiếu Quiz/Flashcard.
9. `09-test-runner`: làm test có timer.
10. `10-test-review`: kết quả đạt và action xem lại/làm lại/dùng điểm.
11. `10b-test-review-failed`: kết quả chưa đạt, cảnh báo làm lại và khóa dùng điểm.
12. `11-completion-leaderboard`: lesson completed và top 5.
13. `12-lesson-loading`: loading skeleton.
14. `13-content-error`: lỗi có retry.

Không có màn riêng cho Notes/Comments, Dashboard hoặc Personalized Lesson trong
scope triển khai này. Lesson thuộc lộ trình cá nhân dùng chung UI lesson chuẩn.

## References

- `docs/implementation/M7.md`
- `docs/02-user-flows.md` mục 10–17, 25 và 28
- `docs/08-ui-pages-and-components.md` mục 4
- `docs/11-ui-design-system.md`
- `docs/ui-references/approved-patterns.md` phần Student Explore Courses và Student Course Detail
- `docs/ui-references/code-patterns/student-learning-surfaces.md`
- `docs/ui-references/designs/student-course-detail/student-course-detail-mobile-v1.png`

Các ảnh này là production design target đang chờ owner duyệt; không tự động ghi vào approved patterns.
