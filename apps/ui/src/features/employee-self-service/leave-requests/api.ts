import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface MyLeaveRequest {
  id: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  dayPortion: string;
  reason: string;
  status: string;
  /** "HR" when a two-level request has its first approval (Docs/HR_LEAVE.md §6.1). */
  awaiting?: "FIRST" | "HR" | null;
  createdAt: string;
}

export interface LeaveType {
  id: number;
  name: string;
}

export interface CreateLeaveRequestInput {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function listMyLeaveRequests(): Promise<MyLeaveRequest[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MyLeaveRequest[]>("/self-service/leave-requests", {
      query: { limit: 50 },
    }),
  );
  return data;
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  try {
    const { data } = await withAuthRetry(() =>
      apiClient.get<Array<{ leaveTypeId?: number; id?: number; name: string }>>(
        "/self-service/leave-requests/balances",
      ),
    );
    if (Array.isArray(data) && data.length > 0) {
      return data.map((b) => ({
        id: (b.leaveTypeId ?? b.id) as number,
        name: b.name,
      }));
    }
  } catch {
    // fallback
  }
  try {
    const { data } = await withAuthRetry(() =>
      apiClient.get<LeaveType[]>("/hr/leave-types", { query: { limit: 100 } }),
    );
    return data;
  } catch {
    return [];
  }
}

export async function createMyLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<MyLeaveRequest> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MyLeaveRequest>("/self-service/leave-requests", input),
  );
  return data;
}

export async function cancelMyLeaveRequest(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.post(`/self-service/leave-requests/${id}/cancel`, {}),
  );
}
