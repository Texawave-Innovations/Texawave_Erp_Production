import type {
  CreateLeaveTypeInput,
  CreateShiftInput,
  CreateWorkLocationInput,
  LeaveType,
  PaginatedEnvelope,
  QueryLeaveTypesInput,
  QueryShiftsInput,
  QueryWorkLocationsInput,
  Shift,
  UpdateLeaveTypeInput,
  UpdateShiftInput,
  UpdateWorkLocationInput,
  WorkLocation,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` for the three HR Master
 * resources that had no frontend yet. Departments and Designations already
 * have API wrappers (apps/ui/src/features/departments/api.ts,
 * apps/ui/src/features/designations/api.ts) and are reused as-is from
 * ./hooks.ts rather than duplicated here.
 */

// --- Office locations (master-data/work-locations) ---
const WORK_LOCATIONS_BASE = "/master-data/work-locations";

export function listWorkLocations(
  query: QueryWorkLocationsInput = {},
): Promise<PaginatedEnvelope<WorkLocation>> {
  return withAuthRetry(() =>
    apiClient.get<WorkLocation[]>(WORK_LOCATIONS_BASE, { query }),
  ) as Promise<PaginatedEnvelope<WorkLocation>>;
}

export async function createWorkLocation(
  input: CreateWorkLocationInput,
): Promise<WorkLocation> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<WorkLocation>(WORK_LOCATIONS_BASE, input),
  );
  return data;
}

export async function updateWorkLocation(
  id: number,
  input: UpdateWorkLocationInput,
): Promise<WorkLocation> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<WorkLocation>(`${WORK_LOCATIONS_BASE}/${id}`, input),
  );
  return data;
}

export async function setWorkLocationActive(
  id: number,
  isActive: boolean,
): Promise<WorkLocation> {
  const action = isActive ? "activate" : "deactivate";
  const { data } = await withAuthRetry(() =>
    apiClient.post<WorkLocation>(`${WORK_LOCATIONS_BASE}/${id}/${action}`),
  );
  return data;
}

// --- Leave types (hr/leave-types) ---
const LEAVE_TYPES_BASE = "/hr/leave-types";

export function listLeaveTypes(
  query: QueryLeaveTypesInput = {},
): Promise<PaginatedEnvelope<LeaveType>> {
  return withAuthRetry(() =>
    apiClient.get<LeaveType[]>(LEAVE_TYPES_BASE, { query }),
  ) as Promise<PaginatedEnvelope<LeaveType>>;
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
): Promise<LeaveType> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveType>(LEAVE_TYPES_BASE, input),
  );
  return data;
}

export async function updateLeaveType(
  id: number,
  input: UpdateLeaveTypeInput,
): Promise<LeaveType> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<LeaveType>(`${LEAVE_TYPES_BASE}/${id}`, input),
  );
  return data;
}

export async function setLeaveTypeActive(
  id: number,
  isActive: boolean,
): Promise<LeaveType> {
  const action = isActive ? "activate" : "deactivate";
  const { data } = await withAuthRetry(() =>
    apiClient.post<LeaveType>(`${LEAVE_TYPES_BASE}/${id}/${action}`),
  );
  return data;
}

// --- Shifts (master-data/shifts) ---
const SHIFTS_BASE = "/master-data/shifts";

export function listShifts(
  query: QueryShiftsInput = {},
): Promise<PaginatedEnvelope<Shift>> {
  return withAuthRetry(() =>
    apiClient.get<Shift[]>(SHIFTS_BASE, { query }),
  ) as Promise<PaginatedEnvelope<Shift>>;
}

export async function createShift(input: CreateShiftInput): Promise<Shift> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Shift>(SHIFTS_BASE, input),
  );
  return data;
}

export async function updateShift(
  id: number,
  input: UpdateShiftInput,
): Promise<Shift> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Shift>(`${SHIFTS_BASE}/${id}`, input),
  );
  return data;
}

export async function setShiftActive(
  id: number,
  isActive: boolean,
): Promise<Shift> {
  const action = isActive ? "activate" : "deactivate";
  const { data } = await withAuthRetry(() =>
    apiClient.post<Shift>(`${SHIFTS_BASE}/${id}/${action}`),
  );
  return data;
}
