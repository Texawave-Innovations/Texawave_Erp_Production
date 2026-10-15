"use client";

import type {
  CreateContactInput,
  QueryContactsInput,
  UpdateContactInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "./api";

function contactsKey(organizationId: number, query: QueryContactsInput) {
  return orgScopedKey(organizationId, "crm-contacts", query);
}

export function useContacts(query: QueryContactsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: contactsKey(organizationId ?? 0, query),
    queryFn: () => listContacts(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateContactInput) => createContact(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-contacts"),
      });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateContactInput }) =>
      updateContact(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-contacts"),
      });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "crm-contacts"),
      });
    },
  });
}
