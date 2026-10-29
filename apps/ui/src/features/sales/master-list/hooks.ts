"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  createOption,
  deleteOption,
  getCompanyProfile,
  getFieldLayout,
  listCodeFormats,
  listRunningNumbers,
  removeCompanyLogo,
  saveCompanyProfile,
  setRunningNumber,
  updateCodeFormat,
  updateOption,
  uploadCompanyLogo,
  uploadOptionImage,
} from "./api";
import type {
  CodeType,
  CompanyProfileBody,
  DocumentCodeType,
  MasterField,
  OptionBody,
} from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

function useMasterQuery<T>(part: string, fn: () => Promise<T>) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "master", part),
    queryFn: fn,
    enabled: orgId > 0,
  });
}

export const useCodeFormats = () =>
  useMasterQuery("code-formats", listCodeFormats);
export const useRunningNumbers = () =>
  useMasterQuery("running-numbers", listRunningNumbers);
export const useCompanyProfile = () =>
  useMasterQuery("company-profile", getCompanyProfile);
export const useFieldLayout = () => useMasterQuery("layout", getFieldLayout);

// Every Sales mutation invalidates [SALES_KEY], so forms pick up new
// numbers, company details and options too.

export function useUpdateCodeFormat() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({
      codeType,
      body,
    }: {
      codeType: CodeType;
      body: { prefix: string; padding: number };
    }) => updateCodeFormat(codeType, body),
  );
}

export function useSetRunningNumber() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({
      codeType,
      body,
    }: {
      codeType: DocumentCodeType;
      body: { lastNumber: number; fiscalYear: string };
    }) => setRunningNumber(codeType, body),
  );
}

export function useSaveCompanyProfile() {
  return useOrgScopedMutation([SALES_KEY], (body: CompanyProfileBody) =>
    saveCompanyProfile(body),
  );
}

export function useUploadCompanyLogo() {
  return useOrgScopedMutation([SALES_KEY], (file: File) =>
    uploadCompanyLogo(file),
  );
}

export function useRemoveCompanyLogo() {
  return useOrgScopedMutation([SALES_KEY], (_: void) => removeCompanyLogo());
}

export function useCreateOption() {
  return useOrgScopedMutation(
    [SALES_KEY],
    (body: OptionBody & { field: MasterField }) => createOption(body),
  );
}

export function useUpdateOption() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: OptionBody }) => updateOption(id, body),
  );
}

export function useDeleteOption() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deleteOption(id));
}

export function useUploadOptionImage() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, file }: { id: number; file: File }) => uploadOptionImage(id, file),
  );
}
