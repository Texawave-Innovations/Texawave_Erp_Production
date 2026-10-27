const fs = require("fs");
const path = require("path");
const ExcelJS = require("./apps/ui/node_modules/exceljs");

async function buildWorkbook() {
  console.log("Starting workbook build...");
  const wb = new ExcelJS.Workbook();
  wb.creator = "TexaWave ERP Core Engineering";
  wb.lastModifiedBy = "TexaWave ERP Core Engineering";
  wb.created = new Date("2026-10-26T12:00:00Z");
  wb.modified = new Date();

  // Load extracted data
  const endpoints = JSON.parse(
    fs.readFileSync("scratch/all_parsed_endpoints.json", "utf8"),
  );
  const origWbData = JSON.parse(
    fs.readFileSync("scratch/finance_models_extracted.json", "utf8"),
  );
  const dtos = JSON.parse(
    fs.readFileSync("scratch/extracted_dtos.json", "utf8"),
  );

  // Fonts & styles
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

  const statusFills = {
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
    Prepared: {
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
        fgColor: { argb: "FFE0F2FE" },
      },
      font: {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: "FF0369A1" },
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

  // Helper to format table headers
  function applyHeaderRow(row, colCount) {
    row.height = 28;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = thinBorder;
    }
  }

  // ==========================================
  // SHEET 1: Dashboard
  // ==========================================
  console.log("Building Sheet 1: Dashboard...");
  const wsDash = wb.addWorksheet("Dashboard", {
    views: [{ showGridLines: true }],
  });
  wsDash.columns = [
    { width: 3 }, // A margin
    { width: 28 }, // B
    { width: 18 }, // C
    { width: 18 }, // D
    { width: 18 }, // E
    { width: 22 }, // F
    { width: 35 }, // G
    { width: 3 }, // H margin
  ];

  // Title Block
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
    "Repository Source of Truth Audit & Consolidated Test Tracker | Feature Branch: feature/finance | As of 26-Oct-2026";
  dSub.font = subTitleFont;
  dSub.fill = titleFill;
  dSub.alignment = { vertical: "middle", indent: 1 };
  wsDash.getRow(3).height = 20;

  // KPI Cards Block (Row 5 & 6)
  const kpis = [
    {
      colStart: "B",
      colEnd: "B",
      title: "Documented Endpoints",
      val: 74,
      note: "10 Finance Modules",
    },
    {
      colStart: "C",
      colEnd: "C",
      title: "Database Models",
      val: 11,
      note: "finance schema in PG",
    },
    {
      colStart: "D",
      colEnd: "D",
      title: "Total Test Cases",
      val: 88,
      note: "44 Original + 44 New",
    },
    {
      colStart: "E",
      colEnd: "E",
      title: "Completed / Pass",
      val: 31,
      note: "30 PR/EXP + 1 CHK",
    },
    {
      colStart: "F",
      colEnd: "F",
      title: "Pending Execution",
      val: 57,
      note: "14 CHK + 43 New Tests",
    },
    {
      colStart: "G",
      colEnd: "G",
      title: "Unresolved Verification Items",
      val: 8,
      note: "Dependencies & Risks",
    },
  ];

  kpis.forEach((k) => {
    const topCell = wsDash.getCell(`${k.colStart}5`);
    const valCell = wsDash.getCell(`${k.colStart}6`);
    const noteCell = wsDash.getCell(`${k.colStart}7`);

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

  // Section 1: Module Coverage Breakdown (Row 9)
  wsDash.mergeCells("B9:G9");
  const sec1 = wsDash.getCell("B9");
  sec1.value = "Finance Sub-Module Implementation Coverage";
  sec1.font = boldCellFont;
  sec1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  sec1.alignment = { vertical: "middle", indent: 1 };
  wsDash.getRow(9).height = 24;

  const modHeaders = [
    "Module Name",
    "API Endpoints",
    "Prisma Models",
    "Postman Tests",
    "Implementation Status",
    "Key Notes / Dependencies",
  ];
  const row10 = wsDash.getRow(10);
  modHeaders.forEach((h, idx) => {
    const cell = row10.getCell(idx + 2);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = {
      horizontal: idx === 0 || idx === 5 ? "left" : "center",
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
      "Draft, Approval, Payment disbursement, GL posting & claims conversion",
    ],
    [
      "Payments Received",
      9,
      "FinancePaymentReceived, Allocation",
      20,
      "Production Ready",
      "Multi-invoice allocation, Confirm/GL posting, Void & reversal",
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
      "Multi-bank accounts, GL linkage, bank feed transaction & reconciliation",
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
      "N/A (Journal line aggregations)",
      6,
      "Production Ready",
      "P&L, Balance Sheet, Trial Balance, Cash/Bank Summary, Closing Status",
    ],
    [
      "Sales & Purchases Integration",
      5,
      "N/A (Service-level integration)",
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
      "Expense types, payment modes, financial year configuration",
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
        horizontal: cIdx === 0 || cIdx === 5 ? "left" : "center",
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

  // Section 2: Unresolved Verification Items & Architecture Dependencies (Row rIdx + 1)
  rIdx++;
  wsDash.mergeCells(`B${rIdx}:G${rIdx}`);
  const sec2 = wsDash.getCell(`B${rIdx}`);
  sec2.value =
    "Key Architecture Dependencies & Unresolved Verification Backlog";
  sec2.font = boldCellFont;
  sec2.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
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

  console.log("Sheet 1 built successfully.");

  // Write file out to test
  await wb.xlsx.writeFile("scratch/test_dash.xlsx");
  console.log("Draft saved.");
}

buildWorkbook().catch((err) => {
  console.error("Build error:", err);
  process.exit(1);
});
