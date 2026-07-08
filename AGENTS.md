# AGENTS.md

File này là luật làm việc cấp cao cho Codex trong repo hệ thống học theo lộ trình.

Mục tiêu của `AGENTS.md` là điều phối cách Codex đọc tài liệu, chọn phạm vi, code, test, cập nhật docs/changelog và báo cáo. Chi tiết sản phẩm/kỹ thuật nằm trong các file `docs/*`; không lặp lại toàn bộ ở đây.

---

## 1. Nguồn Tài Liệu

Codex phải xem các tài liệu sau là nguồn chính của dự án:

| File                                             | Vai trò                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `AGENTS.md`                                      | Quy tắc cao nhất về cách Codex làm việc trong repo                                 |
| `docs/00-docs-map.md`                            | Bản đồ đọc docs nhanh cho owner/Codex; không thay thế docs nguồn                   |
| `docs/01-product-scope.md`                       | Scope MVP, role, nghiệp vụ sản phẩm                                                |
| `docs/02-user-flows.md`                          | Luồng sử dụng chính                                                                |
| `docs/03-technical-architecture.md`              | Kiến trúc, stack, deploy                                                           |
| `docs/04-database-model.md`                      | Index database model, quan hệ, constraint                                          |
| `docs/database/*.md`                             | Chi tiết database theo domain                                                      |
| `docs/05-api-contract.md`                        | Index REST API contract giữa web và API                                            |
| `docs/api/*.md`                                  | Chi tiết API contract theo domain                                                  |
| `docs/06-ai-rag-spec.md`                         | AI/RAG, embedding, retrieval, cache                                                |
| `docs/07-integration-and-env.md`                 | Env, provider, tích hợp bên thứ ba                                                 |
| `docs/08-ui-pages-and-components.md`             | Danh sách màn hình/component                                                       |
| `docs/09-implementation-plan.md`                 | Index milestone/subtask, thứ tự triển khai và phụ thuộc                            |
| `docs/implementation/M*.md`                      | Chi tiết phạm vi/Done từng milestone, ví dụ `M8.3` đọc `docs/implementation/M8.md` |
| `docs/implementation/dependency-graph.md`        | Bản đồ phụ thuộc đọc nhanh giữa milestone/subtask                                  |
| `docs/implementation/feature-coverage-matrix.md` | Ma trận kiểm tra feature đã đủ DB/API/UI/worker/test chưa                          |
| `docs/10-seed-data-and-test-cases.md`            | Seed data và test case cơ bản                                                      |
| `docs/11-ui-design-system.md`                    | Gu UI, token, responsive, screenshot/review                                        |
| `docs/12-performance-and-observability.md`       | Chuẩn hiệu năng, độ trễ, cache, query, worker, AI và đo đạc                        |
| `docs/13-seo-and-content-discovery.md`           | SEO, metadata, sitemap, robots, canonical, structured data cho trang public        |
| `docs/decisions/`                                | Decision log cho quyết định dài hạn                                                |

Nếu có `.codex/plans/codex-execution-plan.md`, dùng file đó để kiểm tra thứ tự/phụ thuộc, nhưng không dùng để thay thế docs gốc.

Nếu có `.codex/context/current-context.md` hoặc `.codex/context/code-index.md`, dùng để định hướng nhanh trạng thái repo và vị trí code, nhưng vẫn phải đọc docs/code gốc trước khi sửa.

Nếu cần định tuyến nhanh bộ tài liệu, đọc `docs/00-docs-map.md`; file này chỉ là bản đồ, không phải nguồn thay thế cho `AGENTS.md`, docs domain hoặc code thật.

---

## 2. Nguyên Tắc Bắt Buộc

- Không tự đổi stack công nghệ đã chốt.
- Không thêm tính năng ngoài MVP.
- Không làm sang subtask khác nếu owner chưa yêu cầu rõ.
- Không hard-code secret, token, API key, webhook key hoặc config production.
- Không revert/sửa thay đổi không liên quan của user.
- Không dùng prompt ngắn của owner làm lý do để bỏ qua docs liên quan.
- Nếu thiếu thông tin để code an toàn, hỏi lại hoặc ghi rõ `TODO`/`ASSUMPTION`.
- Nếu phát hiện mâu thuẫn lớn giữa docs, báo owner hoặc ghi rõ quyết định tạm thời; không âm thầm tự quyết.
- Khi thay đổi file đáng commit, cập nhật changelog.

