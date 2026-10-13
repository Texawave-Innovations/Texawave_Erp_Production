# HR → Payroll & Compliance — Technical Specification & Guide

> **Target Audience:** Frontend Engineers, UI/UX Designers, and QA / Test Automation Engineers.  
> **Backend Module:** `apps/api/src/modules/hr/payroll/`  
> **Frontend Feature:** `apps/ui/src/features/hr/payroll/` (routes `/hr/payroll`, `/hr/compliance`, portal `/portal/payslips`, `/portal/loans` — §5)  
> **Database Migrations:** `20261005115640_add_hr_payroll_and_compliance`, `20261007102758_payroll_one_time_arrears`, `20261010120000_payroll_earning_source`, `20261011090000_hr_employee_gaps`, `20261014090000_hr_payroll_statutory_engine`  
> **Monorepo Packages:** `@texawave-erp/database`, `apps/api`, `apps/ui`, `@texawave-erp/ui-kit`

---

## 1. Overview & Architectural Principles

The **Payroll & Compliance** module is the single payroll engine of TexaWave ERP. Every screen, payslip, statutory file and report reads the results it stores. It covers:

- salary structures built over a configurable component master;
- approved attendance (absences, half days, overtime) and leave (paid or unpaid);
- a configurable pay-days policy;
- statutory deductions: PF with the EPS/EDLI split, ESI with its contribution-period rule, Professional Tax and TDS;
- loans with approval, skips and prepayments;
- bonuses, statutory bonus and gratuity;
- frozen payslips, statutory files, a reopen with a reason, and bank payment batches.

### Key Backend Rules for Consumers

1. **Authentication:** All routes require a valid Bearer token in the `Authorization: Bearer <token>` header (`JwtAuthGuard`). Unauthenticated requests receive `401 Unauthorized`. Obtain a token via `POST /auth/login` with body `{ "organizationSlug": "texawave-innovations", "email": "...", "password": "..." }` — the response contains `accessToken` and `refreshToken` (renew with `POST /auth/refresh`). Local dev seed super admin: `admin@texawave.com` / `ChangeMe123!` (never use outside local dev).
   - **Permissions** are not set in the client — they come from the roles assigned to the logged-in user (`/settings/roles`, `/settings/roles/:id/permissions`, `/users/:id/roles`, `/users/:id/teams`). After changing a user's roles, log in again to get a fresh token.
   - Scoped permissions exist in three variants: `<code>.own`, `<code>.team`, `<code>.all`. Missing permission → `403 Forbidden`.
2. **Tenant & Team Scoping** (Docs/CODING_STANDARDS.md §10a):
   - Employee pay data is team-scoped: salaries, entries, payslips, loans, bonuses, PF/ESI, single payments and tax declarations are read and written through `@TeamScoped()` repository methods.
   - `.own` sees only the caller's own records, `.team` sees the caller's teams (`user_team_access`), and `.all` sees the whole organization.
   - A record outside the caller's scope returns `404 Not Found`.
   - **Access scope — writes:**
     - Every single-employee write re-reads the employee through the caller's write scope **inside the write transaction** (`findEmployeeInWriteScope`). This covers salary, loan and loan decisions, skip, prepayment, bonus, a single payment and a tax declaration.
     - `.team` reaches only employees in the caller's teams (others → `404`).
     - `.own` never writes pay (→ `404`).
   - **Access scope — org-wide operations** (the documented `@OrgScoped()` exception):
     - These cover the whole organization: a payroll period, run, approval, finalization, reopen, payslip generation and regeneration, payment batches, statutory files and reports, and the statutory-bonus calculation.
     - The service requires the `.all` grant (`requireOrgWideScope`) before the `@OrgScoped()` repository runs; a `.team` grant gets `403 Forbidden`.
     - Organization configuration is not employee data, so it is `@OrgScoped()` + exact `hr.payroll_settings.*`. This covers settings, salary components and templates, tax regimes, PT slabs and PT location states.
     - Run headers (`GET /hr/payroll/runs`) are readable with `.team`/`.all`; per-employee entries stay team-filtered.
   - **Maker-checker:** these are approved by a second person:
     - a payroll run;
     - a loan, a loan skip request, a loan prepayment;
     - a bonus;
     - a tax declaration.

     The creator cannot approve it, and nobody approves something that pays themselves (→ `403 Forbidden`). A loan above the organization's limit needs an approver holding `hr.loan.approve.all`.
3. **Response Envelope:**
   - Single item responses: `{ "data": { ... } }`
   - Paginated list responses: `{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 } }`
   - Error responses: `{ "statusCode": 422, "message": "...", "error": "ERROR_CODE", "timestamp": "...", "path": "..." }`
   - Status codes: `400` request validation failure (DTO), `401` no/invalid token, `403` missing permission, `404` not found or outside caller's scope, `409` duplicate/conflict, `422` business-rule violation (e.g. `NO_APPROVED_RUN`).
4. **Data Formats:**
   - **Dates:** Strictly `YYYY-MM-DD` string format (ISO calendar date without timestamp or timezone shifts). Financial years are written `2026-27`.
   - **Monetary amounts & day counts in responses:** Prisma `Decimal` columns are serialized as **strings with trailing zeros dropped** — `52200.00` arrives as `"52200"`, `21.50` as `"21.5"`. Compare numerically (`Number(x)`), never as strings, and never do money arithmetic on floats in the UI (the salary report sums in integer paise). Request bodies take plain JSON numbers.
   - **Primary Keys:** Integers (`Int @id`). Never UUID strings.
5. **Historical Reproducibility:**
   - Finalized payroll entries are stored results.
   - A payslip keeps a **frozen snapshot** of everything it shows (§6), and its first rendered PDF is stored and returned unchanged afterwards.
   - Changing employee, bank or company data never alters an issued payslip. Only a regeneration with a reason, recorded as a new version, can change it.
   - A finalized month changes only through a **reopen** with a reason (§5.2), and only while no salary or PF/ESI of that month has been paid.
6. **Audit:**
   - Every payroll write records its audit row in the same transaction (`AuditWriter`, fail-closed): settings, components, templates, salaries, runs, approvals, finalize/reset/cancel/reopen, payslip generation and regeneration, payment batches and payments, loans and their decisions, skips, prepayments, bonuses, tax setup and declarations.
   - Reads of payroll data are logged by the `AuditInterceptor`.

### Default roles (local dev seed, `packages/database/prisma/permissions/default-roles.ts`)

Payroll follows the attendance "HR prepares, Admin approves" split:

| Role       | Payroll grants                                                                                                                                                                                                                                                                                                                                                   |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HR Manager | `.all` read/write of payroll, salary, PF, ESI, loans, bonuses, payslips, payments, tax declarations (incl. verifying them); `hr.payroll.finalize.all`, `hr.payroll.export.all`, `hr.payroll_settings.read`. **Not** `hr.payroll.approve`, `hr.payroll.reopen`, `hr.loan.approve`, `hr.bonus.approve`, `hr.payroll_settings.write` — those stay with Super Admin. |
| Team Lead  | none — pay is confidential even within a team.                                                                                                                                                                                                                                                                                                                   |
| Employee   | `employee_self_service.payslip.read`, `.loan.read`, `.tax_declaration.read`, `.tax_declaration.write`, `.form16.read` — own records only, in the portal (**My Payslips** `/portal/payslips`, **My Loans** `/portal/loans`), never the HR payroll workspace.                                                                                                      |

---

## 2. End-to-End Business Flow

```
[Masters: settings · components · templates · PT slabs · tax regimes]
[Per employee: salary structure (lines) · PF/ESI profiles · bank]
                    │
                    ▼
   0. Attendance month APPROVED per employee (when use_attendance)
      · tax declaration SUBMITTED / VERIFIED (when TDS is on)
                    │
                    ▼
       1. Create Payroll Period (DRAFT)
                    │
                    ▼
       2. Trigger Payroll Run (PROCESSED)
          ├─ Refused while any employee's attendance month is not approved
          ├─ Pay days, LOP (unpaid leave + absences, once), overtime,
          │  earnings per component, arrears, bonuses
          ├─ PF (+EPS/EDLI split), ESI, PT, TDS, deduction components,
          │  loan EMIs (only while net pay stays ≥ 0)
          └─ Re-running supersedes the previous PROCESSED/APPROVED run
                    │
                    ▼
       3. Review & Approve Run (APPROVED) — by a different user
                    │
                    ▼
       4. Finalize Period (FINALIZED)
          ├─ Payslips generated with frozen snapshots (PS-YYYYMM-NNNNNN)
          ├─ Loan installments PAID (loans with none left → CLOSED)
          ├─ Bonuses the run paid → PAID; paid arrears marked
          └─ Statutory files available: PF ECR, ESI, PT, TDS; journal; register
                    │            ▲
                    │            └── 4a. Reopen (reason; .all) → REOPENED,
                    │                 run back to PROCESSED → approve again
                    ▼
       5. Payment Batch (PENDING → PROCESSED / PAID) — only once FINALIZED
                    │
                    ▼
       6. Employee Self-Service (portal)
          └─ My Payslips · My Loans · tax declaration · Form 16
```

---

## 3. Business Calculation Rules & Statutory Formulae

The engine is `runs/payroll-calculator.service.ts`. It loads the inputs and leaves every figure to the pure rules in `runs/payroll-engine.rules.ts` and `tax/tds.rules.ts`, which have unit tests. All limits, rates and policies come from the organization's payroll settings (§4.2a). With no settings row, the defaults below apply. A settings change applies to runs calculated afterwards; finalized periods are never recalculated.

### 3.0 Salary structure: component master and templates

- **Components are data, not code.** Each organization has a list of salary components (`hr.salary_components`, §4.10):
  - `kind` is EARNING or DEDUCTION;
  - `isProrated`: reduced for loss of pay;
  - `isTaxable`: counted for TDS;
  - `pfApplicable`: part of the PF wage;
  - `esiApplicable`: part of the ESI wage;
  - `displayOrder`.
- **System components:** BASIC (PF), DA (PF), HRA, CONVEYANCE, OTHER_ALLOWANCE and SPECIAL_ALLOWANCE.
  - They are seeded for every organization by the migration, and on first use for a new organization.
  - They can be deactivated, except BASIC, but not deleted.
- **Custom components:** HR adds its own (e.g. `SHIFT_ALLOWANCE`, `CANTEEN` as a deduction).
  - Codes are upper-case and immutable.
  - Codes the engine produces itself are reserved: ARREARS, BONUS, OVERTIME, PF, ESI, PT, TDS, LOAN, GRATUITY. This is a database CHECK plus a `422 COMPONENT_CODE_RESERVED`.
- **A salary structure is a set of lines** (`hr.employee_salary_components`: component + monthly amount). The gross is the sum of its earning lines. A structure is given in one of four ways, in this order:
  1. the lines themselves (`components`);
  2. a **template** + gross;
  3. the legacy `basic` + `hra` (+ conveyance / other / special) fields;
  4. a gross alone, split by the settings' basic/HRA/conveyance percentages.

  A gross given alongside must equal the lines' earnings (`422 SALARY_GROSS_MISMATCH`).

- **Templates** (`hr.salary_templates`, e.g. one per grade) hold lines of these types:
  - **FIXED** (₹);
  - **PERCENT_OF_GROSS**;
  - **PERCENT_OF_BASIC** (of the BASIC line);
  - **REMAINDER**: gross minus every other earning; at most one per template.

  Applying a template copies its lines into the structure, so a later template change never alters an existing salary. A structure may record its template and the **revision letter** it implements.

- The legacy columns on `employee_salaries` (`basic`, `hra`, `conveyance`, `other_allowance`, `special_allowance`) mirror the matching system lines for older readers. The engine reads only the lines.

### 3.1 Days, pay-days policy and loss of pay

