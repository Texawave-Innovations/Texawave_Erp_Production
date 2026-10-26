"use client";

import { ApiError } from "@texawave-erp/core";
import { MasterListCard, useToast } from "@texawave-erp/ui-kit";
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

const PAGE_SIZE = 50;

/** Departments — the one resource without a `code` field; `MasterDataService`
 * hard-deletes (soft-delete under the hood) on chip removal instead of
 * deactivating. */
function DepartmentsCard() {
  const canRead = usePermission(DEPARTMENT_READ);
  const canWrite = usePermission(DEPARTMENT_WRITE);
  const { toast } = useToast();

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
      toast({ title: "Department added", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${DEPARTMENT_WRITE} permission.`
            : "Could not add this department",
        variant: "error",
      });
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deleteMutation.mutateAsync(Number(id));
      toast({ title: "Department removed", variant: "success" });
    } catch {
      toast({ title: `Could not remove "${label}"`, variant: "error" });
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
  const { toast } = useToast();

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
      toast({ title: "Designation added", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${DESIGNATION_WRITE} permission.`
            : "Could not add this designation",
        variant: "error",
      });
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      toast({ title: "Designation removed", variant: "success" });
    } catch {
      toast({ title: `Could not remove "${label}"`, variant: "error" });
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
  const { toast } = useToast();

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
      toast({ title: "Office location added", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${WORK_LOCATION_WRITE} permission.`
            : "Could not add this office location",
        variant: "error",
      });
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      toast({ title: "Office location removed", variant: "success" });
    } catch {
      toast({ title: `Could not remove "${label}"`, variant: "error" });
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
  const { toast } = useToast();

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
      toast({ title: "Leave type added", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${LEAVE_TYPE_WRITE} permission.`
            : "Could not add this leave type",
        variant: "error",
      });
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      toast({ title: "Leave type removed", variant: "success" });
    } catch {
      toast({ title: `Could not remove "${label}"`, variant: "error" });
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
  const { toast } = useToast();

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
      toast({ title: "Shift added", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${SHIFT_WRITE} permission.`
            : "Could not add this shift",
        variant: "error",
      });
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deactivateMutation.mutateAsync({ id: Number(id), isActive: false });
      toast({ title: "Shift removed", variant: "success" });
    } catch {
      toast({ title: `Could not remove "${label}"`, variant: "error" });
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
    </div>
  );
}
