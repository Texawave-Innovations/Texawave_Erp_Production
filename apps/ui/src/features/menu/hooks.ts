"use client";

import type {
  CreateMenuItemInput,
  QueryMenuItemsInput,
  UpdateMenuItemInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItem,
  getMyMenu,
  listMenuItems,
  updateMenuItem,
} from "./api";

export function useMyMenu() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "menu", "my-menu"),
    queryFn: () => getMyMenu(),
    enabled: Boolean(organizationId && accessToken),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMenuItems(query: QueryMenuItemsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "menu", "items", query),
    queryFn: () => listMenuItems(query),
    enabled: Boolean(organizationId),
  });
}

export function useMenuItem(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "menu",
      "items",
      "detail",
      id ?? 0,
    ),
    queryFn: () => getMenuItem(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: (input: CreateMenuItemInput) => createMenuItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "menu"),
      });
    },
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateMenuItemInput }) =>
      updateMenuItem(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "menu"),
      });
    },
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: (id: number) => deleteMenuItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "menu"),
      });
    },
  });
}
