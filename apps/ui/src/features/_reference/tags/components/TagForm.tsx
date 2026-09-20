"use client";

import { createTagSchema, type CreateTagFormValues } from "@texawave-erp/core";
import { TAG_COLOR_TOKENS } from "@texawave-erp/api-types";
import { Button, FormField, Input, Select } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface TagFormProps {
  initialValues?: Partial<CreateTagFormValues>;
  onSubmit: (values: CreateTagFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/**
 * Validates client-side with the same zod schema the mutation payload has to
 * satisfy server-side (`packages/core`'s `createTagSchema`) — fails the same
 * way before a round trip. Entered values are kept on a failed submit
 * (Docs/DESIGN_SYSTEM.md "Preserve entered form values when submission
 * fails") because this is a plain controlled form with no reset-on-error
 * logic anywhere in the failure path.
 */
export function TagForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: TagFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [colorToken, setColorToken] = useState(
    initialValues?.colorToken ?? "gray",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createTagSchema.safeParse({ name, colorToken });
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
        "Could not save this tag. Check the fields above and try again.",
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
      <FormField label="Color">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={colorToken}
            onChange={(e) => setColorToken(e.target.value as typeof colorToken)}
            disabled={submitting}
          >
            {TAG_COLOR_TOKENS.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </Select>
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
