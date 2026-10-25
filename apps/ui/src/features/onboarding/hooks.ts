"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import {
  type SelfProfileUpdate,
  updateMyProfile,
  getMyBank,
  getMyAddress,
  getMyEmployee,
  getMyGovernmentIds,
  getMyPersonal,
  listExperience,
  listFamilyMembers,
  listMyDocuments,
  listDepartments,
  listDesignations,
  listEmploymentTypes,
  listRoles,
  listTeams,
} from "./api";

function useOrgQuery<T>(name: string, fn: () => Promise<T>) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", name),
    queryFn: fn,
    enabled: Boolean(organizationId),
  });
}

export const useTeamOptions = () => useOrgQuery("teams", listTeams);
export const useDesignationOptions = () =>
  useOrgQuery("designations", listDesignations);
export const useEmploymentTypeOptions = () =>
  useOrgQuery("employment-types", listEmploymentTypes);
export const useDepartmentOptions = () =>
  useOrgQuery("departments", listDepartments);
export const useRoleOptions = () => useOrgQuery("roles", listRoles);

export function useMyEmployee() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "me"),
    queryFn: getMyEmployee,
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMyFamilyMembers() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "family"),
    queryFn: listFamilyMembers,
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMyExperience() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "experience"),
    queryFn: listExperience,
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMyDocuments() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "documents"),
    queryFn: listMyDocuments,
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMyPersonal() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "personal"),
    queryFn: getMyPersonal,
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMyAddress(type: "PERMANENT" | "PRESENT") {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "address", type),
    queryFn: () => getMyAddress(type),
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMyBank() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "bank"),
    queryFn: getMyBank,
    enabled: Boolean(accessToken && organizationId),
  });
}

/** Saves the employee's own profile edit, then refetches every "my profile"
 * read (they all live under the org's "onboarding" key prefix). */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: SelfProfileUpdate) => updateMyProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "onboarding"),
      });
    },
  });
}

export function useMyGovernmentIds() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "onboarding", "government-ids"),
    queryFn: getMyGovernmentIds,
    enabled: Boolean(accessToken && organizationId),
  });
}
