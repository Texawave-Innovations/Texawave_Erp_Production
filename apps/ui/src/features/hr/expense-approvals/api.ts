import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  ExpenseClaimItem,
  ExpenseClaimStatus,
  ExpenseType,
} from "./types";

const HR_BASE = "/hr/expense-claims";
const SELF_SERVICE_BASE = "/self-service/expense-claims";

export interface ExpenseClaimListQuery {
  page: number;
  limit: number;
  status?: ExpenseClaimStatus;
  expenseType?: ExpenseType;
  from?: string;
  to?: string;
  employeeId?: number;
}

/** HR/approver surface: own/team/all, scoped server-side against
 * `hr.expense_claim.read`. Also doubles as an employee's claim history when
 * `employeeId` is given (still within the caller's scope). */
export function listExpenseClaims(
  query: ExpenseClaimListQuery,
): Promise<PaginatedEnvelope<ExpenseClaimItem>> {
  return withAuthRetry(() =>
    apiClient.get<ExpenseClaimItem[]>(HR_BASE, { query }),
  ) as Promise<PaginatedEnvelope<ExpenseClaimItem>>;
}

export async function getExpenseClaim(id: number): Promise<ExpenseClaimItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ExpenseClaimItem>(`${HR_BASE}/${id}`),
  );
  return data;
}

export interface DecideExpenseClaimBody {
  decision: "APPROVED" | "REJECTED";
  note?: string;
}

export async function decideExpenseClaim(
  id: number,
  body: DecideExpenseClaimBody,
): Promise<ExpenseClaimItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ExpenseClaimItem>(`${HR_BASE}/${id}/decision`, body),
  );
  return data;
}

// ---- self-service (the authenticated user's own expense claims) -----------

export function listMyExpenseClaims(
  query: Omit<ExpenseClaimListQuery, "employeeId">,
): Promise<PaginatedEnvelope<ExpenseClaimItem>> {
  return withAuthRetry(() =>
    apiClient.get<ExpenseClaimItem[]>(SELF_SERVICE_BASE, { query }),
  ) as Promise<PaginatedEnvelope<ExpenseClaimItem>>;
}

export interface CreateExpenseClaimBody {
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  description: string;
  receiptRef?: string;
}

export async function createMyExpenseClaim(
  body: CreateExpenseClaimBody,
): Promise<ExpenseClaimItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ExpenseClaimItem>(SELF_SERVICE_BASE, body),
  );
  return data;
}
