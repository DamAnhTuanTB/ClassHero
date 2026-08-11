# Learning Notes Index

File này giúp tìm nhanh bài học kỹ thuật theo tính năng hoặc chủ đề nền tảng.

## Feature Notes

| Note                                                                  | Chủ đề                                                                                               | Task liên quan | Trạng thái  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- | ----------- |
| [Admin course management](features/admin-course-management.md)        | Admin lộ trình/chương học/buổi học, API thật, upload ảnh qua MinIO                                   | `M3.4`, `M4.1` | Đã cập nhật |
| [Basic Auth API](features/auth-basic.md)                              | Auth, RBAC, profile base, refresh/reset password, auth UI nối API thật                               | `M2.2`-`M2.4`  | Đã cập nhật |
| [Lesson document processing](features/lesson-document-processing.md)  | Source document, page range mapping, paid OCR artifacts, lesson documents, BullMQ worker và chunking | `M4.2`-`M4.4`  | Đã cập nhật |
| [Payment và enrollment](features/payment-enrollment.md)               | payOS order, webhook signature, reconciliation trạng thái và enrollment idempotent                   | `M8.2`-`M8.4`  | Đã cập nhật |
| [Embedding và retrieval theo lesson](features/embedding-retrieval.md) | OpenAI embedding, durable worker, pgvector isolation, hybrid search và token budget                  | `M5.1`-`M5.4`  | Đã cập nhật |
| [Quiz, flashcard và test](features/quiz-flashcard-test.md)            | Rich content, CRUD, student runner, prerequisite, review, best/completion và Top 5                    | `M6.1`-`M7.5`  | Đã cập nhật |
| [Student course browsing](features/student-course-browsing.md)        | Student danh sách/khám phá/chi tiết lộ trình nối public API thật                                     | `M3.5`         | Đã cập nhật |
| [Cài đặt AI và provider operations](features/ai-provider-operations.md) | Model routing, Gemini fallback, OCR retry, price snapshot, usage, budget và admin UI                  | `M9.9-M9.11`, `M4.6` | Đã cập nhật |
| [Coverage hình Toán 3-9](features/math-diagram-coverage.md)             | 50 dạng hình theo tám family, bằng chứng local/live/SGK-SBT và các dạng chưa hỗ trợ                    | `M9.2`                | Snapshot v51 |

## Foundation Notes

| Note                                                                                     | Chủ đề                                                                        | Task liên quan    | Trạng thái  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ----------- |
| [API foundation](foundation/api-foundation.md)                                           | NestJS env validation, global validation, error envelope, Swagger, logger     | `M2.1`            | Đã cập nhật |
| [AI structured output và durable jobs](foundation/ai-structured-output-jobs.md)          | OpenAI structured output, Zod gate, durable jobs và lesson summary handler    | `M9.1`, `M9.2`    | Đã cập nhật |
| [Codex notification and Telegram control](foundation/codex-notification-and-telegram.md) | macOS notification, Telegram notification/control, LaunchAgent, transcript    | Codex tooling     | Đã cập nhật |
| [Frontend bundle isolation](foundation/frontend-bundle-isolation.md)                     | Tách bundle/CSS/provider theo route group khi admin và client chung Next app  | Performance audit | Đã cập nhật |
| [Fullscreen media layout](foundation/fullscreen-media-layout.md)                         | Full-bleed mobile và fullscreen fallback không bị transform/overflow cắt      | `M7.1`, `M15.1`   | Đã cập nhật |
| [Playwright UI checks](foundation/playwright-ui-checks.md)                               | Browser E2E, responsive screenshot và UI review local                         | `M2.4`, `M14.3`   | Đã cập nhật |
| [Prisma database foundation](foundation/prisma-database.md)                              | Prisma, migration, pgvector, PrismaService, seed dev và foundation models     | `M1.1`-`M1.6`     | Đã cập nhật |
| [Thông báo lỗi an toàn cho người dùng](foundation/user-facing-errors.md)                  | Chặn lỗi kỹ thuật rò vào toast/banner và ánh xạ sang câu tiếng Việt theo ngữ cảnh | Dùng chung toàn web | Đã cập nhật |
| [UI state persistence](foundation/ui-state-persistence.md)                               | Lưu trạng thái UI local như sidebar collapse qua refresh bằng browser storage | `M3.4`, `M3.5`    | Đã cập nhật |

## Glossary

Xem [glossary.md](glossary.md) để tra nhanh thuật ngữ kỹ thuật dùng lặp lại trong dự án.
