"use client";

import type {
  AssignUserRolesInput,
  AssignUserTeamsInput,
  CreateUserInput,
  QueryUsersInput,
  UpdateUserInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
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
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "users"),
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      updateUser(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "users"),
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "users"),
      });
    },
  });
}

export function useAssignUserRoles() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AssignUserRolesInput }) =>
      assignUserRoles(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "users"),
      });
    },
  });
}

export function useAssignUserTeams() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AssignUserTeamsInput }) =>
      assignUserTeams(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "users"),
      });
    },
  });
}
