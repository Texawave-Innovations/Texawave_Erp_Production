import type {
  CommitCrmImportInput,
  CommitCrmImportResult,
  CrmCustomFieldDef,
  CrmCustomFieldModule,
  CrmExportEntity,
  CrmExportResult,
  CrmImportEntity,
  CrmImportFieldsResponse,
  CrmMatchHeadersResponse,
  QueryCrmExportInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Routes confirmed from
 * apps/api/src/modules/crm/bulk-import/bulk-import.controller.ts. */
export async function getImportFields(
  entity: CrmImportEntity,
): Promise<CrmImportFieldsResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmImportFieldsResponse>(`/crm/import/${entity}/fields`),
  );
  return data;
}

export async function matchImportHeaders(
  entity: CrmImportEntity,
  headers: string[],
): Promise<CrmMatchHeadersResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmMatchHeadersResponse>(
      `/crm/import/${entity}/match-headers`,
      { headers },
    ),
  );
  return data;
}

export async function commitImport(
  entity: CrmImportEntity,
  input: CommitCrmImportInput,
): Promise<CommitCrmImportResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CommitCrmImportResult>(
      `/crm/import/${entity}/commit`,
      input,
    ),
  );
  return data;
}

export async function exportEntity(
  entity: CrmExportEntity,
  query: QueryCrmExportInput,
): Promise<CrmExportResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmExportResult>(`/crm/import/${entity}/export`, { query }),
  );
  return data;
}

export async function listCustomFields(
  module?: CrmCustomFieldModule,
): Promise<CrmCustomFieldDef[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmCustomFieldDef[]>("/crm/custom-fields", {
      query: module ? { module } : {},
    }),
  );
  return data;
}
