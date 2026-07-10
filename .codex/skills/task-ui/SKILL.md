---
name: task-ui
description: Run or plan UI-first roadmap subtasks for the Vietnamese learning-path project from commands like "/task-ui M7.1", "/task-ui M3.4", or "/task-ui plan M3.5". Use when Codex must implement only the front-end UI for a task using clear mock data first, or produce an approval-gated UI plan first when the command contains "plan"; read the project UI design system and relevant docs, avoid backend/database/API implementation, build mobile-first layouts that also work on tablet/iPad and laptop/desktop, keep mock data easy to remove, and suggest the matching "/task-connect" command after completion.
---

# Task UI Runner

Use this skill when the owner wants UI first, before API integration.

## Command Parsing

Accept:

- `/task-ui M7.1`
- `/task-ui: M7.1`
- `/task-ui plan M7.1`
- `/task-ui plan: M7.1`
- `/task-ui screenshot M7.1`
- `/task-ui plan screenshot M7.1`
- `/task-ui M3.4 + M6.2`

Parse subtask IDs in order. If `plan` appears after the command and before the task IDs, enable plan mode. Multiple IDs are allowed only when the user explicitly lists them.

If `screenshot` appears after the command, enable screenshot mode only because the owner explicitly requested it. Per owner preference, do not run browser checks, Playwright UI, screenshots, or real interaction checks by default. Without the `screenshot` keyword or an explicit browser-check request, do not create/save screenshots and do not run browser/Playwright UI checks; use proportional static/focused code checks instead.

## Plan Mode

When the command contains `plan`, do approval-gated UI planning only.

- Read the same startup docs needed to make a reliable UI plan.
- Inspect existing web code/component patterns enough to identify likely files and risks.
- Do not edit files, create screenshots, run implementation, update changelog, or stage/commit.
- Output a plan with:
  - subtask ID, mode, screen/component goal,
  - docs/code inspected,
  - route/component/mock data files likely to change,
  - proposed layout, states, responsive approach, and mock data shape,
  - what will not be touched, especially backend/API/database/worker,
  - expected static/focused UI checks, and screenshots only when `screenshot` was requested,
  - risks, blockers, assumptions, and questions.
- End by asking the owner to approve or revise the plan.
- If the owner later says `/do`, "ok", "làm đi", "triển khai đi", or similar, continue from the approved plan, re-check `git status --short`, re-read any docs/code that may have changed, then implement.
- If the owner revises the plan, update the plan and wait again before implementing.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read the requested subtask in `docs/09-implementation-plan.md` and the matching milestone file in `docs/implementation/` (for example `M3.4` -> `docs/implementation/M3.md`).
3. Read the subtask `Mode`.
4. If present, read `.codex/plans/codex-execution-plan.md`.
5. If useful for orientation, read `.codex/context/current-context.md`, `.codex/context/code-index.md`, and `docs/implementation/feature-coverage-matrix.md`.
6. Read UI docs:
   - `docs/11-ui-design-system.md`
   - `docs/08-ui-pages-and-components.md`
   - `docs/ui-references/reference-notes.md` if relevant.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
7. Read `docs/12-performance-and-observability.md` when the UI has list/search/heavy interaction, large media, or performance-sensitive learning flows.
8. Read `docs/13-seo-and-content-discovery.md` when the UI is landing, public course list/detail, public news/event, or any route intended to be indexable.
9. Read `docs/02-user-flows.md` for the affected role/flow.
10. Read `docs/05-api-contract.md` and the matching `docs/api/` file only to understand expected data shape; do not connect API.
11. Inspect existing web code and component patterns.
12. Give a short plan: subtask mode, screen/component, mock data location, likely files, responsive checks, SEO notes if public/indexable, and commands.

In plan mode, stop after this plan and wait for approval.

## Scope Rules

