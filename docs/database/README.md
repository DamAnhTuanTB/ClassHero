# Database Docs

Thư mục này chứa chi tiết database model được tách từ `docs/04-database-model.md`.

Quy tắc đọc:

- Luôn bắt đầu từ `docs/04-database-model.md`.
- Sau đó mở đúng file domain bên dưới.
- Không cần đọc toàn bộ thư mục nếu task chỉ chạm một domain.
- Nếu schema đổi API request/response, đọc thêm `docs/05-api-contract.md`.
- Nếu schema đổi AI/RAG/cache/retrieval, đọc thêm `docs/06-ai-rag-spec.md`.

Mapping nhanh:

| Domain | File |
| --- | --- |
| Quy ước, enum | `conventions-and-enums.md` |
| Auth, users, parent-child link | `auth-users.md` |
| File, R2 metadata, document chunks | `files-documents.md` |
| Learning path, chapter, lesson, material, summary | `learning-paths-lessons.md` |
| Enrollment, progress, trial lesson | `progress-enrollment.md` |
| Quiz, flashcard, test, attempts | `quiz-flashcard-tests.md` |
| Background jobs | `background-jobs.md` |
| AI, RAG, chat, explanation cache | `ai-rag-chat.md` |
| Payment, discount, webhook logs | `payment-discount.md` |
| Notification, report, news/events/livestream | `notification-report-news.md` |
| Notes, gamification, audit log | `notes-gamification-audit.md` |
| Raw SQL index, checklist | `indexes-and-checklist.md` |
