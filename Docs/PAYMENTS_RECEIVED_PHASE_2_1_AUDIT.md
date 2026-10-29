# Customer Payments Received — Phase 2.1 Audit Report

**Feature:** Customer Payments Received (`/finance/payments-received`)  
**Parent Ticket:** TEXA-160 (Finance UI Implementation)  
**Backend Reference:** TEXA-154 (Finance Core Backend APIs)  
**Date:** 24 October 2026  
**Auditor:** Antigravity AI (Pair Programming Assistant)  
**Mode:** Audit Only (Read-Only Inspection & Non-Destructive Automated Checks)

---

## 1. Executive Status

### Status: Partially Complete (Functionally Operational with Structural Caveats)

The Customer Payments Received feature has been implemented across the full stack with real NestJS backend endpoints, Prisma persistence, double-entry General Ledger posting, React Query state management, and an accessible frontend complying with `AGENTS.md`.

However, the feature cannot yet be considered fully production-ready due to three structural issues:

1. **Accounting Inversion in Overdue Alerting:** The UI intimation banner and table `BALANCE` column treat unallocated funds (`unallocatedAmount`) as overdue customer debt rather than customer advance credit.
2. **Client-Side Pagination Mismatch:** The "Overdue" and "Due Month" filters operate client-side on the currently loaded page (15 records) rather than across the tenant database.
3. **Absence of an Authoritative Invoice Entity:** `invoiceReference` remains an arbitrary free-text string because there is no persistent `SalesInvoice` model in Prisma. Allocations cannot update invoice payment statuses or pull verified invoice balances.

---

## 2. Table of Findings

