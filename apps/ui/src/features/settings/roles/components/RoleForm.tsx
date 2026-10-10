"use client";

import {
  ApiError,
  createRoleSchema,
  type CreateRoleFormValues,
} from "@texawave-erp/core";
import { Button, Checkbox, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface RoleFormProps {
  initialValues?: { name?: string; isActive?: boolean };
  onSubmit: (
    values: CreateRoleFormValues & { isActive?: boolean },
  ) => Promise<void>;
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
export function RoleForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: RoleFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
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
      if (initialValues) {
        await onSubmit({ ...result.data, isActive });
      } else {
        await onSubmit(result.data);
      }
    } catch (err) {
      setSubmitError(
        ApiError.isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Role Name" required error={errors.name}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            value={name}
            placeholder="e.g. Finance Controller"
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {/* Status checkbox when editing an existing role */}
      {initialValues ? (
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={submitting}
          />
          <div className="flex flex-col">
            <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
              Active Role
            </span>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Inactive roles cannot be assigned to members and will not grant
              access
            </span>
          </div>
        </label>
      ) : null}

      {submitError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
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
