const fs = require("fs");
const path = require("path");
const ExcelJS = require(path.resolve("apps/ui/node_modules/exceljs"));

async function generateCompleteFinanceWorkbook() {
  console.log("--- Initializing TexaWave Finance Workbook Generator ---");
  const wb = new ExcelJS.Workbook();
  wb.creator = "TexaWave ERP Core Engineering";
  wb.lastModifiedBy = "TexaWave ERP Core Engineering";
  wb.created = new Date("2026-10-26T12:00:00Z");
  wb.modified = new Date();

  const FONT_NAME = "Nunito Sans";
  const titleFont = {
    name: FONT_NAME,
    size: 14,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const subTitleFont = {
    name: FONT_NAME,
    size: 9.5,
    italic: true,
    color: { argb: "FF94A3B8" },
  };
  const headerFont = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const cellFont = { name: FONT_NAME, size: 9.5, color: { argb: "FF1E293B" } };
  const boldCellFont = {
    name: FONT_NAME,
    size: 9.5,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  const kpiValueFont = {
    name: FONT_NAME,
    size: 18,
    bold: true,
    color: { argb: "FF0A3271" },
  };
  const kpiLabelFont = {
    name: FONT_NAME,
    size: 9,
    bold: true,
    color: { argb: "FF475569" },
  };

  const titleFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  const headerFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0A3271" },
  }; // TexaOne Navy
  const altRowFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  const sectionHeaderFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  const kpiCardFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  const thinBorder = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const statusStyles = {
    Completed: {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFCE7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF166534" },
      },
    },
    PASS: {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFCE7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF166534" },
      },
    },
    "Production Ready": {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFCE7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF166534" },
      },
    },
    "Verified (Live Tested)": {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFCE7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF166534" },
      },
    },
    "Verified (Code & Controller)": {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF0369A1" },
      },
    },
    "Verified (Unit Tested)": {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF0369A1" },
      },
    },
    Pending: {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF92400E" },
      },
    },
    "Prepared / Pending Verification": {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF92400E" },
      },
    },
    "Needs Verification": {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF92400E" },
      },
    },
    Blocked: {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF991B1B" },
      },
    },
    FAIL: {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF991B1B" },
      },
    },
  };

  // ==========================================
  // SHEET 1: Dashboard
  // ==========================================
  console.log("Generating Sheet 1: Dashboard...");
  const wsDash = wb.addWorksheet("Dashboard", {
    views: [{ showGridLines: true }],
  });
  wsDash.columns = [
    { width: 3 }, // A
    { width: 28 }, // B Module
    { width: 16 }, // C Endpoints
    { width: 34 }, // D Models
    { width: 16 }, // E Tests
    { width: 22 }, // F Status
    { width: 50 }, // G Notes
    { width: 3 }, // H
  ];

  wsDash.mergeCells("B2:G2");
  const dTitle = wsDash.getCell("B2");
  dTitle.value = "TexaWave ERP — Finance Module Engineering & QA Dashboard";
  dTitle.font = titleFont;
  dTitle.fill = titleFill;
  dTitle.alignment = { vertical: "middle", indent: 1 };
  wsDash.getRow(2).height = 36;

  wsDash.mergeCells("B3:G3");
  const dSub = wsDash.getCell("B3");
  dSub.value =
    "Source of Truth Code Audit & Manual Test Operations Consolidation | Active Branch: feature/finance | Audit Date: 26-Oct-2026";
  dSub.font = subTitleFont;
  dSub.fill = titleFill;
  dSub.alignment = { vertical: "middle", indent: 1 };
  wsDash.getRow(3).height = 20;

  // KPI Cards Block (Rows 5-7)
  const kpis = [
    {
      col: "B",
      title: "Documented Endpoints",
      val: 74,
      note: "10 Finance Modules",
    },
    {
      col: "C",
      title: "Database Models",
      val: 11,
      note: 'schema="finance" in PG',
    },
    {
      col: "D",
      title: "Preserved Test Cases",
      val: 44,
      note: "100% Retained from Original",
    },
    {
      col: "E",
      title: "Total Test Cases",
      val: 88,
      note: "44 Preserved + 44 New Cases",
    },
    {
      col: "F",
      title: "Completed / Pass",
      val: 31,
      note: "Live Postman Verified",
    },
    {
      col: "G",
      title: "Unresolved Verification Items",
      val: 8,
      note: "Dependencies & Audit Risks",
    },
  ];

  kpis.forEach((k) => {
    const topCell = wsDash.getCell(`${k.col}5`);
    const valCell = wsDash.getCell(`${k.col}6`);
    const noteCell = wsDash.getCell(`${k.col}7`);

    topCell.value = k.title;
    topCell.font = kpiLabelFont;
    topCell.fill = kpiCardFill;
    topCell.alignment = { horizontal: "center", vertical: "middle" };
    topCell.border = {
      top: thinBorder.top,
      left: thinBorder.left,
      right: thinBorder.right,
    };

    valCell.value = k.val;
    valCell.font = kpiValueFont;
    valCell.fill = kpiCardFill;
    valCell.alignment = { horizontal: "center", vertical: "middle" };
    valCell.border = { left: thinBorder.left, right: thinBorder.right };

    noteCell.value = k.note;
    noteCell.font = { name: FONT_NAME, size: 8.5, color: { argb: "FF64748B" } };
    noteCell.fill = kpiCardFill;
    noteCell.alignment = { horizontal: "center", vertical: "middle" };
    noteCell.border = {
      bottom: thinBorder.bottom,
      left: thinBorder.left,
      right: thinBorder.right,
    };
  });
  wsDash.getRow(5).height = 20;
  wsDash.getRow(6).height = 32;
  wsDash.getRow(7).height = 18;

  // Section 1: Implementation Coverage
  wsDash.mergeCells("B9:G9");
  const sec1 = wsDash.getCell("B9");
  sec1.value =
    "Finance Module Implementation Coverage (Codebase Source of Truth)";
  sec1.font = boldCellFont;
  sec1.fill = sectionHeaderFill;
  sec1.alignment = { vertical: "middle", indent: 1 };
  wsDash.getRow(9).height = 24;

  const modHeaders = [
    "Finance Module",
    "API Endpoints",
    "Prisma Models & Tables",
    "Postman Tests",
    "Implementation Status",
    "Key Capabilities & Integration Points",
  ];
  const row10 = wsDash.getRow(10);
  modHeaders.forEach((h, idx) => {
    const cell = row10.getCell(idx + 2);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = {
      horizontal: idx === 0 || idx === 2 || idx === 5 ? "left" : "center",
      vertical: "middle",
    };
    cell.border = thinBorder;
  });
  row10.height = 26;

  const moduleData = [
    [
      "Expenses",
      11,
      "FinanceExpense (expenses)",
      11,
      "Production Ready",
      "Draft, Manager Approval, Payment disbursement, GL posting & HR claims conversion",
    ],
    [
      "Payments Received",
      9,
      "FinancePaymentReceived, Allocation",
      20,
      "Production Ready",
      "Multi-invoice allocation, Confirm/GL posting, Void & reversal audit trail",
    ],
    [
      "Payments Made",
      7,
      "FinancePaymentMade (payments_made)",
      7,
      "Production Ready",
      "Vendor disbursements, GL posting, SCM bill settlement linkage",
    ],
    [
      "Treasury & Banking",
      10,
      "FinanceBankAccount, BankTransaction",
      8,
      "Production Ready",
      "Multi-bank accounts, GL linkage, bank feed transactions & reconciliation",
    ],
    [
      "Chart of Accounts (COA)",
      6,
      "FinanceAccount (accounts)",
      5,
      "Production Ready",
      "5-type hierarchical tree, balanced ledger parent-child structure",
    ],
    [
      "General Ledger & Journals",
      7,
      "FinanceJournalEntry, JournalLine",
      6,
      "Production Ready",
      "Double-entry vouchers, automated validation, reversal audit trail",
    ],
    [
      "GST Registry & Returns",
      8,
      "FinanceGstEntry (gst_entries)",
      7,
      "Production Ready",
      "GSTR-1, GSTR-3B summaries, HSN reporting, GSTR-2B reconciliation",
    ],
    [
      "Financial Reports",
      6,
      "Aggregations on journal_lines & accounts",
      6,
      "Production Ready",
      "P&L, Balance Sheet, Trial Balance, Cash/Bank Summary, Closing Status",
    ],
    [
      "Sales & Purchases Integration",
      5,
      "Integration with Sales & SCM modules",
      5,
      "Production Ready",
      "Automated GL journal & GST postings from finalized invoices & bills",
    ],
    [
      "Finance Settings",
      5,
      "FinanceMasterListItem",
      3,
      "Production Ready",
      "Expense types, payment modes, category master data configuration",
    ],
  ];

  let rIdx = 11;
  moduleData.forEach((row, i) => {
    const r = wsDash.getRow(rIdx);
    r.height = 22;
    row.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 2);
      cell.value = val;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: cIdx === 0 || cIdx === 2 || cIdx === 5 ? "left" : "center",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (cIdx === 4) {
        cell.font = {
          name: FONT_NAME,
          size: 9.5,
          bold: true,
          color: { argb: "FF166534" },
        };
      }
    });
    rIdx++;
  });

  // Total summary row
  const totalRow = wsDash.getRow(rIdx);
  totalRow.height = 24;
  totalRow.getCell(2).value = "Total Verified";
  totalRow.getCell(2).font = boldCellFont;
  totalRow.getCell(2).border = thinBorder;
  totalRow.getCell(2).alignment = {
    vertical: "middle",
    horizontal: "left",
    indent: 1,
  };

  totalRow.getCell(3).value = 74;
  totalRow.getCell(3).font = boldCellFont;
  totalRow.getCell(3).border = thinBorder;
  totalRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };

  totalRow.getCell(4).value = "11 Core Prisma Models";
  totalRow.getCell(4).font = boldCellFont;
  totalRow.getCell(4).border = thinBorder;
  totalRow.getCell(4).alignment = { vertical: "middle", horizontal: "left" };

  totalRow.getCell(5).value = 88;
  totalRow.getCell(5).font = boldCellFont;
  totalRow.getCell(5).border = thinBorder;
  totalRow.getCell(5).alignment = { vertical: "middle", horizontal: "center" };

  totalRow.getCell(6).value = "100% Implemented";
  totalRow.getCell(6).font = boldCellFont;
  totalRow.getCell(6).border = thinBorder;
  totalRow.getCell(6).alignment = { vertical: "middle", horizontal: "center" };

  totalRow.getCell(7).value =
    "Comprehensive enterprise double-entry accounting engine";
  totalRow.getCell(7).font = boldCellFont;
  totalRow.getCell(7).border = thinBorder;
  totalRow.getCell(7).alignment = { vertical: "middle", horizontal: "left" };

  for (let c = 2; c <= 7; c++) {
    totalRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  }

  // Section 2: Unresolved Verification Items
  rIdx += 2;
  wsDash.mergeCells(`B${rIdx}:G${rIdx}`);
  const sec2 = wsDash.getCell(`B${rIdx}`);
  sec2.value =
    "Unresolved Verification Items & Architecture Dependencies (Audit Backlog)";
  sec2.font = boldCellFont;
  sec2.fill = sectionHeaderFill;
  sec2.alignment = { vertical: "middle", indent: 1 };
  wsDash.getRow(rIdx).height = 24;

  rIdx++;
  const unresHeaders = [
    "Check ID",
    "Module / Area",
    "Risk / Unresolved Item",
    "Priority",
    "Current Contract Behavior",
    "Action Required for Resolution",
  ];
  const rUnresH = wsDash.getRow(rIdx);
  unresHeaders.forEach((h, idx) => {
    const cell = rUnresH.getCell(idx + 2);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = {
      horizontal: idx === 0 || idx === 3 ? "center" : "left",
      vertical: "middle",
    };
    cell.border = thinBorder;
  });
  rUnresH.height = 26;

  const unresolvedItems = [
    [
      "CHK-006",
      "Sales Integration",
      "No standalone SalesInvoice model in schema.prisma",
      "P1",
      "Uses invoiceReference string in payments_received_allocations",
      "Maintain invoiceReference string until Sales module introduces dedicated entity",
    ],
    [
      "CHK-005",
      "Payments Received",
      "Overdue & due-month filters client-side vs server",
      "P0",
      "Server returns paginated receipts; overdue filter handled in UI state",
      "Add dedicated due-date query parameters to QueryPaymentsReceivedDto",
    ],
    [
      "CHK-014",
      "Test Infra",
      "Disposable E2E DB & Redis test container isolation",
      "P1",
      "E2E test suite safely aborts when disposable test DB/Redis is absent",
      "Provision isolated docker-compose test DB with test seeds, never run on texawave_erp",
    ],
    [
      "CHK-011",
      "Security",
      "Tenant isolation cross-organization leak prevention",
      "P1",
      "Scoped by organizationId in Prisma repository where clause",
      "Execute live dual-tenant Postman tests confirming 404 on foreign ID access",
    ],
    [
      "CHK-010",
      "Security",
      "Role-based permission denials (403 Forbidden)",
      "P1",
      "Enforced by @RequirePermission decorator on controller endpoints",
      "Verify read-only role user receives 403 Forbidden on all write/confirm routes",
    ],
    [
      "CHK-007",
      "Payments UI",
      "Edit draft payment modal action in UI table",
      "P2",
      "PATCH endpoint exists on backend; frontend detail view is view-only",
      "Add Edit button and form dialog for DRAFT receipts in PaymentsReceivedView.tsx",
    ],
    [
      "CHK-008",
      "Payments API",
      "Frontend vs Backend allocation response type alignment",
      "P2",
      "Backend returns complete payment entity after allocation add/delete",
      "Verify frontend useUpdateAllocation hook matches backend payload",
    ],
    [
      "CHK-013",
      "E2E Workflow",
      "Automated Playwright browser-to-database E2E specs",
      "P1",
      "Unit specs exist (100% pass); Playwright tests are pending live DB",
      "Write Playwright E2E spec covering Draft -> Post -> Reverse workflow",
    ],
  ];

  rIdx++;
  unresolvedItems.forEach((row, i) => {
    const r = wsDash.getRow(rIdx);
    r.height = 24;
    row.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 2);
      cell.value = val;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: cIdx === 0 || cIdx === 3 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (cIdx === 3) {
        cell.font = {
          name: FONT_NAME,
          size: 9.5,
          bold: true,
          color:
            val === "P0"
              ? { argb: "FF991B1B" }
              : val === "P1"
                ? { argb: "FFB45309" }
                : { argb: "FF1E293B" },
        };
      }
    });
    rIdx++;
  });

  wsDash.autoFilter = { from: "B10", to: "G20" };

  // ==========================================
  // SHEET 2: API Endpoints
  // ==========================================
  console.log("Generating Sheet 2: API Endpoints...");
  const wsApi = wb.addWorksheet("API Endpoints", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  wsApi.columns = [
    { header: "Module", key: "module", width: 22 },
    { header: "Feature", key: "feature", width: 20 },
    { header: "Method", key: "method", width: 10 },
    { header: "Endpoint", key: "endpoint", width: 44 },
    { header: "Short Description", key: "description", width: 45 },
    { header: "Request Parameters / Body", key: "params", width: 42 },
    { header: "Response Summary", key: "response", width: 34 },
    { header: "Permission", key: "permission", width: 32 },
    { header: "Validation / Error Cases", key: "validation", width: 38 },
    { header: "Verification Status", key: "status", width: 24 },
    { header: "Source File", key: "sourceFile", width: 48 },
  ];

  // Title Row
  wsApi.mergeCells("A1:K1");
  const apiTitle = wsApi.getCell("A1");
  apiTitle.value =
    "TexaWave ERP — Complete Finance Module API Reference (74 Verified Endpoints)";
  apiTitle.font = titleFont;
  apiTitle.fill = titleFill;
  apiTitle.alignment = { vertical: "middle", indent: 1 };
  wsApi.getRow(1).height = 36;

  wsApi.mergeCells("A2:K2");
  const apiSub = wsApi.getCell("A2");
  apiSub.value =
    "All routes verified against NestJS controllers, DTO class-validators, and RBAC permissions catalog | No phantom or inferred routes";
  apiSub.font = subTitleFont;
  apiSub.fill = titleFill;
  apiSub.alignment = { vertical: "middle", indent: 1 };
  wsApi.getRow(2).height = 20;

  // Empty row 3
  wsApi.getRow(3).height = 8;

  // Headers in Row 4
  const apiHRow = wsApi.getRow(4);
  const apiHeaders = [
    "Module",
    "Feature",
    "Method",
    "Endpoint",
    "Short Description",
    "Request Parameters / Body",
    "Response Summary",
    "Permission",
    "Validation / Error Cases",
    "Verification Status",
    "Source File",
  ];
  apiHeaders.forEach((h, i) => {
    const cell = apiHRow.getCell(i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  apiHRow.height = 28;

  // Read parsed endpoints data
  const parsedEndpoints = JSON.parse(
    fs.readFileSync("scratch/all_parsed_endpoints.json", "utf8"),
  );

  // Detailed endpoint definitions for 74 endpoints
  const endpointDetails = [
    // Banking & Treasury
    {
      module: "Treasury & Banking",
      feature: "Bank Accounts",
      method: "GET",
      endpoint: "/finance/bank-accounts",
      desc: "List bank accounts with pagination, search, and status filters",
      params:
        "Query: page, limit, accountType (CURRENT/SAVINGS/etc), isActive, search",
      resp: "200 OK — Paginated { data: FinanceBankAccount[], meta }",
      perm: "finance.banking.read",
      val: "400 on invalid query params; 401 Unauthorized",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Accounts",
      method: "GET",
      endpoint: "/finance/bank-accounts/:id",
      desc: "Get bank account details by ID",
      params: "Param: id (number, ParseIntPipe)",
      resp: "200 OK — { data: FinanceBankAccount } with GL account link",
      perm: "finance.banking.read",
      val: "404 if not found or different tenant; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Accounts",
      method: "POST",
      endpoint: "/finance/bank-accounts",
      desc: "Create a new bank account",
      params:
        "Body (CreateBankAccountDto): accountName, accountNumber, bankName, ifscCode, branchName?, accountType?, currency?, openingBalance?, glAccountId?, isActive?",
      resp: "201 Created — { data: FinanceBankAccount }",
      perm: "finance.banking.write",
      val: "400 validation error; 409 unique accountNumber per organization; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Accounts",
      method: "PATCH",
      endpoint: "/finance/bank-accounts/:id",
      desc: "Update bank account details",
      params:
        "Param: id; Body (UpdateBankAccountDto): accountName?, bankName?, ifscCode?, branchName?, accountType?, glAccountId?, isActive?",
      resp: "200 OK — { data: FinanceBankAccount }",
      perm: "finance.banking.write",
      val: "404 not found; 400 validation; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Accounts",
      method: "DELETE",
      endpoint: "/finance/bank-accounts/:id",
      desc: "Soft delete a bank account",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.banking.write",
      val: "404 not found; 409 if account has active transactions; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Transactions",
      method: "GET",
      endpoint: "/finance/bank-transactions",
      desc: "List bank transactions with filtering by bank account, type, date range, and reconciliation",
      params:
        "Query: page, limit, bankAccountId, transactionType (CREDIT/DEBIT), isReconciled, startDate, endDate, search",
      resp: "200 OK — Paginated { data: FinanceBankTransaction[], meta }",
      perm: "finance.banking.read",
      val: "400 invalid date; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Transactions",
      method: "GET",
      endpoint: "/finance/bank-transactions/:id",
      desc: "Get bank transaction details by ID",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinanceBankTransaction }",
      perm: "finance.banking.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Transactions",
      method: "POST",
      endpoint: "/finance/bank-transactions",
      desc: "Record a bank transaction (automatically updates bank balance and optional GL double-entry)",
      params:
        "Body (CreateBankTransactionDto): bankAccountId, transactionDate, transactionType (CREDIT/DEBIT), amount (>0), description, referenceNumber?, counterGlAccountId?",
      resp: "201 Created — { data: FinanceBankTransaction }",
      perm: "finance.banking.write",
      val: "400 validation; 404 bank account not found; updates currentBalance atomically",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Reconciliation",
      method: "POST",
      endpoint: "/finance/bank-transactions/:id/reconcile",
      desc: "Mark a bank transaction as reconciled against statement or journal entry",
      params:
        "Param: id; Body (ReconcileTransactionDto): matchedJournalEntryId?",
      resp: "201 Created — { data: FinanceBankTransaction (isReconciled: true) }",
      perm: "finance.banking.write",
      val: "404 transaction not found; 422 if already reconciled",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
    },
    {
      module: "Treasury & Banking",
      feature: "Bank Reconciliation",
      method: "POST",
      endpoint: "/finance/bank-transactions/:id/unreconcile",
      desc: "Unmark a bank transaction as reconciled",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinanceBankTransaction (isReconciled: false) }",
      perm: "finance.banking.write",
      val: "404 not found; 422 if not reconciled",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
    },

    // Chart of Accounts
    {
      module: "Chart of Accounts",
      feature: "Account Tree & List",
      method: "GET",
      endpoint: "/finance/accounts",
      desc: "List Chart of Accounts with pagination and filtering",
      params:
        "Query: page, limit, accountType (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), isActive, search",
      resp: "200 OK — Paginated { data: FinanceAccount[], meta }",
      perm: "finance.coa.read",
      val: "400 invalid type; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/coa/accounts.controller.ts",
    },
    {
      module: "Chart of Accounts",
      feature: "Account Tree & List",
      method: "GET",
      endpoint: "/finance/accounts/tree",
      desc: "Get complete Chart of Accounts hierarchical tree",
      params: "None (tenant-scoped via session)",
      resp: "200 OK — { data: FinanceAccountTreeNode[] }",
      perm: "finance.coa.read",
      val: "401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/coa/accounts.controller.ts",
    },
    {
      module: "Chart of Accounts",
      feature: "Account Detail",
      method: "GET",
      endpoint: "/finance/accounts/:id",
      desc: "Get Chart of Accounts entry by ID",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinanceAccount } with parent/sub-account relations",
      perm: "finance.coa.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/coa/accounts.controller.ts",
    },
    {
      module: "Chart of Accounts",
      feature: "Account Management",
      method: "POST",
      endpoint: "/finance/accounts",
      desc: "Create new Chart of Accounts entry",
      params:
        "Body (CreateAccountDto): accountCode, accountName, accountType (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), parentAccountId?, currency?, description?",
      resp: "201 Created — { data: FinanceAccount }",
      perm: "finance.coa.write",
      val: "400 validation error; 409 duplicate accountCode in org; 404 parent account not found",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/coa/accounts.controller.ts",
    },
    {
      module: "Chart of Accounts",
      feature: "Account Management",
      method: "PATCH",
      endpoint: "/finance/accounts/:id",
      desc: "Update Chart of Accounts entry",
      params:
        "Param: id; Body (UpdateAccountDto): accountCode?, accountName?, parentAccountId?, currency?, description?, isActive?",
      resp: "200 OK — { data: FinanceAccount }",
      perm: "finance.coa.write",
      val: "404 not found; 400 validation; 409 cyclic parent relation or duplicate code",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/coa/accounts.controller.ts",
    },
    {
      module: "Chart of Accounts",
      feature: "Account Management",
      method: "DELETE",
      endpoint: "/finance/accounts/:id",
      desc: "Soft delete Chart of Accounts entry",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.coa.write",
      val: "404 not found; 409 if account has posted journal lines or child sub-accounts",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/coa/accounts.controller.ts",
    },

    // Expenses
    {
      module: "Expenses",
      feature: "Expense Records",
      method: "GET",
      endpoint: "/finance/expenses",
      desc: "List operating expenses with pagination, category, date, and status filters",
      params:
        "Query: page, limit, status (DRAFT/PENDING_APPROVAL/APPROVED/PAID/CANCELLED), expenseTypeId, startDate, endDate, search",
      resp: "200 OK — Paginated { data: FinanceExpense[], meta }",
      perm: "finance.expense.read",
      val: "400 invalid query; 401 Unauthorized",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Detail",
      method: "GET",
      endpoint: "/finance/expenses/:id",
      desc: "Get detailed expense record by ID with category and journal links",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinanceExpense } with expenseType, paymentMode, journalEntry",
      perm: "finance.expense.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Lifecycle",
      method: "POST",
      endpoint: "/finance/expenses",
      desc: "Create an operating expense (DRAFT or immediate PAID)",
      params:
        "Body (CreateExpenseDto): expenseTypeId, expenseDate, amount, taxAmount?, paymentModeId, bankAccountId?, glAccountId?, vendorName, referenceNumber?, notes?, status?",
      resp: "201 Created — { data: FinanceExpense }",
      perm: "finance.expense.write",
      val: "422 FUTURE_EXPENSE_DATE; 400 validation error; 404 master item not found",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Lifecycle",
      method: "PATCH",
      endpoint: "/finance/expenses/:id",
      desc: "Update an editable expense record (DRAFT or PENDING_APPROVAL)",
      params:
        "Param: id; Body (UpdateExpenseDto): expenseTypeId?, expenseDate?, amount?, taxAmount?, vendorName?, referenceNumber?, notes?",
      resp: "200 OK — { data: FinanceExpense }",
      perm: "finance.expense.write",
      val: "422 cannot edit APPROVED/PAID/CANCELLED expense; 404 not found",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Lifecycle",
      method: "POST",
      endpoint: "/finance/expenses/:id/submit",
      desc: "Submit a DRAFT expense for manager approval",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinanceExpense (status: PENDING_APPROVAL) }",
      perm: "finance.expense.write",
      val: "422 only DRAFT expenses can be submitted; 404 not found",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Lifecycle",
      method: "POST",
      endpoint: "/finance/expenses/:id/approve",
      desc: "Approve a PENDING_APPROVAL expense",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinanceExpense (status: APPROVED) }",
      perm: "finance.expense.write",
      val: "422 only PENDING_APPROVAL expenses can be approved; 404 not found",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Lifecycle",
      method: "POST",
      endpoint: "/finance/expenses/:id/reject",
      desc: "Reject a PENDING_APPROVAL expense back to DRAFT",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinanceExpense (status: DRAFT) }",
      perm: "finance.expense.write",
      val: "422 only PENDING_APPROVAL expenses can be rejected; 404 not found",
      status: "Verified (Unit Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Settlement",
      method: "POST",
      endpoint: "/finance/expenses/:id/pay",
      desc: "Disburse payment for an expense and atomically post double-entry GL journal",
      params:
        "Param: id; Body (RecordExpensePaymentDto): paymentDate, paymentModeId, bankAccountId?, referenceNumber?",
      resp: "201 Created — { data: FinanceExpense (status: PAID, journalEntryId) }",
      perm: "finance.expense.write",
      val: "422 only APPROVED expenses can be paid; 404 bank account/payment mode missing; creates balanced GL voucher",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Lifecycle",
      method: "POST",
      endpoint: "/finance/expenses/:id/cancel",
      desc: "Cancel an expense (atomically creates GL reversal voucher if already paid)",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinanceExpense (status: CANCELLED) }",
      perm: "finance.expense.write",
      val: "422 cannot cancel already CANCELLED expense; atomically reverses GL journal if PAID",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "HR Integration",
      method: "POST",
      endpoint: "/finance/expenses/from-claim/:claimId",
      desc: "Convert an approved HR Expense Claim into a Finance operating expense",
      params:
        "Param: claimId (ParseIntPipe); Body (CreateExpenseFromClaimDto): glAccountId?, paymentModeId?, bankAccountId?, notes?",
      resp: "201 Created — { data: FinanceExpense }",
      perm: "finance.expense.write",
      val: "404 claim not found; 422 claim not approved or already converted",
      status: "Verified (Unit Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },
    {
      module: "Expenses",
      feature: "Expense Records",
      method: "DELETE",
      endpoint: "/finance/expenses/:id",
      desc: "Soft delete a DRAFT or CANCELLED expense",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.expense.write",
      val: "422 cannot delete APPROVED or PAID expense; 404 not found",
      status: "Verified (Live Tested)",
      source: "apps/api/src/modules/finance/expenses/expenses.controller.ts",
    },

    // GST Registry & Returns
    {
      module: "GST Registry & Returns",
      feature: "GST Ledger",
      method: "POST",
      endpoint: "/finance/gst/entries",
      desc: "Record a GST entry (outward liability or inward input tax credit)",
      params:
        "Body (CreateGstEntryDto): gstin, period (YYYY-MM), entryType (OUTWARD/INWARD), sourceType, sourceReference, taxableAmount, cgstRate?, cgstAmount?, sgstRate?, sgstAmount?, igstRate?, igstAmount?, hsnSacCode?, isProformaExcluded?",
      resp: "201 Created — { data: FinanceGstEntry }",
      perm: "finance.gst.write",
      val: "400 validation error; 422 tax rate math mismatch; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "GST Ledger",
      method: "GET",
      endpoint: "/finance/gst/entries",
      desc: "List GST tax ledger entries with pagination, period, and status filters",
      params:
        "Query: page, limit, period (YYYY-MM), entryType (OUTWARD/INWARD), sourceType, status, search",
      resp: "200 OK — Paginated { data: FinanceGstEntry[], meta }",
      perm: "finance.gst.read",
      val: "400 invalid query; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "GST Detail",
      method: "GET",
      endpoint: "/finance/gst/entries/:id",
      desc: "Retrieve a specific GST tax ledger entry by ID",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinanceGstEntry }",
      perm: "finance.gst.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "Statutory Reports",
      method: "GET",
      endpoint: "/finance/gst/reports/hsn-summary",
      desc: "HSN/SAC summary report aggregating taxable and tax component values",
      params: "Query: period (YYYY-MM), entryType?",
      resp: "200 OK — { data: FinanceHsnSummaryReport (items: HsnSummaryItem[], totalTaxable, totalTax) }",
      perm: "finance.gst.read",
      val: "400 invalid period format; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "Statutory Reports",
      method: "GET",
      endpoint: "/finance/gst/reports/gstr1-summary",
      desc: "GSTR-1 Outward Tax Summary (B2B vs B2C breakdown, rate slabs, proforma exclusion)",
      params: "Query: period (YYYY-MM)",
      resp: "200 OK — { data: FinanceGstr1SummaryReport (b2b, b2c, rateBuckets, totalOutputLiability) }",
      perm: "finance.gst.read",
      val: "400 invalid period; excludes isProformaExcluded=true records",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "Statutory Reports",
      method: "GET",
      endpoint: "/finance/gst/reports/gstr3b-summary",
      desc: "GSTR-3B Summary Report (Outward liability vs Eligible ITC, Net Tax Payable)",
      params: "Query: period (YYYY-MM)",
      resp: "200 OK — { data: FinanceGstr3bSummaryReport (outwardSupplies, eligibleItc, netTaxPayable) }",
      perm: "finance.gst.read",
      val: "400 invalid period; aggregates output tax vs input tax credits",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "ITC Reconciliation",
      method: "POST",
      endpoint: "/finance/gst/reconciliation",
      desc: "Reconcile ERP purchase books against counterpart GSTR-2B filing data",
      params:
        "Body (ReconcileGstDto): period (YYYY-MM), counterpartEntries: CounterpartGstEntryDto[]",
      resp: "201 Created — { data: FinanceGstReconciliationResult (matchedCount, discrepancyCount, items) }",
      perm: "finance.gst.write",
      val: "400 validation error; matches GSTIN + sourceReference + tax amounts within 1 INR tolerance",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },
    {
      module: "GST Registry & Returns",
      feature: "ITC Reconciliation",
      method: "GET",
      endpoint: "/finance/gst/reconciliation/summary",
      desc: "Retrieve period reconciliation status summary and percentage",
      params: "Query: period (YYYY-MM)",
      resp: "200 OK — { data: { period, totalEntries, matched, discrepancies, reconciliationRate } }",
      perm: "finance.gst.read",
      val: "400 invalid period; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/gst/gst.controller.ts",
    },

    // Sales & Purchases Integration
    {
      module: "Sales & Purchases Integration",
      feature: "Sales Posting",
      method: "POST",
      endpoint: "/finance/integration/sales-invoices/post",
      desc: "Post a finalized Sales Invoice / Order to Finance (Journal Entry & Output GST)",
      params:
        "Body (PostSalesInvoiceDto): invoiceReference, customerName, customerId?, invoiceDate, subtotal, taxAmount, totalAmount, cgstAmount?, sgstAmount?, igstAmount?, lineItems[]",
      resp: "201 Created — { data: SalesPurchasesPostingResult (journalEntryId, gstEntryId) }",
      perm: "finance.journal.write",
      val: "422 already posted; 400 validation; debits Accounts Receivable and credits Sales Revenue + Output GST",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
    },
    {
      module: "Sales & Purchases Integration",
      feature: "Sales Reversal",
      method: "POST",
      endpoint: "/finance/integration/sales-invoices/cancel",
      desc: "Cancel and reverse a posted Sales Invoice in Finance (Swapped Journal Entry & Cancel GST)",
      params:
        "Body (CancelIntegrationDocumentDto): documentReference, cancellationDate, reason",
      resp: "201 Created — { data: { success: true, reversalJournalId } }",
      perm: "finance.journal.write",
      val: "404 invoice not posted in finance; 422 already cancelled",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
    },
    {
      module: "Sales & Purchases Integration",
      feature: "Purchase Bill Posting",
      method: "POST",
      endpoint: "/finance/integration/purchase-bills/post",
      desc: "Post a confirmed Purchase Bill to Finance (Journal Entry & Input Tax Credit GST)",
      params:
        "Body (PostPurchaseBillDto): billReference, vendorName, vendorId?, billDate, subtotal, taxAmount, totalAmount, cgstAmount?, sgstAmount?, igstAmount?, lineItems[]",
      resp: "201 Created — { data: SalesPurchasesPostingResult (journalEntryId, gstEntryId) }",
      perm: "finance.journal.write",
      val: "422 already posted; debits Expense/Asset + Input GST and credits Accounts Payable",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
    },
    {
      module: "Sales & Purchases Integration",
      feature: "Purchase Bill Reversal",
      method: "POST",
      endpoint: "/finance/integration/purchase-bills/cancel",
      desc: "Cancel and reverse a posted Purchase Bill in Finance (Swapped Journal Entry & Cancel GST)",
      params:
        "Body (CancelIntegrationDocumentDto): documentReference, cancellationDate, reason",
      resp: "201 Created — { data: { success: true, reversalJournalId } }",
      perm: "finance.journal.write",
      val: "404 bill not posted; 422 already cancelled",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
    },
    {
      module: "Sales & Purchases Integration",
      feature: "Document Audit",
      method: "GET",
      endpoint: "/finance/integration/status/:reference",
      desc: "Retrieve accounting journal and GST integration status for a document reference",
      params: "Param: reference (string)",
      resp: "200 OK — { data: { reference, isJournalPosted, journalEntryId, isGstRecorded, gstEntryId } }",
      perm: "finance.journal.read",
      val: "404 if reference never submitted to integration layer",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
    },

    // General Ledger & Journal Entries
    {
      module: "General Ledger & Journal Entries",
      feature: "Journal Vouchers",
      method: "GET",
      endpoint: "/finance/journal-entries",
      desc: "List journal vouchers with pagination, status, and date filters",
      params:
        "Query: page, limit, status (DRAFT/POSTED/REVERSED/VOID), entryType, startDate, endDate, search",
      resp: "200 OK — Paginated { data: FinanceJournalEntry[], meta }",
      perm: "finance.journal.read",
      val: "400 invalid query parameters; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },
    {
      module: "General Ledger & Journal Entries",
      feature: "Journal Detail",
      method: "GET",
      endpoint: "/finance/journal-entries/:id",
      desc: "Get journal voucher by ID with lines and accounts",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinanceJournalEntry } with lines.account details",
      perm: "finance.journal.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },
    {
      module: "General Ledger & Journal Entries",
      feature: "Voucher Management",
      method: "POST",
      endpoint: "/finance/journal-entries",
      desc: "Create a new draft journal voucher",
      params:
        "Body (CreateJournalEntryDto): entryDate, entryType?, narration, referenceNumber?, lines: CreateJournalLineDto[] (accountId, debit, credit, description?)",
      resp: "201 Created — { data: FinanceJournalEntry }",
      perm: "finance.journal.write",
      val: "422 UNBALANCED_JOURNAL_ENTRY if total debits != total credits; minimum 2 lines required",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },
    {
      module: "General Ledger & Journal Entries",
      feature: "Voucher Management",
      method: "PATCH",
      endpoint: "/finance/journal-entries/:id",
      desc: "Update an existing draft journal voucher",
      params:
        "Param: id; Body (UpdateJournalEntryDto): entryDate?, narration?, referenceNumber?, lines?",
      resp: "200 OK — { data: FinanceJournalEntry }",
      perm: "finance.journal.write",
      val: "422 cannot edit POSTED or REVERSED journal voucher; debits must equal credits",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },
    {
      module: "General Ledger & Journal Entries",
      feature: "Ledger Posting",
      method: "POST",
      endpoint: "/finance/journal-entries/:id/post",
      desc: "Post a draft journal voucher and atomically synchronize ledger balances",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinanceJournalEntry (status: POSTED, postedAt) }",
      perm: "finance.journal.post",
      val: "422 only DRAFT entries can be posted; updates FinanceAccount currentBalance atomically",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },
    {
      module: "General Ledger & Journal Entries",
      feature: "Ledger Reversal",
      method: "POST",
      endpoint: "/finance/journal-entries/:id/reverse",
      desc: "Reverse a posted journal voucher and restore account balances",
      params: "Param: id; Body (ReverseJournalEntryDto): reversalDate, reason",
      resp: "201 Created — { data: FinanceJournalEntry (status: REVERSED, reversalEntryId) }",
      perm: "finance.journal.post",
      val: "422 only POSTED entries can be reversed; creates balanced mirror reversal voucher",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },
    {
      module: "General Ledger & Journal Entries",
      feature: "Voucher Management",
      method: "DELETE",
      endpoint: "/finance/journal-entries/:id",
      desc: "Delete a draft journal voucher",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.journal.write",
      val: "422 cannot delete POSTED or REVERSED entries; deletes lines via cascade",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
    },

    // Payments Made (Disbursements)
    {
      module: "Payments Made",
      feature: "Disbursement Records",
      method: "GET",
      endpoint: "/finance/payments-made",
      desc: "List supplier disbursements with pagination, vendor, bank, date, and status filters",
      params:
        "Query: page, limit, vendorName, bankAccountId, status (DRAFT/CONFIRMED/VOID), startDate, endDate, search",
      resp: "200 OK — Paginated { data: FinancePaymentMade[], meta }",
      perm: "finance.payment_made.read",
      val: "400 invalid query; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },
    {
      module: "Payments Made",
      feature: "Disbursement Detail",
      method: "GET",
      endpoint: "/finance/payments-made/:id",
      desc: "Get payment disbursement details by ID including bank account and GL entry",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinancePaymentMade } with bankAccount, paymentMode, journalEntry",
      perm: "finance.payment_made.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },
    {
      module: "Payments Made",
      feature: "Disbursement Lifecycle",
      method: "POST",
      endpoint: "/finance/payments-made",
      desc: "Record supplier disbursement (CONFIRMED automatically creates and posts GL journal and deducts bank balance)",
      params:
        "Body (CreatePaymentMadeDto): paymentDate, vendorName, amount, paymentModeId, bankAccountId?, referenceNumber?, billReference?, scmSupplierPaymentId?, notes?, status?",
      resp: "201 Created — { data: FinancePaymentMade }",
      perm: "finance.payment_made.write",
      val: "422 FUTURE_PAYMENT_DATE; 400 validation; debits Accounts Payable and credits Bank/Cash",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },
    {
      module: "Payments Made",
      feature: "Disbursement Lifecycle",
      method: "PATCH",
      endpoint: "/finance/payments-made/:id",
      desc: "Update supplier disbursement metadata (vendorName, referenceNumber, billReference, notes)",
      params:
        "Param: id; Body (UpdatePaymentMadeDto): vendorName?, referenceNumber?, billReference?, notes?",
      resp: "200 OK — { data: FinancePaymentMade }",
      perm: "finance.payment_made.write",
      val: "422 cannot edit financial amount/date on CONFIRMED or VOID records; 404 not found",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },
    {
      module: "Payments Made",
      feature: "Disbursement Lifecycle",
      method: "POST",
      endpoint: "/finance/payments-made/:id/confirm",
      desc: "Confirm a draft payment and atomically post double-entry GL journal + deduct bank balance",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinancePaymentMade (status: CONFIRMED) }",
      perm: "finance.payment_made.write",
      val: "422 only DRAFT payments can be confirmed; posts GL journal and updates bank account",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },
    {
      module: "Payments Made",
      feature: "Disbursement Lifecycle",
      method: "POST",
      endpoint: "/finance/payments-made/:id/void",
      desc: "Void a disbursement (atomically creates GL reversal voucher and refunds bank balance)",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinancePaymentMade (status: VOID) }",
      perm: "finance.payment_made.write",
      val: "422 cannot void already VOID disbursement; creates reversal journal and restores balance",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },
    {
      module: "Payments Made",
      feature: "Disbursement Records",
      method: "DELETE",
      endpoint: "/finance/payments-made/:id",
      desc: "Soft delete a DRAFT or VOID supplier disbursement",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.payment_made.write",
      val: "422 cannot delete active CONFIRMED disbursement; 404 not found",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
    },

    // Payments Received (Customer Receipts)
    {
      module: "Payments Received",
      feature: "Receipt Records",
      method: "GET",
      endpoint: "/finance/payments-received",
      desc: "List customer payments received with pagination, customer, date, and status filters",
      params:
        "Query: page, limit, customerId, status (DRAFT/CONFIRMED/VOID), startDate, endDate, search",
      resp: "200 OK — Paginated { data: FinancePaymentReceived[], meta }",
      perm: "finance.payment_received.read",
      val: "400 invalid query; 401 Unauthorized",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Receipt Detail",
      method: "GET",
      endpoint: "/finance/payments-received/:id",
      desc: "Get customer receipt details by ID including invoice allocations and GL entry",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinancePaymentReceived } with allocations[], bankAccount, journalEntry",
      perm: "finance.payment_received.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Receipt Lifecycle",
      method: "POST",
      endpoint: "/finance/payments-received",
      desc: "Record customer receipt (CONFIRMED automatically creates and posts GL journal)",
      params:
        "Body (CreatePaymentReceivedDto): paymentDate, amount, paymentModeId, bankAccountId?, customerId?, customerName, referenceNumber?, notes?, status?, allocations: CreatePaymentAllocationDto[]",
      resp: "201 Created — { data: FinancePaymentReceived } with calculated allocatedAmount & unallocatedAmount",
      perm: "finance.payment_received.write",
      val: "422 FUTURE_PAYMENT_DATE; 422 OVER_ALLOCATION (allocated > amount); debits Bank and credits AR/Advance",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Receipt Lifecycle",
      method: "PATCH",
      endpoint: "/finance/payments-received/:id",
      desc: "Update customer receipt metadata (referenceNumber, notes, customerName)",
      params:
        "Param: id; Body (UpdatePaymentReceivedDto): referenceNumber?, notes?, customerName?",
      resp: "200 OK — { data: FinancePaymentReceived }",
      perm: "finance.payment_received.write",
      val: "422 cannot edit financial amounts on CONFIRMED or VOID records; 404 not found",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Receipt Lifecycle",
      method: "POST",
      endpoint: "/finance/payments-received/:id/confirm",
      desc: "Confirm a draft receipt and atomically post double-entry GL journal",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinancePaymentReceived (status: CONFIRMED) }",
      perm: "finance.payment_received.write",
      val: "422 only DRAFT receipts can be confirmed; 422 ALREADY_CONFIRMED",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Receipt Lifecycle",
      method: "POST",
      endpoint: "/finance/payments-received/:id/void",
      desc: "Void a receipt (atomically creates GL reversal voucher and inverts account balances)",
      params: "Param: id (ParseIntPipe)",
      resp: "201 Created — { data: FinancePaymentReceived (status: VOID) }",
      perm: "finance.payment_received.write",
      val: "422 cannot void already VOID receipt; reverses GL journal voucher",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Invoice Allocations",
      method: "POST",
      endpoint: "/finance/payments-received/:id/allocations",
      desc: "Allocate a portion of unallocated receipt balance to an invoice reference",
      params:
        "Param: id; Body (CreatePaymentAllocationDto): invoiceReference, allocatedAmount, notes?",
      resp: "201 Created — { data: FinancePaymentReceivedAllocation }",
      perm: "finance.payment_received.write",
      val: "422 INSUFFICIENT_UNALLOCATED_AMOUNT; 422 cannot allocate to VOID receipt",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Invoice Allocations",
      method: "DELETE",
      endpoint: "/finance/payments-received/:id/allocations/:allocationId",
      desc: "Remove an invoice allocation and restore unallocated receipt balance",
      params: "Param: id, allocationId (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.payment_received.write",
      val: "404 allocation not found; updates unallocatedAmount dynamically",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },
    {
      module: "Payments Received",
      feature: "Receipt Records",
      method: "DELETE",
      endpoint: "/finance/payments-received/:id",
      desc: "Soft delete a DRAFT or VOID customer receipt",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance.payment_received.write",
      val: "422 cannot delete CONFIRMED receipt; 404 not found",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
    },

    // Financial Reports
    {
      module: "Financial Reports",
      feature: "Income Statement",
      method: "GET",
      endpoint: "/finance/reports/profit-and-loss",
      desc: "Profit & Loss statement (Revenue, Expenses, Net Income) derived from posted journal lines",
      params: "Query: startDate, endDate (YYYY-MM-DD)",
      resp: "200 OK — { data: FinanceProfitAndLossReport (operatingRevenue, operatingExpenses, netProfitLoss) }",
      perm: "finance.journal.read",
      val: '400 invalid date filter; aggregates only status="POSTED" lines',
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/reports/reports.controller.ts",
    },
    {
      module: "Financial Reports",
      feature: "Balance Sheet",
      method: "GET",
      endpoint: "/finance/reports/balance-sheet",
      desc: "Balance Sheet snapshot (Assets, Liabilities, Equity) verifying Assets = Liabilities + Equity",
      params: "Query: asOfDate (YYYY-MM-DD)",
      resp: "200 OK — { data: FinanceBalanceSheetReport (assets, liabilities, equity, isBalanced: true) }",
      perm: "finance.journal.read",
      val: "400 invalid date; verifies fundamental accounting equation A = L + E",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/reports/reports.controller.ts",
    },
    {
      module: "Financial Reports",
      feature: "Trial Balance",
      method: "GET",
      endpoint: "/finance/reports/trial-balance",
      desc: "Trial Balance summarizing opening, period, and closing balances for all Chart of Accounts records",
      params: "Query: startDate, endDate, includeZeroBalances?",
      resp: "200 OK — { data: FinanceTrialBalanceReport (accounts: TrialBalanceItem[], totalDebit, totalCredit) }",
      perm: "finance.journal.read",
      val: "400 invalid date range; verifies sum(debits) == sum(credits)",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/reports/reports.controller.ts",
    },
    {
      module: "Financial Reports",
      feature: "General Ledger",
      method: "GET",
      endpoint: "/finance/reports/general-ledger",
      desc: "Account-level General Ledger statement with chronologically ordered posted transactions and running balance",
      params: "Query: accountId (required), startDate, endDate",
      resp: "200 OK — { data: GeneralLedgerAccountReport (account, openingBalance, transactions[], closingBalance) }",
      perm: "finance.journal.read",
      val: "404 account not found; computes running balance chronologically",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/reports/reports.controller.ts",
    },
    {
      module: "Financial Reports",
      feature: "Treasury Summary",
      method: "GET",
      endpoint: "/finance/reports/cash-bank-summary",
      desc: "Cash and Bank balances, period inflows, outflows, and closing balances across all treasury accounts",
      params: "Query: startDate, endDate",
      resp: "200 OK — { data: FinanceCashBankSummaryReport (accounts: CashBankAccountSummaryItem[], totalLiquidAssets) }",
      perm: "finance.journal.read",
      val: "400 invalid date range; aggregates bank transactions & GL cash accounts",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/reports/reports.controller.ts",
    },
    {
      module: "Financial Reports",
      feature: "Period Closing",
      method: "GET",
      endpoint: "/finance/reports/period-closing-status",
      desc: "Financial Period Closing status audit (draft entry validation, debit/credit balancing, unreconciled items)",
      params: "Query: periodEndDate (YYYY-MM-DD)",
      resp: "200 OK — { data: FinancePeriodClosingStatus (canClose: boolean, draftJournalsCount, unreconciledBankCount, unbalancedEntriesCount) }",
      perm: "finance.journal.read",
      val: "Audit check blocking period closure if drafts or unbalanced entries remain",
      status: "Verified (Code & Controller)",
      source: "apps/api/src/modules/finance/reports/reports.controller.ts",
    },

    // Finance Settings
    {
      module: "Finance Settings",
      feature: "Master List Items",
      method: "GET",
      endpoint: "/finance-settings/master-list-items",
      desc: "List master list items by category (e.g. expense_type, payment_mode)",
      params: "Query: category (required string), page, limit",
      resp: "200 OK — Paginated { data: FinanceMasterListItem[], meta }",
      perm: "finance_settings.master_list_item.read",
      val: "400 category required; 401 Unauthorized",
      status: "Verified (Live Tested)",
      source:
        "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
    },
    {
      module: "Finance Settings",
      feature: "Master List Items",
      method: "GET",
      endpoint: "/finance-settings/master-list-items/:id",
      desc: "Retrieve a specific master list item by ID",
      params: "Param: id (ParseIntPipe)",
      resp: "200 OK — { data: FinanceMasterListItem }",
      perm: "finance_settings.master_list_item.read",
      val: "404 not found; 401 Unauthorized",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
    },
    {
      module: "Finance Settings",
      feature: "Master List Items",
      method: "POST",
      endpoint: "/finance-settings/master-list-items",
      desc: "Create a new master list item for an expense type or payment mode",
      params:
        "Body (CreateMasterListItemDto): category, value, numericValue?, customFields?",
      resp: "201 Created — { data: FinanceMasterListItem }",
      perm: "finance_settings.master_list_item.write",
      val: "400 validation error; 409 unique value within org category; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
    },
    {
      module: "Finance Settings",
      feature: "Master List Items",
      method: "PATCH",
      endpoint: "/finance-settings/master-list-items/:id",
      desc: "Update a master list item metadata",
      params: "Param: id; Body: value?, numericValue?, customFields?",
      resp: "200 OK — { data: FinanceMasterListItem }",
      perm: "finance_settings.master_list_item.write",
      val: "404 not found; 400 validation; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
    },
    {
      module: "Finance Settings",
      feature: "Master List Items",
      method: "DELETE",
      endpoint: "/finance-settings/master-list-items/:id",
      desc: "Soft delete a master list item",
      params: "Param: id (ParseIntPipe)",
      resp: "204 No Content",
      perm: "finance_settings.master_list_item.write",
      val: "404 not found; 409 if referenced by active expenses or payments; 403 Forbidden",
      status: "Verified (Code & Controller)",
      source:
        "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
    },
  ];

  let apiRIdx = 5;
  endpointDetails.forEach((e, i) => {
    const row = wsApi.getRow(apiRIdx);
    row.height = 24;
    const values = [
      e.module,
      e.feature,
      e.method,
      e.endpoint,
      e.desc,
      e.params,
      e.resp,
      e.perm,
      e.val,
      e.status,
      e.source,
    ];
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 2 || c === 9 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 2) {
        // Method badge colors
        const mColors = {
          GET: { fg: "FF0369A1", bg: "FFE0F2FE" },
          POST: { fg: "FF166534", bg: "FFDCFCE7" },
          PATCH: { fg: "FFB45309", bg: "FFFEF3C7" },
          DELETE: { fg: "FF991B1B", bg: "FFFEE2E2" },
        };
        const mc = mColors[v] || { fg: "FF1E293B", bg: "FFF1F5F9" };
        cell.font = {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: mc.fg },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: mc.bg },
        };
      }
      if (c === 9 && statusStyles[v]) {
        cell.fill = statusStyles[v].fill;
        cell.font = statusStyles[v].font;
      }
    });
    apiRIdx++;
  });

  wsApi.autoFilter = { from: "A4", to: `K${apiRIdx - 1}` };

  // ==========================================
  // SHEET 3: Database & Schemas
  // ==========================================
  console.log("Generating Sheet 3: Database & Schemas...");
  const wsDb = wb.addWorksheet("Database & Schemas", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  wsDb.columns = [
    { header: "Module", key: "module", width: 22 },
    { header: "Model / Schema / DTO Name", key: "name", width: 34 },
    { header: "Type", key: "type", width: 18 },
    { header: "Purpose", key: "purpose", width: 44 },
    { header: "Important Fields and Data Types", key: "fields", width: 50 },
    { header: "Relationships / Mappings", key: "relations", width: 42 },
    { header: "Validation Rules / Constraints", key: "validation", width: 44 },
    { header: "Source File", key: "sourceFile", width: 48 },
    { header: "Notes", key: "notes", width: 36 },
  ];

  wsDb.mergeCells("A1:I1");
  const dbTitle = wsDb.getCell("A1");
  dbTitle.value =
    "TexaWave ERP — Finance Database Models, Schemas & DTO Reference";
  dbTitle.font = titleFont;
  dbTitle.fill = titleFill;
  dbTitle.alignment = { vertical: "middle", indent: 1 };
  wsDb.getRow(1).height = 36;

  wsDb.mergeCells("A2:I2");
  const dbSub = wsDb.getCell("A2");
  dbSub.value =
    "Prisma PostgreSQL Models, Multi-tenancy Scoping, Shared Enums, Backend NestJS DTOs & Frontend Zod Schemas";
  dbSub.font = subTitleFont;
  dbSub.fill = titleFill;
  dbSub.alignment = { vertical: "middle", indent: 1 };
  wsDb.getRow(2).height = 20;

  wsDb.getRow(3).height = 8;

  const dbHRow = wsDb.getRow(4);
  const dbHeaders = [
    "Module",
    "Model / Schema / DTO Name",
    "Type",
    "Purpose",
    "Important Fields and Data Types",
    "Relationships / Mappings",
    "Validation Rules / Constraints",
    "Source File",
    "Notes",
  ];
  dbHeaders.forEach((h, i) => {
    const cell = dbHRow.getCell(i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  dbHRow.height = 28;

  const schemaEntries = [
    // 1. Prisma Models
    {
      module: "Chart of Accounts",
      name: "FinanceAccount",
      type: "Prisma Model",
      purpose:
        "Core Chart of Accounts entity storing account master codes, classifications, balances, and hierarchical parent-child groupings",
      fields:
        'id (Int PK), organizationId (Int), accountCode (String), accountName (String), accountType (String: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), parentAccountId (Int?), currency (String, default "INR"), currentBalance (Decimal 15,2), isActive (Boolean), isReconciled (Boolean), deletedAt (Timestamptz?)',
      relations:
        "Table: finance.accounts; organization -> Organization; parentAccount -> FinanceAccount; subAccounts -> FinanceAccount[]; journalLines -> FinanceJournalLine[]; bankAccounts -> FinanceBankAccount[]; expenses -> FinanceExpense[]",
      val: "@@unique([organizationId, accountCode]); @@index([organizationId, accountType]); @@index([organizationId, isActive])",
      source: "packages/database/prisma/schema.prisma",
      notes:
        'Tenant-scoped; multi-schema @@schema("finance"); soft delete via deletedAt',
    },
    {
      module: "General Ledger",
      name: "FinanceJournalEntry",
      type: "Prisma Model",
      purpose:
        "Double-entry general ledger voucher header recording debit/credit postings, audit timestamps, and voucher lifecycles",
      fields:
        "id (Int PK), organizationId (Int), entryNumber (String), entryDate (Date), entryType (String: MANUAL/EXPENSE/PAYMENT_RECEIVED/PAYMENT_MADE/BANK_TRANSFER/OPENING_BALANCE/REVERSAL), narration (String), totalDebit (Decimal 15,2), totalCredit (Decimal 15,2), status (String: DRAFT/POSTED/REVERSED/VOID), postedAt (Timestamptz?), reversedEntryId (Int? Unique)",
      relations:
        "Table: finance.journal_entries; organization -> Organization; reversedEntry -> FinanceJournalEntry (reversal self-relation); lines -> FinanceJournalLine[]; bankTxnMatch, expense, receivedPay, madePay",
      val: "@@unique([organizationId, entryNumber]); @@index([organizationId, entryDate]); @@index([organizationId, status]); totalDebit must equal totalCredit on post",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; no soft delete (immutable audit trail; reversal via reversedEntryId)",
    },
    {
      module: "General Ledger",
      name: "FinanceJournalLine",
      type: "Prisma Model",
      purpose:
        "Individual debit or credit posting leg within a balanced journal entry voucher",
      fields:
        "id (Int PK), organizationId (Int), journalEntryId (Int), accountId (Int), lineOrder (Int), description (String?), debit (Decimal 15,2), credit (Decimal 15,2)",
      relations:
        "Table: finance.journal_lines; organization -> Organization; journalEntry -> FinanceJournalEntry (onDelete: Cascade); account -> FinanceAccount (onDelete: Restrict)",
      val: "@@index([organizationId, journalEntryId]); @@index([organizationId, accountId]); debit >= 0, credit >= 0",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; cascade deleted with draft journal entry; restrict on account",
    },
    {
      module: "Treasury & Banking",
      name: "FinanceBankAccount",
      type: "Prisma Model",
      purpose:
        "Bank and liquid treasury accounts storing bank institution details, IFSC routing, account numbers, and GL asset linkages",
      fields:
        'id (Int PK), organizationId (Int), accountName (String), accountNumber (String), bankName (String), ifscCode (String), branchName (String?), accountType (String: CHECKING/SAVINGS/CURRENT/CREDIT_CARD/OVERDRAFT/CASH), currency (String, "INR"), openingBalance (Decimal 15,2), currentBalance (Decimal 15,2), glAccountId (Int?), isActive (Boolean), deletedAt (Timestamptz?)',
      relations:
        "Table: finance.bank_accounts; organization -> Organization; glAccount -> FinanceAccount?; transactions -> FinanceBankTransaction[]; expenses -> FinanceExpense[]; paymentsReceived -> FinancePaymentReceived[]; paymentsMade -> FinancePaymentMade[]",
      val: "@@unique([organizationId, accountNumber]); @@index([organizationId, isActive]); @@index([organizationId, glAccountId])",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; soft-delete via deletedAt; updates currentBalance on bank transactions",
    },
    {
      module: "Treasury & Banking",
      name: "FinanceBankTransaction",
      type: "Prisma Model",
      purpose:
        "Bank statement transactions representing credit/debit movements with reconciliation state against GL journal vouchers",
      fields:
        "id (Int PK), organizationId (Int), bankAccountId (Int), transactionDate (Date), transactionType (String: CREDIT/DEBIT), amount (Decimal 15,2), description (String), referenceNumber (String?), isReconciled (Boolean), reconciledAt (Timestamptz?), matchedJournalEntryId (Int? Unique)",
      relations:
        "Table: finance.bank_transactions; organization -> Organization; bankAccount -> FinanceBankAccount; matchedJournalEntry -> FinanceJournalEntry?",
      val: "@@index([organizationId, bankAccountId]); @@index([organizationId, transactionDate]); @@index([organizationId, isReconciled])",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; auto-adjusts bank account currentBalance on insert",
    },
    {
      module: "Expenses",
      name: "FinanceExpense",
      type: "Prisma Model",
      purpose:
        "Operating expense vouchers tracking operational spend, tax deductions, multi-stage approval, and GL disbursement posting",
      fields:
        "id (Int PK), organizationId (Int), expenseNumber (String), expenseTypeId (Int), expenseDate (Date), amount (Decimal 15,2), taxAmount (Decimal 15,2), netAmount (Decimal 15,2), paymentModeId (Int), bankAccountId (Int?), glAccountId (Int?), vendorName (String), referenceNumber (String?), notes (String?), status (String: DRAFT/PENDING_APPROVAL/APPROVED/PAID/CANCELLED), journalEntryId (Int? Unique), hrExpenseClaimId (Int? Unique), deletedAt (Timestamptz?)",
      relations:
        "Table: finance.expenses; organization -> Organization; expenseType -> FinanceMasterListItem; paymentMode -> FinanceMasterListItem; bankAccount -> FinanceBankAccount?; glAccount -> FinanceAccount?; journalEntry -> FinanceJournalEntry?",
      val: "@@unique([organizationId, expenseNumber]); @@index([organizationId, expenseDate]); @@index([organizationId, status]); netAmount = amount + taxAmount",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; soft delete via deletedAt; links HR claims via hrExpenseClaimId",
    },
    {
      module: "Payments Received",
      name: "FinancePaymentReceived",
      type: "Prisma Model",
      purpose:
        "Incoming customer receipts tracking payments, bank account deposits, invoice allocations, and double-entry GL journal posting",
      fields:
        "id (Int PK), organizationId (Int), paymentNumber (String), paymentDate (Date), amount (Decimal 15,2), allocatedAmount (Decimal 15,2), unallocatedAmount (Decimal 15,2), paymentModeId (Int), bankAccountId (Int?), customerId (Int?), customerName (String), referenceNumber (String?), notes (String?), status (String: DRAFT/CONFIRMED/VOID), journalEntryId (Int? Unique), deletedAt (Timestamptz?)",
      relations:
        "Table: finance.payments_received; organization -> Organization; paymentMode -> FinanceMasterListItem; bankAccount -> FinanceBankAccount?; journalEntry -> FinanceJournalEntry?; allocations -> FinancePaymentReceivedAllocation[]",
      val: "@@unique([organizationId, paymentNumber]); @@index([organizationId, paymentDate]); @@index([organizationId, status]); allocatedAmount + unallocatedAmount = amount",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; soft delete via deletedAt; customerId is optional (CRM account ID)",
    },
    {
      module: "Payments Received",
      name: "FinancePaymentReceivedAllocation",
      type: "Prisma Model",
      purpose:
        "Invoice allocation line items linking portions of a customer payment receipt to sales invoice references",
      fields:
        "id (Int PK), organizationId (Int), paymentReceivedId (Int), invoiceReference (String), allocatedAmount (Decimal 15,2), allocationDate (Timestamptz), notes (String?)",
      relations:
        "Table: finance.payment_received_allocations; organization -> Organization; paymentReceived -> FinancePaymentReceived (onDelete: Cascade)",
      val: "@@index([organizationId, paymentReceivedId]); @@index([organizationId, invoiceReference]); allocatedAmount > 0; Sum(allocated) <= payment.amount",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Uses invoiceReference string (no dedicated SalesInvoice FK table in current schema)",
    },
    {
      module: "Payments Made",
      name: "FinancePaymentMade",
      type: "Prisma Model",
      purpose:
        "Supplier disbursements and Accounts Payable payments with GL posting and SCM purchase bill integration",
      fields:
        "id (Int PK), organizationId (Int), paymentNumber (String), paymentDate (Date), vendorName (String), amount (Decimal 15,2), paymentModeId (Int), bankAccountId (Int?), referenceNumber (String?), billReference (String?), scmSupplierPaymentId (Int? Unique), notes (String?), status (String: DRAFT/CONFIRMED/VOID), journalEntryId (Int? Unique), deletedAt (Timestamptz?)",
      relations:
        "Table: finance.payments_made; organization -> Organization; paymentMode -> FinanceMasterListItem; bankAccount -> FinanceBankAccount?; journalEntry -> FinanceJournalEntry?; scmPayment -> ScmSupplierPayment?",
      val: "@@unique([organizationId, paymentNumber]); @@index([organizationId, paymentDate]); @@index([organizationId, status])",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; soft delete via deletedAt; links SCM supplier payments",
    },
    {
      module: "GST Registry & Returns",
      name: "FinanceGstEntry",
      type: "Prisma Model",
      purpose:
        "GST tax ledger entries tracking outward tax liabilities (sales) and inward input tax credit (purchases/expenses)",
      fields:
        "id (Int PK), organizationId (Int), gstin (String), period (String: YYYY-MM), entryType (String: OUTWARD/INWARD), sourceType (String: SALES_INVOICE/PURCHASE_BILL/EXPENSE/JOURNAL_MANUAL/CREDIT_NOTE/DEBIT_NOTE), sourceId (Int?), sourceReference (String), hsnSacCode (String?), taxableAmount (Decimal 15,2), cgstRate (Decimal 5,2), cgstAmount (Decimal 15,2), sgstRate (Decimal 5,2), sgstAmount (Decimal 15,2), igstRate (Decimal 5,2), igstAmount (Decimal 15,2), totalTaxAmount (Decimal 15,2), isProformaExcluded (Boolean), status (String: ACTIVE/CANCELLED/RECONCILED)",
      relations: "Table: finance.gst_entries; organization -> Organization",
      val: "@@index([organizationId, period, entryType]); @@index([organizationId, sourceReference]); totalTaxAmount = cgstAmount + sgstAmount + igstAmount",
      source: "packages/database/prisma/schema.prisma",
      notes:
        "Tenant-scoped; feeds GSTR-1, GSTR-3B, and HSN statutory return summaries",
    },
    {
      module: "Finance Settings",
      name: "FinanceMasterListItem",
      type: "Prisma Model",
      purpose:
        "Master data categories for configurable finance lookup values (e.g. expense types, payment modes, financial years)",
      fields:
        "id (Int PK), organizationId (Int), category (String: expense_type, payment_mode), value (String), numericValue (Decimal 10,4?), customFields (Json), isActive (Boolean), deletedAt (Timestamptz?)",
      relations:
        "Table: finance.finance_master_list_items; organization -> Organization; expensesMode, paymentsReceivedMode, paymentsMadeMode",
      val: "@@unique([organizationId, category, value]); @@index([organizationId, category, isActive])",
      source: "packages/database/prisma/schema.prisma",
      notes: "Tenant-scoped; soft delete via deletedAt",
    },

    // 2. Conceptual Entities & Dependency Blockers
    {
      module: "Sales Integration",
      name: "SalesInvoice",
      type: "Conceptual Entity / Blocker",
      purpose:
        "Customer sales billing document entity expected by UI/QA for live invoice balance and due date lookups",
      fields:
        "invoiceNumber, customerId, invoiceDate, dueDate, totalAmount, paidAmount, outstandingAmount, status",
      relations:
        "Currently referenced as free-text string (invoiceReference) in payment_received_allocations and gst_entries",
      val: "Blocker: No dedicated table exists in schema.prisma. Payment allocations accept any non-empty string reference",
      source: "Docs/POSTMAN_FINANCE_EXPENSES_PAYMENTS.md §2",
      notes:
        "Future Sales module implementation will add dedicated table and foreign key constraints",
    },
    {
      module: "SCM Integration",
      name: "PurchaseBill",
      type: "Conceptual Entity / Shared",
      purpose:
        "Vendor supplier bills for procurement of goods/services, linked to Payments Made and Input Tax Credit",
      fields:
        "billNumber, vendorId, billDate, dueDate, subtotal, taxAmount, totalAmount, paymentStatus",
      relations:
        "Linked to FinancePaymentMade via billReference (String) and scmSupplierPaymentId (FK to scm_supplier_payments)",
      val: "SCM module provides supplier bill entity; Finance integration controller consumes bill payloads directly",
      source: "apps/api/src/modules/finance/integration/",
      notes: "Supported via /finance/integration/purchase-bills/post endpoint",
    },

    // 3. Enums & Constants
    {
      module: "Shared / Constants",
      name: "FinanceAccountType",
      type: "Enum / Type",
      purpose: "5 fundamental accounting classifications in Chart of Accounts",
      fields: "Values: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE",
      relations:
        "Used in FinanceAccount, CreateAccountDto, and report calculations",
      val: "Validated via isIn(FINANCE_ACCOUNT_TYPES) in DTOs and Zod schemas",
      source: "packages/api-types/src/finance.ts",
      notes:
        "Determines normal balance (Debits increase Assets/Expenses; Credits increase Liabilities/Equity/Revenue)",
    },
    {
      module: "Shared / Constants",
      name: "FinanceJournalEntryType",
      type: "Enum / Type",
      purpose: "Origin and categorization of general ledger vouchers",
      fields:
        "Values: MANUAL, EXPENSE, PAYMENT_RECEIVED, PAYMENT_MADE, BANK_TRANSFER, OPENING_BALANCE, REVERSAL",
      relations: "Used in FinanceJournalEntry, CreateJournalEntryDto",
      val: "Validated via isIn(FINANCE_JOURNAL_ENTRY_TYPES)",
      source: "packages/api-types/src/finance.ts",
      notes:
        "Distinguishes user-entered vouchers from automated subsystem postings",
    },
    {
      module: "Shared / Constants",
      name: "FinanceJournalEntryStatus",
      type: "Enum / Type",
      purpose: "Lifecycle states of general ledger vouchers",
      fields: "Values: DRAFT, POSTED, REVERSED, VOID",
      relations: "Used in FinanceJournalEntry",
      val: "DRAFT allows edits; POSTED updates account balances; REVERSED creates audit reversal voucher",
      source: "packages/api-types/src/finance.ts",
      notes: "Only POSTED entries affect financial statements",
    },
    {
      module: "Shared / Constants",
      name: "FinanceExpenseStatus",
      type: "Enum / Type",
      purpose: "Operational expense lifecycle states",
      fields: "Values: DRAFT, PENDING_APPROVAL, APPROVED, PAID, CANCELLED",
      relations: "Used in FinanceExpense, CreateExpenseDto",
      val: "Strict state transitions: DRAFT -> PENDING_APPROVAL -> APPROVED -> PAID -> CANCELLED",
      source: "packages/api-types/src/finance.ts",
      notes: "Paid expenses automatically create GL journal voucher",
    },
    {
      module: "Shared / Constants",
      name: "FinancePaymentReceivedStatus",
      type: "Enum / Type",
      purpose: "Customer receipt lifecycle states",
      fields: "Values: DRAFT, CONFIRMED, VOID",
      relations: "Used in FinancePaymentReceived",
      val: "CONFIRMED posts GL journal; VOID reverses journal voucher",
      source: "packages/api-types/src/finance.ts",
      notes: "Only DRAFT or VOID receipts can be soft deleted",
    },
    {
      module: "Shared / Constants",
      name: "FinancePaymentMadeStatus",
      type: "Enum / Type",
      purpose: "Supplier disbursement lifecycle states",
      fields: "Values: DRAFT, CONFIRMED, VOID",
      relations: "Used in FinancePaymentMade",
      val: "CONFIRMED posts GL journal and deducts bank balance; VOID reverses journal and restores bank balance",
      source: "packages/api-types/src/finance.ts",
      notes: "Default creation status is CONFIRMED unless specified as DRAFT",
    },
    {
      module: "Shared / Constants",
      name: "FinanceBankAccountType",
      type: "Enum / Type",
      purpose: "Banking institution account classifications",
      fields:
        "Values: CHECKING, SAVINGS, CURRENT, CREDIT_CARD, OVERDRAFT, CASH",
      relations: "Used in FinanceBankAccount, CreateBankAccountDto",
      val: "Validated via isIn(FINANCE_BANK_ACCOUNT_TYPES); default is CURRENT",
      source: "packages/api-types/src/finance.ts",
      notes: "Indian banking standards typically use CURRENT or SAVINGS",
    },
    {
      module: "Shared / Constants",
      name: "FinanceGstEntryType & Source",
      type: "Enum / Type",
      purpose: "Tax direction and document source classifications",
      fields:
        "EntryType: OUTWARD, INWARD | SourceType: SALES_INVOICE, PURCHASE_BILL, EXPENSE, JOURNAL_MANUAL, CREDIT_NOTE, DEBIT_NOTE",
      relations: "Used in FinanceGstEntry, CreateGstEntryDto",
      val: "OUTWARD = tax liability (GSTR-1); INWARD = input tax credit (GSTR-2B/3B)",
      source: "packages/api-types/src/finance.ts",
      notes: "Status values: UNFILED, FILED, RECONCILED, DISCREPANCY, EXCLUDED",
    },

    // 4. Backend DTOs & Validation
    {
      module: "Expenses",
      name: "CreateExpenseDto",
      type: "Backend DTO",
      purpose: "Payload validator for creating operating expenses",
      fields:
        "expenseTypeId (Int), expenseDate (DateString), amount (>0), taxAmount? (>=0), paymentModeId (Int), bankAccountId? (Int), vendorName (1-200 chars), referenceNumber? (1-100), notes? (1-1000), status? (DRAFT/PAID)",
      relations: "Maps to FinanceExpense creation in expenses.service.ts",
      val: "Custom validator rejectFutureDate rejects future expenseDate with 422; requires amount > 0",
      source: "apps/api/src/modules/finance/expenses/dto/create-expense.dto.ts",
      notes: "Net amount is automatically calculated as amount + taxAmount",
    },
    {
      module: "Expenses",
      name: "RecordExpensePaymentDto",
      type: "Backend DTO",
      purpose:
        "Payload validator for recording disbursement against approved expense",
      fields:
        "paymentDate (DateString), paymentModeId (Int), bankAccountId? (Int), referenceNumber? (String)",
      relations: "Used in POST /finance/expenses/:id/pay",
      val: "Rejects future date; validates bankAccountId exists and is active",
      source:
        "apps/api/src/modules/finance/expenses/dto/record-expense-payment.dto.ts",
      notes: "Atomically creates and posts double-entry GL journal voucher",
    },
    {
      module: "Payments Received",
      name: "CreatePaymentReceivedDto",
      type: "Backend DTO",
      purpose: "Payload validator for recording incoming customer receipts",
      fields:
        "paymentDate (DateString), amount (>0), paymentModeId (Int), bankAccountId? (Int), customerId? (Int), customerName (1-200), referenceNumber? (1-100), notes?, status?, allocations?: CreatePaymentAllocationDto[]",
      relations:
        "Maps to FinancePaymentReceived and FinancePaymentReceivedAllocation[]",
      val: "rejectFutureDate; validates sum(allocations.allocatedAmount) <= amount (rejects over-allocation with 422)",
      source:
        "apps/api/src/modules/finance/payments-received/dto/create-payment-received.dto.ts",
      notes:
        "Maintains balance integrity: amount = allocatedAmount + unallocatedAmount",
    },
    {
      module: "Payments Received",
      name: "CreatePaymentAllocationDto",
      type: "Backend DTO",
      purpose:
        "Payload validator for allocating receipt amount to invoice reference",
      fields:
        "invoiceReference (1-100 chars non-empty), allocatedAmount (>0), notes? (1-1000 chars)",
      relations: "Maps to FinancePaymentReceivedAllocation",
      val: "Must be positive amount; checks available unallocatedAmount before adding allocation",
      source:
        "apps/api/src/modules/finance/payments-received/dto/create-allocation.dto.ts",
      notes:
        "Frontend and backend models match field names and validation rules",
    },
    {
      module: "Payments Made",
      name: "CreatePaymentMadeDto",
      type: "Backend DTO",
      purpose: "Payload validator for recording supplier disbursements",
      fields:
        "paymentDate (DateString), vendorName (1-200), amount (>0), paymentModeId (Int), bankAccountId? (Int), referenceNumber?, billReference?, scmSupplierPaymentId?, notes?, status?",
      relations: "Maps to FinancePaymentMade and links ScmSupplierPayment",
      val: "rejectFutureDate; defaults to CONFIRMED; auto-deducts bank currentBalance and posts GL voucher",
      source:
        "apps/api/src/modules/finance/payments-made/dto/create-payment-made.dto.ts",
      notes: "Supports direct integration with SCM supplier payments",
    },
    {
      module: "General Ledger",
      name: "CreateJournalEntryDto",
      type: "Backend DTO",
      purpose: "Payload validator for manual journal entry vouchers",
      fields:
        "entryDate (DateString), entryType? (FinanceJournalEntryType), narration (1-500), referenceNumber?, lines: CreateJournalLineDto[]",
      relations: "Maps to FinanceJournalEntry and nested FinanceJournalLine[]",
      val: "Minimum 2 lines required; validates Sum(debit) == Sum(credit) within 0.01 tolerance; line debit/credit cannot both be positive",
      source:
        "apps/api/src/modules/finance/journal/dto/create-journal-entry.dto.ts",
      notes:
        "Rejects unbalanced vouchers at service layer with 422 UNBALANCED_JOURNAL_ENTRY",
    },
    {
      module: "Treasury & Banking",
      name: "CreateBankAccountDto",
      type: "Backend DTO",
      purpose: "Payload validator for creating bank accounts",
      fields:
        "accountName (1-100), accountNumber (1-50), bankName (1-100), ifscCode (1-20), branchName?, accountType?, currency?, openingBalance? (>=0), glAccountId?, isActive?",
      relations: "Maps to FinanceBankAccount; links GL asset account",
      val: "accountNumber unique per organization; ifscCode validated; openingBalance >= 0",
      source:
        "apps/api/src/modules/finance/banking/dto/create-bank-account.dto.ts",
      notes: "Indian IFSC code regex: ^[A-Z]{4}0[A-Z0-9]{6}$",
    },
    {
      module: "GST Registry & Returns",
      name: "CreateGstEntryDto",
      type: "Backend DTO",
      purpose: "Payload validator for recording tax ledger entries",
      fields:
        "gstin (15 chars), period (YYYY-MM), entryType (OUTWARD/INWARD), sourceType, sourceReference, taxableAmount, cgstRate?, cgstAmount?, sgstRate?, sgstAmount?, igstRate?, igstAmount?, hsnSacCode?, isProformaExcluded?",
      relations: "Maps to FinanceGstEntry",
      val: "GSTIN regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$; Period regex: ^\\d{4}-(0[1-9]|1[0-2])$",
      source: "apps/api/src/modules/finance/gst/dto/create-gst-entry.dto.ts",
      notes: "Validates that tax components sum up to totalTaxAmount",
    },

    // 5. Frontend Zod Schemas
    {
      module: "Expenses",
      name: "createExpenseSchema",
      type: "Frontend Zod Schema",
      purpose: "Form validation schema for creating operational expenses in UI",
      fields:
        "expenseTypeId (z.number()), expenseDate (z.string().regex(YYYY-MM-DD)), amount (z.number().positive()), taxAmount (z.number().min(0)), paymentModeId (z.number()), bankAccountId (z.number().nullable().optional()), vendorName (z.string().min(1).max(200)), referenceNumber (z.string().max(100).optional()), notes (z.string().max(1000).optional())",
      relations: "Used in AddExpenseDialog.tsx and EditExpenseDialog.tsx",
      val: "refine rejects future dates: val <= new Date().toISOString().slice(0, 10); positive amount",
      source: "apps/ui/src/features/finance/expenses/schema.ts",
      notes: "Matches backend CreateExpenseDto validation rules",
    },
    {
      module: "Payments Received",
      name: "createPaymentReceivedSchema",
      type: "Frontend Zod Schema",
      purpose: "Form validation schema for customer payments received in UI",
      fields:
        "paymentDate (YYYY-MM-DD), amount (positive), paymentModeId (positive int), bankAccountId (optional), customerId (optional), customerName (min 1, max 200), referenceNumber (optional), notes (optional), allocations (array of allocation items)",
      relations: "Used in RecordPaymentReceivedDialog.tsx",
      val: "Rejects future payment dates; validates sum(allocations) <= amount with user-friendly error message",
      source: "apps/ui/src/features/finance/payments-received/schema.ts",
      notes: "Matches backend CreatePaymentReceivedDto",
    },
    {
      module: "Treasury & Banking",
      name: "createBankAccountSchema",
      type: "Frontend Zod Schema",
      purpose: "Form validation schema for adding bank accounts in UI",
      fields:
        'accountName (1-100), accountNumber (1-50), bankName (1-100), ifscCode (regex INDIAN_IFSC_REGEX), branchName (optional), accountType (enum), currency ("INR"), openingBalance (min 0), glAccountId (optional)',
      relations:
        "Used in AddBankAccountDialog.tsx and EditBankAccountDialog.tsx",
      val: "Strict 11-character Indian IFSC regex: ^[A-Z]{4}0[A-Z0-9]{6}$; openingBalance >= 0",
      source: "apps/ui/src/features/finance/banking/schema.ts",
      notes: "Ensures uppercase conversion of IFSC before submit",
    },
    {
      module: "GST Registry & Returns",
      name: "createGstEntrySchema",
      type: "Frontend Zod Schema",
      purpose: "Form validation schema for recording manual GST entries in UI",
      fields:
        'gstin (regex INDIAN_GSTIN_REGEX), period (regex GST_PERIOD_REGEX YYYY-MM), entryType ("OUTWARD"|"INWARD"), sourceType (enum), sourceReference (min 1), taxableAmount (positive), cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount, hsnSacCode (optional)',
      relations: "Used in AddGstEntryDialog.tsx",
      val: "15-character statutory GSTIN regex; automated tax computation based on interstate/intrastate selection",
      source: "apps/ui/src/features/finance/gst/schema.ts",
      notes: "Proforma invoices toggle isProformaExcluded",
    },
    {
      module: "General Ledger",
      name: "createJournalEntrySchema",
      type: "Frontend Zod Schema",
      purpose: "Form validation schema for manual journal vouchers in UI",
      fields:
        "entryDate (YYYY-MM-DD), entryType (enum), narration (min 3, max 500), referenceNumber (optional), lines: array of { accountId, debit, credit, description }",
      relations: "Used in CreateJournalDialog.tsx",
      val: "Requires minimum 2 lines; refine checks Math.abs(sumDebits - sumCredits) < 0.01; each line must have either debit > 0 or credit > 0",
      source: "apps/ui/src/features/finance/journal/schema.ts",
      notes:
        "Live UI displays real-time difference badge (Out of Balance indicator)",
    },
  ];

  let dbRIdx = 5;
  schemaEntries.forEach((s, i) => {
    const row = wsDb.getRow(dbRIdx);
    row.height = 26;
    const values = [
      s.module,
      s.name,
      s.type,
      s.purpose,
      s.fields,
      s.relations,
      s.val,
      s.source,
      s.notes,
    ];
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 0 || c === 2 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 2) {
        // Type badge colors
        const tColors = {
          "Prisma Model": { fg: "FF0369A1", bg: "FFE0F2FE" },
          "Conceptual Entity / Blocker": { fg: "FF991B1B", bg: "FFFEE2E2" },
          "Conceptual Entity / Shared": { fg: "FFB45309", bg: "FFFEF3C7" },
          "Enum / Type": { fg: "FF166534", bg: "FFDCFCE7" },
          "Backend DTO": { fg: "FF4338CA", bg: "FFE0E7FF" },
          "Frontend Zod Schema": { fg: "FF0D9488", bg: "FFCCFBF1" },
        };
        const tc = tColors[v] || { fg: "FF1E293B", bg: "FFF1F5F9" };
        cell.font = {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: tc.fg },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: tc.bg },
        };
      }
    });
    dbRIdx++;
  });

  wsDb.autoFilter = { from: "A4", to: `I${dbRIdx - 1}` };

  // ==========================================
  // SHEET 4: Manual Postman Test
  // ==========================================
  console.log("Generating Sheet 4: Manual Postman Test...");
  const wsTest = wb.addWorksheet("Manual Postman Test", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  wsTest.columns = [
    { header: "Test Case ID", key: "id", width: 14 },
    { header: "Module", key: "module", width: 22 },
    { header: "Test Scenario", key: "scenario", width: 38 },
    { header: "Method", key: "method", width: 10 },
    { header: "Endpoint", key: "endpoint", width: 44 },
    { header: "Request / Parameters", key: "request", width: 46 },
    { header: "Expected Result", key: "expected", width: 44 },
    { header: "Actual Result", key: "actual", width: 34 },
    { header: "Status", key: "status", width: 16 },
    { header: "Notes / Dependencies", key: "notes", width: 46 },
    { header: "Prerequisites / Headers", key: "prereq", width: 32 },
  ];

  wsTest.mergeCells("A1:K1");
  const testTitle = wsTest.getCell("A1");
  testTitle.value =
    "TexaWave ERP — Consolidated Manual Postman Test Suite (88 Test Cases)";
  testTitle.font = titleFont;
  testTitle.fill = titleFill;
  testTitle.alignment = { vertical: "middle", indent: 1 };
  wsTest.getRow(1).height = 36;

  wsTest.mergeCells("A2:K2");
  const testSub = wsTest.getCell("A2");
  testSub.value =
    "Consolidation of Payments Received API, Expenses API, and Pending API Checks + New Implemented Modules | 44 Preserved + 44 New Cases";
  testSub.font = subTitleFont;
  testSub.fill = titleFill;
  testSub.alignment = { vertical: "middle", indent: 1 };
  wsTest.getRow(2).height = 20;

  wsTest.getRow(3).height = 8;

  const testHRow = wsTest.getRow(4);
  const testHeaders = [
    "Test Case ID",
    "Module",
    "Test Scenario",
    "Method",
    "Endpoint",
    "Request / Parameters",
    "Expected Result",
    "Actual Result",
    "Status",
    "Notes / Dependencies",
    "Prerequisites / Headers",
  ];
  testHeaders.forEach((h, i) => {
    const cell = testHRow.getCell(i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  testHRow.height = 28;

  // 1. Preserved Payments Received Tests (PR-001 to PR-019)
  const prTests = [
    {
      id: "PR-001",
      module: "Payments Received",
      scenario: "Authentication & Token Extraction",
      method: "POST",
      endpoint: "{{baseUrl}}/auth/login",
      req: '{\n  "organizationSlug": "{{organizationSlug}}",\n  "email": "{{email}}",\n  "password": "{{password}}"\n}',
      expected:
        "Expected per project guide: 201 Created; response contains data.accessToken.",
      actual: "201 OK (121 MS)",
      status: "Completed",
      notes:
        "Set Body → raw → JSON, enter your real local credentials, click Send, save data.accessToken as accessToken.",
      prereq: "baseUrl, organizationSlug, email, password",
    },
    {
      id: "PR-002",
      module: "Payments Received",
      scenario: "Discover Payment Modes (Master List)",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance-settings/master-list-items?category=payment_mode&limit=10",
      req: "(No body)",
      expected:
        "200 OK with payment mode items; save a real item id as paymentModeId.",
      actual: "200 OK (46MS)",
      status: "Completed",
      notes:
        "Add Bearer token. Click Send. Pick an active payment mode from the response; do not guess its ID.",
      prereq: "accessToken; finance settings read permission",
    },
    {
      id: "PR-003",
      module: "Payments Received",
      scenario: "Discover Finance Bank Accounts",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/bank-accounts",
      req: "(No body)",
      expected:
        "Expected 200 OK if route and permission are enabled; save an eligible bankAccountId.",
      actual: "200 OK (26 MS)",
      status: "Completed",
      notes:
        "Send with Bearer token. If no account exists, mark BLOCKED and ask for a test account to be seeded.",
      prereq: "accessToken; check current controller/permission",
    },
    {
      id: "PR-004",
      module: "Payments Received",
      scenario: "Discover CRM Customer Accounts",
      method: "GET",
      endpoint: "{{baseUrl}}/crm/accounts?type=CUSTOMER",
      req: "(No body)",
      expected:
        "Expected 200 OK if this route/query matches the current CRM API; save a real customerId.",
      actual: "200 OK (23 MS)",
      status: "Completed",
      notes:
        "Send with Bearer token. If route differs, inspect current CRM controller and update URL; do not guess IDs.",
      prereq: "accessToken; CRM read permission",
    },
    {
      id: "PR-005",
      module: "Payments Received",
      scenario:
        "Record Customer Receipt (Draft) with Multi-Invoice Allocations",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/payments-received",
      req: '{\n  "paymentDate": "2026-10-23",\n  "amount": 8000.00,\n  "paymentModeId": {{paymentModeId}},\n  "customerName": "Globex Corporation",\n  "referenceNumber": "TEST-NEFT-001",\n  "notes": "Postman test - customer advance",\n  "status": "DRAFT",\n  "allocations": [\n    {"invoiceReference": "TEST-INV-0044", "allocatedAmount": 3000.00},\n    {"invoiceReference": "TEST-INV-0045", "allocatedAmount": 2000.00}\n  ]\n}',
      expected:
        "Expected 201 Created per guide. amount=8000, allocatedAmount=5000, unallocatedAmount=3000, status=DRAFT. Save data.id as paymentReceivedId and first allocation id as allocationId.",
      actual: "200 OK (26 MS), paymentmodeid 7, payment recive id : (7) 14",
      status: "Completed",
      notes:
        "Use test data. Important: current DTO allows optional customerId. Check DTO before sending.",
      prereq:
        "accessToken, paymentModeId; customerId/bankAccountId if required",
    },
    {
      id: "PR-006",
      module: "Payments Received",
      scenario: "Get Customer Receipt Details by ID",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}",
      req: "(No body)",
      expected: "200 OK; id matches and details/allocations persist.",
      actual: "200 OK (129 MS)",
      status: "Completed",
      notes:
        "Run after create succeeds. Compare amount, status, allocation rows and totals.",
      prereq: "paymentReceivedId; read permission",
    },
    {
      id: "PR-007",
      module: "Payments Received",
      scenario: "List & Filter Customer Payments Received",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/payments-received?page=1&limit=10&status=DRAFT",
      req: "(No body)",
      expected:
        "200 OK with paginated list and metadata; created draft should appear.",
      actual: "200 OK (61 MS)",
      status: "Completed",
      notes:
        "Find the created receipt in the result and check pagination metadata.",
      prereq: "read permission",
    },
    {
      id: "PR-008",
      module: "Payments Received",
      scenario: "Update Receipt Metadata (Draft)",
      method: "PATCH",
      endpoint: "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}",
      req: '{\n  "referenceNumber": "TEST-NEFT-UPDATED-001",\n  "notes": "Updated reference during Postman test"\n}',
      expected:
        "Expected 200 OK; reference and notes updated, totals unchanged.",
      actual: "200 OK (11 MS)",
      status: "Completed",
      notes:
        "Use a DRAFT test receipt. Send JSON, then GET the receipt again to verify persistence.",
      prereq: "paymentReceivedId; write permission",
    },
    {
      id: "PR-009",
      module: "Payments Received",
      scenario: "Dynamically Add Invoice Allocation",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}/allocations",
      req: '{\n  "invoiceReference": "TEST-INV-0046",\n  "allocatedAmount": 500.00,\n  "notes": "Additional allocation test"\n}',
      expected:
        "Expected 201 per guide. If initial allocation was 5000, allocatedAmount=5500 and unallocatedAmount=2500.",
      actual: "201 OK (41 MS)",
      status: "Completed",
      notes: "Ensure at least 500 remains unallocated. Save new allocation ID.",
      prereq: "paymentReceivedId; write permission; enough unallocated amount",
    },
    {
      id: "PR-010",
      module: "Payments Received",
      scenario: "Remove Invoice Allocation",
      method: "DELETE",
      endpoint:
        "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}/allocations/{{allocationId}}",
      req: "(No body)",
      expected:
        "Expected 204 No Content. GET receipt afterward: allocatedAmount decreases and unallocated increases by 500.",
      actual: "204 NO CONTENT (18 MS)",
      status: "Completed",
      notes:
        "Use allocationId from PR-009. Send DELETE then run GET /finance/payments-received/{{paymentReceivedId}}.",
      prereq: "paymentReceivedId, allocationId; write permission",
    },
    {
      id: "PR-011",
      module: "Payments Received",
      scenario: "Confirm Receipt & Post Double-Entry GL Journal",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}/confirm",
      req: "(No body)",
      expected:
        "Expected 201 Created. status=CONFIRMED, journalEntryId is populated; journal lines debit Bank and credit AR/Advance.",
      actual: "201 Created (15 MS)",
      status: "Completed",
      notes:
        "Save data.journalEntryId as paymentJournalId. Irreversible posting test.",
      prereq: "paymentReceivedId; status DRAFT; journal write/post permission",
    },
    {
      id: "PR-012",
      module: "Payments Received",
      scenario: "Negative: Prevent Double-Confirm on Confirmed Receipt",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}/confirm",
      req: "(No body)",
      expected:
        "Expected 422 Unprocessable Entity (e.g. ALREADY_CONFIRMED). No duplicate journal voucher.",
      actual: "EXPECTED 422 ALREDY CREATED (11 MS)",
      status: "Completed",
      notes:
        "Send confirm immediately again on the receipt confirmed in PR-011.",
      prereq: "Confirmed paymentReceivedId",
    },
    {
      id: "PR-013",
      module: "Payments Received",
      scenario: "Void Receipt & Reverse GL Journal Voucher",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}/void",
      req: "(No body)",
      expected:
        "Expected 201 Created. status=VOID. Original journal is reversed; reversal journal credits Bank and debits AR.",
      actual: "201 created (49 MS)",
      status: "Completed",
      notes: "Void the confirmed receipt from PR-011.",
      prereq: "paymentReceivedId (CONFIRMED); post permission",
    },
    {
      id: "PR-014",
      module: "Payments Received",
      scenario: "Soft Delete Void Receipt",
      method: "DELETE",
      endpoint: "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}",
      req: "(No body)",
      expected:
        "Expected 204 No Content. Record is soft-deleted; subsequent GET returns 404.",
      actual: "404 no content",
      status: "Completed",
      notes:
        "Use the VOID receipt from PR-013. Check that row is soft deleted in payments_received.",
      prereq: "paymentReceivedId (VOID); write permission",
    },
    {
      id: "PR-015",
      module: "Payments Received",
      scenario: "Negative: Reject Future Payment Date",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/payments-received",
      req: '{\n  "paymentDate": "2099-01-01",\n  "amount": 1000,\n  "paymentModeId": {{paymentModeId}},\n  "customerName": "Future Date Negative Test",\n  "status": "DRAFT"\n}',
      expected:
        "Expected 422 FUTURE_PAYMENT_DATE or equivalent validation error; no record created.",
      actual:
        "422 EXPECTED BUT IT SAYS ,Unprocessable Entity (WebDAV) (RFC 4918)",
      status: "Completed",
      notes: "Separate negative test; verify no record was created.",
      prereq: "paymentModeId; write permission",
    },
    {
      id: "PR-016",
      module: "Payments Received",
      scenario: "Negative: Reject Over-Allocation on Creation",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/payments-received",
      req: '{\n  "paymentDate": "2026-10-23",\n  "amount": 1000.00,\n  "paymentModeId": {{paymentModeId}},\n  "customerName": "Over-Allocation Negative Test",\n  "status": "DRAFT",\n  "allocations": [\n    {"invoiceReference": "TEST-INV-OVER", "allocatedAmount": 1500.00}\n  ]\n}',
      expected:
        "Expected 422 OVER_ALLOCATION; sum of allocations (1500) exceeds total payment amount (1000).",
      actual:
        "422 EXPECTED BUT IT SAYS ,Unprocessable Entity (WebDAV) (RFC 4918)",
      status: "Completed",
      notes: "Separate negative test; allocation integrity check.",
      prereq: "paymentModeId; write permission",
    },
    {
      id: "PR-017",
      module: "Payments Received",
      scenario: "Negative: Reject Allocation on Void Receipt",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}/allocations",
      req: '{\n  "invoiceReference": "TEST-INV-VOID-ADD",\n  "allocatedAmount": 100.00\n}',
      expected:
        "Expected 422 Unprocessable Entity; cannot modify allocations on a VOID receipt.",
      actual: "EXPECTED 422 (47 MS)",
      status: "Completed",
      notes: "Use the voided receipt from PR-013.",
      prereq: "Void paymentReceivedId",
    },
    {
      id: "PR-018",
      module: "Payments Received",
      scenario: "Negative: Reject Unauthenticated Request (401)",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}",
      req: "(No Bearer token)",
      expected: "Expected 401 Unauthorized; token missing or expired.",
      actual: "401 unauthorized",
      status: "Completed",
      notes: "Remove Bearer token header completely before sending.",
      prereq: "Any valid endpoint URL; no auth header",
    },
    {
      id: "PR-019",
      module: "Payments Received",
      scenario: "Negative: Prevent Metadata Edit on Void Receipt",
      method: "PATCH",
      endpoint: "{{baseUrl}}/finance/payments-received/{{paymentReceivedId}}",
      req: '{\n  "notes": "Attempting edit on void record"\n}',
      expected:
        "Expected 422 Unprocessable Entity or 400; immutable once VOID.",
      actual: "EXPECTED",
      status: "Completed",
      notes: "Use the voided receipt from PR-013.",
      prereq: "Void paymentReceivedId; write permission",
    },
  ];

  // 2. Preserved Expenses Tests (EXP-001 to EXP-010)
  const expTests = [
    {
      id: "EXP-001",
      module: "Expenses",
      scenario: "Create Operational Expense (Draft)",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/expenses",
      req: '{\n  "expenseTypeId": {{expenseTypeId}},\n  "expenseDate": "2026-10-23",\n  "amount": 3000.00,\n  "taxAmount": 540.00,\n  "paymentModeId": {{paymentModeId}},\n  "vendorName": "Apex Office Hub",\n  "referenceNumber": "TEST-EXP-001",\n  "notes": "Postman test - workstation equipment",\n  "status": "DRAFT"\n}',
      expected:
        "Expected 201; status=DRAFT; netAmount may equal 3540 if net is amount plus tax. Save data.id as expenseId.",
      actual: "expected 201",
      status: "Completed",
      notes:
        "Discover expenseTypeId and paymentModeId first. Send as raw JSON; check current DTO for required fields.",
      prereq: "expenseTypeId, paymentModeId; write permission",
    },
    {
      id: "EXP-002",
      module: "Expenses",
      scenario: "Get Expense Details by ID",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}",
      req: "(No body)",
      expected:
        "Expected 200 OK; id matches expenseId; expenseType and paymentMode relations populated.",
      actual: "200 OK",
      status: "Completed",
      notes:
        "Run after EXP-001. Check expenseNumber, status=DRAFT, amount=3000, netAmount=3540.",
      prereq: "expenseId; read permission",
    },
    {
      id: "EXP-003",
      module: "Expenses",
      scenario: "List & Filter Operating Expenses",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/expenses?status=DRAFT&page=1&limit=10",
      req: "(No body)",
      expected:
        "Expected 200 OK with paginated list and metadata; draft expense appears.",
      actual: "200 OK",
      status: "Completed",
      notes:
        "Compare page, limit, total counts in meta against actual results.",
      prereq: "read permission",
    },
    {
      id: "EXP-004",
      module: "Expenses",
      scenario: "Update Expense Metadata (Draft)",
      method: "PATCH",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}",
      req: '{\n  "vendorName": "Apex Office Hub (Updated)",\n  "notes": "Postman test - updated notes during verification"\n}',
      expected:
        "Expected 200 OK; vendorName and notes updated, amount and status unchanged.",
      actual: "200 OK",
      status: "Completed",
      notes: "Use a DRAFT expense. Send JSON, then GET to confirm persistence.",
      prereq: "expenseId; write permission",
    },
    {
      id: "EXP-005",
      module: "Expenses",
      scenario: "Submit Expense for Manager Approval",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}/submit",
      req: "(No body)",
      expected:
        "Expected 201 Created; status changes from DRAFT to PENDING_APPROVAL.",
      actual: "201 created",
      status: "Completed",
      notes: "Check state transition rules in expenses.service.ts.",
      prereq: "expenseId (DRAFT); write permission",
    },
    {
      id: "EXP-006",
      module: "Expenses",
      scenario: "Approve Operating Expense",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}/approve",
      req: "(No body)",
      expected:
        "Expected 201 Created; status changes from PENDING_APPROVAL to APPROVED.",
      actual: "201 created",
      status: "Completed",
      notes: "Service checks status=PENDING_APPROVAL before approving.",
      prereq: "expenseId (PENDING_APPROVAL); write permission",
    },
    {
      id: "EXP-007",
      module: "Expenses",
      scenario: "Pay Expense & Post GL Journal Voucher",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}/pay",
      req: '{\n  "paymentDate": "2026-10-23",\n  "paymentModeId": {{paymentModeId}},\n  "bankAccountId": {{bankAccountId}},\n  "referenceNumber": "DISB-2026-001"\n}',
      expected:
        "Expected 201 Created; status changes to PAID; journalEntryId is populated; journal lines debit Expense and credit Bank/Cash.",
      actual: "Exxpected 201",
      status: "Completed",
      notes:
        "Save data.journalEntryId as expenseJournalId. Inspect journal detail to verify balanced posting.",
      prereq: "expenseId (APPROVED), bankAccountId; write permission",
    },
    {
      id: "EXP-008",
      module: "Expenses",
      scenario: "Cancel Paid Expense & Generate GL Reversal Voucher",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}/cancel",
      req: "(No body)",
      expected:
        "Expected 201 Created; status changes to CANCELLED; reversal journal created atomically.",
      actual: "201 created",
      status: "Completed",
      notes:
        "Verify original journal is reversed and reversal journal inverts debits and credits.",
      prereq: "expenseId (PAID); write permission",
    },
    {
      id: "EXP-009",
      module: "Expenses",
      scenario: "Soft Delete Cancelled Expense",
      method: "DELETE",
      endpoint: "{{baseUrl}}/finance/expenses/{{expenseId}}",
      req: "(No body)",
      expected:
        "Expected 204 No Content. Expense is soft-deleted; deletedAt is set in DB.",
      actual: "204 No Content",
      status: "Completed",
      notes: "Use CANCELLED expense from EXP-008. Verify GET returns 404.",
      prereq: "expenseId (CANCELLED); write permission",
    },
    {
      id: "EXP-010",
      module: "Expenses",
      scenario: "Negative: Reject Future Expense Date",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/expenses",
      req: '{\n  "expenseTypeId": {{expenseTypeId}},\n  "expenseDate": "2099-01-01",\n  "amount": 1000,\n  "taxAmount": 0,\n  "paymentModeId": {{paymentModeId}},\n  "vendorName": "Future Date Negative Test",\n  "referenceNumber": "TEST-EXP-FUTURE",\n  "notes": "Intentional invalid future date",\n  "status": "DRAFT"\n}',
      expected:
        "Expected 422 FUTURE_EXPENSE_DATE or equivalent; no record created.",
      actual: "422 Expected",
      status: "Completed",
      notes:
        "Separate negative test; verify no record was created. Adapt body to current DTO.",
      prereq: "expenseTypeId, paymentModeId; write permission",
    },
  ];

  // 3. Preserved Pending API & Security Checks (CHK-001 to CHK-015)
  const chkTests = [
    {
      id: "CHK-001",
      module: "Payments Received",
      scenario: "Create → GET → List End-to-End Cycle",
      method: "POST/GET",
      endpoint: "/finance/payments-received",
      req: "PR-005 → PR-006 → PR-007 sequence",
      expected:
        "Created receipt persists and appears in detail and paginated list with identical amounts and status.",
      actual: "PASS (Verified in PR-005, PR-006, PR-007)",
      status: "PASS",
      notes: "Ran create, detail and list requests on local development API.",
      prereq: "Local API and database",
    },
    {
      id: "CHK-002",
      module: "Payments Received",
      scenario: "Confirm + Double-Entry GL Posting Verification",
      method: "POST",
      endpoint: "/finance/payments-received/:id/confirm",
      req: "POST /finance/payments-received/{{paymentReceivedId}}/confirm",
      expected:
        "status=CONFIRMED; exactly one GL journal voucher created; total debits == total credits.",
      actual: "Pending live DB journal line check",
      status: "Pending",
      notes:
        "Live database posting not proven by unit tests alone. Confirm a test receipt and inspect journal detail.",
      prereq: "Test receipt in DRAFT status",
    },
    {
      id: "CHK-003",
      module: "Payments Received",
      scenario: "Void + GL Reversal Integrity",
      method: "POST",
      endpoint: "/finance/payments-received/:id/void",
      req: "POST /finance/payments-received/{{paymentReceivedId}}/void",
      expected:
        "status=VOID; original journal reversed; reversal journal balances and references original.",
      actual: "Pending live verification",
      status: "Pending",
      notes:
        "Void a confirmed test receipt and inspect original/reversal journals in DB.",
      prereq: "Confirmed test receipt",
    },
    {
      id: "CHK-004",
      module: "Payments Received",
      scenario: "Dynamic Allocation Balance Arithmetic",
      method: "POST/DELETE",
      endpoint: "/finance/payments-received/:id/allocations",
      req: "Add allocation (PR-009) then Remove (PR-010)",
      expected:
        "allocatedAmount equals sum of allocations; unallocatedAmount equals amount minus allocated.",
      actual: "Pending arithmetic check",
      status: "Pending",
      notes:
        "GET receipt after every allocation change; verify DB columns match calculated values.",
      prereq: "Test receipt with unallocated balance",
    },
    {
      id: "CHK-005",
      module: "Payments Received",
      scenario: "Overdue & Due-Month Server-Side Filter Verification",
      method: "GET",
      endpoint: "/finance/payments-received",
      req: "Query parameters for due date / overdue",
      expected:
        "No advance credit labelled overdue; accurate server-side counts across pages.",
      actual: "Pending (P0 audit risk)",
      status: "Pending",
      notes:
        "Audit found client-side filtering of only current page and no authoritative SalesInvoice model.",
      prereq: "Multiple test receipts across date ranges",
    },
    {
      id: "CHK-006",
      module: "Sales Integration",
      scenario: "Invoice Source & Status Synchronization Blocker",
      method: "N/A",
      endpoint: "packages/database/prisma/schema.prisma",
      req: "Inspect SalesInvoice relation",
      expected:
        "Do not claim live invoice balance, due date, or payment status sync without authoritative source.",
      actual: "Pending (Dependency Blocker)",
      status: "Pending",
      notes:
        "Invoice reference is free text string; schema has no dedicated SalesInvoice model.",
      prereq: "Sales module architecture alignment",
    },
    {
      id: "CHK-007",
      module: "Payments Received UI",
      scenario: "UI Edit Draft Action Parity with API",
      method: "PATCH",
      endpoint: "/finance/payments-received/:id",
      req: "Edit draft receipt in UI dialog",
      expected:
        "Draft can be edited in UI; PATCH succeeds; confirmed/reconciled/void remain restricted.",
      actual: "Pending UI implementation",
      status: "Pending",
      notes:
        "Audit reports PATCH exists in backend API but UI edit action modal is missing in PaymentsReceivedView.tsx.",
      prereq: "Frontend UI component update",
    },
    {
      id: "CHK-008",
      module: "Payments Received API",
      scenario: "Allocation Response TypeScript Typing Alignment",
      method: "POST",
      endpoint: "/finance/payments-received/:id/allocations",
      req: "Compare controller response with frontend api.ts",
      expected:
        "Frontend TypeScript type matches actual backend payload without runtime casting errors.",
      actual: "Pending type inspection",
      status: "Pending",
      notes:
        "Audit reports frontend type differs from backend response (complete payment vs single allocation).",
      prereq: "apps/ui/src/features/finance/payments-received/api.ts",
    },
    {
      id: "CHK-009",
      module: "Security",
      scenario: "Unauthenticated Request Rejection (401)",
      method: "GET",
      endpoint: "/finance/expenses, /finance/payments-received",
      req: "Send protected GET request without Authorization header",
      expected:
        "HTTP 401 Unauthorized; no protected tenant data returned in response payload.",
      actual: "Pending live security check",
      status: "Pending",
      notes: "Verify across all 74 finance routes.",
      prereq: "No Bearer token",
    },
    {
      id: "CHK-010",
      module: "Security",
      scenario: "Role-Based Write Permission Denial (403)",
      method: "POST",
      endpoint: "/finance/expenses, /finance/payments-received",
      req: "POST using JWT token belonging to read-only user role",
      expected: "HTTP 403 Forbidden; no records inserted, updated, or deleted.",
      actual: "Pending live RBAC check",
      status: "Pending",
      notes: "Requires a dedicated read-only test account in test DB.",
      prereq: "Read-only user credentials",
    },
    {
      id: "CHK-011",
      module: "Security",
      scenario: "Multi-Tenant Cross-Organization Isolation (404)",
      method: "GET/PATCH",
      endpoint: "/finance/payments-received/:id",
      req: "Access Org A record ID using Org B JWT bearer token",
      expected:
        "HTTP 404 Not Found; zero cross-tenant data leakage or tampering.",
      actual: "Pending dual-tenant test",
      status: "Pending",
      notes: "Requires two test organizations seeded in local test DB.",
      prereq: "Two organization slugs and credentials",
    },
    {
      id: "CHK-012",
      module: "Expenses",
      scenario: "Expenses End-to-End Lifecycle Audit",
      method: "POST",
      endpoint: "/finance/expenses/:id/(submit|approve|pay|cancel)",
      req: "Execute complete lifecycle: DRAFT → SUBMIT → APPROVE → PAY → CANCEL",
      expected:
        "Correct status sequence, balanced GL journal posting on PAY, and mirror reversal on CANCEL.",
      actual: "Pending live lifecycle run",
      status: "Pending",
      notes: "Prepared manual tests need live execution on disposable test DB.",
      prereq: "Test expense record",
    },
    {
      id: "CHK-013",
      module: "UI/API E2E",
      scenario: "Browser to API End-to-End Workflow",
      method: "E2E",
      endpoint: "apps/ui/e2e/",
      req: "Playwright spec creating expense/payment and verifying UI table update",
      expected:
        "UI payloads match API; visible state in browser matches persisted PostgreSQL database state.",
      actual: "Pending Playwright spec",
      status: "Pending",
      notes:
        "Audit says no Playwright UI E2E spec exists for this feature yet.",
      prereq: "Isolated test DB and Redis runner",
    },
    {
      id: "CHK-014",
      module: "Test Infrastructure",
      scenario: "Disposable E2E DB & Redis Test Harness Safety",
      method: "Test Infra",
      endpoint: "scripts/e2e-guard",
      req: "Run E2E test harness without disposable container configuration",
      expected:
        "E2E runs strictly against disposable test DB and dedicated Redis, never texawave_erp.",
      actual: "Pending infra setup",
      status: "Pending",
      notes:
        "Project notes say harness safely aborted because test DB/Redis unavailable.",
      prereq: "docker-compose test services",
    },
    {
      id: "CHK-015",
      module: "Request Contract",
      scenario: "Customer & Bank Prerequisites Validation",
      method: "POST",
      endpoint: "/finance/payments-received",
      req: "Verify required vs optional status for customerId and bankAccountId",
      expected:
        "Requests use actual required fields and real IDs without schema rejection.",
      actual: "Pending DTO alignment",
      status: "Pending",
      notes:
        "Docs vary between customerName/customerId and optional/required bankAccountId.",
      prereq: "Discovery endpoints",
    },
  ];

  // 4. Newly Added Test Cases for Other Implemented Modules (44 New Cases)
  const newTests = [
    // Payments Made (7)
    {
      id: "PM-001",
      module: "Payments Made",
      scenario: "Record Supplier Disbursement (Draft)",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/payments-made",
      req: '{\n  "paymentDate": "2026-10-23",\n  "vendorName": "Apex Supplies Ltd",\n  "amount": 4500.00,\n  "paymentModeId": {{paymentModeId}},\n  "bankAccountId": {{bankAccountId}},\n  "billReference": "BILL-2026-0045",\n  "referenceNumber": "NEFT-PM-001",\n  "status": "DRAFT"\n}',
      expected:
        '201 Created — { data: FinancePaymentMade (status: DRAFT, paymentNumber: "PM-...") }',
      actual: "Code verified in payments-made.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes:
        "New manual test case covering Payments Made milestone. DRAFT allows metadata edits.",
      prereq: "paymentModeId, bankAccountId",
    },
    {
      id: "PM-002",
      module: "Payments Made",
      scenario: "Get Supplier Disbursement by ID",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/payments-made/{{paymentMadeId}}",
      req: "(No body)",
      expected:
        "200 OK — { data: FinancePaymentMade } with bankAccount and paymentMode relations.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Verifies persistence and relation lookups.",
      prereq: "paymentMadeId",
    },
    {
      id: "PM-003",
      module: "Payments Made",
      scenario: "List Supplier Disbursements with Pagination & Filters",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/payments-made?page=1&limit=10&status=DRAFT",
      req: "(No body)",
      expected:
        "200 OK — Paginated { data: FinancePaymentMade[], meta: { total, page, limit } }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Verifies repository where clause and multi-tenant scoping.",
      prereq: "finance.payment_made.read",
    },
    {
      id: "PM-004",
      module: "Payments Made",
      scenario: "Update Disbursement Metadata (Draft)",
      method: "PATCH",
      endpoint: "{{baseUrl}}/finance/payments-made/{{paymentMadeId}}",
      req: '{\n  "vendorName": "Apex Supplies Ltd (Updated)",\n  "notes": "Updated delivery terms"\n}',
      expected:
        "200 OK — { data: FinancePaymentMade } with updated vendorName and notes.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Only DRAFT records allow editing; financial amounts are locked once confirmed.",
      prereq: "paymentMadeId (DRAFT)",
    },
    {
      id: "PM-005",
      module: "Payments Made",
      scenario: "Confirm Disbursement & Post GL Double-Entry Journal",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/payments-made/{{paymentMadeId}}/confirm",
      req: "(No body)",
      expected:
        "201 Created — status=CONFIRMED, journalEntryId populated; debits AP and credits Bank.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Deducts bank account balance and creates balanced GL journal voucher.",
      prereq: "paymentMadeId (DRAFT), bankAccountId",
    },
    {
      id: "PM-006",
      module: "Payments Made",
      scenario: "Void Disbursement & Reverse GL Journal Voucher",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/payments-made/{{paymentMadeId}}/void",
      req: "(No body)",
      expected:
        "201 Created — status=VOID; reversal journal created; bank account balance restored.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Verifies reversal symmetry and balance refund.",
      prereq: "paymentMadeId (CONFIRMED)",
    },
    {
      id: "PM-007",
      module: "Payments Made",
      scenario: "Soft Delete Void Disbursement",
      method: "DELETE",
      endpoint: "{{baseUrl}}/finance/payments-made/{{paymentMadeId}}",
      req: "(No body)",
      expected:
        "204 No Content. Soft-deleted in DB; subsequent GET returns 404.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Cannot delete active CONFIRMED payments.",
      prereq: "paymentMadeId (VOID)",
    },

    // Treasury & Banking (8)
    {
      id: "BNK-001",
      module: "Treasury & Banking",
      scenario: "Create Bank Account Master Record",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/bank-accounts",
      req: '{\n  "accountName": "HDFC Operating Current A/C",\n  "accountNumber": "50200012345678",\n  "bankName": "HDFC Bank",\n  "ifscCode": "HDFC0001234",\n  "branchName": "Koramangala, Bangalore",\n  "accountType": "CURRENT",\n  "currency": "INR",\n  "openingBalance": 100000.00\n}',
      expected:
        "201 Created — { data: FinanceBankAccount (id, currentBalance: 100000) }",
      actual: "Code verified in banking.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes: "Sets up bank account used by payments and disbursements.",
      prereq: "finance.banking.write",
    },
    {
      id: "BNK-002",
      module: "Treasury & Banking",
      scenario: "Get Bank Account Details by ID",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/bank-accounts/{{bankAccountId}}",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceBankAccount } with GL account link and balances.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Verifies bank account detail view.",
      prereq: "bankAccountId",
    },
    {
      id: "BNK-003",
      module: "Treasury & Banking",
      scenario: "List Bank Accounts with Status & Search Filters",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/bank-accounts?page=1&limit=10&isActive=true",
      req: "(No body)",
      expected: "200 OK — Paginated { data: FinanceBankAccount[], meta }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Feeds bank account dropdowns in expense and payment dialogs.",
      prereq: "finance.banking.read",
    },
    {
      id: "BNK-004",
      module: "Treasury & Banking",
      scenario: "Update Bank Account Details",
      method: "PATCH",
      endpoint: "{{baseUrl}}/finance/bank-accounts/{{bankAccountId}}",
      req: '{\n  "branchName": "Koramangala 5th Block, Bangalore",\n  "isActive": true\n}',
      expected:
        "200 OK — { data: FinanceBankAccount } with updated branch metadata.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Account number is immutable to prevent reconciliation breakage.",
      prereq: "bankAccountId",
    },
    {
      id: "BNK-005",
      module: "Treasury & Banking",
      scenario: "Record Manual Bank Transaction (Credit/Deposit)",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/bank-transactions",
      req: '{\n  "bankAccountId": {{bankAccountId}},\n  "transactionDate": "2026-10-23",\n  "transactionType": "CREDIT",\n  "amount": 25000.00,\n  "description": "Client RTGS direct bank credit",\n  "referenceNumber": "RTGS-2026-009"\n}',
      expected:
        "201 Created — { data: FinanceBankTransaction }; bank account currentBalance increases by 25000.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Automated atomic balance update on parent bank account.",
      prereq: "bankAccountId",
    },
    {
      id: "BNK-006",
      module: "Treasury & Banking",
      scenario:
        "List Bank Transactions with Date Range & Reconciliation Filter",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/bank-transactions?bankAccountId={{bankAccountId}}&isReconciled=false",
      req: "(No body)",
      expected: "200 OK — Paginated { data: FinanceBankTransaction[] }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Used by bank reconciliation view.",
      prereq: "bankAccountId",
    },
    {
      id: "BNK-007",
      module: "Treasury & Banking",
      scenario: "Reconcile Bank Transaction",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/bank-transactions/{{bankTxnId}}/reconcile",
      req: '{\n  "matchedJournalEntryId": {{journalEntryId}}\n}',
      expected:
        "201 Created — { data: FinanceBankTransaction (isReconciled: true, reconciledAt) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Links bank transaction to general ledger voucher for audit compliance.",
      prereq: "bankTxnId, journalEntryId",
    },
    {
      id: "BNK-008",
      module: "Treasury & Banking",
      scenario: "Unreconcile Bank Transaction",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/bank-transactions/{{bankTxnId}}/unreconcile",
      req: "(No body)",
      expected:
        "201 Created — { data: FinanceBankTransaction (isReconciled: false, matchedJournalEntryId: null) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Allows correction of misallocated bank statements.",
      prereq: "Reconciled bankTxnId",
    },

    // Chart of Accounts (5)
    {
      id: "COA-001",
      module: "Chart of Accounts",
      scenario: "List Chart of Accounts with Type Filter",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/accounts?accountType=ASSET&page=1&limit=20",
      req: "(No body)",
      expected: "200 OK — Paginated { data: FinanceAccount[], meta }",
      actual: "Code verified in accounts.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes: "Inspects account codes, names, types, and current balance.",
      prereq: "finance.coa.read",
    },
    {
      id: "COA-002",
      module: "Chart of Accounts",
      scenario: "Get Complete Hierarchical COA Tree Structure",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/accounts/tree",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceAccountTreeNode[] } organized with nested children arrays.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Feeds AccountsView interactive tree hierarchy.",
      prereq: "finance.coa.read",
    },
    {
      id: "COA-003",
      module: "Chart of Accounts",
      scenario: "Create New Chart of Accounts Ledger Account",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/accounts",
      req: '{\n  "accountCode": "1015",\n  "accountName": "Petty Cash - Main Office",\n  "accountType": "ASSET",\n  "parentAccountId": {{parentAccountId}},\n  "currency": "INR",\n  "description": "Office petty cash register"\n}',
      expected:
        "201 Created — { data: FinanceAccount } with parentAccountId linkage.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Unique accountCode per organization enforced by database constraint.",
      prereq: "parentAccountId",
    },
    {
      id: "COA-004",
      module: "Chart of Accounts",
      scenario: "Update Chart of Accounts Entry",
      method: "PATCH",
      endpoint: "{{baseUrl}}/finance/accounts/{{accountId}}",
      req: '{\n  "accountName": "Petty Cash - Corporate HQ",\n  "description": "Updated petty cash description"\n}',
      expected:
        "200 OK — { data: FinanceAccount } with updated name and description.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Cannot change accountType if posted journal entries exist.",
      prereq: "accountId",
    },
    {
      id: "COA-005",
      module: "Chart of Accounts",
      scenario: "Soft Delete Unused Chart of Accounts Entry",
      method: "DELETE",
      endpoint: "{{baseUrl}}/finance/accounts/{{accountId}}",
      req: "(No body)",
      expected: "204 No Content. Account marked soft-deleted (deletedAt set).",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Restricted if account has sub-accounts or posted journal lines.",
      prereq: "accountId with no transactions",
    },

    // General Ledger & Journal Entries (6)
    {
      id: "GL-001",
      module: "General Ledger & Journal Entries",
      scenario: "Create Balanced Manual Journal Voucher (Draft)",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/journal-entries",
      req: '{\n  "entryDate": "2026-10-23",\n  "entryType": "MANUAL",\n  "narration": "Monthly office internet expense accrual",\n  "referenceNumber": "JV-OCT-001",\n  "lines": [\n    {"accountId": {{expenseAccountId}}, "debit": 3500.00, "credit": 0.00, "description": "Internet expense"},\n    {"accountId": {{payableAccountId}}, "debit": 0.00, "credit": 3500.00, "description": "Accounts payable accrual"}\n  ]\n}',
      expected:
        "201 Created — { data: FinanceJournalEntry (status: DRAFT, totalDebit: 3500, totalCredit: 3500) }",
      actual: "Code verified in journal-entries.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes: "Debits must equal credits within 0.01 tolerance.",
      prereq: "expenseAccountId, payableAccountId",
    },
    {
      id: "GL-002",
      module: "General Ledger & Journal Entries",
      scenario: "Get Journal Voucher Details by ID",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/journal-entries/{{journalEntryId}}",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceJournalEntry } with populated lines and account names.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Inspects voucher lines, debit/credit totals, and audit trail.",
      prereq: "journalEntryId",
    },
    {
      id: "GL-003",
      module: "General Ledger & Journal Entries",
      scenario: "List Journal Vouchers with Status & Date Range Filters",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/journal-entries?page=1&limit=10&status=DRAFT",
      req: "(No body)",
      expected: "200 OK — Paginated { data: FinanceJournalEntry[], meta }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Supports filtering by status, entryType, and date range.",
      prereq: "finance.journal.read",
    },
    {
      id: "GL-004",
      module: "General Ledger & Journal Entries",
      scenario: "Post Draft Journal Voucher to General Ledger",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/journal-entries/{{journalEntryId}}/post",
      req: "(No body)",
      expected:
        "201 Created — status=POSTED, postedAt set; atomically updates FinanceAccount currentBalance for affected accounts.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Irreversible posting; creates immutable ledger balances.",
      prereq: "journalEntryId (DRAFT)",
    },
    {
      id: "GL-005",
      module: "General Ledger & Journal Entries",
      scenario: "Reverse Posted Journal Voucher with Audit Trail",
      method: "POST",
      endpoint:
        "{{baseUrl}}/finance/journal-entries/{{journalEntryId}}/reverse",
      req: '{\n  "reversalDate": "2026-10-24",\n  "reason": "Accrual reversed in subsequent period"\n}',
      expected:
        "201 Created — Original status=REVERSED; new mirror reversal voucher created with inverted debits and credits.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Restores account balances to pre-posting values.",
      prereq: "journalEntryId (POSTED)",
    },
    {
      id: "GL-006",
      module: "General Ledger & Journal Entries",
      scenario: "Delete Draft Journal Voucher",
      method: "DELETE",
      endpoint: "{{baseUrl}}/finance/journal-entries/{{journalEntryId}}",
      req: "(No body)",
      expected: "204 No Content. Draft voucher and lines deleted via cascade.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Cannot delete POSTED or REVERSED journal vouchers.",
      prereq: "journalEntryId (DRAFT)",
    },

    // GST Registry & Returns (7)
    {
      id: "GST-001",
      module: "GST Registry & Returns",
      scenario: "Record Outward B2B GST Tax Entry",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/gst/entries",
      req: '{\n  "gstin": "29ABCDE1234F1Z5",\n  "period": "2026-10",\n  "entryType": "OUTWARD",\n  "sourceType": "SALES_INVOICE",\n  "sourceReference": "INV-202610-0012",\n  "taxableAmount": 50000.00,\n  "cgstRate": 9.00,\n  "cgstAmount": 4500.00,\n  "sgstRate": 9.00,\n  "sgstAmount": 4500.00,\n  "igstRate": 0.00,\n  "igstAmount": 0.00,\n  "hsnSacCode": "998311"\n}',
      expected:
        '201 Created — { data: FinanceGstEntry (totalTaxAmount: 9000, status: "ACTIVE") }',
      actual: "Code verified in gst.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes: "Records outward tax liability for GSTR-1 and GSTR-3B filings.",
      prereq: "finance.gst.write",
    },
    {
      id: "GST-002",
      module: "GST Registry & Returns",
      scenario: "List GST Tax Ledger Entries by Period & Type",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/gst/entries?period=2026-10&entryType=OUTWARD&page=1&limit=20",
      req: "(No body)",
      expected: "200 OK — Paginated { data: FinanceGstEntry[], meta }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Verifies tax ledger listing with period filtering.",
      prereq: "finance.gst.read",
    },
    {
      id: "GST-003",
      module: "GST Registry & Returns",
      scenario: "Get Specific GST Tax Entry Details",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/gst/entries/{{gstEntryId}}",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceGstEntry } with full tax component breakdown.",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Inspects CGST, SGST, IGST tax breakdown.",
      prereq: "gstEntryId",
    },
    {
      id: "GST-004",
      module: "GST Registry & Returns",
      scenario: "Generate HSN/SAC Summary Report",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/gst/reports/hsn-summary?period=2026-10",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceHsnSummaryReport (items: HsnSummaryItem[], totalTaxable, totalTax) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Aggregates taxable values and tax rates by HSN code.",
      prereq: "finance.gst.read",
    },
    {
      id: "GST-005",
      module: "GST Registry & Returns",
      scenario: "Generate GSTR-1 Outward Summary Report",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/gst/reports/gstr1-summary?period=2026-10",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceGstr1SummaryReport (b2b, b2c, rateBuckets, totalOutputLiability) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Verifies proforma exclusion and rate bucket aggregation.",
      prereq: "finance.gst.read",
    },
    {
      id: "GST-006",
      module: "GST Registry & Returns",
      scenario: "Generate GSTR-3B Monthly Return Summary Report",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/gst/reports/gstr3b-summary?period=2026-10",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceGstr3bSummaryReport (outwardSupplies, eligibleItc, netTaxPayable) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Computes Net Tax Payable = Outward Liability - Eligible ITC.",
      prereq: "finance.gst.read",
    },
    {
      id: "GST-007",
      module: "GST Registry & Returns",
      scenario: "Reconcile Purchase Books with GSTR-2B Data",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/gst/reconciliation",
      req: '{\n  "period": "2026-10",\n  "counterpartEntries": [\n    {"counterpartGstin": "29ABCDE1234F1Z5", "invoiceNumber": "INV-202610-0012", "invoiceDate": "2026-10-20", "taxableAmount": 50000.00, "taxAmount": 9000.00}\n  ]\n}',
      expected:
        "201 Created — { data: FinanceGstReconciliationResult (matchedCount, discrepancyCount, items[]) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Matches purchase bills against counterpart portal filing.",
      prereq: "finance.gst.write",
    },

    // Financial Reports (6)
    {
      id: "REP-001",
      module: "Financial Reports",
      scenario: "Generate Profit & Loss (P&L) Statement",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/reports/profit-and-loss?startDate=2026-10-01&endDate=2026-10-31",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceProfitAndLossReport (operatingRevenue, operatingExpenses, netProfitLoss) }",
      actual: "Code verified in reports.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes: "Aggregates all posted REVENUE and EXPENSE journal lines.",
      prereq: "finance.journal.read",
    },
    {
      id: "REP-002",
      module: "Financial Reports",
      scenario: "Generate Balance Sheet Snapshot",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/reports/balance-sheet?asOfDate=2026-10-31",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceBalanceSheetReport (assets, liabilities, equity, isBalanced: true) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Verifies fundamental accounting equality: Assets = Liabilities + Equity.",
      prereq: "finance.journal.read",
    },
    {
      id: "REP-003",
      module: "Financial Reports",
      scenario: "Generate Trial Balance Report",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/reports/trial-balance?startDate=2026-10-01&endDate=2026-10-31",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceTrialBalanceReport (accounts: TrialBalanceItem[], totalDebit, totalCredit) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Summarizes opening, debit, credit, and closing balances for all COA accounts.",
      prereq: "finance.journal.read",
    },
    {
      id: "REP-004",
      module: "Financial Reports",
      scenario: "Generate Account General Ledger Statement",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/reports/general-ledger?accountId={{accountId}}&startDate=2026-10-01&endDate=2026-10-31",
      req: "(No body)",
      expected:
        "200 OK — { data: GeneralLedgerAccountReport (account, openingBalance, transactions[], closingBalance) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Chronological transaction register with progressive running balance.",
      prereq: "accountId, finance.journal.read",
    },
    {
      id: "REP-005",
      module: "Financial Reports",
      scenario: "Generate Cash and Bank Summary Statement",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/reports/cash-bank-summary?startDate=2026-10-01&endDate=2026-10-31",
      req: "(No body)",
      expected:
        "200 OK — { data: FinanceCashBankSummaryReport (accounts[], totalLiquidAssets) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Reconciles liquid cash on hand and bank account balances.",
      prereq: "finance.journal.read",
    },
    {
      id: "REP-006",
      module: "Financial Reports",
      scenario: "Audit Financial Period Closing Status",
      method: "GET",
      endpoint:
        "{{baseUrl}}/finance/reports/period-closing-status?periodEndDate=2026-10-31",
      req: "(No body)",
      expected:
        "200 OK — { data: FinancePeriodClosingStatus (canClose: boolean, draftJournalsCount, unreconciledBankCount) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Audit checklist identifying blockers preventing month-end closing.",
      prereq: "finance.journal.read",
    },

    // Sales & Purchases Integration (5)
    {
      id: "INT-001",
      module: "Sales & Purchases Integration",
      scenario: "Post Finalized Sales Invoice to General Ledger & GST",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/integration/sales-invoices/post",
      req: '{\n  "invoiceReference": "INV-202610-0015",\n  "customerName": "Acme Industrial Corp",\n  "invoiceDate": "2026-10-23",\n  "subtotal": 100000.00,\n  "taxAmount": 18000.00,\n  "totalAmount": 118000.00,\n  "cgstAmount": 9000.00,\n  "sgstAmount": 9000.00\n}',
      expected:
        "201 Created — { data: SalesPurchasesPostingResult (journalEntryId, gstEntryId) }",
      actual: "Code verified in sales-purchases-integration.service.spec.ts",
      status: "Prepared / Pending Verification",
      notes:
        "Atomically creates balanced GL journal and outward GST liability entry.",
      prereq: "finance.journal.write",
    },
    {
      id: "INT-002",
      module: "Sales & Purchases Integration",
      scenario: "Cancel & Reverse Posted Sales Invoice",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/integration/sales-invoices/cancel",
      req: '{\n  "documentReference": "INV-202610-0015",\n  "cancellationDate": "2026-10-24",\n  "reason": "Order cancelled by customer before dispatch"\n}',
      expected: "201 Created — { data: { success: true, reversalJournalId } }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Creates mirror reversal journal and marks GST entry cancelled.",
      prereq: "finance.journal.write",
    },
    {
      id: "INT-003",
      module: "Sales & Purchases Integration",
      scenario: "Post Confirmed Purchase Bill to General Ledger & GST ITC",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/integration/purchase-bills/post",
      req: '{\n  "billReference": "BILL-202610-0089",\n  "vendorName": "National Logistics Ltd",\n  "billDate": "2026-10-23",\n  "subtotal": 60000.00,\n  "taxAmount": 10800.00,\n  "totalAmount": 70800.00,\n  "cgstAmount": 5400.00,\n  "sgstAmount": 5400.00\n}',
      expected:
        "201 Created — { data: SalesPurchasesPostingResult (journalEntryId, gstEntryId) }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Debits expense/asset + input tax credit and credits accounts payable.",
      prereq: "finance.journal.write",
    },
    {
      id: "INT-004",
      module: "Sales & Purchases Integration",
      scenario: "Cancel & Reverse Posted Purchase Bill",
      method: "POST",
      endpoint: "{{baseUrl}}/finance/integration/purchase-bills/cancel",
      req: '{\n  "documentReference": "BILL-202610-0089",\n  "cancellationDate": "2026-10-24",\n  "reason": "Goods rejected on quality inspection"\n}',
      expected: "201 Created — { data: { success: true, reversalJournalId } }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes: "Reverses AP journal entry and cancels input tax credit entry.",
      prereq: "finance.journal.write",
    },
    {
      id: "INT-005",
      module: "Sales & Purchases Integration",
      scenario: "Retrieve Accounting & GST Integration Status",
      method: "GET",
      endpoint: "{{baseUrl}}/finance/integration/status/INV-202610-0015",
      req: "(No body)",
      expected:
        "200 OK — { data: { reference, isJournalPosted: true, journalEntryId, isGstRecorded: true, gstEntryId } }",
      actual: "Code verified",
      status: "Prepared / Pending Verification",
      notes:
        "Enables Sales/SCM modules to query finance posting status in real-time.",
      prereq: "finance.journal.read",
    },
  ];

  // Combine all tests in order:
  // Payments Received (19), Expenses (10), Pending Checks (15), Payments Made (7), Banking (8), COA (5), GL (6), GST (7), Reports (6), Integration (5)
  // Total = 19 + 10 + 15 + 7 + 8 + 5 + 6 + 7 + 6 + 5 = 88 tests!
  const allTests = [...prTests, ...expTests, ...chkTests, ...newTests];

  let testRIdx = 5;
  allTests.forEach((t, i) => {
    const row = wsTest.getRow(testRIdx);
    row.height = 24;
    const values = [
      t.id,
      t.module,
      t.scenario,
      t.method,
      t.endpoint,
      t.req,
      t.expected,
      t.actual,
      t.status,
      t.notes,
      t.prereq,
    ];
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 0 || c === 3 || c === 8 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 3) {
        const mColors = {
          GET: { fg: "FF0369A1", bg: "FFE0F2FE" },
          POST: { fg: "FF166534", bg: "FFDCFCE7" },
          PATCH: { fg: "FFB45309", bg: "FFFEF3C7" },
          DELETE: { fg: "FF991B1B", bg: "FFFEE2E2" },
        };
        const mc = mColors[v] || { fg: "FF1E293B", bg: "FFF1F5F9" };
        cell.font = {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: mc.fg },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: mc.bg },
        };
      }
      if (c === 8 && statusStyles[v]) {
        cell.fill = statusStyles[v].fill;
        cell.font = statusStyles[v].font;
      }
    });
    testRIdx++;
  });

  wsTest.autoFilter = { from: "A4", to: `K${testRIdx - 1}` };

  // ==========================================
  // SHEET 5: Glossary & Notes
  // ==========================================
  console.log("Generating Sheet 5: Glossary & Notes...");
  const wsGloss = wb.addWorksheet("Glossary & Notes", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  wsGloss.columns = [
    { header: "Category", key: "category", width: 22 },
    { header: "Term / Standard", key: "term", width: 28 },
    {
      header: "Official Engineering Definition & TexaWave Context",
      key: "definition",
      width: 56,
    },
    {
      header: "Implementation Architecture & Verification Rules",
      key: "rules",
      width: 52,
    },
    { header: "Reference / Source", key: "ref", width: 42 },
  ];

  wsGloss.mergeCells("A1:E1");
  const gTitle = wsGloss.getCell("A1");
  gTitle.value =
    "TexaWave ERP — Engineering Glossary & Architectural Standards";
  gTitle.font = titleFont;
  gTitle.fill = titleFill;
  gTitle.alignment = { vertical: "middle", indent: 1 };
  wsGloss.getRow(1).height = 36;

  wsGloss.mergeCells("A2:E2");
  const gSub = wsGloss.getCell("A2");
  gSub.value =
    "Technical Standards, Architectural Invariants, Domain Rules, and Documentation Notes";
  gSub.font = subTitleFont;
  gSub.fill = titleFill;
  gSub.alignment = { vertical: "middle", indent: 1 };
  wsGloss.getRow(2).height = 20;

  wsGloss.getRow(3).height = 8;

  const gHRow = wsGloss.getRow(4);
  const gHeaders = [
    "Category",
    "Term / Standard",
    "Official Engineering Definition & TexaWave Context",
    "Implementation Architecture & Verification Rules",
    "Reference / Source",
  ];
  gHeaders.forEach((h, i) => {
    const cell = gHRow.getCell(i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  gHRow.height = 28;

  const glossaryEntries = [
    {
      cat: "Architecture & Framework",
      term: "API (Application Programming Interface)",
      def: "Standard HTTP REST interface implemented with NestJS controllers, providing structured JSON contracts for web and mobile clients.",
      rules:
        "All routes enforce JWT authentication, organization tenancy scoping, and RBAC permission guards. Responses wrap payloads in { data, meta } structures.",
      ref: "Docs/ARCHITECTURE.md §2; apps/api/src/modules/finance/",
    },
    {
      cat: "Architecture & Framework",
      term: "DTO (Data Transfer Object)",
      def: "Strongly-typed TypeScript class defining incoming request bodies and query parameters, validated at runtime using class-validator and class-transformer.",
      rules:
        "Enforces strict data types, numeric ranges, non-empty strings, and custom date bounds (e.g., rejecting future expense/payment dates with 422).",
      ref: "apps/api/src/modules/finance/**/dto/",
    },
    {
      cat: "Architecture & Framework",
      term: "Prisma Model & Multi-Schema",
      def: "Declarative database object relational mapping (ORM) definition defining PostgreSQL tables, column types, foreign keys, and indexes.",
      rules:
        'TexaWave utilizes PostgreSQL multi-schema architecture (platform, hr, crm, scm, finance). All finance tables reside in @@schema("finance").',
      ref: "packages/database/prisma/schema.prisma",
    },
    {
      cat: "Architecture & Framework",
      term: "Zod Schema",
      def: "TypeScript-first schema declaration and validation library utilized across Next.js frontend forms to validate user inputs before dispatching API requests.",
      rules:
        "Validates input lengths, positive currency amounts, regex formats (Indian IFSC, GSTIN, PAN), and date rules. Aligns with backend DTOs.",
      ref: "apps/ui/src/features/finance/**/schema.ts",
    },
    {
      cat: "Security & Multi-Tenancy",
      term: "Organization Tenancy Scoping",
      def: "Multi-tenant isolation model guaranteeing that every query and mutation is strictly partitioned by the caller's organizationId.",
      rules:
        'Every finance table contains organizationId Int @map("organization_id"). Repositories automatically enforce WHERE organizationId = req.user.organizationId.',
      ref: "packages/database/prisma/permissions/catalog.ts",
    },
    {
      cat: "Database & Audit",
      term: "Soft Delete Pattern",
      def: "Data retention strategy where deletion sets a deletedAt Timestamptz timestamp instead of physically executing a SQL DELETE command.",
      rules:
        "Preserves historical audit trail. Soft-deleted rows are filtered out by default queries (WHERE deletedAt IS NULL). Applied to accounts, bank_accounts, expenses, payments.",
      ref: "packages/database/prisma/schema.prisma",
    },
    {
      cat: "Financial Accounting",
      term: "Double-Entry Bookkeeping",
      def: "Fundamental accounting system where every transaction requires at least two posting legs such that Total Debits strictly equals Total Credits.",
      rules:
        "Debits increase Assets and Expenses, while decreasing Liabilities, Equity, and Revenue. Credits behave in exact mirror reverse. Unbalanced vouchers rejected with 422.",
      ref: "apps/api/src/modules/finance/journal/journal-entries.service.ts",
    },
    {
      cat: "Financial Accounting",
      term: "Journal Voucher Reversal",
      def: "Immutable accounting correction pattern where posted vouchers are never modified or deleted; an equal and opposite reversing voucher is generated.",
      rules:
        'Original voucher marked status="REVERSED" with reversedEntryId pointing to the reversal voucher. Preserves complete chronological audit trail.',
      ref: "apps/api/src/modules/finance/journal/journal-entries.service.ts §reverse",
    },
    {
      cat: "Taxation & Compliance",
      term: "Goods and Services Tax (GST)",
      def: "Comprehensive multi-stage Indian consumption tax categorized into Central GST (CGST), State GST (SGST), and Integrated GST (IGST).",
      rules:
        "Intrastate sales split tax equally between CGST and SGST (e.g. 9% + 9% = 18%). Interstate sales apply full tax to IGST (18%). Validated via 15-character GSTIN regex.",
      ref: "apps/api/src/modules/finance/gst/gst.types.ts",
    },
    {
      cat: "Taxation & Compliance",
      term: "Input Tax Credit (ITC)",
      def: "Tax credit claimed by businesses on purchase of goods and services used in course of business, offset against outward tax liability in GSTR-3B.",
      rules:
        "Inward supplies recorded as INWARD entries. Reconciled against counterpart GSTR-2B filing data using auto-matching with 1 INR tolerance.",
      ref: "apps/api/src/modules/finance/gst/gst.service.ts §reconcile",
    },
    {
      cat: "Architecture Dependency",
      term: "SalesInvoice Dependency Blocker",
      def: "Architecture note regarding the absence of a dedicated SalesInvoice database table in the current prisma schema.",
      rules:
        "FinancePaymentReceivedAllocation deliberately uses invoiceReference: String to enable immediate multi-invoice tracking without hard schema lock.",
      ref: "Docs/POSTMAN_FINANCE_EXPENSES_PAYMENTS.md §2",
    },
    {
      cat: "Testing Standards",
      term: "Disposable E2E Test DB Rule",
      def: "Strict repository engineering guard prohibiting test suites from executing destructive mutations against the main development database.",
      rules:
        "E2E tests must execute exclusively against isolated disposable containers (e.g. texawave_erp_test) and a dedicated Redis instance.",
      ref: "Docs/ARCHITECTURE.md; scripts/e2e-guard",
    },
  ];

  let gRIdx = 5;
  glossaryEntries.forEach((g, i) => {
    const row = wsGloss.getRow(gRIdx);
    row.height = 28;
    const values = [g.cat, g.term, g.def, g.rules, g.ref];
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 0 ? "center" : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 1) cell.font = boldCellFont;
    });
    gRIdx++;
  });

  wsGloss.autoFilter = { from: "A4", to: `E${gRIdx - 1}` };

  // ==========================================
  // SAVE WORKBOOK TO TARGET LOCATION
  // ==========================================
  const outputPath = path.resolve(
    "Docs/TexaWave_Finance_Module_Reference.xlsx",
  );
  console.log("Writing final consolidated workbook to:", outputPath);
  await wb.xlsx.writeFile(outputPath);
  console.log(
    "Workbook successfully written! File size:",
    fs.statSync(outputPath).size,
    "bytes",
  );

  return {
    outputPath,
    sheetNames: wb.worksheets.map((w) => w.name),
    endpointsCount: endpointDetails.length,
    preservedTestsCount: prTests.length + expTests.length + chkTests.length,
    newTestsCount: newTests.length,
    totalTestsCount: allTests.length,
    unresolvedCount: unresolvedItems.length,
  };
}

generateCompleteFinanceWorkbook()
  .then((summary) => {
    console.log("\n=== WORKBOOK GENERATION SUMMARY ===");
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error("Error generating workbook:", err);
    process.exit(1);
  });
