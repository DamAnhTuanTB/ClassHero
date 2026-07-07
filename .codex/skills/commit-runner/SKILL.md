---
name: commit-runner
description: Create a git commit for the Vietnamese learning-path project when the user types "/commit", "commit giúp tôi", or asks Codex to commit current changes. Use when Codex must inspect the worktree, verify changelog requirements from AGENTS.md, avoid committing secrets or unrelated unsafe files, stage the intended project changes, write a short conventional commit message that still covers the main points, run lightweight checks when practical, execute git commit, and report the commit hash and included files.
---

# Commit Runner

Use this skill to turn the current repo changes into a clean git commit without making product changes.

## Command Parsing

Accept these forms:

- `/commit`
- `/commit <optional hint>`
- `commit giúp tôi`
- `commit các thay đổi hiện tại`

If the user provides a hint, use it only as guidance. The diff and changelog remain the source of truth for the commit message.

## Required Startup

Before committing:

1. Locate repo root containing `AGENTS.md`.
2. Read `AGENTS.md`, especially changelog and commit rules.
3. Run `git status --short`.
4. Inspect `git diff --stat`, `git diff --name-only`, staged diff if any, and file-level diffs needed to understand the change.
5. Check whether `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` includes the current commit-worthy changes. If missing, add a concise entry before staging.
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
2. Run lightweight verification when practical:
   - docs/skill-only: validate the skill or skip with reason.
   - code changes: prefer relevant `typecheck`, `lint`, `build`, or focused tests if they are reasonably available.
3. Stage the intended files explicitly. Use `git add <files>` instead of broad staging when there are suspicious or unrelated files.
4. Re-check `git diff --cached --stat` and `git diff --cached --name-only`.
5. Create the commit with `git commit -m "<subject>"` and optional extra `-m "<body>"` paragraphs.
6. After commit, run `git status --short` and `git log -1 --oneline`.

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

## Final Response

After committing, report briefly:

- Commit hash and message.
- Main files included.
- Checks run or skipped.
- Remaining uncommitted files, if any.

Do not push unless the user explicitly asks.
Do not amend, rebase, reset, or squash unless explicitly asked.

## Changelog Style

When `/commit` needs to add or adjust changelog before committing, keep it compact:

- One entry per coherent commit.
- `Changed` has 1-2 key points, not a diff recap.
- `Files` may group related paths.
- `Notes` appears only for migration/env/TODO/ASSUMPTION/risk.
