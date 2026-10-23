"use client";

import type {
  CreateCrmNoteInput,
  QueryCrmNotesInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createCrmNote, deleteCrmNote, listCrmNotes } from "./api";

function notesKey(organizationId: number, query: QueryCrmNotesInput) {
  return orgScopedKey(organizationId, "crm-notes", query);
}

export function useCrmNotes(query: QueryCrmNotesInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: notesKey(organizationId ?? 0, query),
    queryFn: () => listCrmNotes(query),
    enabled: Boolean(organizationId) && Boolean(query.accountId),
  });
}

function useInvalidateCrmNotes() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-notes"),
    });
}

export function useCreateCrmNote() {
  const invalidate = useInvalidateCrmNotes();
  return useMutation({
    mutationFn: (input: CreateCrmNoteInput) => createCrmNote(input),
    onSuccess: invalidate,
  });
}

export function useDeleteCrmNote() {
  const invalidate = useInvalidateCrmNotes();
  return useMutation({
    mutationFn: (id: number) => deleteCrmNote(id),
    onSuccess: invalidate,
  });
}
