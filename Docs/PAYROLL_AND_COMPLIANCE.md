# HR → Payroll & Compliance — Technical Specification & Guide

> **Target Audience:** Frontend Engineers, UI/UX Designers, and QA / Test Automation Engineers.  
> **Backend Module:** `apps/api/src/modules/hr/payroll/`  
> **Database Migration:** `20261005115640_add_hr_payroll_and_compliance`  
> **Monorepo Packages:** `@texawave-erp/database`, `apps/api`

---

## 1. Overview & Architectural Principles

The **Payroll & Compliance** module provides automated, reproducible, and compliant payroll processing for TexaWave ERP. It handles salary structuring, attendance & leave integration (including Loss of Pay), statutory Indian compliance (Provident Fund & Employee State Insurance), employee loans/advances with skip EMI workflows, bonuses, point-in-time immutable payslip generation, and bank payment batch disbursal.

### Key Backend Rules for Consumers

1. **Authentication:** All routes require a valid Bearer token in the `Authorization: Bearer <token>` header (`JwtAuthGuard`). Unauthenticated requests receive `401 Unauthorized`.
2. **Tenant & Team Scoping:** All payroll data is strictly team-scoped (`@TeamScoped()`). Users with `.own` can only view their own records; users with `.team` can access employees within their assigned teams (`user_team_access`); users with `.all` have organization-wide visibility. Accessing a record outside the caller's scope returns `404 Not Found`.
3. **Response Envelope:**
   - Single item responses: `{ "data": { ... } }`
   - Paginated list responses: `{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 } }`
   - Error responses: `{ "statusCode": 400, "message": "...", "error": "ERROR_CODE", "timestamp": "...", "path": "..." }`
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
          └─ Calculates Attendance, Leaves (LOP),
             Earnings, Statutory PF, ESI, Loans, Bonuses
                    │
                    ▼
       3. Review & Approve Run (APPROVED)
                    │
                    ▼
       4. Finalize Period (FINALIZED)
          ├─ Locks Period Calculations
          ├─ Auto-generates Sequential Payslips (PS-YYYYMM-XXXXX)
          └─ Advances Loan Repayments (PAID)
                    │
                    ▼
       5. Create Payment Batch (PENDING)
          ├─ Export Bank Transfer CSV
          └─ Disburse & Process Batch (PROCESSED / PAID)
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
- **Payable Days:**
  $$\text{Payable Days} = \max(0, \text{Total Calendar Days} - \text{LOP Days})$$
- **Earning Ratio:**
  $$\text{Earning Ratio} = \frac{\text{Payable Days}}{\text{Total Calendar Days}}$$

### 3.2 Earnings Prorating

For each salary earning component (`BASIC`, `HRA`, `CONVEYANCE`, `OTHER_ALLOWANCE`, `SPECIAL_ALLOWANCE`):
$$\text{Calculated Component} = \text{Round}\left(\text{Base Component} \times \text{Earning Ratio}, 2\right)$$

- **Arrears & Approved Bonuses:** Added at 100% (earning ratio = `1.0`), not prorated by LOP.
- **Total Gross Earnings:** Sum of all calculated earning components.

### 3.3 Statutory Compliance

#### Provident Fund (PF)

- **Applicability:** Checked against `EmployeePfProfile.pfApplicable`.
- **Wage Ceiling:** Statutory ceiling is ₹15,000 per month.
  $$\text{PF Wage} = \min(\text{Calculated Basic}, 15000)$$
- **Employee Contribution:** $12\%$ of PF Wage.
- **Employer Contribution:** $12\%$ of PF Wage (split into EPF and EPS internally).

#### Employee State Insurance (ESI)

- **Applicability:** Checked against `EmployeeEsiProfile.esiApplicable`.
- **Gross Salary Ceiling:** Statutory threshold is ₹21,000 gross per month.
- If $\text{Total Gross Earnings} \le 21000$:
  - $\text{ESI Wage} = \text{Total Gross Earnings}$
  - $\text{Employee Contribution} = \text{Round}(\text{ESI Wage} \times 0.0075, 2)$ ($0.75\%$)
  - $\text{Employer Contribution} = \text{Round}(\text{ESI Wage} \times 0.0325, 2)$ ($3.25\%$)
- If $\text{Total Gross Earnings} > 21000$: ESI deduction is ₹0.00.

### 3.4 Loans & Advances

- Active loans with scheduled repayments matching the payroll month are deducted as loan EMI.
- If an employee has submitted a `LoanSkipRequest` that has been `APPROVED`, the EMI is skipped for that period and the loan repayment is not deducted.

### 3.5 Net Payable Formula

