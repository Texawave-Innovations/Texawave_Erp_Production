"use client";

import type {
  CreateBankAccountInput,
  CreateMasterListItemInput,
  CreateSalespersonInput,
  CreateSealSignatureInput,
  QueryBankAccountsInput,
  QueryMasterListItemsInput,
  QuerySalespersonsInput,
  QuerySealSignaturesInput,
  SalesDocumentType,
  UpdateBankAccountInput,
  UpdateDocumentNumberingInput,
  UpdateMasterListItemInput,
  UpdateSalespersonInput,
  UpdateSealSignatureInput,
  UpsertAuthorizedSignatoryInput,
  UpsertCompanyDetailInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createAuthorizedSignature,
  createBankAccount,
  createCompanySeal,
  createMasterListItem,
  createSalesperson,
  deleteAuthorizedSignature,
  deleteBankAccount,
  deleteCompanySeal,
  deleteMasterListItem,
  deleteSalesperson,
  getAuthorizedSignatory,
  getCompanyDetail,
  listAuthorizedSignatures,
  listBankAccounts,
  listCompanySeals,
  listDocumentNumbering,
  listMasterListItems,
  listSalespersons,
  updateAuthorizedSignature,
  updateBankAccount,
  updateCompanySeal,
  updateDocumentNumbering,
  updateMasterListItem,
  updateSalesperson,
  upsertAuthorizedSignatory,
  upsertCompanyDetail,
} from "./api";

/**
 * React Query hooks — one per endpoint, mirroring
 * apps/ui/src/features/_reference/tags/hooks.ts. Query keys are org-scoped
 * via `orgScopedKey`; mutations invalidate every query under their
 * resource's key prefix via `useOrgScopedMutation`.
 */

// --- Company ---
export function useCompanyDetail() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "sales-settings-company-detail",
    ),
    queryFn: () => getCompanyDetail(),
    enabled: Boolean(organizationId),
  });
}

export function useUpsertCompanyDetail() {
  return useOrgScopedMutation(
    ["sales-settings-company-detail"],
    (input: UpsertCompanyDetailInput) => upsertCompanyDetail(input),
  );
}

// --- Document numbering ---
export function useDocumentNumbering() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "sales-settings-document-numbering",
    ),
    queryFn: () => listDocumentNumbering(),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateDocumentNumbering() {
  return useOrgScopedMutation(
    ["sales-settings-document-numbering"],
    ({
      docType,
      input,
    }: {
      docType: SalesDocumentType;
      input: UpdateDocumentNumberingInput;
    }) => updateDocumentNumbering(docType, input),
  );
}

// --- Bank accounts ---
function bankAccountsKey(
  organizationId: number,
  query: QueryBankAccountsInput,
) {
  return orgScopedKey(organizationId, "sales-settings-bank-accounts", query);
}

export function useBankAccounts(query: QueryBankAccountsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: bankAccountsKey(organizationId ?? 0, query),
    queryFn: () => listBankAccounts(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateBankAccount() {
  return useOrgScopedMutation(
    ["sales-settings-bank-accounts"],
    (input: CreateBankAccountInput) => createBankAccount(input),
  );
}

export function useUpdateBankAccount() {
  return useOrgScopedMutation(
    ["sales-settings-bank-accounts"],
    ({ id, input }: { id: number; input: UpdateBankAccountInput }) =>
      updateBankAccount(id, input),
  );
}

export function useDeleteBankAccount() {
  return useOrgScopedMutation(["sales-settings-bank-accounts"], (id: number) =>
    deleteBankAccount(id),
  );
}

// --- Authorized signatory ---
export function useAuthorizedSignatory() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "sales-settings-authorized-signatory",
    ),
    queryFn: () => getAuthorizedSignatory(),
    enabled: Boolean(organizationId),
  });
}

export function useUpsertAuthorizedSignatory() {
  return useOrgScopedMutation(
    ["sales-settings-authorized-signatory"],
    (input: UpsertAuthorizedSignatoryInput) => upsertAuthorizedSignatory(input),
  );
}

// --- Salespersons ---
function salespersonsKey(
  organizationId: number,
  query: QuerySalespersonsInput,
) {
  return orgScopedKey(organizationId, "sales-settings-salespersons", query);
}

