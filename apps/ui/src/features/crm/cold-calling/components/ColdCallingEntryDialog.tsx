"use client";

import {
  createColdCallingEntrySchema,
  type CreateColdCallingEntryFormValues,
} from "@texawave-erp/core";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface ColdCallingEntryDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  initialValues?: Partial<CreateColdCallingEntryFormValues> | undefined;
  onSubmit: (values: CreateColdCallingEntryFormValues) => Promise<void>;
}

/** Add/Edit form for a Cold Calling Status row — mirrors legacy
 * `ColdCallingStatus.tsx`'s row shape (SINO / Date / Company Name /
 * Prospect Name / Designation / Status), validated client-side via
 * `createColdCallingEntrySchema` (mirrors the server DTO). */
export function ColdCallingEntryDialog({
  open,
  onClose,
  title,
  submitLabel,
  initialValues,
  onSubmit,
}: ColdCallingEntryDialogProps) {
  const [serialNo, setSerialNo] = useState(initialValues?.serialNo ?? "");
  const [callDate, setCallDate] = useState(initialValues?.callDate ?? "");
  const [companyName, setCompanyName] = useState(
    initialValues?.companyName ?? "",
  );
  const [prospectName, setProspectName] = useState(
    initialValues?.prospectName ?? "",
  );
  const [designation, setDesignation] = useState(
    initialValues?.designation ?? "",
  );
  const [status, setStatus] = useState(initialValues?.status ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createColdCallingEntrySchema.safeParse({
      serialNo,
      callDate,
      companyName,
      prospectName,
      designation,
      status,
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
      onClose();
    } catch {
      setSubmitError("Could not save this record. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Serial no (SINO)" error={errors.serialNo}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Date" error={errors.callDate}>
            {(fp) => (
              <Input
                {...fp}
                type="date"
                invalid={fp.invalid}
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <FormField label="Company name" required error={errors.companyName}>
          {(fp) => (
            <Input
              {...fp}
              invalid={fp.invalid}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Prospect name" error={errors.prospectName}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Designation" error={errors.designation}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <FormField label="Cold calling status" error={errors.status}>
          {(fp) => (
            <Textarea
              {...fp}
              invalid={fp.invalid}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
              placeholder="Raw outcome, as logged — free text"
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
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
