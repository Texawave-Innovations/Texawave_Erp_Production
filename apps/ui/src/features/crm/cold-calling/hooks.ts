"use client";

import type {
  CreateCrmColdCallingEntryInput,
  LinkCrmColdCallingEntryInput,
  QueryCrmColdCallingEntriesInput,
  RecordCrmColdCallingDispositionInput,
  UpdateCrmColdCallingEntryInput,
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
  createColdCallingEntry,
  deleteColdCallingEntry,
  getColdCallingEntry,
  linkColdCallingEntryAccount,
  listColdCallingEntries,
  listColdCallingStatuses,
  recordColdCallingDisposition,
  updateColdCallingEntry,
} from "./api";

function coldCallingKey(
  organizationId: number,
  query: QueryCrmColdCallingEntriesInput,
) {
  return orgScopedKey(organizationId, "crm-cold-calling", query);
}

export function useColdCallingEntries(query: QueryCrmColdCallingEntriesInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: coldCallingKey(organizationId ?? 0, query),
    queryFn: () => listColdCallingEntries(query),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

/** Distinct free-text statuses, for the list's status filter. */
export function useColdCallingStatuses() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-cold-calling", "statuses"),
    queryFn: listColdCallingStatuses,
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

export function useColdCallingEntry(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-cold-calling-entry")
        : orgScopedKey(organizationId ?? 0, "crm-cold-calling-entry", id),
    queryFn: () => getColdCallingEntry(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateColdCallingEntries() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-cold-calling"),
    });
}

export function useCreateColdCallingEntry() {
  const invalidate = useInvalidateColdCallingEntries();
  return useMutation({
    mutationFn: (input: CreateCrmColdCallingEntryInput) =>
      createColdCallingEntry(input),
    onSuccess: invalidate,
  });
}

export function useUpdateColdCallingEntry() {
  const invalidate = useInvalidateColdCallingEntries();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateCrmColdCallingEntryInput;
    }) => updateColdCallingEntry(id, input),
    onSuccess: invalidate,
  });
}

export function useLinkColdCallingEntryAccount() {
  const invalidate = useInvalidateColdCallingEntries();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: LinkCrmColdCallingEntryInput;
    }) => linkColdCallingEntryAccount(id, input),
    onSuccess: invalidate,
  });
}

export function useRecordColdCallingDisposition() {
  const invalidate = useInvalidateColdCallingEntries();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: RecordCrmColdCallingDispositionInput;
    }) => recordColdCallingDisposition(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteColdCallingEntry() {
  const invalidate = useInvalidateColdCallingEntries();
  return useMutation({
    mutationFn: (id: number) => deleteColdCallingEntry(id),
    onSuccess: invalidate,
  });
}
