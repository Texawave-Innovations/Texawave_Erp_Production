import { apiClient, withAuthRetry } from "@/lib/api-client";

/** The subset an employee may choose — mirrors
 * EMPLOYEE_TICKET_CATEGORIES in apps/api/src/modules/hr/tickets/tickets.rules.ts
 * (Notice/Warning are HR-only, so they're excluded here). */
export const TICKET_CATEGORIES = [
  "Attendance",
  "Salary",
  "Leave",
  "Documents",
  "IT Support",
  "HR Query",
  "Other",
] as const;

export interface MyTicket {
  id: number;
  category: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface CreateTicketInput {
  category: (typeof TICKET_CATEGORIES)[number];
  subject: string;
  description: string;
}

export async function listMyTickets(): Promise<MyTicket[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyTicket[]>("/self-service/tickets", {
      query: { limit: 50 },
    }),
  );
  return data;
}

export async function createMyTicket(
  input: CreateTicketInput,
): Promise<MyTicket> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyTicket>("/self-service/tickets", input),
  );
  return data;
}
