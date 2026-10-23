"use client";

import type {
  CreateFollowUpInput,
  QueryFollowUpsInput,
  RescheduleFollowUpInput,
  UpdateFollowUpInput,
  UpdateFollowUpStatusInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createFollowUp,
  deleteFollowUp,
  getFollowUp,
  listFollowUps,
  rescheduleFollowUp,
  updateFollowUp,
  updateFollowUpStatus,
} from "./api";

function followUpsKey(organizationId: number, query: QueryFollowUpsInput) {
  return orgScopedKey(organizationId, "crm-follow-ups", query);
}

export function useFollowUps(query: QueryFollowUpsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: followUpsKey(organizationId ?? 0, query),
    queryFn: () => listFollowUps(query),
    enabled: Boolean(organizationId),
  });
}

export function useFollowUp(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-follow-up")
        : orgScopedKey(organizationId ?? 0, "crm-follow-up", id),
    queryFn: () => getFollowUp(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateFollowUps() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-follow-ups"),
    });
}

export function useCreateFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: (input: CreateFollowUpInput) => createFollowUp(input),
    onSuccess: invalidate,
  });
}

export function useUpdateFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateFollowUpInput }) =>
      updateFollowUp(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateFollowUpStatus() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateFollowUpStatusInput;
    }) => updateFollowUpStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useRescheduleFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: RescheduleFollowUpInput;
    }) => rescheduleFollowUp(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: (id: number) => deleteFollowUp(id),
    onSuccess: invalidate,
  });
}
