import type {
  AuthorizedSignatory,
  BankAccount,
  CompanyDetail,
  CreateBankAccountInput,
  CreateMasterListItemInput,
  CreateSalespersonInput,
  CreateSealSignatureInput,
  DocumentNumbering,
  PaginatedEnvelope,
  QueryBankAccountsInput,
  QueryMasterListItemsInput,
  QuerySalespersonsInput,
  QuerySealSignaturesInput,
  SalesDocumentType,
  SalesMasterListItem,
  Salesperson,
  SealSignature,
  UpdateBankAccountInput,
  UpdateDocumentNumberingInput,
  UpdateMasterListItemInput,
  UpdateSalespersonInput,
  UpdateSealSignatureInput,
  UpsertAuthorizedSignatoryInput,
  UpsertCompanyDetailInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/_reference/tags/api.ts. One function per endpoint in
 * apps/api/src/modules/sales-settings/.
 */

// --- Company (singleton) ---
export async function getCompanyDetail(): Promise<CompanyDetail | null> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CompanyDetail | null>("/sales-settings/company-detail"),
  );
  return data;
}

export async function upsertCompanyDetail(
  input: UpsertCompanyDetailInput,
): Promise<CompanyDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<CompanyDetail>("/sales-settings/company-detail", input),
  );
  return data;
}

// --- Document numbering ---
export async function listDocumentNumbering(): Promise<DocumentNumbering[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<DocumentNumbering[]>("/sales-settings/document-numbering"),
  );
  return data;
}

export async function updateDocumentNumbering(
  docType: SalesDocumentType,
  input: UpdateDocumentNumberingInput,
): Promise<DocumentNumbering> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<DocumentNumbering>(
      `/sales-settings/document-numbering/${docType}`,
      input,
    ),
  );
  return data;
}

// --- Bank accounts ---
export function listBankAccounts(
  query: QueryBankAccountsInput = {},
): Promise<PaginatedEnvelope<BankAccount>> {
  return withAuthRetry(() =>
    apiClient.get<BankAccount[]>("/sales-settings/bank-accounts", { query }),
  ) as Promise<PaginatedEnvelope<BankAccount>>;
}

export async function createBankAccount(
  input: CreateBankAccountInput,
): Promise<BankAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<BankAccount>("/sales-settings/bank-accounts", input),
  );
  return data;
}

export async function updateBankAccount(
  id: number,
  input: UpdateBankAccountInput,
): Promise<BankAccount> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<BankAccount>(`/sales-settings/bank-accounts/${id}`, input),
  );
  return data;
}

export async function deleteBankAccount(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/sales-settings/bank-accounts/${id}`),
  );
}

// --- Authorized signatory (singleton) ---
export async function getAuthorizedSignatory(): Promise<AuthorizedSignatory | null> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<AuthorizedSignatory | null>(
      "/sales-settings/authorized-signatory",
    ),
  );
  return data;
}

export async function upsertAuthorizedSignatory(
  input: UpsertAuthorizedSignatoryInput,
): Promise<AuthorizedSignatory> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<AuthorizedSignatory>(
      "/sales-settings/authorized-signatory",
      input,
    ),
  );
  return data;
}

// --- Salespersons ---
export function listSalespersons(
  query: QuerySalespersonsInput = {},
): Promise<PaginatedEnvelope<Salesperson>> {
  return withAuthRetry(() =>
    apiClient.get<Salesperson[]>("/sales-settings/salespersons", { query }),
  ) as Promise<PaginatedEnvelope<Salesperson>>;
}

export async function createSalesperson(
  input: CreateSalespersonInput,
): Promise<Salesperson> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Salesperson>("/sales-settings/salespersons", input),
  );
  return data;
}

export async function updateSalesperson(
  id: number,
  input: UpdateSalespersonInput,
): Promise<Salesperson> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Salesperson>(`/sales-settings/salespersons/${id}`, input),
  );
  return data;
}

export async function deleteSalesperson(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/sales-settings/salespersons/${id}`),
  );
}

// --- Company seals masterlist ---
export function listCompanySeals(
  query: QuerySealSignaturesInput = {},
): Promise<PaginatedEnvelope<SealSignature>> {
  return withAuthRetry(() =>
    apiClient.get<SealSignature[]>("/sales-settings/company-seals", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<SealSignature>>;
}

export async function createCompanySeal(
  input: CreateSealSignatureInput,
): Promise<SealSignature> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SealSignature>("/sales-settings/company-seals", input),
  );
  return data;
}

export async function updateCompanySeal(
  id: number,
  input: UpdateSealSignatureInput,
): Promise<SealSignature> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<SealSignature>(
      `/sales-settings/company-seals/${id}`,
      input,
    ),
  );
  return data;
}

export async function deleteCompanySeal(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/sales-settings/company-seals/${id}`),
  );
}

// --- Authorized signatures masterlist ---
export function listAuthorizedSignatures(
  query: QuerySealSignaturesInput = {},
): Promise<PaginatedEnvelope<SealSignature>> {
  return withAuthRetry(() =>
    apiClient.get<SealSignature[]>("/sales-settings/authorized-signatures", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<SealSignature>>;
}

export async function createAuthorizedSignature(
  input: CreateSealSignatureInput,
): Promise<SealSignature> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SealSignature>(
      "/sales-settings/authorized-signatures",
      input,
    ),
  );
  return data;
}

export async function updateAuthorizedSignature(
  id: number,
  input: UpdateSealSignatureInput,
): Promise<SealSignature> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<SealSignature>(
      `/sales-settings/authorized-signatures/${id}`,
      input,
    ),
  );
  return data;
}

export async function deleteAuthorizedSignature(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/sales-settings/authorized-signatures/${id}`),
  );
}

// --- Master list items (Terms & Inventory, 8 categories) ---
export function listMasterListItems(
  query: QueryMasterListItemsInput,
): Promise<PaginatedEnvelope<SalesMasterListItem>> {
  return withAuthRetry(() =>
    apiClient.get<SalesMasterListItem[]>("/sales-settings/master-list-items", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<SalesMasterListItem>>;
}

export async function createMasterListItem(
  input: CreateMasterListItemInput,
): Promise<SalesMasterListItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<SalesMasterListItem>(
      "/sales-settings/master-list-items",
      input,
    ),
  );
  return data;
}

export async function updateMasterListItem(
  id: number,
  input: UpdateMasterListItemInput,
): Promise<SalesMasterListItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<SalesMasterListItem>(
      `/sales-settings/master-list-items/${id}`,
      input,
    ),
  );
  return data;
}

export async function deleteMasterListItem(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/sales-settings/master-list-items/${id}`),
  );
}
