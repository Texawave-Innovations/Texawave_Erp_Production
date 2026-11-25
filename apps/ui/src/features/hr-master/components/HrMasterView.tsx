"use client";

import { ApiError } from "@texawave-erp/core";
import { MasterListCard } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
} from "@/features/departments/hooks";
import {
  useCreateDesignation,
  useDesignations,
  useSetDesignationActive,
} from "@/features/designations/hooks";
import { deriveCode } from "../utils";
import {
  DEPARTMENT_READ,
  DEPARTMENT_WRITE,
  DESIGNATION_READ,
  DESIGNATION_WRITE,
  LEAVE_TYPE_READ,
  LEAVE_TYPE_WRITE,
  SHIFT_READ,
  SHIFT_WRITE,
  WORK_LOCATION_READ,
  WORK_LOCATION_WRITE,
} from "../permissions";
import {
  useCreateLeaveType,
  useCreateShift,
  useCreateWorkLocation,
  useLeaveTypes,
  useSetLeaveTypeActive,
  useSetShiftActive,
  useSetWorkLocationActive,
  useShifts,
  useWorkLocations,
} from "../hooks";

import { AutoCheckoutCard } from "./AutoCheckoutCard";

const PAGE_SIZE = 50;

/** Departments — the one resource without a `code` field; `MasterDataService`
 * hard-deletes (soft-delete under the hood) on chip removal instead of
 * deactivating. */
