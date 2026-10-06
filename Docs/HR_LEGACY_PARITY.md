# HR Legacy Parity Matrix

**Status:** Discovery phase A2 complete for all 25 sidebar items. No new HR code, schema, or migration was written in this phase.
**Legacy source (read-only):** `D:\New folder\TexaWave_ERP` (Vite/React frontend, Firebase Realtime Database, Firebase functions). Not a git repository. Not modified.
**Production source:** `D:\New folder\Texawave_Erp_Production` (NestJS + Prisma + PostgreSQL, branch `feature/HR`).

**Legend.** _Confirmed_ = directly observed in legacy code and consistent across screens. _Observed_ = seen in one screen only, not cross-checked. _Unresolved_ = needs a business decision; not implemented. _Dead_ = present in code but unreachable or with no writer.

---

## 1. Architectural findings

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                    | Evidence                                                                                      | Consequence                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F1  | Legacy stores HR data in **Firebase Realtime Database** (RTDB), not a relational DB.                                                                                                                                                                                                                                                                                                                       | `ref(database, …)` across `src/modules/hr`                                                    | Legacy is a behaviour reference only. PostgreSQL schema is designed fresh.                                     |
| F2  | **Business logic lives in the browser.** Payroll, PF, ESI, bonus, loan, salary-report and offer-letter calculations are in React components. Server code is limited to `api/auto-checkout.ts` and `functions/`.                                                                                                                                                                                            | File inspection                                                                               | No server-side legacy rule set exists for most features. Every formula below is _observed_, not authoritative. |
| F3  | **Recruitment has no candidate/requisition/application entity** in any writer path. The three tabs are Interview Schedule (`interviewSchedule`), Offer Letter (`offerLetters`) and Revision Letter (`revisionLetters`).                                                                                                                                                                                    | `Recruitment.tsx`, `InterviewSchedule.tsx`, `OfferLetter.tsx`, `RevisionLetter.tsx`           | Do not invent an ATS pipeline. See §3.2.                                                                       |
| F4  | `HRDashboard.tsx` reads `hr/recruitment/candidates` (fields `stage`) to build a hiring funnel. **Nothing in the legacy repo writes that path.**                                                                                                                                                                                                                                                            | `grep "recruitment/candidates"` returns only the dashboard read (lines 566–568)               | **Dead read.** It is wrapped in try/catch and yields zero counts. It is not evidence of a candidate entity.    |
| F5  | Production already contains: Designation, EmploymentType, WorkLocation, DocumentSequence, Employee, EmployeeStatusHistory, Shift, ShiftAssignment, Holiday, WeeklyOffRule, LeaveType, LeaveRequest, AttendanceRecord, AttendanceSession, AttendanceCorrection. Plus self-service profile and leave, and the employee lifecycle service (status transitions, link/unlink user, reporting-line cycle check). | `schema.prisma` lines 408–930; `apps/api/src/modules/hr/*`; `employee-self-service/*`         | Do not duplicate.                                                                                              |
| F6  | Production has **no `projects`, `tasks`, `vault`/documents, `expenses`, `attachments`, `approvals`, `comments`, generic `statuses`/`status_history`, or notification model.** These are described in `Docs/ARCHITECTURE.md` §5 as _paused/target_ but do not exist in `schema.prisma`, migrations, or `apps/api/src/modules`.                                                                              | Schema grep; migration grep; `git log -S "model Project"` returns nothing                     | The "paused projects tables" the prompt refers to **do not exist in this checkout**. See §4.                   |
| F7  | Production has no file-storage abstraction. Legacy uploads go to **Cloudinary** (external) with the returned URL written onto the employee or document record.                                                                                                                                                                                                                                             | `EmployeeDocumentsView.tsx:71–110`, `Other.tsx:115–150`; no storage service in `apps/api/src` | Document storage needs a decision (see §4, item D1).                                                           |
| F8  | Production already applies an approved attendance correction to the attendance record **inside one transaction** (`attendance-corrections.repository.ts` `decide` → `attendance.applyCorrection`). Legacy writes the attendance patch directly and non-transactionally.                                                                                                                                    | Production repo lines 212–260                                                                 | Production is stronger. Regularization is reused, not rebuilt.                                                 |

---

## 2. Confirmed legacy formulas (observed in client code)

Each formula still needs business-owner sign-off before any payroll-class schema is designed (§4).

### 2.1 Provident Fund (PF)

- Applicability: `pfApplicable === true || includePF === true` (`Payroll.tsx:234`, `Pf.tsx:161`).
- Wage base: `basic + conveyance`, prorated by the earning ratio in `Pf.tsx:357–361`.
- Rate: 12%.
- **Rounding conflict, three variants:**
  - `Payroll.tsx:541`: `Number((pfBase * 0.12).toFixed(2))`.
  - `Pf.tsx:362`: `Math.round(pfBase * 0.12)` (whole rupees).
  - `SalaryReport.tsx:170–173`: `Math.round(pfBase × 0.12 × 100) / 100`, where `pfBase = totalEarnings × ((basic + conveyance) / gross)`. This is an **approximation** that the code itself comments on.
- No wage ceiling constant exists in any screen.

### 2.2 Employee State Insurance (ESI)

- Applicability: `esiApplicable === true || includeESI === true` (`Esi.tsx:132`, `Payroll.tsx:239`).
- Threshold constant: `ESI_THRESHOLD = 21000` (`Esi.tsx:91`).
- Rate: 0.75% of gross.
- **Eligibility conflicts across four places:**
  - `Payroll.tsx:544`: applicability flag AND `monthlySalary <= 21000`, base = total gross.
  - `Esi.tsx:403`: applicability AND `monthlySalary <= ESI_THRESHOLD`.
  - `Esi.tsx:546–547`: table path gates on a per-entry `entry.esiIncluded` flag and tests only the threshold.
  - `SalaryReport.tsx:174`: `isESI(emp) && gross <= 21000`, base = `totalEarnings`, where `gross` is master gross and `totalEarnings` is prorated.
- Employer contribution: not computed anywhere.

### 2.3 Payroll preparation (`Payroll.tsx`)

- Gross = `baseEarnings + additionalSpAllowance + arrearsSalary` (`:535–537`). Arrears are a prior-period component paid this month.
- Net = `totalGross − (pf + esi + loanDeduction + ldPay)` (`:549–551`). `ldPay` is unresolved (§4).
- Payable days = `fullWorkingDays + halfDays × 0.5` (`:453`). LOP days = totalDays − payable days.
- Loan deduction = sum of approved EMIs for the month (`:426`), editable per row (`handleLoanDeductionChange`, `:576`).
- Persisted paths: `hr/payrollPeriods/{month}`, `hr/payrollCredited/{month}/{empId}`, `hr/payrollAuditLogs/{month}` (push-log), `hr/payslips/{month}/{empKey}`.

### 2.4 Bonus (`Bonus.tsx`)

- Leave count per year = `absentDays (Absent + Leave) + halfDays × 0.5`; holidays and week-offs excluded (`:185–186`).
- `twDays = TOTAL_DAYS − totalLeaves`; `leaveDifference = twDays / TOTAL_DAYS`.
- CTC = `ctcLPA × 100000` if present, else `grossMonthly × 12`.
- Calculated bonus = `(ctc × leaveDifference) / 12`.
- **Unresolved:** `actualBonus = totalLeaves < 30 ? grossMonthly : calculatedBonus` (`:228`). Source of "30" and the intent are not documented.
- `TOTAL_DAYS` is defined in the file header, not yet read for calendar vs working-day semantics.
- No approval state and no payment state exist in the bonus data. Bonus is computed on screen and exported to XLSX.

### 2.5 Loans (`Loans.tsx`, `LoanBox.tsx`)

- Status enum: `Pending | Approved | Rejected | Repaid` (`Loans.tsx:56`).
- Eligible maximum = **3 × gross monthly** (`Loans.tsx:442`, `LoanBox.tsx:107`), with override `maxLoanOverride.standardMax` (`:578`). The `finalAmount` uses `min(amount, standardMax)` unless overridden (`:580`).
- EMI = `ceil(amount / emiMonths)` (`LoanBox.tsx:109`, `Loans.tsx:582`).
- Remaining = `max(0, totalApproved − totalPaid)` (`Loans.tsx:177`).
- Monthly credit = `min(emiAmount, remaining)` (`:1349`), guarded by `emiPayments[month].payrollCredited` (`:1345`).
- Net-after-EMI check (`Loans.tsx:450`, `LoanBox.tsx:111`) is computed; whether it blocks submission is not confirmed.
- Also has `SkipEmiRequest` type (`Loans.tsx:58`): an EMI-skip workflow exists and is **not yet audited**.

### 2.6 Offer letter (`OfferLetterTemplate.ts`)

- `netMonthly = basic + da + hra + ca`; `grossMonthly = netMonthly` (no deductions); `grossAnnual = grossMonthly × 12` (`:29–47`).
- **Confirmed:** the offer letter shows gross only. No statutory deduction appears in the offer calculation.
- Status enum `Generated | Sent | Accepted` (`OfferLetter.tsx:30`). **Dead states:** only `Generated` is ever written (`:385`); `Sent` and `Accepted` have no setter anywhere.

### 2.7 Attendance-derived pay inputs

- Earning ratio prorates basic, conveyance and special allowance by payable days.
- Sundays counted per month; `effectiveSundayCount = max(0, sundays − sundayWorkedCount)` (`Esi.tsx:392`, `Pf.tsx:341`).
- Holiday, Sunday and OT pay appear in `Esi.tsx:392–400` and `Pf.tsx:345`. OT and premium rates are in `hr/otRates` (not audited).

---

## 3. Feature audits (A2)

Each entry follows the 16-point template. Items marked _(not audited)_ were not read in this phase.

### 3.1 Interview (`InterviewSchedule.tsx`, 416 lines)

1. **Location:** `modules/hr/InterviewSchedule.tsx`; RTDB `interviewSchedule`.
2. **Data:** `{ candidateName, role, interviewer, date (YYYY-MM-DD), time, mode: online|in_person|phone, status, notes, createdAt, createdBy }`. Candidate is free text; there is no candidate id.
3. **Workflow:** create (status `scheduled`) → `handleStatusChange` to any of `scheduled | completed | selected | rejected | no_show`. Any transition is allowed from any state (no transition guard). Hard delete via `remove`.
4. **Calculations:** none.
5. **Production:** none.
6. **Reusable:** `Employee` is not a candidate; no reuse.
7. **Required backend:** new `hr.interview` table (candidate as free text + optional `candidateReference` string); list, create, status update, cancel. Do **not** hard-delete; use a status.
8. **Models:** `HrInterview` (id, organizationId, candidateName, roleTitle, interviewerEmployeeId nullable + interviewerName text, scheduledDate, scheduledTime, mode, status, notes, createdBy, timestamps).
9. **APIs:** `GET/POST /hr/interviews`, `GET/PATCH /hr/interviews/:id`, `POST /hr/interviews/:id/status`.
10. **Permissions:** `hr.interview.read`, `hr.interview.write` (organization-wide; no employee scope).
11. **Audit:** create, status change (before/after). Required per master prompt "recruitment stage changes".
12. **Scope:** organization-wide.
13. **Dependencies:** optional link to `Employee` for interviewer.
14. **Confirmed rules:** status set above; mode set above.
15. **Unresolved:** whether `no_show` and `selected` are terminal; whether `selected` triggers anything (legacy does nothing on selection); who may write.
16. **Recommendation:** implement with a transition guard that matches legacy _as observed_ only after the terminal-state question is answered. Until then, implement as free transitions with audit (matches legacy). Flag as deviation.

