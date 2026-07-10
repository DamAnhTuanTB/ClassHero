# 00. Docs Map - Bản đồ đọc tài liệu

File này là bản đồ nhanh để owner và Codex biết nên đọc tài liệu nào trước. Nó không thay thế `AGENTS.md` hoặc các docs nguồn.

## 1. Đọc nhanh theo mục tiêu

| Khi muốn                      | Đọc chính                                                                             | Đọc thêm khi cần                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Hiểu cách repo/Codex làm việc | `README.md`, `AGENTS.md`                                                              | `.codex/skills/*/SKILL.md`                                                                                                       |
| Chọn task tiếp theo           | `docs/09-implementation-plan.md`                                                      | `.codex/context/current-context.md`, `docs/implementation/dependency-graph.md`, `docs/implementation/feature-coverage-matrix.md` |
| Làm một subtask cụ thể        | `AGENTS.md`, `docs/09-implementation-plan.md`, `docs/implementation/Mx.md`            | Docs domain theo task routing map                                                                                                |
| Làm UI                        | `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`                   | `docs/ui-references/approved-patterns.md`, `docs/12-performance-and-observability.md`, `docs/13-seo-and-content-discovery.md`    |
| Làm API/backend               | `docs/05-api-contract.md`, file phù hợp trong `docs/api/`                             | `docs/04-database-model.md`, file phù hợp trong `docs/database/`                                                                 |
| Làm database/schema/seed      | `docs/04-database-model.md`, file phù hợp trong `docs/database/`                      | `docs/10-seed-data-and-test-cases.md`, `docs/05-api-contract.md` nếu API đổi                                                     |
| Làm AI/RAG                    | `docs/06-ai-rag-spec.md`                                                              | `docs/database/ai-rag-chat.md`, `docs/api/ai-chat.md`, `docs/12-performance-and-observability.md`                                |
| Làm payment                   | `docs/api/payment-discount.md`, `docs/database/payment-discount.md`                   | `docs/database/progress-enrollment.md`, `docs/07-integration-and-env.md`                                                         |
| Làm notification/email/Zalo   | `docs/api/notification.md`, `docs/database/notification-report-news.md`               | `docs/07-integration-and-env.md`, `docs/12-performance-and-observability.md`                                                     |
| Sửa scope/feature             | `docs/01-product-scope.md`, `docs/02-user-flows.md`, `docs/09-implementation-plan.md` | Domain docs bị ảnh hưởng                                                                                                         |

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
- `Mode` của subtask nằm trong `docs/implementation/Mx.md`; đọc mode trước khi code.
- `docs/04-database-model.md` và `docs/05-api-contract.md` chỉ là index; khi chạm DB/API phải đọc file con tương ứng.
- UI phải đọc design system; public/indexable page phải đọc SEO docs; list/search/cache/job/AI/latency phải đọc performance docs.
- Feature management mặc định là docs/planning-only, chưa sửa production code nếu owner không yêu cầu rõ.
- Không cập nhật changelog trong task thường; changelog chỉ ghi trong workflow `/commit`.

## 4. Nếu không chắc bắt đầu từ đâu

1. Chạy `/next-task`.
2. Nếu muốn xem plan trước, dùng `/task-full plan Mx.y`.
3. Nếu đồng ý plan, nói `/do`.
