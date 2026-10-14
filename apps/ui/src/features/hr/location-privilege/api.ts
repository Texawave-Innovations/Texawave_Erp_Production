import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  EmployeeLocationPrivilege,
  LocationMode,
  OfficeNetwork,
  SetEmployeeLocationPrivilegeResult,
} from "./types";

const PRIVILEGE_BASE = "/hr/location-privileges/employees";
const NETWORK_BASE = "/hr/office-networks";

export async function getEmployeeLocationPrivilege(
  employeeId: number,
): Promise<EmployeeLocationPrivilege> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<EmployeeLocationPrivilege>(`${PRIVILEGE_BASE}/${employeeId}`),
  );
  return data;
}

export async function setEmployeeLocationPrivilege(
  employeeId: number,
  mode: LocationMode,
): Promise<SetEmployeeLocationPrivilegeResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<SetEmployeeLocationPrivilegeResult>(
      `${PRIVILEGE_BASE}/${employeeId}`,
      { mode },
    ),
  );
  return data;
}

/** Office networks are not paginated by the API (a flat organization list). */
export async function listOfficeNetworks(): Promise<OfficeNetwork[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<OfficeNetwork[]>(NETWORK_BASE),
  );
  return data;
}

export async function addOfficeNetwork(body: {
  ipAddress: string;
  label?: string;
}): Promise<OfficeNetwork> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<OfficeNetwork>(NETWORK_BASE, body),
  );
  return data;
}

export async function setOfficeNetworkActive(
  id: number,
  isActive: boolean,
): Promise<OfficeNetwork> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<OfficeNetwork>(`${NETWORK_BASE}/${id}`, { isActive }),
  );
  return data;
}
