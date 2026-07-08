## 2026-07-08 — Update do runner continuation flow

- Summary: Làm rõ `/do` và `/do plan` để có thể commit phần vừa xong rồi tiếp tục task mới đã được gợi ý.
- Changed:
  - Bổ sung luồng commit-then-continue cho `/do` khi trước đó còn thay đổi chưa commit và đã có gợi ý task kế tiếp rõ ràng.
  - Bổ sung `/do plan` để commit trước nếu cần, rồi lập approval-gated plan cho task kế tiếp thay vì triển khai ngay.
- Files: `.codex/skills/do/SKILL.md`, `.codex/skills/do/agents/openai.yaml`
- Tests: `pnpm format:check`; `pnpm exec prettier --check .codex/skills/do/SKILL.md .codex/skills/do/agents/openai.yaml .codex/changelog/CHANGELOG_2026-07-08_codex.md`; `git diff --check`; frontmatter check thủ công cho `do/SKILL.md`.
- Notes: Không thay đổi code production.
