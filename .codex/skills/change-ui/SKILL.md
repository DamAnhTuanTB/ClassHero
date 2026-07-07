---
name: change-ui
description: Change only the front-end UI for the Vietnamese learning-path project from commands like "/change-ui màn landing page sửa hero nhỏ lại", "/change-ui chỗ card khóa học đổi layout", or "sửa UI màn ...". Use when Codex must adjust existing UI according to owner feedback without changing backend/API/database/business logic, preserve mobile-first/tablet/desktop quality, avoid updating approved UI pattern/design-system docs until the owner explicitly says the UI is approved such as "Oke, ưng UI này", run proportional UI checks, update changelog, and explain the visual/code flow changed.
---

# Change UI Runner

Use this skill when the owner wants to adjust UI only.

## Command Parsing

Accept:

- `/change-ui <screen/place and requested UI change>`
- `/change ui <screen/place and requested UI change>`
- `sửa UI <screen/place and requested UI change>`
- `đổi giao diện <screen/place and requested UI change>`

If the target screen/component is unclear, ask one concise question. If the request includes an attached reference image/design, inspect it before editing.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/11-ui-design-system.md`.
3. Read `docs/08-ui-pages-and-components.md` if the target screen/component needs routing/context.
4. Read `docs/ui-references/approved-patterns.md` if present and relevant.
5. Inspect existing web code for the target screen/component.
6. Inspect `git status --short`.
7. Give a short plan: target UI, files likely touched, responsive checks, and commands.

## Scope Rules

- Only change front-end UI code, styling, layout, text presentation, icons, visual states, mock visual data, or component composition.
- Do not edit backend, API contract, database, Prisma, worker, payment, storage, AI/RAG, env, or business rules.
- Do not connect new real API calls.
- Do not add product features outside the requested UI change.
- Preserve approved UI patterns unless the owner explicitly asks to change them.
- Keep mobile-first support and also check tablet/iPad and desktop when practical.
- If the request requires API/data/business behavior changes, stop and suggest `/task-connect`, `/task-full`, `/update-feature`, or `/add-feature`.

## Documentation Rule

Do not update these approval/design docs while only iterating on UI feedback:

- `docs/ui-references/approved-patterns.md`
- `docs/11-ui-design-system.md`
- `docs/08-ui-pages-and-components.md`

Update them only after the owner explicitly approves the result with wording like:

- `Oke, ưng UI này`
- `ưng rồi`
- `ok rồi`
- `đúng ý rồi`
- `chốt UI này`
- `giữ style này`

When approval happens:

- Add a concise entry to `docs/ui-references/approved-patterns.md` with context, approved choices, and files/screens.
- Update `docs/11-ui-design-system.md` only if the approval creates a broad reusable UI rule.
- Update changelog.

Changelog is still allowed during UI iteration because it records repository file changes; keep it short.

## UI Work Rules

- Use existing components and local patterns first.
- Use Tailwind/shadcn/ui/lucide/framer only as already available in the project.
- Include or preserve loading, empty, error, disabled, hover/focus states when the touched UI needs them.
- Avoid large redesign unless requested.
- Do not make desktop-only layouts.
- Keep text from overflowing on mobile/tablet/desktop.
- Save useful screenshot review files under `.codex/screenshots/` when the app can run and screenshots are practical.

## Verification

Run checks proportional to the UI change:

- Small CSS/layout text-only: `git diff --check` may be enough.
- Component/page change: run focused typecheck/lint/build if practical.
- Visual change: check mobile and desktop; tablet/iPad for complex layouts.
- If unable to run app/browser checks, state why.

Update changelog after repository file changes.

## Final Response

Include:

- Screen/component changed.
- What UI changed.
- Files touched.
- Checks run or skipped with reason.
- Screenshot paths if created.
- Whether approval docs were updated. If not approved yet, say they were intentionally not updated.
- Suggested next step: review UI, then say `Oke, ưng UI này` if approved.
