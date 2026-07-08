---
name: commit
description: Create a git commit for the Vietnamese learning-path project when the user types "/commit", "commit giúp tôi", or asks Codex to commit current changes. Use when Codex must inspect the worktree, verify changelog requirements from AGENTS.md, avoid committing secrets or unrelated unsafe files, stage the intended project changes, write a short conventional commit message that still covers the main points, run lightweight checks when practical, execute git commit, and report the commit hash and included files.
---

# Commit Runner

Use this skill to turn the current repo changes into a clean git commit without making product changes.

## Command Parsing

Accept these forms:

- `/commit`
- `/commit fast`
- `/commit full`
- `/commit <optional hint>`
- `commit giúp tôi`
- `commit các thay đổi hiện tại`

Verification mode:

- `smart`: default for `/commit`; choose checks from the diff.
- `fast`: for `/commit fast`; run only required safety checks plus the smallest relevant validation.
- `full`: for `/commit full`; run broader checks before committing.

If the user provides another hint, use it only as guidance. The diff and changelog remain the source of truth for the commit message.

## Required Startup

Before committing:

1. Locate repo root containing `AGENTS.md`.
2. Read `AGENTS.md`, especially changelog and commit rules.
3. Run `git status --short`.
4. Inspect `git diff --stat`, `git diff --name-only`, staged diff if any, and file-level diffs needed to understand the change.
5. Update `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` for the commit being created. Add one short, coherent changelog entry for the whole commit.
6. Do not modify production code during `/commit`; only update changelog if needed for commit hygiene.

## Safety Gates

Do not commit if:

- There are no changes.
- Git user/email is not configured and `git commit` cannot run.
- Diff contains secrets, tokens, private keys, `.env` values, webhook signatures, or production credentials.
- Diff contains merge conflict markers.
- Files look generated, local, or accidental and are not meant for source control, such as `node_modules`, `.next`, `dist`, logs, coverage, or OS/editor files.
- The intended commit scope is genuinely unclear or includes unrelated risky work that should not be bundled.

When blocked, stop and explain the exact reason plus the command or decision needed.

## Commit Workflow

1. Summarize the changed areas from diff and changelog.
2. Choose verification mode and explain it briefly.
3. Run verification according to the mode:
   - `smart`: choose the smallest checks that cover the touched areas.
   - `fast`: run safety checks and minimal validation only.
   - `full`: run broad repo/package checks.
4. Stage the intended files explicitly. Use `git add <files>` instead of broad staging when there are suspicious or unrelated files.
5. Re-check `git diff --cached --stat` and `git diff --cached --name-only`.
6. Create the commit with `git commit -m "<subject>"` and optional extra `-m "<body>"` paragraphs.
7. After commit, run `git status --short` and `git log -1 --oneline`.

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
- Front-end only: relevant web typecheck/lint; build only if route/config/build surface changed.
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
- For code changes, run only the most focused typecheck/validation for the touched package.
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

- Commit hash and message.
- Main files included.
- Verification mode.
- Checks run or skipped.
- Remaining uncommitted files, if any.

Do not push unless the user explicitly asks.
Do not amend, rebase, reset, or squash unless explicitly asked.

## Changelog Style

During `/commit`, add or adjust changelog for the commit being created:

- Add one short, coherent entry per commit: `- YYYY-MM-DD: <short paragraph summarizing the commit's main changes>`.
- Do not split one commit into multiple changelog bullets by feature unless the owner explicitly asks.
- Do not add `Summary`, `Changed`, `Files`, `Tests`, or `Notes` sections.
- Keep checks, skipped checks, file lists, and risk notes in the final response or the relevant docs instead of the changelog.
