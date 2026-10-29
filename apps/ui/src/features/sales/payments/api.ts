import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  CreatePaymentBody,
  Payment,
  PaymentAlerts,
  PaymentBody,
} from "./types";

export const PAYMENTS = "/sales/payments";

export interface PaymentListQuery {
  page: number;
  limit: number;
  search?: string;
  customerId?: number;
  invoiceId?: number;
  /** YYYY-MM */
  paymentMonth?: string;
  dueMonth?: string;
  overdueOnly?: boolean;
}

export function listPayments(
  query: PaymentListQuery,
): Promise<PaginatedEnvelope<Payment>> {
  return withAuthRetry(() =>
    apiClient.get<Payment[]>(PAYMENTS, {
      query: {
        ...query,
        ...(query.overdueOnly ? { overdueOnly: "true" } : {}),
      },
    }),
  ) as Promise<PaginatedEnvelope<Payment>>;
}

export async function getPaymentAlerts(): Promise<PaymentAlerts> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PaymentAlerts>(`${PAYMENTS}/alerts`),
  );
  return data;
}

export async function getNextPaymentNumber(date: string): Promise<string> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ number: string }>(`${PAYMENTS}/next-number`, {
      query: { date },
    }),
  );
  return data.number;
}

export async function createPayment(body: CreatePaymentBody): Promise<Payment> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Payment>(PAYMENTS, body),
  );
  return data;
}

export async function updatePayment(
  id: number,
  body: PaymentBody,
): Promise<Payment> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Payment>(`${PAYMENTS}/${id}`, body),
  );
  return data;
}

export async function deletePayment(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${PAYMENTS}/${id}`));
}

export const receiptPath = (id: number) => `${PAYMENTS}/${id}/receipt`;
