"use client";

import {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  createLeadSchema,
  type CreateLeadFormValues,
} from "@texawave-erp/core";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface LeadFormProps {
  initialValues?: Partial<CreateLeadFormValues>;
  onSubmit: (values: CreateLeadFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

type TextField = Exclude<keyof CreateLeadFormValues, "leadStatus" | "priority">;

const emptyValues: Record<TextField, string> = {
  companyName: "",
  prospectName: "",
  domain: "",
  hq: "",
  industry: "",
  annualRevenue: "",
  numberOfEmployees: "",
  title: "",
  contactNumber: "",
  mobile: "",
  email: "",
  addressStreet: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  assignedTo: "",
  leadSource: "",
  tags: "",
  areaOfInterest: "",
  comments: "",
};

/** Reproduces the legacy Leads.tsx save guard: blocked client-side without
 * `companyName`/`prospectName`. Grouped into the same sections as legacy's
 * `LEAD_FORM_SECTIONS` (Lead Information, Company, Contact, Address,
 * Requirement & Notes) — Meeting Details and the GDPR/tags fields are
 * deferred to a later pass (not read by the Convert flow). */
export function LeadForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: LeadFormProps) {
  const [values, setValues] = useState<Record<TextField, string>>(() => {
    const merged = { ...emptyValues };
    for (const key of Object.keys(emptyValues) as TextField[]) {
      merged[key] = initialValues?.[key] ?? "";
    }
    return merged;
  });
  const [leadStatus, setLeadStatus] = useState<string>(
    initialValues?.leadStatus ?? "NEW",
  );
  const [priority, setPriority] = useState<string>(
    initialValues?.priority ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set(field: TextField) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createLeadSchema.safeParse({
      ...values,
      leadStatus: leadStatus || undefined,
      priority: priority || undefined,
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
        "Could not save this lead. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-4">
        <FormField label="Lead Status" htmlFor="leadStatus">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
              disabled={submitting}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Priority" htmlFor="priority">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={submitting}
            >
              <option value="">—</option>
              {LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Lead Source" error={errors.leadSource}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.leadSource}
              onChange={set("leadSource")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Lead Owner (Assigned To)" error={errors.assignedTo}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.assignedTo}
              onChange={set("assignedTo")}
              disabled={submitting}
            />
          )}
        </FormField>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <FormField
          label="Name of the Company"
          required
          error={errors.companyName}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.companyName}
              onChange={set("companyName")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Domain / Website" error={errors.domain}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.domain}
              onChange={set("domain")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Industry" error={errors.industry}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.industry}
              onChange={set("industry")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="No. of Employees" error={errors.numberOfEmployees}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.numberOfEmployees}
              onChange={set("numberOfEmployees")}
              disabled={submitting}
            />
          )}
        </FormField>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <FormField
          label="Prospect / Lead Name"
          required
          error={errors.prospectName}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.prospectName}
              onChange={set("prospectName")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Title" error={errors.title}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.title}
              onChange={set("title")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Phone" error={errors.contactNumber}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.contactNumber}
              onChange={set("contactNumber")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Email id" error={errors.email}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              invalid={fieldProps.invalid}
              value={values.email}
              onChange={set("email")}
              disabled={submitting}
            />
          )}
        </FormField>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <FormField label="HQ" error={errors.hq}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.hq}
              onChange={set("hq")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="City" error={errors.city}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.city}
              onChange={set("city")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="State / Province" error={errors.state}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.state}
              onChange={set("state")}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Country" error={errors.country}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={values.country}
              onChange={set("country")}
              disabled={submitting}
            />
          )}
        </FormField>
      </section>

      <FormField
        label="Area of Interest / Requirement"
        error={errors.areaOfInterest}
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            invalid={fieldProps.invalid}
            rows={2}
            value={values.areaOfInterest}
            onChange={set("areaOfInterest")}
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
