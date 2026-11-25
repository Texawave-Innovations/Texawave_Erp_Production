# HR Audit — Group A Verification Report (2026-11-19)

Companion to [HR_MODULE_AUDIT.md](HR_MODULE_AUDIT.md). **No code was changed in this pass.**

**Method.** Three independent agents re-checked every Group A claim adversarially (controller → DTO → service → repository
→ Prisma/migrations → UI caller → permissions → tests/docs). The lead re-read the evidence for LV-6, XM-2, TSK-1, PAY-8,
EMP-8 and EMP-20 directly. The only code that was _executed_ is two throwaway Node scripts for ATT-5/ATT-7 under
`TZ=UTC`, `Asia/Kolkata`, `America/New_York`. **No unit/e2e/lint/build was run in this pass**, and no database-backed
test exists for any item below. Everything else is code reading: "Confirmed" = defect proven by reading the code path,
not by an executed repro.

## 1. Issue-by-issue results

| ID                       | Status                              | Severity (verified)           | One-line verdict                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EMP-8                    | **Confirmed**                       | P2                            | `getById`/`softDelete` have no `source` filter ([employee-documents.repository.ts:43-84](../apps/api/src/modules/hr/employee-documents/employee-documents.repository.ts#L43)); HR can delete ONBOARDING docs/photo and the file is physically removed. UI-only gate (`EmployeeDocumentsDetailView.tsx:111`).                                                                                                                                     |
| EMP-9                    | **Partially confirmed**             | P2/P3                         | (a) upload checks employee via `hr.employee.read` scope, not doc-write scope — config-dependent, no default role has the combo. (b) free-text `documentType` → `"PROFILE_PHOTO"` replaces avatar: **confirmed**. (c) `PUT …/documents/:type/file` is whitelisted and scoped: **not a defect**.                                                                                                                                                   |
| EMP-12                   | **Partially confirmed**             | P2 (custom roles only)        | Create accepts `userId` without `hr.employee_account.write`. Default HR Manager holds both, so no default-role exploit; a custom `employee.write` role can link any free login. Audit row is written.                                                                                                                                                                                                                                            |
| EMP-16                   | **Confirmed**                       | P2                            | No audit in departments, HR personal-data PUTs (personal/address/bank/gov-IDs/doc-file), HR document upload/delete. No global interceptor exists (`AuditInterceptor` is documented but absent).                                                                                                                                                                                                                                                  |
| EMP-17                   | **Confirmed**                       | P3                            | Avatar select lacks `deletedAt:null` in `employee-mappers.ts:17-22` **and** a duplicate in `profiles.repository.ts:82-87`. Result: broken avatar image; a deleted newer photo hides a valid older one. No leak.                                                                                                                                                                                                                                  |
| EMP-20                   | **Confirmed (update path)**         | P2                            | Rename onto a soft-deleted name → Prisma P2002 → **HTTP 500** (filter spec `all-exceptions.filter.spec.ts:196-213` asserts P2002 ⇒ opaque 500). `create` revives the row correctly.                                                                                                                                                                                                                                                              |
| DB-2                     | **Confirmed (stale artefacts)**     | P2                            | Triggers were dropped **deliberately** (commit 60f4f59, 2026-10-27, "explicit, requested reversal" to allow hard delete). Not a regression — but docs, schema comments and e2e still claim append-only.                                                                                                                                                                                                                                          |
| XM-2 / RBAC-5            | **Partially confirmed**             | P2 (race), P3 (self-decision) | Non-atomic: `update where {id, organizationId}` has no `status:"PENDING"` ([repository:134-143](../apps/api/src/modules/employee-self-service/work-permissions/my-work-permissions.repository.ts#L134)), no lock/trigger/CHECK ⇒ last writer wins. No audit rows. Self-decision only for a user holding HR Manager **and** Employee roles. UI unaffected. No tests exist.                                                                        |
| TSK-1                    | **Confirmed — policy question**     | P3                            | `assertApprovable` ([tasks.rules.ts:139-155](../apps/api/src/modules/hr/tasks/tasks.rules.ts#L139)) never compares actor to assignee. But `HR_TASK_ASSIGNMENT.md:154` records "approval rides on `hr.task.write`… PRODUCTION DECISION". Other modules (loans, bonuses, runs, corrections, timesheets) _do_ block self-approval, so this is inconsistent, not undocumented.                                                                       |
| PAY-8 / EMP-16 (payroll) | **Confirmed**                       | P2                            | `exportBatchCsv` decrypts full bank accounts and none of the 6 report routes (`pf-ecr, esi, professional-tax, tds, journal, salary-register`) audit. Payslip/Form16 PDFs also unaudited. `PAYROLL_AND_COMPLIANCE.md:64` ("logged by the AuditInterceptor") is **false**.                                                                                                                                                                         |
| LV-6                     | **Confirmed**                       | P3                            | Upsert result discarded; `entityId: existing?.id ?? 0` ([repository:1478-1498](../apps/api/src/modules/hr/leave-requests/leave-requests.repository.ts#L1478)). First-time entitlements audit against entity 0; before/after still carry employee/type/year.                                                                                                                                                                                      |
| ATT-7                    | **Confirmed (reproduced)**          | P2                            | Executed: `03:45Z` (09:15 IST) round-trips to `22:15Z` on the _previous day_ under `TZ=UTC` (−5h30); correct under IST; also wrong under New York. Only bites a non-IST browser clock. Rejected by `PUNCH_OUTSIDE_DATE` only if the shift crosses the IST date; otherwise silently stored wrong (API validator not read).                                                                                                                        |
| ATT-5                    | **Confirmed (reproduced)**          | P3                            | `toLocaleTimeString` without `timeZone`: same instant prints `03:45 AM` (UTC) vs `09:15 AM` (IST). Deployment TZ **unverified** (no TZ in deployment/docker files ⇒ probably UTC). Reusable helper: `businessTimeOf` / `BUSINESS_TIMEZONE` in `common/dates/business-date.ts`.                                                                                                                                                                   |
| ATT-9                    | **Partially confirmed**             | P3                            | Real but bounded: global `staleTime` 30 s (holidays 5 min), refetch on mount/focus. Approve-correction doesn't invalidate `hr-attendance`; punch doesn't invalidate `timesheets` (60 s poll).                                                                                                                                                                                                                                                    |
| LV-7                     | **Partially confirmed**             | P3                            | Leave-type update/active and delegation create/revoke don't invalidate `hr-leave-requests`. ≤30 s stale. `hr-master` `useLeaveTypes` uses a separate key.                                                                                                                                                                                                                                                                                        |
| XM-4                     | **Partially confirmed**             | P3 (cosmetic)                 | Ticket mutations don't invalidate `hr-dashboard` counts. Task dashboard counts not confirmed.                                                                                                                                                                                                                                                                                                                                                    |
| PORTAL-1                 | **Partially confirmed — by design** | P3                            | Orphan login (no employee row, no workspace perm) gets the HR shell; API returns 403, no data leak. Code comment documents it as intentional (Super Admin has no employee row). Changing it risks locking out Super Admin.                                                                                                                                                                                                                       |
| PORTAL-2                 | **Not reproduced**                  | —                             | Portal layout returns `null` with no token, so `useSearchParams` never runs at prerender; stale `.next` shows the routes prerendered. `next build` was **not** re-run. Suspense is a defensive nicety only.                                                                                                                                                                                                                                      |
| EMP-18                   | **Confirmed — wider than reported** | P3                            | All 9 reported lines exist, but there are **138** `font-mono` uses in `apps/ui/src` (≈90 in SCM). `--font-mono` is remapped to Nunito Sans in `globals.css:8` and `ui-kit/theme.css:176`, so **rendering is already Nunito**; the violation is class names only. `layout.tsx` still loads `JetBrains_Mono` (dead). Barcode SVG hardcodes a real monospace stack. `DESIGN_SYSTEM.md:271` contradicts its own §3.7; 4 HR docs prescribe monospace. |

## 2. Corrections to the earlier audit

- **EMP-12** was overstated as a general bypass: it only matters for custom roles.
- **EMP-9 (c)** is not a defect.
- **PORTAL-2** is not reproduced; **PORTAL-1** is a documented design choice.
- **ATT-9/LV-7/XM-4** are 30-second staleness, not persistent.
- **EMP-18** is a class-name rule violation, not a visual one — and far larger than 9 files.
- **TSK-1** conflicts with a recorded product decision; do not fix silently (CLAUDE.md: surface conflicts).

## 3. Needs a product/maintainer decision BEFORE code

1. **TSK-1:** block self-approval on tasks? (single-admin orgs would be blocked.)
2. **XM-2 self-decision guard:** same single-admin concern.
3. **DB-2:** restore triggers (with a delete bypass) vs. accept app-level append-only and update docs/test/schema comments. Ties to DB-1.
4. **EMP-18:** HR-only nine files vs. app-wide; reconcile `DESIGN_SYSTEM.md:271` with §3.7; add a CI guard?
5. **PORTAL-1:** leave as designed (recommended) or add a no-access screen.
6. **Download audit:** whether _reads_ (document download, payslip/Form16 PDF) must be audited or only exports/writes.

## 4. Prioritised implementation plan (no migrations needed for any item)

**Batch 1 — security/data integrity** (each needs an e2e; none can run without the disposable DB):

1. EMP-8: add `source: "HR_UPLOADED"` to delete path (repo or service 409). _Test:_ HR deleting an ONBOARDING doc → 4xx, row + file intact.
2. EMP-9b: `@IsIn(DOCUMENT_TYPES)` excluding `PROFILE_PHOTO` on POST upload; EMP-9a: team-scope membership check. _Tests:_ PROFILE_PHOTO via POST rejected; out-of-team upload 404.
3. EMP-12: require `hr.employee_account.write` when `userId` is sent. _Test:_ write-only role + userId → 403; verify CSV import path.
4. XM-2: transaction + `updateMany where status:"PENDING"` + audit row (self-decision guard only if decision #2 = yes). _Tests:_ double-decide, concurrent decide exactly one winner, audit row.
5. PAY-8: audit-before-return (fail-closed) for bank export and the 6 reports; ids/counts only. Fix the false doc line.
6. EMP-16: audit for departments and HR personal-data/document writes — **field names only**, allow-listed; `audit-redaction.ts` does **not** auto-redact `panNumber/aadhaarNumber/accountNumber`, so never pass raw rows.

**Batch 2 — correctness:** ATT-7 (`fromIso` IST-pinned; unit test under TZ=UTC and Asia/Kolkata), ATT-5 (`businessTimeOf`), EMP-17 (both selects), EMP-20 (catch P2002 → 409), LV-6 (use upserted id).
**Batch 3 — UI:** ATT-9/LV-7/XM-4 invalidation (add prefixes only; `timesheets` needs the raw key like `usePunchMutation`).
**Batch 4 — docs/tests:** DB-2 artefacts (after decision #3), EMP-18 (after decision #4).

## 5. Changed files / migration impact

None in this pass. No Group A item requires a migration. DB-2 option (a) _would_ (reviewer sign-off). Auth/shared-code touches
(`AuditWriter`, `assertNotSelfApproval` reuse from `hr/payroll/shared`) need reviewer sign-off per CLAUDE.md.

## 6. Tests executed

- Node timezone scripts (ATT-5, ATT-7) under UTC / Asia/Kolkata / America/New_York — see table.
- **Not run:** unit, e2e, lint, typecheck, build for these items. Hence nothing here is "production-ready"; database-backed
  verification is outstanding for every Batch 1 item.

## 7. Remaining risks / unverified

- Server TZ in deployment (ATT-5); UI `documentType` values sent by the document dialog (EMP-9); CSV import `userId` (EMP-12);
  whether `useRejectCorrection`/task hooks need invalidation; whether a holiday change alters derived attendance status (ATT-9b);
  whether the stale `.next` predates current portal files (PORTAL-2); existence of multi-role (HR Manager + Employee) users (XM-2).
- Prior report claim "hr-tickets e2e append-only test will fail" is inferred, not run.

---

## 8. Batch 1 implementation results (2026-11-19)

Scope: EMP-8, EMP-9, EMP-12, XM-2/RBAC-5, PAY-8, EMP-16. **No migration. Nothing committed or pushed.**
(Earlier fixes RBAC-2, EMP-1, EMP-2, XM-1 were swept into commit `2987abb`, made outside this task at 16:04 IST.)

| Item   | What changed                                                                                                                                                                                                                                                                                                                          | Key files                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| EMP-8  | HR document delete refuses non-`HR_UPLOADED` rows (422 `ONBOARDING_DOCUMENT_NOT_REMOVABLE`); the `UPDATE` also filters on source                                                                                                                                                                                                      | `employee-documents.service.ts`, `.repository.ts`                                                       |
| EMP-9  | `documentType` must be in the fixed set; a label spelling a reserved type is refused when no type is given; upload re-checks the employee under the **document-write** scope. **`PROFILE_PHOTO` stays valid** — three HR screens upload the avatar through this route, contrary to the verification report's suggestion to exclude it | `upload-employee-document.dto.ts`, service, repository                                                  |
| EMP-12 | `POST /hr/employees` with `userId` needs `hr.employee_account.write` (same rule as `link-user`)                                                                                                                                                                                                                                       | `employees.service.ts`, `employees.module.ts`                                                           |
| XM-2   | One conditional `UPDATE … WHERE status='PENDING' AND requested_by <> decider` + audit row in the same transaction; self-decision → 403 `SELF_APPROVAL_FORBIDDEN`; loser of a race → 422 `ALREADY_DECIDED`. HR note is not copied into audit                                                                                           | `my-work-permissions.*` (+ new `.exceptions.ts`)                                                        |
| PAY-8  | Audit-before-return (fail-closed) for the bank file, the 6 statutory/report files, and payslip PDFs (HR **and** self-service, successful downloads only). Metadata: ids, counts, period-tagged file name, size                                                                                                                        | `payments.*`, `payroll-reports.service.ts`, `payslip-pdf.service.ts`, `payslips.repository.ts`          |
| EMP-16 | Audit for department create/update/delete (name + isActive only), HR personal/address/bank/government-ID edits (**field names only**), HR on-behalf document upload, HR document upload/delete/**download**                                                                                                                           | `departments.repository.ts`, `employee-personal-data.repository.ts`, `employee-documents.repository.ts` |
| Docs   | Corrected the false "AuditInterceptor logs payroll reads" line                                                                                                                                                                                                                                                                        | `PAYROLL_AND_COMPLIANCE.md`                                                                             |

**Behaviour changes to review**

1. A role with `hr.employee.write` but not `hr.employee_account.write` can no longer create an employee **with** a login. Default HR Manager holds both. Existing `hr-onboarding` e2e used a reduced HR fixture and was updated to include the permission.
2. HR document downloads now add an audit row, and fail if the audit insert fails.
3. Self-service payslip downloads are now audited (one row per download).

**Tests (isolated DB `texawave_erp_test`, Redis index 5; migrated with `prisma migrate deploy`, 2 pending migrations applied to the test DB only)**

- New/extended e2e: documents 21, work-permissions 8 (new file, includes 8-round concurrent double-decide), departments 6, employees 120 (5 new), payroll 30 (with audit assertions), onboarding 5. All new tests pass.
- Mutation check: with the guards removed, the EMP-1, EMP-8, EMP-9 (scope), EMP-12 and XM-2 (concurrency) tests fail; files restored. PAY-8 and the audit-row tests were **not** mutation-checked.
- Static: api `tsc` 0, `eslint src test` 0, `nest build` 0, unit suite 217 files / 2545 tests pass.
- **Full e2e: 82 of 89 files pass; 12 tests fail in 7 files, none in code changed here (attributed by cause analysis, not a baseline run):**
  - `hr-employees` (2), `hr-tickets` (1), `hr-leave` (1): DB-2 family: append-only/no-delete triggers dropped by migrations; "has no DELETE route" is stale since `259909d`.
  - `hr-attendance-month-close` (1): expects `attendance.missing_check_in`, code emits `attendance.reminder` (changed 2026-10-23).
  - `self-service-profile` (1): expects `attachment`, controller returns `inline` for images.
  - `finance-expenses` (6), `finance-payments-received` (suite setup): Finance module, untouched.
- An unexplained one-off failure of `payslip-generation.spec.ts` ("`issueMock.mockReset` is not a function") occurred mid-session and has not recurred.

**Not done / residual**

- Form 16 PDFs and employee **self-service** document downloads are not audited (outside the approved list).
- `ARCHITECTURE.md:81,290` and `CODING_STANDARDS.md:105` still describe a global `AuditInterceptor` that does not exist; shared canonical docs, left for the maintainers.
- EMP-20 (department rename onto a deleted name → 500), DB-1, DB-2, TSK-1 and the rest of Groups B/C are untouched.
- Work-permission self-decision compares `requestedBy` only (not the employee's linked user).
- Test users/orgs created by audit-writing suites remain in the test DB by design (`audit_logs` is append-only).
