---
name: next-task
description: Suggest the next project task to run without coding, including the recommended command, task Mode, concrete prerequisite notes, and a short core-docs reading list with exact sections for the owner. Use when the user asks `/next-task`, `task tiếp theo là gì`, `việc tiếp theo nên làm gì`, or wants Codex to choose the next subtask/skill based on repo docs, implementation plan, changelog, and current git state.
---

# Next Task

Use this skill to recommend what the owner should do next. Do not edit production code.

## Workflow

1. Apply the runtime-provided `AGENTS.md`; use the README/docs map only if a
   workflow or routing detail is unclear.
2. Read the roadmap order plus current context/execution plan needed to identify
   candidates; use dependency/coverage entries for those candidates only.
3. Read only the candidate subtask blocks in `docs/implementation/Mx.md`.
4. Check recent changelog entries only when current context does not establish
   whether a candidate was completed.
5. Check `git status --short` to see whether there are uncommitted changes.
6. Identify completed, blocked, and dependency-ready subtasks.
7. For each recommended roadmap subtask, read its matching `docs/implementation/Mx.md` entry and extract:

- `Mode`
- task name/scope
- a one-sentence description of what the task will implement or plan.

8. Build a concise `Tài liệu nên đọc trước` list for the owner:

- Focus on the few core docs that help the owner understand the next task, not every file Codex will read while coding.
- Prefer 2-4 files by default; use 5 only when a task genuinely crosses domains.
- For large files, include the exact heading/subsection to read, such as `docs/implementation/M1.md` -> `M1.2`.
- For short or highly focused files, it is acceptable to say `đọc toàn file`.
- Include the exact milestone file and subtask heading, such as `docs/implementation/M1.md` -> `M1.2`.
- Add the most useful domain overview/index doc and section, such as `docs/04-database-model.md` -> `Mapping file chi tiết` for DB tasks.
- Add at most 1-2 child docs only when they are central to understanding the task, with their exact section if the file has multiple sections.
- Do not list every related child file; implementation will expand only the
  contract sections activated by the actual change surface.

9. Write `Phụ thuộc/lưu ý` as concrete status, not generic guidance:

- Say whether the worktree is clean or whether `/commit` should happen first.
- Name the prerequisite task(s) already satisfied or still missing.
- Name blockers, assumptions, or sequencing notes if any.
- Do not write vague phrases like "đọc docs liên quan" unless followed by exact file paths.

10. Recommend 1 primary next command and up to 2 alternatives.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the next-task recommendation is ready.
- `blocked` when owner input is needed before recommending safely.
- `failed` when required docs/status checks fail and the recommendation cannot be finished in this turn.

Use `/next-task` as the task label. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Output

Keep the answer short and practical:

- `Nên làm tiếp`: exact command, for example `/task-full M1.1`.
- `Mode`: exact mode from the milestone file, for example `DB only`, `UI + API`, or `Worker/Integration`.
- `Mô tả`: one short sentence explaining what the task does and which main area it touches.
- `Vì sao`: one or two sentences.
- `Tài liệu nên đọc trước`: 2-4 core file paths, each with the exact heading/subsection to read and a short reason.
- `Phụ thuộc/lưu ý`: concrete git/dependency/blocker status; mention whether `/commit` is needed first.
- `Lựa chọn khác`: optional commands if there are valid alternatives; include each alternative's `Mode` and short description.

If the repo has uncommitted work that should be saved first, recommend `/commit` first, then still name the next roadmap task after commit with its `Mode` and short description.

Quality bar:

- Bad: "Khi làm task này nên đọc thêm docs liên quan."
- Too vague: "Đọc `docs/implementation/M1.md`, `docs/04-database-model.md`, `docs/database/auth-users.md`."
- Too much: "Đọc `docs/implementation/M1.md` mục `M1.2`, `docs/04-database-model.md` mục `Mapping file chi tiết`, `docs/database/conventions-and-enums.md`, `docs/database/auth-users.md` mục `3.1`-`3.6`, `docs/database/files-documents.md`, `docs/database/background-jobs.md`."
- Good for `M1.2`: "`docs/implementation/M1.md` -> `M1.2`; `docs/04-database-model.md` -> `Quy tắc database bắt buộc` và `Mapping file chi tiết`; `docs/database/auth-users.md` -> `3. Auth và user`."
