---
name: commit
description: Create one or more git commits for the Vietnamese learning-path project when the user types "/commit", "/commit all", "commit giúp tôi", or asks Codex to commit current changes. Use when Codex must inspect the worktree, decide whether one commit or multiple consecutive commits best fits the diff, verify changelog requirements from AGENTS.md, avoid committing secrets or unrelated unsafe files, stage the intended project changes batch by batch, write short conventional commit messages, run lightweight checks when practical, execute git commit, and report commit hashes and included files.
---

# Commit Runner

Use this skill to turn the current repo changes into one or more clean git commits without making product changes.

## Command Parsing

Accept these forms:

- `/commit`
- `/commit all`
- `/commit fast`
- `/commit full`
- `/commit all fast`
- `/commit all full`
- `/commit <optional hint>`
- `commit giúp tôi`
- `commit các thay đổi hiện tại`

Verification mode:

- `smart`: default for `/commit`; choose checks from the diff.
- `fast`: for `/commit fast`; run only required safety checks plus the smallest relevant validation.
- `full`: for `/commit full`; run broader checks before committing.

If the user provides another hint, use it only as guidance. The diff and changelog remain the source of truth for the commit message.

Commit scope:

- Plain `/commit` may create one commit or multiple consecutive commits when the diff clearly contains separate safe scopes.
- `/commit all` means attempt to commit every safe intentional source change in the worktree. If the remaining changes form multiple coherent scopes, split them into multiple commits automatically instead of forcing one giant commit.
- Do not leave intentional changes uncommitted after `/commit all` unless a safety gate blocks them, the scope is unclear/risky, or a verification/commit command fails.
- If a user hint conflicts with the diff, trust the diff and explain the chosen grouping.

## Required Startup

Before committing:

1. Locate repo root containing `AGENTS.md`.
2. Read `AGENTS.md`, especially changelog and commit rules.
3. Run `git status --short`.
4. Inspect `git diff --stat`, `git diff --name-only`, staged diff if any, and file-level diffs needed to understand the change.
5. Update `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` for each commit being created. Add one short, coherent changelog entry for each commit's actual staged scope.
6. Do not modify production code during `/commit`; only update changelog if needed for commit hygiene.

Use a faster diff-reading path when the work happened in the same active conversation and the changed files are low-risk UI/docs/skill files: inspect status/stat/name-only, targeted hunks, changelog, and safety scan instead of rereading every unchanged context line in full. Still inspect enough diff to write an accurate commit message and catch unrelated or risky files.

## Safety Gates

Do not commit if:

- There are no changes.
- Git user/email is not configured and `git commit` cannot run.
- Diff contains secrets, tokens, private keys, `.env` values, webhook signatures, or production credentials.
- Diff contains merge conflict markers.
- Files look generated, local, or accidental and are not meant for source control, such as `node_modules`, `.next`, `dist`, logs, coverage, or OS/editor files.
- The intended commit scope is genuinely unclear or includes unrelated risky work that cannot be safely split into separate commits.

When blocked, stop and explain the exact reason plus the command or decision needed.

## Commit Workflow

1. Summarize the changed areas from diff and changelog.
2. Decide commit grouping:
   - one commit when the diff is one coherent feature/fix/refactor,
   - multiple consecutive commits when there are clearly separate scopes such as backend/schema, web UI/refactor, docs/skills/context, tests/tooling, or unrelated fixes,
   - block and ask only when grouping cannot be inferred safely.
3. Choose verification mode and explain it briefly.
4. Run verification according to the mode and planned grouping:

- `smart`: choose the smallest checks that cover the touched areas.
- `fast`: run safety checks and minimal validation only.
- `full`: run broad repo/package checks.

5. For each planned commit batch:
   - update changelog with one entry matching that batch,
   - stage the intended files explicitly,
   - re-check `git diff --cached --stat` and `git diff --cached --name-only`,
   - run or confirm the relevant checks cover that batch,
   - create the commit with `git commit -m "<subject>"` and optional extra `-m "<body>"` paragraphs,
   - run `git status --short` and `git log -1 --oneline`.
6. If `/commit all` still has uncommitted safe changes after one commit, continue with the next batch until the worktree is clean or blocked.
7. Do not use `git add .` blindly. Broad staging is acceptable only after inspecting status/name-only and confirming every remaining changed/untracked file belongs to the current batch.

## Multi-Commit Grouping

Prefer multiple commits when it improves reviewability and avoids mixing unrelated intent.

Good split examples:

- `feat(api): ...` for backend endpoints, schema, migrations, API tests, and matching API docs.
- `refactor(web): ...` for front-end source structure, API client split, imports, and code-index updates.
- `docs(codex): ...` for AGENTS/skill/context workflow rule updates.
- `test(api): ...` or `build(api): ...` for isolated test tooling/dependency changes.

