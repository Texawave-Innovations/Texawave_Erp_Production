# HR backend — validated scratch commit stack (nothing pushed, merged, or committed on a real branch)

**Where it lives:** local branch `scratch/hr-stack` (13 commits on `73bbb16`), checked out in a separate git worktree
`C:\Users\DHANUSH\hrwt`. Your `feature/HR` branch and working tree are **byte-identical to before** (status and diff hashes
compared). `TexaWave_ERP` untouched. Exact per-commit file lists: `reports/hr-commit-plan-files.txt` (generated from git).
**Excluded, untouched:** `apps/api/README.md`, `apps/api/package.json`, `apps/ui/package.json` (your own edits).

Every commit went through the repo's own hooks (lint-staged → `eslint --fix` + `prettier --write`; commitlint) — **no `--no-verify`**.

## The stack (guard moved to position 3 as requested)

| #   | Commit                                                                         | Files |
| --- | ------------------------------------------------------------------------------ | ----- |
| 1   | `fix(database): drop stale updated_at defaults`                                | 1     |
| 2   | `chore(config): add hr, employees, attendance commit scopes`                   | 2     |
| 3   | `test(api): refuse e2e runs against a shared database or Redis`                | 6     |
| 4   | `feat(platform): scoped permission guard and team-scope proof`                 | 14    |
| 5   | `feat(database): permission catalogue and non-destructive sync`                | 13    |
| 6   | `feat(platform): audit platform with append-only audit_logs`                   | 15    |
| 7   | `feat(hr): master data for designations, employment types and work locations`  | 34    |
| 8   | `feat(employees): employees, lifecycle, user mapping and self-service profile` | 33    |
| 9   | `feat(hr): shifts and shift assignments`                                       | 24    |
| 10  | `feat(hr): holiday and weekly-off calendar`                                    | 19    |
| 11  | `feat(hr): leave types and leave requests`                                     | 24    |
| 12  | `docs(docs): add hr api contract, architecture updates and technical reports`  | 6     |
| 13  | `fix(api): run e2e spec files serially` _(new — see Finding 3)_                | 1     |

168 distinct files. Commit 12 adds exactly these four technical reports, **in place, under `reports/`, nothing moved**:
`reports/HR_MODULE_REPOSITORY_ANALYSIS.md`, `reports/AUDIT_PLATFORM_DESIGN.md`, `reports/HR_IMPLEMENTATION_READINESS.md`,
`reports/HR_BACKEND_COMPLETION_REPORT.md`. Not committed: `HR_COMMIT_PLAN.md`, `DEV_DB_TEST_DATA_IMPACT_REPORT.md`,
`dev-db-test-data-cleanup.sql`, `hr-commit-plan-files.txt` (working documents).

## Validation per commit (each on an EMPTY database + Redis DB 5, run in the worktree after the commit)

Steps: `prisma validate` · `migrate deploy` (all migrations so far) · CI drift command · `prisma generate` + database build ·
typecheck + lint (database, api) · api unit tests · database tests (from #5, with real Postgres) · `permissions:check` (from #5) · api e2e.

| #   | Steps passed   | api unit           | e2e                  | Result                                                                                                                                                         |
| --- | -------------- | ------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2 | 11/11          | 8                  | 16                   | ✅                                                                                                                                                             |
| 3   | 11/11          | 26                 | 16                   | ✅                                                                                                                                                             |
| 4   | 11/11          | 99                 | 37                   | ✅                                                                                                                                                             |
| 5   | 13/13          | 99                 | 37                   | ✅ (+33 database tests)                                                                                                                                        |
| 6   | 13/13          | 145                | 61                   | ✅                                                                                                                                                             |
| 7   | 13/13          | 189                | 182                  | ✅                                                                                                                                                             |
| 8   | 13/13          | 270                | 295                  | ✅                                                                                                                                                             |
| 9   | 13/13          | 317                | 369                  | ✅                                                                                                                                                             |
| 10  | 13/13          | 317                | 442                  | ✅                                                                                                                                                             |
| 11  | 13/13 (re-run) | 325                | 538                  | ✅ — first run had a **transient** e2e failure (`Hook timed out in 10000ms` in 6 files at once, machine load); identical re-run passed all                     |
| 12  | 12/13          | 325                | 514 + **24 skipped** | ⚠ one e2e file failed on a **race** (Finding 3) — docs-only commit, content irrelevant                                                                         |
| 13  | 12/13          | 324 + **1 failed** | 538                  | ⚠ the 1 unit failure is the pre-existing `app.controller.spec.ts` 10 s boot timeout under load; **re-run 3×: 325/325 each**; serial e2e passed 538 three times |

The tip also reproduced the earlier full result: unit 325, database 42, e2e 538.

## Findings (conflicts, dependencies, tests that could not pass on an individual commit)

1. **Commit-order dependency (real, fixed in the plan):** `db-errors.spec.ts` (master data, commit 7) uses `BusinessRuleViolationException`, which my first plan put in the employees commit. Commit 7 failed lint on its own. The three shared exception classes (`BusinessRuleViolation`, `InvalidStateTransition`, `VersionConflict`) now ship in commit 7; `BusinessRuleConflict` stays with shifts (9).
2. **Hook findings:** commitlint rejected my first commit-12 message (scope required, subject must not start upper-case) → renamed. ESLint failed commit 6 once because the Prisma client was stale for the new schema — a process artifact; the builder now regenerates the client before each commit, as a developer would.
3. **Real race in my e2e suites (fixed in commit 13):** specs run in parallel workers and several `upsert` the same global permission code (`audit.log.read`); they intermittently collided on the unique constraint (1 in ~14 runs, 24 tests skipped when it hit). Fix: `fileParallelism: false` (+ corrected a stale "NODE_ENV=test is exempt" comment). **Your working tree has the same two issues** (unfixed — I did not touch it); fold #13 into #3 when approved.
4. **Migration dependencies (all satisfied in order):** employees/leave migrations call `prevent_row_mutation()` from the audit migration (#6); shifts/calendar/leave need `btree_gist` (shifts migration, #9) and FK to employees (#8) and work_locations/teams (#7). No commit applies a migration whose dependency comes later.
5. **No individual commit fails typecheck, lint, drift, or migrate-deploy.** Commits 1–11 pass every step; the only red steps are the two flakes above (12: race, 13: load timeout), both investigated and re-run.
6. **Tests that cannot pass on an individual commit:** none by design. Before #3 (the guard) e2e needs no special env; from #3 on every e2e run requires the disposable DB/Redis index (the guard refuses otherwise) — that is the intended behaviour.
7. **Formatting drift:** because hooks run prettier, the committed files differ from your working tree in line-wrapping only (88 files formatting-only; the other 17 are markdown/TS wrapping, plus the intended #13 change). Verified by content comparison; no behavioural difference.
8. **Environment events (not code):** Docker Desktop stopped twice during this work and I restarted it (containers/data came back intact: dev DB `orgs=3 users=5 audit=7`, 11 migrations). Your dev DB was never used by the validation (`hrwt_test` / `hrwt_shadow`, dropped afterwards).

## What happens next — nothing, until you say so

- The scratch branch + worktree stay for your review (`git log scratch/hr-stack`, `git diff 73bbb16 scratch/hr-stack`). To discard: `git worktree remove C:\Users\DHANUSH\hrwt --force && git branch -D scratch/hr-stack`.
- Not done: no push/merge; no real-branch commits; no cleanup SQL executed; Attendance and UI not started.
