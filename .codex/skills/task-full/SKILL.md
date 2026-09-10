---
name: task-full
description: Plan or implement a complete roadmap subtask from commands such as "/task-full M7.1" or "/task-full plan M1.2". Keep scope to the named subtask, load only mode-relevant guidance and contract sections, implement every required layer in execution mode, and verify proportionally.
---

# Task Full Runner

## Parse and select one mode

Accept `/task-full Mx.y`, `/task-full plan Mx.y`, optional `screenshot`, and
multiple IDs only when the owner explicitly lists them. Process multiple IDs in
order and stop when one creates unresolved risk.

- `plan`: read [references/plan.md](references/plan.md). Do not read the
  implementation reference or edit repository files.
- implementation: read
  [references/implementation.md](references/implementation.md). Do not read the
  plan reference unless a new plan is explicitly requested.
- `screenshot`: permits screenshot artifacts for UI portions. Without it, do not
  save screenshots unless an explicit browser-debug need arises. Large-scope UI
  work may still require runtime/E2E verification without saving screenshots.

## Minimal context packet

1. Apply runtime-provided `AGENTS.md`; reopen only changed or exact needed lines.
2. Read the complete `Mx.y` block in `docs/implementation/Mx.md`, including
   `Mode`, scope, exclusions, and done criteria. Search the roadmap only for an
   actual order/dependency question.
3. Open execution plan, context, dependency graph, coverage matrix, decisions, or
   changelog only to answer a concrete status, ownership, dependency, or decision
   question.
4. Use the Task Routing Map to read only contract sections/files activated by the
   change surface. If diagnosis expands the surface, add the newly relevant
   section before editing it.
5. For source changes, read mandatory principles plus the relevant front-end,
   back-end, or shared section of `docs/14-source-code-structure.md`.
6. For UI, read only the affected screen/role, required design-system sections,
   and the one matching code-pattern section. Open approved/reference notes only
   when an existing pattern is relevant.
7. For performance or SEO, read general principles plus the exact affected layer
   or public-route section, not the whole file.
8. Inspect relevant code entrypoints, call sites, test entrypoints, and
   `git status --short`. In implementation mode, inspect test bodies needed to
   change or verify behavior; plan mode stops at evidence sufficient for a
   reliable plan.

In implementation mode, state a short plan naming the subtask/mode, contract
sections, files/layers, reuse, impacts, and checks.

## Common scope guard

- Implement or plan only the named subtask and its documented `Mode`. Do not add
  out-of-MVP features, change stack, or silently absorb another subtask.
- If a prerequisite is missing, stop or keep work to a safe scaffold and explain.
- Preserve mobile/tablet/desktop quality for UI and backend RBAC/data invariants
  for API/database work.
- Update API/database/AI/UI/env/SEO/context docs only when their contract or
  routing data actually changes.
- Do not update changelog; `/commit` owns changelog entries.

## Completion

Before the final response, call `.codex/scripts/notify-task.sh` with `done`,
`blocked`, or `failed` and a label such as `/task-full M2.1` or
`/task-full plan M2.1`. Notification failure does not block the result.
