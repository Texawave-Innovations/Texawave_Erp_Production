"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  FormField,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  EmployeePicker,
  type EmployeeOption,
} from "@/components/widgets/EmployeePicker";
import { leaveErrorMessage } from "../errors";
import { useSetLeaveEntitlement } from "../hooks";
import { setEntitlementSchema } from "../schema";
import type { LeaveTypeItem } from "../types";

export interface SetEntitlementDialogProps {
  open: boolean;
  onClose: () => void;
  leaveType: Pick<LeaveTypeItem, "id" | "name">;
  /** Preset from the Allotment table; otherwise HR picks one. */
  employee?: EmployeeOption;
  year?: number;
  /** The entitlement shown today, to start editing from. */
  current?: number;
  /** Whether a custom override exists (enables "back to default"). */
  isOverride?: boolean;
}

const currentYear = () => new Date().getFullYear();

/**
 * Sets (or clears) one employee's annual entitlement for one leave type and
 * year — the production equivalent of legacy's per-employee "Leave
 * Allotment" override (TexaWave_ERP `LeaveAllotment.tsx`). Clearing keeps
 * history: the leave type default simply applies again (Docs/HR_LEAVE.md §5).
 */
export function SetEntitlementDialog({
  open,
  onClose,
  leaveType,
  employee: presetEmployee,
  year: presetYear,
  current,
  isOverride = false,
}: SetEntitlementDialogProps) {
  const [employee, setEmployee] = useState<EmployeeOption | null>(
    presetEmployee ?? null,
  );
  const [year, setYear] = useState(String(presetYear ?? currentYear()));
  const [clearOverride, setClearOverride] = useState(false);
  const [annualEntitlement, setAnnualEntitlement] = useState(
    String(current ?? 0),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useSetLeaveEntitlement();
  const { toast } = useToast();
  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = setEntitlementSchema.safeParse({
      employeeId: employee?.id ?? 0,
      year: Number(year),
      annualEntitlement: clearOverride ? null : Number(annualEntitlement),
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync({
        employeeId: result.data.employeeId,
        leaveTypeId: leaveType.id,
        year: result.data.year,
        annualEntitlement: result.data.annualEntitlement,
      });
      toast({
        title: clearOverride
          ? "Back to the leave type default"
          : "Entitlement saved",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(
        leaveErrorMessage(
          err,
          "You don't have permission to set leave entitlements.",
        ),
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Set entitlement — ${leaveType.name}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {presetEmployee ? (
          <p className="text-theme-sm text-gray-700 dark:text-gray-300">
            <strong>{presetEmployee.fullName}</strong> (
            {presetEmployee.employeeCode}) · {year}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Employee" required error={errors.employeeId}>
              {(f) => (
                <EmployeePicker
                  {...f}
                  value={employee}
                  disabled={submitting}
                  onChange={setEmployee}
                />
              )}
            </FormField>
            <FormField label="Year" required error={errors.year}>
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min="2000"
                  max="2200"
                  invalid={f.invalid}
                  value={year}
                  disabled={submitting}
                  onChange={(e) => setYear(e.target.value)}
                />
              )}
            </FormField>
          </div>
        )}

        <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={clearOverride}
            onChange={() => setClearOverride((prev) => !prev)}
            disabled={
              submitting || (presetEmployee !== undefined && !isOverride)
            }
          />
          <span>Use the leave type default (remove the custom value)</span>
        </label>

        {!clearOverride ? (
          <FormField
            label="Annual entitlement (days)"
            error={errors.annualEntitlement}
            hint="For this employee and year only. Up to one decimal."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min="0"
                max="366"
                step="0.5"
                invalid={f.invalid}
                value={annualEntitlement}
                disabled={submitting}
                onChange={(e) => setAnnualEntitlement(e.target.value)}
              />
            )}
          </FormField>
        ) : null}

        {serverError ? (
          <Alert variant="error" title="Could not save">
            {serverError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
