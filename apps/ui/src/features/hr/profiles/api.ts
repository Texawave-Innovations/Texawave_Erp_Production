import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { EmployeeProfileView, EmployeeSensitiveView } from "./types";

const BASE = "/hr/employees";

export async function getProfile(id: number): Promise<EmployeeProfileView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeProfileView>(`${BASE}/${id}/profile`),
  );
  return data;
}

/** Partial update: only the keys in `body` change. `null` clears a field. */
export async function updateProfile(
  id: number,
  body: Record<string, unknown>,
): Promise<EmployeeProfileView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<EmployeeProfileView>(`${BASE}/${id}/profile`, body),
  );
  return data;
}

export async function getSensitive(id: number): Promise<EmployeeSensitiveView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeSensitiveView>(`${BASE}/${id}/sensitive`),
  );
  return data;
}

/** Partial update of statutory and bank details. Same `null`-clears semantics. */
export async function updateSensitive(
  id: number,
  body: Record<string, unknown>,
): Promise<EmployeeSensitiveView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<EmployeeSensitiveView>(`${BASE}/${id}/sensitive`, body),
  );
  return data;
}
