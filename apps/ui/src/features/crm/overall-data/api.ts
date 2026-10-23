import type {
  CrmOverallActivityRecord,
  CrmOverallDataMonth,
  QueryCrmOverallDataInput,
  QueryCrmOverallDataRecordsInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Routes confirmed from
 * apps/api/src/modules/crm/overall-data/overall-data.controller.ts. */
export async function getOverallDataMonth(
  query: QueryCrmOverallDataInput,
): Promise<CrmOverallDataMonth> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmOverallDataMonth>("/crm/overall-data", { query }),
  );
  return data;
}

export async function getOverallDataRecords(
  query: QueryCrmOverallDataRecordsInput,
): Promise<CrmOverallActivityRecord[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmOverallActivityRecord[]>("/crm/overall-data/records", {
      query,
    }),
  );
  return data;
}
