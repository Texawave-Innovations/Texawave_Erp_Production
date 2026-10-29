const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function renderDiagrams() {
  console.log("Rendering PDF 1 workflow diagrams using Mermaid...");

  const diagrams = [
    {
      name: "flow1_architecture",
      code: `
flowchart TD
    classDef client fill:#EFF6FF,stroke:#3B82F6,stroke-width:1.5px,color:#1E3A8A;
    classDef api fill:#F0FDF4,stroke:#22C55E,stroke-width:1.5px,color:#14532D;
    classDef service fill:#FEF3C7,stroke:#F59E0B,stroke-width:1.5px,color:#78350F;
    classDef db fill:#F1F5F9,stroke:#0A3271,stroke-width:2px,color:#0A3271;
    classDef ext fill:#F8FAFC,stroke:#64748B,stroke-width:1.5px,stroke-dasharray: 4 4,color:#334155;

    subgraph CLIENT_TIER["Frontend Presentation Tier (Next.js 14 App Router)"]
        UI_FIN["Finance Dashboard (/finance/*)"]:::client
        UI_EMP["Employee Portal (/employee-portal/*)"]:::client
        UI_REP["Financial Reports Explorer"]:::client
    end

    subgraph API_TIER["API Gateway & Controllers (NestJS 10)"]
        AUTH_GUARD["JwtAuthGuard & OrgGuard (Tenant Isolation)"]:::api
        VAL_PIPE["ValidationPipe (class-validator DTOs, @Max 100)"]:::api
        CTRL_EXP["ExpensesController"]:::api
        CTRL_REC["PaymentsReceivedController"]:::api
        CTRL_PAY["PaymentsMadeController"]:::api
        CTRL_BANK["BankingController"]:::api
        CTRL_GL["Journals & LedgerController"]:::api
        CTRL_GST["GstController"]:::api
    end

    subgraph SERVICE_TIER["Domain Services & Business Logic"]
        SRV_EXP["ExpensesService (Category Map & Auto-Provision)"]:::service
        SRV_REC["PaymentsReceivedService (Bank Inflow & Allocations)"]:::service
        SRV_PAY["PaymentsMadeService (Vendor Outflow & Settlement)"]:::service
        SRV_BANK["BankingService (Reconciliation & Balances)"]:::service
        SRV_JOURNAL["JournalPostingService (Debit=Credit Parity)"]:::service
        SRV_REP["FinancialReportsService (Dynamic Aggregate Engine)"]:::service
    end

    subgraph REPO_TIER["Repository Layer (Atomic Unit-of-Work)"]
        TX_MANAGER["Prisma $transaction (Atomic Multi-Table Commits)"]:::service
        REPO_REC["PaymentsReceivedRepository"]:::service
        REPO_EXP["ExpensesRepository"]:::service
        REPO_GL["JournalRepository"]:::service
    end

    subgraph DB_TIER["PostgreSQL Multi-Schema Database"]
        SCHEMA_FIN["finance Schema (11 Core Entities: accounts, journals, expenses, bank)"]:::db
        SCHEMA_PLAT["platform Schema (organizations, users, roles)"]:::db
        SCHEMA_CRM["crm Schema (accounts/customers)"]:::db
        SCHEMA_SCM["scm Schema (suppliers, supplier_payments)"]:::db
        SCHEMA_HR["hr Schema (expense_claims, employees)"]:::db
    end

    UI_FIN --> AUTH_GUARD
    UI_EMP --> AUTH_GUARD
    UI_REP --> AUTH_GUARD
    AUTH_GUARD --> VAL_PIPE

    VAL_PIPE --> CTRL_EXP
    VAL_PIPE --> CTRL_REC
    VAL_PIPE --> CTRL_PAY
    VAL_PIPE --> CTRL_BANK
    VAL_PIPE --> CTRL_GL
    VAL_PIPE --> CTRL_GST

    CTRL_EXP --> SRV_EXP
    CTRL_REC --> SRV_REC
    CTRL_PAY --> SRV_PAY
    CTRL_BANK --> SRV_BANK
    CTRL_GL --> SRV_JOURNAL
    CTRL_GL --> SRV_REP
    CTRL_GST --> SRV_REP

    SRV_EXP --> TX_MANAGER
    SRV_REC --> REPO_REC
    SRV_PAY --> TX_MANAGER
    SRV_BANK --> TX_MANAGER
    SRV_JOURNAL --> REPO_GL

    REPO_REC --> TX_MANAGER
    REPO_GL --> TX_MANAGER

    TX_MANAGER --> SCHEMA_FIN
    TX_MANAGER --> SCHEMA_PLAT
    TX_MANAGER -.-> SCHEMA_CRM
    TX_MANAGER -.-> SCHEMA_SCM
    TX_MANAGER -.-> SCHEMA_HR
`,
    },
    {
      name: "flow2_claim_conversion",
      code: `
sequenceDiagram
    autonumber
    actor EMP as Employee
    actor HR as HR Manager
    actor FIN as Finance Admin
    participant EP as Employee Portal UI
    participant HRA as HR Claims API
    participant DB_HR as hr.expense_claims
    participant FA as Finance Expenses API
    participant DB_FIN as finance.expenses
    participant ML as MasterListItem
    participant BANK as finance.bank_accounts

    EMP->>EP: Submit Expense Claim (Medical, Travel, Food, etc.)
    EP->>HRA: POST /api/v1/hr/expense-claims
    HRA->>DB_HR: Create Claim (Status: PENDING)

    HR->>HRA: PATCH /api/v1/hr/expense-claims/:id/approve
    HRA->>DB_HR: Update Claim Status (Status: APPROVED)

    FIN->>FA: POST /api/v1/finance/expenses/convert-claims
    Note over FA: Category Normalization via<br/>CLAIM_TO_FINANCE_CATEGORY_MAP
    FA->>ML: Find canonical category (e.g. Travel & Lodging)
    alt Category Not Found
        FA->>ML: Auto-provision canonical category in Org
    end
    FA->>DB_FIN: Insert Expense (EXP-YYYYMM-XXXX, Status: APPROVED)
    FA->>DB_HR: Mark Claim (isConverted: true, convertedToExpenseId)
    FA-->>FIN: Return Converted Expense Record

    FIN->>FA: POST /api/v1/finance/expenses/:id/reimburse
    FA->>BANK: Deduct currentBalance -= amount
    FA->>DB_FIN: Update status: REIMBURSED, paymentStatus: PAID
    FA-->>FIN: Expense Settlement Complete
`,
    },
    {
      name: "flow3_payment_received",
      code: `
sequenceDiagram
    autonumber
    actor FIN as Finance User
    participant UI as Finance UI (/payments-received/new)
    participant API as PaymentsReceivedController
    participant SRV as PaymentsReceivedService
    participant REPO as PaymentsReceivedRepository
    participant DB_TX as Prisma $transaction
    participant BANK as finance.bank_accounts
    participant BTX as finance.bank_transactions
    participant REC as finance.payments_received
    participant ALLOC as payment_allocations
    participant JV as finance.journal_entries
    participant GL as finance.journal_lines

    FIN->>UI: Select Customer, Bank, Amount (₹9,000), Invoice Ref
    UI->>API: POST /api/v1/finance/payments-received
    API->>SRV: create() DTO Validated
    SRV->>REC: Create Receipt (Status: DRAFT, REC-YYYYMM-XXXX)

    FIN->>UI: Click Confirm Receipt
    UI->>API: POST /api/v1/finance/payments-received/:id/confirm
    API->>SRV: confirm()
    SRV->>REPO: postAndConfirmReceipt(id, bankDelta, journalPayload)
    
    rect rgb(240, 249, 255)
        Note over REPO,DB_TX: Atomic Database Transaction
        REPO->>DB_TX: Begin Transaction
        DB_TX->>REC: Update Status -> CONFIRMED, set bankAccountId
        DB_TX->>BANK: Increment currentBalance += ₹9,000
        DB_TX->>BTX: Insert BankTransaction (Type: CREDIT, Ref: REC-XXXX, runningBalance)
        DB_TX->>ALLOC: Insert/Update invoice allocation amounts
        DB_TX->>JV: Insert Journal Voucher (JV-YYYYMM-XXXX, Status: POSTED)
        DB_TX->>GL: Insert Debit Line: 1020 Bank Asset (₹9,000)
        DB_TX->>GL: Insert Credit Line: 1200 Accounts Receivable (₹9,000)
        DB_TX->>REC: Link journal_entry_id = JV.id
        DB_TX->>DB_TX: Commit Transaction (Net Variance = ₹0.00)
    end

    REPO-->>SRV: Receipt Confirmed & Balanced
    SRV-->>UI: Success (Updated Bank Balance & Posted JV)
`,
    },
    {
      name: "flow4_gl_posting_reversal",
      code: `
flowchart TD
    classDef draft fill:#FEF3C7,stroke:#D97706,stroke-width:1.5px,color:#78350F;
    classDef posted fill:#DCFCE7,stroke:#16A34A,stroke-width:1.5px,color:#14532D;
    classDef reversed fill:#FEE2E2,stroke:#DC2626,stroke-width:1.5px,color:#7F1D1D;
    classDef step fill:#EFF6FF,stroke:#2563EB,stroke-width:1.5px,color:#1E3A8A;

    START([Create Journal Voucher]):::step --> INP[Input Voucher Lines: Account, Debit, Credit]:::step
    INP --> VAL{Validation Checks}:::step

    VAL -- Lines < 2 --> ERR1[Reject: Minimum 2 Lines Required]:::reversed
    VAL -- Debit != Credit --> ERR2[Reject: Unbalanced Voucher Variance != 0]:::reversed
    VAL -- Inactive/Invalid Account --> ERR3[Reject: Account Not Found in Org]:::reversed

    VAL -- Parity Verified Sum(Debit) = Sum(Credit) --> POST[Post Voucher]:::step
    POST --> SET_STATUS[Set Status: POSTED<br/>Assign Voucher No: JV-YYYYMM-XXXX]:::posted

    SET_STATUS --> IMMUTABLE[Ledger Immutability Lock<br/>Posted entries cannot be modified or deleted]:::posted

    IMMUTABLE --> REVERSE_REQ{Reversal Requested?}:::step
    REVERSE_REQ -- No --> END([Normal Active GL Record]):::posted
    REVERSE_REQ -- Yes --> CREATE_REV[Generate Reversal Voucher]:::step

    CREATE_REV --> REV_LINES[Swap Debit and Credit on all lines<br/>Line Debit -> Credit, Line Credit -> Debit]:::step
    REV_LINES --> REV_POST[Post Reversal Voucher<br/>Assign JV-YYYYMM-REV-XXXX<br/>Set reversed_entry_id = Original.id]:::reversed
    REV_POST --> REV_MARK[Mark Original Voucher Status: REVERSED]:::reversed
    REV_MARK --> GL_OFFSET([Net GL Impact Neutralized]):::reversed
`,
    },
    {
      name: "flow5_projections_architecture",
      code: `
flowchart TD
    classDef source fill:#E0F2FE,stroke:#0284C7,stroke-width:1.5px,color:#0369A1;
    classDef engine fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#78350F;
    classDef scenario fill:#F0FDF4,stroke:#16A34A,stroke-width:1.5px,color:#14532D;
    classDef alert fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#7F1D1D;
    classDef ui fill:#F8FAFC,stroke:#0A3271,stroke-width:2px,color:#0A3271;

    subgraph INGESTION["1. Read-Only Financial Data Ingestion (Strictly Non-Modifying)"]
        SRC_BANK["finance.bank_accounts<br/>Current Available Cash & Bank Balances"]:::source
        SRC_AR["crm.accounts & payment_allocations<br/>Outstanding Customer AR (Aging Due Dates)"]:::source
        SRC_AP["scm.suppliers & supplier_bills<br/>Committed Vendor AP (Payment Schedules)"]:::source
        SRC_OPEX["finance.expenses & hr.payroll<br/>Historical Monthly Burn & Fixed OpEx Run-Rate"]:::source
    end

    subgraph SIM_ENGINE["2. Proposed Projections & Scenario Simulation Engine"]
        CALC_BASE["Baseline Cash Flow Model<br/>Cash(t) = Cash(t-1) + Inflows(t) - Outflows(t)"]:::engine
        
        SCEN_EXP["Expected Scenario (P=85% Collection, Normal 30-Day DSO)"]:::scenario
        SCEN_BEST["Best-Case Scenario (P=95% Collection, +15% Early Inflow, 5% Disc)"]:::scenario
        SCEN_WORST["Worst-Case Scenario (P=65% Collection, 30-Day Delay, +20% Cost)"]:::scenario

        HORIZON["Projection Horizons: 6-Month | 9-Month | 12-Month"]:::engine
    end

    subgraph DECISION["3. Threshold Monitoring & Risk Governance"]
        WARN_THRESH{"Projected Closing Balance < Reserve Buffer?"}:::engine
        ALERT_DEFICIT["Deficit Warning Triggered!<br/>Specific Forecast Month & Required Liquidity"]:::alert
        SAFE_SURPLUS["Liquidity Healthy<br/>Safe Reinvestment & Growth Window"]:::scenario
    end

    subgraph PRESENTATION["4. Executive Financial Intelligence Dashboard (UI & PDF Export)"]
        UI_DASH["Interactive Cash Flow Horizon Waterfall"]:::ui
        UI_METRICS["Runway Months & Deficit Timing Alert Banner"]:::ui
        UI_SAFETY["Strict Safety Notice: Forecast records never post to GL"]:::ui
    end

    SRC_BANK --> CALC_BASE
    SRC_AR --> CALC_BASE
    SRC_AP --> CALC_BASE
    SRC_OPEX --> CALC_BASE

    CALC_BASE --> SCEN_EXP
    CALC_BASE --> SCEN_BEST
    CALC_BASE --> SCEN_WORST

    SCEN_EXP --> HORIZON
    SCEN_BEST --> HORIZON
    SCEN_WORST --> HORIZON

    HORIZON --> WARN_THRESH
    WARN_THRESH -- Yes --> ALERT_DEFICIT
    WARN_THRESH -- No --> SAFE_SURPLUS

    ALERT_DEFICIT --> UI_METRICS
    SAFE_SURPLUS --> UI_METRICS
    HORIZON --> UI_DASH
    UI_DASH --> UI_SAFETY
`,
    },
  ];

  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();

  for (const diag of diagrams) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <script>${mermaidJs}</script>
</head>
<body style="margin: 0; padding: 20px; background: white;">
  <div id="container" class="mermaid">
${diag.code}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        primaryColor: '#E0F2FE',
        primaryTextColor: '#0F172A',
        primaryBorderColor: '#0284C7',
        lineColor: '#0A3271',
        secondaryColor: '#F8FAFC',
        tertiaryColor: '#FFFFFF',
        fontFamily: 'Nunito Sans, sans-serif'
      }
    });
  </script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: "load" });
    try {
      await page.waitForSelector("#container svg", { timeout: 10000 });
      const svg = await page.$eval("#container svg", (el) => el.outerHTML);
      const outPath = `scratch/${diag.name}.svg`;
      fs.writeFileSync(outPath, svg, "utf8");
      console.log(
        `[PASS] Rendered ${diag.name} -> ${outPath} (${svg.length} chars)`,
      );
    } catch (err) {
      console.error(`[FAIL] Error rendering ${diag.name}:`, err.message);
    }
  }

  await browser.close();
  console.log("All workflow diagrams rendered!");
}

renderDiagrams().catch(console.error);