### 2.1. Khi Owner Không Hài Lòng

Khi owner đưa ra feedback không hài lòng, ví dụ "tôi không đồng ý", "làm cẩu thả", "không đúng ý", "sai rồi", "không ổn", Codex phải:

- Trả lời thẳng vào vấn đề, nhận diện rõ điều cần đổi.
- Nếu Codex đưa ra giải pháp, quy tắc mới hoặc cách hiểu mới có giá trị tái sử dụng, phải tự ghi lại ngay vào tài liệu/skill/context phù hợp trong cùng lượt làm việc.
- Không chờ owner hỏi lại kiểu "bạn đã note lại chưa".
- Nếu feedback chỉ là sở thích tạm thời cho một màn hình, ghi vào `docs/ui-references/approved-patterns.md` chỉ khi owner xác nhận chốt/ưng; nếu là rule workflow hoặc chất lượng áp dụng rộng, ghi vào `AGENTS.md`, skill liên quan, `docs/11-ui-design-system.md` hoặc context phù hợp.
- Cập nhật changelog khi có sửa file.

### 2.2. Tránh Lỗi Hiển Thị Tool `Bad Request`

Nếu Codex UI hiển thị lỗi tool dạng `{"detail":"Bad Request"}`, thường đó là lỗi hiển thị/lớp tool của Codex, không phải lỗi app trong repo. Để giảm khả năng owner hiểu nhầm mà vẫn giữ tốc độ:

- Theo ưu tiên của owner, Codex phải ưu tiên tốc độ: dùng nhiều command/tool song song khi độc lập và an toàn, nhất là các lệnh read-only ngắn như `rg`, `sed`, `git status`, `git diff`.
- Chỉ hạ cấp sang từng bước khi chính thao tác vừa chạy tạo `Bad Request`, output quá dài, hoặc command có nhiều path/ký tự phức tạp khiến UI tool dễ render lỗi.
- Luôn quote path có khoảng trắng, dấu ngoặc hoặc Unicode tổ hợp; ví dụ dùng `'apps/web/app/(public)/page.tsx'`.
- Không dùng shell heredoc/append kiểu `cat <<EOF >> file` cho file repo, đặc biệt trong `.codex`; khi sửa docs/changelog/skill, dùng `apply_patch`.
- Không dùng shell command nối chuỗi kiểu `&&`, `;` hoặc nhiều lệnh trong một activity khi session vừa gặp `Bad Request`; chạy từng command đơn lẻ để activity UI không render lỗi. Vẫn có thể đọc song song các lệnh read-only ngắn khi an toàn.
- Nếu lỗi vẫn xuất hiện, không được dừng task chỉ vì lỗi này. Kiểm tra xem command thực tế có chạy được không; nếu chưa rõ, retry bằng command đơn giản hơn hoặc đọc/sửa file bằng cách khác. Báo rõ với owner rằng đó là lỗi hiển thị của Codex tool rồi tiếp tục phần việc chính.

---

## 3. Cách Đọc Tài Liệu

### Đọc đầy đủ

Áp dụng khi onboarding lần đầu, khởi tạo repo, làm milestone lớn, refactor kiến trúc, hoặc task ảnh hưởng nhiều module.

Thứ tự đọc:

1. `AGENTS.md`
2. `docs/01-product-scope.md`
3. `docs/03-technical-architecture.md`
4. `docs/04-database-model.md`
5. `docs/05-api-contract.md`
6. `docs/02-user-flows.md`
7. `docs/06-ai-rag-spec.md`
8. `docs/07-integration-and-env.md`
9. `docs/08-ui-pages-and-components.md`
10. `docs/09-implementation-plan.md`
11. File milestone liên quan trong `docs/implementation/`
12. `docs/10-seed-data-and-test-cases.md`
13. `docs/11-ui-design-system.md` nếu task có UI
14. `docs/12-performance-and-observability.md` nếu task ảnh hưởng hiệu năng/độ trễ/cache/query/worker/AI
15. `docs/13-seo-and-content-discovery.md` nếu task ảnh hưởng trang public/indexable hoặc SEO metadata

### Đọc theo phạm vi task

