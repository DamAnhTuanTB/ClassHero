# Current Codex Context

Last updated: 2026-07-10

File này ghi trạng thái ngắn của repo để Codex bắt đầu phiên làm việc nhanh hơn. Nó không thay thế `AGENTS.md` hoặc docs gốc trong `docs/`.

## 1. Trạng thái hiện tại

- Repo dùng monorepo Turborepo với `apps/web`, `apps/api` và `packages/shared`.
- Nền local đã có Next.js app, NestJS API, shared package, Docker local, Postgres + pgvector local, Redis, env example và health/foundation code.
- Prisma foundation `M1.1` đã có nền kết nối Postgres/pgvector; `M1.2` đã thêm các model nền cho user/auth/profile/file/background job/audit log; `M1.3` đã thêm model learning path/lesson/document/enrollment/progress; `M1.4` đã thêm model quiz/flashcard/test/attempt/favorite/note/comment riêng; `M1.5` đã thêm payment/discount/webhook, notification, report, AI log/cache/chat, XP và news models; `M1.6` đã thêm seed dev tối thiểu cho admin/student/parent, Toán 7, lesson, quiz/flashcard/test, payment/enrollment và notification; `M2.1` đã chuẩn hóa backend foundation với env validation, global validation pipe, error envelope, Swagger dev và logger cơ bản; `M2.2` đã thêm AuthModule cho register student/parent, login, JWT access token, refresh token rotate/revoke và logout; `M2.3` đã thêm JWT auth guard, RBAC guard/decorator, `GET /me`, cập nhật student profile và forgot/reset password; `M2.4` đã nối auth UI với API thật cho login/register student/register parent/forgot/reset password, dùng TanStack Query mutations, lưu session/token client-side bằng Zustand + browser storage, và bổ sung explicit DTO validation pipe để auth API validate ổn khi chạy dev bằng `tsx`; `M3.1` đã thêm public published learning path API tối thiểu và admin learning path CRUD/publish API có RBAC, validation, pagination và audit log; `M3.2` đã thêm admin lesson API cho list/create/detail/update/delete/publish lesson trong learning path, có RBAC, validation video URL/order/completion score, unique order handling, total lesson count update và audit log; `M3.3` đã nâng public/student learning path API với optional auth, ưu tiên grade của student, `gradeGroups`, course summary, id-or-slug detail và active enrollment/trial state; `M3.4` đã có UI admin mock-first tại `/admin/courses` để quản lý lộ trình và buổi học bằng local state/form validation.
- Bộ docs đã được tách theo index và file con:
  - implementation: `docs/09-implementation-plan.md` + `docs/implementation/M*.md`
  - database: `docs/04-database-model.md` + `docs/database/*.md`
  - API: `docs/05-api-contract.md` + `docs/api/*.md`
