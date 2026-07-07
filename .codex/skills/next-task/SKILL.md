---
name: next-task
description: Suggest the next project task to run without coding, including the recommended command, task Mode, and a short description of what the task does. Use when the user asks `/next-task`, `task tiếp theo là gì`, `việc tiếp theo nên làm gì`, or wants Codex to choose the next subtask/skill based on repo docs, implementation plan, changelog, and current git state.
---

# Next Task

Use this skill to recommend what the owner should do next. Do not edit production code.

## Workflow

1. Read `AGENTS.md`.
2. Read `README.md` for current workflow rules.
3. Read `docs/09-implementation-plan.md` and the relevant `docs/implementation/Mx.md` files.
4. Read `docs/implementation/dependency-graph.md` and `docs/implementation/feature-coverage-matrix.md` if they exist.
5. Check `.codex/context/current-context.md` and `.codex/plans/codex-execution-plan.md` if they exist.
6. Check recent changelog entries in `.codex/changelog/`.
7. Check `git status --short` to see whether there are uncommitted changes.
8. Identify completed, blocked, and dependency-ready subtasks.
9. For each recommended roadmap subtask, read its matching `docs/implementation/Mx.md` entry and extract:
   - `Mode`
   - task name/scope
   - a one-sentence description of what the task will implement or plan.
10. Recommend 1 primary next command and up to 2 alternatives.

## Output

Keep the answer short and practical:

- `Nên làm tiếp`: exact command, for example `/task-full M1.1`.
- `Mode`: exact mode from the milestone file, for example `DB only`, `UI + API`, or `Worker/Integration`.
- `Mô tả`: one short sentence explaining what the task does and which main area it touches.
- `Vì sao`: one or two sentences.
- `Phụ thuộc/lưu ý`: mention blockers, uncommitted changes, or whether `/commit` should happen first.
- `Lựa chọn khác`: optional commands if there are valid alternatives; include each alternative's `Mode` and short description.

If the repo has uncommitted work that should be saved first, recommend `/commit` first, then still name the next roadmap task after commit with its `Mode` and short description.
