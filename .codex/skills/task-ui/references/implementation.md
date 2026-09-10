# Task UI Implementation Mode

Read only for `/task-ui ...` execution.

## Build the reviewable UI

- Treat mock data as a replaceable typed boundary, never visible technical copy.
  Do not show task IDs, “mock”, backend notes or test hints in product UI.
- Build production-like hierarchy, copy and semantic interactions with real local
  state plus required loading/empty/error/success/pending/disabled states.
- Follow the nearest approved components and code patterns. Keep route/page thin,
  screen orchestration in the feature, one component implementation per file and
  schemas/data/types/utils outside JSX as routed by source-structure docs.
- Preserve role viewport priority from `AGENTS.md`, responsive quality across all
  breakpoints, both themes, accessible controls and lightweight interactions.
- Use the design-system and routed pattern as the source for form validation,
  modal structure, buttons, media, typography and auth-specific visual rules;
  do not duplicate those contracts in this skill.
- Public/indexable screens preserve semantic headings, crawlable content and image
  alt behavior. List/search-heavy screens model suitable pagination/debounce.

## Approval and verification

- UI approval memory is owned by `/accept-ui`. Do not update approved-pattern or
  design-system docs while feedback is still being iterated.
- Small visual/copy/mock changes use targeted format/diff or focused checks. Do
  not claim visual verification without browser evidence.
- Large/multi-screen/shared/form/session/public-flow work requires affected web
  typecheck, relevant lint/build/tests and runtime/E2E checks when practical.
- Save screenshots only in `screenshot` mode, under `.codex/screenshots/`. Report
  unavailable checks as `Not run: <reason>`.

Final response reports the UI/mock boundary, key files, responsive/performance/
SEO checks when applicable, screenshots if created and skipped checks. Suggest
`/task-connect Mx.y` with exact Mode when the connection step is ready.
