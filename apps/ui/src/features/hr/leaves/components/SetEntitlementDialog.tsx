"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Checkbox,
  Dialog,
  FormField,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
import { useSetLeaveEntitlement } from "../hooks";
import { setEntitlementSchema } from "../schema";
import type { LeaveTypeItem } from "../types";

export interface SetEntitlementDialogProps {
  open: boolean;
  onClose: () => void;
  leaveType: Pick<LeaveTypeItem, "id" | "name">;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to set leave entitlements.";
    }
    if (error.errorCode === "INVALID_EMPLOYEE") {
      return "No employee with that ID was found in your organization.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

const currentYear = () => new Date().getFullYear();

/**
 * Sets (or clears) one employee's annual entitlement for one leave type and
 * year — the production equivalent of legacy's per-employee "Leave
 * Allotment" override (TexaWave_ERP `LeaveAllotment.tsx`: Casual/Sick/
 * Privilege/Compensation quota editing). There is deliberately no employee
 * picker component in this codebase (ApprovalsSection above filters by a
 * plain numeric employee ID too); HR looks up the ID from the Employees list.
 */
export function SetEntitlementDialog({
  open,
  onClose,
  leaveType,
}: SetEntitlementDialogProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(String(currentYear()));
  const [clearOverride, setClearOverride] = useState(false);
  const [annualEntitlement, setAnnualEntitlement] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useSetLeaveEntitlement();
  const { toast } = useToast();

  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = setEntitlementSchema.safeParse({
      employeeId: Number(employeeId),
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
          ? "Entitlement override cleared — the leave type default applies again"
          : "Entitlement override saved",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Set entitlement — ${leaveType.name}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Employee ID" required error={errors.employeeId}>
            {(f) => (
              <Input
                {...f}
                type="number"
                min="1"
                invalid={f.invalid}
                value={employeeId}
                disabled={submitting}
                onChange={(e) => setEmployeeId(e.target.value)}
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

        <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={clearOverride}
            onChange={() => setClearOverride((prev) => !prev)}
            disabled={submitting}
          />
          <span>Clear override (the leave type default applies again)</span>
        </label>

        {!clearOverride ? (
          <FormField
            label="Annual entitlement (days)"
            error={errors.annualEntitlement}
            hint="Overrides the leave type default for this employee and year only."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min="0"
                max="366"
                invalid={f.invalid}
                value={annualEntitlement}
                disabled={submitting}
                onChange={(e) => setAnnualEntitlement(e.target.value)}
              />
            )}
          </FormField>
        ) : null}

        {serverError ? (
          <p
            role="alert"
            className="text-theme-xs text-error-600 dark:text-error-400"
          >
            {serverError}
          </p>
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
