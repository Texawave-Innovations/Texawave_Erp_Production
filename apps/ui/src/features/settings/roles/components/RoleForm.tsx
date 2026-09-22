"use client";

import {
  createRoleSchema,
  type CreateRoleFormValues,
} from "@texawave-erp/core";
import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface RoleFormProps {
  onSubmit: (values: CreateRoleFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/**
 * Validates client-side with the same zod schema the mutation payload has to
 * satisfy server-side (`createRoleSchema`, packages/core) — mirrors
 * apps/ui/src/features/_reference/tags/components/TagForm.tsx. Entered
 * values are kept on a failed submit (Docs/DESIGN_SYSTEM.md "Preserve
 * entered form values when submission fails").
 */
export function RoleForm({ onSubmit, onCancel, submitLabel }: RoleFormProps) {
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createRoleSchema.safeParse({ name });
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
        "Could not save this role. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Name" required error={errors.name}>
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
