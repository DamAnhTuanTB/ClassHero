# AGENTS.md

Luật làm việc cấp cao cho Codex trong repo hệ thống học theo lộ trình. File này
chỉ giữ guardrail áp dụng rộng; chi tiết sản phẩm và kỹ thuật nằm trong `docs/*`,
quy trình theo command nằm trong `.codex/skills/*`.

## 1. Nguồn Sự Thật

- `AGENTS.md`: workflow, safety, scope và quality gate cấp repo.
- `docs/00-docs-map.md`: bản đồ chọn đúng tài liệu; không thay thế docs nguồn.
- `docs/01-product-scope.md` và `docs/02-user-flows.md`: MVP, role, nghiệp vụ và
  luồng người dùng.
- `docs/03-technical-architecture.md`: stack và kiến trúc.
- `docs/04-database-model.md` + `docs/database/*`: database.
- `docs/05-api-contract.md` + `docs/api/*`: API.
- `docs/06-ai-rag-spec.md`, `docs/07-integration-and-env.md`: AI/RAG và tích hợp.
- `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md` và
  `docs/ui-references/*`: UI và pattern đã duyệt.
- `docs/09-implementation-plan.md` + `docs/implementation/*`: thứ tự, phạm vi,
  dependency và coverage của milestone/subtask.
- `docs/10-seed-data-and-test-cases.md`,
  `docs/12-performance-and-observability.md`,
  `docs/13-seo-and-content-discovery.md` và
  `docs/14-source-code-structure.md`: test, performance, SEO và cấu trúc code.
- Code, call site và test hiện tại là bằng chứng cuối về trạng thái implementation.

Khi docs mâu thuẫn, ưu tiên: workflow trong `AGENTS.md` → product scope →
architecture → database → API → AI/RAG → performance/SEO → implementation order.
Báo rõ mâu thuẫn, quyết định tạm thời và file cần sửa; không âm thầm tự quyết.

## 2. Guardrail Bắt Buộc

- Không tự đổi stack, thêm tính năng ngoài MVP hoặc làm sang subtask khác khi owner
  chưa yêu cầu rõ.
- Không hard-code secret/token/API key/webhook key/config production; không sửa
  database production trực tiếp.
- Không revert, ghi đè hoặc gom thay đổi không liên quan của owner.
- Không dùng prompt ngắn của owner để bỏ qua contract liên quan. Nếu thiếu dữ liệu
  để làm an toàn, hỏi lại hoặc ghi rõ `ASSUMPTION`/`TODO`.
- Auto-approve của IDE không phải phê duyệt triển khai. Plan/artifact có approval
  gate vẫn phải chờ owner xác nhận bằng lời.
- Không tự commit. Không ghi changelog trong task thường; chỉ workflow `/commit`
  được cập nhật changelog và tạo commit.
- Sau khi sửa code, phải chạy ít nhất một check phù hợp hoặc kiểm tra output runtime;
  không báo hoàn tất khi chưa có bằng chứng và không giấu check đã bỏ qua.

### AI invariant

Prompt, heuristic, validator, semantic gate, policy và cách sửa lỗi AI phải dựa
trên invariant tổng quát, dùng lại được giữa các bài/lớp/dữ liệu tương đương. Không
hard-code lesson, figure, số liệu hoặc case đang lỗi chỉ để qua test. Case đơn lẻ
chỉ là regression fixture; bản sửa phải có quy tắc tổng quát và counterexample.
Ngoại lệ theo tài liệu chỉ hợp lệ khi là product contract do owner chốt và được
ghi trong docs.

### Provider trả phí

- Mặc định ưu tiên cache, mock và test local để ổn định harness,
  deterministic gate và các nhánh không phụ thuộc provider thật.
