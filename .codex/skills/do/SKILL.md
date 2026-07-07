---
name: do
description: Execute the previously approved plan in the Vietnamese learning-path project when the user says "/do", "ok làm đi", "oke triển khai đi", "triển khai đi", "bạn làm giúp tôi", "bạn sửa giúp tôi", or similar after Codex has just provided an implementation plan, direction, or approval-gated task plan. Use when Codex must treat the message as approval to proceed, identify the latest clear plan from the conversation, re-check repo state, apply the original task/fix/refactor/change workflow rules, implement without expanding scope, verify proportionally, update changelog, and report results.
---

# Do Runner

Use this skill as an approval shortcut after Codex has already proposed a plan or implementation direction.

## Command Parsing

Accept:

- `/do`
- `ok làm đi`
- `oke, làm đi`
- `ok, triển khai đi`
- `triển khai đi`
- `bạn làm giúp tôi`
- `bạn sửa giúp tôi`
- Similar Vietnamese approval phrases after a plan.

## Required Guard

Before editing files:

1. Identify the latest clear plan or implementation direction in the current conversation.
2. Confirm the plan has enough scope to execute safely: task ID or feature/bug/module, intended files/modules, expected checks, and known risks.
3. If there is no clear recent plan, stop and ask the owner which plan/task to execute.
4. If multiple plans are plausible, stop and ask which one to execute.
5. If the requested approval would expand scope beyond the plan, stop and ask for confirmation.

## Execution Rules

- Treat `/do` as approval to execute the latest clear plan only.
- Do not create a new plan unless the existing one is missing or stale.
- Re-check `git status --short` before editing.
- Re-read any docs/code that may have changed since the plan was written.
- Follow the original workflow implied by the plan:
  - task UI plan -> follow `/task-ui` rules.
  - task connect plan -> follow `/task-connect` rules.
  - task full plan -> follow `/task-full` rules.
  - bug plan -> follow `/fix bug` rules.
  - refactor plan -> follow `/refactor` rules.
  - UI feedback plan -> follow `/change-ui` rules.
- Keep edits within the approved plan and requested subtask/bug/module.
- Use lean mode for small low-risk work when appropriate.
- Update changelog when repository files changed in a commit-worthy way.
- Update learning notes only when the technical explanation has long-term learning value.

## Verification

Run the checks described in the approved plan, adjusted only if repo state changed.

If a planned check becomes unnecessary or too expensive for a tiny low-risk change, use lean mode and state `Not run: <reason>` in changelog/final response.

## Final Response

Include:

- Which approved plan was executed.
- Main changes.
- Files changed.
- Checks run or skipped with reason.
- `Giải thích kỹ thuật dễ hiểu` when code/behavior changed.
- Whether changelog, execution plan, learning notes, or UI docs changed.
- Suggested next step: when recommending a roadmap command, include the command, exact `Mode` from the milestone file, and a one-sentence description of what that task does.
