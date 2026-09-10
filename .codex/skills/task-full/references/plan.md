# Task Full Plan Mode

Read this file only for `/task-full plan ...`.

## Plan boundary

- Planning is read-only: do not edit files, run migrations, install packages,
  start implementation, update changelog, stage, or commit.
- Inspect only enough code, call sites, test entrypoints, and contract sections to
  identify ownership, dependencies, implementation steps, risks, and credible
  checks. Do not read implementation-only detail that cannot change the plan.
- If required product authority or a dependency is missing, state the blocker
  instead of inventing behavior.

## Output

Provide an approval-gated plan containing:

- subtask ID, exact `Mode`, goal, scope exclusions, dependencies;
- contract sections and code entrypoints inspected;
- files/modules/layers likely to change and reuse decisions;
- ordered implementation steps;
- expected database/API/AI/UI/env/docs impact;
- verification commands, risks, blockers, and assumptions.

Keep the plan concise enough to act as the implementation context packet. Record
the inspected paths/sections and current git condition so a later `/do` can perform
delta revalidation instead of repeating startup discovery. Stop and wait for
explicit owner approval.
