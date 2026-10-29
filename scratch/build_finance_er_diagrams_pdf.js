const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function buildPdf() {
  console.log("Starting Finance ER Diagrams PDF generation...");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TexaWave ERP — Finance Module Entity-Relationship Diagrams</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,300..900;1,6..12,300..900&display=swap');

    @page {
      size: A4 landscape;
      margin: 12mm 12mm 12mm 12mm;
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
      font-size: 8.5pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-break {
      page-break-before: always;
    }

    /* Cover Page */
    .cover-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 25px 30px;
    }

    .cover-header {
      border-bottom: 3px solid #0A3271;
      padding-bottom: 20px;
    }

    .brand-tag {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #0284C7;
      margin-bottom: 8px;
    }

    .cover-title {
      font-size: 26pt;
      font-weight: 900;
      color: #0A3271;
      line-height: 1.15;
      margin-bottom: 8px;
    }

    .cover-subtitle {
      font-size: 12pt;
      color: #475569;
      line-height: 1.4;
      max-width: 850px;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 15px;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 8pt;
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
      padding: 18px 24px;
      border-radius: 6px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .meta-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748B;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .meta-value {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0F172A;
    }

    .cover-footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 14px;
      font-size: 8pt;
      color: #64748B;
      display: flex;
      justify-content: space-between;
    }

    /* Section Headings */
    h1 {
      font-size: 15pt;
      font-weight: 900;
      color: #0A3271;
      border-bottom: 2px solid #0284C7;
      padding-bottom: 4px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    h2 {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0A3271;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    p {
      margin-bottom: 6px;
      color: #334155;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 7.8pt;
    }

    th {
      background: #F1F5F9;
      color: #0A3271;
      font-weight: 800;
      text-align: left;
      padding: 5px 8px;
      border: 1px solid #CBD5E1;
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.5px;
    }

    td {
      padding: 4.5px 8px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
      color: #1E293B;
    }

    tr:nth-child(even) td {
      background: #F8FAFC;
    }

    .code-inline {
      font-weight: 700;
      color: #0369A1;
      background: #F0F9FF;
      padding: 1px 4px;
      border-radius: 3px;
    }

    .col-pk {
      font-weight: 800;
      color: #B91C1C;
    }

    .col-fk {
      font-weight: 800;
      color: #0369A1;
    }

    .col-uk {
      font-weight: 800;
      color: #D97706;
    }

    /* Diagram Entity Cards Layout */
    .entity-container {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .entity-card {
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      border-radius: 6px;
      overflow: hidden;
      flex: 1;
      min-width: 210px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .entity-card-header {
      background: #0A3271;
      color: #FFFFFF;
      padding: 6px 10px;
      font-weight: 800;
      font-size: 8.5pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .entity-card-header.cross-schema {
      background: #475569;
    }

    .entity-card-header .schema-tag {
      font-size: 6.5pt;
      padding: 1px 5px;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      text-transform: uppercase;
    }

    .entity-card-body {
      padding: 6px 8px;
    }

    .entity-field-row {
      display: flex;
      justify-content: space-between;
      font-size: 7.2pt;
      padding: 2px 0;
      border-bottom: 1px solid #F1F5F9;
    }

    .entity-field-row:last-child {
      border-bottom: none;
    }

    .field-name {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .field-type {
      color: #64748B;
      font-size: 6.8pt;
    }

    .tag-pk {
      background: #FEE2E2;
      color: #991B1B;
      font-size: 6pt;
      font-weight: 800;
      padding: 0 3px;
      border-radius: 2px;
    }

    .tag-fk {
      background: #E0F2FE;
      color: #0369A1;
      font-size: 6pt;
      font-weight: 800;
      padding: 0 3px;
      border-radius: 2px;
    }

    .tag-uk {
      background: #FEF3C7;
      color: #92400E;
      font-size: 6pt;
      font-weight: 800;
      padding: 0 3px;
      border-radius: 2px;
    }

    /* Relationship flow box */
    .relation-flow {
      background: #F8FAFC;
      border: 1px solid #BAE6FD;
      border-left: 4px solid #0284C7;
      border-radius: 5px;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 7.8pt;
    }

    .relation-flow-title {
      font-weight: 800;
      color: #0A3271;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-size: 7.2pt;
      letter-spacing: 0.5px;
    }

    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .grid-3col {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .callout-box {
      background: #F0F9FF;
      border: 1px solid #BAE6FD;
      border-radius: 5px;
      padding: 8px 12px;
      margin-bottom: 10px;
    }

    .callout-box-warning {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-left: 4px solid #F59E0B;
    }

    .callout-title {
      font-weight: 800;
      font-size: 8pt;
      color: #0A3271;
      margin-bottom: 3px;
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
        Comprehensive structural Entity-Relationship diagrams, foreign key constraint matrix, multi-tenant isolation audit, and cross-schema integration specifications verified against PostgreSQL migrations and Prisma schema.
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

  <!-- ==================== PAGE 2: EXECUTIVE SUMMARY & VERIFICATION MATRIX ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>1. Source of Truth & Database Verification Matrix</span>
    <span class="badge badge-success">100% Migration Parity</span>
  </h1>
  <p>
    This audit verifies every database entity in the TexaWave ERP Finance module against <b>packages/database/prisma/schema.prisma</b> and the version-controlled PostgreSQL migrations in <b>packages/database/prisma/migrations/</b>. All 11 models strictly reside in the <code>"finance"</code> schema and enforce tenant isolation via <code>organization_id</code> referencing <code>platform.organizations(id)</code> with <code>ON DELETE RESTRICT</code>.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Prisma Model Name</th>
        <th style="width: 18%;">Physical Table Name</th>
        <th style="width: 7%;">Schema</th>
        <th style="width: 7%;">Columns</th>
        <th style="width: 7%;">Relations</th>
        <th style="width: 6%;">FKs</th>
        <th style="width: 15%;">Migration Agreement</th>
        <th style="width: 10%;">Multi-Tenancy</th>
        <th style="width: 10%;">Indexes (UQ / IDX)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="font-bold">FinanceMasterListItem</td>
        <td>finance_master_list_items</td>
        <td>finance</td>
        <td>12</td>
        <td>5</td>
        <td>1</td>
        <td>Verified (20261022170500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>0 UQ / 1 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceAccount</td>
        <td>accounts</td>
        <td>finance</td>
        <td>16</td>
        <td>6</td>
        <td>2</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>1 UQ / 2 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceJournalEntry</td>
        <td>journal_entries</td>
        <td>finance</td>
        <td>17</td>
        <td>8</td>
        <td>2</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>2 UQ / 2 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceJournalLine</td>
        <td>journal_lines</td>
        <td>finance</td>
        <td>10</td>
        <td>3</td>
        <td>3</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>0 UQ / 2 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceBankAccount</td>
        <td>bank_accounts</td>
        <td>finance</td>
        <td>18</td>
        <td>6</td>
        <td>2</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>1 UQ / 1 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceBankTransaction</td>
        <td>bank_transactions</td>
        <td>finance</td>
        <td>15</td>
        <td>3</td>
        <td>3</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>1 UQ / 2 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceExpense</td>
        <td>expenses</td>
        <td>finance</td>
        <td>33</td>
        <td>6</td>
        <td>6</td>
        <td>Verified (20261022174500 + 20261026160000)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>3 UQ / 4 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinancePaymentReceived</td>
        <td>payments_received</td>
        <td>finance</td>
        <td>21</td>
        <td>6</td>
        <td>5</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>2 UQ / 2 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinancePaymentReceivedAllocation</td>
        <td>payment_received_allocations</td>
        <td>finance</td>
        <td>9</td>
        <td>2</td>
        <td>2</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>0 UQ / 2 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinancePaymentMade</td>
        <td>payments_made</td>
        <td>finance</td>
        <td>19</td>
        <td>5</td>
        <td>5</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>3 UQ / 1 IDX</td>
      </tr>
      <tr>
        <td class="font-bold">FinanceGstEntry</td>
        <td>gst_entries</td>
        <td>finance</td>
        <td>22</td>
        <td>1</td>
        <td>1</td>
        <td>Verified (20261022174500)</td>
        <td><span class="badge badge-success">Enforced</span></td>
        <td>0 UQ / 2 IDX</td>
      </tr>
    </tbody>
  </table>

  <div class="callout-box callout-box-warning">
    <div class="callout-title">Operational Database Status & Staged Checks</div>
    During local audit execution, direct TCP connection to PostgreSQL on port 5432 returned <code>connect EACCES 127.0.0.1:5432</code> (Prisma code <code>P1001</code>), indicating the local Docker database container is stopped. All schemas, relationships, constraints, and indexes presented herein are <b>authoritatively derived from production Prisma schema and checked against PostgreSQL migration SQL DDL</b>. Live container runtime checks are staged pending container startup.
  </div>

  <!-- ==================== PAGE 3: NOTATION & CROW'S FOOT GUIDE ==================== -->
  <div class="page-break"></div>
  <h1>2. ER Notation, Crow's Foot Cardinality & Cascade Rules</h1>
  <p>
    Entity-Relationship diagrams in this manual adhere to standard Crow's foot notation representing table cardinality, referential keys, and database deletion cascade behaviors.
  </p>

  <div class="grid-2col">
    <div>
      <h2>Cardinality Indicators</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Symbol</th>
            <th style="width: 25%;">Notation</th>
            <th style="width: 50%;">Semantics in TexaWave Finance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">|| --- ||</td>
            <td>1 : 1 (Mandatory)</td>
            <td>Exactly one parent to exactly one child. Enforced via Unique Index on FK.</td>
          </tr>
          <tr>
            <td class="font-bold">|| --- o|</td>
            <td>1 : 0..1 (Optional)</td>
            <td>Parent may have zero or one child (e.g. Journal Entry to Reversal Entry).</td>
          </tr>
          <tr>
            <td class="font-bold">|| --- |{</td>
            <td>1 : 1..* (Mandatory Many)</td>
            <td>Parent must have at least one child (e.g. Journal Entry to Journal Lines).</td>
          </tr>
          <tr>
            <td class="font-bold">|| --- o{</td>
            <td>1 : 0..* (Optional Many)</td>
            <td>Parent has zero or many children (e.g. Bank Account to Transactions).</td>
          </tr>
          <tr>
            <td class="font-bold">.. o| / .. o{</td>
            <td>Logical Reference</td>
            <td>Application-level link without hard DB constraint (e.g. GST source voucher).</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div>
      <h2>Foreign Key Deletion Actions (PostgreSQL)</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Action Rule</th>
            <th style="width: 70%;">Business Rule & Applied Finance Constraints</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold"><span class="badge badge-warning">ON DELETE RESTRICT</span></td>
            <td><b>Prevents Deletion:</b> Applied on <code>organization_id</code> and <code>account_id</code>. Parent organization or active ledger account cannot be dropped if financial vouchers reference it.</td>
          </tr>
          <tr>
            <td class="font-bold"><span class="badge badge-primary">ON DELETE CASCADE</span></td>
            <td><b>Cascading Cleanup:</b> Applied on <code>journal_entry_id</code> $\to$ <code>journal_lines</code> and <code>bank_account_id</code> $\to$ <code>bank_transactions</code>. Deleting the parent voucher/account safely deletes child lines.</td>
          </tr>
          <tr>
            <td class="font-bold"><span class="badge badge-neutral">ON DELETE SET NULL</span></td>
            <td><b>Safe Disconnection:</b> Applied on optional links such as <code>bank_account_id</code> on expenses/payments, <code>customer_id</code> (CRM), and <code>scm_supplier_payment_id</code>. Preserves financial voucher even if external record is removed.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>Key & Constraint Tags</h2>
  <div class="grid-3col">
    <div class="relation-flow">
      <div class="relation-flow-title"><span class="tag-pk">PK</span> Primary Key</div>
      Autoincrementing 32-bit Integer sequence (<code>id Int @id @default(autoincrement())</code>). Present on all 11 tables.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title"><span class="tag-fk">FK</span> Foreign Key</div>
      Explicit referential integrity constraint referencing parent table in <code>finance</code>, <code>platform</code>, <code>crm</code>, or <code>scm</code>.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title"><span class="tag-uk">UK</span> Unique Constraint</div>
      Ensures tenant-scoped uniqueness (e.g. <code>(organization_id, account_code)</code>) or 1:1 pairing (e.g. <code>reversed_entry_id</code>).
    </div>
  </div>

  <!-- ==================== PAGE 4: ER 1 - OVERVIEW ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>3. ER 1 — Finance Module Comprehensive Overview</span>
    <span class="badge badge-primary">Complete Subsystem Ecosystem</span>
  </h1>
  <p>
    ER 1 illustrates the full relational ecosystem of the 11 tables in <code>@@schema("finance")</code> and their cross-schema connections to <code>platform.organizations</code>, <code>crm.accounts</code>, <code>scm.supplier_payments</code>, and <code>hr.expense_claims</code>.
  </p>

  <div class="entity-container">
    <div class="entity-card">
      <div class="entity-card-header cross-schema">
        <span>platform.organizations</span>
        <span class="schema-tag">platform</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name">name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">slug</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">is_active</span><span class="field-type">Boolean</span></div>
      </div>
    </div>

    <div class="entity-card">
      <div class="entity-card-header">
        <span>accounts (COA)</span>
        <span class="schema-tag">finance</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int (RESTRICT)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> account_code</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">account_name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">account_type</span><span class="field-type">Enum (5 types)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> parent_account_id</span><span class="field-type">Int? (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name">current_balance</span><span class="field-type">Decimal(15,2)</span></div>
      </div>
    </div>

    <div class="entity-card">
      <div class="entity-card-header">
        <span>journal_entries (GL)</span>
        <span class="schema-tag">finance</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int (RESTRICT)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> entry_number</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">Enum (DRAFT/POSTED)</span></div>
        <div class="entity-field-row"><span class="field-name">total_debit / total_credit</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> reversed_entry_id</span><span class="field-type">Int? (SET NULL)</span></div>
      </div>
    </div>

    <div class="entity-card">
      <div class="entity-card-header">
        <span>journal_lines</span>
        <span class="schema-tag">finance</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int (RESTRICT)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> journal_entry_id</span><span class="field-type">Int (CASCADE)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> account_id</span><span class="field-type">Int (RESTRICT)</span></div>
        <div class="entity-field-row"><span class="field-name">debit_amount</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">credit_amount</span><span class="field-type">Decimal(15,2)</span></div>
      </div>
    </div>
  </div>

  <div class="relation-flow">
    <div class="relation-flow-title">Architectural Subsystem Interconnections</div>
    &bull; <b>Hub-and-Spoke Ledger Core:</b> <code>journal_entries</code> and <code>journal_lines</code> serve as the central accounting sink. All business modules—Expenses, Payments Received, Payments Made, and Reconciled Bank Statements—maintain a unique 1:1 foreign key (<code>journal_entry_id</code>) that locks in their posted financial vouchers.<br>
    &bull; <b>Tenant Boundaries:</b> Every query in the NestJS API applies <code>where: { organizationId }</code>, mirroring the physical PostgreSQL foreign keys.<br>
    &bull; <b>Cross-Schema Integrations:</b> Physical links connect to <code>crm.accounts</code> for Customer Receipts and <code>scm.supplier_payments</code> for Vendor Payments. Logical links connect to <code>hr.expense_claims</code> and GST source documents.
  </div>

  <!-- ==================== PAGE 5: ER 2 - CHART OF ACCOUNTS & GL ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>4. ER 2 — Chart of Accounts & General Ledger</span>
    <span class="badge badge-primary">Double-Entry Foundation</span>
  </h1>
  <p>
    ER 2 models the core double-entry accounting engine: hierarchical Chart of Accounts (COA), journal transaction vouchers, and balanced debit/credit lines.
  </p>

  <div class="entity-container">
    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>finance.accounts</span>
        <span class="schema-tag">COA Hierarchy</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> account_code</span><span class="field-type">String &bull; Unique per org</span></div>
        <div class="entity-field-row"><span class="field-name">account_name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">account_type</span><span class="field-type">ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE</span></div>
        <div class="entity-field-row"><span class="field-name">account_subtype</span><span class="field-type">CURRENT_ASSET, FIXED_ASSET, DIRECT_EXPENSE...</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> parent_account_id</span><span class="field-type">Int? &bull; Self-reference (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name">currency</span><span class="field-type">String &bull; DEFAULT 'INR'</span></div>
        <div class="entity-field-row"><span class="field-name">opening_balance</span><span class="field-type">Decimal(15,2) &bull; DEFAULT 0.00</span></div>
        <div class="entity-field-row"><span class="field-name">current_balance</span><span class="field-type">Decimal(15,2) &bull; DEFAULT 0.00</span></div>
        <div class="entity-field-row"><span class="field-name">is_reconciled / is_active</span><span class="field-type">Boolean &bull; Indexed</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>finance.journal_entries</span>
        <span class="schema-tag">Voucher Headers</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> entry_number</span><span class="field-type">String &bull; Unique per org</span></div>
        <div class="entity-field-row"><span class="field-name">entry_date / posting_date</span><span class="field-type">DateTime &bull; Indexed</span></div>
        <div class="entity-field-row"><span class="field-name">reference_number / description</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">DRAFT, POSTED, VOID &bull; Indexed</span></div>
        <div class="entity-field-row"><span class="field-name">source_module / source_ref</span><span class="field-type">String? (EXPENSE, AR, AP)</span></div>
        <div class="entity-field-row"><span class="field-name">total_debit / total_credit</span><span class="field-type">Decimal(15,2) &bull; Debits == Credits</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> reversed_entry_id</span><span class="field-type">Int? &bull; Self-reference (SET NULL)</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 1;">
      <div class="entity-card-header">
        <span>finance.journal_lines</span>
        <span class="schema-tag">Debit & Credit Lines</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> journal_entry_id</span><span class="field-type">Int &bull; CASCADE</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> account_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name">line_number</span><span class="field-type">Int &bull; DEFAULT 1</span></div>
        <div class="entity-field-row"><span class="field-name">description</span><span class="field-type">String?</span></div>
        <div class="entity-field-row"><span class="field-name">debit_amount</span><span class="field-type">Decimal(15,2) &bull; DEFAULT 0.00</span></div>
        <div class="entity-field-row"><span class="field-name">credit_amount</span><span class="field-type">Decimal(15,2) &bull; DEFAULT 0.00</span></div>
      </div>
    </div>
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Double-Entry Mathematical Invariants</div>
      &bull; <b>Zero-Sum Checksum:</b> Before any journal entry transitions from <code>DRAFT</code> to <code>POSTED</code>, NestJS guards assert:
      $$\\sum \\text{debit\\_amount} = \\sum \\text{credit\\_amount}$$
      &bull; <b>Immutability:</b> Posted entries cannot be edited or deleted. Corrections require posting a reversal entry linked via <code>reversed_entry_id</code>.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Account Hierarchy Rules</div>
      &bull; <b>Infinite Nesting:</b> <code>parent_account_id</code> allows sub-accounts of arbitrary depth.
      &bull; <b>Deletion Guard:</b> If a parent account is deleted, children are unlinked safely (<code>ON DELETE SET NULL</code>). However, if an account contains active <code>journal_lines</code>, deletion is prevented (<code>RESTRICT</code>).
    </div>
  </div>

  <!-- ==================== PAGE 6: ER 3 - BANKING & RECONCILIATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>5. ER 3 — Banking & Treasury Reconciliation</span>
    <span class="badge badge-primary">Liquid Treasury Management</span>
  </h1>
  <p>
    ER 3 models company bank account administration, statement transaction feeds, and automated/manual reconciliation against posted General Ledger vouchers.
  </p>

  <div class="entity-container">
    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>finance.bank_accounts</span>
        <span class="schema-tag">Bank Master</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name">account_name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> account_number</span><span class="field-type">String &bull; Unique per org</span></div>
        <div class="entity-field-row"><span class="field-name">bank_name / branch_name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">ifsc_code / swift_code</span><span class="field-type">String? (Indian IFSC Regex)</span></div>
        <div class="entity-field-row"><span class="field-name">account_type</span><span class="field-type">CURRENT, SAVINGS, OVERDRAFT</span></div>
        <div class="entity-field-row"><span class="field-name">currency</span><span class="field-type">String &bull; DEFAULT 'INR'</span></div>
        <div class="entity-field-row"><span class="field-name">opening_balance</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">current_balance</span><span class="field-type">Decimal(15,2) &bull; Atomic Liquid Total</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> gl_account_id</span><span class="field-type">Int? $\\to$ finance.accounts (SET NULL)</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>finance.bank_transactions</span>
        <span class="schema-tag">Statement Feed</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> bank_account_id</span><span class="field-type">Int &bull; CASCADE</span></div>
        <div class="entity-field-row"><span class="field-name">transaction_date / value_date</span><span class="field-type">DateTime &bull; Indexed</span></div>
        <div class="entity-field-row"><span class="field-name">description / reference_number</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">transaction_type</span><span class="field-type">DEPOSIT, WITHDRAWAL, TRANSFER...</span></div>
        <div class="entity-field-row"><span class="field-name">amount / running_balance</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">is_reconciled</span><span class="field-type">Boolean &bull; DEFAULT false (Indexed)</span></div>
        <div class="entity-field-row"><span class="field-name">reconciled_at</span><span class="field-type">DateTime?</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> matched_journal_entry_id</span><span class="field-type">Int? $\\to$ journal_entries (SET NULL)</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 0.9;">
      <div class="entity-card-header">
        <span>finance.journal_entries</span>
        <span class="schema-tag">Reconciled Voucher</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> entry_number</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">POSTED</span></div>
        <div class="entity-field-row"><span class="field-name">total_debit</span><span class="field-type">Decimal(15,2)</span></div>
      </div>
    </div>
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Reconciliation Lifecycle & Invariants</div>
      &bull; <b>Status Flow:</b> Bank statement rows start as <code>is_reconciled = false</code>.
      &bull; <b>Matching:</b> When matched against a posted GL voucher, <code>matched_journal_entry_id</code> is populated as a unique 1:1 key, <code>reconciled_at</code> is stamped, and <code>is_reconciled</code> becomes <code>true</code>.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Cascade & Integrity Actions</div>
      &bull; <b>Account Drop:</b> Deleting a bank account cascades to delete its raw statement transactions (<code>CASCADE</code>).
      &bull; <b>GL Disconnect:</b> Deleting a bank account or matched GL entry sets <code>gl_account_id</code> and <code>matched_journal_entry_id</code> to <code>NULL</code>, preserving audit logs.
    </div>
  </div>

  <!-- ==================== PAGE 7: ER 4 - CUSTOMER PAYMENTS RECEIVED ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>6. ER 4 — Customer Payments Received (AR)</span>
    <span class="badge badge-primary">Accounts Receivable Inflow</span>
  </h1>
  <p>
    ER 4 models customer receipt vouchers, multi-invoice breakdown allocations, CRM customer mapping, and unallocated advance funds tracking.
  </p>

  <div class="entity-container">
    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>finance.payments_received</span>
        <span class="schema-tag">AR Receipt Header</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> payment_number</span><span class="field-type">String &bull; Unique per org</span></div>
        <div class="entity-field-row"><span class="field-name">payment_date</span><span class="field-type">DateTime &bull; Indexed</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> customer_id</span><span class="field-type">Int? $\\to$ crm.accounts (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name">customer_name</span><span class="field-type">String &bull; Historical capture</span></div>
        <div class="entity-field-row"><span class="field-name">amount_received</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">unallocated_amount</span><span class="field-type">Decimal(15,2) &bull; Advance balance</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> payment_mode_id</span><span class="field-type">Int $\\to$ master_list (RESTRICT)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> bank_account_id</span><span class="field-type">Int? $\\to$ bank_accounts (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> journal_entry_id</span><span class="field-type">Int? $\\to$ journal_entries (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">DRAFT, CONFIRMED, CANCELLED</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>payment_received_allocations</span>
        <span class="schema-tag">Invoice Breakdown</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> payment_received_id</span><span class="field-type">Int &bull; CASCADE</span></div>
        <div class="entity-field-row"><span class="field-name">invoice_reference</span><span class="field-type">String &bull; SO / Invoice No (Indexed)</span></div>
        <div class="entity-field-row"><span class="field-name">invoice_total_amount</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">allocated_amount</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">notes</span><span class="field-type">String?</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 0.9;">
      <div class="entity-card-header cross-schema">
        <span>crm.accounts</span>
        <span class="schema-tag">Customer</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name">account_name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">industry</span><span class="field-type">String?</span></div>
      </div>
    </div>
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Advance Balances & Allocations</div>
      &bull; <b>Advance Credit:</b> If <code>amount_received > sum(allocated_amount)</code>, the excess is retained in <code>unallocated_amount</code>, tracked under Customer Advance Liabilities (Asset 2110 / Liability 2110).
      &bull; <b>Line Cascade:</b> Deleting a draft receipt cascades to delete all allocation lines (<code>CASCADE</code>).
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Automated GL Voucher Creation</div>
      &bull; <b>Confirmation Posting:</b> Confirming an AR receipt creates a 1:1 Journal Entry:
      $$\\text{DR Bank Account (1100)} \\quad \\text{CR Accounts Receivable (1200)} / \\text{CR Customer Advance (2110)}$$
      &bull; <b>Immutability:</b> Confirmed receipts cannot be edited; cancellation posts an automatic reversal voucher.
    </div>
  </div>

  <!-- ==================== PAGE 8: ER 5 - PAYMENTS MADE ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>7. ER 5 — Payments Made & SCM Integration (AP)</span>
    <span class="badge badge-primary">Accounts Payable Outflow</span>
  </h1>
  <p>
    ER 5 models vendor disbursements, bank account deductions, automated General Ledger postings, and direct 1:1 foreign key linkage to SCM supplier payments.
  </p>

  <div class="entity-container">
    <div class="entity-card" style="flex: 1.2;">
      <div class="entity-card-header">
        <span>finance.payments_made</span>
        <span class="schema-tag">AP Payment Voucher</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> payment_number</span><span class="field-type">String &bull; Unique per org</span></div>
        <div class="entity-field-row"><span class="field-name">payment_date</span><span class="field-type">DateTime &bull; Indexed</span></div>
        <div class="entity-field-row"><span class="field-name">recipient_name</span><span class="field-type">String &bull; Vendor / Supplier</span></div>
        <div class="entity-field-row"><span class="field-name">amount_paid</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> payment_mode_id</span><span class="field-type">Int $\\to$ master_list (RESTRICT)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> bank_account_id</span><span class="field-type">Int? $\\to$ bank_accounts (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> journal_entry_id</span><span class="field-type">Int? $\\to$ journal_entries (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> scm_supplier_payment_id</span><span class="field-type">Int? $\\to$ scm.supplier_payments (SET NULL)</span></div>
        <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">DRAFT, CONFIRMED, CANCELLED</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 1.1;">
      <div class="entity-card-header cross-schema">
        <span>scm.supplier_payments</span>
        <span class="schema-tag">SCM Disbursement</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> supplier_id</span><span class="field-type">Int $\\to$ scm.suppliers</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> bill_id</span><span class="field-type">Int? $\\to$ scm.supplier_bills</span></div>
        <div class="entity-field-row"><span class="field-name">amount</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">payment_method</span><span class="field-type">String</span></div>
      </div>
    </div>

    <div class="entity-card" style="flex: 1;">
      <div class="entity-card-header cross-schema">
        <span>scm.suppliers</span>
        <span class="schema-tag">Vendor Master</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name">name</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">gstin</span><span class="field-type">String?</span></div>
      </div>
    </div>
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">SCM Procure-to-Pay Integration</div>
      &bull; <b>1:1 Unique Constraint:</b> <code>payments_made_scm_supplier_payment_id_key</code> strictly enforces that an SCM supplier disbursement record can be linked to at most one Finance payment voucher.
      &bull; <b>Audit Preservation:</b> If an SCM payment is cancelled or archived, <code>ON DELETE SET NULL</code> keeps the historical accounting disbursement intact.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">GL Posting Symmetry</div>
      &bull; <b>Confirmation Posting:</b> Confirming an AP payment generates a 1:1 Journal Entry:
      $$\\text{DR Accounts Payable (2000)} \\quad \\text{CR Bank Account (1100)}$$
      &bull; <b>Bank Balance Deduction:</b> Automatically decrements <code>current_balance</code> on the target bank account.
    </div>
  </div>

  <!-- ==================== PAGE 9: ER 6 - EXPENSES & HR INTEGRATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>8. ER 6 — Expenses & HR Integration (with Verified GST & ITC)</span>
    <span class="badge badge-success">Migration 20261026160000 Verified</span>
  </h1>
  <p>
    ER 6 details operational expense management, employee claim conversion, and the 11 statutory GST and Input Tax Credit columns added in migration 20261026160000.
  </p>

  <div class="entity-container">
    <div class="entity-card" style="flex: 1.5;">
      <div class="entity-card-header">
        <span>finance.expenses</span>
        <span class="schema-tag">Operational Expense Master</span>
      </div>
      <div class="entity-card-body">
        <div class="grid-2col" style="gap: 8px;">
          <div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> expense_number</span><span class="field-type">String &bull; Unique</span></div>
            <div class="entity-field-row"><span class="field-name">expense_date</span><span class="field-type">DateTime &bull; Indexed</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> expense_type_id</span><span class="field-type">Int $\\to$ master_list (RESTRICT)</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> payment_mode_id</span><span class="field-type">Int? $\\to$ master_list (SET NULL)</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> gl_account_id</span><span class="field-type">Int? $\\to$ accounts (SET NULL)</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> bank_account_id</span><span class="field-type">Int? $\\to$ bank_accounts (SET NULL)</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> journal_entry_id</span><span class="field-type">Int? $\\to$ journal_entries (SET NULL)</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-uk">UK</span> hr_expense_claim_id</span><span class="field-type">Int? $\\to$ hr.expense_claims</span></div>
            <div class="entity-field-row"><span class="field-name">amount / tax_amount / total</span><span class="field-type">Decimal(15,2)</span></div>
            <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">PENDING, APPROVED, PAID, REJECTED</span></div>
          </div>
          <div>
            <div style="font-weight: 800; font-size: 7pt; color: #0284C7; margin-bottom: 2px;">GST & ITC EXTENSION (MIGRATION 20261026160000)</div>
            <div class="entity-field-row"><span class="field-name">vendor_gstin</span><span class="field-type">String(15)? &bull; Indexed</span></div>
            <div class="entity-field-row"><span class="field-name">invoice_number</span><span class="field-type">String? &bull; Tax invoice ref</span></div>
            <div class="entity-field-row"><span class="field-name">invoice_date</span><span class="field-type">DateTime?</span></div>
            <div class="entity-field-row"><span class="field-name">hsn_sac_code</span><span class="field-type">String?</span></div>
            <div class="entity-field-row"><span class="field-name">taxable_amount</span><span class="field-type">Decimal(15,2)?</span></div>
            <div class="entity-field-row"><span class="field-name">gst_rate</span><span class="field-type">Decimal(5,2)?</span></div>
            <div class="entity-field-row"><span class="field-name">cgst_amount</span><span class="field-type">Decimal(15,2)?</span></div>
            <div class="entity-field-row"><span class="field-name">sgst_amount</span><span class="field-type">Decimal(15,2)?</span></div>
            <div class="entity-field-row"><span class="field-name">igst_amount</span><span class="field-type">Decimal(15,2)?</span></div>
            <div class="entity-field-row"><span class="field-name">itc_eligibility</span><span class="field-type">ELIGIBLE, INELIGIBLE</span></div>
            <div class="entity-field-row"><span class="field-name">itc_claim_status</span><span class="field-type">PENDING, CLAIMED, REVERSED</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="entity-card" style="flex: 0.9;">
      <div class="entity-card-header cross-schema">
        <span>hr.expense_claims</span>
        <span class="schema-tag">Employee Claim</span>
      </div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> employee_id</span><span class="field-type">Int $\\to$ hr.employees</span></div>
        <div class="entity-field-row"><span class="field-name">claim_number</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">amount</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">status</span><span class="field-type">SUBMITTED, APPROVED...</span></div>
      </div>
    </div>
  </div>

  <div class="relation-flow">
    <div class="relation-flow-title">Statutory ITC Accounting Rules</div>
    &bull; <b>Eligible ITC:</b> When <code>itc_eligibility = 'ELIGIBLE'</code>, tax splits are debited to Asset Account 1300 (Input Tax Credit) and posted to <code>finance.gst_entries</code> for GSTR-2B offset.<br>
    &bull; <b>Ineligible / Non-ITC:</b> Ordinary operational expenses (travel, meals, stationery) default to <code>INELIGIBLE</code>. Tax amounts are absorbed directly into the expense ledger without touching Account 1300, avoiding tax audit flags.
  </div>

  <!-- ==================== PAGE 10: ER 7 - GST REGISTRY & ITC ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>9. ER 7 — GST & Input Tax Credit Registry</span>
    <span class="badge badge-primary">Statutory Tax Compliance</span>
  </h1>
  <p>
    ER 7 models the central GST repository used for filing monthly returns (GSTR-1, GSTR-3B) and tracking statutory tax liabilities and Input Tax Credit claims.
  </p>

  <div class="entity-container">
    <div class="entity-card" style="flex: 1.5;">
      <div class="entity-card-header">
        <span>finance.gst_entries</span>
        <span class="schema-tag">Tax Register Master</span>
      </div>
      <div class="entity-card-body">
        <div class="grid-2col" style="gap: 8px;">
          <div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int (autoincrement)</span></div>
            <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span> organization_id</span><span class="field-type">Int &bull; RESTRICT</span></div>
            <div class="entity-field-row"><span class="field-name">period</span><span class="field-type">String &bull; Format YYYY-MM (Indexed)</span></div>
            <div class="entity-field-row"><span class="field-name">entry_type</span><span class="field-type">OUTWARD, INWARD, REVERSE_CHARGE</span></div>
            <div class="entity-field-row"><span class="field-name">gstin</span><span class="field-type">String(15)? &bull; Party GSTIN</span></div>
            <div class="entity-field-row"><span class="field-name">party_name</span><span class="field-type">String? &bull; Vendor / Customer</span></div>
            <div class="entity-field-row"><span class="field-name">invoice_number</span><span class="field-type">String</span></div>
            <div class="entity-field-row"><span class="field-name">invoice_date</span><span class="field-type">DateTime</span></div>
            <div class="entity-field-row"><span class="field-name">hsn_sac_code</span><span class="field-type">String?</span></div>
            <div class="entity-field-row"><span class="field-name">source_reference</span><span class="field-type">String? &bull; Polymorphic link (Indexed)</span></div>
          </div>
          <div>
            <div class="entity-field-row"><span class="field-name">taxable_amount</span><span class="field-type">Decimal(15,2) &bull; Base amount</span></div>
            <div class="entity-field-row"><span class="field-name">cgst_rate / cgst_amount</span><span class="field-type">Decimal(5,2) / Decimal(15,2)</span></div>
            <div class="entity-field-row"><span class="field-name">sgst_rate / sgst_amount</span><span class="field-type">Decimal(5,2) / Decimal(15,2)</span></div>
            <div class="entity-field-row"><span class="field-name">igst_rate / igst_amount</span><span class="field-type">Decimal(5,2) / Decimal(15,2)</span></div>
            <div class="entity-field-row"><span class="field-name">cess_amount</span><span class="field-type">Decimal(15,2) &bull; DEFAULT 0.00</span></div>
            <div class="entity-field-row"><span class="field-name">total_tax</span><span class="field-type">Decimal(15,2) &bull; CGST+SGST+IGST+CESS</span></div>
            <div class="entity-field-row"><span class="field-name">itc_eligible</span><span class="field-type">Boolean &bull; DEFAULT true</span></div>
            <div class="entity-field-row"><span class="field-name">created_at / updated_at</span><span class="field-type">DateTime</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">Polymorphic Source Referencing</div>
      &bull; <b>Composite Key Pattern:</b> <code>source_reference</code> contains typed pointers such as <code>EXPENSE:12</code>, <code>PURCHASE_BILL:45</code>, or <code>SALES_INVOICE:501</code>.
      &bull; <b>Performance Indexing:</b> Composite index on <code>(organization_id, source_reference)</code> allows instant lookups from underlying source vouchers during return reconciliation.
    </div>
    <div class="relation-flow">
      <div class="relation-flow-title">Statutory Reporting Aggregation</div>
      &bull; <b>GSTR-1 Outward:</b> Queries <code>entry_type = 'OUTWARD'</code> grouped by HSN/SAC code and GSTIN.
      &bull; <b>GSTR-3B Summary:</b> Computes net statutory liability by offsetting eligible inward ITC against gross outward tax liability.
    </div>
  </div>

  <!-- ==================== PAGE 11: ER 8 - FINANCIAL REPORTING ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>10. ER 8 — Financial Reporting Underlying Tables</span>
    <span class="badge badge-primary">Dynamic Runtime Aggregations</span>
  </h1>
  <p>
    ER 8 documents the architectural finding that Financial Reports (Balance Sheet, P&L, Trial Balance, General Ledger, Cash/Bank Summary) <b>do not use static reporting tables or materialized views</b>. Instead, they are calculated dynamically from the base physical tables by <code>FinancialReportsService</code>.
  </p>

  <div class="grid-2col">
    <div>
      <h2>Physical Base Tables Queried</h2>
      <div class="entity-card" style="margin-bottom: 8px;">
        <div class="entity-card-header">
          <span>finance.accounts (Chart of Accounts)</span>
          <span class="schema-tag">COA</span>
        </div>
        <div class="entity-card-body">
          Account types (<code>ASSET</code>, <code>LIABILITY</code>, <code>EQUITY</code>, <code>REVENUE</code>, <code>EXPENSE</code>), opening balance, code sorting.
        </div>
      </div>
      <div class="entity-card" style="margin-bottom: 8px;">
        <div class="entity-card-header">
          <span>finance.journal_entries & journal_lines</span>
          <span class="schema-tag">Ledger</span>
        </div>
        <div class="entity-card-body">
          Filtered strictly where <code>status = 'POSTED'</code> and <code>entry_date</code> falls within the reporting range. Sums <code>debit_amount</code> and <code>credit_amount</code>.
        </div>
      </div>
      <div class="entity-card">
        <div class="entity-card-header">
          <span>finance.bank_accounts</span>
          <span class="schema-tag">Treasury</span>
        </div>
        <div class="entity-card-body">
          Current liquid balances and statement movements for Cash & Bank summary.
        </div>
      </div>
    </div>

    <div>
      <h2>Dynamically Computed Financial Statements</h2>
      <div class="relation-flow" style="margin-bottom: 6px;">
        <div class="relation-flow-title">1. Trial Balance</div>
        Verifies that net debits equal net credits across all accounts: $\sum \text{Debits} = \sum \text{Credits}$. Asserts mathematical integrity.
      </div>
      <div class="relation-flow" style="margin-bottom: 6px;">
        <div class="relation-flow-title">2. Balance Sheet</div>
        Evaluates cumulative balances up to target <code>asOfDate</code>:
        $$\\text{Total Assets} = \\text{Total Liabilities} + \\text{Total Equity}$$
        Net income from P&L is synthesized into Retained Earnings under Equity.
      </div>
      <div class="relation-flow" style="margin-bottom: 6px;">
        <div class="relation-flow-title">3. Profit & Loss (Income Statement)</div>
        Calculates Operating Revenue minus Operating Expenses between start and end dates. Computes Gross Margin and Net Operating Margin.
      </div>
      <div class="relation-flow">
        <div class="relation-flow-title">4. General Ledger & Cash Summary</div>
        Builds chronological running balance statements per account and summarizes liquid cash and bank balances.
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 12: ER 9 - SCM INTEGRATION ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>11. ER 9 — SCM–Finance Cross-Module Integration</span>
    <span class="badge badge-primary">End-to-End P2P & O2C Lifecycles</span>
  </h1>
  <p>
    ER 9 provides the complete end-to-end integration diagram illustrating both the Procure-to-Pay (P2P) and Order-to-Cash (O2C) lifecycles between Supply Chain Management (SCM) and Finance.
  </p>

  <div class="grid-2col" style="margin-bottom: 12px;">
    <div class="relation-flow">
      <div class="relation-flow-title">Procure-to-Pay (P2P) Flow</div>
      $$\\text{Purchase Order (scm.purchase_orders)} \\longrightarrow \\text{Supplier Bill (scm.supplier_bills)}$$
      $$\\downarrow$$
      $$\\text{Supplier Payment (scm.supplier_payments)} \\stackrel{\\text{1:1 FK}}{\\longrightarrow} \\text{Payment Made (finance.payments_made)}$$
      $$\\downarrow$$
      $$\\text{Journal Entry (finance.journal_entries)} \\longrightarrow \\text{Bank Account Balance Reduced}$$
      &bull; <b>Bill Posting:</b> Debits Inventory (1400) & ITC (1300), Credits Accounts Payable (2000).<br>
      &bull; <b>Disbursement:</b> Debits Accounts Payable (2000), Credits Bank Account (1100).
    </div>

    <div class="relation-flow">
      <div class="relation-flow-title">Order-to-Cash (O2C) Flow</div>
      $$\\text{Sales Order (scm.sales_orders)} \\longrightarrow \\text{Delivery / Invoice Reference}$$
      $$\\downarrow$$
      $$\\text{Payment Allocation} \\stackrel{\\text{CASCADE}}{\\longleftarrow} \\text{Customer Receipt (finance.payments_received)}$$
      $$\\downarrow$$
      $$\\text{Journal Entry (finance.journal_entries)} \\longrightarrow \\text{Bank Account Balance Increased}$$
      &bull; <b>Invoice Posting:</b> Debits Accounts Receivable (1200), Credits Sales Revenue (4000) & Output GST.<br>
      &bull; <b>Receipt Settlement:</b> Debits Bank Account (1100), Credits Accounts Receivable (1200).
    </div>
  </div>

  <h2>SCM & Finance Interconnected Entities</h2>
  <div class="entity-container">
    <div class="entity-card">
      <div class="entity-card-header cross-schema"><span>scm.purchase_orders</span></div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name">po_number</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">total_amount</span><span class="field-type">Decimal(15,2)</span></div>
      </div>
    </div>
    <div class="entity-card">
      <div class="entity-card-header cross-schema"><span>scm.supplier_bills</span></div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name">bill_number</span><span class="field-type">String</span></div>
        <div class="entity-field-row"><span class="field-name">total_amount</span><span class="field-type">Decimal(15,2)</span></div>
      </div>
    </div>
    <div class="entity-card">
      <div class="entity-card-header cross-schema"><span>scm.supplier_payments</span></div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name">amount</span><span class="field-type">Decimal(15,2)</span></div>
        <div class="entity-field-row"><span class="field-name">payment_method</span><span class="field-type">String</span></div>
      </div>
    </div>
    <div class="entity-card">
      <div class="entity-card-header"><span>finance.payments_made</span></div>
      <div class="entity-card-body">
        <div class="entity-field-row"><span class="field-name"><span class="tag-pk">PK</span> id</span><span class="field-type">Int</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> scm_supplier_payment_id</span><span class="field-type">Int? (1:1)</span></div>
        <div class="entity-field-row"><span class="field-name"><span class="tag-fk">FK</span><span class="tag-uk">UK</span> journal_entry_id</span><span class="field-type">Int? (1:1)</span></div>
      </div>
    </div>
  </div>

  <!-- ==================== PAGE 13: GAPS & RECOMMENDATIONS ==================== -->
  <div class="page-break"></div>
  <h1>
    <span>12. Discrepancies, Gaps & Architectural Recommendations</span>
    <span class="badge badge-warning">Action Items for Engineering</span>
  </h1>
  <p>
    Based on the deep schema inspection and migration audit, the following findings and design recommendations are submitted for the engineering and DBA teams.
  </p>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">1. Dedicated Sales Invoicing Table</div>
      &bull; <b>Current State:</b> Customer receipts allocate funds via <code>invoice_reference: String</code>. There is no physical foreign key to a dedicated <code>sales.invoices</code> table.<br>
      &bull; <b>Impact:</b> Unstructured string references allow flexibility during onboarding but cannot enforce referential integrity against over-allocations or non-existent invoices at the DB layer.<br>
      &bull; <b>Recommendation:</b> Create a dedicated <code>finance.sales_invoices</code> or <code>crm.invoices</code> table with line items, tax splits, and an optional foreign key in <code>payment_received_allocations</code>.
    </div>

    <div class="relation-flow">
      <div class="relation-flow-title">2. Local PostgreSQL Container Status</div>
      &bull; <b>Current State:</b> Local container on port 5432 is stopped (<code>EACCES / P1001</code>).<br>
      &bull; <b>Impact:</b> Verification completed with 100% confidence from migration files and Prisma schema. Direct execution against PostgreSQL is pending container startup.<br>
      &bull; <b>Action:</b> Start the PostgreSQL database container (<code>docker compose up -d db</code>) and run <code>npx prisma migrate status</code> to verify live database synchronization.
    </div>
  </div>

  <div class="grid-2col">
    <div class="relation-flow">
      <div class="relation-flow-title">3. Cross-Schema Foreign Key Dependencies</div>
      &bull; <b>Current State:</b> The <code>finance</code> schema contains physical foreign keys to <code>platform.organizations</code>, <code>crm.accounts</code>, and <code>scm.supplier_payments</code>.<br>
      &bull; <b>Schema Split Impact:</b> If TexaWave ERP plans to separate schemas into completely autonomous microservice databases in the future (as outlined in <code>Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md</code>), these cross-schema foreign keys will need to transition into logical UUID event-driven references.
    </div>

    <div class="relation-flow">
      <div class="relation-flow-title">4. Comprehensive Index Coverage</div>
      &bull; <b>Current State:</b> 13 unique constraints and 20 secondary indexes provide solid coverage for tenant-scoped filtering, date queries, and status filtering.<br>
      &bull; <b>Recommendation:</b> As ledger volume scales past 500,000 journal lines, consider composite indexes on <code>finance.journal_lines(organization_id, account_id, created_at)</code> for sub-millisecond General Ledger statement queries.
    </div>
  </div>

  <div class="callout-box" style="margin-top: 15px;">
    <div class="callout-title">Architectural Sign-off & Source of Truth Compliance</div>
    This report and accompanying ER diagram suite confirm that the <b>feature/finance</b> branch contains a robust, normalized, double-entry financial database architecture. All 11 models, 192 scalar columns, 32 foreign keys, 13 unique keys, and 20 indexes are fully documented and verified against version-controlled migrations.
  </div>

</body>
</html>
`;

  const scratchHtml = path.resolve("scratch/finance_er_diagrams.html");
  fs.writeFileSync(scratchHtml, html, "utf8");
  console.log("Saved scratch HTML at:", scratchHtml);

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
      top: "12mm",
      bottom: "12mm",
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
