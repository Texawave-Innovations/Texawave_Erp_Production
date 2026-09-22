# TexaWave ERP — Instructions for Claude / any contributor

**Adding a new module?** Start with [`Docs/HOW_TO_ADD_A_MODULE.md`](Docs/HOW_TO_ADD_A_MODULE.md)
— the concrete backend/frontend file-by-file walkthrough, before/after `@OrgScoped()`/
`@TeamScoped()`/`@RequirePermission()` usage, and the pre-PR checklist.

**Owner:** repository maintainers — assign a named owner/team before business-module work begins.
**Last verified:** 2026-09-18.
**Status:** This file is the entry point. The three canonical documents it links to are the source of truth for everything else — if this file and one of them ever disagree, the canonical doc wins and this file has a bug; fix this file, don't silently follow it.

## Read before you edit

1. [`Docs/ARCHITECTURE.md`](Docs/ARCHITECTURE.md) — system/package ownership, dependency direction, data model, tenancy/RBAC.
2. [`Docs/CODING_STANDARDS.md`](Docs/CODING_STANDARDS.md) — folder structure, naming, backend/frontend patterns, `@OrgScoped()`, error handling, PR checklist.
3. [`Docs/DESIGN_SYSTEM.md`](Docs/DESIGN_SYSTEM.md) — tokens, component contracts, interaction states.

Each has one job; don't duplicate a rule from one into another or into this file — link to it instead.

## Before writing any code

- **Inspect existing patterns first.** Look at the reference feature (`apps/api/src/modules/_reference/tags/`, `apps/ui/src/features/_reference/tags/` — see `Docs/CODING_STANDARDS.md` §16 for what it demonstrates) and the nearest existing module before inventing a new shape.
- **Reuse, don't reimplement:** the API client and query setup in `packages/core/src/api/`, the ui-kit primitives in `packages/ui-kit/src/components/`, the tenancy/response/exception plumbing in `apps/api/src/common/` and `apps/api/src/shared/`. If what you need isn't there, that's a signal to add it in the shared location, not to build a local one-off.
- **Stay in scope.** Do exactly what was asked. Don't refactor unrelated code, rename working things, or "clean up while you're in there" — flag it instead and let the requester decide.
- **Preserve unrelated and uncommitted work.** Never `git reset`/`checkout -- .`/`clean`/force-push without being explicitly told to. Run `git status` before anything destructive.
- **Respect the dependency direction** (`Docs/ARCHITECTURE.md` folder-ownership table): `apps/*` may depend on `packages/*`, never the reverse; `apps/ui` never imports `packages/database` or anything Prisma-flavored; a module's `*.repository.ts` is never imported outside that module; controllers never call Prisma directly. These are enforced by ESLint import-boundary rules (`packages/config/eslint.config.js`) — a failure there means the boundary was actually crossed, not that the rule is wrong.
- **If two instructions conflict** — a doc says one thing, the code does another, or a request contradicts a canonical doc — say so and ask or propose a resolution. Don't silently pick one.

## Non-negotiables

- Never weaken lint rules, TypeScript strictness, tests, or CI just to make a check pass. If a rule is genuinely wrong for a real case, that's a documented exception (see `Docs/CODING_STANDARDS.md` §15) with a comment explaining why, reviewed like any other standards change — not a blanket disable.
- Never claim a test suite, lint run, or build passed without actually having run it in this session. Paste the command and outcome.
- Update the relevant canonical doc in the same change when you introduce or change a convention — a new pattern without a doc update is half-done.
- Never scope HR data by `@OrgScoped()` alone — use `@TeamScoped()` (Docs/CODING_STANDARDS.md §10a). `@OrgScoped()` is a formality in this single-org app; `@TeamScoped()` is the actual boundary between Software/Mechanical/Electrical.
- Never use `uuid()`/`String` for a new table's `id` — `Int @id @default(autoincrement())`, `BigInt` only for `audit_logs`/`status_history` (Docs/ARCHITECTURE.md §5.1).
- Sales/Purchases/Finance/Inventory/Vault/Projects are paused, not removed — don't delete their folders or tables while doing HR work.

## Working on this repo for the first time

If this is your first PR here (this section is for you, Afzal/Ganesh):