function DepartmentsCard() {
  const canRead = usePermission(DEPARTMENT_READ);
  const canWrite = usePermission(DEPARTMENT_WRITE);
  const { notify } = useNotify();

  const query = useDepartments({ page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateDepartment();
  const deleteMutation = useDeleteDepartment();

  const items = (query.data?.data ?? []).map((d) => ({
    id: d.id,
    label: d.name,
  }));

  async function handleAdd(value: string) {
    try {
      await createMutation.mutateAsync({ name: value });
      notify("hr.master.departmentAdded");
    } catch (error) {
      notify(
        error instanceof ApiError && error.isPermissionError
          ? "hr.master.permissionMissing"
          : "hr.master.departmentAddFailed",
        { permission: DEPARTMENT_WRITE },
      );
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deleteMutation.mutateAsync(Number(id));
      notify("hr.master.departmentRemoved");
    } catch {
      notify("hr.master.removeFailed", { name: label });
    }
  }

  return (
    <MasterListCard
      title="Departments"
      items={items}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      canRead={canRead}
      canWrite={canWrite}
      readPermissionCode={DEPARTMENT_READ}
      writePermissionCode={DEPARTMENT_WRITE}
      isSubmitting={createMutation.isPending}
      onAdd={handleAdd}
      onDelete={handleDelete}
    />
  );
}

function DesignationsCard() {
  const canRead = usePermission(DESIGNATION_READ);
  const canWrite = usePermission(DESIGNATION_WRITE);
  const { notify } = useNotify();

  const query = useDesignations({ page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateDesignation();
  const deactivateMutation = useSetDesignationActive();

  const items = (query.data?.data ?? [])
    .filter((d) => d.isActive)
    .map((d) => ({ id: d.id, label: d.name }));

  async function handleAdd(value: string) {
    try {
      await createMutation.mutateAsync({
        code: deriveCode(value),
        name: value,
      });
      notify("hr.master.designationAdded");
    } catch (error) {
      notify(
        error instanceof ApiError && error.isPermissionError
          ? "hr.master.permissionMissing"
          : "hr.master.designationAddFailed",
        { permission: DESIGNATION_WRITE },
      );
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      notify("hr.master.designationRemoved");
    } catch {
      notify("hr.master.removeFailed", { name: label });
    }
  }

  return (
    <MasterListCard
      title="Designations"
      items={items}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      canRead={canRead}
      canWrite={canWrite}
      readPermissionCode={DESIGNATION_READ}
      writePermissionCode={DESIGNATION_WRITE}
      isSubmitting={createMutation.isPending}
      onAdd={handleAdd}
      onDelete={handleDelete}
    />
  );
}

function OfficeLocationsCard() {
  const canRead = usePermission(WORK_LOCATION_READ);
  const canWrite = usePermission(WORK_LOCATION_WRITE);
  const { notify } = useNotify();

  const query = useWorkLocations({ page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateWorkLocation();
  const deactivateMutation = useSetWorkLocationActive();

  const items = (query.data?.data ?? [])
    .filter((l) => l.isActive)
    .map((l) => ({ id: l.id, label: l.name }));

  async function handleAdd(value: string) {
    try {
      await createMutation.mutateAsync({
        code: deriveCode(value),
        name: value,
      });
      notify("hr.master.locationAdded");
    } catch (error) {
      notify(
        error instanceof ApiError && error.isPermissionError
          ? "hr.master.permissionMissing"
          : "hr.master.locationAddFailed",
        { permission: WORK_LOCATION_WRITE },
      );
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      notify("hr.master.locationRemoved");
    } catch {
      notify("hr.master.removeFailed", { name: label });
    }
  }

  return (
    <MasterListCard
      title="Office Locations"
      items={items}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      canRead={canRead}
      canWrite={canWrite}
      readPermissionCode={WORK_LOCATION_READ}
      writePermissionCode={WORK_LOCATION_WRITE}
      isSubmitting={createMutation.isPending}
      onAdd={handleAdd}
      onDelete={handleDelete}
    />
  );
}

function LeaveTypesCard() {
  const canRead = usePermission(LEAVE_TYPE_READ);
  const canWrite = usePermission(LEAVE_TYPE_WRITE);
  const { notify } = useNotify();

  const query = useLeaveTypes({ page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateLeaveType();
  const deactivateMutation = useSetLeaveTypeActive();

  const items = (query.data?.data ?? [])
    .filter((l) => l.isActive)
    .map((l) => ({ id: l.id, label: l.name }));

  async function handleAdd(value: string) {
    try {
      await createMutation.mutateAsync({
        code: deriveCode(value),
        name: value,
      });
      notify("hr.master.leaveTypeAdded");
    } catch (error) {
      notify(
        error instanceof ApiError && error.isPermissionError
          ? "hr.master.permissionMissing"
          : "hr.master.leaveTypeAddFailed",
        { permission: LEAVE_TYPE_WRITE },
      );
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      notify("hr.master.leaveTypeRemoved");
    } catch {
      notify("hr.master.removeFailed", { name: label });
    }
  }

  return (
    <MasterListCard
      title="Leave Types"
      items={items}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      canRead={canRead}
      canWrite={canWrite}
      readPermissionCode={LEAVE_TYPE_READ}
      writePermissionCode={LEAVE_TYPE_WRITE}
      isSubmitting={createMutation.isPending}
      onAdd={handleAdd}
      onDelete={handleDelete}
    />
  );
}

/** Shifts require `startTime`/`endTime`/`workingMinutes` that a single
 * chip-add text input can't collect. Judgment call (flagged for review):
 * new shifts are created with a fixed default window (09:00-18:00, 480
 * minutes) from just the entered name; editing the actual times needs a
 * dedicated form, which is out of scope for this chip-list screen. */
const DEFAULT_SHIFT_START = "09:00";
const DEFAULT_SHIFT_END = "18:00";
const DEFAULT_SHIFT_WORKING_MINUTES = 480;

function ShiftsCard() {
  const canRead = usePermission(SHIFT_READ);
  const canWrite = usePermission(SHIFT_WRITE);
  const { notify } = useNotify();

  const query = useShifts({ page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateShift();
  const deactivateMutation = useSetShiftActive();

  const items = (query.data?.data ?? [])
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, label: s.name }));

  async function handleAdd(value: string) {
    try {
      await createMutation.mutateAsync({
        code: deriveCode(value),
        name: value,
        startTime: DEFAULT_SHIFT_START,
        endTime: DEFAULT_SHIFT_END,
        workingMinutes: DEFAULT_SHIFT_WORKING_MINUTES,
      });
      notify("hr.master.shiftAdded");
    } catch (error) {
      notify(
        error instanceof ApiError && error.isPermissionError
          ? "hr.master.permissionMissing"
          : "hr.master.shiftAddFailed",
        { permission: SHIFT_WRITE },
      );
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      notify("hr.master.shiftRemoved");
    } catch {
      notify("hr.master.removeFailed", { name: label });
    }
  }

  return (
    <MasterListCard
      title="Shifts"
      items={items}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      canRead={canRead}
      canWrite={canWrite}
      readPermissionCode={SHIFT_READ}
      writePermissionCode={SHIFT_WRITE}
      isSubmitting={createMutation.isPending}
      onAdd={handleAdd}
      onDelete={handleDelete}
      emptyDescription="Add a shift below (default 09:00–18:00, 480 min — edit times from the Shifts admin screen)."
    />
  );
}

/** "HR Master" screen: five reference/code-table cards (Departments,
 * Designations, Office Locations, Leave Types, Shifts). Employee Status is
 * intentionally out of scope. */
export function HrMasterView() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <DepartmentsCard />
      <DesignationsCard />
      <OfficeLocationsCard />
      <LeaveTypesCard />
      <ShiftsCard />
      <AutoCheckoutCard />
    </div>
  );
}
