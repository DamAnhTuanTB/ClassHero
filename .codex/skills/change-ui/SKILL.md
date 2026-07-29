---
name: change-ui
description: Change only the front-end UI for the Vietnamese learning-path project from commands like "/change-ui màn landing page sửa hero nhỏ lại", "/change-ui chỗ card khóa học đổi layout", or "sửa UI màn ...". Use when Codex must adjust existing UI according to owner feedback without changing backend/API/database/business logic, preserve mobile-first/tablet/desktop quality, avoid updating approved UI pattern/design-system docs until the owner explicitly says the UI is approved such as "Oke, ưng UI này", run proportional UI checks, and explain the visual/code flow changed.
---

# Change UI Runner

Use this skill when the owner wants to adjust UI only.

## Command Parsing

Accept:

- `/change-ui <screen/place and requested UI change>`
- `/change-ui screenshot <screen/place and requested UI change>`
- `/change ui <screen/place and requested UI change>`
- `sửa UI <screen/place and requested UI change>`
- `đổi giao diện <screen/place and requested UI change>`

If `screenshot` appears after the command, enable screenshot mode only when the owner explicitly asks for it. Per owner preference, do not run browser checks, Playwright UI, screenshots, or real interaction checks by default. Without the `screenshot` keyword or an explicit browser-check request, do not create/save screenshots and do not run browser/Playwright UI checks; use proportional static/focused code checks instead.

