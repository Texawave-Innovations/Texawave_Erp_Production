/** Mirrors apps/api/src/modules/hr/expense-claims/dto/expense-claim.dto.ts
 * and expense-claims.repository.ts (ExpenseClaimView). */
export const EXPENSE_TYPES = [
  "Travel",
  "Food",
  "Accommodation",
  "Office Supplies",
  "Medical",
  "Other",
] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_CLAIM_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number];

export interface EmployeeRef {
  id: number;
  fullName: string;
}

export interface DeciderRef {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/expense-claims, /hr/expense-claims/:id,
 * /self-service/expense-claims and /self-service/expense-claims/:id. */
export interface ExpenseClaimItem {
  id: number;
  employee: EmployeeRef;
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  description: string;
  receiptRef: string | null;
  status: ExpenseClaimStatus;
  decidedBy: DeciderRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}
