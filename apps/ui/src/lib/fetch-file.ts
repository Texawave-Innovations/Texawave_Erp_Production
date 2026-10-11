import { useAuthStore } from "@/stores/auth-store";

/**
 * apiClient only parses JSON, so CSV/PDF downloads go through fetch with the
 * same bearer token and base URL. A failed request surfaces the API's own
 * message. (features/hr/employees/api.ts has an older private copy of this.)
 */
export async function fetchFile(path: string): Promise<Blob> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(message ?? `Download failed (status ${res.status})`);
  }
  return res.blob();
}
