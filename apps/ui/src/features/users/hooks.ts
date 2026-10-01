"use client";

import type {
  AssignUserRolesInput,
  AssignUserTeamsInput,
  CreateUserInput,
  QueryUsersInput,
  UpdateUserInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  assignUserRoles,
  assignUserTeams,
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from "./api";

function usersKey(organizationId: number, query: QueryUsersInput = {}) {
  return orgScopedKey(organizationId, "users", query);
}

export function useUsers(query: QueryUsersInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: usersKey(organizationId ?? 0, query),
    queryFn: () => listUsers(query),
    enabled: Boolean(organizationId),
  });
}

export function useUser(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "users", "detail", id ?? 0),
    queryFn: () => getUser(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

export function useCreateUser() {
  return useOrgScopedMutation(["users"], (input: CreateUserInput) =>
    createUser(input),
  );
}

export function useUpdateUser() {
  return useOrgScopedMutation(
    ["users"],
    ({ id, input }: { id: number; input: UpdateUserInput }) =>
      updateUser(id, input),
  );
}

export function useDeleteUser() {
  return useOrgScopedMutation(["users"], (id: number) => deleteUser(id));
}

export function useAssignUserRoles() {
  return useOrgScopedMutation(
    ["users"],
    ({ id, input }: { id: number; input: AssignUserRolesInput }) =>
      assignUserRoles(id, input),
  );
}

export function useAssignUserTeams() {
  return useOrgScopedMutation(
    ["users"],
    ({ id, input }: { id: number; input: AssignUserTeamsInput }) =>
      assignUserTeams(id, input),
  );
}
