"use client";

import {
  createContactSchema,
  type CreateContactFormValues,
} from "@texawave-erp/core";
import { Button, Checkbox, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { AccountCombobox } from "../../accounts/components/AccountCombobox";

export interface ContactFormProps {
  initialValues?: Partial<CreateContactFormValues>;
  onSubmit: (values: CreateContactFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Reproduces the legacy Contacts.tsx save guard: blocked client-side
 * without `name` and `accountId`
 * (`if (!form.name.trim() || !form.accountId) return;`). */
export function ContactForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ContactFormProps) {
  const [accountId, setAccountId] = useState<number | undefined>(
    initialValues?.accountId,
  );
  const [name, setName] = useState(initialValues?.name ?? "");
  const [designation, setDesignation] = useState(
    initialValues?.designation ?? "",
  );
  const [department, setDepartment] = useState(initialValues?.department ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(initialValues?.whatsapp ?? "");
  const [isPrimary, setIsPrimary] = useState(initialValues?.isPrimary ?? false);
  const [isDecisionMaker, setIsDecisionMaker] = useState(
    initialValues?.isDecisionMaker ?? false,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createContactSchema.safeParse({
      accountId,
      name,
      designation,
      department,
      email,
      phone,
      whatsapp,
      isPrimary,
      isDecisionMaker,
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
        "Could not save this contact. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AccountCombobox
        value={accountId}
        onChange={setAccountId}
        disabled={submitting}
        error={errors.accountId}
      />
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
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Designation" error={errors.designation}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Department" error={errors.department}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      <FormField label="Email" error={errors.email}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="email"
            invalid={fieldProps.invalid}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Phone" error={errors.phone}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="WhatsApp" error={errors.whatsapp}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            disabled={submitting}
          />
          Primary contact
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={isDecisionMaker}
            onChange={(e) => setIsDecisionMaker(e.target.checked)}
            disabled={submitting}
          />
          Decision maker
        </label>
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
