# HR → Payroll & Compliance — Technical Specification & Guide

> **Target Audience:** Frontend Engineers, UI/UX Designers, and QA / Test Automation Engineers.  
> **Backend Module:** `apps/api/src/modules/hr/payroll/`  
> **Database Migrations:** `20261005115640_add_hr_payroll_and_compliance`, `20261007102758_payroll_one_time_arrears`  
> **Monorepo Packages:** `@texawave-erp/database`, `apps/api`

---

## 1. Overview & Architectural Principles

The **Payroll & Compliance** module provides automated, reproducible, and compliant payroll processing for TexaWave ERP. It handles salary structuring, attendance & leave integration (including Loss of Pay), statutory Indian compliance (Provident Fund & Employee State Insurance), employee loans/advances with skip EMI workflows, bonuses, point-in-time immutable payslip generation, and bank payment batch disbursal.

### Key Backend Rules for Consumers

1. **Authentication:** All routes require a valid Bearer token in the `Authorization: Bearer <token>` header (`JwtAuthGuard`). Unauthenticated requests receive `401 Unauthorized`. Obtain a token via `POST /auth/login` with body `{ "organizationSlug": "texawave-innovations", "email": "...", "password": "..." }` — the response contains `accessToken` and `refreshToken` (renew with `POST /auth/refresh`). Local dev seed super admin: `admin@texawave.com` / `ChangeMe123!` (never use outside local dev).
   - **Permissions** are not set in the client — they come from the roles assigned to the logged-in user (`/settings/roles`, `/settings/roles/:id/permissions`, `/users/:id/roles`, `/users/:id/teams`). After changing a user's roles, log in again to get a fresh token.
   - Scoped permissions exist in three variants: `<code>.own`, `<code>.team`, `<code>.all`. Missing permission → `403 Forbidden`.
2. **Tenant & Team Scoping:** All payroll data is strictly team-scoped (`@TeamScoped()`). Users with `.own` can only view their own records; users with `.team` can access employees within their assigned teams (`user_team_access`); users with `.all` have organization-wide visibility. Accessing a record outside the caller's scope returns `404 Not Found`.
   - **Access scope — writes:** single-employee writes (salary, bank details, loan, bonus, a single payment) are held to the same boundary: `.team` only for employees in the caller's teams (others → `404`), `.own` never (nobody edits their own pay → `404`).
   - **Access scope — org-wide operations:** a payroll period, run, payslip generation, finalization and payment batch cover the whole organization, so they require the `.all` grant (`hr.payroll.write.all`, `hr.payroll.approve.all`, `hr.payroll.finalize.all`, `hr.payment.read.all` / `hr.payment.write.all`). A `.team` grant gets `403 Forbidden`. Run headers (`GET /hr/payroll/runs`) are readable with `.team`/`.all`; per-employee entries stay team-filtered.
   - **Maker-checker:** the user who created a payroll run, bonus or loan skip request cannot approve it, and nobody can approve a bonus or skip request for themselves → `403 Forbidden`.
3. **Response Envelope:**
   - Single item responses: `{ "data": { ... } }`
   - Paginated list responses: `{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 } }`
   - Error responses: `{ "statusCode": 422, "message": "...", "error": "ERROR_CODE", "timestamp": "...", "path": "..." }`
   - Status codes: `400` request validation failure (DTO), `401` no/invalid token, `403` missing permission, `404` not found or outside caller's scope, `409` duplicate/conflict, `422` business-rule violation (e.g. `NO_APPROVED_RUN`).
4. **Data Formats:**
   - **Dates:** Strictly `YYYY-MM-DD` string format (ISO calendar date without timestamp or timezone shifts).
   - **Monetary amounts:** Decimal numbers with 2 decimal places (e.g., `50000.00`).
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

