import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { Holiday } from "./types";

const BASE = "/hr/holidays";

export interface HolidayListQuery {
  page: number;
  limit: number;
  year?: number;
  from?: string;
  to?: string;
  workLocationId?: number;
  organizationWide?: boolean;
  isActive?: boolean;
}

export function listHolidays(
  query: HolidayListQuery,
): Promise<PaginatedEnvelope<Holiday>> {
  return withAuthRetry(() =>
    apiClient.get<Holiday[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<Holiday>>;
}

export interface CreateHolidayBody {
  holidayDate: string;
  name: string;
  description?: string;
  workLocationId?: number;
}

export async function createHoliday(body: CreateHolidayBody): Promise<Holiday> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Holiday>(BASE, body),
  );
  return data;
}

export interface UpdateHolidayBody {
  name?: string;
  description?: string;
}

export async function updateHoliday(
  id: number,
  body: UpdateHolidayBody,
): Promise<Holiday> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Holiday>(`${BASE}/${id}`, body),
  );
  return data;
}

export async function setHolidayActive(
  id: number,
  isActive: boolean,
): Promise<Holiday> {
  const action = isActive ? "activate" : "deactivate";
  const { data } = await withAuthRetry(() =>
    apiClient.post<Holiday>(`${BASE}/${id}/${action}`),
  );
  return data;
}

export interface WorkLocationLookupItem {
  id: number;
  name: string;
  isActive?: boolean;
}

export async function listWorkLocations(): Promise<WorkLocationLookupItem[]> {
  const res = await withAuthRetry(() =>
    apiClient.get<WorkLocationLookupItem[]>("/master-data/work-locations", {
      query: { page: 1, limit: 100 },
    }),
  );
  return (res as PaginatedEnvelope<WorkLocationLookupItem>).data;
}
