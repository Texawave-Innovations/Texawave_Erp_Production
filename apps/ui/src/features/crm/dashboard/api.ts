import type { CrmDashboard } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Route confirmed from apps/api/src/modules/crm/dashboard/dashboard.controller.ts. */
export async function getCrmDashboard(): Promise<CrmDashboard> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmDashboard>("/crm/dashboard"),
  );
  return data;
}
