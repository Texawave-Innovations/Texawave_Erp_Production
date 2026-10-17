import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { DcStatus, DeliveryChallan, DeliveryChallanBody } from "./types";

export const CHALLANS = "/sales/delivery-challans";

export interface ChallanListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: DcStatus;
  from?: string;
  to?: string;
}

export function listChallans(
  query: ChallanListQuery,
): Promise<PaginatedEnvelope<DeliveryChallan>> {
  return withAuthRetry(() =>
    apiClient.get<DeliveryChallan[]>(CHALLANS, { query }),
  ) as Promise<PaginatedEnvelope<DeliveryChallan>>;
}

export async function getChallan(id: number): Promise<DeliveryChallan> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<DeliveryChallan>(`${CHALLANS}/${id}`),
  );
  return data;
}

/** The PDF's HTML for unsaved values (no prices, nothing stored). */
export async function previewChallan(
  body: DeliveryChallanBody,
  id?: number,
): Promise<{ number: string; html: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ number: string; html: string }>(
      id === undefined ? `${CHALLANS}/preview` : `${CHALLANS}/${id}/preview`,
      body,
    ),
  );
  return data;
}

export async function createChallan(
  body: DeliveryChallanBody,
): Promise<DeliveryChallan> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<DeliveryChallan>(CHALLANS, body),
  );
  return data;
}

export async function updateChallan(
  id: number,
  body: DeliveryChallanBody,
): Promise<DeliveryChallan> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<DeliveryChallan>(`${CHALLANS}/${id}`, body),
  );
  return data;
}

export async function deleteChallan(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${CHALLANS}/${id}`));
}