- UI direction là mobile-first, vẫn phải ổn trên tablet/iPad và laptop/desktop, đồng thời ưu tiên cảm giác mượt, phản hồi nhanh và độ trễ cảm nhận thấp.
- Hệ thống sẽ có chế độ chuyển theme sáng/tối; khi làm UI phải ưu tiên semantic token/CSS variable/dark variants, tránh hard-code màu chỉ hợp light mode và phải nghĩ trước contrast/state cho cả hai theme.
- Mỗi khi làm UI, kết quả phải giống production thật cả về visual lẫn interaction: mock data được phép, nhưng control không được tĩnh giả bấm. Button/checkbox/tab/menu/input/toggle/modal/filter/pagination/upload/editor/icon có vẻ tương tác phải có semantic element, state/handler thật, feedback bấm và pending/disabled/loading/error/success khi phù hợp.
- UI cho học sinh/phụ huynh phải thân thiện, chuyên nghiệp, ít lời và có năng lượng học tập: không dùng text kỹ thuật, không dùng panel/card chỉ để giải thích hệ thống, không để auth/register quá xám/lạnh; ưu tiên nền màu sáng, CTA nổi, ảnh/illustration học đường, font phù hợp và hành động chính rõ. Tránh ảnh người đi làm/coworking/corporate cho auth học sinh. Nếu auth dùng visual mạnh, ưu tiên split-screen desktop rõ ràng: trái visual/slogan dạng lời chào thương hiệu + câu định vị ngắn, phải form sạch. Có thể dùng display font riêng cho heading bên trái, nhưng form/body vẫn phải dễ đọc.
- Auth visual bên trái không được để chữ quá to/toàn đen hoặc panel quá đục che mất nền. Ưu tiên headline gradient/accent vừa phải, lớp nền trong nhẹ, icon học tập ngắn gọn và chuyển động tinh tế có tôn trọng reduced motion.
- Khi owner gửi ảnh reference UI, Codex phải trích phong cách phù hợp thay vì copy nguyên bố cục. Với auth/register/login, reference dashboard chỉ nên truyền cảm hứng về màu, bo góc, card, icon và năng lượng thị giác; màn vẫn phải là auth flow rõ ràng.
- Nếu owner nói reference là thiết kế mobile, Codex phải ưu tiên mobile layout giống reference trước; không tự thêm chip chân trang, tab phụ hoặc bước phụ ngoài flow hiện có.
- Khi chỉnh auth UI theo feedback, nếu một màn sibling như login đã có nhịp visual ổn, ưu tiên đồng bộ layout/spacing/ảnh với màn đó trước khi thử cấu trúc mới; không xử lý overlap bằng cách thu ảnh quá nhỏ làm mất trọng tâm visual.
- Auth mobile hero description dưới headline phải đồng nhất ở các trang login/register/forgot/reset và giới hạn tối đa 50% chiều rộng vùng hero để tránh đè lên ảnh minh họa.
- Auth brand slogan và hero description phải dùng hai màu cố định khác nhau giữa các dòng, nhưng mỗi dòng phải đồng nhất màu giữa các màn auth; brand slogan dùng xanh sky đậm để vẫn giữ mood brand nhưng tách khỏi chữ `Class`, hero description dùng xám dễ đọc, không để cả hai cùng dùng một gradient/theme color.
- Auth desktop hero description nên lớn hơn mobile một chút và không xuống dòng trên laptop/desktop, áp dụng trong shell dùng chung để đồng bộ giữa login/student/parent/recovery; mobile vẫn giữ giới hạn width để tránh đè ảnh.
- Auth form controls phải đúng ngữ nghĩa và có tương tác thật: tài khoản/username dùng icon user, nút mắt mật khẩu phải là button có `aria-label` và toggle `input type` giữa password/text, còn "Ghi nhớ đăng nhập" phải là checkbox stateful chứ không dùng icon tĩnh.
- Auth login secondary actions dưới CTA như "Ghi nhớ đăng nhập" và "Quên mật khẩu?" phải nằm cùng một dòng cả trên mobile, dùng layout một hàng với nội dung không tự rớt dòng.
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
- Theo preference mới của owner, từ nay không tự chạy browser check, Playwright UI, screenshot hoặc kiểm tương tác thật cho mỗi task/bug/sửa UI; owner sẽ tự kiểm tra. Chỉ chạy các check code tĩnh/focused trừ khi owner yêu cầu rõ kiểm browser/screenshot.
- Khi owner bảo "ghép API", "nối API", "connect API" hoặc dùng `/task-connect` sau khi đã feedback UI, mặc định hiểu UI hiện tại đã được chốt/ưng. Codex phải giữ nguyên layout, field, label, placeholder, validation UX và flow màn hình; nếu API/database hiện tại chưa khớp UI thì sửa API contract, backend, database hoặc mapping payload cho phù hợp, không tự thêm/xóa/sửa field UI để ép theo DTO cũ nếu owner không yêu cầu rõ.
- Sau khi sửa backend/API cho UI owner đang test, phải verify đúng API origin web đang gọi, thường là `localhost:4000`; nếu cổng này đang có dev server cũ thì restart server đó rồi curl lại payload lỗi. Không chỉ verify trên cổng tạm như `4001` rồi để owner tiếp tục hit bản cũ ở `4000`.
- Khi làm public page có mục tiêu xuất hiện Google, Codex phải đọc SEO docs bên cạnh UI/performance docs.
- Khi owner không hài lòng và Codex đưa ra giải pháp/quy tắc mới có thể tái sử dụng, Codex phải tự ghi lại ngay vào docs/skill/context phù hợp, không chờ owner hỏi lại đã note chưa.
- Task có sửa code phải đọc `docs/14-source-code-structure.md` và nêu rõ source layer dự kiến trước khi edit: front-end route/page -> feature screen/hook/component/schema/data/utils/shared component, back-end controller/service/DTO/select/serializer/utils/types/common errors.
- Với các skill có làm UI, screenshot/browser/Playwright/kiểm tương tác thật là opt-in: chỉ chạy khi owner yêu cầu rõ, ví dụ command có từ `screenshot` hoặc nói "kiểm bằng browser"; nếu không có yêu cầu đó thì dùng check code tĩnh/focused và để owner tự kiểm UI/tương tác.
- Với micro UI tweak như dịch vị trí ảnh, đổi một khoảng cách hoặc chỉnh một màu, phải dùng fast path: đọc đúng file liên quan, patch thuộc tính nhỏ nhất, không cập nhật changelog, check nhẹ tối đa; không gộp cleanup workflow/docs không liên quan vào cùng lượt sửa UI nếu owner không yêu cầu.
- Backend HTTP exception/error phải dùng helper/factory chung trong `apps/api/src/common/errors` thay vì tự `new BadRequestException`/`UnauthorizedException`/`ConflictException` kèm body rải rác trong module; Prisma known errors cũng ưu tiên mapper dùng chung tại đó.
- Changelog chỉ được cập nhật trong workflow `/commit` khi commit thật sự được tạo. Mỗi commit có một entry/đoạn ngắn gọn, liền mạch tóm tắt các thay đổi chính; task thường, sửa nhanh và micro tweak không ghi changelog.
- `/commit` smart/fast phải tối ưu thời gian cho UI nhỏ/docs: nếu chỉ đổi copy, màu, spacing, Tailwind class, vị trí ảnh, static layout hoặc docs/skill/context thì bỏ qua package typecheck mặc định; chỉ chạy typecheck khi diff chạm TS behavior, props, form/state handler, route/shared primitive/schema/session/data hoặc có dấu hiệu lỗi TypeScript.
- Sau mỗi task/plan/commit, Codex phải gọi `.codex/scripts/notify-task.sh` trước final response để hiện thông báo rõ ràng trên macOS; dùng `done`, `blocked` hoặc `failed` theo trạng thái.
- Telegram notification/bot đang được tắt theo yêu cầu owner: `.codex/telegram/.env.local` có `CODEX_TELEGRAM_SUPPRESS_NOTIFY=1` và LaunchAgent Telegram đã remove. Không bật lại Telegram cho đến khi owner yêu cầu rõ.
- Repo có Telegram bot local ở `.codex/scripts/codex-telegram-bot.py`: chat ID được allow có thể chat/ra lệnh cho Codex qua Telegram với quyền full access trong repo; token thật nằm ở `.codex/telegram/.env.local` và không commit. Nên chạy bền bằng `.codex/scripts/install-telegram-launch-agent.sh`; mặc định dùng `telegram-thread` để Telegram có thread Codex riêng. Transcript local ghi ở `.codex/telegram/transcript.md` và bị ignore khỏi git.
- Web app đã có Playwright với Chromium cho UI review khi owner yêu cầu rõ. Mặc định không tự chạy browser/Playwright/screenshot; report/results/screenshot local trong `.codex` là artifact bị ignore.
- Theo ưu tiên của owner, Codex phải ưu tiên tốc độ: dùng nhiều command/tool song song khi độc lập và an toàn, nhất là read-only như `rg`, `sed`, `git status`, `git diff`. Ưu tiên đọc/search/check song song tối đa khi độc lập; với edit file, gom nhiều chỉnh sửa liên quan vào một `apply_patch` hợp lý thay vì nhiều patch rời rạc, nhưng không chạy nhiều patch song song. Nếu Codex UI hiện `{"detail":"Bad Request"}` trong activity, coi đó là lỗi hiển thị/lớp tool trước khi kết luận app lỗi. Không được dừng task chỉ vì lỗi này; kiểm tra command thực tế, retry bằng lệnh đơn giản hơn nếu cần rồi tiếp tục phần việc chính. Khi session vừa gặp `Bad Request`, không dùng shell command nối chuỗi kiểu `&&`, `;` hoặc nhiều lệnh trong một activity. Chỉ hạ cấp sang từng bước cho thao tác vừa gây lỗi, output quá dài, path/ký tự phức tạp, heredoc/append shell hoặc sửa `.codex`. Ưu tiên `apply_patch` cho docs/changelog/skill.