$$\text{Total Deductions} = \text{PF} + \text{ESI} + \text{Loan EMI} + \text{Other Deductions}$$
$$\text{Net Payable} = \text{Total Gross Earnings} - \text{Total Deductions}$$

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

Update period metadata or cancel period.

- **Permission:** `hr.payroll.write.all`
- **Request Body:** `{ "status": "CANCELLED" }`

#### `POST /hr/payroll/periods/:id/finalize`

Finalizes an approved payroll period, generates official payslips, and advances loan repayments.

- **Permission:** `hr.payroll.finalize.all`
- **Preconditions:** Period must have at least one `APPROVED` payroll run.
- **Response (200 OK):** Period object with `status: "FINALIZED"`.

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

#### `GET /hr/salaries`

List salary history.

- **Permission:** `hr.salary.read.own` / `.team` / `.all`
- **Query Params:** `employeeId`, `page`, `limit`

#### `GET /hr/salaries/current/:employeeId`

Fetch the currently active salary structure for an employee.

---

### 4.3 Compliance: PF & ESI (`/hr/compliance`)

#### `PUT /hr/compliance/pf/profiles/:employeeId`

Create or update an employee's Provident Fund profile.

- **Permission:** `hr.compliance.pf.write.all`
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

- **Permission:** `hr.compliance.pf.read.own` / `.team` / `.all`

#### `GET /hr/compliance/pf/contributions`

List PF contributions by period or employee.

- **Query Params:** `payrollPeriodId`, `employeeId`, `page`, `limit`

#### `PUT /hr/compliance/esi/profiles/:employeeId`

Create or update an employee's ESI profile.

- **Permission:** `hr.compliance.esi.write.all`
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

- **Permission:** `hr.compliance.esi.read.own` / `.team` / `.all`

#### `GET /hr/compliance/esi/contributions`

List ESI contributions by period or employee.

- **Query Params:** `payrollPeriodId`, `employeeId`, `page`, `limit`

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

#### `GET /hr/loans`

List loans with repayment installments.

- **Permission:** `hr.loan.read.own` / `.team` / `.all`
- **Query Params:** `employeeId`, `status` (`ACTIVE`, `CLOSED`, `DEFAULTED`), `page`, `limit`

#### `GET /hr/loans/:id`

Get single loan details and repayment schedule.

#### `POST /hr/loans/skip-requests`

Submit an EMI skip request for a specific repayment installment.

- **Permission:** `hr.loan.write.own` / `.team` / `.all`
- **Request Body:**
  ```json
  {
    "repaymentId": 45,
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

#### `GET /hr/bonuses`

List bonuses with decision status.

- **Query Params:** `employeeId`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `page`, `limit`

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

- **Permission:** `hr.payroll.approve.all`
- **Request Body:**
  ```json
  {
    "notes": "Calculations verified and approved"
  }
  ```

#### `GET /hr/payroll/entries`

List calculated employee entries for a run.

- **Permission:** `hr.payroll.read.own` / `.team` / `.all`
- **Query Params:** `payrollRunId`, `employeeId`, `page`, `limit`
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

#### `GET /hr/payment-batches`

List payment batches.

- **Query Params:** `payrollPeriodId`, `status`, `page`, `limit`

#### `GET /hr/payment-batches/:id`

Get batch details with individual payment line items.

#### `GET /hr/payment-batches/:id/export`

Exports CSV formatted for corporate banking bulk transfers.

- **Permission:** `hr.payment.read.all`
- **Response Format:**
  ```json
  {
    "data": {
      "filename": "Payroll_Payment_Batch_BATCH-202605-0001.csv",
      "contentType": "text/csv",
      "content": "Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Amount,Payment Method\nEMP-001,John Doe,HDFC Bank,50100123456789,HDFC0001234,52200,BANK_TRANSFER\n"
    }
  }
  ```

#### `POST /hr/payment-batches/:id/process`

Marks batch and payments as disbursed (`PAID`).

- **Permission:** `hr.payment.process.all`

---

### 4.9 Bank Details (`/hr/bank-details`)

#### `PUT /hr/bank-details/:employeeId`

Create or update employee bank account details.

- **Permission:** `hr.bank_details.write.all`
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

#### `GET /hr/bank-details/:employeeId`

Retrieve employee bank account details.

- **Permission:** `hr.bank_details.read.own` / `.team` / `.all`

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

- `DRAFT` $\to$ `PROCESSING` (when run is executed) $\to$ `FINALIZED` (when finalized) $\to$ `CANCELLED` (if abandoned).
- **"Run Payroll" Button:** Enabled only when status is `DRAFT` or `PROCESSING`. Disabled once `FINALIZED`.
- **"Finalize Period" Button:** Enabled **only** when at least one run has status `APPROVED`. Show confirmation modal warning: _"Finalizing will lock all calculations, advance loan repayments, and generate official payslips. This action is irreversible."_

#### Payment Batch State Transitions

- `PENDING` $\to$ `PROCESSING` $\to$ `PROCESSED`.
- **"Download Bank CSV" Button:** Available immediately upon batch creation (`PENDING` or `PROCESSED`).
- **"Process Disbursal" Button:** Changes status to `PROCESSED` and transitions line items to `PAID`.

### 5.3 Form Field Validation Specifications

| Field           | Type    | Rules                                                  |
| :-------------- | :------ | :----------------------------------------------------- |
| `year`          | Integer | Min 2000, Max 2100                                     |
| `month`         | Integer | 1 through 12                                           |
| `grossMonthly`  | Number  | $> 0$, 2 decimal places                                |
| `basic`         | Number  | $> 0$, must be $\le \text{grossMonthly}$               |
| `panNumber`     | String  | 10 chars, uppercase regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` |
| `ifscCode`      | String  | 11 chars, uppercase regex `^[A-Z]{4}0[A-Z0-9]{6}$`     |
| `uan`           | String  | 12 digits regex `^[0-9]{12}$`                          |
| `accountNumber` | String  | 9 to 18 digits regex `^[0-9]{9,18}$`                   |

