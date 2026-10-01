"use client";

import {
  createDepartmentSchema,
  type CreateDepartmentFormValues,
} from "@texawave-erp/core";
import { Button, Checkbox, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface DepartmentFormProps {
  initialValues?: Partial<CreateDepartmentFormValues>;
  onSubmit: (values: CreateDepartmentFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function DepartmentForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: DepartmentFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createDepartmentSchema.safeParse({
      name,
      isActive,
      customFields: initialValues?.customFields ?? {},
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
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError(
        "Could not save this department. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Department Name" required error={errors.name}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
        <Checkbox
          checked={isActive}
          onChange={() => setIsActive((prev) => !prev)}
          disabled={submitting}
        />
        <span>Active</span>
      </label>

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
