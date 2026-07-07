# Hệ thống học theo lộ trình

Dự án MVP cho hệ thống học theo lộ trình. Repo dùng monorepo Turborepo, gồm front-end Next.js, back-end NestJS và package shared dùng chung.

## 1. Cài đặt lần đầu

Cần có:

```txt
Node.js
pnpm 11.10.0
```

Nếu chưa có pnpm:

```bash
npm install --global pnpm@11.10.0
```

Cài dependencies:

```bash
pnpm install
```

Tạo file môi trường local:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Không commit file `.env` thật. Các file `.env.example` chỉ chứa placeholder.

## 2. Chạy dự án local

Chạy cả front-end và back-end:

```bash
pnpm dev
```

Mở:

```txt
Front-end: http://localhost:3000
Back-end:  http://localhost:4000
Health:    http://localhost:4000/api/v1/health
```

Chạy riêng từng app:

```bash
pnpm --filter @learning-path/web dev
pnpm --filter @learning-path/api dev
```

Chạy bằng Docker local:

```bash
docker compose up --build
```

Docker local chạy:

```txt
Web:   http://localhost:3000
API:   http://localhost:4000
Redis: localhost:6379
```

## 3. Lệnh kiểm tra

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
```

Format code:

```bash
pnpm format
```

## 4. Cấu trúc repo

```txt
apps/web          Next.js front-end
apps/api          NestJS back-end
packages/shared   Type, schema, constant dùng chung
docs/             Tài liệu sản phẩm, kỹ thuật, UI, API, database
.codex/           Skill, prompt, plan, changelog cho Codex
```

## 5. Tài liệu chính

Codex đọc tài liệu theo cơ chế index trước, file chi tiết sau.

```txt
AGENTS.md                         Luật làm việc cao nhất cho Codex
docs/01-product-scope.md          Scope MVP và nghiệp vụ sản phẩm
docs/02-user-flows.md             Luồng sử dụng chính
docs/03-technical-architecture.md Kiến trúc và stack
docs/04-database-model.md         Index database
docs/database/                    Chi tiết database theo domain
docs/05-api-contract.md           Index API
docs/api/                         Chi tiết API theo domain
docs/06-ai-rag-spec.md            AI/RAG, embedding, retrieval, cache
docs/07-integration-and-env.md    Env và tích hợp bên thứ ba
docs/08-ui-pages-and-components.md Danh sách màn hình/component
docs/09-implementation-plan.md    Index milestone/subtask
docs/implementation/              Chi tiết từng milestone M0..M14
docs/implementation/dependency-graph.md Phụ thuộc task đọc nhanh
docs/implementation/feature-coverage-matrix.md Feature đã đủ DB/API/UI/worker/test chưa
docs/10-seed-data-and-test-cases.md Seed data và test case
docs/11-ui-design-system.md       Gu UI, token, responsive, screenshot review
docs/ui-references/               Pattern UI đã duyệt
docs/decisions/                   Decision log
.codex/context/current-context.md Trạng thái repo hiện tại cho Codex
.codex/context/code-index.md      Bản đồ code hiện tại cho Codex
```

## 6. Cơ chế đọc task Mx.y

Khi bạn giao task dạng `Mx.y`, Codex lấy phần milestone `Mx` để mở file chi tiết tương ứng.

```txt
M0.2  -> docs/implementation/M0.md
M1.4  -> docs/implementation/M1.md
M3.4  -> docs/implementation/M3.md
M8.3  -> docs/implementation/M8.md
M10.2 -> docs/implementation/M10.md
```

Luồng đọc chuẩn:

```txt
Bạn gõ /task-full M8.3
-> Codex đọc AGENTS.md
-> đọc docs/09-implementation-plan.md
-> lấy M8 từ M8.3
-> đọc docs/implementation/M8.md
-> đọc Mode của M8.3
-> đọc docs liên quan theo Task Routing Map trong AGENTS.md
-> đọc code hiện tại
-> nêu kế hoạch ngắn
-> mới sửa file
```

`Mode` cho biết task thuộc loại nào:

```txt
UI only             Chỉ UI/mock data
API only            Backend/API/service
UI + API            Có cả UI và API
DB only             Prisma/schema/migration/seed
Worker/Integration  Worker, queue, storage, AI, payment, realtime, deploy/tooling
Docs only           Chỉ tài liệu/kế hoạch
```

## 7. Cơ chế đọc database/API

`docs/04-database-model.md` và `docs/05-api-contract.md` chỉ là index. Khi task chạm domain cụ thể, Codex mở thêm file con.

Ví dụ database:

```txt
Auth/user        -> docs/database/auth-users.md
Payment          -> docs/database/payment-discount.md
AI/RAG/chat      -> docs/database/ai-rag-chat.md
Quiz/test        -> docs/database/quiz-flashcard-tests.md
Index/checklist  -> docs/database/indexes-and-checklist.md
```

Ví dụ API:

```txt
Auth/profile     -> docs/api/auth-profile.md
Payment/discount -> docs/api/payment-discount.md
AI chat          -> docs/api/ai-chat.md
Quiz/test        -> docs/api/quiz-flashcard-tests.md
Job status       -> docs/api/jobs.md
```

Ví dụ khi làm `/task-full M8.3`, Codex thường đọc:

```txt
docs/09-implementation-plan.md
docs/implementation/M8.md
docs/04-database-model.md
docs/database/payment-discount.md
docs/database/progress-enrollment.md
docs/05-api-contract.md
docs/api/payment-discount.md
docs/02-user-flows.md
docs/07-integration-and-env.md
```

## 8. Các skill Codex

Giao việc bằng một trong các lệnh:

| Bạn muốn | Dùng |
| --- | --- |
| Làm UI mới bằng mock data | `/task-ui Mx.y` |
| Sửa UI đã có theo feedback | `/change-ui ...` |
| Nối UI với API thật | `/task-connect Mx.y` |
| Làm trọn task | `/task-full Mx.y` |
| Refactor không đổi behavior | `/refactor ...` |
| Sửa bug | `/fix bug ...` |
| Thêm feature vào docs/roadmap, chưa code | `/add-feature ...` |
| Đổi feature trong docs/roadmap, chưa code | `/update-feature ...` |
| Xóa feature khỏi scope/roadmap, chưa code | `/delete-feature ...` |
| Hoãn feature sang version sau | `/move-feature-to-next-version ...` |
| Hỏi task tiếp theo | `/next-task` |
| Review docs/skills/workflow | `/review-docs` |
| Duyệt plan và bắt đầu làm | `/do` |
| Commit thay đổi | `/commit` |

```txt
/task-ui M3.4
/task-ui plan M3.4
/change-ui sửa màn landing page phần hero
/task-connect M3.4
/task-connect plan M3.4
/task-full M0.2
/task-full plan M1.2
/refactor M3.4
/update-feature thay đổi tính năng abc thành như này
/add-feature thêm mới tính năng abc
/delete-feature xóa tính năng abc
/move-feature-to-next-version tạm hoãn tính năng abc
/fix bug <mô tả lỗi>
/next-task
/review-docs
/do
/commit
```

Codex sẽ đọc docs liên quan trước khi code, không đổi stack, không thêm tính năng ngoài MVP, cập nhật changelog khi có thay đổi file và gợi ý bước tiếp theo sau khi xong.

Trong quá trình làm, Codex có thể tự cập nhật các file hỗ trợ nếu cần:

```txt
.codex/context/current-context.md     Trạng thái repo, task tiếp theo, blocker
.codex/context/code-index.md          Bản đồ module/path code
.codex/plans/codex-execution-plan.md  Ghi chú thứ tự/phụ thuộc/assumption nhỏ
docs/implementation/dependency-graph.md Phụ thuộc task/milestone
docs/implementation/feature-coverage-matrix.md Coverage DB/API/UI/worker/test
docs/decisions/                       Quyết định dài hạn
.codex/changelog/                     Lịch sử thay đổi ngắn
```

Các file trên là tài liệu hỗ trợ, không được dùng để tự đổi scope, stack hoặc nghiệp vụ đã chốt trong docs chính.

Các skill `/update-feature`, `/add-feature`, `/delete-feature`, `/move-feature-to-next-version` mặc định là docs/planning-only: chúng chỉnh tài liệu, roadmap và mã task trước; chưa code production nếu bạn không nói rõ.

### Plan mode cho task

Với `/task-ui`, `/task-connect` và `/task-full`, bạn có thể thêm chữ `plan` để Codex chỉ lập kế hoạch trước:

```txt
/task-full plan M1.2
/task-ui plan M3.5
/task-connect plan M3.4
```

Khi có `plan`, Codex sẽ:

- đọc docs/code liên quan đủ để lập kế hoạch,
- nêu rõ sẽ sửa file/module nào, thứ tự làm, check dự kiến, rủi ro và giả định,
- không sửa file, không chạy triển khai, không cập nhật changelog,
- dừng lại chờ bạn duyệt.

Sau đó bạn có thể nói:

```txt
ok, làm đi
/do
```

Codex sẽ dựa trên plan đã duyệt, kiểm tra lại code/docs nếu cần rồi mới bắt đầu triển khai. `/do` có tác dụng giống các câu "ok làm đi", "triển khai đi", "bạn làm giúp tôi", "bạn sửa giúp tôi". Nếu bạn muốn đổi kế hoạch, hãy phản hồi phần cần sửa; Codex sẽ chỉnh plan và chờ bạn duyệt lại.

### Giải thích kỹ thuật sau khi làm xong

Với `/task-full`, `/task-ui`, `/task-connect`, `/fix bug` và `/refactor`, Codex phải có phần `Giải thích kỹ thuật dễ hiểu`.

Mục tiêu của phần này là giúp owner không code vẫn hiểu được kỹ thuật:

- task/bug/refactor đang giải quyết vấn đề kỹ thuật gì,
- luồng code chạy qua các lớp nào,
- kỹ thuật/thư viện nào được dùng và vai trò của nó,
- vì sao chọn cách làm đó,
- file nào là điểm bắt đầu, file nào chứa logic chính,
- sau task này owner nên hiểu được kiến thức gì.

### Learning notes

Nếu phần giải thích kỹ thuật có giá trị học tập lâu dài, Codex sẽ cập nhật:

```txt
docs/learning-notes/
```

Cách lưu là feature-first:

- Tính năng end-to-end ghi vào `docs/learning-notes/features/`.
- Kiến thức nền dùng chung ghi vào `docs/learning-notes/foundation/`.
- Thuật ngữ dùng nhiều lần ghi vào `docs/learning-notes/glossary.md`.
- `docs/learning-notes/index.md` là mục lục các note đã có.

Codex không copy nguyên văn câu trả lời cuối vào learning notes. Codex phải đọc note cũ trước, merge vào đúng section, hạn chế trùng lặp và chỉ lưu kiến thức có giá trị đọc lại.

## 9. `/task-ui <mã task>`

Dùng khi muốn làm giao diện trước bằng mock data, chưa nối API thật.

Ví dụ:

```txt
/task-ui M3.4
/task-ui plan M3.4
```

Codex sẽ:

1. Đọc `AGENTS.md`, `docs/09-implementation-plan.md` và file milestone tương ứng.
2. Đọc `Mode` của subtask. Chỉ tiếp tục nếu mode là `UI only` hoặc `UI + API`.
3. Đọc UI docs: `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`.
4. Đọc API docs chỉ để hiểu data shape, không connect API.
5. Kiểm tra task có UI không. Nếu không có UI, Codex dừng và gợi ý lệnh phù hợp hơn.
6. Code UI mobile-first, vẫn ổn trên tablet/iPad và desktop.
7. Dùng mock data rõ ràng, dễ thay bằng API sau này.
8. Nếu app chạy được, kiểm tra responsive và có thể lưu screenshot vào `.codex/screenshots/`.
9. Cập nhật changelog.
10. Gợi ý bước tiếp theo, thường là `/task-connect <mã task>` nếu mode là `UI + API`.

Sau khi bạn review UI và nói `ưng rồi`, `ok rồi`, `đúng ý rồi` hoặc `chốt UI này`, Codex sẽ lưu pattern vào:

```txt
docs/ui-references/approved-patterns.md
```

Nếu bạn chốt một rule UI dùng rộng cho nhiều màn, Codex mới cập nhật thêm:

```txt
docs/11-ui-design-system.md
```

## 10. `/change-ui <màn/chỗ UI cần sửa>`

Dùng khi UI đã có rồi và bạn chỉ muốn sửa giao diện theo feedback, chưa chốt vào tài liệu thiết kế.

Ví dụ:

```txt
/change-ui màn landing page sửa hero gọn hơn và nút CTA nổi bật hơn
```

Codex sẽ:

1. Đọc `AGENTS.md`, UI design system, UI pages/components và approved patterns nếu có.
2. Xác định màn/component cần sửa.
3. Chỉ sửa front-end UI: layout, spacing, màu, typography, icon, state hiển thị, component composition.
4. Không sửa backend, API, database, Prisma, worker, payment, AI/RAG hoặc business logic.
5. Không tự cập nhật `docs/ui-references/approved-patterns.md`, `docs/11-ui-design-system.md` hoặc `docs/08-ui-pages-and-components.md` trong lúc chỉ đang sửa thử UI.
6. Chạy check UI phù hợp, có thể tạo screenshot review nếu app chạy được.
7. Cập nhật changelog ngắn vì repo có thay đổi file.

Khi bạn nói `Oke, ưng UI này`, `ưng rồi`, `ok rồi`, `đúng ý rồi` hoặc `chốt UI này`, Codex mới cập nhật tài liệu UI cần thiết:

```txt
docs/ui-references/approved-patterns.md
docs/11-ui-design-system.md nếu đó là rule UI dùng rộng
```

## 11. `/task-connect <mã task>`

Dùng sau khi UI mock đã ổn và cần nối API thật.

Ví dụ:

```txt
/task-connect M3.4
/task-connect plan M3.4
```

Codex sẽ:

1. Đọc UI đã làm, approved UI patterns nếu có, API docs và database docs liên quan.
2. Đọc `Mode` của subtask. Mode phù hợp nhất là `UI + API`.
3. Kiểm tra đã có UI/mock UI chưa. Nếu chưa có, Codex dừng và gợi ý `/task-ui <mã task>` hoặc `/task-full <mã task>`.
4. Giữ layout/UI đã duyệt, không redesign lớn.
5. Nếu API chưa có, code API đầy đủ theo phạm vi task.
6. Nếu database/schema còn thiếu và task cho phép, cập nhật schema/migration/docs tương ứng.
7. Thay mock data bằng API client/hooks, ưu tiên TanStack Query.
8. Backend vẫn enforce auth/RBAC/ownership, không chỉ guard bằng UI.
9. Chạy check phù hợp.
10. Cập nhật changelog.
11. Báo nguyên lý kết nối: UI gọi hook nào, hook gọi API nào, API đi qua controller/service/database như nào.

## 12. `/task-full <mã task>`

Dùng khi muốn Codex làm trọn một subtask trong một lượt.

Ví dụ:

```txt
/task-full M0.2
/task-full plan M1.2
```

Codex sẽ:

1. Đọc `AGENTS.md`.
2. Đọc `docs/09-implementation-plan.md`.
3. Map `Mx.y` sang `docs/implementation/Mx.md`.
4. Đọc `Mode` của subtask.
5. Đọc docs liên quan theo `Task Routing Map`.
6. Kiểm tra code hiện tại và dependency của task.
7. Làm đủ phần cần thiết của task theo mode: UI, API, database, worker/integration, shared types hoặc docs.
8. Không làm sang subtask khác nếu bạn chưa yêu cầu.
9. Nếu task quá lớn hoặc thiếu dependency, Codex sẽ báo và đề xuất tách nhỏ.
10. Chạy check phù hợp.
11. Cập nhật changelog.
12. Giải thích kỹ thuật dễ hiểu: mục tiêu, luồng code, kỹ thuật dùng, lý do, file quan trọng và kiến thức rút ra.
13. Gợi ý task tiếp theo.

## 13. `/refactor <mã task/tính năng/module>`

Dùng khi muốn làm sạch/cải thiện cấu trúc code hiện có mà không đổi behavior.

Ví dụ:

```txt
/refactor M3.4
/refactor tính năng thanh toán
/refactor apps/api auth module
```

Codex sẽ:

1. Đọc `AGENTS.md`.
2. Nếu có mã task, đọc `docs/09-implementation-plan.md` và `docs/implementation/Mx.md`.
3. Đọc docs domain liên quan theo `Task Routing Map`.
4. Kiểm tra code hiện tại, call site, test và `git status`.
5. Refactor có phạm vi hẹp: tách hàm/component/service, giảm duplication, cải thiện type, làm rõ luồng code.
6. Không cố ý đổi API contract, database schema, RBAC, payment behavior, AI/RAG behavior, env hoặc UI design.
7. Nếu phát hiện cần đổi behavior, Codex dừng và gợi ý dùng `/update-feature` hoặc `/fix bug`.
8. Chạy check phù hợp, cập nhật changelog.
9. Giải thích kỹ thuật dễ hiểu: luồng code trước/sau, kỹ thuật refactor đã dùng, vì sao giữ nguyên behavior nhưng code dễ bảo trì hơn.

## 14. `/update-feature <mô tả thay đổi>`

Dùng khi một tính năng đã có không làm theo cách cũ nữa, mà đổi sang logic/luồng mới.

Ví dụ:

```txt
/update-feature đổi thời hạn enrollment sau thanh toán từ 12 tháng thành 6 tháng
```

Codex sẽ:

1. Xác định đây là tính năng hiện có, không phải bug và không phải feature mới.
2. Đọc product scope, user flows, implementation milestone và docs domain liên quan.
3. Cập nhật tài liệu nguồn:
   - nghiệp vụ: `docs/01-product-scope.md`, `docs/02-user-flows.md`;
   - task/phạm vi: `docs/implementation/Mx.md`;
   - API: `docs/05-api-contract.md` và `docs/api/...`;
   - database: `docs/04-database-model.md` và `docs/database/...`;
   - UI/AI/env nếu bị ảnh hưởng.
4. Không code production nếu bạn không nói rõ "code luôn".
5. Nếu đổi scope/Done/dependency của task, Codex sửa mã task hiện có trong `docs/implementation/Mx.md`; chỉ tạo mã task mới nếu phát sinh phần việc riêng.
6. Nếu thứ tự/phụ thuộc đổi, Codex cập nhật `docs/09-implementation-plan.md`.
7. Chạy check phù hợp, cập nhật changelog.
8. Gợi ý bước code tiếp theo kèm mã task nếu xác định được, ví dụ `/task-full M8.3`.

## 15. `/add-feature <mô tả tính năng>`

Dùng khi muốn thêm một tính năng chưa có trong docs/roadmap.

Ví dụ:

```txt
/add-feature thêm tính năng học bổng cho học sinh
```

Codex sẽ:

1. Kiểm tra tính năng có thuộc MVP không.
2. Nếu ngoài MVP, Codex không tự code ngay; nó sẽ báo xung đột scope và hỏi/chờ bạn chốt.
3. Nếu được chốt đưa vào scope, Codex cập nhật product scope, user flows và implementation docs.
4. Nếu tính năng lớn, Codex tạo mã task mới trong milestone phù hợp, ví dụ thêm `M8.5` vào `docs/implementation/M8.md`.
5. Nếu tính năng nhỏ và đã nằm trong task cũ, Codex sửa scope task cũ thay vì tạo mã mới.
6. Nếu thứ tự/phụ thuộc đổi, Codex cập nhật `docs/09-implementation-plan.md`.
7. Không code production nếu bạn không nói rõ "code luôn".
8. Chạy check phù hợp, cập nhật changelog và gợi ý task tiếp theo kèm mã task nếu có.

## 16. `/delete-feature <mô tả tính năng>`

Dùng khi muốn bỏ một tính năng khỏi sản phẩm hoặc không hỗ trợ logic đó nữa.

Ví dụ:

```txt
/delete-feature bỏ tính năng livestream
```

Codex sẽ:

1. Xác định feature cần xóa và mức độ xóa: xóa khỏi UI, API, database, docs hay chỉ ngừng làm trong MVP.
2. Cập nhật product scope, user flows và implementation docs.
3. Nếu feature có mã task, Codex đánh dấu task đó là removed/out of scope hoặc xóa khỏi thứ tự triển khai nếu không còn cần chạy.
4. Codex không tự renumber các task khác trừ khi bạn yêu cầu rõ.
5. Cập nhật hoặc xóa API/database/UI/AI/env docs liên quan.
6. Không xóa code/data production nếu bạn không nói rõ "xóa/code cleanup luôn".
7. Nếu có nguy cơ mất dữ liệu hoặc migration phá dữ liệu, Codex phải hỏi lại trước khi làm destructive change.
8. Chạy check phù hợp, cập nhật changelog.
9. Gợi ý cleanup/code task tiếp theo kèm mã task nếu có.

## 17. `/move-feature-to-next-version <mô tả tính năng>`

Dùng khi tính năng tạm thời chưa làm ở MVP/current version, nhưng vẫn giữ lại cho version sau.

Ví dụ:

```txt
/move-feature-to-next-version tạm hoãn tính năng livestream sang version sau
```

Codex sẽ:

1. Xác định feature cần hoãn và giả định target là "version sau" nếu bạn không ghi rõ.
2. Không xóa feature như `/delete-feature`.
3. Cập nhật product scope/user flows để feature không còn thuộc current MVP/current version.
4. Giữ đủ tài liệu để sau này có thể làm lại feature đó.
5. Nếu feature có mã task, Codex đánh dấu task đó là deferred/next version trong `docs/implementation/Mx.md`.
6. Nếu task không còn nên chạy trong thứ tự hiện tại, Codex cập nhật `docs/09-implementation-plan.md`.
7. Codex không tự renumber các task khác.
8. Nếu code đã expose feature, Codex chỉ ẩn/vô hiệu hóa khỏi current version khi cần, không xóa dữ liệu destructive nếu bạn chưa chốt.
9. Cập nhật changelog và báo task nào đã chuyển sang version sau.

## 18. `/fix bug <mô tả lỗi>`

Dùng khi gặp lỗi cần sửa.

Ví dụ:

```txt
/fix bug lỗi 500 khi truy cập http://localhost:4000/
```

Codex sẽ:

1. Đọc docs liên quan tới module nghi ngờ.
2. Tái hiện lỗi hoặc lấy bằng chứng từ log/code.
3. Xác định nguyên nhân trước khi sửa.
4. Sửa nhỏ nhất có thể, không refactor lan rộng.
5. Chạy lại check phù hợp.
6. Cập nhật changelog nếu có thay đổi file đáng commit.
7. Báo nguyên nhân bug và giải thích kỹ thuật dễ hiểu: luồng lỗi trước khi sửa, luồng sau khi sửa, kỹ thuật đã dùng, file quan trọng và kiến thức rút ra.

Với bug nhỏ, Codex có thể dùng quy trình nhẹ hơn để sửa nhanh, nhưng vẫn phải giữ scope và không bỏ qua an toàn cơ bản.

## 19. `/next-task`

Dùng khi bạn không chắc nên làm gì tiếp theo.

Ví dụ:

```txt
/next-task
```

Codex sẽ:

1. Đọc implementation plan, milestone chi tiết, execution plan nếu có, changelog gần nhất và `git status`.
2. Xác định task nào đã xong, task nào còn phụ thuộc, task nào nên làm tiếp.
3. Nếu còn thay đổi chưa commit, Codex có thể gợi ý `/commit` trước.
4. Đề xuất một lệnh chính nên chạy tiếp và tối đa vài lựa chọn thay thế.

## 20. `/review-docs`

Dùng khi muốn rà soát bộ tài liệu, skill, prompt và README cho Codex.

Ví dụ:

```txt
/review-docs
```

Codex sẽ:

1. Kiểm tra `AGENTS.md`, README, docs index, skill và prompt.
2. Tìm reference cũ, lệnh cũ, mâu thuẫn scope, trùng rule hoặc chỗ quá dài.
3. Nếu bạn yêu cầu sửa, hoặc lỗi docs-only rõ ràng, Codex sẽ cập nhật file liên quan.
4. Cập nhật changelog và chạy check nhẹ nếu có sửa file.

## 21. `/do`

Dùng sau khi Codex vừa đưa plan/hướng triển khai và bạn muốn duyệt cho Codex bắt đầu làm.

Ví dụ:

```txt
/task-full plan M1.2
```

Sau khi đọc plan, nếu đồng ý:

```txt
/do
```

Codex sẽ:

1. Lấy plan rõ ràng gần nhất trong cuộc trò chuyện.
2. Kiểm tra lại `git status` và đọc lại docs/code nếu cần.
3. Thực hiện đúng workflow gốc của plan, ví dụ `/task-full`, `/task-ui`, `/task-connect`, `/fix bug`, `/refactor` hoặc `/change-ui`.
4. Không mở rộng phạm vi ngoài plan đã duyệt.
5. Chạy check phù hợp, cập nhật changelog nếu có thay đổi file.

Nếu không tìm thấy plan rõ ràng, Codex sẽ hỏi lại trước khi sửa file.

## 22. `/commit`

Dùng khi muốn Codex commit các thay đổi hiện tại.

Ví dụ:

```txt
/commit
/commit fast
/commit full
```

Codex sẽ:

1. Kiểm tra `git status`, diff và changelog.
2. Không sửa code production trong bước commit.
3. Bổ sung changelog ngắn nếu thiếu.
4. Kiểm tra không có secret/file rác rõ ràng.
5. Chọn chế độ kiểm tra:
   - `/commit`: smart mode, tự chọn check theo diff.
   - `/commit fast`: kiểm tra tối thiểu an toàn, phù hợp docs/skill nhỏ.
   - `/commit full`: chạy check rộng hơn, phù hợp dependency/schema/nhiều module.
6. Stage đúng file cần commit.
7. Commit bằng message ngắn theo format:

```txt
<type>(<scope>): <summary>
```

Ví dụ:

```txt
docs(codex): update task workflow guide
fix(api): handle root health check
```

Nên dùng `/commit fast` cho thay đổi docs/skill nhỏ, `/commit` cho đa số trường hợp bình thường, và `/commit full` khi có thay đổi dependency, Prisma/schema/migration, shared package hoặc nhiều module.

## 23. File Codex có thể tự cập nhật

Khi làm task, Codex có thể tự cập nhật một số file vận hành nếu việc đó giúp task rõ ràng, đúng thứ tự và không lệch contract.

```txt
.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md   Cập nhật khi có thay đổi file đáng commit
.codex/context/current-context.md                Cập nhật khi trạng thái repo/task tiếp theo/blocker thay đổi
.codex/context/code-index.md                     Cập nhật khi module/path code quan trọng thay đổi
.codex/plans/codex-execution-plan.md             Cập nhật nếu phát hiện phụ thuộc/TODO/thứ tự nhỏ cần chỉnh
docs/implementation/dependency-graph.md          Cập nhật nếu phụ thuộc task/milestone thay đổi
docs/implementation/feature-coverage-matrix.md   Cập nhật nếu coverage DB/API/UI/worker/test thay đổi
docs/decisions/                                  Cập nhật khi có quyết định dài hạn
docs/ui-references/approved-patterns.md          Cập nhật khi bạn chốt UI đã ưng
docs/11-ui-design-system.md                      Cập nhật khi bạn chốt rule UI dùng rộng
docs/05-api-contract.md + docs/api/              Cập nhật nếu task đổi API contract
docs/04-database-model.md + docs/database/       Cập nhật nếu task đổi schema/database
docs/06-ai-rag-spec.md                           Cập nhật nếu task đổi AI/RAG behavior
docs/07-integration-and-env.md                   Cập nhật nếu task đổi env/integration
```

Codex không được tự đổi scope lớn, stack công nghệ hoặc rule nghiệp vụ quan trọng. Nếu phát hiện mâu thuẫn lớn, Codex phải báo lại hoặc ghi `TODO`/`ASSUMPTION`.

## 24. Quy trình UI khuyến nghị

Với màn hình mới, nên đi theo thứ tự:

```txt
/task-ui <mã task>
review UI trong browser/screenshot
góp ý bằng /change-ui <màn/chỗ UI cần sửa>
nói "ưng rồi" khi chốt UI
/task-connect <mã task>
```

Nếu muốn làm nhanh cả UI, API và phần liên quan trong một lượt:

```txt
/task-full <mã task>
```

## 25. Lưu ý

- Mỗi lần nên giao một subtask, ví dụ `M3.4`.
- Nếu không chắc nên làm gì tiếp, dùng `/next-task`.
- Không dùng `/task-connect` khi chưa có UI mock, trừ khi bạn muốn Codex dừng và nhắc làm UI trước.
- Không dùng `/task-ui` cho task không có giao diện.
- Dùng `/change-ui` cho vòng chỉnh UI sau review; skill này không chốt pattern vào docs cho đến khi bạn nói UI đã ưng/chốt.
- Nếu task nhỏ hoặc bug nhỏ, Codex có thể dùng lean mode để hoàn thành nhanh.
- Nếu thay đổi file, Codex phải cập nhật changelog trong `.codex/changelog/`.
- Codex không tự commit nếu bạn chưa gọi `/commit` hoặc yêu cầu rõ.

## 26. Lean mode để làm nhanh task nhỏ

Với task nhỏ, docs-only, UI-only nhỏ, wording, config nhẹ hoặc bug cô lập, Codex được phép rút gọn quy trình để tối đa tốc độ.

Codex có thể:

- không chạy full lint/build/test toàn repo,
- chỉ chạy check nhỏ nhất đủ tin cậy,
- dùng `git diff --check`, `quick_validate.py`, typecheck package liên quan, curl nhỏ hoặc kiểm tra thủ công có ghi chú,
- ghi rõ `Not run: <lý do>` nếu bỏ qua check lớn.

Không dùng lean mode cho thay đổi rủi ro cao:

- auth/RBAC,
- payment,
- database/schema/migration,
- API contract,
- AI/RAG,
- worker/queue,
- storage/file upload,
- notification/realtime,
- security,
- thay đổi nhiều module cùng lúc.
