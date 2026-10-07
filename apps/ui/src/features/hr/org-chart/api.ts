import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { OrgChartNode } from "./types";

const BASE = "/hr/org-chart";

export interface OrgChartQuery {
  departmentId?: number;
  rootEmployeeId?: number;
  depth?: number;
}

export async function getOrgChart(
  query: OrgChartQuery = {},
): Promise<OrgChartNode[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<OrgChartNode[]>(BASE, { query }),
  );
  return data;
}
