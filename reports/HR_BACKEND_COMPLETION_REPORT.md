# HR Backend — Completion Report

|                         |                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository / branch** | `Texawave_Erp_Production`, `feature/HR` @ `73bbb16` (= `main`). **Nothing committed, pushed or merged.**                                                                                                                                                       |
| **Date**                | 2026-09-30                                                                                                                                                                                                                                                     |
| **Scope delivered**     | Audit platform · HR master data · employees (+ lifecycle, user mapping, self-service profile) · shifts & assignments · holiday / weekly-off calendar · leave types & requests (approve/reject) · permissions catalogue & dev roles · migrations · tests · docs |
| **Not started**         | Attendance · any UI. Both wait for your approval.                                                                                                                                                                                                              |
| **Old ERP**             | `TexaWave_ERP` was only read; `git status` there shows only the `reports/` folder that was already untracked.                                                                                                                                                  |
| **API contract**        | `Docs/HR_API.md` (every route, permission, rule, error code)                                                                                                                                                                                                   |

---

## 0. Read this first — one incident I caused

While verifying the new e2e safety guard I ran an e2e spec with the default environment, and **it ran against your shared development database**. The guard's first version treated `NODE_ENV=test` as "we are in CI", but Vitest sets `NODE_ENV=test` on every machine, so it let the run through.

**What it left in dev Postgres** (inventoried, nothing else touched; your real org/user/permissions and Redis DB 0 were unaffected — Redis holds only your own `refresh:1:…` tokens):

|               |                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------- |
| organizations | `audit-a-2e4f9c7f` (id 2), `audit-b-2e4f9c7f` (id 3) — empty                                    |
| users         | ids 2–5 (`writerA@audit-a-2e4f9c7f.test`, `readerA@…`, `nobodyA@…`, `writerB@audit-b-…`)        |
| `audit_logs`  | 7 rows for those orgs                                                                           |
| `permissions` | `testaudit.probe.write` (id 30) — `permissions:sync` reports it as an unknown row and leaves it |

**Why I did not clean it up:** the 7 audit rows are append-only by design; removing them means disabling the immutability trigger on your shared DB, which I will not do without your say-so. It is harmless data. To remove it yourself (or tell me to):

```sql
BEGIN;
SET LOCAL session_replication_role = replica;   -- bypasses the append-only triggers for this transaction only
DELETE FROM audit_logs   WHERE organization_id IN (2,3);
DELETE FROM users        WHERE organization_id IN (2,3);
DELETE FROM organizations WHERE id IN (2,3);
DELETE FROM permissions  WHERE code = 'testaudit.probe.write';
COMMIT;
```

**Fixed and proven:** the exemption now keys off `CI=true` (GitHub Actions sets it; Vitest does not). Verified by running the suite with the default env: all specs are refused before any connection, and dev row counts were identical before and after (`orgs=3 users=5 audit=7 perms=30`). A regression test pins "`NODE_ENV=test` is not an exemption". See `apps/api/test/README.md`.

Every other e2e run in this work used a disposable database (`texawave_erp_test`) and Redis DB 5, both created by me; that database has since been dropped/rebuilt several times.

---

## 1. Verification actually executed (all on this branch, this session)

| Check                                    | Command / how                                          | Result                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Migration chain on an empty DB           | recreated `texawave_erp_test`, `prisma migrate deploy` | **11/11 applied**; `migrate status`: up to date                                                                            |
| CI drift check                           | exact `prisma migrate diff … --exit-code`              | **"No difference detected", exit 0**                                                                                       |
| CI pipeline                              | `turbo run lint typecheck test build --concurrency=2`  | **20/20 tasks successful**, exit 0                                                                                         |
| API unit tests                           | `vitest run` (via turbo)                               | **325 pass** (23 files)                                                                                                    |
| Database package tests                   | `tsx --test`                                           | **38 pass** without a DB; **42 pass** with `TEST_DATABASE_URL` (4 real-Postgres tests)                                     |
| API e2e (all suites, empty DB + Redis 5) | `pnpm test:e2e`                                        | **538 pass, 10 files, 0 skipped**                                                                                          |
| Guard                                    | default env / dev DB name / disposable env / `CI=true` | refused / refused / runs / runs                                                                                            |
| Dev DB                                   | `migrate status` → `migrate deploy`                    | 9 were already applied (by your dev startup, ~15:57); I applied the 2 pending (calendar, leave) additively; now up to date |
| Permission sync on dev                   | `permissions:sync:dry` then apply                      | +14 permissions (43 in catalogue); 1 stray test row reported, untouched                                                    |