Áp dụng cho task nhỏ hoặc task đã có module rõ ràng.

Luôn đọc:

- `AGENTS.md`
- `docs/09-implementation-plan.md`
- File milestone tương ứng trong `docs/implementation/`
- docs liên quan theo `Task routing map`
- code hiện tại của module đang sửa
- changelog gần nhất nếu cần hiểu thay đổi trước đó

Nếu task đang làm lan sang domain khác, mở thêm docs liên quan. Ví dụ:

- Database đổi API response: đọc `docs/04-database-model.md`, file con trong `docs/database/`, `docs/05-api-contract.md` và file con trong `docs/api/`.
- AI explanation đổi cache/schema: đọc `docs/06-ai-rag-spec.md`, `docs/04-database-model.md`, file con trong `docs/database/`, `docs/05-api-contract.md`, file con trong `docs/api/`.
- Payment ảnh hưởng enrollment: đọc `docs/05-api-contract.md`, `docs/api/payment-discount.md`, `docs/04-database-model.md`, `docs/database/payment-discount.md`, `docs/database/progress-enrollment.md`, `docs/02-user-flows.md`.

---

## 4. Quy Trình Bắt Đầu Mỗi Task

Trước khi sửa code, Codex phải:

1. Đọc `AGENTS.md`.
2. Đọc yêu cầu của owner.
3. Xác định task thuộc milestone/subtask nào trong `docs/09-implementation-plan.md`.
4. Đọc chi tiết subtask trong file milestone tương ứng, ví dụ `M8.3` đọc `docs/implementation/M8.md`.
5. Chọn docs cần đọc theo `Task routing map`.
6. Đọc docs liên quan trước khi code.
7. Kiểm tra code hiện tại và `git status --short`.
8. Nêu kế hoạch ngắn:
   - subtask/milestone,
   - docs đã đọc,
   - module/file dự kiến sửa,
   - có cần cập nhật API/database/AI/UI/env docs không,
   - check/test dự kiến chạy.

Nếu task quá mơ hồ, hỏi lại hoặc ghi `ASSUMPTION`, không tự suy diễn nghiệp vụ lớn.

---

## 5. File Codex Có Thể Tự Cập Nhật

Trong quá trình làm task, Codex có thể cập nhật các file sau nếu cần để task rõ ràng, đúng thứ tự và không lệch contract:

- `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md`: khi có thay đổi file đáng commit.
- `.codex/context/current-context.md`: khi trạng thái repo, task tiếp theo, blocker hoặc quyết định workflow quan trọng thay đổi.
- `.codex/context/code-index.md`: khi tạo/di chuyển module, entrypoint, API client, worker hoặc shared schema quan trọng.
- `.codex/plans/codex-execution-plan.md`: nếu phát hiện dependency, thứ tự subtask, `TODO` hoặc `ASSUMPTION` nhỏ cần chỉnh.
- `docs/implementation/dependency-graph.md`: khi thêm/xóa/hoãn task hoặc đổi phụ thuộc giữa milestone/subtask.
- `docs/implementation/feature-coverage-matrix.md`: khi feature đổi coverage DB/API/UI/worker/test hoặc status.
- `docs/decisions/`: khi có quyết định dài hạn về workflow, kiến trúc, scope, UI rule hoặc tích hợp.
- `docs/ui-references/approved-patterns.md`: khi owner xác nhận UI đã "ưng rồi", "ok rồi", "đúng ý rồi" hoặc "chốt UI này".
- `docs/11-ui-design-system.md`: khi owner chốt một rule UI áp dụng rộng.
- `docs/12-performance-and-observability.md`: nếu task làm đổi chuẩn hiệu năng, cache, query, worker, AI latency hoặc observability.
- `docs/13-seo-and-content-discovery.md`: nếu task làm đổi chuẩn SEO, index/noindex, metadata, sitemap, robots, canonical, structured data hoặc nội dung public indexable.
- `docs/learning-notes/`: khi phần giải thích kỹ thuật có giá trị học tập lâu dài; ghi theo feature-first, merge vào note cũ khi có thể và tránh copy trùng final response.
- `docs/05-api-contract.md` và file con trong `docs/api/`: nếu task làm đổi API contract hoặc behavior API.
- `docs/04-database-model.md` và file con trong `docs/database/`: nếu task làm đổi schema/database model.
- `docs/06-ai-rag-spec.md`: nếu task làm đổi AI/RAG behavior.
- `docs/07-integration-and-env.md`: nếu task làm đổi env hoặc tích hợp bên thứ ba.

