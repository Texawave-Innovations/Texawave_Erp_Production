"use client";

import {
  ACCOUNT_STATUS_TAGS,
  type ChangeAccountStatusTagFormValues,
  changeAccountStatusTagSchema,
} from "@texawave-erp/core";
import { Button, Dialog, FormField, Input, Select } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface StatusTagDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ChangeAccountStatusTagFormValues) => Promise<void>;
  currentStatusTag?: string | null | undefined;
}

/** Mirrors legacy `StatusTagDialog` — tag picker + the per-tag required
 * companion field (reason/date/infoType), enforced client-side via
 * `changeAccountStatusTagSchema` (which mirrors
 * `AccountsService.changeStatusTag`'s `assertStatusTagFieldsPresent`
 * exactly) so the user gets inline validation before the 422 round-trip. */
export function StatusTagDialog({
  open,
  onClose,
  onSubmit,
  currentStatusTag,
}: StatusTagDialogProps) {
  const [statusTag, setStatusTag] = useState(currentStatusTag ?? "");
  const [statusReason, setStatusReason] = useState("");
  const [statusDate, setStatusDate] = useState("");
  const [statusInfoType, setStatusInfoType] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = changeAccountStatusTagSchema.safeParse({
      statusTag,
      statusReason,
      statusDate,
      statusInfoType,
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
      setSubmitError("Could not update the status tag. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Change status tag">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Status tag" required error={errors.statusTag}>
          {(fp) => (
            <Select
              {...fp}
              invalid={fp.invalid}
              value={statusTag}
              onChange={(e) => setStatusTag(e.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>
                Select a status
              </option>
              {ACCOUNT_STATUS_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {statusTag === "Not Interested" ? (
          <FormField label="Reason" required error={errors.statusReason}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        ) : null}

        {statusTag === "Keep in Touch" || statusTag === "Call Back" ? (
          <FormField
            label={
              statusTag === "Call Back"
                ? "Call back date/time"
                : "Follow-up date"
            }
            required
            error={errors.statusDate}
          >
            {(fp) => (
              <Input
                {...fp}
                type={statusTag === "Call Back" ? "datetime-local" : "date"}
                invalid={fp.invalid}
                value={statusDate}
                onChange={(e) => setStatusDate(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        ) : null}

        {statusTag === "Send Info" ? (
          <FormField label="Info type" required error={errors.statusInfoType}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={statusInfoType}
                onChange={(e) => setStatusInfoType(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Brochure, Pricing"
              />
            )}
          </FormField>
        ) : null}

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
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
