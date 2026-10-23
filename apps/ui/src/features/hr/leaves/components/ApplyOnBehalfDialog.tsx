"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  EmployeePicker,
  type EmployeeOption,
} from "@/components/widgets/EmployeePicker";
import { leaveErrorMessage } from "../errors";
import { useCreateLeaveOnBehalf, useHrLeaveBalances } from "../hooks";
import { EMPTY_REQUEST_FORM, requestLeaveSchema } from "../schema";
import { DAY_PORTION_LABELS } from "../status";
import { DAY_PORTIONS } from "../types";

/**
 * HR applies for leave on an employee's behalf (POST /hr/leave-requests,
 * `hr.leave_request.create`). The employee picker lists only employees in the
 * caller's scope; the server re-checks scope and refuses HR's own record. The
 * request then waits for approval by someone else (Docs/HR_LEAVE.md §6.4).
 */
export function ApplyOnBehalfDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [values, setValues] = useState(EMPTY_REQUEST_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const balances = useHrLeaveBalances(employee?.id ?? null);
  const mutation = useCreateLeaveOnBehalf();
  const { toast } = useToast();
  const submitting = mutation.isPending;
  const types = balances.data ?? [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: Partial<Record<string, string>> = {};
    if (!employee) next.employee = "Select an employee";
    const result = requestLeaveSchema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") next[key] = issue.message;
      }
    }
    if (Object.keys(next).length > 0 || !result.success || !employee) {
      setErrors(next);
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync({ ...result.data, employeeId: employee.id });
      toast({
        title: `Leave applied for ${employee.fullName}`,
        description: "It now waits for approval.",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(
        leaveErrorMessage(
          err,
          "You don't have permission to apply for leave for this employee.",
        ),
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply leave for an employee"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Employee" required error={errors.employee}>
          {(f) => (
            <EmployeePicker
              {...f}
              value={employee}
              disabled={submitting}
              onChange={(e) => {
                setEmployee(e);
                setValues((v) => ({ ...v, leaveTypeId: 0 }));
              }}
            />
          )}
        </FormField>

        <FormField label="Leave type" required error={errors.leaveTypeId}>
          {(f) => (
            <Select
              {...f}
              value={values.leaveTypeId || ""}
              disabled={submitting || !employee || balances.isPending}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  leaveTypeId: Number(e.target.value),
                }))
              }
            >
              <option value="">
                {employee ? "Select a leave type" : "Select an employee first"}
              </option>
              {types.map((t) => (
                <option key={t.leaveTypeId} value={t.leaveTypeId}>
                  {t.name}
                  {t.isPaid && t.available !== null
                    ? ` (${t.available} days available)`
                    : t.isPaid
                      ? ""
                      : " (unpaid)"}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Start date" required error={errors.startDate}>
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.startDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, startDate: e.target.value }))
                }
              />
            )}
          </FormField>
          <FormField label="End date" required error={errors.endDate}>
            {(f) => (
              <Input
                {...f}
                type="date"
                align="right"
                invalid={f.invalid}
                value={values.endDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, endDate: e.target.value }))
                }
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Portion"
          error={errors.dayPortion}
          hint="A half-day must use the same start and end date."
        >
          {(f) => (
            <Select
              {...f}
              value={values.dayPortion}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  dayPortion: e.target.value as typeof v.dayPortion,
                }))
              }
            >
              {DAY_PORTIONS.map((p) => (
                <option key={p} value={p}>
                  {DAY_PORTION_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Reason"
          required
          error={errors.reason}
          hint="3–500 characters. The employee and approvers see it."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.reason}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, reason: e.target.value }))
              }
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not apply">
            {serverError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Apply leave
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
