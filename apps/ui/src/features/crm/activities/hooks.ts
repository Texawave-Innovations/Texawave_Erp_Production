"use client";

import type {
  CreateCrmActivityInput,
  QueryCrmActivitiesInput,
  UpdateCrmActivityInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createActivity,
  deleteActivity,
  getActivity,
  listActivities,
  updateActivity,
} from "./api";

function activitiesKey(organizationId: number, query: QueryCrmActivitiesInput) {
  return orgScopedKey(organizationId, "crm-activities", query);
}

export function useActivities(query: QueryCrmActivitiesInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: activitiesKey(organizationId ?? 0, query),
    queryFn: () => listActivities(query),
    enabled: Boolean(organizationId),
  });
}

export function useActivity(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-activity")
        : orgScopedKey(organizationId ?? 0, "crm-activity", id),
    queryFn: () => getActivity(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateActivities() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-activities"),
    });
}

export function useCreateActivity() {
  const invalidate = useInvalidateActivities();
  return useMutation({
    mutationFn: (input: CreateCrmActivityInput) => createActivity(input),
    onSuccess: invalidate,
  });
}

export function useUpdateActivity() {
  const invalidate = useInvalidateActivities();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateCrmActivityInput;
    }) => updateActivity(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteActivity() {
  const invalidate = useInvalidateActivities();
  return useMutation({
    mutationFn: (id: number) => deleteActivity(id),
    onSuccess: invalidate,
  });
}
