# Codex Execution Pointer

Last updated: 2026-09-10

File này chỉ ghi hướng thực thi đang hoạt động. Nó không lặp roadmap, dependency
graph, milestone contract, lịch sử triển khai hoặc log kiểm tra.

## Source of truth

- Thứ tự subtask: `docs/09-implementation-plan.md`.
- Scope/Mode/Done: đúng block trong `docs/implementation/M*.md`.
- Dependency: `docs/implementation/dependency-graph.md`.
- Layer coverage: `docs/implementation/feature-coverage-matrix.md`.
- Trạng thái worktree: `.codex/context/current-context.md` và Git thực tế.

## Hướng đang hoạt động

- `M15.9` — Admin tạo Video Summary bằng AI — đang có implementation chưa commit.
- Plan chi tiết: `.codex/plans/m15-9-admin-video-summary-ai-plan.md`.
- Dependency chính: `M3.8`, `M4.3`, `M9.1`, `M9.9-M9.12`, `M9.20`, `M9.32`.
- Hoàn tất feedback/check còn lại của `M15.9` trước khi chọn subtask mới; không
  dùng snapshot lịch sử M0/M9 cũ để thay roadmap hiện hành.

## Cách cập nhật

Chỉ sửa file này khi active task, blocker hoặc thứ tự thực thi gần nhất thay đổi.
Đưa quyết định dài hạn vào ADR, plan chi tiết vào file plan riêng, và lịch sử vào
Git/changelog của workflow `/commit`.
