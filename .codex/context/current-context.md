# Current Codex Context

Last updated: 2026-09-10

Snapshot định hướng nhanh; không phải changelog hoặc bản sao contract. Luôn kiểm
tra docs nguồn, code và `git status --short` trước khi sửa.

## Hướng hiện tại

- Worktree đang có implementation chưa commit liên quan `M9.7` — Admin tạo Video
  Summary bằng AI — cùng các thay đổi docs/skill tối ưu context.
- `M9.7` đã Done với lát dọc Prisma/API/worker/admin UI và đã chạy live-provider smoke
  có kiểm soát; contract khối vẫn đang được tinh chỉnh theo feedback owner.
- Video Summary là resource admin-only độc lập với `shortDescription` và Lesson
  Summary từ PDF; nguồn bắt buộc là video + saved transcript, chapter là optional,
  không sinh figure.
- Worker/API/web của flow phải cùng version; restart worker sau thay đổi liên quan.

## Nguồn cần mở khi tiếp tục tinh chỉnh M9.7

- Scope/Done: block `M9.7` trong `docs/implementation/M9.md`.
- Plan triển khai lịch sử: `.codex/plans/m15-9-admin-video-summary-ai-plan.md`
  (tên file cũ được giữ để tránh làm hỏng liên kết; task canonical là `M9.7`).
- Plan/acceptance/checks: `.codex/plans/m15-9-admin-video-summary-ai-plan.md`.
- AI contract: section Video Summary trong `docs/06-ai-rag-spec.md`.
- API/database: `docs/api/learning-paths-lessons.md`,
  `docs/api/provider-operations.md`, `docs/database/learning-paths-lessons.md` và
  `docs/database/provider-operations.md`.
- Code entrypoints: `.codex/context/code-index.md`, rồi code/call site/test thật.

## Worktree guard

Không revert hoặc ghi đè các thay đổi M9.7/AI hiện có. Trước task tiếp theo, dùng
`git status --short` và diff theo đúng scope; không suy trạng thái từ snapshot này.

## Cách cập nhật

Chỉ giữ hướng đang hoạt động, blocker, worktree guard và link nguồn. Không thêm
lịch sử milestone, log/check chi tiết, PID, transcript debug hoặc contract đã có
trong docs/ADR/plan/artifact.
