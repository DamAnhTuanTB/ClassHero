---
name: task-connect
description: Plan or connect an approved mock UI to real API/data from commands such as "/task-connect M7.1" or "/task-connect plan M3.4". Preserve the approved UI, implement missing in-scope backend contracts, replace mock boundaries, and verify the end-to-end flow.
---

# Task Connect Runner

Use after `/task-ui` when the screen is approved enough to connect. If the
required endpoint is absent, implement the complete in-scope backend/API slice.

## Select mode

Accept one or explicitly listed multiple IDs plus optional `plan`/`screenshot`.

- `plan`: read [references/plan.md](references/plan.md), not the implementation
  reference; do not edit files.
- implementation: read
  [references/implementation.md](references/implementation.md), not the plan
  reference unless a new plan is requested.
- `screenshot`: permits saved UI screenshots. Without it, do not save screenshot
  artifacts unless needed for explicit browser debugging.

## Minimal context

1. Apply runtime `AGENTS.md`; read the complete subtask block and continue only
   when an existing mock UI and a real connection surface are present. Best fit is
   `UI + API`; route `UI only` or `API only` to the correct workflow.
2. Read only affected UI/API/user-flow sections, relevant frontend/backend source
   structure, the matching API domain file and one routed UI code pattern. Open
   database, test-data, performance or SEO sections only when triggered.
3. Inspect the mock boundary, existing clients/hooks/endpoints/services, call
   sites, focused tests and `git status --short`.

In implementation mode, state a short plan naming preserved UI, mock data being
replaced, reused/new backend contracts, files/layers and checks.

## Scope guard

- Treat `/task-connect` after UI feedback as approval of current layout, fields,
  labels, validation UX and flow. Do not reshape UI merely to fit an old DTO.
- Adapt payload mapping or required API/database contract within the subtask. If
  the mismatch crosses tasks or product authority, stop and explain the split.
- Every visible connected action needs real behavior or an explicit unavailable
  state; no fake success, upload, persistence, delete or restore.
- Keep changes inside the named task/MVP and update contract docs only when actual
  behavior/schema changes. Do not update changelog; `/commit` owns it.

## Completion

Before final, call `.codex/scripts/notify-task.sh` with `done`, `blocked` or
`failed` and the concrete `/task-connect ...` label. Notification failure is not
a task failure.