- **One module per PR.** Don't bundle a second module, an unrelated refactor, or a drive-by fix
  into the same PR — a reviewer should be able to tell what a PR does from its title alone. If
  you find a real bug in something else while working, open a separate PR for it.
- **An e2e test is required before you request review, not something you add after review
  comments ask for it.** Backend: `apps/api/test/<name>.e2e-spec.ts` for anything touching
  auth/tenancy/permissions/data access. Frontend: `apps/ui/e2e/<name>.spec.ts` for any new
  authenticated UI flow. See the checklist at the bottom of
  [`Docs/HOW_TO_ADD_A_MODULE.md`](Docs/HOW_TO_ADD_A_MODULE.md) for the full pre-PR list.
- **No `prisma db push`, ever.** It writes schema changes straight to the database with no
  migration file, so there's nothing to commit, nothing for CI's migration-drift check to see,
  and nothing for a reviewer to read. Always `pnpm --filter database exec prisma migrate dev`,
  and always commit the migration file it generates under
  `packages/database/prisma/migrations/`.
- **Branch naming.** This repo's commitlint config (`commitlint.config.js`) enforces a fixed
  commit **type** enum (`feat`/`fix`/`chore`/`docs`/`refactor`/`test`) and, as of this section, a
  fixed commit **scope** enum too (`Docs/CODING_STANDARDS.md` §2 has the full list) — lower-case
  only, no made-up scopes. Branch names follow the same `<type>/<ticket-or-slug>` convention
  (e.g. `feat/password-reset-flow`, `fix/leave-approval-scope-bug`) — match your PR's commit
  type, and use a short kebab-case slug describing the change if you don't have a ticket number
  yet. Your commit scope doesn't have to literally appear in the branch name, but it does have
  to be one of the enum values — check `Docs/CODING_STANDARDS.md` §2 before you pick one, and if
  none of them fit, that's a signal to raise it, not to invent one and let commitlint reject it.

## Commands

```bash
pnpm install --frozen-lockfile              # fresh checkout
pnpm exec turbo run lint typecheck test build   # what CI runs
pnpm --filter api test:e2e                  # backend e2e (needs postgres+redis running — see Docs/ARCHITECTURE.md §9)
pnpm --filter ui test:e2e                   # browser e2e, Playwright (needs `pnpm --filter ui exec playwright install` once, plus api+ui both running against a seeded db)
pnpm --filter database exec prisma migrate dev   # apply/create a migration (needs docker-compose postgres running)
pnpm scaffold:module <kebab-case-name>      # generate a new module's skeleton from the reference pattern — see Docs/CODING_STANDARDS.md §16
```

A root `turbo` command succeeding does not by itself prove every workspace ran something real — check that the workspace you touched actually has the script and that it did meaningful work, not just that turbo reported green (see `Docs/CODING_STANDARDS.md` §1 for which workspaces currently have real lint/typecheck/test/build scripts vs. framework defaults).

## What needs review before merge (not necessarily permission before starting)

Ordinary feature work inside an existing module/feature folder, following the established patterns, does not need a design discussion first — just build it and put it up for review like normal. The following need a **reviewer's sign-off before merge**, because they change something every other module depends on:

- New dependencies (root or any workspace `package.json`).
- Changes to shared architecture or package boundaries (`packages/core`, `packages/api-types`, `packages/ui-kit`, `packages/database`, `packages/config`, `apps/api/src/common`, `apps/api/src/shared`).
- Auth/tenancy changes (`apps/api/src/platform/auth`, `apps/api/src/platform/tenancy`, anything touching `@OrgScoped()` or `TenantContextService`).
- Shared UI-kit component contracts or design-token changes (`packages/ui-kit/src/theme.css`, any file under `packages/ui-kit/src/components/`).
- Anything that weakens enforcement (ESLint rules, `tsconfig.base.json` strictness, CI job removal, disabling a test).
- Database migrations (`packages/database/prisma/migrations/`).

The following need **explicit permission before you start**, not just review after: destructive git operations, pushing to shared branches, sending anything to an external system, deleting an artifact/branch/table, and repository-setting changes (branch protection, required checks — see `Docs/CODING_STANDARDS.md` §17, these must be configured in GitHub's settings UI/API, not from this repo's files).

## When you finish a task, report

- Which files changed.
- Exact commands run and their actual outcome (pass/fail, not "should pass").
- Anything left incomplete or blocked, and why.
