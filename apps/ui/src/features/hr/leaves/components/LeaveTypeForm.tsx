"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import {
  createLeaveTypeSchema,
  type CreateLeaveTypeFormValues,
  updateLeaveTypeSchema,
  type UpdateLeaveTypeFormValues,
} from "../schema";

export interface LeaveTypeFormProps {
  initialValues?: Partial<CreateLeaveTypeFormValues>;
  /** Code is immutable after creation (Docs: "Immutable once created"), so
   * the edit form does not show it — mirrors DesignationForm. */
  mode: "create" | "edit";
  onSubmit: (
    values: CreateLeaveTypeFormValues | UpdateLeaveTypeFormValues,
  ) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Create/edit a leave type (Casual, Sick, …). Mirrors
 * features/designations/components/DesignationForm.tsx. Backend:
 * apps/api/.../leave-types/dto/{create,update}-leave-type.dto.ts. */
export function LeaveTypeForm({
  initialValues,
  mode,
  onSubmit,
  onCancel,
  submitLabel,
}: LeaveTypeFormProps) {
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [isPaid, setIsPaid] = useState(initialValues?.isPaid ?? true);
  const [annualEntitlement, setAnnualEntitlement] = useState(
    String(initialValues?.annualEntitlement ?? 0),
  );
  const [carryForwardLimit, setCarryForwardLimit] = useState(
    String(initialValues?.carryForwardLimit ?? 0),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      ...(mode === "create" ? { code } : {}),
      name,
      description,
      isPaid,
      annualEntitlement: Number(annualEntitlement) || 0,
      carryForwardLimit: Number(carryForwardLimit) || 0,
    };
    const schema =
      mode === "create" ? createLeaveTypeSchema : updateLeaveTypeSchema;
    const result = schema.safeParse(values);

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
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError(
        "Could not save this leave type. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "create" ? (
        <FormField
          label="Code"
          required
          error={errors.code}
          hint="Upper-case letters, digits or underscore. Cannot be changed later."
        >
          {(f) => (
            <Input
              {...f}
              invalid={f.invalid}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      ) : null}

      <FormField label="Name" required error={errors.name}>
        {(f) => (
          <Input
            {...f}
            invalid={f.invalid}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField
        label="Description"
        error={errors.description}
        hint="Optional. Send empty to clear."
      >
        {(f) => (
          <Textarea
            {...f}
            rows={2}
            invalid={f.invalid}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
        <Checkbox
          checked={isPaid}
          onChange={() => setIsPaid((prev) => !prev)}
          disabled={submitting}
        />
        <span>Paid (draws on the balance; unpaid leave is not limited)</span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Annual entitlement (days)"
          error={errors.annualEntitlement}
          hint="Default entitlement; accrued 1/12 per credited month."
        >
          {(f) => (
            <Input
              {...f}
              type="number"
              min="0"
              max="366"
              invalid={f.invalid}
              value={annualEntitlement}
              onChange={(e) => setAnnualEntitlement(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField
          label="Carry-forward limit (days)"
          error={errors.carryForwardLimit}
          hint="Unused days above this cap are forfeited at year end."
        >
          {(f) => (
            <Input
              {...f}
              type="number"
              min="0"
              max="366"
              invalid={f.invalid}
              value={carryForwardLimit}
              onChange={(e) => setCarryForwardLimit(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      {submitError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