e2e per suite: master-data 159 (designations, employment types, work locations, **leave types**) · employees 113 · shifts 74 · calendar 73 · leave 58 · audit 24 · team-scope 21 · pre-existing 16 (all still pass).

**Tests proven to bite** (deliberately broke the thing, watched them fail, restored): team scope (`teamWhere`), audit-in-transaction (master data), naive "count + 1" employee codes (only the concurrency test failed), the shift-overlap exclusion constraint (6 tests failed). Two of my own tests exposed **real bugs** rather than test errors — see §6.

---

## 2. What was built, by phase

Files: **96 new source files, 20 new unit specs, 11 new e2e files, 7 migrations, ~16k lines** (`git status` lists them all). Modified shared files are listed in §4.

| Phase              | Delivered                                                                                                                                                                                                                        | Migration                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 0 (earlier)        | drift fix · commit scopes · `@RequireScopedPermission` + team-scope proof · permission catalogue + non-destructive sync · audit design                                                                                           | `drop_updated_at_defaults`              |
| Audit platform     | `AuditWriter` (transaction client only; actor/org/IP from the JWT context), redaction, `GET /audit/logs`                                                                                                                         | `add_audit_logs` (append-only triggers) |
| 1 Master data      | designations, employment types (Permanent/Contract/Temporary/Intern seeded, probation/notice stored but unenforced), work locations — generated from one reviewed template; audited; deactivate/activate                         | `add_hr_master_data`                    |
| 2 Employees        | create/list/search/filter/sort/paginate, detail, update (optimistic `version`), lifecycle (4 statuses, terminal exits, audited **correction**), user link/unlink (1:1), `EMP-000001` codes, status history, self-service profile | `add_hr_employees`                      |
| 3 Shifts           | shift master (overnight derived), assignments to employee or team, end/void, overlap prevention by exclusion constraint, `resolve`                                                                                               | `add_hr_shifts`                         |
| 4 Calendar         | holidays (org or location), weekly-off rules (org/location/team, effective-dated, nothing assumed), day lookup                                                                                                                   | `add_hr_calendar`                       |
| 5 Leave            | leave types, self-service submission, HR list/history, approve/reject, maker-checker, final decisions                                                                                                                            | `add_hr_leave`                          |
| 6 Security & audit | scoped permissions everywhere, dev roles (Team Lead read-only — pinned by a test), seed, e2e guard, docs                                                                                                                         | –                                       |

**66 HTTP routes** (plus the 2 platform routes already there). Permissions: **43 codes** in the version-controlled catalogue.

### Security properties, each with a test

- Every route requires a JWT and a permission; 401/403 paths tested per suite.
- Organization isolation: every suite has a second organization attempting read/update/decide/end/void — all 404.
- Team scope: a team lead cannot read, list, filter into, resolve, or decide another team's employees/assignments/leave; `.own` sees only itself; revocation (`isActive`) takes effect on the very next request.
- **Identity is never client-supplied:** self-service takes no employee id; audit actor comes from the JWT; a forged `employeeId/organizationId/status/employeeCode/actorUserId` is rejected (400) or ignored.
- **Maker-checker:** an approver holding `hr.leave.approve.all` cannot decide their own leave; the refusal leaves no trace.
- **No credentials on employees** (asserted against `information_schema`); passwords/tokens never reach audit rows (deny-list + tests); the phone is masked; exit reasons and leave reason text are not copied into the audit trail.
- A leaver's login is disabled in the same transaction as the exit and their refresh tokens revoked.
- Database invariants hold **independently of the API** (CHECKs, partial unique indexes, exclusion constraints, triggers) and are asserted with raw Prisma calls.

---

## 3. HR completion gate (your brief §8)