export function useSalespersons(query: QuerySalespersonsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: salespersonsKey(organizationId ?? 0, query),
    queryFn: () => listSalespersons(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateSalesperson() {
  return useOrgScopedMutation(
    ["sales-settings-salespersons"],
    (input: CreateSalespersonInput) => createSalesperson(input),
  );
}

export function useUpdateSalesperson() {
  return useOrgScopedMutation(
    ["sales-settings-salespersons"],
    ({ id, input }: { id: number; input: UpdateSalespersonInput }) =>
      updateSalesperson(id, input),
  );
}

export function useDeleteSalesperson() {
  return useOrgScopedMutation(["sales-settings-salespersons"], (id: number) =>
    deleteSalesperson(id),
  );
}

// --- Company seals masterlist ---
function companySealsKey(
  organizationId: number,
  query: QuerySealSignaturesInput,
) {
  return orgScopedKey(organizationId, "sales-settings-company-seals", query);
}

export function useCompanySeals(query: QuerySealSignaturesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: companySealsKey(organizationId ?? 0, query),
    queryFn: () => listCompanySeals(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateCompanySeal() {
  return useOrgScopedMutation(
    ["sales-settings-company-seals"],
    (input: CreateSealSignatureInput) => createCompanySeal(input),
  );
}

export function useUpdateCompanySeal() {
  return useOrgScopedMutation(
    ["sales-settings-company-seals"],
    ({ id, input }: { id: number; input: UpdateSealSignatureInput }) =>
      updateCompanySeal(id, input),
  );
}

export function useDeleteCompanySeal() {
  return useOrgScopedMutation(["sales-settings-company-seals"], (id: number) =>
    deleteCompanySeal(id),
  );
}

// --- Authorized signatures masterlist ---
function authorizedSignaturesKey(
  organizationId: number,
  query: QuerySealSignaturesInput,
) {
  return orgScopedKey(
    organizationId,
    "sales-settings-authorized-signatures",
    query,
  );
}

export function useAuthorizedSignatures(query: QuerySealSignaturesInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: authorizedSignaturesKey(organizationId ?? 0, query),
    queryFn: () => listAuthorizedSignatures(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateAuthorizedSignature() {
  return useOrgScopedMutation(
    ["sales-settings-authorized-signatures"],
    (input: CreateSealSignatureInput) => createAuthorizedSignature(input),
  );
}

export function useUpdateAuthorizedSignature() {
  return useOrgScopedMutation(
    ["sales-settings-authorized-signatures"],
    ({ id, input }: { id: number; input: UpdateSealSignatureInput }) =>
      updateAuthorizedSignature(id, input),
  );
}

export function useDeleteAuthorizedSignature() {
  return useOrgScopedMutation(
    ["sales-settings-authorized-signatures"],
    (id: number) => deleteAuthorizedSignature(id),
  );
}

// --- Master list items (Terms & Inventory) ---
function masterListItemsKey(
  organizationId: number,
  query: QueryMasterListItemsInput,
) {
  return orgScopedKey(
    organizationId,
    "sales-settings-master-list-items",
    query,
  );
}

export function useMasterListItems(query: QueryMasterListItemsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: masterListItemsKey(organizationId ?? 0, query),
    queryFn: () => listMasterListItems(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateMasterListItem() {
  return useOrgScopedMutation(
    ["sales-settings-master-list-items"],
    (input: CreateMasterListItemInput) => createMasterListItem(input),
  );
}

export function useUpdateMasterListItem() {
  return useOrgScopedMutation(
    ["sales-settings-master-list-items"],
    ({ id, input }: { id: number; input: UpdateMasterListItemInput }) =>
      updateMasterListItem(id, input),
  );
}

export function useDeleteMasterListItem() {
  return useOrgScopedMutation(
    ["sales-settings-master-list-items"],
    (id: number) => deleteMasterListItem(id),
  );
}

/** Exposed for components that need direct cache access (e.g. the
 * Numbering sub-tab re-reading after a per-docType PUT). */
export function useSalesSettingsQueryClient() {
  return useQueryClient();
}
