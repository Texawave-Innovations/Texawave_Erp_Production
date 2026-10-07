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
import { CORRECTIONS, STATUS_LABELS, TRANSITIONS } from "../status";
import { useChangeEmployeeStatus } from "../hooks";
import {
  statusChangeSchema,
  statusTargetAllowed,
  type StatusChangeValues,
} from "../schema";
import type { EmployeeDetail, EmployeeStatus } from "../types";
import { describeSaveError } from "./EmployeeForm";

export interface ChangeStatusDialogProps {
  open: boolean;
  onClose: () => void;
  employee: Pick<EmployeeDetail, "id" | "fullName" | "status">;
  /** RESIGNED/TERMINATED use the separately permissioned correction endpoint. */
  correction: boolean;
}

const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/**
 * Only the targets the lifecycle allows from the current status are offered.
 * The backend re-checks every change and refuses anything else (422).
 */
export function ChangeStatusDialog({
  open,
  onClose,
  employee,
  correction,
}: ChangeStatusDialogProps) {
  const targets = correction
    ? CORRECTIONS[employee.status]
    : TRANSITIONS[employee.status];
  const [values, setValues] = useState({
    status: targets[0] ?? "",
    effectiveDate: today(),
    reason: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof StatusChangeValues, string>>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useChangeEmployeeStatus();
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!statusTargetAllowed(targets, values.status)) {
      setErrors({ status: "Choose a status" });
      return;
    }
    const result = statusChangeSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<keyof StatusChangeValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string")
          next[key as keyof StatusChangeValues] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: employee.id,
        correction,
        body: result.data,
      });
      toast({
        title: `Status changed to ${STATUS_LABELS[result.data.status as EmployeeStatus]}`,
        variant: "success",
      });
      onClose();
    } catch (error) {
      setServerError(describeSaveError(error).message);
    }
  }

  const submitting = mutation.isPending;
  const title = correction
    ? "Correct employment status"
    : "Change employment status";

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {targets.length === 0 ? (
        <Alert variant="info" title="No status changes available">
          {employee.fullName} is {STATUS_LABELS[employee.status]}. No further
          changes are allowed from this status.
        </Alert>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            {employee.fullName} is currently{" "}
            <strong>{STATUS_LABELS[employee.status]}</strong>.
            {correction
              ? " Corrections are audited and need a reason."
              : " The change is recorded in the status history."}
          </p>
          <FormField label="New status" required error={errors.status}>
            {(f) => (
              <Select
                {...f}
                value={values.status}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    status: e.target.value as EmployeeStatus,
                  }))
                }
              >
                {targets.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label={
              values.status === "RESIGNED" || values.status === "TERMINATED"
                ? "Last working day"
                : "Effective date"
            }
            required
            error={errors.effectiveDate}
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.effectiveDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, effectiveDate: e.target.value }))
                }
              />
            )}
          </FormField>
          <FormField
            label="Reason"
            required
            error={errors.reason}
            hint="3–500 characters. Kept in the status history."
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
              Save status
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