- Continue only when `Mode` is `UI only` or `UI + API`.
- If the requested subtask has no UI surface or has another mode, stop before editing files, explain that `/task-ui` is not the right mode, and suggest `/task-full <ID>` or the correct next command.
- Only implement front-end UI and mock data.
- Treat `/task-ui` output as production-quality UI, not a technical demo. Mock data is only an implementation detail behind the screen.
- Do not edit backend, database, Prisma, API services, workers, payment, storage, or AI logic.
- Do not connect real API calls.
- Do not add features outside MVP or outside the requested subtask.
- If new routes/components/features are created, update `.codex/context/code-index.md` or `docs/implementation/feature-coverage-matrix.md` only when that helps future tasks find or track the UI.
- If required API/backend does not exist, keep UI mock-only and note `/task-connect` may be blocked later.
- Use the approved stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query only if useful for local UI state mock, Zustand only for small UI state.
- In `apps/web`, use absolute alias imports/exports with `@/...` for internal source files. Do not use `../` or `./` between route, feature, component, hook, schema, data, utility, or barrel files, except framework-generated files or tool-required relative imports.
- For non-trivial UI screens, split code by responsibility from the first implementation: page/manager for composition, feature hook for orchestration, one component implementation per `.tsx` file, schema/type files for form validation, utility files for mapper/formatter/helper logic, and a separate mock-data file. Barrel files may export many components only when they contain no JSX implementation. Do not leave a large screen or shared primitive file with many components or helpers in one file.
- Before creating new UI primitives, form controls, hooks, client services, or API helpers, inspect existing shared components/hooks and approved UI patterns. Reuse them, or promote the reusable part to `apps/web/components`, a shared hook/client layer, or another clear shared location. Do not recreate an approved input/select/button/card pattern with a different style in a later screen.
- Mock data must be obvious, typed where practical, and easy to delete or replace when `/task-connect` runs.
- Mock data must not leak into visible product copy. Do not show labels such as `mock`, `M2.4`, `task-ui`, `connect API later`, `backend enforce`, `Codex`, technical implementation notes, debug text, test hints, or roadmap/task labels in the UI unless the product itself genuinely needs that language.

## UI Requirements

- Follow `docs/11-ui-design-system.md`.
- Use the default UI tokens from `docs/11-ui-design-system.md`; do not invent a new palette per screen.
- Write visible text as real production copy for the target user role. Put technical explanation in final responses, docs, comments, or test names, not in the product surface.
- If the owner provides a reference image, extract the relevant visual principles instead of copying the reference literally; for auth/register/login, a dashboard reference may inspire color, rounded cards, icons, spacing, and energy, but the result must remain a clear auth flow. If the owner says the reference is a mobile design, prioritize matching the mobile layout first and do not add extra footer chips, secondary tabs, or out-of-scope steps.
- Keep user-facing copy concise and action-focused. For student/parent auth/register/forgot/reset screens, prefer a small brand cue, one clear title, one short supporting sentence, form labels, CTA, and essential links; avoid side panels or repeated cards whose main purpose is explaining how the system works.
- For student/parent auth/register screens, keep the UI lively and age-appropriate: use a bright but controlled learning palette, clear CTA emphasis, suitable photo/illustration or light visual accents, and fitting typography instead of flat gray enterprise styling.
- Avoid adult coworking, office, corporate, or worker-style photos for student auth. Prefer school-age study visuals such as desk, books, backpack, classroom, formulas, flashcards, or student illustrations.
- When auth uses a strong visual, prefer a clear desktop split-screen: left visual/slogan panel, right clean form panel. Avoid floating explanatory hero cards on top of the background if the result feels unclear.
- Auth visual panels should use brand welcome copy and a short value slogan, not detailed role-function explanations.
- A distinct display font can be used for auth visual-panel headings to add youthful character, while form/body typography should remain highly readable.
- Auth visual panels must not use oversized all-black headlines or opaque blocks that hide the learning background. Prefer moderate gradient/accent display text, translucent panels, compact learning icons, and subtle motion with `prefers-reduced-motion` support.
- Build polished, careful screens with real layout hierarchy, spacing, typography, navigation, empty/loading/error/success states, and actions the target user would naturally expect.
- UI must look and behave like production, even when data is mocked. Mock data is acceptable; static fake controls are not.
- Any visible button, checkbox, tab, menu, input, toggle, accordion, modal, filter, pagination, upload, editor, chart control, or clickable-looking icon must use semantic elements, real state/handlers, and pressed/pending/disabled/loading feedback as appropriate. If API is not connected, implement local/mock state that mirrors the production behavior.
- Mobile-first, with tablet/iPad and laptop/desktop support.
- Keep mobile interactions smooth: immediate pressed/pending/loading feedback, low perceived latency, no heavy animation or large blocking render.
- Include loading, empty, error, and disabled states when the screen has data/action.
- Use shadcn/ui primitives when available.
- Use `lucide-react` icons when icons are needed.
- Do not create desktop-only layouts.
- For long lists/search/filter UI, use pagination/infinite/virtualized patterns or debounce in the mock flow when relevant.
- For public/indexable UI, keep content structure SEO-friendly: one clear `h1`, meaningful headings/text, alt text for important images, and a layout that can later support metadata/canonical/Open Graph.
- Do not run browser/mobile/desktop checks by default. Owner will self-check UI/tương tác; run browser/Playwright/screenshot only when explicitly requested.
- Only create or save screenshots when screenshot mode is enabled by the command, for example `/task-ui screenshot M3.4`. If the command does not contain `screenshot`, do not run screenshot capture or leave new screenshot artifacts.

## Owner Approval Memory

When the owner says the UI is approved, for example "ưng rồi", "ok rồi", "đúng ý rồi", "chốt UI này", or "giữ style này":

