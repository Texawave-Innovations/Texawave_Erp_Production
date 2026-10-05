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
| **Leaves**             | Legacy: `hr/leaveApplications`, `hr/leaveBalances`. Production `LeaveRequest` exists, no balance model (documented as "not built by decision"). Matches. Legacy balance logic not audited here; leave as-is per HR_API §6.                                                                                                                                                                                                                                                                                                                                                                                 |
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

**Location privilege (§4):** D18 confirm that `remote` exempts the Wi-Fi check and that portal gating is wanted in production.

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
| Location privilege               | **Blocked** on D18                                              | Semantics verified; portal meaning to confirm.  |
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

**Scope (per the brief):** Recruitment = the three legacy record types only (Interview Schedule, Offer Letter, Revision Letter). No candidate, requisition, application, stage or ATS entity was built.

**Result: partial.** Revision Letter is implemented end-to-end on the backend. Interview Schedule and Offer Letter are **blocked** on one permission/scope decision (below) and were not implemented.

### 10.1 Legacy sources (read-only, `D:\New folder\TexaWave_ERP`)

| Record             | Files                                                                                                             | Storage path             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Recruitment shell  | `src/modules/hr/Recruitment.tsx`                                                                                  | — (three tabs)           |
| Interview Schedule | `src/modules/hr/InterviewSchedule.tsx` (416 lines)                                                                | RTDB `interviewSchedule` |
| Offer Letter       | `src/modules/hr/OfferLetter.tsx` (977), `OfferLetterTemplate.ts` (679)                                            | RTDB `offerLetters`      |
| Revision Letter    | `src/modules/hr/RevisionLetter.tsx` (894), `RevisionLetterEmployees.tsx` (296), `RevisionLetterTemplate.ts` (635) | RTDB `revisionLetters`   |
| Routes             | `src/App.tsx:865` — `revision-letter/:id` is the **only** route, so a revision always names an employee           | —                        |

### 10.2 Verified legacy behaviour

**Revision Letter (implemented):**

- Reached from an employee picker (`RevisionLetterEmployees.tsx`); the form prefills from the employee (`hr/employees`) and writes `employeeRecordId`, `employeeCode`, `employeeName`, `designation`.
- Fields: `documentNo`, `letterDate`, `effectiveDate` (default 1st of next month), `location` (default `Chennai`), `basic/da/hra/ca`, signatory name/designation (defaults `Amanullah Khan` / `Co-Founder`), company contact constants, signature and seal images (data URLs).
- Document number: `TW/HR/REV/{FY}/{NNN}`, FY April–March, counter = max existing + 1, computed in the browser (`generateNextDocumentNo`). Assigned once; kept on edit.
- Statuses: `status` is written as `Generated` only. Edit overwrites the record in place (`set`). Delete per record (history menu) and per employee (picker row).
- Monthly = `basic+da+hra+ca`; annual = ×12. Issuing a letter **does not** write to `hr/employees`.

**Offer Letter (not implemented — blocked):**

- Saved as a full snapshot of form inputs with `status: 'Generated'` only; `Sent`/`Accepted` are declared in the type but never assigned (dead). Edit overwrites. Delete via the actions menu.
- Candidate is free text. The saved record has **no employee reference**: the `:id` route only prefills and is not persisted.
- No link to revision letters.

**Interview Schedule (not implemented — blocked):**

- Free-text candidate, role, interviewer, date, time, mode (`online|in_person|phone`), notes.
- Status is `scheduled` on create and may be set to any of `scheduled|completed|selected|rejected|no_show` with no transition guard (every transition is a plain `update`). Only status changes; there is **no reschedule and no edit** of date, time or other fields. Delete exists.
- No candidate or interviewer id.

**Dead read:** `HRDashboard.tsx` reads `hr/recruitment/candidates`; nothing in the legacy repo writes it (see §1 F4). Not used.

### 10.3 Blocking decision — Interview and Offer scope

`CLAUDE.md` and `Docs/CODING_STANDARDS.md` §10a: HR data must not be scoped by `@OrgScoped()` alone. Interview and offer records have **no team and no employee** to scope by. The only organization-wide precedent (`hr.holiday.*`) is a calendar every employee reads; offer rows carry candidate salary, which is not that case. Choosing the permission and scope model is the owner's decision, so these two were not built. Options for the owner:

1. `hr.interview.{read,write}` and `hr.offer_letter.{read,write}`, exact-name, org-wide, with a documented exception to §10a (the holiday precedent), or
2. a scope tied to the interviewer/owning team, which the legacy data does not carry.

Also open: **R4** (who may see offer and revision salary) — see §5.

### 10.4 What was built

