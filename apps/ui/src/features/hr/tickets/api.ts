import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  TicketCategory,
  TicketComment,
  TicketDetail,
  TicketItem,
  TicketStatus,
} from "./types";

const HR_BASE = "/hr/tickets";
const SELF_SERVICE_BASE = "/self-service/tickets";

export interface TicketListQuery {
  page: number;
  limit: number;
  status?: TicketStatus;
  category?: TicketCategory;
  employeeId?: number;
  q?: string;
}

/** HR surface: own/team/all, scoped server-side against `hr.ticket.read`. */
export function listTickets(
  query: TicketListQuery,
): Promise<PaginatedEnvelope<TicketItem>> {
  return withAuthRetry(() =>
    apiClient.get<TicketItem[]>(HR_BASE, { query }),
  ) as Promise<PaginatedEnvelope<TicketItem>>;
}

export async function getTicket(id: number): Promise<TicketDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TicketDetail>(`${HR_BASE}/${id}`),
  );
  return data;
}

export interface CreateTicketBody {
  employeeId: number;
  category: TicketCategory;
  subject: string;
  description: string;
}

export async function createTicket(
  body: CreateTicketBody,
): Promise<TicketDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TicketDetail>(HR_BASE, body),
  );
  return data;
}

export async function setTicketStatus(
  id: number,
  status: TicketStatus,
): Promise<TicketItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TicketItem>(`${HR_BASE}/${id}/status`, { status }),
  );
  return data;
}

export async function addTicketComment(
  id: number,
  body: string,
): Promise<TicketComment> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TicketComment>(`${HR_BASE}/${id}/comments`, { body }),
  );
  return data;
}

// ---- self-service: tickets raised by the caller, or raised by HR for them -

export interface MyTicketListQuery {
  page: number;
  limit: number;
  status?: TicketStatus;
  q?: string;
}

/** My tickets: raised by me or by HR for me, scoped server-side to the
 * caller's employee record. */
export function listMyTickets(
  query: MyTicketListQuery,
): Promise<PaginatedEnvelope<TicketItem>> {
  return withAuthRetry(() =>
    apiClient.get<TicketItem[]>(SELF_SERVICE_BASE, { query }),
  ) as Promise<PaginatedEnvelope<TicketItem>>;
}

export async function getMyTicket(id: number): Promise<TicketDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TicketDetail>(`${SELF_SERVICE_BASE}/${id}`),
  );
  return data;
}

/** Employee-raised categories only (no Notice/Warning — see
 * EMPLOYEE_TICKET_CATEGORIES in types.ts). No employeeId: the requester is
 * resolved from the JWT. */
export interface CreateMyTicketBody {
  category: TicketCategory;
  subject: string;
  description: string;
}

export async function createMyTicket(
  body: CreateMyTicketBody,
): Promise<TicketDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TicketDetail>(SELF_SERVICE_BASE, body),
  );
  return data;
}

/** Edit my own open, self-raised ticket (all three fields together). */
export async function updateMyTicket(
  id: number,
  body: CreateMyTicketBody,
): Promise<TicketDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<TicketDetail>(`${SELF_SERVICE_BASE}/${id}`, body),
  );
  return data;
}

/** Reply on a ticket HR raised for me. */
export async function addMyTicketComment(
  id: number,
  body: string,
): Promise<TicketComment> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<TicketComment>(`${SELF_SERVICE_BASE}/${id}/comments`, {
      body,
    }),
  );
  return data;
}
