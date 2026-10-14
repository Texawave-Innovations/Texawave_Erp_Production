"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  addMyTicketComment,
  addTicketComment,
  createMyTicket,
  createTicket,
  getMyTicket,
  getTicket,
  listMyTickets,
  listTickets,
  setTicketStatus,
  updateMyTicket,
  type CreateMyTicketBody,
  type CreateTicketBody,
  type MyTicketListQuery,
  type TicketListQuery,
} from "./api";
import type { TicketStatus } from "./types";

const KEY = "hr-tickets" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

/** HR view: own/team/all, scoped server-side. */
export function useTickets(query: TicketListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listTickets(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useTicket(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "detail", id ?? 0),
    queryFn: () => getTicket(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useCreateTicket() {
  return useOrgScopedMutation([KEY], (body: CreateTicketBody) =>
    createTicket(body),
  );
}

export function useSetTicketStatus() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, status }: { id: number; status: TicketStatus }) =>
      setTicketStatus(id, status),
  );
}

export function useAddTicketComment() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: string }) => addTicketComment(id, body),
  );
}

// ---- self-service: tickets raised by the caller, or raised by HR for them -

export function useMyTickets(query: MyTicketListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine", query),
    queryFn: () => listMyTickets(query),
    enabled: orgId > 0,
  });
}

export function useMyTicket(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "mine-detail", id ?? 0),
    queryFn: () => getMyTicket(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useCreateMyTicket() {
  return useOrgScopedMutation([KEY], (body: CreateMyTicketBody) =>
    createMyTicket(body),
  );
}

export function useUpdateMyTicket() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: CreateMyTicketBody }) =>
      updateMyTicket(id, body),
  );
}

export function useAddMyTicketComment() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: string }) =>
      addMyTicketComment(id, body),
  );
}
