"use client";

import type {
  CreateTagInput,
  QueryTagsInput,
  UpdateTagInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createTag, deleteTag, listTags, updateTag } from "./api";

function tagsKey(organizationId: number, query: QueryTagsInput) {
  return orgScopedKey(organizationId, "reference-tags", query);
}

export function useTags(query: QueryTagsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: tagsKey(organizationId ?? 0, query),
    queryFn: () => listTags(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateTagInput) => createTag(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "reference-tags"),
      });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTagInput }) =>
      updateTag(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "reference-tags"),
      });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "reference-tags"),
      });
    },
  });
}
