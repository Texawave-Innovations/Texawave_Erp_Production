import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Mirrors apps/api .../exit-requests.repository.ts ExitRequestView. */
export interface MyExitRequest {
  id: number;
  reason: string;
  preferredLastWorkingDate: string;
  noticePeriodDays: number;
  additionalNotes: string | null;
  confirmedLastWorkingDate: string | null;
  settlementStatus: string | null;
  hrNote: string | null;
  status: string;
  createdAt: string;
}

export interface CreateExitRequestInput {
  reason: string;
  preferredLastWorkingDate: string;
  noticePeriodDays?: number;
  additionalNotes?: string;
}

export async function listMyExitRequests(): Promise<MyExitRequest[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyExitRequest[]>("/self-service/exit-requests", {
      query: { limit: 50 },
    }),
  );
  return data;
}

export async function createMyExitRequest(
  input: CreateExitRequestInput,
): Promise<MyExitRequest> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyExitRequest>("/self-service/exit-requests", input),
  );
  return data;
}
