# ADR-0001 - Lightweight Codex Context Docs

Date: 2026-07-07
Status: Accepted

## Context

Dự án đã có bộ docs chính khá rõ, nhưng khi repo lớn dần Codex vẫn cần một số bản đồ phụ trợ để:

- bắt đầu phiên làm việc nhanh hơn,
- biết trạng thái hiện tại mà không đọc lại mọi file,
- kiểm tra feature có đủ DB/API/UI/worker/test chưa,
- xem dependency giữa milestone/task nhanh hơn,
- ghi lại quyết định quan trọng để tránh tranh luận lại.

Tham khảo từ dự án `ez-approve-ai`, nhưng không copy toàn bộ workflow phức tạp vì dự án này cần giữ tài liệu gọn, dễ đọc và tối ưu tốc độ làm task.

## Decision

Thêm bộ tài liệu phụ trợ nhẹ:

- `.codex/context/current-context.md`
- `.codex/context/code-index.md`
- `docs/implementation/dependency-graph.md`
- `docs/implementation/feature-coverage-matrix.md`
- `docs/decisions/`

Các file này là tài liệu hỗ trợ Codex, không thay thế source of truth chính:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/03-technical-architecture.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/06-ai-rag-spec.md`
- `docs/09-implementation-plan.md`
- `docs/implementation/M*.md`

## Consequences

Tích cực:

- Codex có thể định hướng nhanh hơn khi bắt đầu task.
- Owner dễ thấy feature nào còn thiếu lớp DB/API/UI/worker/test.
- Các quyết định lớn có nơi lưu ổn định.
- Không cần nhồi thêm quá nhiều vào `AGENTS.md`.

Cần lưu ý:

- Nếu không cập nhật định kỳ, context/code index có thể cũ.
- Docs phụ trợ không được dùng để tự đổi scope, stack hoặc nghiệp vụ.
- Với task nhỏ, Codex chỉ đọc các file này khi chúng thật sự giúp tiết kiệm thời gian hoặc tránh hiểu sai.
