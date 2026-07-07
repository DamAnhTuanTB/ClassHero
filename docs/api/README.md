# API Docs

Thư mục này chứa chi tiết API contract được tách từ `docs/05-api-contract.md`.

Quy tắc đọc:

- Luôn bắt đầu từ `docs/05-api-contract.md`.
- Khi thêm/sửa endpoint, đọc `conventions-errors-security.md`.
- Sau đó mở đúng file domain bên dưới.
- Không cần đọc toàn bộ thư mục nếu task chỉ chạm một domain.
- Nếu endpoint đổi data model, đọc thêm `docs/04-database-model.md`.
- Nếu endpoint liên quan AI/RAG, đọc thêm `docs/06-ai-rag-spec.md`.

Mapping nhanh:

| Domain | File |
| --- | --- |
| Convention, error, security | `conventions-errors-security.md` |
| Auth, current user, profile | `auth-profile.md` |
| Learning path, lesson, material, summary | `learning-paths-lessons.md` |
| Student lesson, notes, comments, favorites | `student-learning.md` |
| Quiz, flashcard, test, attempts | `quiz-flashcard-tests.md` |
| AI explanation, chat | `ai-chat.md` |
| Parent portal | `parent.md` |
| Payment, payOS, discount | `payment-discount.md` |
| Notification | `notification.md` |
| Report, moderation, news/events/livestream | `report-news.md` |
| Leaderboard | `leaderboard.md` |
| Job status | `jobs.md` |