If the target screen/component is unclear, ask one concise question. If the request includes an attached reference image/design, inspect it before editing. Extract the relevant visual principles instead of copying the reference literally; for auth/register/login, a dashboard reference may inspire color, rounded cards, icons, spacing, and energy, but the result must remain a clear auth flow. If the owner says the reference is a mobile design, prioritize matching the mobile layout first and do not add extra footer chips, secondary tabs, or out-of-scope steps.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/11-ui-design-system.md`.
3. Read `docs/14-source-code-structure.md`.
4. Read `docs/08-ui-pages-and-components.md` if the target screen/component needs routing/context.
5. Read `docs/12-performance-and-observability.md` if the UI change touches list/search/cache behavior, large media, heavy interaction, latency-sensitive learning/payment/AI flow, or perceived performance.
6. Read `docs/13-seo-and-content-discovery.md` if the target is landing, public course list/detail, public news/event, or another indexable public page.
7. Read `docs/ui-references/approved-patterns.md` if present and relevant.
8. Read `0. Cách Đọc Nhanh` in `docs/ui-references/code-patterns.md`, then read only the matching file/section in `docs/ui-references/code-patterns/` when the change touches form, modal, detail grid, action button, upload, badge/status, loading/empty/error state, or another reusable UI code flow.
9. Inspect existing web code for the target screen/component.
10. Inspect `git status --short`.
11. If the task creates or touches a form, inspect `apps/web/components/common/forms`, similar feature forms, and `docs/ui-references/approved-patterns.md` before editing.
12. Give a short plan: target UI, files/layers likely touched, shared pattern/form reuse, responsive/performance/SEO checks if relevant, and commands.

## Scope Rules

- Only change front-end UI code, styling, layout, text presentation, icons, visual states, mock visual data, or component composition.
- Do not edit backend, API contract, database, Prisma, worker, payment, storage, AI/RAG, env, or business rules.
- Do not connect new real API calls.
- Do not add product features outside the requested UI change.
- Preserve approved UI patterns unless the owner explicitly asks to change them.
- Keep mobile-first support and preserve tablet/iPad/desktop quality through responsive code reasoning by default; run browser/device checks only when the owner explicitly asks.
- Preserve or improve smooth mobile interaction: immediate tap feedback, stable layout, no heavy animation/render, and friendly loading state.
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
- If the approved UI introduced or normalized reusable implementation for form, modal, detail grid, action button, upload, badge/status, loading/empty/error state, or another UI code flow, also update `docs/ui-references/code-patterns.md` routing and the matching file in `docs/ui-references/code-patterns/` with the code pattern, checklist, and anti-pattern.
- Update `docs/11-ui-design-system.md` only if the approval creates a broad reusable UI rule.
- Do not update changelog; `/commit` will record the approved UI/docs changes if a commit is created.

Changelog is not written during UI iteration. It is written only during `/commit`, with one short, coherent entry for the whole commit.

## UI Work Rules

- Use existing components and local patterns first.
- Follow `docs/14-source-code-structure.md`: keep route/page and screen components thin, do not add new subcomponents/helpers/schema/mock data into an already large UI file, and preserve one component implementation per `.tsx` file.
- Use Tailwind/shadcn/ui/lucide/framer only as already available in the project.
- Every new or touched UI must support both light and dark themes within the task scope. Do not polish only one theme; route colors through shared semantic tokens/utilities and verify text, surface, border, shadow, icons, buttons, labels, form controls, modals, tables, badges/status, loading/empty/error states, and media/overlays in both themes.
- When creating or touching any form, first pick the closest approved/reference form pattern from `apps/web/components/common/forms`, a similar feature form, or `docs/ui-references/approved-patterns.md`; reuse or upgrade that pattern instead of making a new visual/control variant. If no matching pattern exists, state the assumption in the plan/final.
- Run a mandatory form-quality audit before final response: follow the closest approved/reference form pattern first (`mode: "onChange"`, `reValidateMode: "onChange"`, pass `form.formState.errors.<field>` directly to field primitives, and do not call `trigger()` right after `reset()` on modal open), every required/limited field must show a visible error state and message while the user edits, validation copy must match the failing rule (`Nhập ...` only for empty required fields, separate copy for min length/format/range/duplicate), required text fields should use the shared validation helper such as `requiredTrimmedText`, modal/drawer action buttons must stay clickable for invalid/pristine forms so submit can reveal inline validation errors and only disable for pending/saving or a hard missing prerequisite, modal/drawer forms must reset/default correctly, and numeric fields must not use native browser number controls when the app already has styled text/numeric inputs.
- Include or preserve loading, empty, error, disabled, hover/focus states when the touched UI needs them.
- When the owner requests a scoped visual change such as color only, preserve every
  unrequested visual property and effect, including shadow depth, glow, transform,
  border, radius, spacing, hover, active and focus behavior. Do not replace the
  existing class or variant with another shared class unless its computed visual
  behavior is equivalent. When recoloring a 3D button, keep the original shadow
  offsets, blur, spread and press translation, and recolor every state together.
- When a shared component receives a feature-specific accent, apply that accent to
  every accent-bearing element in the component (such as its icon, close control,
  primary action, border and related alert surface), including hover and dark
  states. Do not leave part of a Flashcard/Quiz flow on the default theme color.
- UI changes must feel production-ready, not static mockups: visual hierarchy, copy, states, controls, and expected actions should match what a real user would use.
- Button text must never wrap to a second line. Keep all button labels one-line with `white-space: nowrap`/`whitespace-nowrap`; if the label does not fit, adjust layout, width, padding, font size, or copy instead of allowing wrapping.
- Với editor công thức Toán/Lý/Hóa, LaTeX chỉ là định dạng dữ liệu lưu phía sau, không được dùng textarea/input mã LaTeX thô làm UX nhập chính. UI phải ưu tiên math field WYSIWYG có toolbar ký hiệu/cấu trúc trực quan; khi chọn phân số, căn, lũy thừa, tích phân hoặc cấu trúc tương tự, người dùng phải nhập trực tiếp vào từng vùng hiển thị thật và điều hướng được giữa các vùng bằng click/chạm, `Tab` hoặc phím mũi tên. Raw LaTeX chỉ được mở như chế độ nâng cao nếu owner yêu cầu rõ.
- Decorative math expressions must not render a standalone Unicode `√` because
  many fonts omit the visible vinculum. Use the shared radical expression pattern
  with a real overbar and an explicit radicand such as `x` or `49`.
- All modal/drawer UI must be vertically and horizontally centered in the viewport at every breakpoint, including mobile. Do not top-align modals on mobile; constrain long modals with max-height and scroll only the middle body region. Use a compact three-zone structure: fixed visible title-only header at the top, scrollable content in the middle, and fixed visible action/footer area at the bottom. Do not add descriptive subtitles under modal titles, do not let the entire modal scroll, and only the middle content region may scroll. Every modal/drawer must provide a footer `Hủy` action and an `X` close button in the header/shell. Keep modal footer padding compact; on mobile, keep the old rule of one action full width and two actions on one row by default; on laptop/desktop, modal footer buttons should size to their content (`max-content`/`w-auto`) instead of stretching full width.
- Do not create or leave fake-static interaction. Any visible button, checkbox, tab, menu, input, toggle, accordion, modal, filter, pagination, upload, editor, chart control, or clickable-looking icon must use semantic elements, real state/handlers, and pressed/pending/disabled/loading feedback as appropriate. If API is not connected, implement local/mock state that behaves like the production interaction.
- Avoid large redesign unless requested.
- Do not make desktop-only layouts.
- Keep text from overflowing on mobile/tablet/desktop.
- Keep user-facing copy concise and action-focused. For student/parent auth/register/forgot/reset screens, avoid explanatory side panels and repeated cards; use only text that helps the user complete the action.
- For student/parent auth/register screens, keep the UI lively and age-appropriate: use a bright but controlled learning palette, clear CTA emphasis, suitable photo/illustration or light visual accents, and fitting typography instead of flat gray enterprise styling.
- Avoid adult coworking, office, corporate, or worker-style photos for student auth. Prefer school-age study visuals such as desk, books, backpack, classroom, formulas, flashcards, or student illustrations.
- When auth uses a strong visual, prefer a clear desktop split-screen: left visual/slogan panel, right clean form panel. Avoid floating explanatory hero cards on top of the background if the result feels unclear.
- Auth visual panels should use brand welcome copy and a short value slogan, not detailed role-function explanations.
- A distinct display font can be used for auth visual-panel headings to add youthful character, while form/body typography should remain highly readable.
- Auth visual panels must not use oversized all-black headlines or opaque blocks that hide the learning background. Prefer moderate gradient/accent display text, translucent panels, compact learning icons, and subtle motion with `prefers-reduced-motion` support.
- Keep interaction lightweight; avoid animation/layout changes that make mobile feel laggy.
- On branded loading or transition screens, decorative icons must remain secondary
  to the brand logo and status. Omit decorative icon badges by default when they do
  not communicate necessary state. Never use large saturated icon tiles, opaque
  badges, heavy shadows, or high-contrast moving icons that compete with the logo.
- For public/indexable pages, do not break heading hierarchy, crawlable text, alt text, or metadata-friendly structure while changing visuals.
- Only create or save screenshots when screenshot mode is enabled by the command, for example `/change-ui screenshot màn đăng ký`. If the command does not contain `screenshot`, do not run screenshot capture or leave new screenshot artifacts.

## Verification

Run checks proportional to the UI change:

- Default for UI feedback is speed-first lean verification. Do not automatically run `typecheck`, `lint`, `build`, Playwright, or E2E after every UI tweak.
- If the owner writes `sửa nhanh`, `fast`, or `check nhẹ`, use the fastest safe path by default: inspect the smallest relevant scope, patch directly, avoid unrelated refactor/cleanup, do not update changelog, and skip typecheck/lint/build/Playwright/E2E unless the change touches shared logic, route guards, form/session/data behavior, or obvious TypeScript risk.
- Micro UI tweaks such as moving one image, changing one spacing value, or adjusting one color must use the fastest path: inspect only the directly relevant file, patch the smallest property, do not update changelog, run at most a focused format/diff check, then report. Do not bundle unrelated workflow/docs cleanup into the same user-visible UI fix unless the owner explicitly asks for it.
- Small CSS/layout/text/color/spacing/icon/image-position changes: `git diff --check`, a targeted format check, or manual visual reasoning may be enough.
- Component/page changes: run focused typecheck/lint/build only when the change touches shared primitives, form/state logic, route structure, conditional rendering, or likely TypeScript errors.
- Visual change: check by code reasoning/static inspection by default; do not run browser/mobile/desktop checks unless the owner explicitly asks.
- For repeated CSS/visual tweaks on the same screen, do not treat `git diff --check`, typecheck, or a successful patch as proof that the browser UI now looks correct. Theme tokens, dark mode, route-group CSS, global overrides, `!important`, HMR/cache, or the wrong rendered component can hide the intended change. If browser/screenshot/computed-style verification was not explicitly requested, say the change was patched and static checks passed, not that the visual result was verified. If the owner says the UI still did not change, first inspect the rendered route/component, dev server/HMR/cache, active theme, and CSS cascade/computed style before changing more classes.
- In screenshot mode only: save review screenshots under `.codex/screenshots/`.
- Interaction change: verify by code reasoning/typecheck/static inspection by default; owner will test real interaction.
- Do not state inability to run browser checks as a gap unless the owner explicitly requested browser verification.
- If larger checks are skipped for speed, write `Not run: UI lean mode per owner preference` or a more specific reason in the final response.

Do not write UI changelog entries here. Changelog is written only during `/commit` for the commit being created.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the UI change is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when implementation or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/change-ui <screen/topic>`. Keep the message short, outcome-focused, and free of secrets. For CSS/visual tweaks verified only by static checks, phrase the message as code-level completion (for example "Đã patch class và check tĩnh") instead of implying browser visual verification. Notification failure must not block the final response.

## Final Response

Include:

- Screen/component changed.
- What UI changed.
- Files touched.
- Checks run or skipped with reason.
- Screenshot paths if created.
- Whether approval docs were updated. If not approved yet, say they were intentionally not updated.
- Suggested next step: review UI, then say `Oke, ưng UI này` if approved.
