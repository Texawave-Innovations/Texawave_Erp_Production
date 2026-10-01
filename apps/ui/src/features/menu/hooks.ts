"use client";

import type {
  CreateMenuItemInput,
  QueryMenuItemsInput,
  UpdateMenuItemInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
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
  return useOrgScopedMutation(["menu"], (input: CreateMenuItemInput) =>
    createMenuItem(input),
  );
}

export function useUpdateMenuItem() {
  return useOrgScopedMutation(
    ["menu"],
    ({ id, input }: { id: number; input: UpdateMenuItemInput }) =>
      updateMenuItem(id, input),
  );
}

export function useDeleteMenuItem() {
  return useOrgScopedMutation(["menu"], (id: number) => deleteMenuItem(id));
}
