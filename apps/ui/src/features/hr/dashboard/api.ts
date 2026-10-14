import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  DailyAttendanceRow,
  EmployeeRow,
  ExpenseClaimRow,
  HolidayRow,
  LeaveRequestRow,
  PageMeta,
  TicketRow,
} from "./types";

type Query = Record<string, string | number | boolean>;

/** Page size the API accepts (MAX_PAGE_SIZE in apps/api/src/common/dto/pagination.dto.ts). */
const PAGE_SIZE = 100;
/** Hard stop so a bad `total` can never turn into an unbounded request loop. */
const MAX_PAGES = 50;

function getList<T>(path: string, query: Query): Promise<PaginatedEnvelope<T>> {
  return withAuthRetry(() => apiClient.get<T[]>(path, { query })) as Promise<
    PaginatedEnvelope<T>
  >;
}

/** Fetches a single row's worth of a list only to read its `meta.total`. */
export async function countRows(path: string, query: Query): Promise<number> {
  const res = await getList<unknown>(path, { ...query, page: 1, limit: 1 });
  return res.meta.total;
}

/**
 * Walks every page of a paginated list. The API caps `limit` at 100, so
 * anything that needs a full population (daily attendance, leave history)
 * has to page. Throws on failure rather than returning a partial set, so a
 * caller can never render a count built from only some of the rows.
 */
export async function listAll<T>(path: string, query: Query): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await getList<T>(path, {
      ...query,
      page,
      limit: PAGE_SIZE,
    });
    rows.push(...res.data);
    const meta: PageMeta = res.meta;
    if (page >= meta.totalPages || res.data.length === 0) return rows;
  }
  throw new Error(`${path} exceeded ${MAX_PAGES} pages; refusing partial data`);
}

export function listDailyAttendance(date: string) {
  return listAll<DailyAttendanceRow>("/hr/attendance/reports/daily", { date });
}

export function listLeaveRequests(range?: { from: string; to: string }) {
  return listAll<LeaveRequestRow>(
    "/hr/leave-requests",
    range ? { from: range.from, to: range.to } : {},
  );
}

export function listEmployees() {
  return listAll<EmployeeRow>("/hr/employees", {});
}

export function listHolidays(from: string, to: string) {
  return listAll<HolidayRow>("/hr/holidays", { from, to, isActive: true });
}

export async function listRecentTickets(limit: number): Promise<TicketRow[]> {
  const res = await getList<TicketRow>("/hr/tickets", { page: 1, limit });
  return res.data;
}

export async function listRecentExpenseClaims(
  limit: number,
): Promise<ExpenseClaimRow[]> {
  const res = await getList<ExpenseClaimRow>("/hr/expense-claims", {
    page: 1,
    limit,
  });
  return res.data;
}
