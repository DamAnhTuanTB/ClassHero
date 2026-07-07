---
name: next-task
description: Suggest the next project task to run without coding. Use when the user asks `/next-task`, `task tiếp theo là gì`, `việc tiếp theo nên làm gì`, or wants Codex to choose the next subtask/skill based on repo docs, implementation plan, changelog, and current git state.
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
9. Recommend 1 primary next command and up to 2 alternatives.

## Output

Keep the answer short and practical:

- `Nên làm tiếp`: exact command, for example `/task-full M1.1`.
- `Vì sao`: one or two sentences.
- `Phụ thuộc/lưu ý`: mention blockers, uncommitted changes, or whether `/commit` should happen first.
- `Lựa chọn khác`: optional commands if there are valid alternatives.

If the repo has uncommitted work that should be saved first, recommend `/commit` before the next implementation task.
