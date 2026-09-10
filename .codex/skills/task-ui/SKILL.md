---
name: task-ui
description: Plan or implement UI-first roadmap subtasks from commands such as "/task-ui M7.1" or "/task-ui plan M3.5". Build production-quality frontend with replaceable mock data, preserve backend/API/database boundaries, and load only mode-relevant guidance.
---

# Task UI Runner

## Select mode

Accept one or explicitly listed multiple `Mx.y` IDs plus optional `plan` and
`screenshot`. Process multiple IDs in order and stop on unresolved risk.

- `plan`: read [references/plan.md](references/plan.md), do not read the
  implementation reference and do not edit files.
- implementation: read
  [references/implementation.md](references/implementation.md), not the plan
  reference unless a new plan is requested.
- `screenshot`: permits saved UI screenshots. Without it, do not save screenshot
  artifacts unless explicitly needed for browser debugging.

## Minimal context

1. Apply runtime `AGENTS.md` and read the complete target subtask block, including
   `Mode`, scope, exclusions and Done criteria.
2. Continue only for `UI only` or `UI + API`; `/task-ui` still implements only the
   frontend/mock portion. Suggest the correct workflow for other modes.
3. Read the affected screen/role, exact design-system/source-structure sections,
   and one routed code-pattern section for any form/modal/detail/action/upload/
   badge/state flow. Open approved/reference notes only when a matching pattern
   exists.
4. Read only enough user-flow/API shape to model mock data; do not connect APIs.
   Add performance/SEO sections only when triggered.
5. Inspect existing web code, shared patterns, focused tests and
   `git status --short`.

In implementation mode, state a short plan naming files/layers, reuse, mock-data
boundary and checks.

## Scope guard

- Do not edit API/backend/database/Prisma/worker/payment/storage/AI/env logic or
  add real API calls.
- Keep work inside the requested screen/subtask and MVP. If the request actually
  changes a domain field/contract, route it to `task-connect`, `task-full` or
  feature management instead of hiding a cross-layer change in UI.
- Follow current stack, `@/...` imports and frontend structure contracts.
- Update context/coverage only when new paths or UI coverage materially change.
- Do not update changelog; `/commit` owns it.

## Completion

Before final, call `.codex/scripts/notify-task.sh` with `done`, `blocked` or
`failed` and the concrete `/task-ui ...` label. Notification failure is not a
task failure.