- **Calendar days:** the days of the period (April = 30).
- **Working days:** calendar days minus weekly offs (`WeeklyOffRule`) and holidays (`Holiday`, org-wide or the employee's location). A holiday on a weekly off counts once.
- **Employed days:** the days of the period between joining and exit.
- **Pay-days divisor** (`payDaysMode`):

  | Mode                 | Divisor                  |
  | :------------------- | :----------------------- |
  | `CALENDAR` (default) | calendar days            |
  | `FIXED_30`           | 30                       |
  | `FIXED_26`           | 26                       |
  | `WORKING_DAYS`       | the month's working days |

  Weekly offs and holidays are always paid days.

- **Loss of pay (absence LOP)** is deducted **once**:
  - **Unpaid leave:** approved leave whose leave type has `isPaid = false`. A half-day leave counts 0.5. A full-day leave counts only its **working days**, so a weekend or holiday inside an unpaid leave is paid (no "sandwich" rule).
  - **Absences from attendance:** when `useAttendance` is on (default), the employee's **APPROVED attendance month lock** (`hr.attendance_month_locks`, frozen `summary`) supplies:
    - ABSENT days;
    - NOT_MARKED working days (counted only when `unmarkedDaysAsAbsent`, default on);
    - half a day for every HALF_DAY that is not a half-day leave. A half-day leave also shows as HALF_DAY, and its leave half is settled by the leave itself.
  - Leave days are ON_LEAVE, never ABSENT, so nothing is counted twice.
  - **A run is refused** (`422 ATTENDANCE_NOT_APPROVED`, listing every employee) while any employee's month is not APPROVED.
- **Earning ratio:**
  $$\text{ratio} = \frac{\text{employed days}}{\text{calendar days}} - \frac{\text{absence LOP days}}{\text{divisor}}$$
  - The ratio is clamped to [0, 1] and rounded to 4 decimals.
  - Joining or leaving mid-month prorates by calendar days in every mode; each LOP day then costs exactly one per-day rate (gross ÷ divisor).
  - With `CALENDAR` this is the previous engine's (calendar − LOP) / calendar.
- **Payable days** = ratio × divisor; **LOP days** = divisor − payable days; **per-day rate** = gross ÷ divisor.
- **Stored on the entry:** `presentDays`, `halfDays`, `absentDays`, `overtimeMinutes`, `payDaysMode`, `payDaysDivisor` and `attendanceLockId`.

### 3.2 Earnings

- Each earning line: prorated lines × ratio, other lines in full (rounded to the paisa). A zero line is left off, except BASIC and HRA.
- **Arrears:** one-time and paid in full.
  - The first period finalized after `arrearsSalary` is set pays them, and finalization stamps `arrearsPaidPeriodId`.
  - Changing arrears schedules a new payment.
  - Arrears are not part of the gross.
- **Overtime:** when `overtimeEnabled`, the approved attendance month's overtime minutes are paid.
  - The rate is `overtimeRatePerHour` when set (e.g. the legacy ₹70).
  - Otherwise it is (gross ÷ divisor ÷ `standardHoursPerDay`) × `overtimeMultiplier` (default 2).
  - Overtime is taxable and an ESI wage.
- **Bonuses:** `APPROVED` bonuses for this period (or no period) that no live run of another open period already pays.
  - They are paid in full, and each BONUS earning records its bonus (`source_type`/`source_id`); finalize marks exactly those `PAID`.
  - GRATUITY bonuses are not taxable.
  - No bonus is an ESI wage.
- **Total gross earnings** = sum of all earnings.

### 3.3 Provident Fund (PF)

- Applies when `EmployeePfProfile.pfApplicable`.
- **PF wage** = sum of the earned PF-applicable lines (Basic + DA by default), capped at `pfWageCeiling` (₹15,000) when `pfCapAtCeiling` is on. Turning it off gives voluntary PF on the full wage.
- **Employee contribution:** `pfEmployeeRate`% (12%), deducted.
- **Employer contribution:** `pfEmployerRate`% (12%), split as follows. The employer amounts are recorded on `pf_contributions` (employer cost, ECR).
  - **EPS:** `epsRate`% (8.33%) of the PF wage up to `epsWageCeiling` (₹15,000). It is zero from `epsAgeLimit` (58), using the employee's date of birth from personal details.
  - **EPF difference** = employer contribution − EPS.
  - **EDLI:** `edliRate`% (0.5%) up to `edliWageCeiling`.
  - **Admin charges:** `pfAdminRate`% (0.5%) of the PF wage.

### 3.4 Employee State Insurance (ESI)

- Applies when `EmployeeEsiProfile.esiApplicable`.
- **Eligibility:**
  - the recurring monthly wage of ESI-applicable lines is at or below `esiWageThreshold` (₹21,000); **or**
  - **contribution-period rule:** the employee was covered by a finalized period earlier in the same contribution period (April–September, October–March). Such an employee stays covered until that period ends.
- **ESI wage** = earned ESI-applicable lines + arrears + overtime (bonuses excluded).
- **Contributions:** employee `esiEmployeeRate`% (0.75%), employer `esiEmployerRate`% (3.25%).

### 3.5 Professional Tax (PT)

- Applies when `ptEnabled`.
- **State:** the employee's work location → state (`hr.pt_location_states`, §4.12), else `ptDefaultStateCode`.
- **Slabs:** the state's active slabs in force for the period (`hr.professional_tax_slabs`).
  - The slab whose `[min, max]` contains the month's gross earnings applies.
  - Its `monthlyAmount` is deducted, or its `specialAmount` in its `specialMonth` (e.g. a February instalment).
  - A non-empty `applicableMonths` restricts it to those months (half-yearly states).
- No state, or no matching slab, means no PT. Slabs of one state in force at the same time may not overlap (`409 PT_SLAB_OVERLAP`).

### 3.6 TDS (income tax on salary)

- Applies when `tdsEnabled`.
- **The law is data:** HR enters each financial year's regime rules per regime (OLD / NEW) (§4.11):
  - slabs (contiguous, from 0);
  - standard deduction;
  - 87A rebate limit and maximum;
  - cess %;
  - old-regime 80C and home-loan-interest caps.

  A run with TDS on and no slabs for the employee's regime and year is refused (`422 TAX_REGIME_NOT_CONFIGURED`).

- **Regime:** the employee's declaration for the year, else `defaultTaxRegime` (NEW).
- **Declaration amounts used:**
  - **VERIFIED:** the amounts HR accepted against proofs.
  - **SUBMITTED:** the declared amounts.
  - **DRAFT / REJECTED:** none, only the regime.
- **Projection** (`tds.rules.ts`):

  ```
  projected = taxable paid in finalized periods of the year
            + this month's taxable earnings
            + recurring taxable salary × months left in the year
            + other income + previous-employer income
  deductions = standard deduction                                  (NEW)
             = standard + min(80C + employee PF for the year, 80C cap)
               + 80D + HRA exemption + min(home-loan interest, cap) + other   (OLD)
  annual tax = slab tax on (projected − deductions), less the 87A rebate
               when within its limit, plus cess — rounded to the rupee
  this month = (annual tax − TDS already deducted this year − previous-employer TDS)
               ÷ (months left + 1), rounded to the rupee; never negative
  ```

- **Not modelled:** surcharge, marginal relief on the rebate, perquisites, and section-10 exemptions other than the declared HRA exemption.

### 3.7 Loans & Advances

- **Request:** a loan starts `PENDING_APPROVAL` with no schedule. The limits use the gross salary on the disbursement date (`422 SALARY_NOT_CONFIGURED` without one):
  - **Principal** ≤ `loanMaxMultiple` × gross (default 3). Above that needs an `overrideReason`, at least 10 characters (`422 LOAN_OVER_LIMIT` without one). The loan is flagged `limitOverride` and only a `.all` approver may decide it.
  - **All the employee's EMIs** (active + awaiting approval + this one) ≤ `loanMaxEmiPercent`% of gross (default 100). This limit is never overridable (`422 LOAN_EMI_OVER_LIMIT`).
  - An EMI that does not fit the principal → `422 LOAN_SCHEDULE_INVALID`.
- **Approval** (second person; not the requester or borrower):
  - approval builds the schedule: `emiMonths` installments one month apart from the recorded disbursement date, the last adjusted to the remainder;
  - a rejection needs a note.
- **Deduction:** at most one installment per loan per period.
  - It is the earliest `PENDING` installment due by the period end that no live run of another open period has claimed.
  - It is taken only while net pay stays ≥ 0; otherwise it stays `PENDING`.
- **Skip:** an approved skip marks that period's installment `SKIPPED` and appends one of the same amount at the end.
- **Prepayment:** money repaid outside payroll, recorded as a request and approved by a second person.
  - It settles the **last** pending installments first (tenure shortens, EMI unchanged). Fully covered installments become `PREPAID` and a partly covered one is reduced.
  - Installments already claimed by a live run are left to that run.
  - A loan with nothing pending is `CLOSED`.
  - More than the outstanding balance → `422 LOAN_PREPAYMENT_EXCEEDS_BALANCE`.
- **Settlement:** finalize marks the run's installments `PAID` and closes fully repaid loans. A reopen reverses both.

### 3.8 Net Payable

$$\text{Total Deductions} = \text{PF} + \text{ESI} + \text{PT} + \text{TDS} + \text{deduction components} + \text{Loan EMIs}$$
$$\text{Net Payable} = \max(0, \text{Total Gross Earnings} - \text{Total Deductions})$$

Statutory deductions and deduction components are always taken; loan EMIs only while net pay stays non-negative.

### 3.9 Statutory bonus and gratuity

- **Statutory bonus** (`POST /hr/bonuses/statutory`, `.all`) is calculated from the **finalized** payroll of a financial year.
  - **Eligible** when the highest monthly Basic + DA is at most `bonusEligibilityLimit` (₹21,000) and payable days in the year are at least 30.
  - **Amount** = `bonusPercent`% (8.33%) of Σ min(Basic + DA earned that month, `bonusCalculationCeiling` ₹7,000), rounded to the rupee.
  - `create: true` raises a `STATUTORY` bonus (PENDING approval) for every eligible employee not already given one for that year. Payroll then pays it like any bonus.
- **Gratuity** (`GET /hr/bonuses/gratuity/:employeeId`): eligible after `gratuityMinYears` (5) completed years.
  - A part year over six months counts as a full year.
  - **Amount** = Basic + DA × 15 ÷ 26 × counted years, capped at `gratuityCap` (₹20 lakh).
  - `POST /hr/bonuses/gratuity` raises it as a `GRATUITY` bonus (PENDING approval; not taxable, not an ESI wage).
  - Not modelled: the death/disablement exception to the five-year rule.

### 3.10 Not yet modelled

| Area                                                          | Status                                                                                   |
| :------------------------------------------------------------ | :--------------------------------------------------------------------------------------- |
| TDS: surcharge, marginal relief, perquisites, Form 24Q filing | The monthly TDS CSV is the basis for 24Q; the return itself is filed outside the system. |
| Form 16 Part A                                                | Comes from TRACES; the system produces Part B (§4.14).                                   |
| Tax-declaration proof files                                   | HR checks proofs outside the system and records the accepted amounts when verifying.     |
| Salary register as `.xlsx`                                    | CSV (opens in Excel). A real `.xlsx` needs a new dependency (reviewer sign-off).         |
| Journal posting to Finance                                    | Finance is paused; the journal is a balanced CSV keyed by component code.                |
| Gratuity death/disablement exception                          | Five-year rule always applied.                                                           |
| Periods not aligned to calendar months                        | Attendance is read from the month of the period start.                                   |

---

## 4. Complete API Endpoint Reference

### 4.1 Payroll Periods (`/hr/payroll/periods`)

#### `POST /hr/payroll/periods`

Creates a new payroll period in `DRAFT` status.

- **Permission:** `hr.payroll.write.all`
- **Request Body:**
  ```json
  {
    "year": 2026,
    "month": 5,
    "periodStart": "2026-05-01",
    "periodEnd": "2026-05-31"
  }
  ```
  `year` (2000–2100) and `month` (1–12) are required; `periodStart` / `periodEnd` are optional.
- **Response (201 Created):**
  ```json
  {
    "data": {
      "id": 1,
      "year": 2026,
      "month": 5,
      "periodStart": "2026-05-01",
      "periodEnd": "2026-05-31",
      "status": "DRAFT",
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  }
  ```
- **Errors:**
  - `409 Conflict`: If a payroll period for the given year and month already exists.

#### `GET /hr/payroll/periods`

List paginated payroll periods.

- **Permission:** `hr.payroll.read.own` / `.team` / `.all`
- **Query Params:** `page`, `limit` (max 100), `year`, `status` (`DRAFT`, `PROCESSING`, `PROCESSED`, `APPROVED`, `FINALIZED`, `CANCELLED`)
- Each period includes `runs[]` (`id`, `runNumber`, `status`, `startedAt`, `completedAt`, `approvedAt`, newest first) and `finalizedBy`.

#### `GET /hr/payroll/periods/:id`

Retrieve detailed period data including execution runs.

- **Permission:** `hr.payroll.read.own` / `.team` / `.all`

#### `PATCH /hr/payroll/periods/:id`

Update period status (cancel or revert to draft).

- **Permission:** `hr.payroll.write.all`
- **Request Body:** `{ "status": "CANCELLED" }` — only `DRAFT` or `CANCELLED` are accepted.
- **Effect:** runs under the period lock. Either status takes the period's live runs out of play exactly like a re-run does (runs and entries → `CANCELLED`, deducted loan installments released, payslips voided, PF/ESI snapshots retired), so a reset or cancelled period can be neither finalized nor paid from a run approved earlier. Run payroll again (from `DRAFT`) to continue.
- **Errors:** `422 PAYROLL_FINALIZED` for a finalized period.

#### `POST /hr/payroll/periods/:id/finalize`

Finalizes an approved payroll period in one transaction (period row-locked): generates payslips from the approved run, settles its loan installments (closing fully repaid loans), marks its bonuses `PAID` and its arrears paid.

- **Permission:** `hr.payroll.finalize.all` (`.team` → `403`)
- **Preconditions:** Period status must be `APPROVED`, with its (single) `APPROVED` payroll run.
- **Response (200 OK):** Period object with `status: "FINALIZED"`.
- **Errors:**
  - `422 Unprocessable Entity` (`INVALID_STATE_TRANSITION`): period is not `APPROVED` (e.g. `DRAFT`, `PROCESSED`, `CANCELLED`).
  - `422 Unprocessable Entity` (`NO_APPROVED_RUN`): no approved run exists.
  - `422 Unprocessable Entity` (`PAYROLL_RUN_STALE`): the approved run predates bonus tracking — re-run and re-approve.
  - `422 Unprocessable Entity` (`PAYROLL_ALREADY_FINALIZED`): period already finalized.

---

### 4.2 Salaries (`/hr/salaries`)

#### `POST /hr/salaries`

Creates an effective-dated salary structure for an employee. Automatically closes prior open salary structures.

- **Permission:** `hr.salary.write.all`
- **Request Body:**
  ```json
  {
    "employeeId": 10,
    "grossMonthly": 50000.0,
    "basic": 25000.0,
    "hra": 15000.0,
    "conveyance": 2000.0,
    "otherAllowance": 3000.0,
    "specialAllowance": 5000.0,
    "effectiveFrom": "2026-01-01"
  }
  ```
  Required: `employeeId`, `effectiveFrom`, and **either** `basic` + `hra` (with the other components optional) **or** only `grossMonthly`. Optional: `effectiveTo`, `conveyance`, `otherAllowance`, `specialAllowance`, `arrearsSalary`, `grossMonthly`. All amounts must be `>= 0`.
- **Auto-split:** when only `grossMonthly` is given (optionally with `specialAllowance`, which stays on top), `grossMonthly − specialAllowance` is split by the organization's payroll settings — `basicPercent` / `hraPercent` / `conveyancePercent` (default 35 / 30 / 20, the legacy form's rule) with the remainder as `otherAllowance`, so the parts always add up to the gross. Giving only some components (e.g. `basic` without `hra`) is `422 SALARY_COMPONENTS_INCOMPLETE`. Preview the split with `GET /hr/payroll/settings/salary-split?grossMonthly=`.
- **Audit:** create and update write an `employee_salary` audit row (before/after amounts and dates) in the same transaction.