### 3.2 Offer letter (`OfferLetter.tsx`, 977 lines; `OfferLetterTemplate.ts`)

1. **Location:** `modules/hr/OfferLetter.tsx`, `OfferLetterTemplate.ts`, `utils/shareUtils.ts`; RTDB `offerLetters`.
2. **Data:** candidate fields (name, role, location, salary components basic/da/hra/ca, dates), derived gross, `status`, `createdAt`, `createdBy`. Saved as a **full snapshot** of rendered inputs; edits overwrite with `set`.
3. **Workflow:** generate → saved as `Generated`. Share via Gmail, WhatsApp, mailto, or PDF/HTML download. **No state change on share.** `Sent`/`Accepted` are unreachable (dead).
4. **Calculations:** `netMonthly = grossMonthly = basic+da+hra+ca`; `grossAnnual = ×12` (§2.6).
5. **Production:** none.
6. **Reusable:** none for offer. Document rendering is a client concern; PDF generation is in `PDF_GENERATION_ARCHITECTURE.md` (legacy).
7. **Required backend:** `hr.offer_letter` with immutable version rows (append-only, since legacy overwrites). Salary components stored as integers in paise or as `Decimal`. Document rendering stays client-side or in a separate render service (decision D4).
8. **Models:** `HrOfferLetter` (id, organizationId, candidateName, role, location, basic, da, hra, ca, grossMonthly (stored), grossAnnual (stored), status, documentNo, letterDate, createdBy, version, timestamps).
9. **APIs:** `GET/POST /hr/offer-letters`, `GET /hr/offer-letters/:id`, `POST /hr/offer-letters/:id/revisions`, `POST /hr/offer-letters/:id/status` (only if D5 resolved).
10. **Permissions:** `hr.offer_letter.read`, `hr.offer_letter.write`. Salary fields may need a separate permission (decision D6).
11. **Audit:** create and revision (append). Legacy's overwrite-in-place is an **intentional deviation**.
12. **Scope:** organization-wide.
13. **Dependencies:** on hiring-time creation of `Employee` (not in legacy; see §3.2 conversion below).
14. **Confirmed rules:** gross = sum of four components; annual = monthly × 12.
15. **Unresolved:** whether any deduction applies (none in legacy); whether `Sent` and `Accepted` should exist; who may see offer salary (confidentiality); whether offer → employee conversion exists in legacy (**none found**).
16. **Recommendation:** implement generate, list, view, and revision. Do not implement `Sent`/`Accepted` until D5 is answered. Do not implement employee conversion: legacy has no such path, and the master prompt says conversion is implemented only if legacy supports it.

### 3.3 Revision letter (`RevisionLetter.tsx` 894 lines; `RevisionLetterEmployees.tsx` 296 lines)

