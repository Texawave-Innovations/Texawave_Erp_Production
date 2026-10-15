"use client";

import type {
  ConvertLeadInput,
  CreateLeadInput,
  QueryLeadsInput,
  UpdateLeadInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  convertLead,
  createLead,
  deleteLead,
  listLeads,
  updateLead,
} from "./api";

function leadsKey(organizationId: number, query: QueryLeadsInput) {
  return orgScopedKey(organizationId, "crm-leads", query);
}

export function useLeads(query: QueryLeadsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: leadsKey(organizationId ?? 0, query),
    queryFn: () => listLeads(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateLeadInput) => createLead(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateLeadInput }) =>
      updateLead(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => deleteLead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
    },
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ConvertLeadInput }) =>
      convertLead(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
      // A successful convert creates an Account (and usually a Contact) —
      // invalidate those lists too so they show up without a manual refresh.
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-accounts"),
      });
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-contacts"),
      });
    },
  });
}
