# Payments Received — Regression Investigation & Remediation Report

**Endpoint:** `POST /finance/payments-received`  
**Incident:** Existing Postman request returned HTTP 500 passing through `apps/api/src/modules/finance/payments-received/payments-received.service.ts:170:21`.  
**Date:** 24 October 2026  
**Status:** **Remediated & Verified with Regression Tests** (Manual Postman testing: **PENDING USER VERIFICATION**)

---

## 1. Executive Summary

### Did Payments Made Phase 3 cause this issue?

**No.** Payments Made Phase 3 implemented frontend components under `apps/ui/src/features/finance/payments-made/` and updated documentation. It made zero changes to `apps/api`, `packages/database`, or `packages/api-types`.

The issue surfaced during user Postman manual testing alongside development, caused by two latent backend defects in `PaymentsReceivedRepository`:

1. **Unsupported `createdBy` field:** Passed into `financePaymentReceivedAllocation.createMany` and `addAllocation`, even though `FinancePaymentReceivedAllocation` in `schema.prisma` does not have a `createdBy` column.
2. **Soft-deleted paymentNumber conflict:** `findByPaymentNumber` previously queried with `deletedAt: null`. If a payment number was soft-deleted during testing, re-using that number bypassed the 409 conflict check, hit PostgreSQL's global unique constraint `(organization_id, payment_number)`, and threw Prisma error `P2002`, returning an unhandled HTTP 500.

---

## 2. Root Cause Analysis & Verification

### Root Cause 1: Schema-Code Mismatch on Allocations (`createdBy` Column)

- **Model Schema:** In `packages/database/prisma/schema.prisma` lines 6172–6188, `FinancePaymentReceivedAllocation` defines:
  ```prisma
  model FinancePaymentReceivedAllocation {
    id                Int      @id @default(autoincrement())
    organizationId    Int      @map("organization_id")
    paymentReceivedId Int      @map("payment_received_id")
    invoiceReference  String   @map("invoice_reference")
    allocatedAmount   Decimal  @map("allocated_amount") @db.Decimal(15, 2)
    allocationDate    DateTime @default(now()) @map("allocation_date") @db.Timestamptz(6)
    notes             String?
    createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
    updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  }
  ```
- **Repository Defect:** `payments-received.repository.ts` line 207 passed `createdBy: data.createdBy` to `tx.financePaymentReceivedAllocation.createMany`, and line 491 passed `createdBy: updatedBy` to `tx.financePaymentReceivedAllocation.create`.
- **Failure Mechanism:** Whenever a request with `allocations: [...]` was submitted, Prisma or PostgreSQL rejected the non-existent `created_by` field, causing the transaction to abort and surfacing at `payments-received.service.ts:170:21` as an unhandled HTTP 500.

### Root Cause 2: Global Unique Constraint vs. Soft-Deleted Filter

- **Database Constraint:** `FinancePaymentReceived` defines:
  ```prisma
  @@unique([organizationId, paymentNumber])
  ```
  This is a global unique constraint across the entire table, covering both active and soft-deleted records.
- **Repository Defect:** `findByPaymentNumber()` queried with `deletedAt: null`. If a payment number was previously soft-deleted, `findByPaymentNumber` returned `null`, bypassing the 409 check in `service.create()`.
- **Failure Mechanism:** When `repository.create()` attempted insertion, PostgreSQL raised a unique constraint violation (`P2002`). Because `P2002` was not explicitly mapped, NestJS logged an unhandled error at line 170 and returned HTTP 500.

---

## 3. Minimal Safe Corrective Actions Applied

### 3.1 [`apps/api/src/modules/finance/payments-received/payments-received.repository.ts`](file:///c:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/payments-received.repository.ts)

1. **Line 154 (`findByPaymentNumber`):** Removed `deletedAt: null` so payment-number existence checks include soft-deleted records matching the database constraint.
2. **Line 207 (`create`):** Removed `createdBy: data.createdBy` from the `financePaymentReceivedAllocation.createMany` data payload.
3. **Line 491 (`addAllocation`):** Removed `createdBy: updatedBy` from the `financePaymentReceivedAllocation.create` data payload.

