# Current Codex Context

Last updated: 2026-07-08

File này ghi trạng thái ngắn của repo để Codex bắt đầu phiên làm việc nhanh hơn. Nó không thay thế `AGENTS.md` hoặc docs gốc trong `docs/`.

## 1. Trạng thái hiện tại

- Repo dùng monorepo Turborepo với `apps/web`, `apps/api` và `packages/shared`.
- Nền local đã có Next.js app, NestJS API, shared package, Docker local, env example và health/foundation code.
- Prisma foundation `M1.1` đã có nền kết nối Postgres/pgvector; `M1.2` đã thêm các model nền cho user/auth/profile/file/background job/audit log; `M1.3` đã thêm model learning path/lesson/document/enrollment/progress; `M1.4` đã thêm model quiz/flashcard/test/attempt/favorite/note/comment riêng; `M1.5` đã thêm payment/discount/webhook, notification, report, AI log/cache/chat, XP và news models; `M1.6` đã thêm seed dev tối thiểu cho admin/student/parent, Toán 7, lesson, quiz/flashcard/test, payment/enrollment và notification.
- Bộ docs đã được tách theo index và file con:
  - implementation: `docs/09-implementation-plan.md` + `docs/implementation/M*.md`
  - database: `docs/04-database-model.md` + `docs/database/*.md`
  - API: `docs/05-api-contract.md` + `docs/api/*.md`
- UI direction là mobile-first, vẫn phải ổn trên tablet/iPad và laptop/desktop, đồng thời ưu tiên cảm giác mượt, phản hồi nhanh và độ trễ cảm nhận thấp.
- Performance toàn hệ thống dùng `docs/12-performance-and-observability.md` cho frontend/API/database/worker/AI và đo đạc.
- SEO/public discovery dùng `docs/13-seo-and-content-discovery.md` cho landing, public course, news/event, metadata, sitemap, robots, canonical và structured data.

## 2. Quyết định workflow đang áp dụng

- `/task-full` là mặc định khi owner muốn làm trọn một subtask theo lát dọc.
- `/task-ui` dùng khi cần dựng UI/mock data trước để owner review.
- `/task-connect` dùng sau UI mock, code API đầy đủ nếu thiếu rồi nối UI với data thật.
- Thêm chữ `plan` sau skill task để Codex chỉ lập kế hoạch và chờ duyệt, ví dụ `/task-full plan M1.2`.
- `/do` có nghĩa là duyệt plan hoặc task tiếp theo đã được gợi ý và bắt đầu làm; nếu còn thay đổi đã xong chưa commit, `/do` có thể commit trước rồi triển khai task mới rõ ràng.
- `/do plan` có nghĩa là commit phần đã xong nếu cần, rồi lập plan cho task tiếp theo đã được gợi ý để owner duyệt trước khi làm.
- Task nhỏ/rủi ro thấp được dùng lean mode: chạy check nhỏ nhất đủ tin cậy, không bắt buộc full lint/build/test toàn repo.
- Khi làm public page có mục tiêu xuất hiện Google, Codex phải đọc SEO docs bên cạnh UI/performance docs.

## 3. Task tiếp theo nên ưu tiên

Theo roadmap hiện tại, sau `M1.6` nên làm:

```txt
/task-full M2.1
```

Mục tiêu `M2.1`: chuẩn hóa backend foundation module với env validation, global validation pipe, error response format, Swagger/OpenAPI và logger cơ bản.

## 4. Khi nào cập nhật file này

Codex nên cập nhật file này khi:

- Hoàn thành một milestone/subtask nền tảng.
- Có quyết định workflow hoặc kiến trúc ảnh hưởng nhiều task sau.
- Task tiếp theo khuyến nghị thay đổi.
- Có blocker hoặc assumption quan trọng cần nhớ qua phiên sau.

Không ghi secret, token, API key, private URL hoặc dữ liệu người dùng thật vào file này.