Không được dùng các file này để tự đổi scope lớn, stack hoặc nghiệp vụ quan trọng.

---

## 6. Phạm Vi Milestone/Subtask

- Một lần owner giao task mặc định chỉ làm một subtask.
- Không gom nhiều milestone nếu owner không yêu cầu rõ.
- Mỗi subtask trong `docs/implementation/M*.md` có dòng `Mode`; Codex phải đọc mode này trước khi chọn làm UI, API, DB, worker/integration hay docs-only.
- Nếu phải sửa file thuộc subtask khác để task hiện tại chạy được, ghi rõ lý do trong kế hoạch và changelog.
- Nếu một subtask quá lớn, đề xuất chia nhỏ trước khi code.
- `docs/09-implementation-plan.md` quy định thứ tự triển khai, không được dùng để thay đổi scope/stack đã chốt.

---

## 7. Task Routing Map

| Nhóm task                           | Milestone | Phải đọc                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo setup/tooling/monorepo         | `M0.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/03-technical-architecture.md`, `docs/07-integration-and-env.md`                                                                                                                                      |
| Database/Prisma/migration/seed      | `M1.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/04-database-model.md`; thêm `docs/05-api-contract.md` nếu API ảnh hưởng; thêm `docs/06-ai-rag-spec.md` nếu liên quan vector/AI; thêm `docs/10-seed-data-and-test-cases.md` nếu seed/test             |
| Auth/RBAC/profile/password          | `M2.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/07-integration-and-env.md`                                                              |
| Learning path/course/lesson admin   | `M3.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`; thêm UI docs nếu có UI                                                                        |
| File upload/R2/PDF processing       | `M4.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/03-technical-architecture.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/07-integration-and-env.md`                                                                              |
| Embedding/pgvector/RAG retrieval    | `M5.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/03-technical-architecture.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/06-ai-rag-spec.md`, `docs/07-integration-and-env.md`                                                    |
| Quiz/flashcard/test CRUD            | `M6.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`; thêm UI docs nếu có UI                                                                        |
| Student learning/progress/attempts  | `M7.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`; thêm UI docs nếu có UI                                                                        |
| Payment/payOS/discount/enrollment   | `M8.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/07-integration-and-env.md`                                                              |
| AI generation/explanation/chat      | `M9.x`    | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/06-ai-rag-spec.md`, `docs/07-integration-and-env.md`                                    |
| Notification/realtime/email/Zalo    | `M10.x`   | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/03-technical-architecture.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/07-integration-and-env.md`; thêm UI docs nếu có UI |
| Parent portal                       | `M11.x`   | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/08-ui-pages-and-components.md`                                                          |
| Report/moderation/news/events       | `M12.x`   | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`; thêm UI docs nếu có UI                                                                        |
| XP/level/leaderboard/profile/avatar | `M13.x`   | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/04-database-model.md`, `docs/05-api-contract.md`; thêm UI docs nếu có UI; thêm `docs/10-seed-data-and-test-cases.md` nếu seed/test              |
| Testing/hardening/deploy            | `M14.x`   | `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, `docs/03-technical-architecture.md`, `docs/07-integration-and-env.md`, `docs/10-seed-data-and-test-cases.md`                                                                                               |

UI bổ sung:

- Nếu task có giao diện, đọc `docs/08-ui-pages-and-components.md` và `docs/11-ui-design-system.md`.
- Nếu task có UI/API/list/search/cache hoặc flow nhạy độ trễ, đọc thêm `docs/12-performance-and-observability.md`.
- Nếu task là landing/public course/news/event hoặc route có thể index Google, đọc thêm `docs/13-seo-and-content-discovery.md`.
- Nếu có `docs/ui-references/approved-patterns.md`, đọc khi làm UI tương tự pattern đã được owner chốt.
- Nếu UI cần data/API, đọc `docs/05-api-contract.md`.
- Nếu task chỉ làm UI, không sửa backend/database trừ khi owner yêu cầu rõ.

Database/API bổ sung:

