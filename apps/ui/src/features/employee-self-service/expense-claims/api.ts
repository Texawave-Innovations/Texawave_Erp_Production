import { apiClient, withAuthRetry } from "@/lib/api-client";

export const EXPENSE_TYPES = [
  "Travel",
  "Food",
  "Accommodation",
  "Office Supplies",
  "Medical",
  "Other",
] as const;

export interface MyExpenseClaim {
  id: number;
  expenseType: string;
  amount: string;
  expenseDate: string;
  description: string;
  status: string;
}

export interface CreateExpenseClaimInput {
  expenseType: (typeof EXPENSE_TYPES)[number];
  amount: number;
  expenseDate: string;
  description: string;
  receiptRef?: string;
}

export async function listMyExpenseClaims(): Promise<MyExpenseClaim[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyExpenseClaim[]>("/self-service/expense-claims", {
      query: { limit: 50 },
    }),
  );
  return data;
}

export async function createMyExpenseClaim(
  input: CreateExpenseClaimInput,
): Promise<MyExpenseClaim> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyExpenseClaim>("/self-service/expense-claims", input),
  );
  return data;
}
