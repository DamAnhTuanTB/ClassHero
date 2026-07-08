# Current Codex Context

Last updated: 2026-07-08

File này ghi trạng thái ngắn của repo để Codex bắt đầu phiên làm việc nhanh hơn. Nó không thay thế `AGENTS.md` hoặc docs gốc trong `docs/`.

## 1. Trạng thái hiện tại

- Repo dùng monorepo Turborepo với `apps/web`, `apps/api` và `packages/shared`.
- Nền local đã có Next.js app, NestJS API, shared package, Docker local, Postgres + pgvector local, Redis, env example và health/foundation code.
- Prisma foundation `M1.1` đã có nền kết nối Postgres/pgvector; `M1.2` đã thêm các model nền cho user/auth/profile/file/background job/audit log; `M1.3` đã thêm model learning path/lesson/document/enrollment/progress; `M1.4` đã thêm model quiz/flashcard/test/attempt/favorite/note/comment riêng; `M1.5` đã thêm payment/discount/webhook, notification, report, AI log/cache/chat, XP và news models; `M1.6` đã thêm seed dev tối thiểu cho admin/student/parent, Toán 7, lesson, quiz/flashcard/test, payment/enrollment và notification; `M2.1` đã chuẩn hóa backend foundation với env validation, global validation pipe, error envelope, Swagger dev và logger cơ bản; `M2.2` đã thêm AuthModule cho register student/parent, login, JWT access token, refresh token rotate/revoke và logout; `M2.3` đã thêm JWT auth guard, RBAC guard/decorator, `GET /me`, cập nhật student profile và forgot/reset password; `M2.4` đã có UI mock cho login/register/forgot/reset password, chưa nối API thật.
- Bộ docs đã được tách theo index và file con:
  - implementation: `docs/09-implementation-plan.md` + `docs/implementation/M*.md`
  - database: `docs/04-database-model.md` + `docs/database/*.md`
  - API: `docs/05-api-contract.md` + `docs/api/*.md`
- UI direction là mobile-first, vẫn phải ổn trên tablet/iPad và laptop/desktop, đồng thời ưu tiên cảm giác mượt, phản hồi nhanh và độ trễ cảm nhận thấp.
- UI cho học sinh/phụ huynh phải thân thiện, chuyên nghiệp, ít lời và có năng lượng học tập: không dùng text kỹ thuật, không dùng panel/card chỉ để giải thích hệ thống, không để auth/register quá xám/lạnh; ưu tiên nền màu sáng, CTA nổi, ảnh/illustration học đường, font phù hợp và hành động chính rõ. Tránh ảnh người đi làm/coworking/corporate cho auth học sinh. Nếu auth dùng visual mạnh, ưu tiên split-screen desktop rõ ràng: trái visual/slogan dạng lời chào thương hiệu + câu định vị ngắn, phải form sạch. Có thể dùng display font riêng cho heading bên trái, nhưng form/body vẫn phải dễ đọc.
- Auth visual bên trái không được để chữ quá to/toàn đen hoặc panel quá đục che mất nền. Ưu tiên headline gradient/accent vừa phải, lớp nền trong nhẹ, icon học tập ngắn gọn và chuyển động tinh tế có tôn trọng reduced motion.
- Khi owner gửi ảnh reference UI, Codex phải trích phong cách phù hợp thay vì copy nguyên bố cục. Với auth/register/login, reference dashboard chỉ nên truyền cảm hứng về màu, bo góc, card, icon và năng lượng thị giác; màn vẫn phải là auth flow rõ ràng.
- Nếu owner nói reference là thiết kế mobile, Codex phải ưu tiên mobile layout giống reference trước; không tự thêm chip chân trang, tab phụ hoặc bước phụ ngoài flow hiện có.
- Performance toàn hệ thống dùng `docs/12-performance-and-observability.md` cho frontend/API/database/worker/AI và đo đạc.
- SEO/public discovery dùng `docs/13-seo-and-content-discovery.md` cho landing, public course, news/event, metadata, sitemap, robots, canonical và structured data.
- Database dev mặc định chạy local bằng Docker Postgres + pgvector; staging/production vẫn dùng Supabase Postgres.

## 2. Quyết định workflow đang áp dụng

