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
