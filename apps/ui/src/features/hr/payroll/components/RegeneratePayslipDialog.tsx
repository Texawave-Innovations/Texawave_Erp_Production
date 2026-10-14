"use client";

import { Dialog, FormField, Textarea, useToast } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { describeError } from "../format";
import { useRegeneratePayslip } from "../hooks";
import type { Payslip } from "../types";
import { DialogActions, ServerError } from "./DialogParts";

const MIN_REASON = 10;

/**
 * Regenerate one issued payslip (Docs/PAYROLL_AND_COMPLIANCE.md §4.16): its
 * content is rebuilt from the current (approved-run) entry — e.g. after a
 * bank-detail correction. A changed payslip becomes a new version carrying
 * the reason; an unchanged one stays as it is. Organization-wide
 * (`hr.payroll.write.all`).
 */
export function RegeneratePayslipDialog({
  payslip,
  onClose,
}: {
  payslip: Payslip;
  onClose: () => void;
}) {
  const regenerate = useRegeneratePayslip();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setError(`Give a reason of at least ${MIN_REASON} characters`);
      return;
    }
    setError(undefined);
    setServerError(null);
    try {
      const updated = await regenerate.mutateAsync({
        id: payslip.id,
        reason: reason.trim(),
      });
      const version = updated.version ?? 1;
      toast({
        title:
          version > (payslip.version ?? 1)
            ? `${payslip.payslipNumber} regenerated — version ${version}`
            : `${payslip.payslipNumber} is unchanged`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Regenerate ${payslip.payslipNumber}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          The payslip is rebuilt from the current employee, bank and company
          details. If anything changed it becomes a new version and the
          employee&apos;s PDF is re-issued; the reason is kept with it.
        </p>
        <FormField label="Reason" required error={error}>
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={regenerate.isPending}
          submitLabel="Regenerate"
        />
      </form>
    </Dialog>
  );
}
