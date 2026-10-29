const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("PASS:", message);
}

const root = path.resolve(__dirname, "..");

// 1. HorizontalNavbar.tsx
const navbarPath = path.join(
  root,
  "apps/ui/src/components/layout/HorizontalNavbar.tsx",
);
const navbarContent = fs.readFileSync(navbarPath, "utf-8");
assert(
  navbarContent.includes(
    'path: "/finance/general-ledger",\n    available: true,\n    categories: FINANCE_CATEGORIES',
  ),
  "HorizontalNavbar ERP_MODULES routes finance to /finance/general-ledger",
);
assert(
  navbarContent.includes(
    'id: "general-ledger-view",\n        label: "General Ledger",\n        path: "/finance/general-ledger"',
  ),
  "HorizontalNavbar FINANCE_CATEGORIES places General Ledger as first child",
);

// 2. FinanceShell.tsx
const shellPath = path.join(
  root,
  "apps/ui/src/features/finance/shared/components/FinanceShell.tsx",
);
const shellContent = fs.readFileSync(shellPath, "utf-8");
assert(
  shellContent.includes(
    'id: "accounting",\n    label: "Accounting",\n    icon: BookOpen,\n    path: "/finance/general-ledger",',
  ),
  "FinanceShell PRIMARY_TABS routes accounting to /finance/general-ledger",
);
assert(
  shellContent.includes(
    'accounting: [\n    {\n      id: "general-ledger",\n      label: "General Ledger",\n      icon: BookOpen,\n      path: "/finance/general-ledger"',
  ),
  "FinanceShell SUB_TABS_MAP has general-ledger as first accounting sub-tab",
);

// 3. finance root page redirect
const financeRootPath = path.join(
  root,
  "apps/ui/src/app/(dashboard)/finance/page.tsx",
);
const financeRootContent = fs.readFileSync(financeRootPath, "utf-8");
assert(
  financeRootContent.includes('redirect("/finance/general-ledger")'),
  "Finance root page redirects to /finance/general-ledger",
);

// 4. finance accounting page redirect
const financeAccountingPath = path.join(
  root,
  "apps/ui/src/app/(dashboard)/finance/accounting/page.tsx",
);
const financeAccountingContent = fs.readFileSync(
  financeAccountingPath,
  "utf-8",
);
assert(
  financeAccountingContent.includes('redirect("/finance/general-ledger")'),
  "Finance accounting page redirects to /finance/general-ledger",
);

// 5. ReportsView.tsx redundancy check
const reportsPath = path.join(
  root,
  "apps/ui/src/features/finance/reports/components/ReportsView.tsx",
);
const reportsContent = fs.readFileSync(reportsPath, "utf-8");
assert(
  !reportsContent.includes('"general-ledger"'),
  "ReportsView does NOT contain redundant general-ledger tab in REPORT_TABS",
);
assert(
  !reportsContent.includes("GeneralLedgerView"),
  "ReportsView does NOT import or render GeneralLedgerView",
);

console.log("\nAll navigation wiring checks passed successfully!");