| Area                                                                                                      | Status                                                                                                                                                       |
| :-------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attendance / unrecorded absence / half-days                                                               | No attendance module exists. Until it does, LOP comes only from approved unpaid leave + employment window (§3.1).                                            |
| Professional Tax, TDS (income tax)                                                                        | Not implemented — no deduction is made.                                                                                                                      |
| PF: EPS/EPF split, voluntary PF above the wage cap, DA in PF wage                                         | Not implemented; PF wage is `min(Basic, 15000)`.                                                                                                             |
| ESI contribution-period rule (stay covered for the whole Apr–Sep / Oct–Mar period after crossing ₹21,000) | Not implemented; eligibility is decided month by month.                                                                                                      |
| LOP leave-type detection                                                                                  | By leave-type code (`LOP`, `UNPAID`, `*LOSS_OF_PAY*`). An `isPaid` flag on `LeaveType` belongs to the leave module.                                          |
| LOP "sandwich" policy                                                                                     | Leave days are calendar days, so holidays/weekly-offs inside an unpaid leave range count as LOP. Confirm this is the intended policy.                        |
| Loan approval workflow                                                                                    | Loans are created `ACTIVE`; `hr.loan.approve` currently governs skip requests only.                                                                          |
| Encryption at rest of account / PAN / Aadhaar                                                             | Stored in plaintext; masked in every JSON response and audited on change (see §4.9). Needs a key-management decision (and whether Aadhaar is needed at all). |

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
- **Query Params:** `page`, `limit`, `year`, `status` (`DRAFT`, `PROCESSING`, `FINALIZED`, `CANCELLED`)

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

#### `GET /hr/payroll/entries/:id`

Get a single entry with its earnings/deductions breakdown.

- **Permission:** `hr.payroll.read.own` / `.team` / `.all`
- **Response Sample:**
  ```json
  {
    "data": [
      {
        "id": 101,
        "employeeId": 10,
        "totalCalendarDays": 31,
        "requiredWorkingDays": 22,
        "presentDays": 22,
        "payableDays": 31,
        "lopDays": 0,
        "monthlyGross": 50000.0,
        "totalGrossEarnings": 55000.0,
        "totalDeductions": 2800.0,
        "netPayable": 52200.0,
        "earnings": [
          {
            "code": "BASIC",
            "name": "Basic Salary",
            "calculatedAmount": 25000.0
          },
          {
            "code": "HRA",
            "name": "House Rent Allowance",
            "calculatedAmount": 15000.0
          },
          {
            "code": "BONUS",
            "name": "Bonus (PERFORMANCE)",
            "calculatedAmount": 5000.0
          }
        ],
        "deductions": [
          { "code": "PF", "name": "Provident Fund", "amount": 1800.0 },
          { "code": "LOAN", "name": "Loan Repayment", "amount": 1000.0 }
        ]
      }
    ]
  }
  ```

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

### 4.9 Bank Details (`/hr/bank-details`)

#### `PUT /hr/bank-details/:employeeId`

Create or update employee bank account details.

