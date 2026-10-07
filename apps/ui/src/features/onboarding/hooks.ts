"use client";

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import {
  getMyEmployee,
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