- Chỉ gọi provider thật khi owner yêu cầu test live. Yêu cầu đó đồng thời là phê
  duyệt chi phí. Trước khi chạy, Codex phải lập live acceptance matrix từ
  contract bị ảnh hưởng và chọn bộ case cần thiết đủ bao phủ các trường
  hợp chính cùng rủi ro quan trọng theo feature, subject, mode, role, state,
  input family, provider/model và fallback khi các trục đó thực sự áp dụng.
  Không cần chạy tích Descartes của mọi biến thể; các case tương đương
  có thể gộp khi nêu được lý do chúng cùng contract serialize và hành vi
  provider.
- Coverage là mục tiêu nghiệm thu; không chọn sample rẻ nhất hoặc phạm vi nhỏ
  nhất làm tiêu chí cắt case chính hoặc rủi ro quan trọng. Codex tự ước tính
  chi phí cho bộ coverage đã xác định và chạy ngay không xin xác nhận lần
  hai; chỉ tối ưu token, kích thước input và call trùng sau khi coverage đã đủ.
- Mọi run vẫn phải tuân budget guard. Nếu guard không đủ cho bộ case cần
  thiết, dừng trước khi vượt giới hạn, liệt kê các case `Not run` và không
  báo live test pass. Cache/artifact chỉ thay thế được khi chính case đang kiểm
  cache/reuse hoặc phần provider không đổi; không thay thế bằng chứng live của
  provider.
- Final phải báo matrix case `Pass/Fail/Not run`, provider thật hay cache cho
  từng nhóm, số lượng xử lý và usage/chi phí thực tế hoặc ước tính.

### Worker

Sau khi sửa `apps/api/src/workers/*` hoặc background job, phải restart worker hoặc
đưa owner block lệnh restart `pnpm dev`; không giả định hot reload đã áp dụng code.

### Owner feedback và lỗi tool

- Khi owner không hài lòng, trả lời thẳng vào điểm sai. Quy tắc tái sử dụng rút ra
  phải được ghi ngay vào nguồn phù hợp; sở thích UI một lần chỉ ghi khi owner chốt.
- Nếu tool UI báo `Bad Request`, kiểm tra thao tác thực tế, retry bằng command ngắn
  hơn và tiếp tục. Ưu tiên đọc/check độc lập song song, quote path phức tạp và dùng
  `apply_patch` cho file repo.

### Multi-agent

Chỉ khi owner yêu cầu multi-agent/subagent cho plan đã duyệt, dùng
`.codex/skills/multi-agent-execution/SKILL.md`. Skill đó là nguồn duy nhất cho
profile, role, concurrency, state machine, verification và final report; yêu cầu
multi-agent không mở rộng scope hay cấp quyền production/paid-provider.

## 3. Task Routing Map Và Cách Đọc

Mặc định dùng progressive disclosure: “đọc” nghĩa là đọc đúng mục/entry liên quan;
chỉ đọc toàn file khi được ghi rõ hoặc quyết định thực sự phụ thuộc toàn bộ file.

- Nếu runtime đã inject `AGENTS.md`, coi như đã đọc. Chỉ mở lại khi cần exact lines
  hoặc worktree vừa thay đổi file này.
- Task có mã `Mx.y`: đọc trọn block đó trong `docs/implementation/Mx.md`, gồm
  `Mode`, phạm vi, `Không làm`, `Done khi`. Chỉ tra roadmap index khi cần map thứ
  tự/dependency.
- Index database/API/UI/roadmap chỉ dùng để tìm contract hoặc file domain cần đọc.
- Context, code index, execution plan, dependency graph, coverage matrix, decision
  log và changelog chỉ mở để trả lời một câu hỏi trạng thái/dependency cụ thể.
- Luôn kiểm tra code, direct call site, test liên quan và `git status --short`.
- Mở rộng gói đọc khi diagnosis/implementation chạm thêm bề mặt contract.

Định tuyến bề mặt:

- Scope/role/flow → product scope và user flows.
- Stack/deploy/provider/env → architecture và integration/env.
- Schema/query → database index rồi file domain; thêm API nếu response đổi.
- Request/response/permission → API conventions/index rồi file domain.
- AI/RAG/OCR/prompt/cache → AI spec đúng feature; thêm DB/API/worker khi contract
  persisted hoặc execution flow đổi.