- Add a concise entry to `docs/ui-references/approved-patterns.md`.
- Record context, approved layout/style choices, things to avoid, reusable screens/flows, and screenshot/file evidence if available.
- Update `docs/11-ui-design-system.md` only when the owner approves a broad rule that should apply across many screens.
- Do not update changelog; `/commit` will record the approved UI/docs changes if a commit is created.

## Verification

Run checks proportional to risk:

- Default for UI-only work is speed-first lean verification per owner preference. Do not automatically run `typecheck`, `lint`, `build`, Playwright, or E2E after every UI task.
- If the owner writes `sửa nhanh`, `fast`, or `check nhẹ`, use the fastest safe path by default: inspect the smallest relevant scope, patch directly, avoid unrelated refactor/cleanup, do not update changelog, and skip typecheck/lint/build/Playwright/E2E unless the change touches shared logic, route guards, form/session/data behavior, or obvious TypeScript risk.
- Micro UI tweaks such as moving one image, changing one spacing value, or adjusting one color must use the fastest path: inspect only the directly relevant file, patch the smallest property, do not update changelog, run at most a focused format/diff check, then report. Do not bundle unrelated workflow/docs cleanup into the same user-visible UI fix unless the owner explicitly asks for it.
- Prefer `git diff --check`, a targeted format check, or manual visual reasoning for small UI/copy/spacing/color/mock-data changes.
- Run `pnpm --filter @learning-path/web typecheck` only when web types are likely affected, such as new props, shared components, form schemas, route files, conditional state, or TypeScript errors.
- Run lint/build only when the change is broad, touches shared primitives/layout across screens, or a previous command suggests risk.
- If useful, provide URL/route for the owner to self-check; do not run responsive viewport checks unless explicitly requested.
- In screenshot mode only, save screenshots under `.codex/screenshots/<subtask-or-screen>-<viewport>.png`.
- For tiny docs/wording changes, `Not run: docs-only` is acceptable.

## Lean Mode For Small UI Tasks

For tiny, low-risk UI tasks, optimize for speed.

Allowed reductions:

- Skip full repo lint/build when only a small component, copy, spacing, mock data, or docs changed.
- Run only `git diff --check`, a targeted format check, or a quick visual/manual check when enough. Focused web typecheck is optional, not default.
- Skip screenshot generation unless the owner explicitly requested screenshot mode.

Non-negotiable:

- Keep mobile-first and no-overlap checks in mind even when manual.
- Keep smooth interaction checks in mind: tap feedback, loading state, no obvious layout shift, no expensive animation.
- Do not use lean mode for payment flows, data-connected UI, route guards, or multi-screen changes with state/business risk. For auth UI visual-only iteration, lean mode is acceptable; use broader checks only when changing form logic/session/data behavior.
- If larger checks are skipped, state `Not run: <reason>` in the final response. Do not list skipped screenshots as a gap when the command did not request screenshot mode.

## Learning Notes

After UI work, update `docs/learning-notes/` only when the UI pattern or screen flow teaches something reusable.

- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer updating the matching feature note in `docs/learning-notes/features/`.
- For UI-only work, update the `Front-end`, `Luồng code end-to-end`, `File quan trọng`, or `Kiến thức cần nhớ` sections rather than creating frontend-only notes.
- Do not copy the final response verbatim.
- Do not duplicate design rules already captured in `docs/11-ui-design-system.md` or `docs/ui-references/approved-patterns.md`; link/summarize instead.
- Do not update changelog when learning notes change; `/commit` will record the commit's main changes.
- If not updated, mention briefly in the final response.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the UI implementation or plan is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when implementation or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/task-ui M3.4` or `/task-ui plan M3.4`. For plan mode, say the plan is ready for approval. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Completed `/task-ui` ID(s).
- What UI was built and where mock data lives.
- Responsive checks done or skipped.
- Mobile smoothness/performance checks done or skipped.
- SEO/public discovery checks done or skipped when the screen is public/indexable.
- Screenshot paths if screenshots were created.
- Files changed.
- Commands run or skipped with reason.
- `Giải thích kỹ thuật dễ hiểu`:
  - Mục tiêu kỹ thuật của UI.
  - Luồng code UI: route/page -> component -> mock data -> local state/form state -> render states.
  - Kỹ thuật UI đã dùng: responsive/mobile-first, component composition, form/state/mock data pattern, loading/empty/error state nếu có.
  - Vì sao làm vậy: cách này giúp UI dễ review, dễ thay mock bằng API ở `/task-connect`.
  - File quan trọng: page/component/mock data/style helper liên quan.
  - Bạn nên hiểu gì sau task này: 2-4 ý về cách màn hình được dựng.
- Whether learning notes changed.
- Suggested next command: `/task-connect Mx.y`, plus the exact task `Mode` from the milestone file and a one-sentence description of what the connection step will do.

Do not update changelog here. Changelog is written only during `/commit`, with one short, coherent entry for the whole commit.
