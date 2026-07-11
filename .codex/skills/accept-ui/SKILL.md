---
name: accept-ui
description: Accept and record approved UI for the Vietnamese learning-path project from commands like "/accept-ui M3.4", "/accept-ui màn admin course", or owner approval phrases such as "ok, ưng UI này rồi", "ưng rồi", "đúng ý rồi", "chốt UI này", "giữ style này". Use when Codex must save the approved visual/UX pattern, decide whether any reusable UI code patterns should be documented, update only the appropriate UI reference docs, avoid documenting one-off implementation details, and report what was recorded.
---

# Accept UI Runner

Use this skill when the owner approves a UI result and wants Codex to remember it for future screens.

## Command Parsing

Accept:

- `/accept-ui <screen/subtask/context>`
- `/accept-ui M3.4`
- `ok, ưng UI này rồi`
- `ưng rồi`
- `đúng ý rồi`
- `chốt UI này`
- `giữ style này`

If no screen/subtask is named, infer it from the most recent UI work. If the context is genuinely unclear, ask one concise question before editing docs.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/ui-references/approved-patterns.md`.
3. Read `docs/ui-references/code-patterns.md`.
4. Read only the relevant files in `docs/ui-references/code-patterns/` for UI flows touched by the approved work, such as form, modal, action/badge, detail layout, upload, state view, or admin CRUD.
5. Read `docs/11-ui-design-system.md` only when the approval creates or confirms a broad design-system rule.
6. Inspect the approved UI code and recent diff enough to identify the screen, files, visual choices, and possible reusable implementation patterns.
7. Inspect `git status --short`.
8. Give a short plan: approved UI context, docs to update, candidate reusable code patterns, one-off details that will not be documented, and checks.

## Documentation Scope

Always update `docs/ui-references/approved-patterns.md` when the owner clearly approves UI.

Update `docs/ui-references/code-patterns.md` and matching files under `docs/ui-references/code-patterns/` only when the implementation creates or normalizes a reusable code pattern.

Update `docs/11-ui-design-system.md` only for a broad rule that should apply across many screens, not for one screen's style preference.

Do not update:

- Changelog. `/commit` handles changelog.
- API/database/AI/env docs unless the owner explicitly asks and the UI approval actually changed those contracts.
- `docs/08-ui-pages-and-components.md` unless a new durable screen/page was added or screen ownership changed.

## Reusable Pattern Filter

Record a code pattern only if at least one is true:

- It is already used in multiple places.
- It is expected to be reused by multiple future screens or domains.
- It is a shared shell/control/state flow, such as modal shell, form validation wiring, action button, status badge, detail grid, upload preview, loading/empty/error state, master-detail admin CRUD, or bulk-action dialog.
- It prevents a bug or quality regression likely to recur, such as modal `X` vertical alignment, button text wrapping, validation on pristine modal open, or destructive action without confirm.

Do not record code patterns for:

- A field, component, copy, layout trick, or helper that only belongs to one screen/domain.
- Data labels, option lists, mock data, or business wording specific to one feature.
- Temporary owner preference that has not been approved as reusable.
- Implementation details that future tasks can easily infer from the local code without reuse value.

When in doubt, write the visual/UX approval in `approved-patterns.md` and skip the code-pattern doc. Mention the skipped one-off candidates in the final response.

## Approved Pattern Entry

Add a concise entry to `docs/ui-references/approved-patterns.md`:

```md
## <Screen/Flow> - <YYYY-MM-DD>

- Context: <role + screen/subtask/flow>
- Approved:
  - <approved visual/UX choices>
- Avoid:
  - <things to avoid next time>
- Reuse for:
  - <future screens/flows that should copy the approved direction>
- Evidence:
  - Screenshot: `<path>` if one exists
  - Files: `<important files or folders>`
```

Keep it specific enough to reuse, but do not turn one screen's detail into a system-wide law.

## Code Pattern Update

When a reusable code pattern exists:

1. Add or update the route in `docs/ui-references/code-patterns.md`.
2. Update the matching pattern file, or create a new one only when no existing category fits.
3. Use generic names in examples, such as `EntityEditorDialog`, `StatusBadge`, `DetailFieldGrid`, `DeleteConfirmDialog`, or `ArchiveBulkActionDialog`.
4. Include a short "Không làm" section for the failure mode the pattern prevents.
5. Avoid screen-specific identifiers like a single feature name, hard-coded labels, one-off component names, or task IDs unless they are in `approved-patterns.md` evidence.

## Checks

Run:

- `git diff --check`
- `rg` or manual inspection to ensure code pattern docs do not contain accidental one-off identifiers when they are meant to be generic.

Do not run browser/Playwright/screenshots unless the owner explicitly asks. This skill is documentation-only.

## Completion Notification

Before the final response, call:

```bash
.codex/scripts/notify-task.sh done "/accept-ui <context>" "<short result>"
```

Use `blocked` if the approved UI context cannot be identified safely.

## Final Response

Include:

- Approved UI context recorded.
- Files updated.
- Which reusable code patterns were added or updated.
- Which candidates were intentionally not documented because they are one-off.
- Checks run.
