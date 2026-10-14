"use client";

import {
  createDesignationSchema,
  type CreateDesignationFormValues,
} from "@texawave-erp/core";
import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface DesignationFormProps {
  initialValues?: Partial<CreateDesignationFormValues>;
  /** Code is immutable after creation, so the edit form does not show it. */
  mode: "create" | "edit";
  onSubmit: (values: CreateDesignationFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function DesignationForm({
  initialValues,
  mode,
  onSubmit,
  onCancel,
  submitLabel,
}: DesignationFormProps) {
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createDesignationSchema.safeParse({
      code: mode === "create" ? code : (initialValues?.code ?? ""),
      name,
      description,
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
        "Could not save this designation. Check the fields above and try again.",
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
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      ) : null}

      <FormField label="Designation name" required error={errors.name}>
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

      <FormField label="Description" error={errors.description}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