## 3. Task tiếp theo nên ưu tiên

Theo roadmap hiện tại, sau khi hoàn thành UI mock `M3.4` nên làm:

```txt
/task-connect M3.4
```

Mục tiêu `M3.4`: nối UI admin quản lý lộ trình/buổi học với API `M3.1` và `M3.2`, giữ nguyên layout/field/validation UX đã dựng. Code UI hiện đã tách theo feature: route gọi `AdminCoursesManager`, manager compose layout, `use-admin-courses-manager.ts` giữ local state/form orchestration, `admin-courses-schemas.ts` giữ Zod/form types, `admin-courses-utils.ts` giữ mapper/formatter/helper, `components/` giữ các UI block. Auth routes đã chuyển sang `apps/web/app/(auth)/layout.tsx` để dùng Next.js layout chung thay vì từng page tự bọc shell. Form controls dùng shared primitives từ `apps/web/components/forms`, được nâng từ auth pattern đã duyệt và tách mỗi component một file; các task UI sau phải kiểm tra shared/approved patterns trước khi tạo control/hook/client mới.

## 4. Khi nào cập nhật file này

Codex nên cập nhật file này khi:

- Hoàn thành một milestone/subtask nền tảng.
- Có quyết định workflow hoặc kiến trúc ảnh hưởng nhiều task sau.
- Task tiếp theo khuyến nghị thay đổi.
- Có blocker hoặc assumption quan trọng cần nhớ qua phiên sau.

Không ghi secret, token, API key, private URL hoặc dữ liệu người dùng thật vào file này.
