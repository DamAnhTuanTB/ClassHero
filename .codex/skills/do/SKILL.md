---
name: do
description: Execute the previously approved plan in the Vietnamese learning-path project when the user says "/do", "/do plan", "ok làm đi", "oke triển khai đi", "triển khai đi", "bạn làm giúp tôi", "bạn sửa giúp tôi", or similar after Codex has just provided an implementation plan, direction, approval-gated task plan, or next-task recommendation. Use when Codex must treat the message as approval to proceed, optionally commit already-finished uncommitted work before continuing to the clearly recommended next task, re-check repo state, apply the original task/fix/refactor/change workflow rules, implement or plan without expanding scope, verify proportionally, update changelog, and report results.
---

# Do Runner

Use this skill as an approval shortcut after Codex has already proposed a plan, implementation direction, or next-task recommendation.

## Command Parsing

Accept:

- `/do`
- `/do plan`
- `ok làm đi`
- `oke, làm đi`
- `ok, triển khai đi`
- `triển khai đi`
- `bạn làm giúp tôi`
- `bạn sửa giúp tôi`
- Similar Vietnamese approval phrases after a plan.

Parse `plan` after `/do` as next-task plan mode. `/do plan` means: if the latest clear context is a recommended next roadmap task, do not implement that task yet; commit any previous finished work first when needed, then produce the matching approval-gated plan for the recommended task.

## Required Guard

Before editing files:

1. Identify the latest clear plan or implementation direction in the current conversation.
2. Also look for the latest clear next-task recommendation. It is executable only when it names one exact command such as `/task-full M1.3`, includes the task `Mode`, and has concrete dependency/git notes.
3. Confirm the plan or next-task recommendation has enough scope to execute safely: task ID or feature/bug/module, intended files/modules or docs to read, expected checks, and known risks.
4. If there is no clear recent plan or next-task recommendation, stop and ask the owner which plan/task to execute.
5. If multiple plans or task recommendations are plausible, stop and ask which one to execute.
6. If the requested approval would expand scope beyond the plan/recommendation, stop and ask for confirmation.

## Commit Then Continue

Use this flow when the latest assistant response said the current work should be committed first and also recommended a concrete next task.

For `/do`:

1. Re-check `git status --short`.
2. If there are uncommitted changes from the just-finished task, run the `/commit` workflow first.
3. If commit succeeds and the next task command is clear, immediately execute that recommended task with its normal workflow, for example `/task-full M1.3`.
4. If commit is blocked by unclear scope, suspicious files, missing changelog, failed safety checks, or unrelated risky changes, stop and report the blocker; do not start the next task.

For `/do plan`:

1. Re-check `git status --short`.
2. If there are uncommitted changes from the just-finished task, run the `/commit` workflow first.
3. If commit succeeds and the next task command is clear, produce the approval-gated plan for that task instead of implementing it. For `/task-full Mx.y`, behave like `/task-full plan Mx.y`; for `/task-ui Mx.y`, behave like `/task-ui plan Mx.y`; for `/task-connect Mx.y`, behave like `/task-connect plan Mx.y`.
4. Stop after the plan and wait for owner approval before editing implementation files.

If the worktree is already clean, skip the commit step and continue with the same execute-vs-plan behavior.

## Execution Rules

- Treat `/do` as approval to execute the latest clear plan or the latest clear next-task recommendation.
- Treat `/do plan` as approval to prepare the next plan, not to implement it.
- Do not create a new plan unless the owner used `/do plan`, or the existing one is missing or stale.
- Re-check `git status --short` before editing.
- Re-read any docs/code that may have changed since the plan was written.
- Follow the original workflow implied by the plan:
  - task UI plan -> follow `/task-ui` rules.
  - task connect plan -> follow `/task-connect` rules.
  - task full plan -> follow `/task-full` rules.
  - bug plan -> follow `/fix bug` rules.
  - refactor plan -> follow `/refactor` rules.
  - UI feedback plan -> follow `/change-ui` rules.
- When continuing from a next-task recommendation rather than a detailed plan, first run the startup/planning steps of the target task skill so docs, dependencies, mode, files, and checks are re-confirmed before implementation.
- Keep edits within the approved plan and requested subtask/bug/module.
- Use lean mode for small low-risk work when appropriate.
- Update changelog when repository files changed in a commit-worthy way.
- Update learning notes only when the technical explanation has long-term learning value.

## Verification

Run the checks described in the approved plan, adjusted only if repo state changed.

If a planned check becomes unnecessary or too expensive for a tiny low-risk change, use lean mode and state `Not run: <reason>` in changelog/final response.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the work or plan is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when implementation or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/do`, `/do plan`, `/task-full M2.1`, or `/commit`. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Which approved plan was executed.
- Whether `/do` used the commit-then-continue flow, including commit hash if a commit was created.
- Main changes.
- Files changed.
- Checks run or skipped with reason.
- `Giải thích kỹ thuật dễ hiểu` when code/behavior changed.
- Whether changelog, execution plan, learning notes, or UI docs changed.
- Suggested next step: when recommending a roadmap command, include the command, exact `Mode` from the milestone file, and a one-sentence description of what that task does.
