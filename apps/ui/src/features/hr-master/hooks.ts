"use client";

import type {
  CreateLeaveTypeInput,
  CreateShiftInput,
  CreateWorkLocationInput,
  QueryLeaveTypesInput,
  QueryShiftsInput,
  QueryWorkLocationsInput,
  UpdateLeaveTypeInput,
  UpdateShiftInput,
  UpdateWorkLocationInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createLeaveType,
  createShift,
  createWorkLocation,
  listLeaveTypes,
  listShifts,
  listWorkLocations,
  setLeaveTypeActive,
  setShiftActive,
  setWorkLocationActive,
  updateLeaveType,
  updateShift,
  updateWorkLocation,
} from "./api";

/**
 * React Query hooks for the three HR Master resources with no prior
 * frontend. Departments and Designations already have hooks
 * (apps/ui/src/features/departments/hooks.ts,
 * apps/ui/src/features/designations/hooks.ts) — ./components/HrMasterView.tsx
 * imports those directly instead of re-wrapping them here.
 */

// --- Office locations ---
function workLocationsKey(
  organizationId: number,
  query: QueryWorkLocationsInput = {},
) {
  return orgScopedKey(organizationId, "hr-master-work-locations", query);
}

export function useWorkLocations(query: QueryWorkLocationsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: workLocationsKey(organizationId ?? 0, query),
    queryFn: () => listWorkLocations(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateWorkLocation() {
  return useOrgScopedMutation(
    ["hr-master-work-locations"],
    (input: CreateWorkLocationInput) => createWorkLocation(input),
  );
}

export function useUpdateWorkLocation() {
  return useOrgScopedMutation(
    ["hr-master-work-locations"],
    ({ id, input }: { id: number; input: UpdateWorkLocationInput }) =>
      updateWorkLocation(id, input),
  );
}

export function useSetWorkLocationActive() {
  return useOrgScopedMutation(
    ["hr-master-work-locations"],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setWorkLocationActive(id, isActive),
  );
}

// --- Leave types ---
function leaveTypesKey(
  organizationId: number,
  query: QueryLeaveTypesInput = {},
) {
  return orgScopedKey(organizationId, "hr-master-leave-types", query);
}

export function useLeaveTypes(query: QueryLeaveTypesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: leaveTypesKey(organizationId ?? 0, query),
    queryFn: () => listLeaveTypes(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateLeaveType() {
  return useOrgScopedMutation(
    ["hr-master-leave-types"],
    (input: CreateLeaveTypeInput) => createLeaveType(input),
  );
}

export function useUpdateLeaveType() {
  return useOrgScopedMutation(
    ["hr-master-leave-types"],
    ({ id, input }: { id: number; input: UpdateLeaveTypeInput }) =>
      updateLeaveType(id, input),
  );
}

export function useSetLeaveTypeActive() {
  return useOrgScopedMutation(
    ["hr-master-leave-types"],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setLeaveTypeActive(id, isActive),
  );
}

// --- Shifts ---
function shiftsKey(organizationId: number, query: QueryShiftsInput = {}) {
  return orgScopedKey(organizationId, "hr-master-shifts", query);
}

export function useShifts(query: QueryShiftsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: shiftsKey(organizationId ?? 0, query),
    queryFn: () => listShifts(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateShift() {
  return useOrgScopedMutation(["hr-master-shifts"], (input: CreateShiftInput) =>
    createShift(input),
  );
}

export function useUpdateShift() {
  return useOrgScopedMutation(
    ["hr-master-shifts"],
    ({ id, input }: { id: number; input: UpdateShiftInput }) =>
      updateShift(id, input),
  );
}

export function useSetShiftActive() {
  return useOrgScopedMutation(
    ["hr-master-shifts"],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setShiftActive(id, isActive),
  );
}
