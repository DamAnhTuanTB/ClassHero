# Codex Execution Pointer

Last updated: 2026-09-13

File này chỉ ghi hướng thực thi đang hoạt động. Nó không lặp roadmap, dependency
graph, milestone contract, lịch sử triển khai hoặc log kiểm tra.

## Source of truth

- Thứ tự subtask: `docs/09-implementation-plan.md`.
- Scope/Mode/Done: đúng block trong `docs/implementation/M*.md`.
- Dependency: `docs/implementation/dependency-graph.md`.
- Layer coverage: `docs/implementation/feature-coverage-matrix.md`.
- Trạng thái worktree: `.codex/context/current-context.md` và Git thực tế.

## Hướng đang hoạt động

- `M15.10` — Student xem Video Summary đã phát hành — đang hoàn thiện chế độ xem
  toàn bộ/từng phần đồng bộ theo playback time; implementation chưa commit.
- Dependency chính: `M9.7`, `M6.5`, `M7.1`; không phụ thuộc tracking `M15.1`.
- Hoàn tất feedback/check còn lại của `M15.10` trước khi chọn subtask mới; không
  dùng snapshot lịch sử M0/M9 cũ để thay roadmap hiện hành.
- `M9.6` đã qua deterministic, paid Luna single-pass image và realtime UI gate
  ngày 2026-09-13. `M9.34` — Admin mô phỏng Chat với AI — đã hoàn tất full-stack ngày
  2026-09-13 trên cùng shared Student Chat runtime, gồm responsive UI, trace usage/
  cost/latency, RBAC runtime và paid OpenAI smoke 1 response / 147 VND.

## Cách cập nhật

Chỉ sửa file này khi active task, blocker hoặc thứ tự thực thi gần nhất thay đổi.
Đưa quyết định dài hạn vào ADR, plan chi tiết vào file plan riêng, và lịch sử vào
Git/changelog của workflow `/commit`.
