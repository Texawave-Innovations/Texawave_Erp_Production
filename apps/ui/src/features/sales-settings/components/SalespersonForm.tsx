"use client";

import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { sanitizeName, sanitizePhone } from "../sanitize";
import { salespersonSchema, type SalespersonFormValues } from "../schema";

export interface SalespersonFormProps {
  initialValues?: Partial<SalespersonFormValues>;
  onSubmit: (values: SalespersonFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function SalespersonForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: SalespersonFormProps) {
  const [values, setValues] = useState<SalespersonFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    email: initialValues?.email ?? "",
    phone: initialValues?.phone ?? "",
    commissionPercent: initialValues?.commissionPercent,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof SalespersonFormValues>(
    key: K,
    value: SalespersonFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = salespersonSchema.safeParse(values);
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
      setSubmitError("Could not save this salesperson. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Name" required error={errors.name}>
        {(fp) => (
          <Input
            {...fp}
            value={values.name}
            onChange={(e) => setField("name", sanitizeName(e.target.value))}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Code" error={errors.code}>
        {(fp) => (
          <Input
            {...fp}
            value={values.code}
            onChange={(e) => setField("code", e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Email" error={errors.email}>
        {(fp) => (
          <Input
            {...fp}
            type="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Phone" error={errors.phone}>
        {(fp) => (
          <Input
            {...fp}
            value={values.phone}
            onChange={(e) => setField("phone", sanitizePhone(e.target.value))}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Commission %" error={errors.commissionPercent}>
        {(fp) => (
          <Input
            {...fp}
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={values.commissionPercent ?? ""}
            onChange={(e) =>
              setField(
                "commissionPercent",
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
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
