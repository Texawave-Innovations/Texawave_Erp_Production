"use client";

import { Button, Checkbox, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { sanitizeCode, sanitizeDigits, sanitizeName } from "../sanitize";
import { bankAccountSchema, type BankAccountFormValues } from "../schema";

export interface BankAccountFormProps {
  initialValues?: Partial<BankAccountFormValues>;
  onSubmit: (values: BankAccountFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function BankAccountForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: BankAccountFormProps) {
  const [values, setValues] = useState<BankAccountFormValues>({
    bankName: initialValues?.bankName ?? "",
    accountHolderName: initialValues?.accountHolderName ?? "",
    accountNumber: initialValues?.accountNumber ?? "",
    ifscCode: initialValues?.ifscCode ?? "",
    branchName: initialValues?.branchName ?? "",
    isPrimary: initialValues?.isPrimary ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof BankAccountFormValues>(
    key: K,
    value: BankAccountFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = bankAccountSchema.safeParse(values);
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
      setSubmitError("Could not save this bank account. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Bank name" required error={errors.bankName}>
        {(fp) => (
          <Input
            {...fp}
            value={values.bankName}
            onChange={(e) => setField("bankName", sanitizeName(e.target.value))}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField
        label="Account holder name"
        required
        error={errors.accountHolderName}
      >
        {(fp) => (
          <Input
            {...fp}
            value={values.accountHolderName}
            onChange={(e) =>
              setField("accountHolderName", sanitizeName(e.target.value))
            }
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Account number" required error={errors.accountNumber}>
        {(fp) => (
          <Input
            {...fp}
            value={values.accountNumber}
            onChange={(e) =>
              setField("accountNumber", sanitizeDigits(e.target.value, 18))
            }
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="IFSC code" required error={errors.ifscCode}>
        {(fp) => (
          <Input
            {...fp}
            value={values.ifscCode}
            onChange={(e) =>
              setField("ifscCode", sanitizeCode(e.target.value, 11))
            }
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Branch name" error={errors.branchName}>
        {(fp) => (
          <Input
            {...fp}
            value={values.branchName}
            onChange={(e) =>
              setField("branchName", sanitizeName(e.target.value))
            }
            disabled={submitting}
          />
        )}
      </FormField>
      <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-white/90">
        <Checkbox
          checked={values.isPrimary}
          onChange={(e) => setField("isPrimary", e.target.checked)}
          disabled={submitting}
        />
        Primary account
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
