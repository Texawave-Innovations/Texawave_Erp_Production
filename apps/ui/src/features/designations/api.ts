import type {
  CreateDesignationInput,
  Designation,
  PaginatedEnvelope,
  QueryDesignationsInput,
  UpdateDesignationInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

const BASE = "/master-data/designations";

export function listDesignations(
  query: QueryDesignationsInput = {},
): Promise<PaginatedEnvelope<Designation>> {
  return withAuthRetry(() =>
    apiClient.get<Designation[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<Designation>>;
}

export async function createDesignation(
  input: CreateDesignationInput,
): Promise<Designation> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Designation>(BASE, input),
  );
  return data;
}

export async function updateDesignation(
  id: number,
  input: UpdateDesignationInput,
): Promise<Designation> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Designation>(`${BASE}/${id}`, input),
  );
  return data;
}

export async function setDesignationActive(
  id: number,
  isActive: boolean,
): Promise<Designation> {
  const action = isActive ? "activate" : "deactivate";
  const { data } = await withAuthRetry(() =>
    apiClient.post<Designation>(`${BASE}/${id}/${action}`),
  );
  return data;
}