| #   | Criterion                                             | Status                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HR schema and migrations complete                     | ✅ 6 HR migrations + the drift fix; empty-DB deploy verified                                                                                                                                                              |
| 2   | All HR services and APIs implemented                  | ✅ for the approved scope (§5 lists what is deliberately absent)                                                                                                                                                          |
| 3   | Permissions deployable to all environments            | ⚠ **mechanism done** (`permissions:sync`, additive, tested incl. real Postgres). `deployment/` holds only placeholders, so **the pipeline step must still be added by whoever owns deploys** (run after `migrate deploy`) |
| 4   | Authentication and organization isolation tested      | ✅                                                                                                                                                                                                                        |
| 5   | HR unit, integration, e2e tests pass                  | ✅ numbers in §1. Note: DTO validation is proven through the e2e 400 tables and `date-only`/shift-time unit specs; there are no standalone DTO unit specs                                                                 |
| 6   | Existing platform tests continue to pass              | ✅ the 16 pre-existing e2e and all pre-existing unit tests                                                                                                                                                                |
| 7   | Prisma migration drift resolved                       | ✅                                                                                                                                                                                                                        |
| 8   | API contracts and dependencies documented             | ✅ `Docs/HR_API.md`; `ARCHITECTURE.md` changelog + two doc/code fixes; `CODING_STANDARDS`/`HOW_TO_ADD_A_MODULE` updated                                                                                                   |
| 9   | No unresolved **blocking** HR decisions               | ✅ nothing blocks the delivered scope — but **§5 lists assumptions that need your confirmation**; I did not treat them as approved                                                                                        |
| 10  | Completion report with actual results and limitations | ✅ this document                                                                                                                                                                                                          |

---

## 4. Shared code changed (needs the reviewer sign-off `CLAUDE.md` requires)

