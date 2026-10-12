"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createMyTicket, listMyTickets, type CreateTicketInput } from "./api";

function key(organizationId: number) {
  return orgScopedKey(organizationId, "self-service-tickets", "list");
}

export function useMyTickets() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: key(organizationId ?? 0),
    queryFn: listMyTickets,
    enabled: Boolean(organizationId),
  });
}

export function useCreateMyTicket() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateTicketInput) => createMyTicket(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: key(organizationId ?? 0),
      });
    },
  });
}