- UI → screen/role, design-system section và source-structure frontend; với
  form/modal/detail/action/upload/badge/state, đọc routing index rồi đúng một file
  trong `docs/ui-references/code-patterns/`.
- List/search/cache/query/job/latency → performance section đúng layer.
- Public/indexable/metadata/slug/sitemap → SEO section tương ứng.
- Seed/test fixture → test-data section/domain tương ứng.
- Tạo/di chuyển code → source-structure principles và đúng frontend/backend/shared
  section.

Chỉ đọc rộng khi onboarding, chọn task tiếp theo, plan milestone lớn, refactor
cross-cutting, đổi scope/stack hoặc audit toàn hệ thống. Bắt đầu từ docs map, mục
lục và search thay vì mở toàn bộ docs.

Trước khi sửa code, nêu plan ngắn: task/mode, contract section, file/layer và phần
tái sử dụng, impact docs/schema/API/UI/AI/env, cùng check dự kiến. Task quá mơ hồ
thì hỏi một câu ngắn hoặc ghi assumption; prompt files không phải source of truth.

## 4. Scope, Stack Và Cấu Trúc

MVP/stack chi tiết do product scope và architecture quản lý. Các điểm không được
tự đổi:

- Web: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion, TanStack
  Query, Zustand, React Hook Form, Zod, Tiptap và KaTeX/mhchem.
- API/data: NestJS REST, JWT/RBAC `ADMIN`/`STUDENT`/`PARENT`, Prisma, Supabase
  Postgres và pgvector.
- Async/storage: Redis + BullMQ worker riêng; Cloudflare R2, không dùng app/VPS disk
  làm storage upload chính.
- AI/integration/deploy: OpenAI chính, Gemini phụ qua `AiProvider`; payOS, Resend,
  Zalo OA/ZNS; VPS Ubuntu + Docker Compose + Nginx + Certbot.
- Socket.IO chỉ dùng notification realtime trong MVP. Ngoài MVP: chat realtime
  user-user, bạn thân, chat nhóm, format riêng Tiếng Anh, học bổng và chống gian
  lận bài kiểm tra.

Repo là Turborepo: `apps/web`, `apps/api`, `packages/shared`, `docs`, `.codex`.
Không đổi cấu trúc lớn nếu chưa được owner yêu cầu.

### Code chung

- TypeScript strict; tránh `any`; tên code bằng tiếng Anh; UI copy có thể bằng
  tiếng Việt; validate input bằng Zod hoặc DTO/class-validator.
- Xử lý lỗi rõ ràng, không nuốt lỗi; thao tác nhạy cảm phải audit/log theo contract.
- Không thêm package nặng nếu không cần. Schema đổi phải có migration an toàn.
- Cấu trúc/layer bám `docs/14-source-code-structure.md`; kiểm tra shared pattern
  trước khi tạo file mới.
- Frontend import nội bộ dùng `@/...`; backend `apps/api/src` dùng `#api/...`.
- Backend HTTP error phải qua `apps/api/src/common/errors` để giữ envelope chuẩn,
  không dựng Nest exception body rải rác trong domain.

### Frontend

- Backend vẫn enforce permission; UI guard không đủ. Route admin/student/parent
  phải có guard.
- UI phải production-like, có interaction/state thật và loading/empty/error/
  pending/disabled phù hợp; không để control giả thành công trong flow connected.
- Admin ưu tiên laptop-first; public/student/parent ưu tiên mobile-first. Mọi màn
  vẫn phải ổn trên mobile, tablet và desktop, cả light/dark theme.
- Form, modal, component boundary, responsive, performance và visual token bám
  `docs/11-ui-design-system.md`, `docs/ui-references/code-patterns/*` và
  `docs/14-source-code-structure.md`; không chép pattern cục bộ khác chuẩn.
