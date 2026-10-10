# HR → Payroll & Compliance — Technical Specification & Guide

> **Target Audience:** Frontend Engineers, UI/UX Designers, and QA / Test Automation Engineers.  
> **Backend Module:** `apps/api/src/modules/hr/payroll/`  
> **Frontend Feature:** `apps/ui/src/features/hr/payroll/` (routes `/hr/payroll`, `/hr/compliance` — §5)  
> **Database Migrations:** `20261005115640_add_hr_payroll_and_compliance`, `20261007102758_payroll_one_time_arrears`  
> **Monorepo Packages:** `@texawave-erp/database`, `apps/api`, `apps/ui`, `@texawave-erp/ui-kit`

---

## 1. Overview & Architectural Principles

The **Payroll & Compliance** module provides automated, reproducible, and compliant payroll processing for TexaWave ERP. It handles salary structuring, attendance & leave integration (including Loss of Pay), statutory Indian compliance (Provident Fund & Employee State Insurance), employee loans/advances with skip EMI workflows, bonuses, point-in-time immutable payslip generation, and bank payment batch disbursal.

### Key Backend Rules for Consumers

1. **Authentication:** All routes require a valid Bearer token in the `Authorization: Bearer <token>` header (`JwtAuthGuard`). Unauthenticated requests receive `401 Unauthorized`. Obtain a token via `POST /auth/login` with body `{ "organizationSlug": "texawave-innovations", "email": "...", "password": "..." }` — the response contains `accessToken` and `refreshToken` (renew with `POST /auth/refresh`). Local dev seed super admin: `admin@texawave.com` / `ChangeMe123!` (never use outside local dev).
   - **Permissions** are not set in the client — they come from the roles assigned to the logged-in user (`/settings/roles`, `/settings/roles/:id/permissions`, `/users/:id/roles`, `/users/:id/teams`). After changing a user's roles, log in again to get a fresh token.
   - Scoped permissions exist in three variants: `<code>.own`, `<code>.team`, `<code>.all`. Missing permission → `403 Forbidden`.
2. **Tenant & Team Scoping:** All payroll data is strictly team-scoped (`@TeamScoped()`). Users with `.own` can only view their own records; users with `.team` can access employees within their assigned teams (`user_team_access`); users with `.all` have organization-wide visibility. Accessing a record outside the caller's scope returns `404 Not Found`.
   - **Access scope — writes:** single-employee writes (salary, loan, bonus, a single payment) are held to the same boundary: `.team` only for employees in the caller's teams (others → `404`), `.own` never (nobody edits their own pay → `404`).
   - **Access scope — org-wide operations:** a payroll period, run, payslip generation, finalization and payment batch cover the whole organization, so they require the `.all` grant (`hr.payroll.write.all`, `hr.payroll.approve.all`, `hr.payroll.finalize.all`, `hr.payment.read.all` / `hr.payment.write.all`). A `.team` grant gets `403 Forbidden`. Run headers (`GET /hr/payroll/runs`) are readable with `.team`/`.all`; per-employee entries stay team-filtered.
   - **Maker-checker:** the user who created a payroll run, bonus or loan skip request cannot approve it, and nobody can approve a bonus or skip request for themselves → `403 Forbidden`.
3. **Response Envelope:**
   - Single item responses: `{ "data": { ... } }`
   - Paginated list responses: `{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 } }`
   - Error responses: `{ "statusCode": 422, "message": "...", "error": "ERROR_CODE", "timestamp": "...", "path": "..." }`
   - Status codes: `400` request validation failure (DTO), `401` no/invalid token, `403` missing permission, `404` not found or outside caller's scope, `409` duplicate/conflict, `422` business-rule violation (e.g. `NO_APPROVED_RUN`).
4. **Data Formats:**
   - **Dates:** Strictly `YYYY-MM-DD` string format (ISO calendar date without timestamp or timezone shifts).
   - **Monetary amounts & day counts in responses:** Prisma `Decimal` columns are serialized as **strings with trailing zeros dropped** — `52200.00` arrives as `"52200"`, `21.50` as `"21.5"`. Compare numerically (`Number(x)`), never as strings, and never do money arithmetic on floats in the UI (the salary report sums in integer paise). Request bodies take plain JSON numbers. JSON samples below show numbers for readability.
   - **Primary Keys:** Integers (`Int @id`). Never UUID strings.
5. **Historical Reproducibility:** Historical payroll runs and payslips are **immutable snapshots**. Once a payroll period is finalized, altering employee master data, attendance, or salaries will **never** change historical payroll entries or payslips.

---

## 2. End-to-End Business Flow