- `/task-full` là mặc định khi owner muốn làm trọn một subtask theo lát dọc.
- `/task-ui` dùng khi cần dựng UI/mock data trước để owner review.
- `/task-connect` dùng sau UI mock, code API đầy đủ nếu thiếu rồi nối UI với data thật.
- Thêm chữ `plan` sau skill task để Codex chỉ lập kế hoạch và chờ duyệt, ví dụ `/task-full plan M1.2`.
- `/do` có nghĩa là duyệt plan hoặc task tiếp theo đã được gợi ý và bắt đầu làm; nếu còn thay đổi đã xong chưa commit, `/do` có thể commit trước rồi triển khai task mới rõ ràng.
- `/do plan` có nghĩa là commit phần đã xong nếu cần, rồi lập plan cho task tiếp theo đã được gợi ý để owner duyệt trước khi làm.
- Task nhỏ/rủi ro thấp được dùng lean mode: chạy check nhỏ nhất đủ tin cậy, không bắt buộc full lint/build/test toàn repo.
- Với task làm UI hoặc owner yêu cầu sửa UI, mặc định ưu tiên tốc độ: hạn chế typecheck/lint/build/E2E. Chỉ chạy check lớn khi thay đổi chạm shared component, form/state/route phức tạp, nhiều màn, data-connected UI, hoặc owner yêu cầu rõ. UI nhỏ chỉ cần `git diff --check`, format check nhỏ hoặc ghi chú kiểm tra thủ công.
- Khi owner ghi `sửa nhanh`, `fast`, hoặc `check nhẹ`, mặc định dùng fast path: đọc phạm vi nhỏ nhất, patch trực tiếp, không refactor/cleanup lan, không cập nhật changelog, không chạy typecheck/lint/build/Playwright/E2E trừ khi đụng auth/API/database/shared logic, route guard, form/session/data behavior hoặc có dấu hiệu TypeScript lỗi rõ.
- Khi làm public page có mục tiêu xuất hiện Google, Codex phải đọc SEO docs bên cạnh UI/performance docs.
- Khi owner không hài lòng và Codex đưa ra giải pháp/quy tắc mới có thể tái sử dụng, Codex phải tự ghi lại ngay vào docs/skill/context phù hợp, không chờ owner hỏi lại đã note chưa.
- Với các skill có làm UI, screenshot là opt-in: chỉ chụp/lưu ảnh khi command có từ `screenshot`, ví dụ `/task-ui screenshot M3.4`; nếu không có từ này thì vẫn kiểm tra responsive/browser khi hợp lý nhưng không tạo screenshot artifact.
- Với micro UI tweak như dịch vị trí ảnh, đổi một khoảng cách hoặc chỉnh một màu, phải dùng fast path: đọc đúng file liên quan, patch thuộc tính nhỏ nhất, không cập nhật changelog, check nhẹ tối đa; không gộp cleanup workflow/docs không liên quan vào cùng lượt sửa UI nếu owner không yêu cầu.
- Changelog chỉ được cập nhật trong workflow `/commit` khi commit thật sự được tạo. Mỗi chức năng/thay đổi chính của commit là một dòng ngắn; task thường, sửa nhanh và micro tweak không ghi changelog.
- Sau mỗi task/plan/commit, Codex phải gọi `.codex/scripts/notify-task.sh` trước final response để hiện thông báo rõ ràng trên macOS; dùng `done`, `blocked` hoặc `failed` theo trạng thái.
- Telegram notification/bot đang được tắt theo yêu cầu owner: `.codex/telegram/.env.local` có `CODEX_TELEGRAM_SUPPRESS_NOTIFY=1` và LaunchAgent Telegram đã remove. Không bật lại Telegram cho đến khi owner yêu cầu rõ.
- Repo có Telegram bot local ở `.codex/scripts/codex-telegram-bot.py`: chat ID được allow có thể chat/ra lệnh cho Codex qua Telegram với quyền full access trong repo; token thật nằm ở `.codex/telegram/.env.local` và không commit. Nên chạy bền bằng `.codex/scripts/install-telegram-launch-agent.sh`; mặc định dùng `telegram-thread` để Telegram có thread Codex riêng. Transcript local ghi ở `.codex/telegram/transcript.md` và bị ignore khỏi git.
- Web app đã có Playwright với Chromium cho UI review. Chỉ chạy chế độ sinh screenshot khi owner yêu cầu `screenshot`; report/results/screenshot local trong `.codex` là artifact bị ignore.
- Theo ưu tiên của owner, Codex phải ưu tiên tốc độ: dùng nhiều command/tool song song khi độc lập và an toàn, nhất là read-only như `rg`, `sed`, `git status`, `git diff`. Ưu tiên đọc/search/check song song tối đa khi độc lập; với edit file, gom nhiều chỉnh sửa liên quan vào một `apply_patch` hợp lý thay vì nhiều patch rời rạc, nhưng không chạy nhiều patch song song. Nếu Codex UI hiện `{"detail":"Bad Request"}` trong activity, coi đó là lỗi hiển thị/lớp tool trước khi kết luận app lỗi. Không được dừng task chỉ vì lỗi này; kiểm tra command thực tế, retry bằng lệnh đơn giản hơn nếu cần rồi tiếp tục phần việc chính. Khi session vừa gặp `Bad Request`, không dùng shell command nối chuỗi kiểu `&&`, `;` hoặc nhiều lệnh trong một activity. Chỉ hạ cấp sang từng bước cho thao tác vừa gây lỗi, output quá dài, path/ký tự phức tạp, heredoc/append shell hoặc sửa `.codex`. Ưu tiên `apply_patch` cho docs/changelog/skill.

## 3. Task tiếp theo nên ưu tiên

Theo roadmap hiện tại, sau UI mock `M2.4` nên làm:

```txt
/task-connect M2.4
```

Mục tiêu `M2.4` bước connect: thay mock auth UI bằng API auth/profile thật, lưu session/token theo pattern đã chốt và kiểm tra flow đăng ký/đăng nhập/forgot/reset từ UI.

## 4. Khi nào cập nhật file này

Codex nên cập nhật file này khi:

- Hoàn thành một milestone/subtask nền tảng.
- Có quyết định workflow hoặc kiến trúc ảnh hưởng nhiều task sau.
- Task tiếp theo khuyến nghị thay đổi.
- Có blocker hoặc assumption quan trọng cần nhớ qua phiên sau.

Không ghi secret, token, API key, private URL hoặc dữ liệu người dùng thật vào file này.