Keep one commit when:

- files are tightly coupled and separating would make either commit fail checks,
- a migration and service/controller/tests/docs are all one feature slice,
- a small docs/context update only describes the same code change.

Operational rules:

- Stage by path per batch. If a single file contains changes for multiple batches, include it in the batch where it is safest and most truthful; if that would make history misleading, stop and explain the blocker instead of trying risky hunk surgery.
- Run broad expensive checks once when they cover all planned batches; otherwise run focused checks before the affected batch. Never claim a later batch is covered by a check that ran before its staged files existed or changed.
- If one batch commits successfully and a later batch fails, keep the successful commit(s), leave the rest uncommitted, notify `failed` or `blocked`, and report exactly what remains.
- For `/commit all`, final status should ideally be clean. If not clean, list remaining files and the exact reason they were not committed.

## Verification Selection

Always run these safety checks before committing:

- `git status --short`
- inspect `git diff --stat` and changed filenames
- secret/conflict scan for changed files when practical
- `git diff --check`

Use these mode rules:

### Smart Mode

Default for `/commit`.

- Docs-only: `git diff --check`; `rg` or focused doc checks if useful.
- Skill changes: run the repo's skill validator if available; otherwise do a lightweight frontmatter check for touched `SKILL.md` files.
- Front-end visual-only UI changes, such as copy, color, spacing, Tailwind class tweaks, image position, static layout sizing, or docs/context updates: skip package typecheck by default; use `git diff --check`, targeted Prettier/format check, and static code review.
- Front-end changes that touch TypeScript behavior, props, form/state handlers, route structure, shared UI primitives, schemas, session/auth/data behavior, conditional rendering, or imports/exports: run the relevant web typecheck. Run lint/build only if route/config/build surface changed.
- API/back-end only: relevant api typecheck/lint; build when TypeScript compile surface changed.
- Shared package: typecheck/lint/build for affected packages.
- Prisma/schema/migration: `db:validate`; `db:generate`; API typecheck/build.
- Dependency or lockfile changes: broader typecheck/lint/build unless clearly docs-only package metadata.
- Docker/env/deploy changes: config validation where available; skip full app build unless code/dependency changed.

### Fast Mode

For `/commit fast`.

- Still run safety checks and changelog check.
- Run the repo's skill validator if available; otherwise do a lightweight frontmatter check for touched `SKILL.md` files.
- Run `git diff --check`.
- For docs/skill/context and front-end visual-only UI changes, skip package typecheck by default unless there is obvious TypeScript risk.
- For code changes with behavior risk, run only the most focused typecheck/validation for the touched package.
- Skip full repo `lint`, `build`, browser checks, and broad tests unless the diff is risky.
- In the final response, clearly say which broader checks were skipped because fast mode was requested.

### Full Mode

For `/commit full`.

- Run safety checks.
- Run touched skill validation if applicable.
- Run relevant database/API validation if applicable.
- Prefer full `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm format:check` when available.
- Run focused tests if the diff includes behavior changes and tests exist.

## Commit Message Rules

Use the format from `AGENTS.md`:

```txt
<type>(<scope>): <summary>
```

Choose type from `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.

Scope examples:

- `api`, `web`, `shared`
- `repo`, `docs`, `codex`
- domain scopes such as `auth`, `payment`, `rag`, `courses`

Keep the subject short but meaningful. Prefer one subject line when the change is simple. Add a body only when needed to capture 2-4 important points that do not fit cleanly in the subject.

Examples:

```txt
docs(codex): add bug and commit runner skills
fix(api): inject app service explicitly
chore(repo): add beginner setup README
```

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the commit is created.
- `blocked` when owner input is needed before committing safely.
- `failed` when commit verification or `git commit` fails and the commit cannot be finished in this turn.

Use a concrete task label such as `/commit` or the commit scope. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

After committing, report briefly:

- Commit hash and message. If multiple commits were created, list all hashes/messages in order.
- Main files included.
- Verification mode.
- Checks run or skipped.
- Remaining uncommitted files, if any.

Do not push unless the user explicitly asks.
Do not amend, rebase, reset, or squash unless explicitly asked.

## Changelog Style

During `/commit`, add or adjust changelog for the commit being created:

- Add one short, coherent entry per commit: `- YYYY-MM-DD: <short paragraph summarizing the commit's main changes>`.
- In a multi-commit run, add one changelog entry immediately before each commit batch and stage that entry with the matching commit.
- Do not split one commit into multiple changelog bullets by feature unless the owner explicitly asks.
- Do not use one changelog entry to cover multiple commits.
- Do not add `Summary`, `Changed`, `Files`, `Tests`, or `Notes` sections.
- Keep checks, skipped checks, file lists, and risk notes in the final response or the relevant docs instead of the changelog.