```
[Master Setup: Salary + Bank + PF/ESI Profiles]
                    │
                    ▼
       1. Create Payroll Period (DRAFT)
                    │
                    ▼
       2. Trigger Payroll Run (PROCESSED)
          ├─ Calculates Holidays/Weekly-offs, Leaves (LOP),
          │  Earnings, Statutory PF, ESI, Loans, Bonuses, Arrears
          └─ Re-running supersedes the previous PROCESSED/APPROVED
             run (→ CANCELLED): one payable run per period
                    │
                    ▼
       3. Review & Approve Run (APPROVED) — by a different user
                    │
                    ▼
       4. Finalize Period (FINALIZED)
          ├─ Locks Period Calculations
          ├─ Auto-generates Payslips (PS-YYYYMM-NNNNNN)
          ├─ Settles deducted loan installments (PAID);
          │  fully repaid loans → CLOSED
          ├─ Paid bonuses → PAID; paid arrears marked (never re-paid)
                    │
                    ▼
       5. Create Payment Batch (PENDING) — only once FINALIZED,
          │  one active batch per period
          ├─ Export Bank Transfer CSV
          └─ Disburse & Process Batch (PROCESSED / PAID) — once
                    │
                    ▼
       6. Employee Self-Service
          └─ View & Download Payslips / View Active Loans
```

---

## 3. Business Calculation Rules & Statutory Formulae

### 3.1 Attendance & Working Days

- **Total Calendar Days:** Days in the calendar month (e.g., April = 30, May = 31, February = 28 or 29).
- **Weekly Offs:** Calculated from company `WeeklyOffRule` records (typically Saturdays and Sundays).
- **Holidays:** Calculated from company `Holiday` calendar records falling within the period.
- **Required Working Days:**
  $$\text{Required Working Days} = \text{Calendar Days} - (\text{Weekly Offs} + \text{Holidays})$$
- **Loss of Pay (LOP):**
  - Sum of approved leave days with leave type code `LOP`, `UNPAID`, or containing `LOSS_OF_PAY`.
  - Prorated days prior to `dateOfJoining` for employees joining mid-month.
  - Prorated days following `dateOfExit` for employees exiting mid-month.
  - ⚠️ **Attendance is not an input yet** — there is no attendance module. An absence without an approved unpaid-leave request is **not** deducted, `presentDays` is derived (`Required Working Days − leave − LOP`), and `halfDays` is always `0`. See §3.6.
- **Payable Days:**
  $$\text{Payable Days} = \max(0, \text{Total Calendar Days} - \text{LOP Days})$$
- **Earning Ratio:**
  $$\text{Earning Ratio} = \frac{\text{Payable Days}}{\text{Total Calendar Days}}$$

### 3.2 Earnings Prorating

For each salary earning component (`BASIC`, `HRA`, `CONVEYANCE`, `OTHER_ALLOWANCE`, `SPECIAL_ALLOWANCE`):
$$\text{Calculated Component} = \text{Round}\left(\text{Base Component} \times \text{Earning Ratio}, 2\right)$$

- **Arrears & Approved Bonuses:** Added at 100% (earning ratio = `1.0`), not prorated by LOP.
- **Arrears are one-time:** `arrearsSalary` on a salary structure is paid by the first period that is finalized after it is set; finalization stamps `arrearsPaidPeriodId` on the structure and later runs skip it. Changing `arrearsSalary` (PATCH) clears the stamp, i.e. schedules a new one-time payment. Arrears are **not** part of `grossMonthly` (the recurring monthly wage).
- **Total Gross Earnings:** Sum of all calculated earning components.

### 3.3 Statutory Compliance

#### Provident Fund (PF)

- **Applicability:** Checked against `EmployeePfProfile.pfApplicable`.
- **Wage Ceiling:** Statutory ceiling is ₹15,000 per month.
  $$\text{PF Wage} = \min(\text{Calculated Basic}, 15000)$$
- **Employee Contribution:** $12\%$ of PF Wage.
- **Employer Contribution:** $12\%$ of PF Wage, stored as one figure — the EPS (8.33%, capped ₹1,250) / EPF (3.67%) split is **not** modelled yet (§3.6).

#### Employee State Insurance (ESI)

- **Applicability:** Checked against `EmployeeEsiProfile.esiApplicable`.
- **Eligibility ceiling:** ₹21,000 per month, tested against the **recurring** monthly wage (Basic + HRA + Conveyance + Other + Special) — arrears and bonuses do not make an employee ineligible.
- If eligible:
  - $\text{ESI Wage} = \text{Total Gross Earnings} - \text{Bonuses}$ (bonus is not an ESI wage; arrears are)
  - $\text{Employee Contribution} = \text{Round}(\text{ESI Wage} \times 0.0075, 2)$ ($0.75\%$)
  - $\text{Employer Contribution} = \text{Round}(\text{ESI Wage} \times 0.0325, 2)$ ($3.25\%$)
