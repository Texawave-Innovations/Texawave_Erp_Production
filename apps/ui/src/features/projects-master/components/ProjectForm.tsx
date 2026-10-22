"use client";

import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { createProjectSchema, type CreateProjectFormValues } from "../schema";

export interface ProjectFormProps {
  initialValues?: Partial<CreateProjectFormValues>;
  onSubmit: (values: CreateProjectFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/**
 * Validates client-side with the same zod schema the mutation payload has to
 * satisfy server-side. Entered values are kept on a failed submit
 * (Docs/DESIGN_SYSTEM.md "Preserve entered form values when submission
 * fails").
 */
export function ProjectForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ProjectFormProps) {
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
    const result = createProjectSchema.safeParse({
      code,
      name,
      description: description || undefined,
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
        "Could not save this project. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Project Code" required error={errors.code}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
              placeholder="E.G. ME, SW, EC"
            />
          )}
        </FormField>

        <FormField label="Project Name" required error={errors.name}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Mechanical Engineering"
            />
          )}
        </FormField>

        <FormField label="Description (Optional)" error={errors.description}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Hardware CAD & Thermal"
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