- `/task-connect` phải giữ UI đã được owner chốt. Nếu owner yêu cầu bỏ một field,
  mặc định truy vết toàn contract UI → payload/type → API/service → DB/worker →
  test/docs, trừ khi owner nói rõ chỉ ẩn UI.
- UI được owner chốt phải được ghi bằng `/accept-ui`; screenshot/mockup chỉ là
  artifact tạm, không phải source of truth trong Git.

### Backend và domain nhạy cảm

- Backend enforce RBAC/ownership; controller xử lý HTTP boundary, service xử lý
  nghiệp vụ, DB/provider đi qua layer phù hợp. Job nặng nên enqueue BullMQ.
- API/list/query/cache/job/AI phải theo performance contract; public route phải
  theo SEO contract.
- Database, AI/RAG, payment, storage và notification phải theo đúng domain docs.
  Đặc biệt: AI output validate trước lưu; RAG giới hạn đúng lesson; payment webhook
  verify và idempotent; server tự tính tiền; private file check quyền; notification
  lưu DB trước khi realtime delivery.

## 5. Verification, Docs Và Hoàn Tất

### Verification theo rủi ro

- Docs/wording/tiny isolated: format, validator, `git diff --check` hoặc focused
  check nhỏ nhất đủ tin cậy.
- Code thường: typecheck package bị ảnh hưởng và focused tests; thêm lint/build/
  curl/runtime khi bề mặt cần.
- Auth/RBAC, payment, schema/migration, API contract, AI/RAG, worker/queue, storage,
  notification, security, shared hoặc multi-module: dùng đầy đủ focused test và
  package/integration/E2E gate phù hợp.
- Không gọi provider trả phí thật trong unit test mặc định. Nếu deterministic check
  tồn tại, không kết luận chỉ bằng code inspection.
- UI nhỏ không tự chạy browser/Playwright/screenshot nếu owner không yêu cầu; chỉ
  được nói static checks pass. UI/flow lớn vẫn cần runtime/E2E khi khả thi, nhưng
  chỉ lưu screenshot khi cần debug hoặc owner yêu cầu.
- Backend/API đang được owner test qua UI phải verify đúng origin web đang gọi;
  restart process stale thay vì chỉ test cổng thay thế.
- Check không chạy được phải ghi `Not run: <lý do>` trong final.

### Cập nhật tài liệu

Chỉ cập nhật nguồn có dữ liệu thật sự thay đổi:

- API/database/AI/env/UI/performance/SEO/source structure → docs domain tương ứng.
- Task status/path/dependency/coverage → context, code index, execution plan,
  dependency graph hoặc coverage matrix tương ứng.
- Quyết định dài hạn → `docs/decisions/`; lesson tái sử dụng →
  `docs/learning-notes/`; UI được duyệt → `/accept-ui`.

Không dùng việc cập nhật docs để tự đổi scope lớn, stack hoặc nghiệp vụ.

### Commit và Definition of Done

- Chỉ `/commit` được stage/commit và cập nhật
  `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` cho đúng batch. Không stage
  secret, generated/local artifact hoặc file ngoài scope.
- Commit message theo `<type>(<scope>): <summary>`; `/commit all` có thể chia nhiều
  commit an toàn theo scope.
- Task chỉ hoàn tất khi đúng scope/mode, không phá contract chính, thay đổi code có
  check tương xứng, thay đổi contract có docs/migration phù hợp, và mọi assumption,
  skipped check hoặc restart requirement đã được báo rõ.

Trước final response, gọi:

```bash
.codex/scripts/notify-task.sh done "/task-full M2.1" "Hoàn tất task và các check"
```

Đổi trạng thái thành `blocked` hoặc `failed` khi phù hợp. Notification không chứa
secret và lỗi notification không làm task thất bại.
Telegram notification đang tắt; không bật lại nếu owner chưa yêu cầu rõ.