#### `GET /hr/salaries`

List salary history.

- **Permission:** `hr.salary.read.own` / `.team` / `.all`
- **Query Params:** `employeeId`, `effectiveOn`, `page`, `limit`

#### `GET /hr/salaries/applicable`

Fetch the salary structure applicable to an employee on a date.

- **Permission:** `hr.salary.read.own` / `.team` / `.all`
- **Query Params:** `employeeId` (required), `date` (optional `YYYY-MM-DD`, defaults to today)

#### `GET /hr/salaries/:id`

Get a single salary structure.

- **Permission:** `hr.salary.read.own` / `.team` / `.all`

#### `PATCH /hr/salaries/:id`

Update a salary structure (any of `effectiveTo`, `basic`, `hra`, `conveyance`, `otherAllowance`, `specialAllowance`, `arrearsSalary`).

- **Permission:** `hr.salary.write.all`
- **Locked by finalized payroll:** once a FINALIZED payroll period overlaps the structure, its recurring amounts (`basic`, `hra`, `conveyance`, `otherAllowance`, `specialAllowance`) cannot change, and `effectiveTo` cannot move before the end of the last finalized period it covers — both `422 SALARY_LOCKED_BY_FINALIZED_PAYROLL`. A pay change is a new structure from the next period. One-time `arrearsSalary` stays editable (it is paid by the next finalized period).

---

### 4.2a Payroll settings (`/hr/payroll/settings`)

Organization-wide rules: one row per organization (`hr.payroll_settings`), none until first saved.

| Method & path                           | Permission                  | Notes                                                                                                                                                                           |
| --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/hr/payroll/settings`              | `hr.payroll_settings.read`  | `basicPercent, hraPercent, conveyancePercent, pfWageCeiling, pfEmployeeRate, pfEmployerRate, esiWageThreshold, esiEmployeeRate, esiEmployerRate`, plus `isDefault`, `version`   |
| PATCH `/hr/payroll/settings`            | `hr.payroll_settings.write` | partial; **`version` required** (`0` before the first save; stale → `409 VERSION_CONFLICT`). Basic + HRA + conveyance > 100 → `422 SALARY_SPLIT_OVER_100`. Audited before/after |
| GET `/hr/payroll/settings/salary-split` | `hr.salary.write` ▲         | `?grossMonthly=` → `{grossMonthly, basic, hra, conveyance, otherAllowance}` under the current settings                                                                          |

Percentages are 0–100 (two decimals); the PF ceiling and ESI threshold are positive amounts. Database CHECKs mirror these rules. Not employee data, so the permissions carry no `.own/.team/.all` scope. In the default roles HR Manager holds `hr.payroll_settings.read`; `.write` stays with Super Admin (§1 Default roles). The newer fields (pay days, attendance, overtime, PF split, PT, TDS, bonus, gratuity, loan limits, employer details) are listed in §4.16.

---

### 4.3 Compliance: PF & ESI (`/hr/compliance`)

#### `PUT /hr/compliance/pf/profiles/:employeeId`

Create or update an employee's Provident Fund profile.

- **Permission:** `hr.pf.write.all`
- **Request Body:**
  ```json
  {
    "pfApplicable": true,
    "uan": "100123456789",
    "pfNumber": "MH/PUN/0012345/000/0001",
    "effectiveFrom": "2026-01-01"
  }
  ```

#### `GET /hr/compliance/pf/profiles/:employeeId`

Retrieve an employee's PF profile.

- **Permission:** `hr.pf.read.own` / `.team` / `.all`

#### `GET /hr/compliance/pf/contributions`

List PF contributions by period or employee.

- **Permission:** `hr.pf.read.own` / `.team` / `.all`
- **Query Params:** `payrollPeriodId`, `employeeId`, `paymentStatus` (`PENDING`, `CREDITED`, `FAILED`), `page`, `limit`

#### `GET /hr/compliance/pf/contributions/:id`

Get a single PF contribution.

- **Permission:** `hr.pf.read.own` / `.team` / `.all`

#### `PUT /hr/compliance/esi/profiles/:employeeId`

Create or update an employee's ESI profile.

- **Permission:** `hr.esi.write.all`
- **Request Body:**
  ```json
  {
    "esiApplicable": true,
    "insuranceNumber": "31001234560010001",
    "effectiveFrom": "2026-01-01"
  }
  ```

#### `GET /hr/compliance/esi/profiles/:employeeId`

Retrieve an employee's ESI profile.

- **Permission:** `hr.esi.read.own` / `.team` / `.all`

#### `GET /hr/compliance/esi/contributions`

List ESI contributions by period or employee.

- **Permission:** `hr.esi.read.own` / `.team` / `.all`
- **Query Params:** `payrollPeriodId`, `employeeId`, `paymentStatus` (`PENDING`, `CREDITED`, `FAILED`), `page`, `limit`

#### `GET /hr/compliance/esi/contributions/:id`

Get a single ESI contribution.

- **Permission:** `hr.esi.read.own` / `.team` / `.all`

---

### 4.4 Loans & Advances (`/hr/loans`)

#### `POST /hr/loans`

Issues a new loan and automatically generates scheduled repayment installments.

- **Permission:** `hr.loan.write.all`
- **Request Body:**
  ```json
  {
    "employeeId": 10,
    "principalAmount": 12000.0,
    "emiAmount": 1000.0,
    "emiMonths": 12,
    "disbursedDate": "2026-01-01",
    "reason": "Medical emergency"
  }
  ```
- `.team` only for own teams' employees; `.own` cannot create loans.
- The schedule must add up to the principal (last installment adjusted) — otherwise `422 LOAN_SCHEDULE_INVALID` (§3.4). Loan numbers: `LOAN-NNNNNN` (per-organization counter).

#### `GET /hr/loans`

List loans with repayment installments.

- **Permission:** `hr.loan.read.own` / `.team` / `.all`
- **Query Params:** `employeeId`, `status` (`PENDING_APPROVAL`, `ACTIVE`, `REJECTED`, `CLOSED`, `DEFAULTED`, `CANCELLED`), `page`, `limit`

#### `GET /hr/loans/:id`

Get single loan details and repayment schedule.

- **Permission:** `hr.loan.read.own` / `.team` / `.all`

#### `POST /hr/loans/:id/skip-request`

Submit an EMI skip request for loan `:id` for a given payroll period.

- **Permission:** `hr.loan.write.own` / `.team` / `.all`
- **Request Body:**
  ```json
  {
    "payrollPeriodId": 1,
    "reason": "High household expense this month"
  }
  ```

#### `POST /hr/loans/skip-requests/:id/decide`

Maker-checker decision on skip request.

- **Permission:** `hr.loan.approve.all`
- **Request Body:**
  ```json
  {
    "decision": "APPROVED",
    "note": "Approved by HR Manager"
  }
  ```
  `decision` is `APPROVED` or `REJECTED`.
- The requester and the borrower cannot decide it (`403`). Not allowed for a finalized period (`422 PERIOD_FINALIZED`). Approval re-schedules the skipped installment at the end of the loan (§3.4).

#### `GET /self-service/loans` / `GET /self-service/loans/:id`

Authenticated employee's own loans and repayment schedule.

- **Permission:** `employee_self_service.loan.read`
- **Query Params (list):** `status`, `page`, `limit`

---

### 4.5 Bonuses (`/hr/bonuses`)

#### `POST /hr/bonuses`

Create a bonus record.

- **Permission:** `hr.bonus.write.all`
- **Request Body:**
  ```json
  {
    "employeeId": 10,
    "bonusType": "PERFORMANCE",
    "amount": 5000.0,
    "reason": "Q1 Top Contributor",
    "payrollPeriodId": 1
  }
  ```
  Required: `employeeId`, `bonusType`, `amount`. Optional: `payrollPeriodId`, `reason`, `calculationBase`, `tenureMonths`, `attendanceDays`.

#### `GET /hr/bonuses`

List bonuses with decision status.

- **Permission:** `hr.bonus.read.own` / `.team` / `.all`
- **Query Params:** `employeeId`, `payrollPeriodId`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `page`, `limit`

#### `GET /hr/bonuses/:id`

Get a single bonus.

- **Permission:** `hr.bonus.read.own` / `.team` / `.all`

#### `POST /hr/bonuses/:id/decide`

Approve or reject bonus.

- **Permission:** `hr.bonus.approve.all`
- **Request Body:**
  ```json
  {
    "decision": "APPROVED",
    "note": "Approved by Director"
  }
  ```
- The bonus's creator and its recipient cannot decide it (`403`, maker-checker).

---

### 4.6 Payroll Runs & Entries (`/hr/payroll/runs` & `/hr/payroll/entries`)

#### `POST /hr/payroll/runs`

Executes calculations for all active eligible employees in the specified period.

- **Permission:** `hr.payroll.write.all`
- **Request Body:**
  ```json
  {
    "payrollPeriodId": 1,
    "notes": "May 2026 Primary Run"
  }
  ```
  Optional `employeeIds: number[]` adds or recalculates specific employees. If the period already has a live run, everyone in it is carried into the new run (and recalculated) too — a partial re-run never drops anyone from the payable run.
- **Org-wide:** `.team` → `403`. Rejected for a `FINALIZED` or `CANCELLED` period (`422 PAYROLL_FINALIZED`).
- **Re-run:** any earlier `PROCESSED` or `APPROVED` run of the period becomes `CANCELLED` (entries too), its payslips are voided (they disappear from `/hr/payslips` and `/self-service/payslips`), and the period returns to `PROCESSED` — approve the new run before finalizing.
- **Concurrency:** calculation happens before the period lock; under the lock the run is rejected with `409 PAYROLL_INPUTS_CHANGED` if the period's live run changed meanwhile, or if a loan installment / bonus it pays was taken by another period's run or changed status. Just run it again.
- **Response (201 Created):**
  ```json
  {
    "data": {
      "id": 1,
      "payrollPeriodId": 1,
      "runNumber": 1,
      "status": "PROCESSED",
      "completedAt": "2026-05-31T18:00:00.000Z"
    }
  }
  ```

#### `POST /hr/payroll/runs/:id/approve`

Approves a processed run, marking it ready for period finalization.

- **Permission:** `hr.payroll.approve.all` (`.team` → `403`). The run's creator gets `403` (maker-checker).
- **Errors:** `422` (`RUN_ALREADY_APPROVED` / `INVALID_STATE_TRANSITION`) for a run that is not `PROCESSED` — including a superseded (`CANCELLED`) one.
- **Request Body:**
  ```json
  {
    "notes": "Calculations verified and approved"
  }
  ```

#### `GET /hr/payroll/runs` / `GET /hr/payroll/runs/:id`

List runs or get a single run.

- **Permission:** `hr.payroll.read.team` / `.all` (`.own` → `403`; run headers carry no per-employee pay)
- **Query Params (list):** `payrollPeriodId`, `status`, `page`, `limit`

#### `GET /hr/payroll/entries`

List calculated employee entries for a run.

- **Permission:** `hr.payroll.read.own` / `.team` / `.all`
- **Query Params:** `payrollRunId`, `payrollPeriodId`, `employeeId`, `status`, `page`, `limit`
- **Employee fields:** each entry's `employee` carries `id`, `employeeCode`, `fullName`, `teamId`, `userId`, `team { id, name }` and `department { id, name }` (either may be `null`). The UI salary report filters by team/department from these.

#### `GET /hr/payroll/entries/:id`

Get a single entry with its earnings/deductions breakdown.

- **Permission:** `hr.payroll.read.own` / `.team` / `.all`
- **Response Sample** (a single object; decimals are strings — §1.4):
  ```json
  {
    "data": {
      "id": 101,
      "payrollRunId": 1,
      "employeeId": 10,
      "totalCalendarDays": 31,
      "requiredWorkingDays": 22,
      "presentDays": "22",
      "halfDays": "0",
      "holidayDays": "0",
      "leaveDays": "0",
      "lopDays": "0",
      "payableDays": "31",
      "monthlyGross": "50000",
      "perDayRate": "1612.9",
      "earningRatio": "1",
      "baseEarnings": "50000",
      "totalGrossEarnings": "55000",
      "totalDeductions": "2800",
      "netPayable": "52200",
      "employee": {
        "id": 10,
        "employeeCode": "EMP-001",
        "fullName": "John Doe",
        "teamId": 3,
        "userId": 7,
        "team": { "id": 3, "name": "Software" },
        "department": { "id": 2, "name": "Engineering" }
      },
      "earnings": [
        {
          "code": "BASIC",
          "name": "Basic Salary",
          "baseAmount": "25000",
          "earningRatio": "1",
          "calculatedAmount": "25000"
        },
        {
          "code": "BONUS",
          "name": "Bonus (PERFORMANCE)",
          "baseAmount": "5000",
          "earningRatio": "1",
          "calculatedAmount": "5000"
        }
      ],
      "deductions": [
        {
          "code": "PF",
          "name": "Provident Fund",
          "amount": "1800",
          "sourceType": "PF"
        },
        {
          "code": "LOAN",
          "name": "Loan Repayment",
          "amount": "1000",
          "sourceType": "LOAN"
        }
      ],
      "payslip": null
    }
  }
  ```
  `sourceType` is `PF`, `ESI` or `LOAN` for statutory/loan deductions; the salary report groups deductions by it.

---

### 4.7 Payslips (`/hr/payslips` & `/self-service/payslips`)

#### `GET /hr/payslips`

Admin/HR list of generated payslips.

- **Permission:** `hr.payslip.read.own` / `.team` / `.all`
- **Query Params:** `payrollPeriodId`, `employeeId`, `page`, `limit`

#### `GET /hr/payslips/:id`

Detailed payslip breakdown.

- **Permission:** `hr.payslip.read.own` / `.team` / `.all`

#### `POST /hr/payslips/generate`

Generate payslips for an approved payroll period (normally done automatically by finalize).

- **Permission:** `hr.payroll.write.all` (`.team` → `403`)
- **Request Body:** `{ "payrollPeriodId": 1 }`
- **Response:** `200 OK` — the period's payslips. Re-generating refreshes existing payslips (same numbers).
- **Errors:** `404` for an unknown period or another organization's period; `422 NO_APPROVED_RUN`.
- Bank `accountNumber` / `panNumber` in payslip responses are masked (last 4 characters only).

#### `GET /self-service/payslips`

Authenticated employee's own payslips.

- **Permission:** `employee_self_service.payslip.read`
- **Query Params:** `page`, `limit`

#### `GET /self-service/payslips/:id`

Authenticated employee's individual payslip.

- **Permission:** `employee_self_service.payslip.read`

#### `GET /hr/payslips/:id/pdf` / `GET /self-service/payslips/:id/pdf`

Download a payslip as an A4 PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="PS-YYYYMM-NNNNNN.pdf"`). Not wrapped in the `{ data }` envelope.

