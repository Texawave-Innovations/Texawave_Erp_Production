"use client";

import type {
  ConvertLeadInput,
  CreateLeadInput,
  QueryLeadsInput,
  UpdateLeadInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  convertLead,
  createLead,
  deleteLead,
  getLead,
  addLeadNote,
  deleteLeadNote,
  getLeadFacets,
  getLeadTimeline,
  listLeadNotes,
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
    placeholderData: keepPreviousData,
  });
}

export function useLead(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-leads", "detail", id ?? 0),
    queryFn: () => getLead(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useLeadNotes(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-leads", "notes", id ?? 0),
    queryFn: () => listLeadNotes(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useLeadTimeline(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "crm-leads",
      "timeline",
      id ?? 0,
    ),
    queryFn: () => getLeadTimeline(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useAddLeadNote() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      addLeadNote(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
    },
  });
}

export function useDeleteLeadNote() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, noteId }: { id: number; noteId: number }) =>
      deleteLeadNote(id, noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-leads"),
      });
    },
  });
}

export function useLeadFacets() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-leads", "facets"),
    queryFn: getLeadFacets,
    enabled: Boolean(organizationId),
    staleTime: 60_000,
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
