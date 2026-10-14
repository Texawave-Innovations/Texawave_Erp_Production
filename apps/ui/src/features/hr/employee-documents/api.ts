import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface EmployeeDocumentRow {
  id: number;
  employeeId: number;
  documentType: string;
  label: string | null;
  source: "ONBOARDING" | "HR_UPLOADED";
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}

const base = (employeeId: number) => `/hr/employees/${employeeId}/documents`;

export function listEmployeeDocuments(
  employeeId: number,
): Promise<EmployeeDocumentRow[]> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeDocumentRow[]>(base(employeeId)),
  ).then((res) => res.data);
}

/** Multipart upload — field name `label` plus `file`, mirroring the
 * onboarding upload in features/onboarding/api.ts. */
export function uploadEmployeeDocument(
  employeeId: number,
  label: string,
  file: File,
): Promise<EmployeeDocumentRow> {
  const formData = new FormData();
  formData.append("label", label);
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request<EmployeeDocumentRow>(base(employeeId), {
      method: "POST",
      formData,
    }),
  ).then((res) => res.data);
}

export function removeEmployeeDocument(
  employeeId: number,
  id: number,
): Promise<void> {
  return withAuthRetry(() =>
    apiClient.delete(`${base(employeeId)}/${id}`),
  ).then(() => undefined);
}

/** apiClient only parses JSON, so the binary download goes through fetch
 * directly, reusing the same bearer token and base URL. Triggers a normal
 * browser save via a throwaway object URL + anchor click. */
export async function downloadEmployeeDocument(
  employeeId: number,
  id: number,
  fileName: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${baseUrl}${base(employeeId)}/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
