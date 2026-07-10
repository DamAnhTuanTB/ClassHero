# Core Prompts Cho Codex

Dùng file này khi không gọi trực tiếp được slash skill. Nếu dùng được skill, ưu tiên lệnh trong `.codex/skills/`.

## Nguyên Tắc

- Mỗi lần chỉ giao một subtask, ví dụ `M4.2`.
- Codex phải đọc `AGENTS.md`, `docs/09-implementation-plan.md`, file milestone tương ứng trong `docs/implementation/`, rồi đọc docs liên quan theo Task Routing Map.
- `docs/04-database-model.md` và `docs/05-api-contract.md` là index; khi cần phải đọc thêm file con trong `docs/database/` hoặc `docs/api/`.
- Task có sửa code phải đọc `docs/14-source-code-structure.md` để chọn đúng route/feature/shared/domain layer, alias import và boundary tách file.
- Nếu có `.codex/plans/codex-execution-plan.md`, dùng để kiểm tra phụ thuộc/TODO, không thay docs gốc.
- Nếu task chạm UI/performance/SEO public, đọc thêm `docs/11-ui-design-system.md`, `docs/12-performance-and-observability.md` hoặc `docs/13-seo-and-content-discovery.md` đúng phạm vi.
- Nếu task tạo/sửa form, modal, detail grid, action control, upload preview, badge/status UI hoặc state view, đọc routing index trong `docs/ui-references/code-patterns.md` và file/section phù hợp trong `docs/ui-references/code-patterns/` trước khi viết/sửa.
- Không cập nhật changelog trong task thường; changelog chỉ được ghi trong workflow `/commit`.

## Prompt Khởi Động

```txt
Hãy làm M0.P theo docs/09-implementation-plan.md.

Yêu cầu:
- Đọc AGENTS.md.
- Đọc docs/01-product-scope.md.
- Đọc docs/03-technical-architecture.md.
- Đọc docs/04-database-model.md.
- Đọc docs/05-api-contract.md.
- Đọc docs/06-ai-rag-spec.md.
- Đọc docs/09-implementation-plan.md.
- Không sửa code production.
- Tạo/cập nhật .codex/plans/codex-execution-plan.md nếu cần.
- Không cập nhật changelog; nếu owner yêu cầu `/commit`, workflow commit sẽ ghi changelog cho commit đó.

Sau khi xong, báo file đã tạo/sửa.
```

## Prompt Subtask

Ưu tiên dùng:

```txt
/task-ui <MÃ SUBTASK>       # Làm UI với mock data
/change-ui <MÔ TẢ>          # Chỉnh UI theo feedback, chưa chốt docs UI
/task-connect <MÃ SUBTASK>  # Code API nếu thiếu rồi nối UI với API
/task-full <MÃ SUBTASK>     # Làm trọn subtask
/refactor <MÃ/TÍNH NĂNG>    # Refactor code, không đổi behavior
```

Fallback nếu không dùng slash skill:

```txt
Hãy làm <MÃ SUBTASK>: <TÊN SUBTASK>.

Trước khi code:
- Đọc AGENTS.md.
- Đọc docs/09-implementation-plan.md.
- Đọc file milestone tương ứng trong docs/implementation/.
- Đọc docs/14-source-code-structure.md nếu sửa code.
- Đọc docs liên quan theo Task Routing Map.
- Nêu kế hoạch ngắn: subtask, docs đã đọc, file/module/layer dự kiến sửa, phần sẽ tái sử dụng, test dự kiến.

Phạm vi:
- Chỉ làm <MÃ SUBTASK>.
- Không làm sang subtask khác.
- Không đổi stack.
- Không thêm tính năng ngoài MVP.
- Tuân thủ docs/14-source-code-structure.md: không gom nhiều component/helper vào một file, không tạo lại shared pattern đã có, không đặt backend controller/service/helper phẳng ở module root, dùng alias `@/...` hoặc `#api/...`.
- Nếu có UI form/modal/detail/action/upload/badge/state, tuân thủ pattern được route từ `docs/ui-references/code-patterns.md`; không tự chế validation/control flow riêng khi đã có pattern chuẩn.

Sau khi xong:
- Chạy check phù hợp.
- Cập nhật docs liên quan nếu đổi database/API/AI/env/UI rule.
- Không cập nhật changelog trong task thường; chỉ ghi khi thực hiện `/commit`.
- Báo file đã sửa, lệnh đã chạy, test status, TODO còn lại.
```

## Prompt Feature Management

Các lệnh này mặc định chỉ chỉnh docs/roadmap/task code, chưa code production:

```txt
/add-feature <MÔ TẢ>
/update-feature <MÔ TẢ>
/delete-feature <MÔ TẢ>
/move-feature-to-next-version <MÔ TẢ>
```

Sau khi docs xong, Codex phải gợi ý bước implementation tiếp theo kèm mã task nếu xác định được.
