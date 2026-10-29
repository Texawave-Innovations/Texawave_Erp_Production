import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { RdcStatus, ReturnableDc, ReturnableDcBody } from "./types";

export const RDCS = "/sales/returnable-dcs";

export interface RdcListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: RdcStatus;
  /** Issue month, YYYY-MM. */
  month?: string;
}

export function listRdcs(
  query: RdcListQuery,
): Promise<PaginatedEnvelope<ReturnableDc>> {
  return withAuthRetry(() =>
    apiClient.get<ReturnableDc[]>(RDCS, { query }),
  ) as Promise<PaginatedEnvelope<ReturnableDc>>;
}

export async function getRdc(id: number): Promise<ReturnableDc> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ReturnableDc>(`${RDCS}/${id}`),
  );
  return data;
}

/** The PDF's HTML for unsaved values (nothing stored). */
export async function previewRdc(
  body: ReturnableDcBody,
  id?: number,
): Promise<{ number: string; html: string }> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ number: string; html: string }>(
      id === undefined ? `${RDCS}/preview` : `${RDCS}/${id}/preview`,
      body,
    ),
  );
  return data;
}

export async function createRdc(body: ReturnableDcBody): Promise<ReturnableDc> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ReturnableDc>(RDCS, body),
  );
  return data;
}

export async function updateRdc(
  id: number,
  body: ReturnableDcBody,
): Promise<ReturnableDc> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<ReturnableDc>(`${RDCS}/${id}`, body),
  );
  return data;
}

export async function markRdcReturned(
  id: number,
  returnedDate: string,
): Promise<ReturnableDc> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ReturnableDc>(`${RDCS}/${id}/return`, { returnedDate }),
  );
  return data;
}

export async function reopenRdc(id: number): Promise<ReturnableDc> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ReturnableDc>(`${RDCS}/${id}/reopen`),
  );
  return data;
}

export async function deleteRdc(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${RDCS}/${id}`));
}