- **Permission:** HR route `hr.payslip.read.own` / `.team` / `.all` (same scope as `GET /hr/payslips/:id`); self-service route `employee_self_service.payslip.read`, own payslips only.
- **Errors:** `403` without the permission; `404` for an unknown id, another organization's payslip, one outside the caller's team scope, or (self-service) someone else's payslip.
- **Content:** employee, designation, department, masked bank account / PAN, UAN, ESI number, calendar / payable / LOP days, earnings and deductions tables, gross, total deductions, net payable. Masking is identical to the JSON responses.
- **Rendering:** headless Chromium via `playwright` (`payslips/payslip-pdf.renderer.ts`). The API host needs a browser: `pnpm --filter api exec playwright install chromium`, or set `PDF_BROWSER_CHANNEL=msedge` / `chrome` in `apps/api/.env` to use an installed Edge/Chrome (Docs/ARCHITECTURE.md §9). Without either, these two routes return `500`; nothing else is affected.

---

### 4.8 Payment Batches & Disbursal (`/hr/payment-batches`)

#### `POST /hr/payment-batches`

Generates a payment batch from a finalized payroll period.

- **Permission:** `hr.payment.write.all`
- **Request Body:**
  ```json
  {
    "payrollPeriodId": 1,
    "paymentMethod": "BANK_TRANSFER"
  }
  ```

`paymentMethod` is optional (default `BANK_TRANSFER`).

- **Org-wide:** `.team` → `403`.
- **Errors:**
  - `422 PERIOD_NOT_FINALIZED` — the period is not `FINALIZED` yet.
  - `409 PAYMENT_BATCH_EXISTS` — the period already has a non-cancelled batch (one payout per period).
  - `422 BANK_DETAILS_MISSING` — for `BANK_TRANSFER`, lists the employee codes without bank details.
- Batch numbers: `BATCH-YYYYMM-NNNNNN` (per-organization counter).

#### `GET /hr/payment-batches`

List payment batches.

- **Permission:** `hr.payment.read.all` (`.team` → `403`)
- **Query Params:** `payrollPeriodId`, `status`, `page`, `limit`

#### `GET /hr/payment-batches/:id`

Get batch details with individual payment line items (account numbers masked).

- **Permission:** `hr.payment.read.all` (`.team` → `403`)

#### `GET /hr/payment-batches/:id/export`

Exports CSV formatted for corporate banking bulk transfers. This is the only response that carries full account numbers (the bank needs them); PAN is not included. Every text cell is quoted and a leading `=`, `+`, `-`, `@` is neutralised with `'` (CSV-injection safe).

- **Permission:** `hr.payment.read.all`
- **Response Format:**
  ```json
  {
    "data": {
      "fileName": "bank-transfer-batch-1.csv",
      "content": "Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Amount,Payment Method,Status,Payment Reference\n\"EMP-001\",\"John Doe\",\"HDFC Bank\",\"50100123456789\",\"HDFC0001234\",52200,\"BANK_TRANSFER\",\"PENDING\",\"\""
    }
  }
  ```

#### `POST /hr/payment-batches/:id/process`

Marks batch `PROCESSED` and its still-`PENDING` payments `PAID`. Atomic: a second (or concurrent) call fails.

- **Permission:** `hr.payment.write.all`
- **Response:** `200 OK`; `422 BATCH_ALREADY_PROCESSED` if the batch is not `PENDING`.

#### `PATCH /hr/payments/:id`

Update a single payment line (e.g. mark failed, record bank reference).