- `docs/04-database-model.md` và `docs/05-api-contract.md` là index.
- Khi task thật sự chạm database hoặc API, mở thêm file con tương ứng trong `docs/database/` hoặc `docs/api/` theo mapping trong index.
- Nếu endpoint/query/list/search/job có nguy cơ chậm, đọc `docs/12-performance-and-observability.md`.

---

## 8. Thứ Tự Ưu Tiên Khi Docs Mâu Thuẫn

1. `AGENTS.md`: cách làm việc, code rule, stack guard, scope guard.
2. `docs/01-product-scope.md`: phạm vi MVP và nghiệp vụ sản phẩm.
3. `docs/03-technical-architecture.md`: công nghệ và kiến trúc hệ thống.
4. `docs/04-database-model.md` và `docs/database/`: dữ liệu, quan hệ bảng, constraint.
5. `docs/05-api-contract.md` và `docs/api/`: giao tiếp frontend/backend.
6. `docs/06-ai-rag-spec.md`: AI/RAG, embedding, retrieval, cache.
7. `docs/12-performance-and-observability.md`: hiệu năng và đo đạc, nếu không mâu thuẫn với kiến trúc/domain docs.
8. `docs/13-seo-and-content-discovery.md`: SEO/public discovery, nếu không mâu thuẫn với scope, architecture hoặc API/database docs.
9. `docs/09-implementation-plan.md`: thứ tự triển khai.

Khi phát hiện mâu thuẫn lớn, báo rõ:

- tài liệu nào mâu thuẫn,
- quyết định tạm thời đang áp dụng,
- file nào cần cập nhật sau.

---

## 9. Scope MVP Và Stack Bắt Buộc

MVP và stack chi tiết nằm ở `docs/01-product-scope.md` và `docs/03-technical-architecture.md`. Codex phải giữ các điểm cốt lõi sau:

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query, Zustand, React Hook Form, Zod, Tiptap, KaTeX/mhchem.
- Backend: NestJS, TypeScript, REST API, Swagger/OpenAPI, JWT access/refresh token, RBAC `ADMIN`/`STUDENT`/`PARENT`.
- Database: Supabase Postgres, pgvector, Prisma; không chạy PostgreSQL production trên VPS.
- Queue/worker: Redis, BullMQ, worker container riêng.
- Storage: Cloudflare R2; không lưu file upload chính trên disk app/VPS.
- AI: OpenAI chính, Gemini phụ, `AiProvider` abstraction, output validate bằng Zod/JSON Schema.
- Realtime: Socket.IO chỉ cho notification realtime trong MVP, không làm chat realtime user-user.
- Payment/email/Zalo: payOS, Resend, Zalo OA/ZNS.
- Deploy: VPS Ubuntu, Docker Compose, Nginx, Certbot.

Không làm ngoài MVP: chat realtime user-user, bạn thân, chat nhóm, format riêng Tiếng Anh, học bổng, chống gian lận bài kiểm tra.

---

## 10. Repo Structure

Repo dùng monorepo Turborepo:

```txt
apps/web          Next.js front-end
apps/api          NestJS API + worker source
packages/shared   shared types/schemas/constants
docs/             product/technical docs
.codex/           Codex plans/prompts/skills/changelog
```

Không đổi cấu trúc lớn nếu chưa được owner yêu cầu.

---

## 11. Code Rules

- Dùng TypeScript nghiêm ngặt.
- Tránh `any`; định nghĩa type rõ khi có thể.
- Input từ client phải validate bằng Zod hoặc DTO/class-validator.
- Tên biến, hàm, file dùng tiếng Anh; text UI có thể dùng tiếng Việt.
- API response bám `docs/05-api-contract.md`.
- Flow chính phải bám `docs/12-performance-and-observability.md` khi có list/query/cache/job/AI hoặc độ trễ đáng kể.
- Xử lý lỗi rõ ràng, không nuốt lỗi.
- Thao tác nhạy cảm cần audit/log theo docs domain.
- Không thêm package nặng nếu không cần thiết.
- Không sửa database production trực tiếp; schema đổi phải có migration khi đến bước Prisma.

---

## 12. Frontend Rules

