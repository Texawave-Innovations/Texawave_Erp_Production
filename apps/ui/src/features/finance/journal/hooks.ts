"use client";

import type {
  CreateFinanceJournalEntryInput,
  QueryFinanceJournalEntriesInput,
  QueryGeneralLedgerInput,
  ReverseJournalEntryInput,
  UpdateFinanceJournalEntryInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createJournalEntry,
  deleteJournalEntry,
  getGeneralLedger,
  getJournalEntry,
  listJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  updateJournalEntry,
} from "./api";

function journalEntriesKey(
  organizationId: number,
  query: QueryFinanceJournalEntriesInput = {},
) {
  return orgScopedKey(organizationId, "finance-journal-entries", query);
}

export function useJournalEntries(query: QueryFinanceJournalEntriesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: journalEntriesKey(organizationId ?? 0, query),
    queryFn: () => listJournalEntries(query),
    enabled: Boolean(organizationId),
  });
}

export function useJournalEntry(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-journal-entries",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getJournalEntry(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useCreateJournalEntry() {
  return useOrgScopedMutation(
    ["finance-journal-entries"],
    (input: CreateFinanceJournalEntryInput) => createJournalEntry(input),
  );
}

export function useUpdateJournalEntry() {
  return useOrgScopedMutation(
    ["finance-journal-entries"],
    ({ id, input }: { id: number; input: UpdateFinanceJournalEntryInput }) =>
      updateJournalEntry(id, input),
  );
}

export function usePostJournalEntry() {
  return useOrgScopedMutation(
    ["finance-journal-entries", "finance-accounts"],
    (id: number) => postJournalEntry(id),
  );
}

export function useReverseJournalEntry() {
  return useOrgScopedMutation(
    ["finance-journal-entries", "finance-accounts"],
    ({ id, input }: { id: number; input: ReverseJournalEntryInput }) =>
      reverseJournalEntry(id, input),
  );
}

export function useDeleteJournalEntry() {
  return useOrgScopedMutation(["finance-journal-entries"], (id: number) =>
    deleteJournalEntry(id),
  );
}

export function useGeneralLedger(
  query: QueryGeneralLedgerInput = {},
  options?: { enabled?: boolean },
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-general-ledger",
      query,
    ),
    queryFn: () => getGeneralLedger(query),
    enabled:
      Boolean(organizationId) &&
      Boolean(query.accountId) &&
      (options?.enabled ?? true),
  });
}