- Otherwise ESI deduction is ₹0.00.

### 3.4 Loans & Advances

- **Schedule:** `emiMonths` installments of `emiAmount`, one month apart starting a month after `disbursedDate`; the **last installment is adjusted** so the schedule sums exactly to `principalAmount`. A loan whose EMI × months does not cover the principal (or over-covers it by a full EMI or more) is rejected (`422 LOAN_SCHEDULE_INVALID`).
- **Deduction:** at most **one** installment per loan per period — the earliest `PENDING` installment due on or before the period end. A loan with nothing due yet deducts nothing. The amount deducted is that installment's amount (so the adjusted last installment is respected).
- **Skip:** approving a `LoanSkipRequest` for a period marks the installment that period would have recovered `SKIPPED` and **appends** a new installment of the same amount one month after the current last one, so the amount is still recovered. The loan deducts nothing in that period. Skip requests cannot be decided for a finalized period. If the period already has a run, re-run it after approving the skip.
- **Settlement:** finalization marks the installments deducted by the approved run `PAID`; a loan with no `PENDING` installment left becomes `CLOSED` and is never deducted again.

### 3.5 Net Payable Formula

$$\text{Total Deductions} = \text{PF} + \text{ESI} + \text{Loan EMI} + \text{Other Deductions}$$
$$\text{Net Payable} = \text{Total Gross Earnings} - \text{Total Deductions}$$

Statutory deductions are always taken. A loan installment is deducted only if it fits in what is left; one that would make net pay negative is **not** deducted and stays `PENDING` (it is recovered in a later period), so a loan is never shown as recovered when it was not.

### 3.6 Not yet modelled (out of scope of this module version)

These are known gaps, not bugs — each needs a business decision or another module first:

| Area                                                                                                      | Status                                                                                                                                |
| :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| Attendance / unrecorded absence / half-days                                                               | No attendance module exists. Until it does, LOP comes only from approved unpaid leave + employment window (§3.1).                     |
| Professional Tax, TDS (income tax)                                                                        | Not implemented — no deduction is made.                                                                                               |
| PF: EPS/EPF split, voluntary PF above the wage cap, DA in PF wage                                         | Not implemented; PF wage is `min(Basic, 15000)`.                                                                                      |
| ESI contribution-period rule (stay covered for the whole Apr–Sep / Oct–Mar period after crossing ₹21,000) | Not implemented; eligibility is decided month by month.                                                                               |
| LOP leave-type detection                                                                                  | By leave-type code (`LOP`, `UNPAID`, `*LOSS_OF_PAY*`). An `isPaid` flag on `LeaveType` belongs to the leave module.                   |
| LOP "sandwich" policy                                                                                     | Leave days are calendar days, so holidays/weekly-offs inside an unpaid leave range count as LOP. Confirm this is the intended policy. |
| Loan approval workflow                                                                                    | Loans are created `ACTIVE`; `hr.loan.approve` currently governs skip requests only.                                                   |

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

#### `POST /hr/payroll/periods/:id/finalize`

Finalizes an approved payroll period in one transaction (period row-locked): generates payslips from the approved run, settles its loan installments (closing fully repaid loans), marks its bonuses `PAID` and its arrears paid.

- **Permission:** `hr.payroll.finalize.all` (`.team` → `403`)
- **Preconditions:** Period must have its (single) `APPROVED` payroll run.
- **Response (200 OK):** Period object with `status: "FINALIZED"`.
- **Errors:**
  - `422 Unprocessable Entity` (`NO_APPROVED_RUN`): no approved run exists.
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
  Required: `employeeId`, `effectiveFrom`, `basic`, `hra`. Optional: `effectiveTo`, `conveyance`, `otherAllowance`, `specialAllowance`, `arrearsSalary`, `grossMonthly`. All amounts must be `>= 0`.

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
- **Query Params:** `employeeId`, `status` (`ACTIVE`, `CLOSED`, `DEFAULTED`), `page`, `limit`

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
  Optional `employeeIds: number[]` restricts the run to specific employees.
- **Org-wide:** `.team` → `403`. Rejected for a `FINALIZED` or `CANCELLED` period (`422 PAYROLL_FINALIZED`).
- **Re-run:** any earlier `PROCESSED` or `APPROVED` run of the period becomes `CANCELLED` (entries too) and the period returns to `PROCESSED` — approve the new run before finalizing.
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
- **E2E Integration Tests:** `apps/api/test/payroll.e2e-spec.ts`
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
