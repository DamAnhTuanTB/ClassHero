---
name: change-ui
description: Change only existing frontend UI from commands such as "/change-ui ...", "sửa UI ...", or "đổi giao diện ...". Preserve backend/contracts and unrequested visual behavior, use approved patterns, verify proportionally, and wait for explicit owner approval before recording the design.
---

# Change UI Runner

## Resolve the request

Accept optional `screenshot`; only that flag or an explicit browser request
authorizes saved screenshots/browser verification. If the target is unclear, ask
one concise question. Inspect an attached reference before editing and extract its
relevant principles without importing unrelated layout/features.

## Minimal startup

1. Apply runtime `AGENTS.md` and read only the affected screen/role plus exact UI,
   frontend-structure, performance or SEO sections triggered by the change.
2. For form/modal/detail/action/upload/badge/state work, use the code-pattern
   routing index and one matching pattern. Open approved patterns only when a
   similar owner-approved flow exists.
3. Inspect the rendered code path, shared components/forms, similar screen,
   focused tests and `git status --short`.
4. Give a short plan covering target, smallest files/properties, reuse and checks.

Read [references/precision-rules.md](references/precision-rules.md) only when the
request concerns property-only visual changes, toolbar/icon completeness, semantic
palettes, math/answer rendering, auth visuals, pinned sidebars or repeated CSS that
does not appear in the browser.

## Scope

- Change only frontend layout/style/copy/icon/visual state/mock presentation or
  component composition. Do not change API/database/worker/AI/env/business rules,
  connect new APIs or add product features.
- A request to remove a domain field is cross-layer unless owner explicitly says
  “hide only”; route it to `update-feature`/`task-full` when needed.
- Preserve approved UI and every unrequested behavior/property. Keep semantic
  interactions, responsive support, both themes and production states intact.
- Follow existing components, design tokens, code patterns, `@/...` imports and
  frontend file boundaries; do not create local substitutes for canonical forms,
  modals or controls.
- If the requested result requires data/contract behavior, stop and suggest
  `/task-connect`, `/task-full` or feature management.

Do not update approval/design docs during feedback iteration. Once owner says the
result is approved, `/accept-ui` owns recording approved patterns and any broad
design-system rule. `/commit` owns changelog.

## Verification and completion

- Micro visual/copy changes: focused format/diff/static check is enough. Typecheck,
  lint/build or tests only when component props, form/state, routes, shared
  primitives or TypeScript behavior changed.
- Without browser evidence, report only that code/static checks passed—not that
  the visual result was verified. Save screenshots only in screenshot mode.
- For `fast`/`sửa nhanh`/`check nhẹ`, use the smallest safe path and avoid adjacent
  cleanup.

Before final, call `.codex/scripts/notify-task.sh` with `done`, `blocked` or
`failed` and a concrete `/change-ui ...` label. Final reports target, exact visual
change, files, checks/screenshot evidence and whether approval docs intentionally
remain unchanged.