| Change                                                                                                                                                                 | Where                                                          | Why                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TeamScope` now carries `organizationId`; `teamWhere` always AND-s it, intersects (not overwrites) caller filters, supports dotted field paths                         | `common/tenancy/*`, `platform/tenancy/team-context.service.ts` | team-scoped queries tenant-safe by construction; found while proving team scope                                                        |
| `@RequireScopedPermission` (any of `.own/.team/.all`); `PermissionsGuard`                                                                                              | `common/decorators`, `platform/roles-permissions`              | the exact-match guard could not express a scoped route                                                                                 |
| `TeamContextService`: only active memberships of active teams in the caller's org; 403 (not 500) when no variant is held                                               | same                                                           | a revoked lead kept access                                                                                                             |
| `TenancyInterceptor` stores `request.ip` in CLS                                                                                                                        | `platform/tenancy/tenancy.interceptor.ts`                      | audit rows record IP (behind a proxy this is only right once `trust proxy` is set)                                                     |
| New exceptions `BusinessRuleViolation`, `InvalidStateTransition`, `VersionConflict`, `BusinessRuleConflict`; `db-errors.ts`; `dates/date-only.ts`; `dto/transforms.ts` | `common/*`                                                     | shared plumbing                                                                                                                        |
| e2e guard + `setupFiles`                                                                                                                                               | `apps/api/vitest.config.e2e.ts`, `test/support/*`              | stop tests reaching a shared DB. **Behaviour change for everyone:** `test:e2e` now needs a disposable DB + Redis index (CI unaffected) |
| Commit scopes `hr, employees, attendance`                                                                                                                              | `commitlint.config.js`                                         | Phase 0                                                                                                                                |
| 7 migrations; `btree_gist` extension                                                                                                                                   | `packages/database/prisma/migrations`                          | **each environment's DB must allow `CREATE EXTENSION btree_gist`** (trusted since PG13; confirm on any managed service)                |

Files that are **not mine** and untouched: `apps/api/package.json` (`dev` script), `apps/ui/package.json` (`-p 3001`), `apps/api/README.md` (local run notes).

---

## 5. Decisions — what I assumed, what stays open

**Applied as approved by you:** four employment types; four statuses with terminal RESIGNED/TERMINATED; `EMP-000001` per organization; Team Lead read-only; activation deferred; audit design A-1…A-6 as recommended (separate before/after, transactional writes, fail-closed, organization-wide read, append-only exception, HR-owned status history).

**⚠ Assumptions I made that you should confirm (each is small to change):**

1. **Exit disables the linked login** (RESIGNED/TERMINATED; correction back to ACTIVE re-enables it). Not in the brief; a security-driven choice.
2. **Status correction workflow exists** (own permission `hr.employee_status.correct`, mandatory reason, granted to no default role): RESIGNED⇄TERMINATED and exit → ACTIVE. You said "if required".
3. **Overlapping leave** (PENDING/APPROVED) is refused; **rejecting requires a note**; approving does not; requester must be ACTIVE; whole days only; past-dated requests are allowed.
4. **Shift-assignment precedence**: employee-specific beats team default; team = the employee's _current_ team (no team history).
5. **Weekly-off precedence across scopes (org/location/team) is deliberately not decided** — the day lookup returns all applicable rules and no verdict.
6. **Location master** (`work_locations`) was added (minimal) because the brief mentions location scope; the old ERP has none.
7. `user_team_access` is **not** synced from an employee's team (an employee's team never grants team-lead access by itself).
8. **Optimistic `version`** on employee updates (was an open question D-10).
9. `timestamptz` for new tables; business dates as `DATE`; shift times as `"HH:MM"` text with CHECKs (no time zone — the business time zone is an Attendance decision). "Today" in the shift-deactivation rule is the UTC date.

**Still open, not built (need your business input — from the readiness report):** probation/notice rules (columns exist, nothing reads them) · who approves leave (team lead vs HR; `hr.leave.approve.team` is granted to no role) · leave balances/accrual/half-days/cancellation · shift break/grace/half-day/overtime thresholds · weekly-off precedence · sensitive PII (PAN/Aadhaar/bank) table · employee activation/password setup · old-ERP data import.

---

## 6. Bugs found and fixed while building (worth knowing)

- `@RequirePermission("hr.employee.read.team")` — the docs' own example — would have **locked HR (`.all`) out**; now `@RequireScopedPermission`.
- Team-scope: deactivated memberships still granted access; `teamWhere` silently replaced a caller's `teamId` filter; no-scope caller got a 500.
- **`db-errors.ts` silently missed every real Prisma constraint error**: Prisma embeds the Postgres message with escaped quotes (`\"name\"`), my regex expected plain quotes, and my unit test assumed the same. The e2e overlap test caught it (500 instead of 409). Fixed and re-pinned with a captured real message.
- Audit redaction let `apiKey` through (words `api`,`key`) — caught by its own unit test.
- The e2e guard bug in §0.

---

## 7. Known limitations and risks

- **Merge with the teammate's branch** (`origin/feat/hr-employee-attendance-backend`) is not done: it adds users CRUD, a departments API, password reset, menu, and two migrations. Expect migration-history reconciliation (its `add_menu_items` already contains the same three `DROP DEFAULT`s — harmless duplicates) and a check that its permission hook understands scoped permissions. No departments API is built here to avoid a clash.
- An already-issued **access token** (15 min) is not re-checked against `users.is_active`: an exit blocks new logins and kills refresh tokens at once, but a live access token survives its TTL (pre-existing platform behaviour).
- Audit immutability defeats application bugs, **not a database superuser** (who can drop the trigger). Audit uses offset pagination — fine now, will need keyset paging at volume.
- Employee-code creation **serializes per organization** on the counter row (correct and gap-free, but a throughput ceiling for bulk imports).
- A reporting-line cycle race between two simultaneous transactions is narrowed (service check + trigger) but not impossible.
- `@Paginate` ignores unknown **query** parameters (body fields are strict) — pre-existing.
- `prisma generate` cannot replace the engine DLL while a dev API is running on Windows (the JS client still updates; I did not stop your servers).
- Test data policy: audit and status history are append-only, so e2e organizations can never be deleted — hence the disposable-DB requirement.
- `@nestjs/event-emitter` was not added (HR needs only synchronous transactional coordination); `CODING_STANDARDS.md` §11 calls EventEmitter2 the default for _async_ side effects, so Attendance may want it.

---

## 8. Suggested commit split (when you approve — I will not commit without a go-ahead)

Scopes must come from the frozen enum (`hr`, `employees`, `database`, `platform`, `api`, `docs`, `config`):

1. `fix(database): drop stale updated_at defaults`
2. `chore(config): add hr, employees, attendance commit scopes`
3. `feat(platform): scoped permission guard and team-scope proof`
4. `feat(database): permission catalogue and non-destructive sync`
5. `feat(platform): audit platform (append-only audit_logs)`
6. `feat(hr): master data (designations, employment types, work locations)`
7. `feat(employees): employees, lifecycle, user mapping, self-service profile`
8. `feat(hr): shifts and shift assignments` · 9. `feat(hr): holiday and weekly-off calendar` · 10. `feat(hr): leave types and requests`
9. `test(api): e2e safety guard` · 12. `docs: HR API, architecture and standards updates`

Several files (`schema.prisma`, `catalog.ts`, `app.module.ts`, `CODING_STANDARDS.md`) contain hunks from more than one item, so splitting needs `git add -p`. `CLAUDE.md` says one module per PR — this branch bundles the whole HR backend; splitting into stacked PRs along the list above is recommended for review.

## 9. Next

**Waiting for you.** Please decide: (a) the dev-DB cleanup in §0; (b) the ⚠ assumptions in §5; (c) whether to split into stacked PRs / prepare commits; (d) approval to start **Attendance** (blueprint and old-ERP audit already read; the HR contracts Attendance needs are `EmployeeQueryService`, `ShiftQueryService`, `CalendarQueryService`, leave approvals and `AuditWriter`). No UI will be started until both backends are approved.
