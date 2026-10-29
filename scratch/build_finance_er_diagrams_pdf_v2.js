const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

function loadAndCleanSvg(filePath, maxHeight = "460px") {
  let svg = fs.readFileSync(filePath, "utf8");
  // Remove fixed style max-width
  svg = svg.replace(
    /style="[^"]*"/,
    `style="width: 100%; max-height: ${maxHeight}; height: auto; display: block; margin: 0 auto;"`,
  );
  // Ensure font-family uses Nunito Sans
  svg = svg.replace(
    /font-family:[^;]+;/g,
    "font-family: 'Nunito Sans', sans-serif;",
  );
  return svg;
}

async function buildPdf() {
  console.log(
    "Compiling Finance ER Diagrams PDF with high-resolution visual diagrams...",
  );

  const er1Svg = loadAndCleanSvg("scratch/ER1.svg", "460px");
  const er2Svg = loadAndCleanSvg("scratch/ER2.svg", "440px");
  const er3Svg = loadAndCleanSvg("scratch/ER3.svg", "440px");
  const er4Svg = loadAndCleanSvg("scratch/ER4.svg", "440px");
  const er5Svg = loadAndCleanSvg("scratch/ER5.svg", "440px");
  const er6Svg = loadAndCleanSvg("scratch/ER6.svg", "440px");
  const er7Svg = loadAndCleanSvg("scratch/ER7.svg", "440px");
  const er8Svg = loadAndCleanSvg("scratch/ER8.svg", "440px");
  const er9Svg = loadAndCleanSvg("scratch/ER9.svg", "460px");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TexaWave ERP — Finance Module Entity-Relationship Diagrams</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,300..900;1,6..12,300..900&display=swap');

    @page {
      size: A4 landscape;
      margin: 10mm 12mm 10mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 8pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-break {
      page-break-before: always;
    }

    /* Cover Page */
    .cover-container {
      height: 94vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px 25px;
    }

    .cover-header {
      border-bottom: 3px solid #0A3271;
      padding-bottom: 16px;
    }

    .brand-tag {
      font-size: 10.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #0284C7;
      margin-bottom: 6px;
    }

    .cover-title {
      font-size: 24pt;
      font-weight: 900;
      color: #0A3271;
      line-height: 1.15;
      margin-bottom: 6px;
    }

    .cover-subtitle {
      font-size: 11pt;
      color: #475569;
      line-height: 1.4;
      max-width: 850px;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-primary { background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD; }
    .badge-success { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
    .badge-warning { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
    .badge-neutral { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }

    .cover-meta-grid {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 5px solid #1769F5;
      padding: 16px 20px;
      border-radius: 6px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .meta-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748B;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .meta-value {
      font-size: 9pt;
      font-weight: 800;
      color: #0F172A;
    }

    .cover-footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 12px;
      font-size: 7.5pt;
      color: #64748B;
      display: flex;
      justify-content: space-between;
    }

    /* Headings */
    h1 {
      font-size: 13pt;
      font-weight: 900;
      color: #0A3271;
      border-bottom: 2px solid #0284C7;
      padding-bottom: 3px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    h2 {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0A3271;
      margin-top: 6px;
      margin-bottom: 3px;
    }

    p {
      margin-bottom: 5px;
      color: #334155;
    }

    /* Diagram Card Container */
    .diagram-card {
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      border-radius: 6px;
      padding: 8px;
      margin: 6px 0 8px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      background-image: radial-gradient(#E2E8F0 0.75px, transparent 0.75px);
      background-size: 12px 12px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 7.2pt;
    }

    th {
      background: #F1F5F9;
      color: #0A3271;
      font-weight: 800;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #CBD5E1;
      text-transform: uppercase;
      font-size: 6.5pt;
      letter-spacing: 0.5px;
    }

    td {
      padding: 3.5px 6px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
      color: #1E293B;
    }

    tr:nth-child(even) td {
      background: #F8FAFC;
    }

    .font-bold { font-weight: 800; }

    /* Layout Grids */
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .grid-3col {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .relation-flow {
      background: #F8FAFC;
      border: 1px solid #BAE6FD;
      border-left: 3.5px solid #0284C7;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 7.2pt;
      line-height: 1.35;
    }

    .relation-flow-title {
      font-weight: 800;
      color: #0A3271;
      margin-bottom: 3px;
      text-transform: uppercase;
      font-size: 6.8pt;
      letter-spacing: 0.5px;
    }

    .callout-box {
      background: #F0F9FF;
      border: 1px solid #BAE6FD;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 8px;
      font-size: 7.2pt;
    }

    .callout-box-warning {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-left: 3.5px solid #F59E0B;
    }

    .callout-title {
      font-weight: 800;
      font-size: 7.2pt;
      color: #0A3271;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>

  <!-- ==================== PAGE 1: COVER PAGE ==================== -->
  <div class="cover-container">
    <div class="cover-header">
      <div class="brand-tag">TexaWave ERP &bull; Core Architecture Documentation</div>
      <div class="cover-title">Finance Module Database Architecture & ER Specification</div>
      <div class="cover-subtitle">
        Visual Entity-Relationship diagrams, foreign key constraint matrix, multi-tenant isolation audit, and cross-schema integration specifications verified against PostgreSQL migrations and Prisma schema.
      </div>
      <div class="badge-row">
        <span class="badge badge-primary">11 Finance Models</span>
        <span class="badge badge-primary">192 Scalar Columns</span>
        <span class="badge badge-primary">32 Foreign Key Constraints</span>
        <span class="badge badge-success">13 Unique Constraints</span>
        <span class="badge badge-success">20 Secondary Indexes</span>
        <span class="badge badge-warning">Schema-Derived & Migration-Verified</span>
      </div>
    </div>

    <div class="cover-meta-grid">
      <div>
        <div class="meta-label">Document ID</div>
        <div class="meta-value">TEXA-FIN-ERD-2026-10-27</div>
      </div>
      <div>
        <div class="meta-label">Active Git Branch</div>
        <div class="meta-value">feature/finance</div>
      </div>
      <div>
        <div class="meta-label">Primary Source of Truth</div>
        <div class="meta-value">schema.prisma & Migrations</div>
      </div>
      <div>
        <div class="meta-label">PostgreSQL Schema</div>
        <div class="meta-value">@@schema("finance")</div>
      </div>
      <div>
        <div class="meta-label">Publication Date</div>
        <div class="meta-value">27 October 2026</div>
      </div>
      <div>
        <div class="meta-label">Verification Level</div>
        <div class="meta-value">100% Migration DDL Parity</div>
      </div>
      <div>
        <div class="meta-label">Compliance Mandates</div>
        <div class="meta-value">GAAP Double-Entry &bull; Indian GST</div>
      </div>
      <div>
        <div class="meta-label">Tenancy Architecture</div>
        <div class="meta-value">Multi-Tenant (org_id RESTRICT)</div>
      </div>
    </div>

    <div class="cover-footer">
      <div>Confidential &bull; TexaWave Enterprise Solutions Private Limited &bull; All Rights Reserved</div>
      <div>Authoritative Technical Reference &bull; AGENTS.md Brand Invariant Compliant</div>
    </div>
  </div>

  <!-- ==================== PAGE 2: EXECUTIVE OVERVIEW & NOTATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>1. Executive Overview & Notation Guide</span>
    <span class="badge badge-primary">Crow's Foot Reference</span>
  </h1>
  <p>
    Every entity, attribute, foreign key constraint, cardinality indicator, and cascade action in this specification reflects the <b>ACTUAL, CURRENT</b> database architecture verified directly against <code>packages/database/prisma/schema.prisma</code> and the PostgreSQL migrations.
  </p>

  <div class="grid-2col" style="margin-bottom: 8px;">
    <div class="relation-flow">
      <div class="relation-flow-title">Inviolable Architectural Rules</div>
      &bull; <b>Multi-Tenant Isolation:</b> All 11 tables strictly reside in <code>"finance"</code>. Every table has an <code>organization_id</code> foreign key referencing <code>platform.organizations(id)</code> with <code>ON DELETE RESTRICT ON UPDATE CASCADE</code>.<br>
      &bull; <b>Immutable Ledger Core:</b> The GL engine (<code>journal_entries</code> and <code>journal_lines</code>) represents the single source of truth. Operational vouchers link via 1:1 foreign keys.<br>
      &bull; <b>Double-Entry Invariant:</b> At all times for posted vouchers: $\sum \text{debit\\_amount} = \sum \text{credit\\_amount}$.<br>
      &bull; <b>Dynamic Reporting:</b> Statements are runtime aggregations in <code>FinancialReportsService</code>; no stale reporting tables.
    </div>

    <div class="relation-flow">
      <div class="relation-flow-title">Crow's Foot Cardinality Notation</div>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Symbol</th>
            <th style="width: 30%;">Cardinality</th>
            <th style="width: 45%;">Semantics</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">|| --- ||</td>
            <td>1 : 1 (Mandatory)</td>
            <td>Parent requires child, unique key on FK</td>
          </tr>
          <tr>
            <td class="font-bold">|| --- o|</td>
            <td>1 : 0..1 (Optional)</td>
            <td>Zero or one child (e.g. reversal entry)</td>
          </tr>
          <tr>
            <td class="font-bold">|| --- |{</td>
            <td>1 : 1..* (Mandatory Many)</td>
            <td>Parent must have &ge;1 lines (JE $\to$ Lines)</td>
          </tr>
          <tr>
            <td class="font-bold">|| --- o{</td>
            <td>1 : 0..* (Optional Many)</td>
            <td>Parent has zero or many children</td>
          </tr>
          <tr>
            <td class="font-bold">|| .. o|</td>
            <td>Logical Reference</td>
            <td>Application-level link, no hard DB constraint</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>Foreign Key Deletion Rules & Constraint Keys</h2>
  <div class="grid-3col">
    <div class="relation-flow">
      <div class="relation-flow-title"><span class="badge badge-warning">ON DELETE RESTRICT</span></div>
      Prevents accidental deletion of parent records (applied on <code>organization_id</code> and <code>account_id</code>).
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title"><span class="badge badge-primary">ON DELETE CASCADE</span></div>
      Automatically cleans up child lines when parent is deleted (applied on <code>journal_lines</code> and <code>bank_transactions</code>).
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title"><span class="badge badge-neutral">ON DELETE SET NULL</span></div>
      Safely unlinks optional parent references without losing child voucher (applied on CRM customer, bank account, and SCM payment).
    </div>
  </div>

  <!-- ==================== PAGE 3: ER 1 - OVERVIEW ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>2. ER 1 — Finance Module Comprehensive Overview</span>
    <span class="badge badge-primary">Complete Subsystem Ecosystem</span>
  </h1>
  <p>
    High-level entity relationship map illustrating all 11 core Finance tables and cross-schema connections to Platform, CRM, SCM, and HR.
  </p>

  <div class="diagram-card">
    ${er1Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Architectural Subsystem Hub</div>
      &bull; <b>Chart of Accounts (<code>accounts</code>):</b> Central 5-type ledger catalog.<br>
      &bull; <b>General Ledger (<code>journal_entries</code> & <code>journal_lines</code>):</b> Transactional backbone. All operational modules write 1:1 posted vouchers.<br>
      &bull; <b>Multi-Tenant Anchor:</b> <code>platform.organizations</code> enforces tenant boundaries across all 11 entities with <code>RESTRICT</code>.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Cross-Schema Integration Points</div>
      &bull; <code>crm.accounts</code>: Linked to customer receipts (<code>payments_received.customer_id</code>).<br>
      &bull; <code>scm.supplier_payments</code>: 1:1 linked to vendor disbursements (<code>payments_made.scm_supplier_payment_id</code>).<br>
      &bull; <code>hr.expense_claims</code>: 1:1 unique logical link to employee claims (<code>expenses.hr_expense_claim_id</code>).
    </div>
  </div>

  <!-- ==================== PAGE 4: ER 2 - CHART OF ACCOUNTS & GL ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>3. ER 2 — Chart of Accounts & General Ledger</span>
    <span class="badge badge-primary">Double-Entry Foundation</span>
  </h1>
  <p>
    Core double-entry accounting engine: hierarchical Chart of Accounts (COA), journal transaction vouchers, and balanced debit/credit lines.
  </p>

  <div class="diagram-card">
    ${er2Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Account Hierarchy & Invariants</div>
      &bull; <b>Hierarchical Tree:</b> <code>parent_account_id</code> self-reference enables sub-accounts of arbitrary depth.<br>
      &bull; <b>Double-Entry Balance:</b> All posted entries assert $\sum \text{debits} = \sum \text{credits}$.<br>
      &bull; <b>Audit Trail:</b> Posted entries are immutable. Reversals create symmetric entries via <code>reversed_entry_id</code>.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Cascade & Integrity Actions</div>
      &bull; <code>journal_lines.journal_entry_id</code>: <code>ON DELETE CASCADE</code> cleans up lines if draft entry is removed.<br>
      &bull; <code>journal_lines.account_id</code>: <code>ON DELETE RESTRICT</code> prevents dropping active accounts with transaction history.<br>
      &bull; <code>accounts.parent_account_id</code>: <code>ON DELETE SET NULL</code> safely unlinks parent without losing sub-accounts.
    </div>
  </div>

  <!-- ==================== PAGE 5: ER 3 - BANKING & RECONCILIATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>4. ER 3 — Banking & Treasury Reconciliation</span>
    <span class="badge badge-primary">Liquid Treasury Management</span>
  </h1>
  <p>
    Company bank account administration, statement transaction feeds, and automated/manual reconciliation against posted General Ledger vouchers.
  </p>

  <div class="diagram-card">
    ${er3Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Reconciliation Lifecycle & Invariants</div>
      &bull; <b>Dual Balance Architecture:</b> Tracks physical <code>current_balance</code> and links to Asset GL account (<code>gl_account_id</code>).<br>
      &bull; <b>1:1 Matching:</b> Statement feeds match posted GL entries via <code>matched_journal_entry_id</code>, setting <code>is_reconciled = true</code>.<br>
      &bull; <b>Indian IFSC Validation:</b> Validates official RBI IFSC regex format on account creation.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Cascade & Integrity Actions</div>
      &bull; <code>bank_transactions.bank_account_id</code>: <code>ON DELETE CASCADE</code> removes statement lines if bank account is dropped.<br>
      &bull; <code>bank_transactions.matched_journal_entry_id</code>: <code>ON DELETE SET NULL</code> disconnects GL match safely.<br>
      &bull; <code>bank_accounts.gl_account_id</code>: <code>ON DELETE SET NULL</code> preserves bank account if GL account is re-organized.
    </div>
  </div>

  <!-- ==================== PAGE 6: ER 4 - CUSTOMER PAYMENTS RECEIVED ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>5. ER 4 — Customer Payments Received (AR)</span>
    <span class="badge badge-primary">Accounts Receivable Inflow</span>
  </h1>
  <p>
    Customer receipt vouchers, multi-invoice breakdown allocations, CRM customer mapping, and unallocated advance funds tracking.
  </p>

  <div class="diagram-card">
    ${er4Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Receipt Workflow & Advances</div>
      &bull; <b>Workflow Progression:</b> <code>DRAFT</code> $\to$ <code>CONFIRMED</code> $\to$ <code>CANCELLED</code>.<br>
      &bull; <b>Advance Credit:</b> Unallocated receipt amounts are retained in <code>unallocated_amount</code> under Customer Advances.<br>
      &bull; <b>Line Allocations:</b> Allocates payments across multiple sales invoice references (<code>invoice_reference</code>).
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Automated GL Posting & SCM Link</div>
      &bull; <b>Posting Symmetry:</b> Confirming receipt generates 1:1 Journal Entry: DR Bank Account (1100), CR Accounts Receivable (1200).<br>
      &bull; <code>customer_id</code>: References <code>crm.accounts</code> with <code>ON DELETE SET NULL</code>, preserving historical receipt identity.<br>
      &bull; <code>payment_received_allocations</code>: <code>ON DELETE CASCADE</code> cleanly removes allocation lines if draft receipt is deleted.
    </div>
  </div>

  <!-- ==================== PAGE 7: ER 5 - PAYMENTS MADE ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>6. ER 5 — Payments Made & SCM Integration (AP)</span>
    <span class="badge badge-primary">Accounts Payable Outflow</span>
  </h1>
  <p>
    Vendor disbursements, bank account deductions, automated General Ledger postings, and direct 1:1 foreign key linkage to SCM supplier payments.
  </p>

  <div class="diagram-card">
    ${er5Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Procure-to-Pay Integration</div>
      &bull; <b>1:1 SCM Pairing:</b> <code>scm_supplier_payment_id</code> has an explicit unique key constraint preventing duplicate disbursement vouchers.<br>
      &bull; <b>SCM Cascade:</b> Links backward to <code>scm.supplier_bills</code> and <code>scm.suppliers</code>.<br>
      &bull; <b>Disbursement Immutability:</b> Confirmed payments cannot be modified; cancellation posts a reversal voucher.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Treasury Impact & Posting Symmetry</div>
      &bull; <b>Bank Balance Deduction:</b> Confirmation decrements <code>current_balance</code> atomically on target bank account.<br>
      &bull; <b>GL Voucher:</b> Generates 1:1 Journal Entry: DR Accounts Payable (2000), CR Bank Account (1100).<br>
      &bull; <code>bank_account_id</code> & <code>scm_supplier_payment_id</code>: <code>ON DELETE SET NULL</code> preserves financial voucher.
    </div>
  </div>

  <!-- ==================== PAGE 8: ER 6 - EXPENSES & HR INTEGRATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>7. ER 6 — Expenses & HR Integration (with Verified GST & ITC)</span>
    <span class="badge badge-success">Migration 20261026160000 Verified</span>
  </h1>
  <p>
    Operational expense management, employee claim conversion, and the 11 statutory GST and Input Tax Credit columns added in migration 20261026160000.
  </p>

  <div class="diagram-card">
    ${er6Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Statutory GST & ITC Fields (Migration 20261026160000)</div>
      &bull; <b>11 Statutory Columns:</b> <code>vendor_gstin</code> (15-char), <code>invoice_number</code>, <code>invoice_date</code>, <code>hsn_sac_code</code>, <code>taxable_amount</code>, <code>gst_rate</code>, <code>cgst_amount</code>, <code>sgst_amount</code>, <code>igst_amount</code>, <code>itc_eligibility</code>, <code>itc_claim_status</code>.<br>
      &bull; <b>Index:</b> Composite index on <code>(organization_id, vendor_gstin)</code> for rapid supplier matching.<br>
      &bull; <b>Eligible vs Ineligible:</b> Eligible ITC debits Asset 1300; ineligible expenses absorb tax into expense line.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">HR Claim Integration & GL Posting</div>
      &bull; <b>1:1 HR Pairing:</b> <code>hr_expense_claim_id</code> unique index prevents duplicate reimbursement of employee claims.<br>
      &bull; <b>Employee Conversion:</b> Automatically converts approved HR claim into expense voucher using employee name.<br>
      &bull; <b>Payment Posting:</b> Debits Expense Account (5xxx), Debits ITC (1300 if eligible), Credits Bank Account (1100).
    </div>
  </div>

  <!-- ==================== PAGE 9: ER 7 - GST REGISTRY & ITC ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>8. ER 7 — GST & Input Tax Credit Registry</span>
    <span class="badge badge-primary">Statutory Tax Compliance</span>
  </h1>
  <p>
    Central GST repository used for filing monthly returns (GSTR-1, GSTR-3B) and tracking statutory tax liabilities and Input Tax Credit claims.
  </p>

  <div class="diagram-card">
    ${er7Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Return Period & Supply Types</div>
      &bull; <b>Period Organization:</b> Partitioned by <code>period</code> (<code>YYYY-MM</code>) and <code>entry_type</code> (<code>OUTWARD</code>, <code>INWARD</code>, <code>REVERSE_CHARGE</code>).<br>
      &bull; <b>Tax Splits:</b> Discrete columns for <code>cgst_amount</code>, <code>sgst_amount</code>, <code>igst_amount</code>, <code>cess_amount</code>, and computed <code>total_tax</code>.<br>
      &bull; <b>GSTR-3B Net Liability:</b> Net tax payable = Outward Tax - Eligible Inward ITC.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Polymorphic Source References</div>
      &bull; <b>Composite Pointers:</b> <code>source_reference</code> stores typed references (e.g. <code>EXPENSE:12</code>, <code>PURCHASE_BILL:45</code>, <code>SALES_INVOICE:501</code>).<br>
      &bull; <b>Lookup Index:</b> Composite index on <code>(organization_id, source_reference)</code> accelerates invoice reconciliation during audit filings.<br>
      &bull; <code>organization_id</code>: Enforces strict tenant separation with <code>RESTRICT</code>.
    </div>
  </div>

  <!-- ==================== PAGE 10: ER 8 - FINANCIAL REPORTING ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>9. ER 8 — Financial Reporting Underlying Tables</span>
    <span class="badge badge-primary">Dynamic Runtime Aggregations</span>
  </h1>
  <p>
    Architectural model confirming that Financial Reports (Balance Sheet, P&L, Trial Balance, General Ledger, Cash/Bank Summary) <b>do not use static reporting tables</b>, but are calculated dynamically by <code>FinancialReportsService</code>.
  </p>

  <div class="diagram-card">
    ${er8Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Physical Base Tables Queried</div>
      &bull; <code>finance.accounts</code>: Chart of Accounts hierarchy, account types (<code>ASSET</code>, <code>LIABILITY</code>, <code>EQUITY</code>, <code>REVENUE</code>, <code>EXPENSE</code>).<br>
      &bull; <code>finance.journal_entries</code> & <code>journal_lines</code>: Transaction lines filtered strictly by <code>status = 'POSTED'</code> and date range.<br>
      &bull; <code>finance.bank_accounts</code>: Current liquid balances and movements.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Dynamic Statement Computations</div>
      &bull; <b>Trial Balance:</b> Verifies zero-sum integrity ($\sum \text{Debits} = \sum \text{Credits}$).<br>
      &bull; <b>Balance Sheet:</b> Groups by account type: $\text{Assets} = \text{Liabilities} + \text{Equity}$. Retained earnings dynamically injected from P&L.<br>
      &bull; <b>Profit & Loss:</b> Operating Revenue minus Operating Expenses = Net Profit.
    </div>
  </div>

  <!-- ==================== PAGE 11: ER 9 - SCM INTEGRATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>10. ER 9 — SCM–Finance Cross-Module Integration</span>
    <span class="badge badge-primary">End-to-End P2P & O2C Lifecycles</span>
  </h1>
  <p>
    Complete end-to-end integration diagram illustrating both the Procure-to-Pay (P2P) and Order-to-Cash (O2C) lifecycles between SCM and Finance.
  </p>

  <div class="diagram-card">
    ${er9Svg}
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Procure-to-Pay (P2P) Accounting Flow</div>
      $$\\text{Purchase Order} \\longrightarrow \\text{Supplier Bill} \\longrightarrow \\text{Supplier Payment} \\stackrel{\\text{1:1 FK}}{\\longrightarrow} \\text{Payment Made} \\longrightarrow \\text{Journal Entry}$$
      &bull; <b>Bill Posting:</b> DR Inventory (1400), DR ITC (1300), CR Accounts Payable (2000).<br>
      &bull; <b>Payment Disbursement:</b> DR Accounts Payable (2000), CR Bank Account (1100).
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Order-to-Cash (O2C) Accounting Flow</div>
      $$\\text{Sales Order} \\longrightarrow \\text{Invoice Ref} \\stackrel{\\text{String Match}}{\\longleftarrow} \\text{Allocation} \\stackrel{\\text{CASCADE}}{\\longleftarrow} \\text{Payment Received} \\longrightarrow \\text{Journal Entry}$$
      &bull; <b>Invoice Posting:</b> DR Accounts Receivable (1200), CR Revenue (4000), CR Output GST.<br>
      &bull; <b>Payment Settlement:</b> DR Bank Account (1100), CR Accounts Receivable (1200).
    </div>
  </div>

  <!-- ==================== PAGE 12: SCHEMA DICTIONARY ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>11. Complete Physical Schema Reference Dictionary</span>
    <span class="badge badge-success">All 11 Tables Audited</span>
  </h1>
  <p>
    Comprehensive catalog of all 11 database tables in <code>@@schema("finance")</code>, detailing primary keys, foreign keys, unique keys, and secondary indexes.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Physical Table Name</th>
        <th style="width: 25%;">Entity Role & Purpose</th>
        <th style="width: 6%;">PK</th>
        <th style="width: 22%;">Foreign Keys (Target Table)</th>
        <th style="width: 14%;">Unique Constraints</th>
        <th style="width: 15%;">Secondary Indexes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="font-bold">finance_master_list_items</td>
        <td>Configurable categories, expense types, payment modes</td>
        <td>id</td>
        <td>platform.organizations(id)</td>
        <td>None</td>
        <td>(org_id, category)</td>
      </tr>
      <tr>
        <td class="font-bold">accounts</td>
        <td>Hierarchical Chart of Accounts (COA) master catalog</td>
        <td>id</td>
        <td>platform.organizations(id), accounts(id)</td>
        <td>(org_id, account_code)</td>
        <td>(org_id, account_type), (org_id, is_active)</td>
      </tr>
      <tr>
        <td class="font-bold">journal_entries</td>
        <td>Core double-entry transaction voucher headers</td>
        <td>id</td>
        <td>platform.organizations(id), journal_entries(id)</td>
        <td>(org_id, entry_number), reversed_entry_id</td>
        <td>(org_id, entry_date), (org_id, status)</td>
      </tr>
      <tr>
        <td class="font-bold">journal_lines</td>
        <td>Debit and credit line items for vouchers</td>
        <td>id</td>
        <td>platform.organizations(id), journal_entries(id), accounts(id)</td>
        <td>None</td>
        <td>(org_id, journal_entry_id), (org_id, account_id)</td>
      </tr>
      <tr>
        <td class="font-bold">bank_accounts</td>
        <td>Treasury bank accounts, branches, balances</td>
        <td>id</td>
        <td>platform.organizations(id), accounts(id)</td>
        <td>(org_id, account_number)</td>
        <td>(org_id, is_active)</td>
      </tr>
      <tr>
        <td class="font-bold">bank_transactions</td>
        <td>Statement records and GL reconciliation</td>
        <td>id</td>
        <td>platform.organizations(id), bank_accounts(id), journal_entries(id)</td>
        <td>matched_journal_entry_id</td>
        <td>(org_id, bank_account_id, tx_date), (org_id, is_reconciled)</td>
      </tr>
      <tr>
        <td class="font-bold">expenses</td>
        <td>Operational expenses, GST/ITC, HR claims</td>
        <td>id</td>
        <td>platform.organizations(id), master_list_items(id) (x2), bank_accounts(id), accounts(id), journal_entries(id)</td>
        <td>(org_id, expense_number), journal_entry_id, hr_expense_claim_id</td>
        <td>(org_id, expense_date), (org_id, expense_type_id), (org_id, vendor_gstin)</td>
      </tr>
      <tr>
        <td class="font-bold">payments_received</td>
        <td>Accounts Receivable customer payments</td>
        <td>id</td>
        <td>platform.organizations(id), crm.accounts(id), master_list_items(id), bank_accounts(id), journal_entries(id)</td>
        <td>(org_id, payment_number), journal_entry_id</td>
        <td>(org_id, customer_id), (org_id, payment_date)</td>
      </tr>
      <tr>
        <td class="font-bold">payment_received_allocations</td>
        <td>Customer payment invoice allocation lines</td>
        <td>id</td>
        <td>platform.organizations(id), payments_received(id)</td>
        <td>None</td>
        <td>(org_id, payment_received_id), (org_id, invoice_reference)</td>
      </tr>
      <tr>
        <td class="font-bold">payments_made</td>
        <td>Accounts Payable vendor payments & SCM link</td>
        <td>id</td>
        <td>platform.organizations(id), master_list_items(id), bank_accounts(id), journal_entries(id), scm.supplier_payments(id)</td>
        <td>(org_id, payment_number), journal_entry_id, scm_supplier_payment_id</td>
        <td>(org_id, payment_date)</td>
      </tr>
      <tr>
        <td class="font-bold">gst_entries</td>
        <td>Statutory GST return tracking & tax breakdowns</td>
        <td>id</td>
        <td>platform.organizations(id)</td>
        <td>None</td>
        <td>(org_id, period, entry_type), (org_id, source_reference)</td>
      </tr>
    </tbody>
  </table>

  <!-- ==================== PAGE 13: GAPS & RECOMMENDATIONS ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>12. Discrepancies, Gaps & Architectural Recommendations</span>
    <span class="badge badge-warning">Action Items for Engineering</span>
  </h1>
  <p>
    Findings and architectural recommendations submitted based on schema inspection and migration verification.
  </p>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">1. Dedicated Sales Invoicing Table</div>
      &bull; <b>Current State:</b> Customer receipts allocate funds via <code>invoice_reference: String</code> without a foreign key to a dedicated <code>sales.invoices</code> table.<br>
      &bull; <b>Impact:</b> String references allow flexibility but lack database-layer foreign key validation.<br>
      &bull; <b>Recommendation:</b> Implement a dedicated <code>finance.sales_invoices</code> table and add an optional foreign key in <code>payment_received_allocations</code>.
    </div>

    <div class="relation-flow">
      <div class="relation-flow-title">2. Local PostgreSQL Container Status</div>
      &bull; <b>Current State:</b> Local container on port 5432 is stopped (<code>EACCES / P1001</code>).<br>
      &bull; <b>Impact:</b> All definitions verified from migration DDL with 100% parity. Live verification is staged.<br>
      &bull; <b>Action:</b> Start PostgreSQL (<code>docker compose up -d db</code>) and run <code>npx prisma migrate status</code>.
    </div>
  </div>

  <div class="grid-2col" style="margin-top: 8px;">
    <div class="relation-flow">
      <div class="relation-flow-title">3. Cross-Schema Foreign Key Dependencies</div>
      &bull; <b>Current State:</b> The <code>finance</code> schema contains physical foreign keys to <code>platform</code>, <code>crm</code>, and <code>scm</code>.<br>
      &bull; <b>Schema Split Roadmap:</b> If schemas are split into independent databases in the future, these foreign keys will transition to event-driven logical UUID references.
    </div>

    <div class="relation-flow">
      <div class="relation-flow-title">4. High-Volume Index Optimization</div>
      &bull; <b>Current State:</b> 13 unique constraints and 20 secondary indexes cover standard tenant and date queries.<br>
      &bull; <b>Recommendation:</b> Add composite index on <code>finance.journal_lines(organization_id, account_id, created_at)</code> as ledger volume exceeds 500k rows.
    </div>
  </div>

  <div class="callout-box" style="margin-top: 10px;">
    <div class="callout-title">Architectural Sign-off & Source of Truth Compliance</div>
    This specification confirms that the <b>feature/finance</b> branch contains a normalized, double-entry financial database architecture. All 11 models, 192 scalar columns, 32 foreign keys, 13 unique keys, and 20 indexes are fully documented and visually mapped in this document.
  </div>

</body>
</html>
`;

  const scratchHtml = path.resolve("scratch/finance_er_diagrams_v2.html");
  fs.writeFileSync(scratchHtml, html, "utf8");
  console.log("Saved HTML at:", scratchHtml);

  console.log("Launching Playwright Chrome...");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });

  const targetPdf = path.resolve("Docs/Finance_ER_Diagrams.pdf");
  console.log("Generating PDF at:", targetPdf);

  await page.pdf({
    path: targetPdf,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: {
      top: "10mm",
      bottom: "10mm",
      left: "12mm",
      right: "12mm",
    },
    displayHeaderFooter: true,
    headerTemplate:
      "<div style=\"font-family: 'Nunito Sans', sans-serif; font-size: 7pt; color: #64748B; width: 100%; padding: 0 12mm; display: flex; justify-content: space-between;\"><span>TexaWave ERP — Finance Module ER Diagrams & Database Architecture</span><span>27 October 2026</span></div>",
    footerTemplate:
      '<div style="font-family: \'Nunito Sans\', sans-serif; font-size: 7pt; color: #64748B; width: 100%; padding: 0 12mm; display: flex; justify-content: space-between;"><span>Confidential &bull; TexaWave ERP Core Engineering</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  });

  await browser.close();

  const stats = fs.statSync(targetPdf);
  console.log(
    `PDF successfully generated! Size: ${(stats.size / 1024).toFixed(2)} KB`,
  );
}

buildPdf().catch((err) => {
  console.error("PDF Generation failed:", err);
  process.exit(1);
});