- Dùng Next.js App Router.
- Server state dùng TanStack Query; client UI state nhỏ dùng Zustand.
- Form dùng React Hook Form + Zod.
- Rich text dùng Tiptap; công thức lưu LaTeX trong Tiptap JSON.
- Không xử lý permission chỉ bằng UI; backend vẫn enforce RBAC.
- Route admin/student/parent phải có guard.
- UI mobile-first, nhưng phải ổn trên tablet/iPad và laptop/desktop.
- UI phải mượt trên mobile, phản hồi nhanh, độ trễ cảm nhận thấp; đọc `docs/11-ui-design-system.md` phần performance khi làm UI.
- Public page có mục tiêu xuất hiện trên Google phải bám `docs/13-seo-and-content-discovery.md`.
- Màn hình có data/action phải có loading, empty, error, disabled state.
- Nếu có thể chạy app, UI task nên kiểm tra bằng browser ở mobile và desktop; layout phức tạp kiểm tra thêm tablet/iPad. Chỉ chụp/lưu screenshot khi command có từ `screenshot`, ví dụ `/task-ui screenshot M3.4`.
- Khi owner nói UI đã "ưng/ok/chốt", lưu pattern vào `docs/ui-references/approved-patterns.md`; chỉ cập nhật `docs/11-ui-design-system.md` nếu đó là rule dùng rộng.

---

## 13. Backend/API Rules

- Base path API: `/api/v1`.
- Swagger/OpenAPI bật ở dev/staging; không public production nếu chưa bảo vệ.
- Admin endpoint dùng prefix `/admin`; parent dùng `/parent`; student dùng `/student` khi cần phân biệt rõ.
- Auth dùng JWT access token ngắn hạn và refresh token dài hạn.
- Refresh/reset token phải hash trước khi lưu DB.
- Backend enforce RBAC/ownership, không tin UI guard.
- Controller chỉ xử lý HTTP boundary; service chứa nghiệp vụ; DB/provider đi qua service/repository phù hợp.
- Job nặng enqueue BullMQ, không blocking request nếu có thể.
- API list/search phải có pagination/debounce/cache/index phù hợp theo `docs/12-performance-and-observability.md`.

---

## 14. Database, AI, Payment, Storage, Notification

Chi tiết nằm trong docs chuyên môn; Codex phải đọc đúng docs trước khi code.

- Database/migration: `docs/04-database-model.md` và file con trong `docs/database/`.
- API contract: `docs/05-api-contract.md` và file con trong `docs/api/`.
- AI/RAG: `docs/06-ai-rag-spec.md`.
- Integration/env: `docs/07-integration-and-env.md`.

Guard bắt buộc:

- pgvector cần extension `vector`; vector/hybrid search có thể dùng raw SQL qua Prisma.
- Không trộn embedding của nhiều provider trong cùng vector space.
- Không gửi toàn bộ PDF/tài liệu lên AI mỗi lần học sinh hỏi.
- RAG chat phải retrieval trong đúng `lesson_id`.
- AI output phải validate trước khi lưu.
- Payment payOS webhook phải verify checksum/signature và idempotent.
- Server tự tính amount/course/discount, không tin dữ liệu tiền từ client.
- File upload lưu Cloudflare R2, file private phải check quyền.
- Notification in-app phải lưu DB trước; realtime chỉ là kênh delivery.

---

## 15. Testing

- Unit test: Jest.
- Backend API test: Jest + Supertest.
- Frontend E2E: Playwright.
- AI output test: validate Zod/JSON Schema.
- Payment webhook test phải kiểm tra idempotency.
- Worker job test dùng mock provider khi phù hợp.
- Không gọi OpenAI/Gemini/payOS/R2/Resend/Zalo thật trong unit test mặc định.

Checks phải tỉ lệ với rủi ro:

- Task nhỏ, docs-only, wording, UI-only nhỏ, config nhẹ hoặc sửa bug cô lập có thể dùng lean mode để tối đa tốc độ.
- Lean mode nghĩa là không cần chạy full lint/build/test toàn repo nếu không cần thiết; chỉ chạy check nhỏ nhất đủ tin cậy như `git diff --check`, kiểm tra frontmatter skill/script validation nếu có, typecheck package liên quan, curl nhỏ hoặc kiểm tra thủ công có ghi chú.
- Với task làm UI hoặc owner yêu cầu "sửa UI", mặc định ưu tiên tốc độ: hạn chế chạy `typecheck`, `lint`, `build`, Playwright/E2E. Chỉ chạy các check này khi thay đổi chạm nhiều component/route, sửa shared UI primitive, đổi form/state phức tạp, nghi có lỗi TypeScript, hoặc owner yêu cầu rõ. Nếu chỉ chỉnh màu, spacing, copy, class Tailwind, vị trí ảnh/icon hoặc style nhỏ, dùng `git diff --check`, format check nhỏ hoặc kiểm tra thủ công là đủ.
- Nếu bỏ qua check lớn, ghi rõ `Not run: <lý do>` trong changelog/final response.
- Auth/RBAC, payment, database/schema, API contract, AI/RAG, worker, storage, notification hoặc multi-module phải dùng workflow đầy đủ hơn.