- **Permission:** `hr.payment.write.team` (own teams' employees) / `.all`
- **Request Body:** `{ "status": "PAID", "bankReference": "UTR123456", "creditedAt": "2026-06-01" }` (all optional)
- **Status transitions:** `PENDING → PAID | FAILED | CANCELLED`, `FAILED → PENDING | PAID | CANCELLED`; `PAID` and `CANCELLED` are final. Anything else → `422 INVALID_STATE_TRANSITION`.

---

### 4.9 Bank Details (read from onboarding)

Payroll has no bank-details endpoint or table of its own. It reads the employee's onboarding record:

- **Bank account:** `hr.employee_bank_details` (`EmployeeBankDetail`), entered through `PUT /employee/profile/bank-details` (Docs/HR_API.md). The account number is encrypted at rest (`FieldEncryptionService`, AES-256-GCM) with a stored masked copy.
- **PAN:** `hr.employee_government_ids` (`EmployeeGovernmentId`).

Payslip and payment responses keep the `employee.bankDetails` shape — `{ bankName, accountNumber, ifscCode, panNumber? }` — where `accountNumber` is the stored masked value (e.g. `XXXXXXXXXX6789`) and `panNumber` (payslips only) is masked to its last four characters. A soft-deleted onboarding row counts as missing. Only the bank-transfer CSV export (§4.8) decrypts the full account number.

---

### 4.10 Salary components & templates (`/hr/payroll/salary-components`, `/hr/payroll/salary-templates`)

Organization configuration: `hr.payroll_settings.read` / `.write` (exact, unscoped). Every write is audited.

| Method & path                                        | Permission | Notes                                                                                                                                                                                                       |
| :--------------------------------------------------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /hr/payroll/salary-components?includeInactive=` | read       | Seeds the system components on first use.                                                                                                                                                                   |
| `POST /hr/payroll/salary-components`                 | write      | `{ code, name, kind: EARNING\|DEDUCTION, isProrated?, isTaxable?, pfApplicable?, esiApplicable?, displayOrder? }`. Reserved code → `422 COMPONENT_CODE_RESERVED`; duplicate → `409`.                        |
| `PATCH /hr/payroll/salary-components/:id`            | write      | Name, flags, order, `isActive`. Code and kind are fixed. BASIC cannot be deactivated (`422 COMPONENT_REQUIRED`). Inactive components cannot be used in new salaries/templates; existing salaries keep them. |
| `GET /hr/payroll/salary-templates`, `GET …/:id`      | read       | With lines and their components.                                                                                                                                                                            |
| `POST /hr/payroll/salary-templates`                  | write      | `{ code, name, description?, lines: [{ componentId, calculationType: FIXED\|PERCENT_OF_GROSS\|PERCENT_OF_BASIC\|REMAINDER, value? }] }`. One REMAINDER at most (DB index); a REMAINDER must be an earning.  |
| `PATCH /hr/payroll/salary-templates/:id`             | write      | `lines` replaces all lines. Existing salaries are not changed.                                                                                                                                              |
| `POST /hr/payroll/salary-templates/:id/preview`      | read       | `{ grossMonthly }` → `{ lines: [{ componentId, code, kind, monthlyAmount }], totalEarnings }`. `422 TEMPLATE_EXCEEDS_GROSS`, `TEMPLATE_GROSS_MISMATCH`, `TEMPLATE_BASIC_MISSING`.                           |

**Salaries (§4.2) — new fields:**

- `POST /hr/salaries` takes `components: [{ componentId | code, monthlyAmount }]`, or `salaryTemplateId` + `grossMonthly`, plus optional `revisionLetterId`. The revision letter must be this employee's (`422 REVISION_LETTER_MISMATCH`).
- `PATCH` takes `components` (replaces all lines).
- Responses carry `components: [{ monthlyAmount, component: { id, code, name, kind } }]`, `salaryTemplate` and `revisionLetter`.

### 4.11 Income-tax regimes (`/hr/payroll/tax-regimes`)

| Method & path                                       | Permission                  | Notes                                                                                                                                                                                                                                                                                                                                                               |
| :-------------------------------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /hr/payroll/tax-regimes?financialYear=2026-27` | `hr.payroll_settings.read`  | Regimes with slabs.                                                                                                                                                                                                                                                                                                                                                 |
| `PUT /hr/payroll/tax-regimes`                       | `hr.payroll_settings.write` | `{ financialYear, regime: OLD\|NEW, version (0 = new), standardDeduction, rebateIncomeLimit, rebateMaxAmount, cessPercent, section80cLimit?, homeLoanInterestLimit?, slabs: [{ fromIncome, toIncome\|null, ratePercent }] }`. Slabs start at 0 and follow on without gaps; only the last is open (`422 TAX_SLABS_INVALID`). Stale version → `409 VERSION_CONFLICT`. |

### 4.12 Professional Tax (`/hr/payroll/pt-slabs`, `/hr/payroll/pt-location-states`)

| Method & path                                        | Permission                  | Notes                                                                                                                                                                                                                   |
| :--------------------------------------------------- | :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /hr/payroll/pt-slabs?stateCode=`                | `hr.payroll_settings.read`  |                                                                                                                                                                                                                         |
| `POST /hr/payroll/pt-slabs`                          | `hr.payroll_settings.write` | `{ stateCode, minMonthlyWage, maxMonthlyWage?, monthlyAmount, specialMonth?, specialAmount?, applicableMonths?, effectiveFrom, effectiveTo? }`. Overlapping range for the same state and dates → `409 PT_SLAB_OVERLAP`. |
| `PATCH /hr/payroll/pt-slabs/:id`                     | `hr.payroll_settings.write` | `{ effectiveTo?, isActive? }` — end or deactivate a slab.                                                                                                                                                               |
| `GET /hr/payroll/pt-location-states`                 | `hr.payroll_settings.read`  |                                                                                                                                                                                                                         |
| `PUT /hr/payroll/pt-location-states/:workLocationId` | `hr.payroll_settings.write` | `{ stateCode }` — the PT state of a work location.                                                                                                                                                                      |

### 4.13 Tax declarations (`/hr/tax-declarations`, `/self-service/tax-declarations`)

Lifecycle: `DRAFT → SUBMITTED → VERIFIED | REJECTED`; `REJECTED → SUBMITTED`.

- A SUBMITTED or VERIFIED declaration is locked for the declarer (`409 TAX_DECLARATION_LOCKED`).
- Every save carries the `version` last read (0 = new).

| Method & path                                                  | Permission                                    | Notes                                                                                                                                                                                                                                                                      |
| :------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /self-service/tax-declarations?financialYear=`            | `employee_self_service.tax_declaration.read`  | Own only.                                                                                                                                                                                                                                                                  |
| `PUT /self-service/tax-declarations/:financialYear`            | `employee_self_service.tax_declaration.write` | `{ version, regime, section80c?, section80d?, hraExemption?, homeLoanInterest?, otherDeductions?, otherIncome?, previousEmployerIncome?, previousEmployerTds?, submit? }` — annual amounts; `submit: true` sends it for verification.                                      |
| `GET /hr/tax-declarations?financialYear=&status=&employeeId=`  | `hr.tax_declaration.read` (scoped)            | Team-scoped.                                                                                                                                                                                                                                                               |
| `GET /hr/tax-declarations/:id`                                 | `hr.tax_declaration.read` (scoped)            |                                                                                                                                                                                                                                                                            |
| `PUT /hr/tax-declarations/employee/:employeeId/:financialYear` | `hr.tax_declaration.write` (scoped)           | On the employee's behalf; write scope enforced (`.own` never).                                                                                                                                                                                                             |
| `POST /hr/tax-declarations/:id/verify`                         | `hr.tax_declaration.approve` (scoped)         | `{ decision: VERIFIED\|REJECTED, note?, verifiedSection80c?, verifiedSection80d?, verifiedHraExemption?, verifiedHomeLoanInterest?, verifiedOtherDeductions? }` (accepted amounts; default = declared). Only SUBMITTED; a rejection needs a note; never one's own (`403`). |

### 4.14 Form 16 Part B (`/hr/tax-declarations/form16`, `/self-service/form16`)

| Method & path                                                           | Permission                          |
| :---------------------------------------------------------------------- | :---------------------------------- |
| `GET /hr/tax-declarations/form16/:employeeId/:financialYear` (+ `/pdf`) | `hr.tax_declaration.read` (scoped)  |
| `GET /self-service/form16/:financialYear` (+ `/pdf`)                    | `employee_self_service.form16.read` |

- **Content:**
  - employer: name, address, PAN, TAN from the settings;
  - employee: with PAN masked;
  - regime;
  - each finalized month: gross, taxable and TDS;
  - totals: gross, taxable salary, other and previous-employer income, deductions allowed, taxable income, tax payable (from the regime's slabs), TDS deducted, previous-employer TDS.
- **Source:** built only from FINALIZED payroll. No finalized month in the year → `422 FORM16_NO_PAYROLL`.
- **Part A** (the TDS certificate) comes from TRACES and is not produced here.

### 4.15 Statutory files & reports (`/hr/payroll/periods/:periodId/reports/*`)

All need `hr.payroll.export.all` (org-wide; `.team` → `403`) and the period's approved run. ECR, ESI, PT and TDS additionally need a **FINALIZED** period (`422 PERIOD_NOT_FINALIZED`).

| Path                 | File                                                                                                                                                                                                                                    |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…/pf-ecr`           | `ECR_YYYYMM.txt` — EPFO ECR v2: `UAN#~#NAME#~#gross#~#EPF wages#~#EPS wages#~#EDLI wages#~#EPF (employee)#~#EPS#~#EPF−EPS diff#~#NCP days#~#0`, whole rupees. Members without a UAN → `422 UAN_MISSING` (listed).                       |
| `…/esi`              | `ESI_YYYYMM.csv` — IP number, IP name, days paid, monthly wages, reason code (1 = zero days, 2 = left), last working day.                                                                                                               |
| `…/professional-tax` | `PT_YYYYMM.csv` — employees with PT deducted.                                                                                                                                                                                           |
| `…/tds`              | `TDS_YYYYMM.csv` — code, name, **full PAN**, regime, taxable earnings, TDS (the basis for 24Q; hence `.all` only).                                                                                                                      |
| `…/journal`          | `Journal_YYYYMM.csv` — balanced debit/credit: each earning as salary expense, employer PF/EDLI/admin and ESI as expenses; PF/ESI/PT/TDS/loan recovery/other deductions and net salary as liabilities. Ledger names are component codes. |
| `…/salary-register`  | `SalaryRegister_YYYYMM.csv` — one row per employee, one column per earning and deduction code in the run, days, LOP, overtime hours, gross, deductions, net.                                                                            |

- **Format:** CSV files carry a UTF-8 byte-order mark, quote every cell and neutralise formulas (`csvCell`).

### 4.16 Additions to earlier sections

- **`POST /hr/payroll/periods/:id/reopen`** (`hr.payroll.reopen.all`), body `{ reason }` (10–500 characters).
  - Only a FINALIZED period can be reopened.
  - It is refused when any salary payment of the period is PAID (`422 PAYROLL_ALREADY_PAID`) or any PF/ESI contribution is no longer PENDING (`422 STATUTORY_ALREADY_REMITTED`).
  - Its effects are in §5.2. The period records `reopenedAt`/`reopenedBy`/`reopenReason`/`reopenCount`.
- **`POST /hr/payslips/:id/regenerate`** (`hr.payroll.write.all`), body `{ reason }` (≥ 10 characters).
  - It rebuilds one payslip's snapshot from its (current, approved-run) entry, e.g. after a bank-detail correction.
  - If the content changed, the version goes up, the reason is recorded and the stored PDF is dropped.
  - A payslip of a superseded run → `422 PAYSLIP_SUPERSEDED`.
- **`POST /hr/payslips/generate`** now takes an optional `reason`. It is required (`422 PAYSLIP_REGENERATION_REASON_REQUIRED`) when an already generated payslip would change.
- **Payslip JSON:** responses include `version`, `regeneratedAt` and `regenerationReason`, but never the stored PDF bytes.
- **Loans:**
  - `POST /hr/loans` now takes `overrideReason?` and returns a `PENDING_APPROVAL` loan.
  - `POST /hr/loans/:id/decide` (`hr.loan.approve`) takes `{ decision: APPROVED|REJECTED, note? }`.
  - `POST /hr/loans/:id/prepayments` (`hr.loan.write`) takes `{ amount, receivedOn, reference?, reason }`.
  - `POST /hr/loans/prepayments/:id/decide` (`hr.loan.approve`) takes `{ decision }`.
  - Loan responses include `approver` and `prepayments`.
- **Bonuses:**
  - `POST /hr/bonuses/statutory` (`hr.bonus.write.all`) takes `{ financialYear, create? }`.
  - `GET /hr/bonuses/gratuity/:employeeId?asOf=` (`hr.bonus.read`).
  - `POST /hr/bonuses/gratuity` (`hr.bonus.write`) takes `{ employeeId, asOf, payrollPeriodId? }`.
  - Bonus type `GRATUITY` is added.
- **Payroll settings (§4.2a)** have these new fields, all optional in `PATCH`:
  - pay days and attendance: `payDaysMode`, `useAttendance`, `unmarkedDaysAsAbsent`;
  - overtime: `overtimeEnabled`, `overtimeRatePerHour` (nullable), `overtimeMultiplier`, `standardHoursPerDay`;
  - PF split: `pfCapAtCeiling`, `epsRate`, `epsWageCeiling`, `epsAgeLimit`, `edliRate`, `edliWageCeiling`, `pfAdminRate`;
  - PT and TDS: `ptEnabled`, `ptDefaultStateCode`, `tdsEnabled`, `defaultTaxRegime`;
  - statutory bonus and gratuity: `bonusEligibilityLimit`, `bonusCalculationCeiling`, `bonusPercent`, `gratuityCap`, `gratuityMinYears`;
  - loans: `loanMaxMultiple`, `loanMaxEmiPercent`;
  - employer details: `companyName`, `companyAddress`, `companyGstin`, `companyPan`, `companyTan`, `pfEstablishmentCode`, `esiEmployerCode` (`null` or `""` clears them).
- **Payroll entries:** responses include `absentDays`, `overtimeMinutes`, `payDaysMode`, `payDaysDivisor`, `attendanceLockId`, `taxRegime` and `taxableEarnings`.

---

## 5. UI/UX Designer & Frontend Engineering Guide

### 5.0 What is built (status 2026-10-09)

A deliberately simple, standards-compliant first version — meant as the base for UI polish, not the final design.

**Navigation.** Two sidebar entries under HR (menu rows `hr-payroll` order 16, `hr-compliance` order 17, `permission: null` in `packages/database/prisma/seed.ts` — run `pnpm --filter database seed`). Each screen is a tab bar; a tab appears only when the user can read it, and with no readable tab the screen shows a "No access" alert.

| Route            | Tab            | Shown when the user has (any of `.own`/`.team`/`.all` unless noted) | Status                                          |
| :--------------- | :------------- | :------------------------------------------------------------------ | :---------------------------------------------- |
| `/hr/payroll`    | Periods & runs | `hr.payroll.read`                                                   | **Built**                                       |
|                  | Salaries       | `hr.salary.read`                                                    | Placeholder                                     |
|                  | Bonuses        | `hr.bonus.read`                                                     | **Built**                                       |
|                  | Loans          | `hr.loan.read` or `employee_self_service.loan.read` (exact)         | **Built**                                       |
|                  | Payslips       | `hr.payslip.read` or `employee_self_service.payslip.read` (exact)   | **Built**                                       |
|                  | Payments       | `hr.payment.read`                                                   | **Built** (batches need an `.all` grant — §4.8) |
|                  | Salary report  | `hr.payroll.read`                                                   | **Built**                                       |
| `/hr/compliance` | PF             | `hr.pf.read`                                                        | **Built**                                       |
|                  | ESI            | `hr.esi.read`                                                       | **Built**                                       |

**Periods & runs** (`components/PeriodsPanel.tsx`, `PeriodDialogs.tsx`, `EntriesDialog.tsx`, `PayrollLifecycle.tsx`)

- Period list: year / status filters, pagination, **New period** (`hr.payroll.write`) with year, month and optional start/end dates; end before start is blocked client-side.
- **Manage** opens the period detail: a progress tracker (Period created → Payroll run → Approved → Finalized, with a "Next:" hint) and the runs table (run #, status — cancelled runs say "Replaced by a later run", employees, run by + time, notes, approved by).
- **Run payroll** (`hr.payroll.write`, period not finalized/cancelled): _All eligible employees_ or _Selected employees only_ (added one at a time with the employee picker, at least one required) plus optional notes.
- **Approve** (`hr.payroll.approve`, run `PROCESSED`): optional notes. Not offered to the run's creator ("You ran this — someone else must approve"); if the API still refuses (plain `403`, `error: "Forbidden"`, message starting "Maker-checker:") the dialog explains why (§5.2).
- **Finalize** (`hr.payroll.finalize`): disabled until a run is `APPROVED`; confirmation warns that the period gets locked and payslips generated. **Cancel period** (`hr.payroll.write`).
- **View entries**: per-employee table (payable/LOP days, gross, deductions, net) → **View** shows one employee's calculation (attendance, monthly gross, per-day rate, earning ratio, base earnings, earnings and deductions tables, totals, payslip number once issued).

**Salary report** (`components/SalaryReportPanel.tsx`, rules in `salary-report.ts`)

- Reads the saved run — never recalculates (Docs/HR_LEGACY_PARITY.md §3.14). Period selector lists non-cancelled periods with a processed/approved run; run defaults to the approved one, else the latest processed one (then a "Not yet approved" warning).
- Filters: **Team**, **Department** (options taken from the run's own employees), employee name/code search. All client-side, after loading every page of the run's entries (cap 5,000 rows).
- Columns: employee, team / department, payable days, LOP, gross, PF, ESI, loan EMI, other deductions, net payable; summary cards and a totals line. Totals are summed in integer paise.
- **Export CSV** of the filtered rows plus a totals row: `salary-report-YYYY-MM-runN.csv`, UTF-8 with BOM, every cell quoted, a leading `= + - @` prefixed with `'`.

**PF / ESI** (`components/CompliancePanel.tsx` — one component, configured per kind)

- **Registration:** pick an employee → the profile loads into a form, or "No PF/ESI profile yet" when the API answers `404`. Fields: applicable (checkbox), UAN + PF number (PF) / ESI (IP) number (ESI), effective from / to. Saving needs `hr.pf.write` / `hr.esi.write`; without it the form is read-only. UI-only format rules: UAN 12 digits, ESI number 10 or 17 digits, end date not before start.
- **Contributions:** read-only list (created by payroll runs) with period and payment-status filters sent to the API; columns employee, period, covered, PF/ESI wage, employee share, employer share, payment status, salary credited.
- Profile writes are scope-checked by the API (`404` outside the caller's teams or organization, `.own` never writes) — fixed in commit `5c032cd`, see TC-PAY-21.

**Loans** (`components/LoansPanel.tsx`, `LoanDialogs.tsx`)

- **My loans** (`employee_self_service.loan.read`): the signed-in employee's loans, read-only. Hidden — not an error — for an account with no employee record (`403 NOT_AN_EMPLOYEE`), like the other "My …" sections.
- **Employee loans** (`hr.loan.read`): status filter (default Active); columns loan #, employee, principal, EMI × months, outstanding (sum of `PENDING` installments), disbursed, status + "N skip requests pending".
- **Issue loan** (`hr.loan.write`): employee, principal, months, EMI (with a suggested EMI = principal ÷ months, rounded up), disbursed date, reason. The API's schedule rule is checked first: EMI × months must cover the principal, and EMI × (months − 1) must not.
- **Loan detail:** summary, repayment schedule (installment, due, amount, Pending / Paid / Skipped, paid on), EMI skip requests. **Request EMI skip** (`hr.loan.write`, active loan) picks a non-finalized period and a reason. **Approve / Reject** (`hr.loan.approve`, pending) is not offered to the request's requester or the borrower — "Someone else must decide" instead (mirrors the API's maker-checker rule).

**Bonuses** (`components/BonusesPanel.tsx`)

- Filters: status (default **Pending** = the approval queue), payroll period. Columns: employee, type, amount, period, reason, status + who decided.
- **New bonus** (`hr.bonus.write`): employee, type, amount ≥ ₹1, optional non-finalized period ("an approved bonus is paid by this period's payroll run"), reason.
- **Approve / Reject** (`hr.bonus.approve`, pending) with an optional note. Not offered to the bonus's creator (`createdBy`) or its recipient (`employee.userId`).
- Known API inconsistency: finalization sets a paid bonus to **`PAID`**, but the list filter (`QueryBonusDto`) accepts `PENDING`/`APPROVED`/`PROCESSED`/`REJECTED` and rejects `PAID`, so the UI offers no "Paid" filter. Paid bonuses still show under "All statuses".

**Payslips** (`components/PayslipsPanel.tsx`)

- **My payslips** (`employee_self_service.payslip.read`): own payslips, hidden for `403 NOT_AN_EMPLOYEE`. **Employee payslips** (`hr.payslip.read`): period and employee filters sent to the API; columns payslip #, employee, period, net pay, issued.
- **View** shows the payslip as issued (no extra request — the list row carries everything): designation, department, payable / LOP days, bank + account, PAN, UAN, ESI number, earnings and deductions tables, gross / deductions / net. Account number and PAN arrive **masked** from the API (last four characters).
- **Download PDF** (row and detail): `GET /hr/payslips/:id/pdf`, or `/self-service/payslips/:id/pdf` from "My payslips"; saved as `<payslip number>.pdf`. The button shows a spinner while the API renders it; a failure (e.g. no PDF browser on the server — `PDF_BROWSER_CHANNEL`, Docs/ARCHITECTURE.md §9) becomes an error toast.
- **Generate payslips** (`hr.payroll.write`): lists only periods with status `APPROVED` or `FINALIZED`; re-generating refreshes existing payslips, never duplicates them. Finalizing a period already generates them.

**Payments** (`components/PaymentsPanel.tsx`)

- Batch list: status and period filters; columns batch #, period, employees, total, status, created (date + by). A `.team` / `.own` holder gets the API's `403` and sees "You don't have access to payment batches".
- **New payment batch** (`hr.payment.write`): only `FINALIZED` periods are offered; method Bank transfer / Cash / Cheque. The API refuses a second batch for the period (`PAYMENT_BATCH_EXISTS`) and, for bank transfer, names employees without bank details (`BANK_DETAILS_MISSING`). The new batch opens straight away.
- **Batch detail:** summary, payments table (employee, bank + masked account, amount, method, status, reference, credited on). **Export bank file** downloads the API's CSV (full account numbers — the only place they appear). **Process batch** (`hr.payment.write`, batch `PENDING`) asks for confirmation inline, then marks every pending payment paid.
- **Update** one payment (`hr.payment.write`, not `PAID`/`CANCELLED`): status limited to the API's transitions (Pending → Paid / Failed / Cancelled; Failed → Pending / Paid / Cancelled) and bank reference (e.g. UTR). Confirm and edit steps are inline, not nested dialogs (see the `Dialog` id bug below).

**Loading, error and empty states** (every tab)

- Lists: skeleton rows while loading; a **403** shows "You don't have access to …"; any other failure shows "Something went wrong" with **Try again** (5xx are retried twice first); an empty result explains why (e.g. "Payslips are issued when a payroll period is finalized") and differs when filters are set.
- Dropdowns fed by the API (periods, employees) say "Loading …" / "Could not load …" in their first option and are disabled while loading. Cancelled periods are never offered as a filter.
- Every action button shows a spinner and is disabled while its request runs; server errors appear inline in the dialog (`role="alert"`), business codes in plain English (`format.ts`).
- PF / ESI registration prompts "Choose an employee …" before one is picked.

**Permission handling** (`permissions.ts` — UI visibility only; the API is authoritative)

A button shows only when the API would actually allow the action, not merely when the user holds some grant of the permission:

| Kind of action                    | Needs                                                                                                                    | Examples                                                                                   |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| Read a tab                        | any of `.own` / `.team` / `.all` (the API filters the rows)                                                              | every tab                                                                                  |
| Single-employee write or approval | `.team` or `.all` (`.own` never writes pay; an `.own` approver only sees their own records, which maker-checker forbids) | New bonus, approve bonus, issue loan, decide skip, PF/ESI save, update one payment         |
| Whole-organization action         | `.all` only (`requireOrgWideScope`)                                                                                      | New / cancel period, run, approve, finalize, generate payslips, every payment-batch action |

- Maker-checker is mirrored: run Approve hidden from its creator, bonus and skip decisions hidden from creator / requester / recipient — the server still refuses and the UI explains it.
- Payments with only a `.team` / `.own` payment grant: an info alert ("Payment batches need organization-wide access") instead of a request that would always `403`.
- Self-service sections ("My payslips", "My loans") use the exact `employee_self_service.*` codes.

**Responsive & accessibility**

- Phone width (375px): no page-level horizontal scroll on any tab; tables scroll inside their own wrapper; filter dropdowns stack full-width (`w-full sm:w-48` etc.); dialogs fit the screen.
- Keyboard: tabs follow the ARIA tabs pattern (Arrow / Home / End); in a payment batch, opening the inline confirmation focuses "Yes, process batch" and "Not yet" returns focus to "Process batch"; opening a payment's editor focuses its Status field.
- Screen readers: loading skeletons are `role="status"` with "Loading …" text; every icon-like or repeated button has a specific name ("Download PDF of payslip PS-…", "Update payment for …"); tables have captions; inline errors use `role="alert"`; spinners set `aria-busy`.

**Shared building blocks**

- `Tabs` — `packages/ui-kit/src/components/tabs` (Docs/DESIGN_SYSTEM.md §2).
- `EmployeePicker` — `apps/ui/src/components/widgets/EmployeePicker.tsx` (search + select over `GET /hr/employees`, scope-filtered server-side).
- `OpenPeriodSelect` (periods that are not finalized or cancelled), `PeriodFilterSelect` ("All periods" filter without cancelled periods), `download.ts` (`downloadBlob` / `downloadText`), `DialogParts` (`ServerError`, `DialogActions`), `StatusPill` (loan, repayment, skip, bonus and contribution statuses).
- Feature internals: `api.ts` / `hooks.ts` (query key root `hr-payroll`; every mutation invalidates it), `types.ts`, `schema.ts` (zod), `format.ts` (`money`, `periodLabel`, `describeError` — business error codes mapped to plain-English messages), `permissions.ts`, `QueryState.tsx` (loading / no access / error-with-retry).
- **Known ui-kit bug:** `Dialog` uses a fixed `id="dialog-title"`, so two mounted dialogs share one accessible name. Payroll mounts each dialog only while open; fix `Dialog` with `useId()` in a separate PR.

### 5.1 Target Screens & Layout Hierarchy

The full target. §5.0 says which parts exist today.

```
HR
└── Payroll & Compliance
    ├── 1. Payroll Runs (Overview, Periods, Run Execution, Finalization)
    │      ├── Period List & Period Creation Modal
    │      ├── Run Review Screen (Summary Metrics, Employee Entry Table)
    │      └── Run Comparison / Difference View (vs previous month)
    ├── 2. Salary Structures
    │      ├── Salary Revision Modal / Form
    │      └── Salary History Timeline
    ├── 3. Compliance Dashboard
    │      ├── PF Overview & Monthly Contribution Table
    │      └── ESI Overview & Monthly Contribution Table
    ├── 4. Loans & Advances
    │      ├── Active Loans Table & Issue Loan Modal
    │      ├── Amortization Schedule Drawer
    │      └── Skip Requests Review Queue (Maker-Checker)
    ├── 5. Bonuses
    │      ├── Bonus Requests & Approvals Queue
    │      └── New Bonus Allocation Modal
    ├── 6. Payslips
    │      ├── HR Payslip Explorer (Search, Filter by Department/Team)
    │      └── Payslip Document View (Print / Download Template)
    └── 7. Disbursal & Bank Batches
           ├── Batch Generation & Status Tracker
           ├── Bank CSV Export Action
           └── Mark as Paid / Reconciliation Confirmation
```

### 5.2 State Machines & Action Button Rules

#### Period State Transitions

- `DRAFT` $\to$ `PROCESSED` (run executed) $\to$ `APPROVED` (run approved) $\to$ `FINALIZED` (finalized). A re-run from `PROCESSED` or `APPROVED` returns the period to `PROCESSED` and cancels the earlier run. `DRAFT`/`CANCELLED` can be set via PATCH on a non-finalized period.
- `FINALIZED` $\to$ `REOPENED` (`POST …/reopen`, `hr.payroll.reopen.all`, reason ≥ 10 characters). It is refused once any salary payment of the month is PAID or PF/ESI is remitted. In one transaction under the period lock it:
  - cancels the period's payment batches and their unpaid payments;
  - returns the installments the run settled to PENDING and reactivates loans closed by them;
  - returns the bonuses it paid to APPROVED;
  - clears its arrears stamp;
  - puts the approved run back to PROCESSED, so it needs a fresh approval by a second person.

  From `REOPENED` the period follows the normal path (re-run or approve → `APPROVED` → `FINALIZED`). Re-finalizing regenerates any payslip whose content changed as a new version with reason `Period reopened: <reason>`.

- **"Run Payroll" Button:** Enabled when status is `DRAFT`, `PROCESSED` or `APPROVED` (warn on `APPROVED`: _"This replaces the approved run; it must be approved again."_). Disabled for `FINALIZED`/`CANCELLED`.
- **"Approve Run" Button:** Hide for the user who created the run (maker-checker, API returns `403`). _Current UI:_ shown for any `PROCESSED` run to users with `hr.payroll.approve`; the API's maker-checker `403` is shown as "You created this, so someone else must approve it." (told apart from a missing-permission `403` by its "Maker-checker:" message — there is no dedicated error code). Follow-up: hide it when `runCreator.id` (a user id) equals the signed-in user.
- **"Finalize Period" Button:** Enabled **only** when the period is `APPROVED` (_current UI:_ when the period has an `APPROVED` run). Show confirmation modal warning: _"Finalizing will lock all calculations, settle loan repayments, and generate official payslips. This action is irreversible."_

#### Payment Batch State Transitions

- `PENDING` $\to$ `PROCESSED` (once). A batch can be created only for a `FINALIZED` period, and only one non-cancelled batch per period.
- **"Download Bank CSV" Button:** Available immediately upon batch creation (`PENDING` or `PROCESSED`).
- **"Process Disbursal" Button:** Enabled only for `PENDING`; changes status to `PROCESSED` and transitions `PENDING` line items to `PAID`.

### 5.3 Form Field Validation Specifications

"API" = enforced by the backend (violations return `400`); "UI" = recommended client-side rule only, not enforced by the API.

| Field                          | Type    | Rules                                                                                     | Enforced by |
| :----------------------------- | :------ | :---------------------------------------------------------------------------------------- | :---------- |
| `year`                         | Integer | Min 2000, Max 2100                                                                        | API         |
| `month`                        | Integer | 1 through 12                                                                              | API         |
| salary amounts                 | Number  | $\ge 0$                                                                                   | API         |
| `grossMonthly`                 | Number  | $> 0$, 2 decimal places                                                                   | UI          |
| `basic`                        | Number  | $> 0$, must be $\le \text{grossMonthly}$                                                  | UI          |
| `panNumber`                    | String  | 10 chars, regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` (upper-cased by the API first)               | API         |
| `ifscCode`                     | String  | 11 chars, regex `^[A-Z]{4}0[A-Z0-9]{6}$` (upper-cased by the API first)                   | API         |
| `aadhaarNumber`                | String  | 12 digits regex `^[0-9]{12}$`                                                             | API         |
| `uan`                          | String  | 12 digits regex `^[0-9]{12}$`                                                             | UI          |
| `accountNumber`                | String  | API: 6–20 letters/digits after removing spaces. UI: recommend 9–18 digits `^[0-9]{9,18}$` | API + UI    |
| loan `emiAmount` × `emiMonths` | Number  | Must cover `principalAmount`; last installment $0 < x \le$ EMI                            | API         |

---

## 6. QA & Test Automation Guide

### 6.1 Test Suites Overview

- **Unit Tests:** `apps/api/src/modules/hr/payroll/**/*.spec.ts`
  - `payroll-calculator.service.spec.ts`: Tests statutory PF capping, ESI ceiling on the recurring wage, ESI wage without bonus, LOP prorating, weekly offs & holiday exclusions, scheduled loan installments (none due, skipped, adjusted last installment, not fitting net pay), one-time arrears, bonus inclusion.
  - `payroll-periods.service.spec.ts`: Tests period creation/duplicates, org-wide scope enforcement, and that finalize delegates to the locked repository transaction.
  - `payslip-pdf.template.spec.ts` / `payslip-pdf.service.spec.ts`: payslip HTML escaping, amount formatting, masked values, and that PDFs go through the scoped payslip reads.
- **Rule unit tests (pure functions):** `runs/payroll-engine.rules.spec.ts` (pay-days divisor, earning ratio, attendance absence, overtime, PF/EPS/EDLI split, EPS age, ESI contribution period, PT slabs, financial year), `tax/tds.rules.spec.ts` (slabs, rebate, cess, old/new deductions, projection), `loans/loan.rules.spec.ts` (schedule, limits, prepayment order), `bonuses/statutory-bonus.rules.spec.ts` (statutory bonus, gratuity), `salary-components/salary-template.rules.spec.ts`, `reports/payroll-reports.rules.spec.ts` (ECR line, CSV, balanced journal, tax-slab contiguity), `shared/payslip-snapshot.spec.ts` (key-order-independent snapshot comparison).
- **E2E — statutory engine:** `apps/api/test/payroll-statutory.e2e-spec.ts`. It covers:
  - settings and masters, with the permission checks;
  - a salary from a template, where `.team` and `.own` writes outside scope get `404`;
  - PT slab overlap; tax slab validation; a declaration submitted, locked and verified by a second person;
  - a run refused without approved attendance, then absences, overtime, PF/EPS, PT and TDS;
  - payslip PDF bytes unchanged after a company-name change;
  - reports: org-wide only, ECR format, balanced journal;
  - reopen: org-wide, reason, re-approval, payslip version 2, audit rows; refused once paid;
  - loan over-limit override, team approver refused, prepayment;
  - statutory bonus, gratuity, Form 16.
- **E2E Integration Tests:** `apps/api/test/payroll.e2e-spec.ts` (runs with `useAttendance` off; loans are approved by the checker)
  - Runs 13 sequential integration scenarios against real PostgreSQL and Redis databases: the full May cycle, maker-checker, team-scope boundaries (salaries, PF/ESI profile writes incl. another organization, org-wide operations), payslip PDF download scope (8b), cross-organization payslip generation, run supersession, duplicate batch/processing, loan skip re-scheduling and closure, one-time arrears and ESI with a bonus month. Entries are also checked to carry the employee's team and department.
  - The PDF renderer is replaced by a stub in this suite, so it needs no browser; the PDF layout itself is covered by the template unit test.
- **Browser (UI) E2E Tests — Playwright:** `apps/ui/e2e/`

  | Spec                               | Covers                                                                                                                                                                                                                                                                              | Data                                                         |
  | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
  | `hr-payroll.spec.ts`               | Sidebar → Payroll / Compliance; every tab; mouse + keyboard (Arrow / Home) tab switching; period form blocks end < start without a request; create period → Manage → Run payroll → Cancel period                                                                                    | Real API + dev DB                                            |
  | `hr-payroll-processing.spec.ts`    | Lifecycle tracker steps; run for _selected_ employees (validation, exact POST body); run notes; entries → one employee's calculation → back; maker-checker `403` explained                                                                                                          | Real sign-in, payroll API from fixtures                      |
  | `hr-payroll-salary-report.spec.ts` | Reads **all** pages of a run; paise-exact totals; search; Team / Department filters; "Not yet approved" warning; CSV name, header, rows, totals row, formula neutralised                                                                                                            | Real sign-in, payroll API from fixtures                      |
  | `hr-compliance.spec.ts`            | PF and ESI tabs load (real API); PF registration from "no profile yet" with UAN check and exact PUT body; ESI profile prefilled, end-before-start blocked, update body; contributions filters                                                                                       | Real API (test 1), then fixtures                             |
  | `hr-payroll-loans.spec.ts`         | "My loans" hidden for `NOT_AN_EMPLOYEE`; Issue loan schedule checks (under-/over-covering EMI) and exact POST body; outstanding; schedule; skip approve; requester sees no decision; request a skip                                                                                 | Real sign-in, loans API from fixtures                        |
  | `hr-payroll-bonuses.spec.ts`       | Create-bonus validation and exact POST body; default Pending queue; Approve/Reject hidden for a bonus the admin created; reject with note; status filter                                                                                                                            | Real sign-in, bonuses API from fixtures                      |
  | `hr-payroll-payslips.spec.ts`      | "My payslips" hidden for `NOT_AN_EMPLOYEE`; HR list; payslip breakdown with masked bank/PAN; PDF download from the HR route and from "My payslips" (self-service route); period + employee filters; Generate validation and body; error state → Try again → empty state             | Real sign-in, payslips API from fixtures                     |
  | `hr-payroll-payments.spec.ts`      | Empty state; New batch offers only finalized periods, validation, exact POST body, opens the batch; payments table; bank-file download; Process batch confirm / cancel / confirm; Update offers only allowed statuses, exact PATCH body; PAID payment not editable; `403` explained | Real sign-in, payments API from fixtures                     |
  | `hr-payroll-permissions.spec.ts`   | Team lead: no New period / Generate payslips / payment batches (info alert, no request) but New bonus; `.own` employee: only readable tabs, no write buttons, "My payslips" only                                                                                                    | Real sign-in, `/auth/me` permissions swapped, empty fixtures |
  | `portal-payslips-loans.spec.ts`    | Portal **My Payslips** / **My Loans** tabs for an employee with only self-service codes: own payslip and loan (incl. "Awaiting approval") shown; no `/hr/*` request made                                                                                                            | API fully mocked                                             |
  | `hr-payroll-responsive.spec.ts`    | 375px viewport: every payroll and compliance tab without page-level horizontal scroll; filters stack; tabs operable by Arrow keys                                                                                                                                                   | Real sign-in, empty fixtures                                 |

  Fixture-backed specs exist because a dev DB usually has no employees, salaries or processed runs, and approval needs a second user. They prove UI behaviour; the API e2e suite proves the numbers.

### 6.2 Test Scenarios & Edge Cases Matrix

| Test Case     | Scenario / Condition                                                                                                                                | Expected Result                                                                                                                                                      |
| :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-PAY-01** | Create two periods for the same year and month (e.g., 2026-05)                                                                                      | First succeeds (201); Second fails with **409 Conflict** (`DUPLICATE_PERIOD`).                                                                                       |
| **TC-PAY-02** | Finalize period without an `APPROVED` payroll run                                                                                                   | Fails with **422 Unprocessable Entity** (`NO_APPROVED_RUN`).                                                                                                         |
| **TC-PAY-03** | Finalize an already `FINALIZED` period                                                                                                              | Fails with **422 Unprocessable Entity** (`PAYROLL_ALREADY_FINALIZED`).                                                                                               |
| **TC-PAY-04** | Employee joins mid-month (e.g., joined May 16th in a 31-day month)                                                                                  | First 15 days count as LOP. Earning ratio = $16 / 31$. Gross and base components prorated accordingly.                                                               |
| **TC-PAY-05** | Employee with Basic ₹25,000 (exceeds ₹15,000 PF statutory ceiling)                                                                                  | PF Wage capped at ₹15,000. Employee contribution exactly ₹1,800.00.                                                                                                  |
| **TC-PAY-06** | Employee with Gross ₹20,000 ($\le$ ₹21,000 ESI ceiling)                                                                                             | ESI Wage = ₹20,000. Employee contribution = ₹150.00 (0.75%).                                                                                                         |
| **TC-PAY-07** | Employee with Gross ₹50,000 ($>$ ₹21,000 ESI ceiling)                                                                                               | ESI deduction is ₹0.00. `esiIncluded` = false.                                                                                                                       |
| **TC-PAY-08** | Active loan with approved EMI skip request for the period                                                                                           | Loan EMI is not deducted in this payroll run; the installment is `SKIPPED` and a new one is appended at the end.                                                     |
| **TC-PAY-09** | Bank transfer batch CSV export                                                                                                                      | Headers `Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Amount,Payment Method,Status,Payment Reference`; no PAN; formula-prefixed names neutralised. |
| **TC-PAY-10** | Team-scoped access control                                                                                                                          | Manager of Team A cannot view or change payslips or salaries of Team B employees (**404**), and cannot run org-wide operations (**403**).                            |
| **TC-PAY-11** | Self-service isolation                                                                                                                              | User A calling `/self-service/payslips` only sees payslips linked to User A's employee record.                                                                       |
| **TC-PAY-12** | Creator approves own run / bonus / skip request                                                                                                     | **403 Forbidden** (maker-checker).                                                                                                                                   |
| **TC-PAY-13** | Second run after the first was approved                                                                                                             | First run → `CANCELLED`; only the new run can be approved and paid.                                                                                                  |
| **TC-PAY-14** | Payment batch before finalize / second batch / process twice                                                                                        | **422** `PERIOD_NOT_FINALIZED` / **409** `PAYMENT_BATCH_EXISTS` / **422** `BATCH_ALREADY_PROCESSED`.                                                                 |
| **TC-PAY-15** | Payslip generation with another organization's period id                                                                                            | **404**; nothing created.                                                                                                                                            |
| **TC-PAY-16** | Loan after its final installment is paid                                                                                                            | Loan `CLOSED`; no further EMI.                                                                                                                                       |
| **TC-PAY-17** | Arrears set once                                                                                                                                    | Paid in the next finalized period only.                                                                                                                              |
| **TC-PAY-18** | ESI-covered employee with a bonus                                                                                                                   | ESI wage excludes the bonus.                                                                                                                                         |
| **TC-PAY-19** | Download payslip PDF: HR with `hr.payslip.read`; user without it; unknown id                                                                        | `200 application/pdf` attachment `PS-….pdf` with masked bank/PAN; **403**; **404**.                                                                                  |
| **TC-PAY-20** | Self-service PDF of own vs another employee's payslip                                                                                               | Own → `200`; another's → **404**.                                                                                                                                    |
| **TC-PAY-21** | Team lead (`hr.pf.write.team` / `hr.esi.write.team`) saves a PF / ESI profile for own team, another team; admin for another organization's employee | Own team → `200`; another team → **404**; other organization → **404**; no profile row created for the refused ones.                                                 |

#### UI test cases (manual or Playwright)

| Test Case    | Steps                                                                               | Expected Result                                                                                                                                        |
| :----------- | :---------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-UI-01** | User with no payroll / compliance permission opens HR → Payroll and HR → Compliance | "No access" alert; no tabs.                                                                                                                            |
| **TC-UI-02** | User with only `hr.salary.read.team` opens Payroll                                  | Only the Salaries tab; Periods & runs and Salary report hidden.                                                                                        |
| **TC-UI-03** | New period with end date before start date                                          | Inline "End date cannot be before start date"; no request sent.                                                                                        |
| **TC-UI-04** | New period for a year+month that already exists                                     | Dialog stays open with the API's conflict message.                                                                                                     |
| **TC-UI-05** | Run payroll → "Selected employees only" with nobody added                           | "Add at least one employee"; no request sent.                                                                                                          |
| **TC-UI-06** | Run payroll when no employee has a salary for the period                            | Dialog shows "Some employees have no salary structure for this period…".                                                                               |
| **TC-UI-07** | Creator of a run clicks Approve                                                     | Dialog shows "You created this, so someone else must approve it."; run stays Processed.                                                                |
| **TC-UI-08** | Finalize before any run is approved                                                 | Finalize button disabled.                                                                                                                              |
| **TC-UI-09** | Salary report on a processed (unapproved) run                                       | "Not yet approved" warning.                                                                                                                            |
| **TC-UI-10** | Salary report: Team + Department combination nobody matches                         | "No matching employees"; totals ₹ 0.00; Export CSV disabled.                                                                                           |
| **TC-UI-11** | Export CSV with an employee named `=HYPERLINK("x")`                                 | Cell exported as `'=HYPERLINK("x")` (shown as text in Excel).                                                                                          |
| **TC-UI-12** | Keyboard only: Tab to the tab bar, Arrow Right / Left, Home / End                   | Focus and selection move together; only the selected tab is in the Tab order.                                                                          |
| **TC-UI-13** | PF tab: pick an employee with no profile                                            | "No PF profile yet"; form ready to fill (read-only without `hr.pf.write`).                                                                             |
| **TC-UI-14** | PF: UAN with 11 digits / ESI: number with 12 digits                                 | "UAN is 12 digits" / "ESI number is 10 or 17 digits"; no request sent.                                                                                 |
| **TC-UI-15** | Team lead (`.team` grants) opens the PF tab and searches the employee picker        | Only employees of the team lead's own teams are listed (writes outside them are refused by the API — TC-PAY-21).                                       |
| **TC-UI-16** | Issue loan: principal 12,000, 12 months, EMI 900 → then EMI 2,000                   | "EMI × months must cover the principal" → "Too many months: the last installment would be empty"; no request.                                          |
| **TC-UI-17** | Loans tab for an account with no employee record                                    | No "My loans" section and no error; Employee loans list still works.                                                                                   |
| **TC-UI-18** | Open a loan with a skip request you raised (or as the borrower)                     | "Someone else must decide" instead of Approve / Reject.                                                                                                |
| **TC-UI-19** | Request EMI skip without a period                                                   | "Choose a payroll period"; finalized/cancelled periods are not offered.                                                                                |
| **TC-UI-20** | Bonuses tab default view                                                            | Status filter = Pending (the approval queue).                                                                                                          |
| **TC-UI-21** | Bonus you created, or one for yourself                                              | No Approve / Reject; "Someone else must decide".                                                                                                       |
| **TC-UI-22** | New bonus with no employee / type / amount                                          | Three inline errors; no request.                                                                                                                       |
| **TC-UI-23** | Payslips tab as an account with no employee record                                  | No "My payslips" section and no error.                                                                                                                 |
| **TC-UI-24** | View a payslip                                                                      | Earnings, deductions and totals match the run entry; bank account and PAN show only their last four characters.                                        |
| **TC-UI-25** | Download PDF (HR list, detail, and "My payslips")                                   | A `<payslip number>.pdf` file is saved; "My payslips" uses `/self-service/payslips/:id/pdf`. With no PDF browser on the server an error toast appears. |
| **TC-UI-26** | Generate payslips                                                                   | Only approved / finalized periods are offered; no period → inline error, no request; success toast with the count.                                     |
| **TC-UI-27** | New payment batch                                                                   | Only finalized periods offered; a second batch for the same period is refused with a plain-English message; missing bank details names the employees.  |
| **TC-UI-28** | Process batch                                                                       | Needs confirmation; afterwards pending payments show Paid and the button disappears.                                                                   |
| **TC-UI-29** | Update a payment                                                                    | Paid / Cancelled payments have no Update; status choices follow the allowed transitions; reference saved.                                              |
| **TC-UI-30** | Payments tab with only a `.team` grant                                              | "You don't have access to payment batches" (the API needs `.all`).                                                                                     |
| **TC-UI-31** | Any list while the API fails (stop the API)                                         | Skeleton, then "Something went wrong" + Try again; after restarting the API, Try again loads the data.                                                 |
| **TC-UI-32** | Team lead (`.team` payroll/payment grants) opens Payroll                            | No New period, Run, Approve, Finalize, Generate payslips or payment-batch buttons; Payments shows the organization-wide-access note.                   |
| **TC-UI-33** | Employee with only `.own` grants                                                    | Only readable tabs; no write or approve buttons anywhere; "My payslips" shows.                                                                         |
| **TC-UI-34** | Run created by you, status Processed                                                | No Approve; "You ran this — someone else must approve".                                                                                                |
| **TC-UI-35** | Phone (375px) — every tab                                                           | No sideways page scroll; wide tables scroll on their own; filters stacked.                                                                             |
| **TC-UI-36** | Keyboard only: Payments → open batch → Process batch → Not yet → Update payment     | Focus lands on "Yes, process batch", back on "Process batch", then on the Status field.                                                                |

### 6.3 How to Run Tests Locally

```bash
# 1. Run Unit Tests
pnpm --filter api test

# 2. Run E2E Integration Suite (requires Postgres and Redis running)
# PowerShell (bash: export DATABASE_URL=... / export REDIS_URL=...)
$env:DATABASE_URL="postgresql://texawave:texawave@localhost:5432/texawave_erp_test?schema=public"
$env:REDIS_URL="redis://localhost:6379/5"
pnpm --filter api test:e2e test/payroll.e2e-spec.ts

# 3. Browser (UI) E2E — needs api (:3000) and ui (:3001) running against the
#    seeded dev DB (`pnpm --filter database seed` adds the Payroll/Compliance menu rows)
pnpm --filter ui exec playwright install chromium   # once
pnpm --filter ui test:e2e e2e/hr-payroll.spec.ts e2e/hr-payroll-processing.spec.ts e2e/hr-payroll-salary-report.spec.ts e2e/hr-payroll-loans.spec.ts e2e/hr-payroll-bonuses.spec.ts e2e/hr-payroll-payslips.spec.ts e2e/hr-payroll-payments.spec.ts e2e/hr-payroll-permissions.spec.ts e2e/hr-payroll-responsive.spec.ts e2e/hr-compliance.spec.ts

# 4. Monorepo Typecheck & Lint
pnpm -r run typecheck
pnpm --filter api run lint
pnpm --filter ui run lint
```

**If the Playwright / Chromium download is blocked** (`cdn.playwright.dev` timeout), run the browser tests in the installed Microsoft Edge through a throw-away config — don't commit it:

```ts
// apps/ui/playwright.edge.tmp.config.ts
import base from "./playwright.config";
export default {
  ...base,
  projects: [{ name: "edge", use: { ...(base.use ?? {}), channel: "msedge" } }],
};
```

```bash
cd apps/ui && pnpm exec playwright test -c playwright.edge.tmp.config.ts e2e/hr-payroll*.spec.ts e2e/hr-compliance.spec.ts
```

The same blocked download affects payslip PDFs on the API — set `PDF_BROWSER_CHANNEL=msedge` in `apps/api/.env` (§4.7).

**Troubleshooting: every payroll call returns `500`, API log says `hr.payroll_periods does not exist`.** The dev DB has the payroll tables in the `public` schema (from an earlier version of the payroll migration) while `prisma migrate status` reports "up to date". Check with `SELECT to_regclass('hr.payroll_periods'), to_regclass('public.payroll_periods');`. Fix by recreating the tables in `hr` from the two payroll migration files (and copying any rows across), or with `pnpm --filter database exec prisma migrate reset` if local data can be discarded.