- **Permission:** `hr.salary.write.team` (own teams' employees only — others `404`) / `.all`. `.own` cannot change anyone's bank details, including their own.
- **Request Body:**
  ```json
  {
    "bankName": "HDFC Bank",
    "accountNumber": "50100123456789",
    "ifscCode": "HDFC0001234",
    "panNumber": "ABCDE1234F",
    "aadhaarNumber": "123456789012"
  }
  ```
  `ifscCode` and `panNumber` are upper-cased and `accountNumber` has spaces removed before validation.
- **Audit:** every create/update writes an `audit_logs` row (`entityType: "employee_bank_details"`) with masked before/after values.
- **Response:** the stored record with `accountNumber`, `panNumber`, `aadhaarNumber` masked (e.g. `**********6789`).

#### `GET /hr/bank-details/:employeeId`

Retrieve employee bank account details (masked as above).

- **Permission:** `hr.salary.read.own` / `.team` / `.all`

---

## 5. UI/UX Designer & Frontend Engineering Guide

### 5.1 Required Screens & Layout Hierarchy

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
- **"Approve Run" Button:** Hide for the user who created the run (maker-checker, API returns `403`).
- **"Finalize Period" Button:** Enabled **only** when the period is `APPROVED`. Show confirmation modal warning: _"Finalizing will lock all calculations, settle loan repayments, and generate official payslips. This action is irreversible."_

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
- **E2E Integration Tests:** `apps/api/test/payroll.e2e-spec.ts`
  - Runs 12 sequential integration scenarios against real PostgreSQL and Redis databases: the full May cycle, maker-checker, team-scope boundaries (bank details, salaries, org-wide operations), cross-organization payslip generation, run supersession, duplicate batch/processing, loan skip re-scheduling and closure, one-time arrears and ESI with a bonus month.

### 6.2 Test Scenarios & Edge Cases Matrix

| Test Case     | Scenario / Condition                                               | Expected Result                                                                                                                                                      |
| :------------ | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-PAY-01** | Create two periods for the same year and month (e.g., 2026-05)     | First succeeds (201); Second fails with **409 Conflict** (`DUPLICATE_PERIOD`).                                                                                       |
| **TC-PAY-02** | Finalize period without an `APPROVED` payroll run                  | Fails with **422 Unprocessable Entity** (`NO_APPROVED_RUN`).                                                                                                         |
| **TC-PAY-03** | Finalize an already `FINALIZED` period                             | Fails with **422 Unprocessable Entity** (`PAYROLL_ALREADY_FINALIZED`).                                                                                               |
| **TC-PAY-04** | Employee joins mid-month (e.g., joined May 16th in a 31-day month) | First 15 days count as LOP. Earning ratio = $16 / 31$. Gross and base components prorated accordingly.                                                               |
| **TC-PAY-05** | Employee with Basic ₹25,000 (exceeds ₹15,000 PF statutory ceiling) | PF Wage capped at ₹15,000. Employee contribution exactly ₹1,800.00.                                                                                                  |
| **TC-PAY-06** | Employee with Gross ₹20,000 ($\le$ ₹21,000 ESI ceiling)            | ESI Wage = ₹20,000. Employee contribution = ₹150.00 (0.75%).                                                                                                         |
| **TC-PAY-07** | Employee with Gross ₹50,000 ($>$ ₹21,000 ESI ceiling)              | ESI deduction is ₹0.00. `esiIncluded` = false.                                                                                                                       |
| **TC-PAY-08** | Active loan with approved EMI skip request for the period          | Loan EMI is not deducted in this payroll run; the installment is `SKIPPED` and a new one is appended at the end.                                                     |
| **TC-PAY-09** | Bank transfer batch CSV export                                     | Headers `Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Amount,Payment Method,Status,Payment Reference`; no PAN; formula-prefixed names neutralised. |
| **TC-PAY-10** | Team-scoped access control                                         | Manager of Team A cannot view or change payslips, salaries or bank details of Team B employees (**404**), and cannot run org-wide operations (**403**).              |
| **TC-PAY-11** | Self-service isolation                                             | User A calling `/self-service/payslips` only sees payslips linked to User A's employee record.                                                                       |
| **TC-PAY-12** | Creator approves own run / bonus / skip request                    | **403 Forbidden** (maker-checker).                                                                                                                                   |
| **TC-PAY-13** | Second run after the first was approved                            | First run → `CANCELLED`; only the new run can be approved and paid.                                                                                                  |
| **TC-PAY-14** | Payment batch before finalize / second batch / process twice       | **422** `PERIOD_NOT_FINALIZED` / **409** `PAYMENT_BATCH_EXISTS` / **422** `BATCH_ALREADY_PROCESSED`.                                                                 |
| **TC-PAY-15** | Payslip generation with another organization's period id           | **404**; nothing created.                                                                                                                                            |
| **TC-PAY-16** | Loan after its final installment is paid                           | Loan `CLOSED`; no further EMI.                                                                                                                                       |
| **TC-PAY-17** | Arrears set once                                                   | Paid in the next finalized period only.                                                                                                                              |
| **TC-PAY-18** | ESI-covered employee with a bonus                                  | ESI wage excludes the bonus.                                                                                                                                         |

### 6.3 How to Run Tests Locally

```bash
# 1. Run Unit Tests
pnpm --filter api test

# 2. Run E2E Integration Suite (requires Postgres and Redis running)
# PowerShell (bash: export DATABASE_URL=... / export REDIS_URL=...)
$env:DATABASE_URL="postgresql://texawave:texawave@localhost:5432/texawave_erp_test?schema=public"
$env:REDIS_URL="redis://localhost:6379/5"
pnpm --filter api test:e2e test/payroll.e2e-spec.ts

# 3. Monorepo Typecheck & Lint
pnpm -r run typecheck
pnpm --filter api run lint
```