---

## 16. Changelog Và Commit

Codex không được tự commit nếu owner chưa yêu cầu rõ.

Khi có thay đổi file đáng commit, cập nhật changelog:

```txt
.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md
```

Nếu cùng ngày đã có file changelog, append vào file đó.

Format ngắn:

```md
## YYYY-MM-DD — <tên task ngắn>

- Summary: <1 câu mô tả thay đổi chính>
- Changed: <1-2 ý chính>
- Files: `path`, `path`
- Tests: <test đã chạy hoặc "Not run: <lý do>">
- Notes: <chỉ ghi nếu có migration/env/TODO/ASSUMPTION/rủi ro>
```

Không ghi secret, token, API key, webhook signature, private URL hoặc dữ liệu nhạy cảm vào changelog.

Khi owner yêu cầu commit:

- Changelog phải nằm cùng commit với thay đổi liên quan.
- Không stage file rác/generated/local nếu không thuộc task.
- Commit message dùng:

```txt
<type>(<scope>): <summary>
```

Type gợi ý: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.

---

## 17. Definition Of Done

Task được xem là xong khi:

- Đúng subtask/milestone trong `docs/09-implementation-plan.md`.
- Không vượt scope MVP và không đổi stack.
- Code chạy được local hoặc ghi rõ lý do chưa chạy được.
- Không có lỗi TypeScript nghiêm trọng.
- API liên quan có validation/auth/authorization phù hợp.
- Database đổi có migration/docs phù hợp.
- Side effect quan trọng có log/audit nếu domain yêu cầu.
- Có test/check phù hợp hoặc ghi rõ `Not run`.
- Không hard-code secret.
- Không phá flow chính trong `docs/02-user-flows.md`.
- Nếu đổi API/schema/AI/env/UI rule, cập nhật docs liên quan.
- Changelog đã cập nhật nếu có thay đổi file đáng commit.

---

## 18. Thông Báo Hoàn Thành Task

Trước final response của mỗi task, Codex phải gọi script thông báo từ repo root:

```bash
.codex/scripts/notify-task.sh done "<task/command>" "<kết quả ngắn>"
```

Dùng trạng thái:

- `done`: task/plan/commit đã hoàn thành.
- `blocked`: cần owner quyết định hoặc cung cấp thêm thông tin.
- `failed`: implement/check lỗi và chưa thể hoàn thành trong turn hiện tại.

Nội dung thông báo phải rõ task nào, kết quả gì, bước tiếp theo là gì nếu có. Không đưa secret, token, private URL hoặc dữ liệu nhạy cảm vào notification. Nếu notification lỗi, không được làm task fail; vẫn báo trong final response nếu cần.

Nếu `.codex/telegram/.env.local` có `TELEGRAM_BOT_TOKEN` và chat ID nhận thông báo, script có thể gửi thêm notification qua Telegram. Token/chat ID thật không được commit.

Repo có thể chạy Telegram bot local ở `.codex/scripts/codex-telegram-bot.py` để owner chat/ra lệnh cho Codex qua Telegram. Bot này chỉ được chạy Codex cho `TELEGRAM_ALLOWED_CHAT_IDS`, nhưng trong danh sách đó thì coi như full quyền với repo: câu hỏi thì trả lời, lệnh thì thực hiện theo `AGENTS.md` và skill liên quan.

---

## 19. Ghi Chú Vận Hành

Quy mô production ban đầu dự kiến khoảng 50 học sinh.

Ngân sách production và chi tiết vận hành nằm trong `docs/07-integration-and-env.md`. Ghi chú này chỉ để định hướng, không phải yêu cầu code trực tiếp.