| Item                  | Production artefact                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity                | `RevisionLetter` → `hr.revision_letters` (schema `hr`)                                                                                                                                       |
| Migrations            | `20261005091018_add_hr_revision_letters` (generated by `prisma migrate dev`); `20261005091037_revision_letter_checks` (CHECKs Prisma cannot express: `status = 'GENERATED'`, components ≥ 0) |
| Indexes / constraints | `UNIQUE (organization_id, document_no)`; index `(organization_id, employee_id)`; FKs to `platform.organizations` and `hr.employees`                                                          |
| Document counter      | reuses `platform.document_sequences` (doc type `hr_revision_letter_{FY}`), same lock model as `issueEmployeeCode`                                                                            |
| Module                | `apps/api/src/modules/hr/revision-letters/` — controller, service, repository, `revision-letters.rules.ts` (pure), DTOs                                                                      |
| Routes                | `GET/POST /hr/revision-letters`, `GET/PATCH /hr/revision-letters/:id` (see `Docs/HR_API.md`)                                                                                                 |
| Permissions           | `hr.revision_letter.{read,write}.{own,team,all}` in `catalog.ts`; HR Manager gets `.all` in `default-roles.ts`                                                                               |
| Wiring                | `RevisionLettersModule` imported in `app.module.ts`                                                                                                                                          |

### 10.5 Scope and audit

- **Scope:** team-scoped through the employee (`teamWhere(scope, …, { teamField: "employee.teamId", ownerField: "employee.userId" })`). Out of scope = **404** on read/edit; **422 `INVALID_EMPLOYEE`** on create for an employee outside scope (identical to an unknown id).
- **`.own` write** → 403 (reserved). **`.own` read** → own letters only.
- **Audit:** `entity_type = revision_letter`; actions `create` and `update`; before/after allow-listed snapshots, written in the same transaction as the change; actor from the JWT. Free text is not in the snapshot. **Salary components are in the snapshot**, so anyone with `audit.log.read` can see them (see R4).
- **Edit semantics:** legacy overwrites in place. Production also overwrites in place, and the audit `before`/`after` gives the history. This follows legacy; the earlier §3.2 suggestion of append-only versions is **not** adopted, pending an owner decision.

### 10.6 Deviations and omissions from legacy (deliberate)

| Legacy                                              | Production                    | Reason                                                                                                                   |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Delete a revision letter (history menu / picker)    | **Not built**                 | Platform rule: no DELETE route exists (`HR_API.md` §1). Changing it is an architecture decision. Pending owner decision. |
| Signature and seal images (data URLs in the record) | **Not stored**                | No file storage exists in production (D1).                                                                               |
| PDF / HTML render, share by Gmail/WhatsApp/mail     | **Not built**                 | Backend only (brief). Rendering location is open (D4).                                                                   |
| Company contact constants on each record            | **Not stored**                | Constants in legacy code; signatory name/designation are stored.                                                         |
| Salary split 35/15/30/20 from an amount             | **Not enforced**              | The UI convenience is not a backend rule; components are stored as given.                                                |
| Client-supplied employee name                       | **Derived from the employee** | Identity comes from the record, not from free text.                                                                      |
| `Sent` / `Accepted` statuses                        | **Not built**                 | Unreachable in legacy (R2). Status is `GENERATED` only.                                                                  |

### 10.7 Tests

| Layer          | File                                            | Count | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit — rules   | `revision-letters.rules.spec.ts`                | 12    | FY boundaries (31 Mar / 1 Apr), numbering format, default effective date (Dec rollover), exact decimal gross                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Unit — service | `revision-letters.service.spec.ts`              | 8     | scope resolution; `.own` write refused before any write; legacy defaults applied only on create; explicit values win; partial update sends only named fields; not-found                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| E2E            | `apps/api/test/hr-revision-letters.e2e-spec.ts` | 40    | 401/403 matrix; create with defaults; persistence in `hr`; create audit row; overrides; **6 concurrent issues → unique, contiguous numbers**; 422 unknown and cross-org employee; 400 validation (10 cases incl. unknown fields and overflow); rejected request writes nothing; all/team/own scope; team lead 404 outside team; list filter, pagination, 404; no delete route; edit recalculates gross, keeps document number, rejects employee/documentNo change; update audit before/after; cross-org edit 404 with no change; DB CHECK rejects a non-GENERATED status and a negative component; DB unique rejects a duplicate document number |

Verification commands and results are recorded in the completion report for this change.

### 10.8 Unresolved

- **U1 Interview/Offer scope** — §10.3. Blocks both records.
- **U2 Delete** — legacy has it; platform forbids it; undecided.
- **U3 Revision approval/signing** — none in legacy; none built.
- **U4 Document rendering and images** — D1 (storage) and D4 (rendering location).
- **U5 Office/time-zone of "today"** — defaults use the server's UTC date; legacy used the browser's local date. For India (UTC+5:30) a letter created shortly after midnight IST gets the previous day's `letterDate` and possibly the previous financial year's number. Needs a decision.
- **U6 Revision scope for team leads** — `read.team`/`write.team` are granted to no default role (same open decision as leave/attendance).
