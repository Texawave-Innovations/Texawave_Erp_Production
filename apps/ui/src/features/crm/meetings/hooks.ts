"use client";

import type {
  CompleteMeetingInput,
  CreateMeetingInput,
  QueryMeetingsInput,
  RescheduleMeetingInput,
  UpdateMeetingInput,
  UpdateMeetingStatusInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  completeMeeting,
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  rescheduleMeeting,
  updateMeeting,
  updateMeetingStatus,
} from "./api";

function meetingsKey(organizationId: number, query: QueryMeetingsInput) {
  return orgScopedKey(organizationId, "crm-meetings", query);
}

export function useMeetings(query: QueryMeetingsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: meetingsKey(organizationId ?? 0, query),
    queryFn: () => listMeetings(query),
    enabled: Boolean(organizationId),
  });
}

export function useMeeting(id: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      id === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-meeting")
        : orgScopedKey(organizationId ?? 0, "crm-meeting", id),
    queryFn: () => getMeeting(id as number),
    enabled: Boolean(organizationId) && id !== undefined,
  });
}

function useInvalidateMeetings() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-meetings"),
    });
}

export function useCreateMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => createMeeting(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateMeetingInput }) =>
      updateMeeting(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateMeetingStatus() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateMeetingStatusInput;
    }) => updateMeetingStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useCompleteMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CompleteMeetingInput }) =>
      completeMeeting(id, input),
    onSuccess: invalidate,
  });
}

export function useRescheduleMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: RescheduleMeetingInput;
    }) => rescheduleMeeting(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (id: number) => deleteMeeting(id),
    onSuccess: invalidate,
  });
}
