# 04. Database Model - Index mô hình dữ liệu

Bản v0.3. File này là index ngắn cho database docs.

Chi tiết model, field, constraint và checklist nằm trong `docs/database/`.

Local/dev dùng Docker Postgres + pgvector. Database staging/production dùng Supabase Postgres + pgvector. ORM dùng Prisma. Query vector/hybrid search có thể dùng raw SQL trong Prisma.

---

## 1. Cách Codex dùng file này

Khi task có database/schema/migration/seed:

1. Đọc file index này.
2. Mở file chi tiết phù hợp trong `docs/database/`.
3. Đối chiếu `docs/05-api-contract.md` nếu API response/request bị ảnh hưởng.
4. Đối chiếu `docs/06-ai-rag-spec.md` nếu liên quan document chunks, embedding, AI logs, chat hoặc explanation cache.
5. Nếu thay đổi schema thật, cập nhật Prisma schema và migration; changelog chỉ ghi trong workflow `/commit`.

Nếu task không đổi database, chỉ cần đọc file chi tiết liên quan để hiểu data shape.

---

## 2. Quy tắc database bắt buộc

- Dùng Postgres + pgvector; local chạy bằng Docker, staging/production chạy trên Supabase.
- Dùng Prisma schema làm nguồn định nghĩa chính.
- Migration phải được commit vào repo khi đổi schema.
- ID dùng UUID.
- Tiền VNĐ lưu bằng integer, không dùng float.
- Nội dung rich text lưu JSONB/Tiptap JSON.
- Embedding dùng pgvector, không trộn nhiều provider/model/dimension trong cùng vector space.
- Không trả `password_hash`, token hash hoặc secret ra API.
- Các thao tác nhạy cảm phải có audit/log phù hợp.

---

## 3. Mapping file chi tiết

| Khi làm về | Đọc file |
| --- | --- |
| Quy ước chung, enum | `docs/database/conventions-and-enums.md` |
| Auth, user, profile, refresh token, parent-child link | `docs/database/auth-users.md` |
| File upload, R2 metadata, lesson document, document chunks | `docs/database/files-documents.md` |
| Learning path, chapter, lesson, material, summary | `docs/database/learning-paths-lessons.md` |
| Enrollment, progress, trial lesson | `docs/database/progress-enrollment.md` |
| Quiz, flashcard, test, attempts | `docs/database/quiz-flashcard-tests.md` |
| Background jobs, queue/job status | `docs/database/background-jobs.md` |
| AI logs, explanation cache, chat, RAG | `docs/database/ai-rag-chat.md` |
| Payment, payOS, discount, webhook logs | `docs/database/payment-discount.md` |
| Notification, report, moderation, news/events/livestream | `docs/database/notification-report-news.md` |
| Notes, private comments, favorites, gamification, audit log | `docs/database/notes-gamification-audit.md` |
| Raw SQL index, pgvector index, Prisma checklist | `docs/database/indexes-and-checklist.md` |

---

## 4. Milestone routing nhanh

| Milestone | Database docs thường cần |
| --- | --- |
| `M1.x` | `conventions-and-enums`, file model tương ứng, `indexes-and-checklist` |
| `M2.x` | `auth-users` |
| `M3.x` | `learning-paths-lessons`, `files-documents` nếu có material |
| `M4.x` | `files-documents`, `background-jobs` |
| `M5.x` | `files-documents`, `ai-rag-chat`, `indexes-and-checklist` |
| `M6.x` | `quiz-flashcard-tests` |
| `M7.x` | `progress-enrollment`, `quiz-flashcard-tests`, `notes-gamification-audit` |
| `M8.x` | `payment-discount`, `progress-enrollment` |
| `M9.x` | `ai-rag-chat`, `background-jobs`, `files-documents` |
| `M10.x` | `notification-report-news`, `background-jobs` |
| `M11.x` | `auth-users`, `progress-enrollment`, `payment-discount` |
| `M12.x` | `notification-report-news`, `ai-rag-chat` nếu moderation AI |
| `M13.x` | `notes-gamification-audit`, `files-documents` nếu avatar |
| `M14.x` | File liên quan đến flow được test/harden/deploy |

---

## 5. Khi sửa docs database

- Nếu thêm/sửa model: cập nhật file chi tiết trong `docs/database/`.
- Nếu đổi API contract do schema đổi: cập nhật `docs/05-api-contract.md` hoặc file con trong `docs/api/`.
- Nếu đổi AI/RAG behavior: cập nhật `docs/06-ai-rag-spec.md`.
- Nếu thêm env/integration liên quan database/provider: cập nhật `docs/07-integration-and-env.md`.
