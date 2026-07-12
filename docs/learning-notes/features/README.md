# Feature Notes

Thư mục này lưu bài học kỹ thuật theo từng tính năng end-to-end.

Mỗi note nên giúp owner nhìn được toàn bộ luồng:

```txt
UI -> API client/hook -> Controller -> Service -> Prisma/provider -> Database/Worker/AI -> Response -> UI update
```

Nếu flow có nhiều nhánh hoặc điều kiện, thêm một sơ đồ Mermaid ngắn ngay gần phần tổng quan. Sơ đồ nên dùng chữ dễ hiểu, ví dụ "Đọc session/token trong trình duyệt" thay vì thuật ngữ framework, và không vẽ điều kiện bị lặp hoặc dư logic.

Ví dụ note tương lai:

- `auth.md`
- `course-browsing.md`
- `lesson-learning.md`
- `quiz-flashcard-test.md`
- `payment-enrollment.md`
- `ai-rag-chat.md`
- `notification.md`
- `parent-portal.md`

Không tạo note mới nếu chỉ khác tên nhưng cùng một flow. Hãy cập nhật note cũ và thêm section nếu cần.
