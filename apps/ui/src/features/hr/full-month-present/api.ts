import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { FullMonthPresentRow } from "./types";

const BASE = "/hr/attendance/reports/full-month-present";

export interface FullMonthPresentQuery {
  page: number;
  limit: number;
  /** Calendar month, YYYY-MM. */
  month: string;
  employeeId?: number;
  teamId?: number;
}

export function listFullMonthPresent(
  query: FullMonthPresentQuery,
): Promise<PaginatedEnvelope<FullMonthPresentRow>> {
  return withAuthRetry(() =>
    apiClient.get<FullMonthPresentRow[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<FullMonthPresentRow>>;
}