| ID       | Severity        | Affected Area                                                                                                                                                                                                                                                                                                                                                                                              | Evidence                                                                                                                                             | User / Business Impact                                                                                                                                                                                       | Recommended Action                                                                                                                                                            |
| :------- | :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-01** | **High (P0)**   | [`PaymentsReceivedView.tsx`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/ui/src/features/finance/payments-received/components/PaymentsReceivedView.tsx#L68-L98), [`DueIntimationBanner.tsx`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/ui/src/features/finance/payments-received/components/DueIntimationBanner.tsx)         | `getOverdueInfo` checks `unallocated > 0 && dueDate < today`. `BALANCE` column renders red badge when `unallocated > 0`.                             | **Accounting Inversion**: Customer payments received are asset inflows / liabilities (unallocated advance credit). Labeling unallocated funds as "Overdue Debt" treats paying clients as delinquent debtors. | Redesign banner and balance column to reflect customer advance credit rather than overdue receivables. Relocate overdue receivables alerting to an actual AR/Invoices module. |
| **F-02** | **High (P1)**   | [`PaymentsReceivedView.tsx`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/ui/src/features/finance/payments-received/components/PaymentsReceivedView.tsx#L94-L118), [`query-payments-received.dto.ts`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/dto/query-payments-received.dto.ts) | Backend `QueryPaymentsReceivedDto` lacks `isOverdue` and `dueMonth` filters. Filtering occurs client-side on 15 records in memory.                   | A user on page 1 filtering by "Overdue" will see 0 records even if pages 2–5 contain overdue receipts. Aggregate overdue count reflects only the current page.                                               | Add server-side query filters (`dueMonth`, `isOverdue`) and aggregate summary endpoints in the NestJS controller.                                                             |
| **F-03** | **Medium (P1)** | [`schema.prisma`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/packages/database/prisma/schema.prisma#L6133), [`payments-received.service.ts`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/payments-received.service.ts#L133)                                                              | No `SalesInvoice` model exists in Prisma. `invoiceReference` is an unindexed `String`. Allocation does not mutate invoice state.                     | Users can allocate money to arbitrary text strings. No automated validation ensures the invoice exists, is unpaid, or has a matching balance.                                                                | Establish an authoritative `SalesInvoice` model or link to `FinanceJournalEntry` reference numbers from sales integration.                                                    |
| **F-04** | **Medium (P1)** | `apps/ui/e2e/`                                                                                                                                                                                                                                                                                                                                                                                             | `apps/ui/e2e/` contains specs for `finance-accounts`, `finance-journal`, and `finance-settings`, but no `finance-payments-received.spec.ts`.         | Frontend regressions in receipt recording, allocation manipulation, or dialog states cannot be detected automatically in CI.                                                                                 | Implement a dedicated Playwright E2E spec covering customer payment recording, allocations, and GL confirmation flows.                                                        |
| **F-05** | **Low (P2)**    | [`apps/ui/src/features/finance/payments-received/api.ts`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/ui/src/features/finance/payments-received/api.ts#L63)                                                                                                                                                                                                          | `addPaymentAllocation` returns `Promise<FinancePaymentReceivedAllocation>`, but backend controller line 102 returns parent `FinancePaymentReceived`. | Type contract divergence. Currently masked because callers ignore the mutation return value and call `refetch()`.                                                                                            | Update the return type signature in `api.ts` to `Promise<FinancePaymentReceived>`.                                                                                            |
| **F-06** | **Low (P2)**    | [`PaymentsReceivedView.tsx`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/ui/src/features/finance/payments-received/components/PaymentsReceivedView.tsx#L347)                                                                                                                                                                                                         | `ActionMenu` provides View, Print, Confirm, Void, Delete, but lacks an "Edit" option for draft receipts.                                             | Users who make typos in draft receipt customer names, UTR numbers, or notes cannot edit them via the UI and must delete and recreate.                                                                        | Implement an Edit Receipt modal for `DRAFT` receipts.                                                                                                                         |
| **F-07** | **Low (P2)**    | [`payments-received.service.ts`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/payments-received.service.ts#L242)                                                                                                                                                                                                            | `update()` permits modifying `paymentDate` on `CONFIRMED` receipts without updating the linked `FinanceJournalEntry.entryDate`.                      | Receipt date and GL posting date can drift out of sync, causing reporting discrepancies across fiscal periods.                                                                                               | Disallow updating `paymentDate` on confirmed receipts, or synchronize updates to the linked journal entry.                                                                    |
| **F-08** | **Low (P2)**    | [`PaymentReceiptTemplate.tsx`](file:///c:/Users/skkin/OneDrive/Desktop/cooking area/Texawave_Erp_Production/apps/ui/src/features/finance/payments-received/print/PaymentReceiptTemplate.tsx)                                                                                                                                                                                                               | Company header uses generic text ("TEXAWAVE ERP") without dynamic organization address, GSTIN, or contact details.                                   | Printed vouchers do not display the tenant's legal corporate details or tax registration numbers.                                                                                                            | Pass tenant organization profile data into the receipt template.                                                                                                              |

---

## 3. Workflow Lifecycle Verification

| Workflow                                 | Status                 | Verification Method                         | Evidence & Observations                                                                                                                                 |
| :--------------------------------------- | :--------------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Draft Receipt Creation**            | **Verified**           | Automated unit tests & schema check         | `payments-received.service.spec.ts` line 140 confirms draft creation with `status: "DRAFT"`, zero GL journal generation, and no account balance impact. |
| **2. Confirmed Receipt Creation**        | **Verified**           | Automated unit tests & repository spec      | `payments-received.repository.spec.ts` line 65 confirms atomic creation + confirmation posting within a single Prisma transaction (`$transaction`).     |
| **3. GL Journal Posting (Double-Entry)** | **Verified**           | Automated unit tests & source inspection    | Posts balanced journal entry: Debit Bank/Cash Asset (`1010` / `1020`), Credit Accounts Receivable (`1200`). Balances update via `increment: delta`.     |
| **4. Post Idempotency Safeguards**       | **Verified**           | Automated unit tests & source inspection    | `confirm()` rejects calls on already `CONFIRMED` or `RECONCILED` receipts (`PAYMENT_ALREADY_CONFIRMED`).                                                |
| **5. Multi-Invoice Allocations**         | **Partially Verified** | Automated unit tests & component inspection | Mathematical allocation logic ($Allocated \le Amount$) verified in service and UI. However, allocations do not sync to an authoritative invoice entity. |
| **6. Allocation Removal**                | **Verified**           | Automated unit tests                        | `removeAllocation()` atomically removes line and restores unallocated amount via `$transaction`. Blocks modifications on `VOID` receipts.               |
| **7. Voiding & Reversal Accounting**     | **Verified**           | Automated unit tests & repository spec      | Voids receipt, marks original JV as `REVERSED`, creates a new `REV-` journal entry with inverted debits/credits, and restores GL account balances.      |
| **8. Soft Deletion & Audit Trail**       | **Verified**           | Automated unit tests & database inspection  | `delete()` allows soft-deletion only for `DRAFT` or `VOID` receipts. Blocks deletion of `CONFIRMED` records (`CANNOT_DELETE_CONFIRMED_RECEIPT`).        |
| **9. Draft Receipt Editing**             | **Partially Verified** | Automated unit tests (API only)             | Backend `update()` endpoint is covered in `service.spec.ts`, but no UI dialog or button is wired in `PaymentsReceivedView.tsx`.                         |
| **10. Overdue Alerting & Filter**        | **Failed**             | Source code inspection & manual simulation  | Inverted accounting logic: marks unallocated customer advance payments as overdue debt. Filters operate only on client-side page slice.                 |
| **11. Print Voucher & Save as PDF**      | **Verified (Layout)**  | Source code inspection & static markup test | Native window print popup, popup blocker toast handling, Indian currency words (`numberToWords`). Lacks dynamic tenant tax header.                      |
| **12. UI End-to-End Automation**         | **Not Verified**       | Repository inspection                       | No Playwright tests configured for `/finance/payments-received`.                                                                                        |

---

## 4. Confirmed Gaps vs. Potential Risks

### Confirmed Gaps (Demonstrated by Code/Tests)

1. **No Sales Invoice Model:** The absence of a Prisma `SalesInvoice` model prevents true accounts receivable tracking. Allocations are informational audit notes on the receipt rather than invoice settlement transactions.
2. **Accounting Semantics Mismatch:** The UI displays unallocated receipts as red "overdue balance" pills.
3. **Broken Pagination on Overdue Filter:** Clicking "Filter Overdue Only" applies an in-memory `.filter()` over the current page's 15 records. If the current page has 0 overdue items, the table shows empty even when other pages contain items.
4. **Missing UI Edit Capability:** Users cannot edit draft receipts through the frontend.

### Potential Risks (Requiring Further Testing)

1. **Concurrent Duplicate Submissions:** If a user rapidly double-clicks "Record & Post to GL" without specifying an explicit `paymentNumber`, two sequential receipts could be created before the button disables.
2. **Date Drift on Metadata Updates:** If a confirmed receipt's date is edited via the API, the General Ledger journal entry date remains unchanged.
3. **Reconciled Payment Modifications:** The backend permits metadata updates on `RECONCILED` receipts as long as they are not `VOID`. If reconciliation rules require immutable dates/references after bank reconciliation, this could violate audit compliance.

---

## 5. Verification Commands and Actual Results

| Check / Tool            | Target                     | Command                                                                                                                                                                           | Result                                                                                                                                                       |
| :---------------------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI Typecheck**        | Next.js & UI components    | `pnpm --filter ui run typecheck`                                                                                                                                                  | **Passed (0 errors)**                                                                                                                                        |
| **UI Lint**             | UI feature files & shell   | `pnpm --filter ui exec eslint "src/features/finance/payments-received" "src/app/(dashboard)/finance/payments-received" "src/features/finance/shared/components/FinanceShell.tsx"` | **Passed (0 errors, 0 warnings)**                                                                                                                            |
| **Backend Unit Tests**  | Payments Received module   | `pnpm --filter api test src/modules/finance/payments-received`                                                                                                                    | **Passed (43/43 tests passing, 2 test files)**                                                                                                               |
| **Backend E2E Harness** | Payments Received E2E spec | `pnpm --filter api run test:e2e test/finance-payments-received.e2e-spec.ts`                                                                                                       | **Failed as Expected**: Safety harness aborted execution because `DATABASE_URL` pointed to `texawave_erp` instead of disposable test DB `texawave_erp_test`. |
| **API Typecheck**       | Backend codebase           | `pnpm --filter api run typecheck`                                                                                                                                                 | **Failed (Pre-Existing)**: 2 errors in `reports.repository.spec.ts` (unrelated to payments-received).                                                        |

---

## 6. Prioritized Remediation Plan

### Phase P0: Correctness & Accounting Invariants

- [ ] **Fix Overdue Semantics:** Update `DueIntimationBanner.tsx` and `PaymentsReceivedView.tsx` to stop misclassifying unallocated customer advance payments as overdue debt. Rename the table column to **"Unallocated Advance Credit"** and format it with neutral/brand colors (`text-blue-700 bg-blue-50`).
- [ ] **Server-Side Filtering:** Add `dueMonth` and `isOverdue` query parameters to `QueryPaymentsReceivedDto` and `PaymentsReceivedRepository.findMany()` so filters paginate accurately over the entire database.

### Phase P1: Core Workflow Gaps

- [ ] **Implement Draft Edit Dialog:** Add an `Edit Receipt` dialog and wire it into the table `ActionMenu` for `DRAFT` receipts.
- [ ] **Synchronize Journal Dates on Update:** If `paymentDate` is updated on a `CONFIRMED` receipt, update `FinanceJournalEntry.entryDate` within the same transaction, or make `paymentDate` immutable once posted.
- [ ] **Align API Return Typing:** Fix `addPaymentAllocation` in `apps/ui/src/features/finance/payments-received/api.ts` to return `Promise<FinancePaymentReceived>`.
- [ ] **Add Playwright E2E Spec:** Create `apps/ui/e2e/finance-payments-received.spec.ts` to automate browser regressions for creation, allocation, filtering, and printing.

### Phase P2: UX & Document Polish

- [ ] **Dynamic Tenant Header on Receipt:** Pass organization legal name, address, and GSTIN into `PaymentReceiptTemplate.tsx`.
- [ ] **Invoice Autocomplete:** Provide dropdown autocomplete for `invoiceReference` based on open deals or journal entry reference numbers.

---

## 7. Proposed Next Implementation Phase (Phase 2.2)

### Scope: Payments Received Alignment & Semantic Correction

- **Target Files:**
  - `apps/ui/src/features/finance/payments-received/components/PaymentsReceivedView.tsx`
  - `apps/ui/src/features/finance/payments-received/components/DueIntimationBanner.tsx`
  - `apps/ui/src/features/finance/payments-received/api.ts`
  - `apps/ui/src/features/finance/payments-received/components/EditPaymentReceivedDialog.tsx` (new)
  - `apps/ui/e2e/finance-payments-received.spec.ts` (new)
- **Acceptance Criteria:**
  1. Unallocated customer advance credit is never displayed as overdue debt or formatted with destructive warning indicators.
  2. Users can edit draft receipts directly from the UI table action menu.
  3. API return signatures match the backend service contracts.
  4. Playwright tests execute cleanly against mock fixtures.