1. **Location:** `RevisionLetter.tsx`, `RevisionLetterEmployees.tsx`, `RevisionLetterTemplate.ts`; RTDB `revisionLetters`.
2. **Data:** `{ employeeRecordId?, employeeCode?, employeeName, designation, location, documentNo, letterDate, effectiveDate, basic, da, hra, ca, status, createdAt, createdBy }`. Unlike offer letters, it links to an employee record (optional).
3. **Workflow:** same as offer letter. Status `Generated | Sent | Accepted`; only `Generated` written. Bulk delete via `Promise.all(remove…)`.
4. **Calculations:** same four-component sum (`RevisionLetterTemplate.ts`, not read in full).
5. **Production:** none. No salary-revision history exists in production.
6. **Reusable:** `Employee` (link via `employeeRecordId` → `employees.id`).
7. **Required backend:** salary revision history must be append-only and link to an `Employee`. This interacts with payroll-salary changes (unresolved, §4).
8. **Models:** `HrSalaryRevisionLetter` (id, organizationId, employeeId FK nullable, employeeCodeSnapshot, designationSnapshot, locationSnapshot, documentNo, letterDate, effectiveDate, components, grossMonthlySnapshot, status, createdBy, timestamps).
9. **APIs:** `GET/POST /hr/revision-letters`, `GET /hr/revision-letters/:id`, `GET /hr/employees/:id/revision-letters`.
10. **Permissions:** `hr.revision_letter.read/write`.
11. **Audit:** create; bulk-delete becomes a status change.
12. **Scope:** `.team` for employee-linked letters (matches employees' scope).
13. **Dependencies:** `Employee`.
14. **Confirmed rules:** same as offer.
15. **Unresolved:** whether a revision **changes** the employee's stored salary (legacy does not write the employee record, so it does not — observed); whether `effectiveDate` must be ≥ letterDate; who may issue.
16. **Recommendation:** implement as a letter record only. Do **not** update `Employee` salary; flag this as a payroll dependency (§4 P-items).

### 3.4 Regularization (`Regularization.tsx`, 478 lines)

1. **Location:** `modules/hr/Regularization.tsx`; RTDB `hr/regularizationRequests`.
2. **Data:** `{ employeeId, employeeName, date, type, requestedCheckIn?, requestedCheckOut?, reason, status: pending|approved|rejected, submittedAt, reviewedBy, reviewedAt, reviewNote }`.
3. **Types:** `missed-checkin | missed-checkout | incorrect-time | late-arrival | early-departure`. **Identical set** to production `AttendanceCorrection.correctionType`.
4. **Workflow:** pending → approved or rejected. On approve, the legacy writes into `hr/attendance/{date}/{empKey}` directly: sessions patched, `workHrs`, `otHrs`, `pendingHrs`, `totalWorkedMs`, `status: Present`, `regularized: true`, `regularizedBy`, `regularizedAt`, and a notification to the user. This uses `computeAttendanceHours`, which applies Sunday OT = 0.
5. **Calculations:** delegated to the shared attendance calculator (`computeAttendanceHours`). Production has the equivalent Attendance calc.
6. **Production:** **Existing and stronger** — `AttendanceCorrection` with `SUBMITTED → APPROVED | REJECTED`, transactional apply, self-approval forbidden, `.own` cannot decide, employee self-service create.
7. **Reusable:** all of it.
8. **Required backend:** **none for the core workflow.** Two gaps to verify, not build:
   - (a) Legacy sets a `regularized: true` marker on the attendance record. Production's `applyCorrection` must be checked for an equivalent marker. If absent, it is a reporting gap, not a rule.
   - (b) Legacy notifies the employee on decision. Production has no notification model (F6). Decision D7.
9. **APIs:** existing `/hr/attendance/corrections` endpoints.
10. **Permissions:** existing `employee_self_service.attendance_correction.create`, `hr.attendance_correction.read`, `hr.attendance_correction.approve`.
11. **Audit:** existing.
12. **Scope:** existing `.team`/`.all`.
13. **Dependencies:** Attendance (existing).
14. **Confirmed rules:** the five type set; the required-time rule in `ALLOWED_TIMES` (production); approval is a state change to APPROVED with the attendance patch.
15. **Unresolved:** whether `regularized` flag is needed (D8); notification channel (D7).
16. **Recommendation:** **reuse, do not create a second system.** Close (a) by reading `applyCorrection`. No new migration unless (a) proves a real gap.

### 3.5 Work Logs (`WorkLogs.tsx`, 222 lines)

1. **Location:** `modules/hr/WorkLogs.tsx`; RTDB `hr/timeLogs/{employeeId}/{logId}`.
2. **Data:** `{ employeeId, employeeName, date, taskDescription, hoursWorked, status: pending|approved|rejected, reportingTo, submittedAt }`.
3. **Workflow:** employee submits a daily log of task description and hours; HR (admin) approves or rejects. Filtered by status; counts shown.
4. **Calculations:** none. Totals are simple counts. `hoursWorked` is not summed in this screen.
5. **Production:** none.
6. **Meaning:** these are **daily task-time submissions**, not attendance. They do not derive from punches. They are not linked to the `projects`/tasks feature (legacy `tasks` root is separate; see §3.9).
7. **Required backend:** a `hr.work_log` table (employee, date, description, hours, status, reportingToEmployeeId, decision fields). Do not use attendance sessions for this.
8. **Models:** `HrWorkLog`.
9. **APIs:** `POST /self-service/work-logs` (create own), `GET /hr/work-logs` (team/all), `POST /hr/work-logs/:id/decision`.
10. **Permissions:** `employee_self_service.work_log.create`, `hr.work_log.read`, `hr.work_log.approve`.
11. **Audit:** decision (approve/reject).
12. **Scope:** `.own` create/read; `.team` for approve (legacy `reportingTo` suggests manager; but legacy screen lets any HR admin approve, see unresolved).
13. **Dependencies:** `Employee.reportsToId` for the reporting manager.
14. **Confirmed rules:** three-state status; approve/reject only from `pending` (legacy shows buttons only when `pending`, but the update is not guarded server-side — observed).
15. **Unresolved:** whether approval is by the reporting manager or HR (legacy shows both `reportingTo` field and HR-only screen); whether hours are capped per day; whether logs are locked after approval.
16. **Recommendation:** implement after D9 is answered. Do not derive from attendance.

### 3.6 Org Chart (`OrgChart.tsx`, 1317 lines)

1. **Location:** `modules/hr/OrgChart.tsx`; RTDB `hr/employees` (fields `reportingToId`, `reportingTo`, `orgChartRole`, `department`), `hr/orgDepartments/{id}`, `hr/orgSlots/{id}`.
2. **Data:** employees carry `reportingToId`; `orgSlots` are **vacant placeholder positions** (`PlaceholderSlot`, `:83`) with a `reportingToId` and `department`; `orgDepartments` are a _separate list_ of departments with seed data (`:279`).
3. **Workflow:** place unplaced employee under a manager (creates or updates employee); fill a slot with an employee (`:492–508`); remove a node → direct reports re-parented to the removed node's manager, and slot removed (`:557–572`); rename department → cascades `department` name to employees and slots (`:420–431`); delete department → clears employees and removes its slots (`:455–458`).
4. **Calculations:** cycle-safe tree build (`buildTree`, `:146–180`) with parent-chain loop detection. Production already enforces `REPORTING_LINE_CYCLE`.
5. **Production:** **Partial.** `Employee.reportsToId` exists with `@@index([organizationId, reportsToId])`. Cycle check exists in lifecycle. `Department` and `Team` exist in **platform**.
6. **Reusable:** `Employee.reportsToId`, `Department`, `Team`, lifecycle reporting-line validation.
7. **Required backend:**
   - Hierarchy read: recursive CTE scoped to organization, depth-capped, `.team`/`.all` scoped.
   - Reporting-line change: reuse lifecycle service (already validates cycles and org ownership).
   - **Do not** create a second employee hierarchy table.
   - Vacant slots (`orgSlots`) and org-chart-only departments: decision D10. Department data should map to platform `Department` (the legacy `orgDepartments` duplicates it — intentional deviation).
8. **Models:** none required for hierarchy. `HrOrgSlot` only if D10 = yes.
9. **APIs:** `GET /hr/org-chart?rootEmployeeId=&depth=` (depth ≤ 10), `GET /hr/employees/:id/direct-reports`. Reporting-line updates go through existing employee PATCH.
10. **Permissions:** existing `hr.employee.read` with `.team`/`.all`.
11. **Audit:** existing employee audit covers reporting-line change.
12. **Scope:** `.team` and `.all` (org chart spans teams; `.team` shows only caller's teams' subtree).
13. **Dependencies:** Employee, Department (platform), Team (platform).
14. **Confirmed rules:** single reporting manager per employee; cycle forbidden; removing a node re-parents its direct reports to its manager (legacy observed at `:557–565`).
15. **Unresolved:** D10 (vacant slots); whether department rename must cascade (legacy does; production stores department by FK, so no cascade needed — deviation).
16. **Recommendation:** implement the read API and direct-reports API now. Defer slots until D10.

**Implementation status (decided and built; read-only, no schema change):**

- **Status: Implemented.** Backend module `apps/api/src/modules/hr/org-chart/`; registered in `app.module.ts`. No UI, no migration, no audit rows.
- **Endpoints as built:**
  - `GET /hr/org-chart` with `departmentId?` (added: legacy's per-department view), `rootEmployeeId?` (subtree), `depth?` (1–10, default 10, root level included). Returns a nested forest. Each node carries `directReportCount`; a node cut off by `depth` has `children: []` and a non-zero count, which is the expand signal.
  - `GET /hr/employees/:id/direct-reports`. Returns a sorted array, not paginated.
- **Permissions (decision):** existing `hr.employee.read` with `own`/`team`/`all` via `@RequireScopedPermission`. No new permission, no catalogue change. Org Chart is **not** globally visible to match the legacy UI; an `own`-only user sees an empty chart.
- **Employee visibility (decision):** only `status = ACTIVE` and not soft-deleted. `INACTIVE`, `RESIGNED`, and `TERMINATED` are hidden. A visible employee whose manager is hidden (or out of scope) becomes a top-level node, so the manager's identity is not leaked.
- **Tree rules:** the tree is built from `Employee.reportsToId` only. A reporting line is followed only if the manager is visible, is not the employee, and the chain above reaches the top without looping. Otherwise the employee is a root. Siblings and roots are ordered by `fullName`, then `id`. Legacy had no explicit order; this is a production choice.
- **Scope rule:** `teamWhere()` applies to each employee's own `teamId`. A team-scoped reader therefore sees only their teams' members, and a report in another team is hidden, which cuts that branch. Legacy had no team scope.
- **Response fields:** `id`, `employeeCode`, `fullName`, `reportsToId`, `designation`, `department`, `team`, `directReportCount`, `children`. No contact details or compensation.
- **Deviations from legacy (intentional):**
  - Cross-department reporting is allowed. Legacy blocked it in the UI only. The `departmentId` filter cuts such reports from a department view, as legacy did.
  - Department data is the platform `Department` FK, not the legacy string or `orgDepartments` list.
  - Legacy's name-based `reportingTo` fallback is not needed, because production stores the manager as a foreign key.
- **Still open:** D10 (vacant slots, `orgSlots`) is not implemented and remains deferred.
- **Performance note:** the tree is built in memory from one query per request over visible members. Revisit if the organization grows large.

### 3.7 Loans (`Loans.tsx` 1616 lines, `LoanBox.tsx` 733 lines)

Covered in §2.5. Additional audit:

1. **Location:** RTDB `hr/loans` (12 references across `hr/`).
2. **Data:** `{ employeeId, employeeName, amount, approvedAmount?, reason, date, emiMonths, emiAmount, status, disbursedDate?, notes, approvedBy, approvedAt, createdBy, createdAt, maxLoanOverride?, emiPayments: {month: {payrollCredited}} }`.
3. **Workflow:** request (`Pending`) → approve (may cap at `standardMax` or override) / reject → disbursed (`disbursedDate`) → monthly EMI credited via payroll → `Repaid` when remaining is 0. **EMI skip** via `SkipEmiRequest` (not audited).
4. **Calculations:** §2.5.
5. **Production:** none.
6. **Reusable:** `Employee`; payroll (not built).
7. **Required backend:** `HrLoan` + `HrLoanInstallment` (append-only installment ledger) + `HrLoanPayment`. Balance computed from ledger, not stored. Transactions for approve, disburse, and monthly EMI credit.
8. **Models:** as stated; `amount` and EMI as integer minor units.
9. **APIs:** `POST /self-service/loans`, `GET /hr/loans`, `POST /hr/loans/:id/approve`, `POST /hr/loans/:id/reject`, `POST /hr/loans/:id/disburse`, `GET /hr/loans/:id/ledger`.
10. **Permissions:** `employee_self_service.loan.create`, `hr.loan.read`, `hr.loan.approve`, `hr.loan.disburse`, `hr.loan.override_limit` (D7-class decision).
11. **Audit:** approve, reject, disburse, override, each EMI credit.
12. **Scope:** `.own` create/read; `.team` for approve/read.
13. **Dependencies:** **Payroll** (EMI credit happens at payroll; blocked, §4 P-items).
14. **Confirmed rules:** max = 3× gross (observed); EMI ceiling division; balance = approved − paid; EMI credit = min(EMI, remaining); double-credit guard by month key.
15. **Unresolved:** L1 (override authority); L2 (net-after-EMI block vs warn); L3 (EMI-skip rules); L4 (interest — none observed, must confirm none); L5 (`disbursed` requires whose action); L6 (what happens to remaining on exit).
16. **Recommendation:** **blocked on payroll for EMI credit.** The loan request/approval/ledger can be built now without the payroll credit path. Mark EMI-credit as a stub with a documented contract.

### 3.8 Exit Requests (`ExitRequests.tsx` 327 lines; `employee/ExitRequest.tsx` 447 lines)

1. **Location:** RTDB `hr/exitRequests`.
2. **Data:** `{ reason, lastWorkingDatePreferred, noticePeriodDays (default 30, user-editable), additionalNotes, status, employeeId, employeeName, createdAt, hrNote?, actualLastWorkingDate?, settlementStatus? }`.
3. **Status:** `submitted | under_review | approved | rejected | completed`.
4. **Workflow:** employee submits (`submitted`). HR edits status, `actualLastWorkingDate`, `settlementStatus` (free-text option list: `Pending | In Progress | Completed | On Hold`), and `hrNote`; employee is notified. Employee can see their own requests. **No transition guard** (any status may be set).
5. **Calculations:** none. Notice period is an **input value**, not computed.
6. **Production:** **Partial.** `Employee.status` has `RESIGNED | TERMINATED` (terminal, with `dateOfExit` and `exitReason`). Lifecycle rejects further transitions out of exit states. Employee deactivation disables login (`HR_API.md` §7).
7. **Critical gap:** **legacy `completed` does NOT change the employee record.** Confirmed: `ExitRequests.tsx` writes only `hr/exitRequests/{id}` and a notification. Employee remains active in legacy. Production's exit lifecycle would deactivate. This is **a deliberate deviation to decide**, not a rule to copy.
8. **Required backend:** `HrExitRequest` with explicit transitions (decision E1), `noticePeriodDays` stored as input only, `settlementStatus` as enumerated text. On `completed`, a transactional call to the existing lifecycle service to set `RESIGNED` (decision E2).
9. **APIs:** `POST /self-service/exit-requests`, `GET /self-service/exit-requests`, `GET /hr/exit-requests`, `PATCH /hr/exit-requests/:id` (status, lastWorkingDate, settlement, note), with transition guard.
10. **Permissions:** `employee_self_service.exit_request.create`, `hr.exit_request.read`, `hr.exit_request.decide`, `hr.exit_request.complete` (separate — completing triggers deactivation).
11. **Audit:** every status change, settlement change, and the deactivation.
12. **Scope:** `.own`, `.team`, `.all`.
13. **Dependencies:** Employee lifecycle (exit transition), Notification (no model: F6), Settlement (blocked).
14. **Confirmed rules:** five statuses; notice period is user input defaulting to 30 days (**observed default, not policy**).
15. **Unresolved:** E1 transition map; E2 whether `completed` deactivates; E3 notice period policy (who sets, minimum); E4 clearance and asset return (**not present in legacy at all**); E5 final settlement calculation (**not present**; `settlementStatus` is only a label).
16. **Recommendation:** implement request lifecycle now with an explicit transition map. Deactivation on completion is blocked on E2. Clearance and final settlement are **not built** because legacy has no rules.

### 3.9 Task Assignment (`TaskAssignment.tsx` 598 lines; `employee/MyTasks.tsx` 549; `employee/AssignTasks.tsx` 11 lines)

1. **Location:** RTDB **root `tasks`** (`ref(database, 'tasks')`), not `hr/`. Used by both HR admin and employee screens.
2. **Data:** `{ title, description, assignedTo, assignedToName, assignedBy, createdBy, dueDate (YYYY-MM-DD), priority: low|medium|high|urgent, status: pending|in_progress|done|cancelled, notes, isEmployeeCreated, requestToAdmin, createdAt, updatedAt, adminApproved, approvedAt }`.
3. **Workflow:** admin assigns (`pending`) → employee sets `in_progress` or `done` → admin marks `adminApproved: true` or `false` on `done` tasks. Employee-created tasks with `requestToAdmin` go to an "admin requests" queue. Notifications on assignment and status change.
4. **Calculations:** overdue = `status ∉ {done, cancelled} && dueDate < today`. Sort by priority then due date.
5. **Production:** none.
6. **Shared-table risk:** the root `tasks` path is **not** the CRM tasks path (`crm/tasks`, `tasksService.ts`). So it is HR-owned in practice, but its root location is an accident of the legacy layout.
7. **Reuse decision — see §4 T1.** Production has no `projects`/`tasks` tables. The architecture doc describes `projects` and `tasks` (with `project_members`, `parent_task_id`, `assignee_id`, `status_id`) as a **paused target design for a project-management domain**. That is not the HR semantics (flat assignment, admin approval, employee-created requests, priority, no project).
8. **Required backend (decision):** **design dedicated `hr` tasks**, not reuse the architecture's projects tasks. Rationale: the architecture's tasks belong to a project; HR tasks have no project and need an admin-approval step. Reusing would force a project FK or a fake project.
9. **APIs:** `GET/POST /hr/tasks`, `GET /hr/tasks/:id`, `PATCH /hr/tasks/:id` (assign/reassign, notes), `POST /hr/tasks/:id/status`, `POST /hr/tasks/:id/approve`, `GET /self-service/tasks`, `POST /self-service/tasks` (employee request).
10. **Permissions:** `hr.task.read.{own,team,all}`, `hr.task.write`, `hr.task.approve`, `employee_self_service.task.read|create|update_status`.
11. **Audit:** create, assign, status, approve.
12. **Scope:** `.own` (assignee), `.team` (assignee in caller's team), `.all`.
13. **Dependencies:** Employee (assignee/creator), Notification (F6).
14. **Confirmed rules:** four statuses; four priorities; overdue definition; `done` requires admin approval to count as complete (observed: `adminApproved` gates the "approved" filter).
15. **Unresolved:** T2 whether `cancelled` can be reversed; T3 whether only admin may cancel; T4 whether employee may reopen a `done` task; T5 whether `dueDate` is required (legacy enforces it in the UI).
16. **Recommendation:** implement dedicated `hr_task` tables now. This is not blocked.

### 3.10 Employee Tickets (`AdminTickets.tsx` 519 lines; `employee/RaiseTicket.tsx` 715 lines)

1. **Location:** RTDB `hr/tickets`.
2. **Data:** `{ category, subject, description, status: open|in_progress|resolved|closed, employeeId, employeeName, createdAt, adminReply?, resolvedAt?, createdByAdmin?, createdByName?, targetEmployeeId?, isGlobal? }`.
3. **Categories:** free-typed in data; UI offers `Notice`, `HR Query` and others (not enumerated in the code read; partly observed).
4. **Workflow:** employee raises (`open`) → HR changes status and may add `adminReply`. `resolved`/`closed` set `resolvedAt`. Admin can raise a ticket **on behalf of** a targeted employee or as `isGlobal` (broadcast). Employee can edit category/subject/description (`RaiseTicket.tsx:172`).
5. **Calculations:** none.
6. **Production:** none.
7. **Required backend:** `hr.ticket` table, `hr.ticket_comment` (append-only), status transitions with guard, category as a reference table or enum (decision K1).
8. **Models:** `HrTicket`, `HrTicketComment`.
9. **APIs:** `POST /self-service/tickets`, `PATCH /self-service/tickets/:id` (only while `open`, decision K2), `GET /self-service/tickets`, `GET /hr/tickets`, `POST /hr/tickets` (admin-created), `POST /hr/tickets/:id/status`, `POST /hr/tickets/:id/comments`.
10. **Permissions:** `employee_self_service.ticket.create|read|update`, `hr.ticket.read|write|respond`.
11. **Audit:** status change, reply, admin-created.
12. **Scope:** `.own` for employee; `.team`/`.all` for HR.
13. **Dependencies:** Employee, Notification (F6).
14. **Confirmed rules:** four statuses; `resolved`/`closed` stamp `resolvedAt`; employee may edit a ticket (observed without a guard on status).
15. **Unresolved:** K1 category list; K2 may an employee edit after it is `in_progress`; K3 may `closed` be reopened; K4 SLA (none observed); K5 attachments (legacy stores none on tickets).
16. **Recommendation:** implement now. Attachments deferred (no evidence, and blocked on D1).

### 3.11 Expense Approvals (`ExpenseApprovals.tsx` 362 lines; `employee/MyExpenses.tsx` 374 lines)

1. **Location:** RTDB `hr/expenseRequests`.
2. **Data:** `{ expenseType, amount, date, description, receiptRef (free text), status: pending|approved|rejected, employeeId, employeeName, createdAt, reviewNote?, reviewedAt? }`.
3. **Types:** `Travel | Food | Accommodation | Office Supplies | Medical | Other` (`EXPENSE_TYPES`, `ExpenseApprovals.tsx`).
4. **Workflow:** employee submits claim (`pending`) → HR approves or rejects with optional note. Employee is notified. Excel export.
5. **Calculations:** totals by status and by category. **No reimbursement, payment, or payroll link exists** (grep for reimburse/paid/payout returned nothing).
6. **Production:** none. `Docs/ARCHITECTURE.md` lists `expenses` under paused Finance — the table does not exist.
7. **Required backend:** `hr.expense_claim` with status transitions in a transaction (decide + audit). Amount as integer minor units. **No reimbursement**.
8. **Models:** `HrExpenseClaim`.
9. **APIs:** `POST /self-service/expense-claims`, `GET /self-service/expense-claims`, `GET /hr/expense-claims`, `POST /hr/expense-claims/:id/decision`.
10. **Permissions:** `employee_self_service.expense_claim.create|read`, `hr.expense_claim.read`, `hr.expense_claim.decide`.
11. **Audit:** decision (approve/reject) with before/after.
12. **Scope:** `.own` for claimant; `.team`/`.all` for decision.
13. **Dependencies:** Employee; Payroll (**no legacy link — do not build**).
14. **Confirmed rules:** three statuses; six categories; amount > 0 (observed, MyExpenses validation); decision only from `pending` (observed in UI; server guard not confirmed).
15. **Unresolved:** X1 reimbursement path (none in legacy); X2 receipt — legacy stores a text reference only, so receipt upload is undecided (D1); X3 approval limits by amount (none observed); X4 self-approval guard (not observed; production must forbid).
16. **Recommendation:** implement now, no payroll link. Receipt is a reference string until D1.

### 3.12 Employee Documents (`EmployeeDocumentsView.tsx` 344 lines; `hr/Documents.tsx` 164 lines)

1. **Location:** RTDB `hr/employees/{id}` (writes `documents` sub-object per default doc type), Cloudinary for files.
2. **Data:** per default document (e.g., Aadhaar, PAN, bank proof — _list not fully read_): `{ url, uploadedAt, … }`. Custom docs stored in a list on the employee.
3. **Workflow:** HR uploads a file for a labelled document type. Upload to Cloudinary (`auto/upload`), then `update(hr/employees/{id})` with the URL. The code comment (`:104`) notes that an update must not clobber other employee fields. Documents shown in a grid; a download link rewrites the Cloudinary URL to `fl_attachment`.
4. **Calculations:** none.
5. **Verification and expiry: none in legacy** (grep for `verif` returned nothing in these files).
6. **Production:** none. **No file-storage abstraction exists** (F7).
7. **Required backend:** `hr.employee_document` metadata row (employee FK, document type, storage key, mime, size, uploadedBy, uploadedAt, optional `expiresOn`). **Binary storage is blocked on D1.** Access must check employee ownership and scope before issuing any download URL.
8. **Models:** `HrEmployeeDocument` (metadata only).
9. **APIs:** `GET /hr/employees/:id/documents`, `POST /hr/employees/:id/documents` (metadata + upload handle), `GET /hr/employee-documents/:id/download` (scoped signed URL), `GET /self-service/documents`.
10. **Permissions:** `hr.employee_document.read|write`, `employee_self_service.document.read`.
11. **Audit:** upload and download (download audit is a sensitive-access decision, D11).
12. **Scope:** `.own`, `.team`, `.all`.
13. **Dependencies:** Employee; file storage (D1).
14. **Confirmed rules:** a document belongs to one employee; overwrite-by-type behaviour observed (later upload replaces the URL for that type). Whether old versions are kept: not observed (**legacy overwrites**).
15. **Unresolved:** D1 storage; D12 document type list (not confirmed); D13 expiry (none); D14 verification (none); D15 retention of replaced versions.
16. **Recommendation:** **blocked on D1** for any upload. Metadata model can be designed now but do not migrate until D1 is answered.

### 3.13 Other Documents (`hr/Other.tsx` 653 lines)

1. **Location:** RTDB `hr/documentFolders`, `hr/documents`; Cloudinary.
2. **Data:** folder `{ folderName, type: attendance|salary|esi|pf|other, createdAt }`; document `{ folderId, filename, url, uploadedAt, uploadedBy }`.
3. **Workflow:** create folder → upload into a folder (folder required). Image vs raw file routed to different Cloudinary endpoints. Size check before upload (`:118`). Filter by date.
4. **Calculations:** none.
5. **Meaning:** a company-wide document library **organised by HR category** (attendance, salary, ESI, PF). It is **not** employee-scoped. The category names overlap with payroll outputs, but nothing links a document to a payroll run.
6. **Production:** none. The architecture's `vault` (documents, document-folders, document-access-grants) is the closest target design and is paused.
7. **Reuse decision:** do not build a second vault. Decision D16: whether this is the paused `vault` module or an HR-only library.
8. **Required backend:** depends on D1 and D16. Folder model plus document metadata, with access grants.
9. **APIs:** `GET/POST /hr/document-folders`, `GET/POST /hr/document-folders/:id/documents`.
10. **Permissions:** `hr.document_folder.read|write`, `hr.document.read|write`.
11. **Audit:** upload, delete (as status), access grant.
12. **Scope:** organization-wide with folder type restriction (decision D17: who may see `salary`/`pf` folders).
13. **Dependencies:** D1, D16.
14. **Confirmed rules:** folder required before upload; five folder types.
15. **Unresolved:** D1, D16, D17.
16. **Recommendation:** **blocked** on D1, D16, D17. Do not build.

### 3.14 Salary Report (`SalaryReport.tsx` 440 lines)

1. **Location:** `modules/hr/SalaryReport.tsx`; reads `hr/attendance`, `hr/holidays`, `hr/employees`.
2. **Data:** report rows computed from attendance + holidays + employee salary master. **Does not read any saved payroll run.** It recomputes.
3. **Workflow:** select month and filters, compute, totals, export to XLSX.
4. **Calculations:** `perDay`, `presentPay`, `halfDayPay = half × perDay/2`, `holidayPay = holidayDays × perDay`, `totalEarnings = presentPay + halfDayPay + holidayPay`, PF and ESI as §2.1 and §2.2 (third variant), `netPayable = totalEarnings − pf − esi` (`:195`). Rounding to 2 dp everywhere. **Net here excludes loans, ldPay and arrears — differs from Payroll.**
5. **Production:** none.
6. **Required backend:** **must read payroll source-of-truth** (master prompt). Production has no payroll. So this report is **blocked** on payroll. Recomputing it independently (as legacy does) would duplicate and diverge from Payroll — an intentional deviation to refuse.
7. **Models:** none (report only).
8. **APIs:** `GET /hr/reports/salary?month=&teamId=&departmentId=` — **blocked**.
9. **Permissions:** `hr.salary_report.read` (new, blocked).
10. **Audit:** report export is a sensitive read; decision D11.
11. **Scope:** `.team`/`.all`.
12. **Dependencies:** Payroll (missing), Attendance (existing), Holiday (existing).
13. **Unresolved:** SR1 which net is authoritative (Payroll vs Salary Report disagree); SR2 whether the report includes loan/ldPay/arrears; SR3 PF rounding (see §2.1).
14. **Recommendation:** **blocked on payroll.** Do not build a parallel calculator.

### 3.15 HR Dashboard (`HRDashboard.tsx` 1,100+ lines)

1. **Location:** `modules/hr/HRDashboard.tsx`; reads `hr/tickets`, `hr/expenseRequests`, `hr/employees`, `interviewSchedule`, `offerLetters`, `hr/recruitment/candidates` (dead), `hr/attendance`, `todos/hr`, `hr/payrollCredited/{month}`, audit logs.
2. **Metrics observed:** Present Today, Absent Today, On Approved Leave (donut), total employees, Recruitment pipeline funnel (`Applied/Sched.`, `Interviewed`, `Selected`, `Offered`, `Hired`), quick actions (Add Employee, Attendance, Approve Leaves, Run Payroll, HR Tickets, Expense Claims), leave-type breakdown, weekday absence, events, to-do list, recent activity.
3. **Calculations:** pipeline counts from interview statuses (`scheduled`, `completed`, `selected`) and offer count; `Hired` and `Offered` derived from offers/candidates — `Hired` has **no writer** (always 0). Donut percentages = `count / totalEmployees`.
4. **Production:** Attendance summary, leave summary, employee counts all exist via reports and lists. No dashboard endpoint.
5. **Required backend:** aggregate endpoints only, each **defined by a confirmed metric**:
   - Employees by status (existing data).
   - Today's attendance status counts (existing Attendance calc).
   - Leave on date (existing LeaveRequest).
   - Pending counts: attendance corrections, leave requests, tickets, expense claims, exit requests, loans.
   - Recruitment funnel: interviews by status (**no offer funnel stages beyond counts**).
6. **Dead or blocked metrics:** `Hired`, the `candidates` pipeline (dead), **payroll-credited month status** (blocked on payroll), **Run Payroll** action (blocked).
7. **Models:** none. Views or queries.
8. **APIs:** `GET /hr/dashboard/summary` returning only confirmed metrics, with a per-metric `available: false` flag where blocked.
9. **Permissions:** `hr.dashboard.read` (new), with per-metric gating on the underlying read permissions so a user never sees a metric they could not query directly.
10. **Audit:** none (read).
11. **Scope:** `.team`/`.all`.
12. **Dependencies:** all modules above.
13. **Unresolved:** DB1 whether metrics are scope-filtered for `.team`; DB2 "to-do" source (`todos/hr`) — no production equivalent; DB3 events source (not read).
14. **Recommendation:** implement the confirmed-metrics endpoint after the feature modules it aggregates. Do not expose `Hired` or pipeline counts beyond interview status until recruitment is decided.

### 3.16 Docs/HR_API.md (production, 204 lines) — reviewed

- Covers: conventions, audit, master data, employees, shift assignments, calendar, leave (incl. self-service). Permission catalogue (43 codes). Data model (13 new tables). Not-built list. Error codes. **Attendance is essentially absent** (one passing mention); its routes, permissions and tables are documented only in the `ATTENDANCE_*` docs, and self-service profile is not listed.
- **Action needed:** add a section (or cross-link) for attendance and self-service profile; it is not yet in `HR_API.md`. Not done in this phase (documentation-only change deferred to the implementation phase).
- Accurate on what it claims. Claims "implemented and tested; not merged" — consistent with `git status`.

---

## 4. Cross-checks of already-discovered areas

| Area                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employees**          | Production is richer than legacy: lifecycle transitions, reporting-line cycle check, version field, employee code. Legacy `hr/employees` is a flat mutable record. **Intentional deviation:** production keeps history (`EmployeeStatusHistory`).                                                                                                                                                                                                                                                                                                                                                          |
| **Profiles**           | Legacy profile = the `hr/employees` record plus `BankDetails.tsx` (bank fields written to the employee). Production has `self-service/profile` (read only) and `employee_account.write`. **Not fully audited:** `BankDetails.tsx`, `Profile.tsx`, `EmployeeProfileView.tsx`. Field list still needed (PR1). Bank account numbers are sensitive — require masking and a separate permission (D6).                                                                                                                                                                                                           |
| **Location Privilege** | **Resolved.** `hr/locationPrivilege/{employeeKey}` is `'office' \| 'remote'`, set in `Shifts.tsx`, read by `attendanceService.ts:157–175` and `EmployeePortalLayout.tsx:92`. Semantics: a `remote` employee is exempt from the office-Wi-Fi (public IP) check on check-in/out; default is `office`. It also gates mobile portal access per the comment. Production: **no equivalent**. Attendance already has a geofence concept? **Not verified** in production; see PR2. Implementation: `Employee.attendanceLocationMode` enum, reusing Attendance's punch guard. Requires D18 (portal-gating meaning). |
| **Leaves**             | Legacy: `hr/leaveApplications`, `hr/leaveBalances`, `hr/leavePolicy`. Production: requests, leave types, entitlements, balances (accrual, carry-forward, pending holds, enforcement), half-days, cancel and resubmit, Attendance `ON_LEAVE`/`HALF_DAY`. Differences by design: working days (not calendar days) consume balance; paid leave is enforced (legacy only gated the UI); legacy default quotas are not seeded. Every rule and open item: [HR_LEAVE.md](HR_LEAVE.md).                                                                                                                            |
| **Holidays**           | Legacy `hr/holidays` read by Salary Report and Attendance. Production Holiday model exists with `HOLIDAY_DATE_TAKEN`. Consistent. Scope (per-location) remains undecided.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Attendance**         | Production is authoritative; legacy attendance is consumed by Salary, Bonus, Payroll, Esi, Pf. Regularization (§3.4) is the only write path that legacy takes into Attendance. Production handles it transactionally.                                                                                                                                                                                                                                                                                                                                                                                      |
| **Privilege Manager**  | Legacy `settings/privileges` is a per-role module list (`ALL_MODULES` list, `DEFAULT_PERMISSIONS`). Production has the catalogue, roles, and scopes. **Intentional deviation** confirmed. The legacy `ALL_MODULES` list includes `projects`, `expenses`, `documents`, `crm` — several of which are paused in production.                                                                                                                                                                                                                                                                                   |

---

## 5. Unresolved business decisions (blocking)

Items are grouped so the owner can answer in one pass. **Nothing listed here is implemented.**

**Payroll and statutory (blocks §3.7 EMI credit, §3.14, dashboard payroll metrics, bonus):**

- P1. ESI eligibility basis: master gross vs prorated; whether the per-entry flag overrides master applicability (§2.2).
- P2. PF rounding: 2 dp vs whole rupee vs approximation in Salary Report (§2.1).
- P3. Employer PF and ESI contributions: not computed in legacy. Required?
- P4. PF/ESI wage ceilings: none in legacy. Does a ceiling apply?
- P5. Bonus `< 30 days → one month's gross` fallback and `TOTAL_DAYS` definition (§2.4).
- P6. `ldPay` semantics (§2.3).
- P7. Payroll approval chain and lock rule.
- P8. Which net is authoritative (Payroll vs Salary Report) (§3.14).
- P9. Whether Salary Report includes loan deduction, ldPay and arrears.
- P10. Bonus approval and payment status (none observed).

**Loans (blocks EMI credit only):** L1 override authority; L2 net-after-EMI enforcement; L3 EMI-skip rules; L4 interest (none observed; confirm); L5 who disburses; L6 treatment of remaining balance on exit.

**Recruitment (§3.1–3.3):** R1 whether `no_show`/`selected` are terminal; R2 whether offer `Sent`/`Accepted` are needed (dead in legacy); R3 whether an offer converts to an employee (none in legacy — confirm this is not expected); R4 who may see offer salary.

**Exit (§3.8):** E1 transition map; E2 whether `completed` deactivates the employee (legacy does not); E3 notice-period policy; E4 clearance and asset return (no evidence); E5 final settlement (no evidence).

**Tasks (§3.9):** T1 **reuse vs dedicated** (decided in §6, pending confirmation); T2 reversal of `cancelled`; T3 who may cancel; T4 employee reopening `done`; T5 is `dueDate` mandatory.

**Tickets (§3.10):** K1 category list; K2 employee editing after `in_progress`; K3 reopening `closed`; K4 SLA (none); K5 attachments.

**Expenses (§3.11):** X1 reimbursement path (none); X2 receipt storage; X3 amount-based approval limits (none); X4 self-approval rule (production must forbid).

**Work logs (§3.5):** D9 approver = reporting manager or HR; hour caps; lock after approval.

**Documents (§3.12–3.13):** D1 **storage** (Cloudinary is legacy-external; production has none — blocks all document uploads); D11 sensitive-download audit; D12 document type list; D13 expiry; D14 verification; D15 retention of replaced versions; D16 vault vs HR-only library; D17 folder-level visibility of salary/PF folders.

**Org chart (§3.6):** D10 vacant slots (`orgSlots`) needed?

**Location privilege (§4):** D18 **resolved**: the setting controls attendance punches only, the office list is organization data, and the portal is not gated. Open items are in §12.5.

**Cross-cutting:** D7 notification channel (none in production); D6 salary and bank-field permission; D4 offer/revision rendering location.

---

## 6. Task / projects reuse decision

**Finding:** the "paused projects tables" do not exist in this checkout. `schema.prisma`, `packages/database/prisma/migrations/`, and `apps/api/src/modules/` contain no `project`, `task`, `vault`, or `expense` model or module (verified). `Docs/ARCHITECTURE.md` §5 describes them as a **target design** (`projects`, `project_members`, `tasks` with `parent_task_id`, `assignee_id`, `status_id`, `due_date`; `task_comments` via generic `comments`). The generic `comments`, `attachments`, `approvals`, `statuses` tables it relies on are also not implemented (F6).

**Semantic fit:** legacy HR tasks have no project, use admin approval of completion, support employee-originated requests, and carry priority. The architecture's `tasks` assumes a project parent. Forcing HR tasks into it would require either a fake project per task or a nullable project FK that the design does not contemplate.

**Decision (recommended, pending owner confirmation T1):** **create dedicated `hr` task entities** (`hr.task`, `hr.task_event` append-only for history). Do not create `projects`. Do not create generic `comments`/`attachments` for this feature. Rationale: (1) no reusable tables exist; (2) the semantics differ; (3) the architecture's projects design is paused and should not be built to satisfy HR. If the owner later builds the projects module, HR tasks can be linked by an optional `project_id` added in a new migration, which is a non-destructive future change.

**Not yet decided:** whether the architecture's generic `approvals` table should back HR task approval instead of a status field. Recommend a status field for now (simpler; legacy has only a boolean).

---

## 7. Recruitment workflow decision

**Verified legacy workflow (all three legs):**

1. **Interview:** schedule (candidate name as text, role, interviewer as text, date, time, mode) → status change to `completed`, `selected`, `rejected`, or `no_show` → selected interviews counted on the dashboard. Hard delete.
2. **Offer:** generate from candidate name, role, location and four salary components → saved as `Generated` → shared out (Gmail / WhatsApp / mail / PDF). No state transition in practice.
3. **Revision:** issue a salary-revision letter for an existing employee (optionally linked by `employeeRecordId`). Does not change the employee's stored salary.

**Not supported by evidence:** requisition, candidate master, application, stage pipeline, offer approval, offer acceptance, candidate-to-employee conversion. The dashboard's `hr/recruitment/candidates` read has no writer (dead, F4).

**Decision:** implement **interview, offer letter, and revision letter as three record types**, with candidate identity as a text snapshot plus an optional `Employee` link where one exists. **Do not** build a candidate or requisition table. **Do not** build conversion. Revisit only if the owner supplies a legacy-backed or new requirement.

---

## 8. Module readiness summary

| Module                           | Readiness                                                       | Reason                                          |
| -------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Interview                        | **Ready** (after R1 default: free transitions, matches legacy)  | Verified workflow.                              |
| Offer letter                     | **Ready** for generate/list/revision; `Sent`/`Accepted` **not** | R2 open.                                        |
| Revision letter                  | **Ready** as record only                                        | Must not update salary.                         |
| Regularization                   | **Reuse existing**                                              | Gap (a) to verify, not build.                   |
| Work logs                        | **Ready after D9**                                              | Approver rule.                                  |
| Org chart (read, direct reports) | **Ready**                                                       | Uses existing `reportsToId`.                    |
| Org chart (vacant slots)         | **Blocked** on D10                                              |                                                 |
| Location privilege               | **Ready** (D18 resolved; see §12)                               | Attendance punch gate; portal not gated.        |
| Loans (request, approve, ledger) | **Ready**                                                       |                                                 |
| Loans (EMI credit)               | **Blocked** on payroll                                          |                                                 |
| Exit requests (lifecycle)        | **Ready** with E1 default                                       |                                                 |
| Exit completion → deactivation   | **Blocked** on E2                                               |                                                 |
| Clearance / final settlement     | **Blocked** — no legacy rules                                   |                                                 |
| Tasks                            | **Ready** — dedicated `hr` tables                               | §6.                                             |
| Tickets                          | **Ready** (no attachments)                                      | K1 default: free category text.                 |
| Expense claims                   | **Ready** (no reimbursement)                                    |                                                 |
| Employee documents               | **Blocked** on D1                                               | Storage.                                        |
| Other documents / vault          | **Blocked** on D1, D16, D17                                     |                                                 |
| Payroll, PF, ESI, Bonus          | **Blocked** on P1–P10                                           |                                                 |
| Salary report                    | **Blocked** on payroll                                          |                                                 |
| Dashboard                        | **Partial** — confirmed metrics only                            | After the modules it aggregates.                |
| Profiles                         | **Partial**                                                     | Field audit of `BankDetails.tsx` pending (PR1). |
| Privilege manager                | **Ready** — catalogue-based                                     | Intentional deviation.                          |

---

## 9. Pending audit items (not yet read)

- PR1: `BankDetails.tsx`, `Profile.tsx`, `EmployeeProfileView.tsx` (profile fields).
- PR2: production attendance geofence and `applyCorrection` `regularized` marker.
- Loans: `SkipEmiRequest` workflow (`Loans.tsx:58`).
- `RevisionLetterTemplate.ts` full field list.
- `Holiday.tsx`, `Leaves.tsx` cross-check against production leave model.
- `hr/otRates` and `Shifts.tsx` (OT rate source).
- `EmployeeOnboardingForm.tsx` (`hr/employeeOnboarding` token flow, referenced by Employees).
- Interview/Offer: `ResponsivePreviewContainer` and share helpers (presentation only, low priority).

---

## 10. Recruitment — implementation status

**Scope (per the brief):** Recruitment = the three legacy record types only: Interview Schedule, Offer Letter, Revision Letter. No candidate, requisition, application, stage or ATS entity was built.

**Result: complete for the three legacy record types**, backend only. Interview and Offer were unblocked by the owner's decision in §10.3. Revision Letter was kept as built, with one security correction (R4, §10.5).

### 10.1 Legacy sources (read-only, `D:\New folder\TexaWave_ERP`)

| Record             | Files                                                                                                             | Storage path             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Recruitment shell  | `src/modules/hr/Recruitment.tsx`                                                                                  | — (three tabs)           |
| Interview Schedule | `src/modules/hr/InterviewSchedule.tsx` (416 lines)                                                                | RTDB `interviewSchedule` |
| Offer Letter       | `src/modules/hr/OfferLetter.tsx` (977), `OfferLetterTemplate.ts` (679)                                            | RTDB `offerLetters`      |
| Revision Letter    | `src/modules/hr/RevisionLetter.tsx` (894), `RevisionLetterEmployees.tsx` (296), `RevisionLetterTemplate.ts` (635) | RTDB `revisionLetters`   |
| Routes             | `src/App.tsx:865` — `revision-letter/:id` is the **only** route, so a revision always names an employee           | —                        |

### 10.2 Verified legacy behaviour

**Revision Letter.** Reached from an employee picker; the form prefills from the employee and writes `employeeRecordId`, `employeeCode`, `employeeName`, `designation`. Fields: `documentNo`, `letterDate`, `effectiveDate` (default 1st of next month), `location` (default `Chennai`), `basic/da/hra/ca`, signatory name/designation (defaults `Amanullah Khan` / `Co-Founder`), company contact constants, signature and seal images. Document number `TW/HR/REV/{FY}/{NNN}`, FY April–March, counter = max existing + 1, computed in the browser; assigned once, kept on edit. Status is written as `Generated` only. Edit overwrites in place. Delete per record and per employee. Monthly = `basic+da+hra+ca`; annual = ×12. Issuing does **not** write to `hr/employees`.

**Offer Letter.** Saved as a full snapshot of form inputs with `status: 'Generated'` only; `Sent`/`Accepted` are declared in the type but never assigned (dead). Edit overwrites. Delete via the actions menu. The candidate is free text. The saved record has **no employee reference**: the `:id` route only prefills and is not persisted. No link to revision letters.

**Interview Schedule.** Free-text candidate, role, interviewer, date, time, mode (`online|in_person|phone`), notes. Status is `scheduled` on create and may be set to any of `scheduled|completed|selected|rejected|no_show` with no transition guard (every transition is a plain `update`). Only status changes; there is **no reschedule and no edit** of date, time or other fields. Delete exists. No candidate or interviewer id.

**Dead read.** `HRDashboard.tsx` reads `hr/recruitment/candidates`; nothing in the legacy repo writes it (§1 F4). Not used.

### 10.3 Decision — Interview and Offer scope (owner, applied)

Legacy stores no employee or team owner for Interview or Offer records, so the team-scope rule has nothing to scope by. Per the owner's decision, both are implemented as **explicit organization-wide, exact-name permissions**: `hr.interview.read|write` and `hr.offer_letter.read|write`. This is a documented exception to `CLAUDE.md` / `Docs/CODING_STANDARDS.md` §10a. Access is still authenticated, organization-isolated, restricted to roles granted these permissions, and audited. They are not granted to Employee or Team Lead by default; HR Manager holds them.

### 10.4 What was built

| Item             | Production artefact                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entities         | `RevisionLetter` → `hr.revision_letters`; `Interview` → `hr.interviews`; `OfferLetter` → `hr.offer_letters` (all schema `hr`)                                                                                                 |
| Migrations       | `20261005091018_add_hr_revision_letters`; `20261005091037_revision_letter_checks`; `20261005094302_add_hr_recruitment_interviews_offers`; `20261005094318_recruitment_checks`                                                 |
| Constraints      | Revision: `UNIQUE (organization_id, document_no)`, status `GENERATED`, components ≥ 0. Interview: status ∈ five legacy values, mode ∈ three legacy values, time `HH:MM`. Offer: status `GENERATED`, components ≥ 0            |
| Document counter | Revision reuses `platform.document_sequences` (doc type `hr_revision_letter_{FY}`), same lock model as `issueEmployeeCode`                                                                                                    |
| Modules          | `apps/api/src/modules/hr/revision-letters/`, `interviews/`, `offer-letters/` — controller, service, repository, DTOs; revision and offer also have pure `*.rules.ts`                                                          |
| Routes           | see `Docs/HR_API.md` (Recruitment sections)                                                                                                                                                                                   |
| Permissions      | `hr.revision_letter.{read,write}.{own,team,all}` (team-scoped); `hr.interview.{read,write}` and `hr.offer_letter.{read,write}` (org-wide, exact name). HR Manager holds `.all` for revision and all four org-wide permissions |
| Wiring           | `RevisionLettersModule`, `InterviewsModule`, `OfferLettersModule` imported in `app.module.ts`                                                                                                                                 |

### 10.5 Scope, audit and R4 (salary sensitivity)

- **Revision scope:** team-scoped through the employee. Out of scope = **404** on read/edit; **422 `INVALID_EMPLOYEE`** on create for an employee outside scope. `.own` write → 403 (reserved).
- **Interview and offer scope:** organization-wide by explicit permission (§10.3). Organization isolation: another organization gets **404** and sees nothing in lists.
- **Audit:** `entity_type` ∈ `revision_letter`, `interview`, `offer_letter`; actions `create`, `update` (interview: `status_change`). Written in the same transaction as the change; actor from the JWT.
- **R4 — decision and rule:** salary amounts are **not** written to the audit trail, for revision or offer letters. `audit.log.read` is a generic platform permission; it must not expose salary by accident. The audit records:
  - on create: non-salary terms only (ids, dates, role/designation, status);
  - on update: the changed field **names** in `changedFields` (for example `["ca", "designation"]`), never values.

  Amounts remain readable through the record's own permission (`hr.revision_letter.read` team-scoped; `hr.offer_letter.read` organization-wide). The global audit framework and its permission model were not changed. This is the narrowest rule available in the existing architecture. It also keeps candidate names out of the trail (personal data), as leave reasons already are.

- **Edit semantics:** legacy overwrites in place. Production also overwrites in place; the audit's field-name list shows what changed. Append-only versions (suggested in §3.2) are **not** adopted.

### 10.6 Deviations and omissions from legacy (deliberate)

| Legacy                                                       | Production                                                                                  | Reason                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Delete (interview, offer, revision; history menu / picker)   | **Not built**                                                                               | Platform rule: no DELETE route (`HR_API.md` §1). Owner decision pending.                                         |
| Interview reschedule / field edit                            | **Not built**                                                                               | Legacy has no such action (only status changes).                                                                 |
| Signature and seal images (data URLs in the record)          | **Not stored**                                                                              | No file storage exists in production (D1).                                                                       |
| PDF / HTML render, share by Gmail/WhatsApp/mail              | **Not built**                                                                               | Backend only (brief). Rendering location is open (D4).                                                           |
| Company contact constants on each record                     | **Not stored as a per-record snapshot** for revision; **stored** for offers (full snapshot) | Offer legacy record holds the full form; revision legacy holds constants that are not user-editable in the form. |
| Salary split 35/15/30/20 from an amount                      | **Not enforced**                                                                            | UI convenience; components stored as given.                                                                      |
| Client-supplied employee name (revision)                     | **Derived from the employee**                                                               | Identity from the record.                                                                                        |
| Offer `Sent` / `Accepted`; revision and offer status changes | **Not built**                                                                               | Unreachable in legacy (R2). `GENERATED` only, enforced by CHECK.                                                 |
| Interview: free-text status any-to-any                       | **Built as legacy**                                                                         | Legacy has no guard; no invented transition rule.                                                                |
| Offer `:id` prefill saved as employee reference              | **Not saved**                                                                               | Legacy does not persist it.                                                                                      |

### 10.7 Tests

| Layer                    | File                                            | Count | What it proves                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — revision rules    | `revision-letters.rules.spec.ts`                | 12    | FY boundaries, numbering format, default effective date, exact decimal gross                                                                                                                                                                                                                                                                                  |
| Unit — revision service  | `revision-letters.service.spec.ts`              | 8     | scope; `.own` write refused; legacy defaults only on create; partial update sends only named fields; not-found                                                                                                                                                                                                                                                |
| Unit — interview service | `interviews.service.spec.ts`                    | 6     | ONLINE default; notes null when empty; status passed through incl. current value; not-found; filter forwarding                                                                                                                                                                                                                                                |
| Unit — offer rules       | `offer-letters.rules.spec.ts`                   | 4     | validity = offer date + 7 days across month and year boundaries                                                                                                                                                                                                                                                                                               |
| Unit — offer service     | `offer-letters.service.spec.ts`                 | 5     | every prefill applied; supplied values win; partial update never touches status; not-found                                                                                                                                                                                                                                                                    |
| E2E — revision           | `apps/api/test/hr-revision-letters.e2e-spec.ts` | 40    | 401/403 matrix; create and defaults; persistence; audit with **no salary amounts**; 6 concurrent issues → unique contiguous numbers; 422 unknown and cross-org; validation; all/team/own scope; list, pagination, 404; no delete; edit recalculates gross, keeps number, changedFields only; DB CHECK and unique                                              |
| E2E — interview          | `apps/api/test/hr-interviews.e2e-spec.ts`       | 31    | 401/403 incl. team lead; org-wide permission; create with ONLINE default; persistence; audit without candidate name; 10 validation cases; search and status filter; any-to-any status incl. same value; one audit row per change with before/after; org isolation 404; no edit/delete route; DB CHECK on status, mode, time                                   |
| E2E — offer              | `apps/api/test/hr-offer-letters.e2e-spec.ts`    | 31    | 401/403 incl. team lead; prefills and full snapshot; no employee/revision reference; persistence; audit with **no candidate name and no amounts**; 11 validation cases incl. status refused; edit recalculates; status cannot change and no status route; update audit with field names only; isolation; search; no delete; DB CHECK on status and components |

Counts were verified against the test runs recorded in the completion report.

### 10.8 Unresolved

- **U2 Delete** — legacy has it on all three records; platform forbids DELETE routes; undecided.
- **U3 Revision and offer approval / signing** — none in legacy; none built.
- **U4 Document rendering and images** — D1 (storage) and D4 (rendering location).
- **U5 "Today" time zone** — defaults use the server's UTC date; legacy used the browser's local date. For India (UTC+5:30) a record created shortly after midnight IST gets the previous day's date and possibly the previous financial year's revision number. Needs a decision.
- **U6 Revision scope for team leads** — `read.team`/`write.team` are granted to no default role (same open decision as leave and attendance).
- **R4 (applied, owner review recommended)** — salary is withheld from the audit trail (§10.5). Whether HR Manager should also see amounts through audit, and whether offer amounts need their own permission (`hr.offer_letter` currently covers the whole record), is a policy question for the owner.
- **Interview/offer org-wide exception** — documented here and in `HR_API.md`. `Docs/CODING_STANDARDS.md` §10a was not edited; the owner should decide whether to record the exception there.

---

## 11. Profiles — legacy discovery and implementation status

**Scope (per the brief):** HR → Profiles only. Legacy: `BankDetails.tsx`, `Profile.tsx`, `EmployeeProfileView.tsx`, with the field evidence from `EmployeeForm.tsx` (HR create/edit) and `employee/SelfOnboarding.tsx` (employee self-submission). Not discovered further.

### 11.1 Legacy sources (read-only, `D:\New folder\TexaWave_ERP`)

| File                                           | Role                                                                                    | Storage                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/modules/hr/Profile.tsx` (370)             | Directory: all employees, search, department filter, XLSX "Export Master Data"          | RTDB `hr/employees` (read)                                              |
| `src/modules/hr/EmployeeProfileView.tsx` (734) | Full profile page; **Approve Onboarding & Set Salary** modal                            | RTDB `hr/employees/{id}` (read + write); `logEmployeeAudit`             |
| `src/modules/hr/BankDetails.tsx` (130)         | Read-only bank and statutory table; CSV export                                          | RTDB `hr/employees` (read)                                              |
| `src/modules/hr/EmployeeForm.tsx`              | HR create/edit form for the same fields                                                 | RTDB `hr/employees`                                                     |
| `src/modules/employee/SelfOnboarding.tsx`      | Employee self-submits personal, family, address, experience, bank and statutory details | RTDB `hr/employees/{key}` and `users/{key}` (write); `logEmployeeAudit` |

### 11.2 Verified fields

**Personal:** title, name, initial, dob (`dateOfBirth`), gender, marital status, blood group, languages (list).
**Family:** father name, mother name, spouse name (SelfOnboarding also captures father/mother/spouse phone numbers; the profile view does not show them — **unresolved**, not implemented).
**Emergency contact:** name, phone, relationship.
**Addresses (two, same shape):** `address`, `area`, `district`, `city`, `state`, `pincode`, `country`; `sameAsCurrentAddress` flag at submission.
**Experience:** fresher flag, total years (legacy mixes `'0'` strings and numbers), previous company, previous role.
**Sensitive identifiers:** PAN, Aadhaar, ESI number, PF number, bank name, bank account number, IFSC, branch.
**Not profile (out of scope):** salary (`monthlySalary`, `salary.*`, `allowances`, `pfApplicable`, `esiApplicable`), status (`Active`), `onboardingStatus`, document URLs, profile photo, `officeType`, `referredBy`.

### 11.3 Read and write behaviour

- **Reads:** `Profile.tsx` and `BankDetails.tsx` read the whole `hr/employees` collection client-side and filter in memory. No server-side scope or permission. `EmployeeProfileView` reads one record.
- **Writes, legacy:**
  1. HR create/edit (`EmployeeForm.tsx`) writes the profile fields, including PAN, Aadhaar and bank, to the employee record. Legacy has no approval step.
  2. **Approve Onboarding** (`EmployeeProfileView.tsx`) writes `monthlySalary`, `allowances`, `salary`, `pfApplicable`, `esiApplicable`, `onboardingStatus: 'Onboarding Complete'`, **`status: 'Active'`**, and audits the action.
  3. **Self-onboarding** (`SelfOnboarding.tsx`) writes all profile and sensitive fields to the employee's own record with `onboardingStatus: 'Details Submitted'`, and also writes `onboardingStatus` and `phone` to `users/{key}`. The audit text says "for HR review", but the write is live: there is **no review gate**.
- **Validation:** legacy has a step-by-step form with client-side checks only. No server validation exists.
- **Audit:** `logEmployeeAudit` (free text, client-side), not transactional, values included.

### 11.4 Production equivalent

| Legacy field group                                                      | Production                                                                                                              | Decision                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Name, email, phone, joining date, department, team, designation, status | `hr.employees` (`fullName`, `workEmail`, `phone`, `dateOfJoining`, `teamId`, `departmentId`, `designationId`, `status`) | **Reused.** Not duplicated.                                                          |
| Personal, family, emergency, addresses, experience                      | none                                                                                                                    | **New table** `hr.employee_profiles` (1:1 employee)                                  |
| PAN, Aadhaar, ESI, PF, bank                                             | none (`HR_API.md` §6: "employee sensitive-PII table" not built)                                                         | **New table** `hr.employee_sensitive_info` (1:1 employee), per `ARCHITECTURE.md` §10 |
| Self-service profile                                                    | `GET /self-service/profile` (read of the employee row only)                                                             | Unchanged                                                                            |
| Salary, pay components                                                  | none (payroll not built)                                                                                                | **Excluded**                                                                         |
| Activation (`status: Active`, `onboardingStatus`)                       | lifecycle service exists (`status` transitions); **activation/password setup not built**                                | **Excluded**                                                                         |

### 11.5 Conflicts with HR security rules (reported; not implemented)

1. **Self-service write of bank and identity data without an HR gate** (`SelfOnboarding.tsx`). Changing one's own bank account controls where salary is paid, so it needs HR approval before it takes effect. Production's rule (`ARCHITECTURE.md` §10, `HR_MODULE_REPOSITORY_ANALYSIS.md`) is that PII changes are narrowly permissioned and audited. **Not implemented.** Owner decision: whether employee self-service may submit sensitive details at all, and whether they are staged for HR approval.
2. **Approve Onboarding sets salary and activates the employee** in one unaudited-by-design write. Salary is payroll's domain, and activation is an unbuilt lifecycle decision. **Not implemented.**

### 11.6 Missing legacy functionality (not built)

- Self-service submission (conflict 1).
- Onboarding approval, salary setting and activation (conflict 2).
- Family-member phone numbers (captured by SelfOnboarding, not shown anywhere).
- Documents, profile photo (Documents feature, not started).
- Bank-details CSV export and the masters export (client-side, unaudited in legacy). Production exports are not part of this phase.

### 11.7 Unresolved rules

- **P1** Whether sensitive details are self-editable at all (conflict 1).
- **P2** Who may read sensitive details: `hr.employee_sensitive.read` only, per the architecture. Confirm HR Manager should hold it by default.
- **P3** Whether sensitive values are masked on read. Legacy shows them in full. This implementation returns them to holders of the sensitive permission, audited.
- **P4** `officeType`, `referredBy` meaning and whether they belong to profile.
- **P5** Experience representation (legacy mixes strings and numbers; implemented as a decimal in years).
- **P6** Encryption at rest for sensitive columns. Not implemented; the architecture asks for narrow permissions and audit, not encryption.

### 11.8 Implementation status

**Built (backend):** the personal profile (`hr.employee_profiles`) and the sensitive record (`hr.employee_sensitive_info`), with HR read and partial update routes. Scope, permissions and audit as in `Docs/HR_API.md`.

**Built as legacy, with production guards:** partial updates, explicit `null` to clear, and language normalisation. Legacy had no server-side validation, so the formats listed in `HR_API.md` (PAN, Aadhaar, ESI, bank account, IFSC, pincode, phone, experience range) are **new production rules**, not legacy behaviour.

**Migrations:** `20261005100611_add_hr_employee_profiles` (generated; creates two tables and their foreign keys, no drops); `20261005100630_employee_profile_checks` (experience range and address shape).

**Reused, not duplicated:** name, email, phone, joining date, department, team, designation, status all stay on `hr.employees`.

**Permissions:** `hr.employee_profile.{read,write}.{own,team,all}` (team-scoped). `hr.employee_sensitive.{read,write}` (exact, organization-wide). HR Manager holds all four. Employee and Team Lead hold none by default (see §11.9).

**Tests:** unit 15 (`profiles.rules.spec.ts` 5, `profiles.service.spec.ts` 10); E2E 44 (`apps/api/test/hr-profiles.e2e-spec.ts`), covering the scope matrix, organization isolation in both directions, the sensitive-permission boundary, validation, partial and clearing semantics, audit (field names only; reads audited), DB persistence and DB constraints.

### 11.9 Decisions and open rules (this phase)

- **Sensitive reads return values** to holders of `hr.employee_sensitive.read`, audited (P3). Masking is not applied, to match legacy.
- **HR Manager holds the sensitive permissions by default** (P2). Owner decision to confirm.
- **Team Lead does not hold profile reads by default.** Legacy's team-lead visibility of profile data is not evidenced, so no grant was invented. Owner decision.
- **Own-level profile write is refused.** Self-submission is a reported conflict (§11.5), not built.
- **Organization-wide sensitive boundary** is an exception to the normal team-scope rule, in the same way as Interview and Offer Letter (`HR_API.md`). `Docs/CODING_STANDARDS.md` §10a was not edited.
- **Encryption at rest** for sensitive columns is not implemented (P6).

### 11.10 Still unresolved

- P1 self-submission of sensitive details (conflict §11.5.1).
- Salary and onboarding approval/activation (conflict §11.5.2): payroll and lifecycle owners must decide where they go.
- P4 `officeType` and `referredBy`.
- Family-member phone numbers.
- Documents and photo.

---

## 12. Location Privilege (`modules/hr/location-privilege`)

Scope fixed by the owner: attendance punch only. Portal access is not gated (see 12.3).

### 12.1 Legacy behavior (verified in source, read-only)

Files: `TexaWave_ERP/src/modules/hr/Shifts.tsx` (the screen is titled "Location Privilege"; the file name is misleading. There is no shift screen in the legacy app), `src/services/attendanceService.ts` lines 91–216 (check-in gate), `src/modules/employee/EmployeePortalLayout.tsx` lines 87–120 (portal gate), `src/modules/employee/EmployeeDashboard.tsx` (live "Remote" badge), `src/App.tsx` lines 558–600 (a separate app-wide desktop-only gate that does not read this setting).

- **Storage:** Firebase `hr/locationPrivilege/{employeeKey}` with value `'office' | 'remote'`. Unset means `'office'`. The key is the `hr/employees` push key, which is `user.firebaseKey` after login.
- **Who sets it:** the HR screen, with no per-employee self-service. Whether Firebase security rules stop an employee writing this path directly was **not verified**.
- **Check-in and check-out (`attendanceService.ts`):** `'office'` requires the caller's public IP, from ipify, to equal a hardcoded `OFFICE_PUBLIC_IPS = ['115.96.5.24']`. Otherwise it throws "You must be connected to the office Wi-Fi…" and writes nothing. If the IP lookup fails, it throws "Could not verify your network". `'remote'` skips the check. GPS is captured and never checked.
- **Portal (`EmployeePortalLayout.tsx`):** `'office'` on a device detected as mobile (user-agent, touch and screen-size heuristics) shows "Desktop Access Only". `'remote'` allows mobile. A read error blocks. This is a client-side page gate.
- **Mismatch in legacy:** the screen's copy says Office = "Desktop only" and Remote = "Mobile allowed", which describes the portal gate. The attendance gate is a network rule the screen never mentions. A desktop employee at home is blocked from check-in while their portal works.
- **Not present in legacy:** team or organization scope, an audit trail, and any server-side enforcement.

### 12.2 Decisions (owner, applied)

| #    | Question                         | Decision                                                                                                                                                                                                                                                       |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D18a | What does the setting control?   | **Attendance check-in and check-out only.** The portal is not gated.                                                                                                                                                                                           |
| D18b | Where does the office list live? | **Organization setting** in `hr.office_network_addresses`, managed through the API with audit. The hardcoded `115.96.5.24` is not carried over as data.                                                                                                        |
| D18c | How is the client address read?  | `request.ip` through `TRUST_PROXY_HOPS` (env, default 0). **The production hop count is an open item** (12.5).                                                                                                                                                 |
| D18e | What permission scope applies?   | **Organization-wide.** `hr.location_privilege.read` and `.write` have no own, team or all variants, because legacy has no team dimension and no scope is invented. The service refuses a change to the caller's own employee record.                           |
| D18d | What does an unset employee get? | **Not gated (opt-in).** Legacy treated unset as `office`. Applying that in production would block every check-in until the office address is registered, and existing attendance tests would fail. Owner chose opt-in. Only an explicit `OFFICE` row is gated. |

### 12.3 Production behavior

- `hr.employee_location_privileges`: one row per employee, `mode` in `OFFICE | REMOTE` (CHECK). No row means unset: no restriction (D18d). Organization-wide (no team dimension in legacy; see 12.2).
- `hr.office_network_addresses`: per organization, exact IPv4 or IPv6 match, unique per `(organization_id, ip_address)`, deactivated and never deleted.
- The gate is `LocationPrivilegeService.assertPunchAllowed`, called from `AttendanceService.checkIn` and `checkOut` before any write. A missing row or `REMOTE` returns at once. `OFFICE` needs the request IP on the active list, and is denied with `403 LOCATION_NOT_ALLOWED` otherwise. The denial is fail-closed for an OFFICE employee: unknown IP, empty list, or no match.
- The attendance calculation, sessions, corrections and reports are unchanged. The gate only decides whether a punch may start.
- The client IP is `request.ip`, the same value the audit writer records. `main.ts` sets `trust proxy` to `TRUST_PROXY_HOPS`.

### 12.4 Deliberate differences from legacy

- The office list is data, not a constant. It can hold several addresses and is audited.
- Denied attempts are **not** audited. No state changed, and the audit trail records writes only.
- Denial happens before the duplicate-punch guard. Legacy's order is the same.
- Changing your own employee record is refused (403) whatever permissions you hold.
- The server enforces the rule. Legacy enforced it in the browser.

### 12.5 Open items (blocking production cutover)

- **Office IP is not seeded.** Until HR registers the office address (legacy `115.96.5.24`) through `POST /hr/office-networks`, every employee explicitly set to OFFICE is denied check-in. Unset employees are unaffected. Seeding it is an operational step, not part of this change.
- **`TRUST_PROXY_HOPS` must be set to the real hop count** for the deployment. At 0, a request behind a proxy carries the proxy's address, so office check-ins fail closed. Too high lets a client forge `X-Forwarded-For` and pass the check.
- Portal device gating (legacy's "Desktop Access Only") is **not built**. Whether it is wanted is a separate decision.
- Whether Firebase security rules protected `hr/locationPrivilege` from employee writes was not verified. Irrelevant to production, which has no Firebase path.
- The `Employee.attendanceLocationMode` enum proposed in the §4 cross-check table is **not** used. The setting is a separate table, which keeps the employee record untouched.

### 12.6 Tests

- Unit: `office-network.spec.ts` (IP normalization and matching, fail-closed cases) and `location-privilege.service.spec.ts` (REMOTE vs OFFICE gate, denial cases, own-scope refusal, out-of-scope 404, default vs explicit reads).
- E2E: `apps/api/test/hr-location-privilege.e2e-spec.ts` (23 tests): authorization, team scope, organization isolation, the punch gate with a denied punch that leaves no session, office-list validation and duplicates, audit rows, and no-op writes.
- Regression: the full API unit suite and the full backend E2E suite.

## 13. Holidays — legacy parity and production status

### 13.1 Legacy sources (read-only, `D:\New folder\TexaWave_ERP`)

- UI: `src/modules/hr/Holiday.tsx` (343 lines). Read by `src/modules/hr/SalaryReport.tsx` (`hr/holidays`).
- Storage: Firebase RTDB, `hr/holidays/{YYYY-MM}/{id}`. Fields written: `id`, `date` (`YYYY-MM-DD`), `name`, `departments`, `isRecurring`.
- Not verified in detail: how `Attendance.tsx` consumes holidays (it is listed by grep only).

### 13.2 Verified legacy behaviour

| Area                 | Legacy (`Holiday.tsx`)                                                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create               | Date + name required (client check only). `departments` is always saved as `['All']`. `isRecurring` is always saved as `false`; no UI sets it.                                                                                     |
| Duplicate date       | Saving a date that already has a holiday **replaces** that entry (reuses its id, toast "Holiday Replaced"). Not rejected.                                                                                                          |
| Update               | Edit reuses the id; only `date`, `name`, `departments` are rewritten (departments reset to `['All']`).                                                                                                                             |
| Delete               | Hard `remove` after a `confirm()` dialog. No history kept.                                                                                                                                                                         |
| Filter               | Month picker (`hr/holidays/{YYYY-MM}`); department filter in the list only (`'All'` or a department name).                                                                                                                         |
| Past/future          | No rule. Any date may be entered.                                                                                                                                                                                                  |
| Sundays              | Every Sunday of the selected month is auto-written as an attendance record with status `Holiday` (note `Auto: Sunday Holiday`) for each active employee, unless that employee already has an attendance record for the date.       |
| Holiday → attendance | On month load, `applyHolidaysToAttendance` **writes** `status: 'Holiday'` records into `hr/attendance/{date}/{employeeId}` for each holiday that applies to the employee's department (or `All`), again skipping existing records. |
| Consequence          | Records written once stay in attendance. Changing or deleting a holiday later does not revise them. Holiday status is stored data, not derived.                                                                                    |
| Timezone             | Date parsing mixes `new Date('YYYY-MM-DD')` (UTC) and local `new Date(y, m, d)`. The code comments say the local form was adopted to fix a Monday-as-Sunday shift.                                                                 |

### 13.3 Production behaviour (as implemented)

- Model `hr.holidays` (`schema.prisma` `Holiday`); migration `20260930104120_add_hr_calendar`. Date is `DATE`; `name` must be non-blank; partial unique indexes allow one active holiday per `(organization, date)` for the whole organization and one per `(organization, date, work_location)` for a location.
- Scope is the **work location**, not department. Legacy department scope is not carried over (see 13.4).
- API: `apps/api/src/modules/hr/holidays` — list (by `year` or `from`/`to`, `workLocationId`, `organizationWide`, `isActive`), get, create, patch (`name`, `description` only), `deactivate` / `activate`. No DELETE: a wrong entry is deactivated and re-entered. Date and location scope are immutable. Duplicate active date+scope returns 409 `HOLIDAY_DATE_TAKEN`.
- Permissions: `hr.holiday.read` (list/get, and `GET /hr/calendar/day`) and `hr.holiday.write` (create/update/activate/deactivate). Reads are organization-scoped reference data, not team-scoped.
- Audit: `holiday` entity with `create`, `update`, `activate`, `deactivate`. Snapshots contain date, name, description, location id and active flag only.
- Calendar resolution is shared: `apps/api/src/modules/hr/calendar/calendar.repository.ts` returns the holidays that apply to an employee on a date (organization-wide plus the employee's location) together with the weekly-off rules. Attendance and Leave use it. Holidays are never written into attendance rows.
- Tests: `holidays.service.spec.ts` (unit); `calendar.service.spec.ts` (unit); `test/hr-calendar.e2e-spec.ts` (E2E: authorized and unauthorized list, create, update, deactivate/activate, duplicate date, organization isolation, location scope, weekly-off coexistence). Attendance, Leave and Full Month Present regressions are covered by their own E2E suites.

### 13.4 Deliberate differences from legacy

1. **Holidays are derived, not written.** Legacy wrote `Holiday` into attendance; production never writes holiday attendance. Editing a holiday changes reports and Leave day counts immediately, and stored attendance is left alone. This matches the Attendance calendar-precedence design.
2. **No department scope.** Production scopes holidays to a work location or the whole organization.
3. **Duplicates are rejected (409), not replaced.** Legacy silently replaced the entry for that date.
4. **No hard delete.** Deactivate and re-enter keeps history.
5. **No automatic Sunday holiday.** Production has no default weekly off. A weekly-off rule must be created (`weekly-off-rules`). Legacy assumed every Sunday was off.
6. **`isRecurring` is not implemented.** Legacy always stored `false` and had no UI for it. Recurring holidays are not built.

### 13.5 Unresolved business rules

- Whether a past holiday date may be created or edited after the attendance period is closed. Production currently allows any date, as legacy did.
- Whether holidays should be department-scoped as well as location-scoped (legacy has a department field). Needs an owner decision.
- Whether the legacy `isRecurring` concept should exist at all.
- Whether any existing legacy holiday records must be imported into production. No import exists.
- Whether Sunday weekly-off should be seeded for each organization or left to admins (production: left to admins).