### 3.2 [`apps/api/src/modules/finance/payments-received/payments-received.service.ts`](file:///c:/Users/skkin/OneDrive/Desktop/cooking%20area/Texawave_Erp_Production/apps/api/src/modules/finance/payments-received/payments-received.service.ts)

1. Wrapped `this.repository.create()` in a focused try/catch targeting Prisma error code `P2002` (`PrismaClientKnownRequestError`).
2. Mapped any `P2002` unique constraint error on `paymentNumber` directly to `ResourceConflictException` (HTTP 409 `RESOURCE_CONFLICT`). Unrelated database errors are re-thrown without suppression.

---

## 4. Verification & Regression Test Results

### 4.1 Unit Test Suite

Ran `pnpm --filter api test src/modules/finance/payments-received`:

```
 ✓ src/modules/finance/payments-received/payments-received.repository.spec.ts (11 tests) 16ms
 ✓ src/modules/finance/payments-received/payments-received.service.spec.ts (36 tests) 24ms

 Test Files  2 passed (2)
      Tests  47 passed (47)
```

New regression tests added:

- `repository.spec.ts`: Asserts that `findByPaymentNumber` checks across all records and does not filter out deleted records (`findArg.where.deletedAt === undefined`).
- `repository.spec.ts`: Asserts that `create()` passes initial allocations without `createdBy`.
- `repository.spec.ts`: Asserts that `addAllocation()` passes data without `createdBy`.
- `service.spec.ts`: Asserts that `service.create()` throws `ResourceConflictException` (409) when `paymentNumber` belongs to a soft-deleted record.
- `service.spec.ts`: Asserts that `service.create()` catches Prisma `P2002` and throws `ResourceConflictException` (409).

### 4.2 Payments Made Cross-Verification

Ran `pnpm --filter api test src/modules/finance/payments-made`:

```
 ✓ src/modules/finance/payments-made/payments-made.repository.spec.ts (7 tests) 13ms
 ✓ src/modules/finance/payments-made/payments-made.service.spec.ts (22 tests) 27ms

 Test Files  2 passed (2)
      Tests  29 passed (29)
```

### 4.3 Code Quality Checks

- `pnpm --filter api exec eslint "src/modules/finance/payments-received"`: **0 errors, 0 warnings (Exit code 0)**.
- `pnpm --filter ui run typecheck`: **0 errors (Exit code 0)**.

---

## 5. Postman Retest Instructions

To re-verify the fix in Postman:

### Test Case 1: Receipt Creation with Allocations (Formerly Triggering 500)

- **Method:** `POST`
- **URL:** `{{baseUrl}}/finance/payments-received`
- **Headers:** `Authorization: Bearer {{token}}`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "paymentDate": "2026-10-24",
    "customerName": "Test Client Corp",
    "amount": 5000,
    "paymentModeId": 1,
    "status": "DRAFT",
    "allocations": [
      {
        "invoiceReference": "INV-2026-0001",
        "allocatedAmount": 3000,
        "notes": "Partial invoice allocation"
      }
    ]
  }
  ```
- **Expected Result:** `201 Created` with created payment and allocations array populated.

### Test Case 2: Duplicate / Reused Payment Number (Soft-Deleted or Existing)

- **Method:** `POST`
- **URL:** `{{baseUrl}}/finance/payments-received`
- **Body:**
  ```json
  {
    "paymentNumber": "REC-DUPLICATE-TEST",
    "paymentDate": "2026-10-24",
    "customerName": "Test Client Corp",
    "amount": 2000,
    "paymentModeId": 1,
    "status": "DRAFT"
  }
  ```
- **Steps:** Send once (`201 Created`). Delete via `DELETE /finance/payments-received/:id` (`200 OK`). Send again.
- **Expected Result:** `409 Conflict` with:
  ```json
  {
    "statusCode": 409,
    "message": "Payment with number 'REC-DUPLICATE-TEST' already exists",
    "error": "RESOURCE_CONFLICT"
  }
  ```
  _(Zero HTTP 500 crashes)._
