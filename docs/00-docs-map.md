# 00. Docs Map - Bản đồ đọc tài liệu

File này là routing index để owner và Codex mở đúng phần tài liệu, không phải
checklist đọc toàn bộ. Nó không thay thế `AGENTS.md` hoặc docs nguồn.

## 0. Gói đọc tối thiểu cho một task

Nếu task đã có mã `Mx.y`, mặc định chỉ cần:

1. `AGENTS.md` đã được runtime cung cấp; không mở lại cơ học.
2. Đúng block `Mx.y` trong `docs/implementation/Mx.md` gồm `Mode`, phạm vi,
   `Không làm`, `Done khi`.
3. Đúng section/file domain theo bảng dưới và bề mặt thật sự thay đổi.
4. Code, call site, test liên quan và `git status --short`.

Không cần đọc toàn `docs/09-implementation-plan.md`, toàn milestone, toàn source
structure, toàn design system, toàn performance doc hoặc mọi context file trước
mỗi task. Dùng search/mục lục để tìm section, rồi mở rộng khi task chạm thêm
contract. Chỉ `/next-task`, onboarding, audit toàn hệ thống, thay đổi scope/kiến
trúc lớn hoặc task chưa rõ mới cần đọc rộng.

## 1. Đọc nhanh theo mục tiêu

| Khi muốn                      | Đọc chính                                                                                                                                  | Chỉ mở thêm khi bề mặt đó đổi                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Hiểu cách repo/Codex làm việc | `README.md`; mục liên quan trong `AGENTS.md`                                                                                               | Skill đang được kích hoạt                                                                       |
| Hiểu milestone lớn dễ đọc     | Milestone tương ứng trong `docs/implementation/milestone-overview.md`                                                                      | Entry cần tra trong `docs/09-implementation-plan.md`                                            |
| Chọn task tiếp theo           | `docs/09-implementation-plan.md`, `.codex/context/current-context.md`                                                                      | Dependency graph, coverage matrix và execution plan                                             |
| Làm một subtask cụ thể        | Block `Mx.y` trong `docs/implementation/Mx.md`                                                                                             | Đúng section domain theo bề mặt thay đổi                                                        |
| Làm UI                        | Section screen trong `docs/08-ui-pages-and-components.md`; section token/component/responsive cần dùng trong `docs/11-ui-design-system.md` | Phần front-end trong source structure; đúng UI code pattern; performance/SEO khi được kích hoạt |
| Làm API/backend               | Mapping + file domain trong `docs/05-api-contract.md` và `docs/api/`                                                                       | Phần back-end trong source structure; database docs nếu data/query đổi                          |
| Refactor/tổ chức code         | Mục 1 + phần front-end/back-end/shared tương ứng trong `docs/14-source-code-structure.md`                                                  | Architecture/domain contract chỉ khi boundary đó liên quan                                      |
| Làm database/schema/seed      | Mapping + file domain trong `docs/04-database-model.md` và `docs/database/`                                                                | Seed docs; API docs nếu public contract đổi                                                     |
| Làm AI/RAG                    | `Cách đọc nhanh` + section feature trong `docs/06-ai-rag-spec.md`                                                                          | DB/API/performance section đúng layer bị đổi                                                    |
| Làm payment                   | Section liên quan trong `docs/api/payment-discount.md` và `docs/database/payment-discount.md`                                              | Enrollment/env chỉ khi flow đó đổi                                                              |
| Làm notification/email/Zalo   | Section liên quan trong API/database notification docs                                                                                     | Env/performance chỉ khi delivery/worker/latency đổi                                             |
| Sửa scope/feature             | Section feature trong product scope và user flow                                                                                           | Entry roadmap, dependency, coverage và domain contract bị ảnh hưởng                             |

## 2. Lệnh owner hay dùng

| Việc cần làm                         | Lệnh                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Hỏi nên làm gì tiếp                  | `/next-task`                                                                                          |
| Làm trọn một subtask                 | `/task-full Mx.y`                                                                                     |
| Lập plan trước khi làm               | `/task-full plan Mx.y`                                                                                |
| Dựng UI bằng mock data               | `/task-ui Mx.y`                                                                                       |
| Sửa UI theo feedback                 | `/change-ui ...`                                                                                      |
| Nối UI với API thật                  | `/task-connect Mx.y`                                                                                  |
| Duyệt plan gần nhất                  | `/do`                                                                                                 |
| Sửa bug                              | `/fix bug ...`                                                                                        |
| Refactor không đổi behavior          | `/refactor ...`                                                                                       |
| Review docs/skill                    | `/review-docs`                                                                                        |
| Thêm/sửa/xóa/hoãn feature trong docs | `/add-feature ...`, `/update-feature ...`, `/delete-feature ...`, `/move-feature-to-next-version ...` |
| Commit thay đổi                      | `/commit`                                                                                             |

## 3. Quy tắc nhớ nhanh

- Mỗi lần mặc định chỉ làm một subtask.
- `Mode` nằm trong block subtask; đọc trọn block đó, không đọc cả milestone.
- Index chỉ dùng để route tới file/section nguồn; không đọc toàn index và mọi file con.
- UI đọc đúng screen + rule cần dùng; public/indexable mới mở SEO; list/search/cache/job/AI/latency mới mở đúng performance section.
- Sửa code đọc mục nguyên tắc và phần front-end/back-end/shared tương ứng trong source structure, không mặc định đọc toàn file.
- Feature management mặc định là docs/planning-only, chưa sửa production code nếu owner không yêu cầu rõ.
- Không cập nhật changelog trong task thường; changelog chỉ ghi trong workflow `/commit`.

## 4. Nếu không chắc bắt đầu từ đâu

1. Chạy `/next-task`.
2. Nếu muốn xem plan trước, dùng `/task-full plan Mx.y`.
3. Nếu đồng ý plan, nói `/do`.