---

## 6. QA & Test Automation Guide

### 6.1 Test Suites Overview

- **Unit Tests:** `apps/api/src/modules/hr/payroll/**/*.spec.ts`
  - `payroll-calculator.service.spec.ts`: Tests statutory PF capping, ESI gross ceiling, LOP prorating, weekly offs & holiday exclusions, loan EMI deductions, bonus inclusion.
  - `payroll-periods.service.spec.ts`: Tests lifecycle state machine, duplicate prevention, and finalization locking.
- **E2E Integration Tests:** `apps/api/test/payroll.e2e-spec.ts`
  - Runs 8 sequential integration scenarios against real PostgreSQL and Redis databases with complete RBAC and scoping checks.

### 6.2 Test Scenarios & Edge Cases Matrix

| Test Case     | Scenario / Condition                                               | Expected Result                                                                                                    |
| :------------ | :----------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **TC-PAY-01** | Create two periods for the same year and month (e.g., 2026-05)     | First succeeds (201); Second fails with **409 Conflict** (`DUPLICATE_PERIOD`).                                     |
| **TC-PAY-02** | Finalize period without an `APPROVED` payroll run                  | Fails with **400 Bad Request** (`NO_APPROVED_RUN`).                                                                |
| **TC-PAY-03** | Finalize an already `FINALIZED` period                             | Fails with **400 Bad Request** (`ALREADY_FINALIZED`).                                                              |
| **TC-PAY-04** | Employee joins mid-month (e.g., joined May 16th in a 31-day month) | First 15 days count as LOP. Earning ratio = $16 / 31$. Gross and base components prorated accordingly.             |
| **TC-PAY-05** | Employee with Basic ₹25,000 (exceeds ₹15,000 PF statutory ceiling) | PF Wage capped at ₹15,000. Employee contribution exactly ₹1,800.00.                                                |
| **TC-PAY-06** | Employee with Gross ₹20,000 ($\le$ ₹21,000 ESI ceiling)            | ESI Wage = ₹20,000. Employee contribution = ₹150.00 (0.75%).                                                       |
| **TC-PAY-07** | Employee with Gross ₹50,000 ($>$ ₹21,000 ESI ceiling)              | ESI deduction is ₹0.00. `esiIncluded` = false.                                                                     |
| **TC-PAY-08** | Active loan with approved EMI skip request for the period          | Loan EMI is not deducted in this payroll run; repayment status remains `SKIPPED`.                                  |
| **TC-PAY-09** | Bank transfer batch CSV export                                     | CSV format matches headers `Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Amount,Payment Method`. |
| **TC-PAY-10** | Team-scoped access control                                         | Manager of Team A cannot view payslips or salaries of employees in Team B (returns **404 Not Found**).             |
| **TC-PAY-11** | Self-service isolation                                             | User A calling `/self-service/payslips` only sees payslips linked to User A's employee record.                     |

### 6.3 How to Run Tests Locally

```bash
# 1. Run Unit Tests
pnpm --filter api test

# 2. Run E2E Integration Suite (requires Postgres and Redis running)
$env:DATABASE_URL="postgresql://texawave:texawave@localhost:5432/texawave_erp_test?schema=public"
$env:REDIS_URL="redis://localhost:6379/5"
pnpm --filter api test:e2e test/payroll.e2e-spec.ts

# 3. Monorepo Typecheck & Lint
pnpm -r run typecheck
pnpm --filter api run lint
```
