"use client";

import type {
  CreateCrmDocumentInput,
  QueryCrmDocumentsInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createCrmDocument, deleteCrmDocument, listCrmDocuments } from "./api";

function documentsKey(organizationId: number, query: QueryCrmDocumentsInput) {
  return orgScopedKey(organizationId, "crm-documents", query);
}

export function useCrmDocuments(query: QueryCrmDocumentsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: documentsKey(organizationId ?? 0, query),
    queryFn: () => listCrmDocuments(query),
    enabled: Boolean(organizationId),
  });
}

function useInvalidateCrmDocuments() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-documents"),
    });
}

export function useCreateCrmDocument() {
  const invalidate = useInvalidateCrmDocuments();
  return useMutation({
    mutationFn: (input: CreateCrmDocumentInput) => createCrmDocument(input),
    onSuccess: invalidate,
  });
}

export function useDeleteCrmDocument() {
  const invalidate = useInvalidateCrmDocuments();
  return useMutation({
    mutationFn: (id: number) => deleteCrmDocument(id),
    onSuccess: invalidate,
  });
}
