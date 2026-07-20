---
name: design
description: Create complete production UI images, multi-state UI case sets, combined UI flow-board images, and direct-view HTML flow maps for this Vietnamese learning-path project from commands like "/design mobile M4.5", "/design laptop admin course detail", "thiết kế ảnh UI màn ...", "bao phủ mọi case", or "sơ đồ luồng UI". Use when Codex must design only the fully finished, real-app-quality visual screenshot/mockup/flow map for a requested screen, viewport, role, route, milestone, or subtask by first reviewing approved UI patterns, final-screen-ui screenshots, UI rules, code patterns, roadmap docs, and existing implementation context. Do not implement product code unless the owner separately asks to code.
---

# Design

Use this skill to produce a complete production UI image for a requested screen before implementation.

The output is a final-quality visual target for implementation, not a rough draft, wireframe, concept sketch, or code task. The design must look like a real screen users could use in production and must stay consistent with the project's approved UI direction and real screens.

## Command Parsing

Accept commands such as:

- `/design mobile M4.5`
- `/design ipad M4.5`
- `/design laptop M4.5`
- `/design mobile admin lesson document upload`
- `/design student course detail dark mode`
- `thiết kế ảnh UI màn ...`

Parse:

- Viewport: `mobile`, `ipad`, `laptop`; if omitted, choose by role priority from `AGENTS.md` and `docs/11-ui-design-system.md`.
- Target: milestone/subtask like `M4.5`, role/screen name, route, or free-form screen description.
- Role: infer from target/docs/code; if unclear, choose the most likely role and state the assumption before generating.
- Output intent: complete UI image only unless owner explicitly asks for product code.

## Required Context

Before generating any design image, read these sources:

1. `AGENTS.md`
2. `docs/11-ui-design-system.md`
3. `docs/ui-references/approved-patterns.md`
4. `docs/ui-references/code-patterns.md`
5. `docs/final-screen-ui/README.md`
6. `docs/final-screen-ui/manifest.json` if it exists
7. `docs/08-ui-pages-and-components.md`
8. `docs/09-implementation-plan.md`
9. Relevant `docs/implementation/M*.md` when the target names a milestone/subtask
10. Existing route/screen/component code for the closest implemented screen

Then read only the relevant code-pattern files under `docs/ui-references/code-patterns/` based on the screen type:

- Admin CRUD/list/detail: `admin-crud.md`, `forms.md`, `actions-and-badges.md`, `detail-layouts.md`, `states.md`
- Upload/document flow: `uploads.md`, plus admin CRUD/forms/states if admin-facing
- Student course/lesson surfaces: `student-learning-surfaces.md`
- Auth/public form: `forms.md`, `states.md`, plus approved auth patterns
- Parent portal: closest parent docs/screens if present, otherwise approved student/public patterns with parent tone from UI design system

## Final-Screen UI Review

Use `docs/final-screen-ui` as the visual truth for currently accepted screens.

Before designing:

- List candidate screenshots that match the target role, viewport, route, or interaction style.
- Open and visually inspect the strongest 2-5 screenshots with `view_image`.
- Prefer screenshots in the requested viewport.
- If the exact role has no screenshots, inspect the closest role and say what is being borrowed.
- If `docs/final-screen-ui` is missing or empty, fall back to `approved-patterns.md` and existing code, and state that no final screenshot baseline exists.

Do not confuse `docs/final-screen-ui` with temporary `.codex/screenshots` artifacts; final-screen-ui is the durable production reference.

## Design Method

Choose the most reliable method for a real-app-quality UI image:

- Default to a temporary HTML/React/static prototype and screenshot it with Playwright/browser, especially for exact Vietnamese copy, dense admin controls, forms, tables, upload flows, dashboards, document viewers, or any UI where text/layout fidelity matters.
- Use image generation only for supporting bitmap assets or illustrations inside the UI, not as the primary way to render the whole app screen, unless the owner explicitly requests a purely generated visual.
- Keep temporary artifacts outside product routes unless the owner asks to implement.

When creating a temporary prototype:

- Put it under `.codex/designs/<target-slug>/` or another ignored temporary area, unless the owner asks to keep source.
- Use the same viewport dimensions as final-screen-ui: laptop `1440x1000`, iPad `834x1112`, mobile `390x844`.
- Save exported design images in `docs/final-screen-ui/_designs/<viewport>/<role>/<target-slug>/screen.png` unless owner names another location.
- Do not update `docs/ui-references/approved-patterns.md` from the generated design image. That file is only for owner-approved UI after the owner says "ưng/ok/chốt".

## Multi-Case And Flow Outputs

When the request asks to cover many cases, all states, a complete flow, or a UI flow diagram, produce more than one isolated screenshot:

- Save each state/case as its own screenshot under `docs/final-screen-ui/_designs/<viewport>/<role>/<target-slug>/<case-slug>/screen.png`.
- Create a combined overview image named `flow-board.png` in the target folder. It must group cases by the real user/admin flow, number the nodes, label state types, and show arrows/branch notes for main, pending, confirmation, success, and error paths.
- In multi-case flows, model the happy path first and include every real user/admin input screen in order. Do not let an error state or a post-save summary stand in for the primary action screen. For example, if admins must enter page ranges, include a dedicated "Nhập khoảng trang" screen before validation/error/success nodes.
- Create a direct-view HTML file named `flow-board.html` in the same target folder. It must use relative image paths, work by opening the local HTML file directly in a browser, include navigation between flow groups, and allow clicking an image to view it larger.
- Create an `index.html` entry file in the same target folder that opens or redirects to `flow-board.html`, so the folder has an obvious browser entrypoint.
- In the HTML flow viewer, thumbnails/screenshots must show the full image by default. Do not crop with fixed `max-height`, `object-fit: cover`, or similar rules unless the owner explicitly asks for cropped previews.
- In the HTML flow viewer, constrain screenshot node widths so a group with only one screenshot does not stretch a mobile screenshot across the whole page. Prefer bounded grid columns such as `repeat(auto-fit, minmax(230px, 360px))` with `justify-content: start`.
- In the HTML flow viewer, include a quick flow guide for each node/mode: what must happen before reaching this screen, what this screen is for or what the user/admin does here, and what result is received after the screen/action.
- Add or update a local `README.md` in the target folder listing all cases, `flow-board.png`, and `flow-board.html`.
- Keep individual case screenshots available even after creating the combined image and HTML viewer.

## Design Quality Rules

The design must:

- Look like a production screen, not a wireframe, landing-page placeholder, roadmap note, or technical diagram.
- Be visually complete enough to implement directly: full layout, navigation/shell, real labels, realistic data, visible primary/secondary actions, important states, spacing, iconography, density, and responsive behavior must already be decided in the image.
- Avoid "placeholder design" language. Do not label the image as draft, concept, mock, TODO, coming soon, or temporary inside the UI.
- Match the role's visual language:
  - Admin: laptop-first, dense, utilitarian, clear sidebar/header/actions, no marketing hero.
  - Student: mobile-first, friendly, bright, task-focused, with approved student shell/card/progress rhythm.
  - Parent: calm, trustworthy, concise, less playful than student.
  - Public/auth: polished onboarding or public browsing, SEO-readable when relevant.
- Use approved patterns and screenshots before inventing new layout language.
- Include realistic Vietnamese UI copy for the role.
- Write UI copy as product copy for the real user, not as an implementation explanation. Do not expose backend/debug terms such as artifact, cache, JSON, manifest, chunk, provider, schema, RAG, or raw OCR internals in the screenshot unless that exact term is already part of the product vocabulary and useful to the user.
- Keep app-screen copy terse. A production UI is not a usage guide: do not add long instructional/explanatory paragraphs, technical process descriptions, or “what this feature does” narration inside the screenshot. Prefer short labels, status words, numbers, and actions. Put detailed “Trước đó / Màn này / Kết quả” guidance only in the separate flow-board HTML, not inside the app UI image.
- Avoid process-explainer wording in screenshots when a role-friendly action word works. Prefer “đọc sách”, “đang đọc”, “sách đã lưu”, “cần kiểm tra”, “gán trang”, “hình đã lưu”, and “phí dự kiến” over phrases like “xử lý nội dung”, “dữ liệu”, “nhận dạng”, “trạng thái hệ thống”, or “hàng xử lý”.
- Include realistic loading/empty/error/pending/disabled states when the requested screen naturally needs them.
- Preserve light/dark compatibility in the design direction; if only one theme is requested, mention theme assumption outside the image.
- Avoid fake controls without state implications: buttons, tabs, filters, upload actions, modals, checkboxes, selects, and tables must imply real product behavior.
- Keep text legible and inside its container at the target viewport.
- Avoid unrelated feature creep outside the requested screen/subtask.

## M4.5 Shortcut

For `/design <viewport> M4.5`, design the admin lesson document upload/status flow.

Required context:

- `docs/implementation/M4.md`
- `docs/ui-references/approved-patterns.md#admin-lesson-document-upload---2026-07-17`
- `docs/ui-references/code-patterns/uploads.md`
- Existing admin course list/detail screenshots from `docs/final-screen-ui/<viewport>/admin/courses/`
- Existing admin course code under `apps/web/features/admin/courses/`

Core UI to cover:

- Source document at learning-path level.
- Upload/replace source PDF action.
- Document reading/page status, quality summary, cost estimate if surfaced by backend. Translate backend terms into admin-friendly copy such as "đọc sách", "đã đọc", "hình đã lưu", "dùng kết quả cũ nếu sách trùng", and "cần kiểm tra" instead of showing artifact/cache/manifest/chunk/crop/provider jargon in the UI.
- Lesson page-range mapping table/list with `fromPage`/`toPage`, validation, warning/status.
- Per-lesson actions: replace primary document and upload supplemental document as separate actions.
- No temporary/staging upload inside create-lesson modal.

## Plan Before Image

Before generating the image, give a short plan in Vietnamese:

- Target and viewport.
- Docs/screenshots inspected.
- Role and route assumption.
- Layout direction and major sections.
- Output path.

Keep this plan brief; do not ask for confirmation unless the target is genuinely ambiguous or the requested design could imply a major product decision.

## Verification

After producing the image:

- Open the generated screenshot with `view_image`.
- Check for blank output, clipped text, overflow, overlap, wrong role style, and missing primary states.
- If using a browser/prototype, run the smallest relevant static check and screenshot check.
- For multi-case flow outputs, verify the flow-board image/HTML loads every case screenshot, has the expected node/image count, has no horizontal overflow, and preserves full screenshot aspect ratios in the HTML viewer.
- Do not claim the image is owner-approved; say it is a complete production UI design image awaiting owner approval until the owner says it is okay/ưng/chốt.

## Final Response

Include:

- Design image path.
- Flow-board image and HTML viewer paths when a multi-case/flow output was created.
- Viewport and role.
- Key references used.
- Any assumption or missing baseline.
- Checks performed.

Do not call the image a draft. Do not say product code was implemented unless it actually was.
